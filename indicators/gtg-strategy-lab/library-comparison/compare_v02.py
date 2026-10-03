"""GTG Lab library comparison v0.2 — Train-wide stability expansion.

Registered in PROTOCOL_V02.md before this runner was implemented/executed.
Never reads a raw daily file dated 2024-03-20 or later.
"""
from __future__ import annotations
import os
os.environ.setdefault("NUMBA_NUM_THREADS", "2")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

import argparse, hashlib, json, sys, time
from pathlib import Path
from datetime import datetime, timezone, timedelta
import importlib.metadata as md
import numpy as np
import pandas as pd

from compare import (
    W, K, SEED, ms, dc_states, costs, frame_for,
    kronos_load, kronos_predict, z
)
from compare import read_day

HERE = Path(__file__).resolve().parent
SOURCE_START = "2021-07-31"
EVAL_START = "2021-09-29"
END = "2024-03-20"  # exclusive; do not open the raw file for this date
N_ANCHORS = 240
LOOKBACK_MS = 60 * 86_400_000


def guard_dates():
    if not (SOURCE_START < EVAL_START < END):
        raise ValueError("v0.2 date ordering")
    if END != "2024-03-20":
        raise ValueError("registered Train-safe end changed")


def validate_bar(b):
    for side in ("b", "a"):
        o, h, l, c = (b[side + x] for x in ("o", "h", "l", "c"))
        if any(v is None or not np.isfinite(v) or v <= 0 for v in (o, h, l, c)):
            raise ValueError("missing or invalid quote")
        if not l <= min(o, c) <= max(o, c) <= h:
            raise ValueError("invalid OHLC")
    if b["ao"] < b["bo"] or b["ac"] < b["bc"]:
        raise ValueError("crossed quote")


def load_source(root: Path, out: Path):
    guard_dates()
    manifest, rows = [], []
    day = datetime.fromisoformat(SOURCE_START)
    while day.strftime("%Y-%m-%d") < END:
        date = day.strftime("%Y-%m-%d")
        p = root / "m1" / day.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if p.exists():
            blob = p.read_bytes()
            manifest.append({
                "day": date,
                "sha256": hashlib.sha256(blob).hexdigest(),
                "bytes": len(blob),
            })
            day_rows = read_day(p)
            for b in day_rows:
                validate_bar(b)
            rows.extend(day_rows)
        day += timedelta(days=1)
    if not rows:
        raise ValueError("No source bars")
    t = np.asarray([b["t"] for b in rows], dtype=np.int64)
    if np.any(np.diff(t) <= 0):
        raise ValueError("timestamps unsorted/duplicated")
    if t.min() < ms(SOURCE_START) or t.max() >= ms(END):
        raise ValueError("source crossed registered date gate")
    if manifest and manifest[-1]["day"] >= END:
        raise ValueError("opened a forbidden raw day")
    (out / "input_manifest.json").write_text(json.dumps(manifest, indent=2))
    return rows


def eligible_anchors(f: pd.DataFrame, h: int, step: int):
    t = f.t.to_numpy()
    choices = [
        i for i in range(W - 1, len(f) - h)
        if ms(EVAL_START) <= t[i] < ms(END)
        and np.isfinite(f.atr.iloc[i]) and f.atr.iloc[i] > 0
        and np.all(np.diff(t[i:i + h + 1]) == step)
    ]
    if len(choices) < N_ANCHORS:
        raise ValueError(f"only {len(choices)} eligible timestamps")
    picked = [choices[j] for j in np.unique(np.linspace(
        0, len(choices) - 1, N_ANCHORS, dtype=int
    ))]
    result = []
    for i in picked:
        if not result or i > result[-1] + h:
            result.append(i)
    if len(result) != N_ANCHORS:
        raise ValueError(f"registered anchor count not met: {len(result)}")
    return result


def rolling_bank_indices(f, q, h, step, direction, states):
    t = f.t.to_numpy()
    context_start = q - W + 1
    cutoff = int(t[q]) - LOOKBACK_MS
    result = []
    for j in range(W - 1, q - h):
        if j + h >= context_start:
            continue
        if int(t[j - W + 1]) < cutoff:
            continue
        if not np.isfinite(f.atr.iloc[j]) or f.atr.iloc[j] <= 0:
            continue
        if states[j]["direction"] != direction:
            continue
        if not np.all(np.diff(t[j:j + h + 1]) == step):
            continue
        result.append(j)
    return result


def analogue(f, q, h, step, states):
    import stumpy
    from tslearn.metrics import dtw
    close = f.bc.to_numpy()
    logs = np.log(close)
    candidates = rolling_bank_indices(
        f, q, h, step, states[q]["direction"], states
    )
    if len(candidates) < K:
        return 0.0, 0.0, {"reason": "insufficient_bank", "neighbors": []}

    # Corpus ends before query context begins. Candidate labels are also mature before it.
    context_start = q - W + 1
    corpus = logs[:context_start]
    query = logs[context_start:q + 1]
    if len(corpus) < W:
        return 0.0, 0.0, {"reason": "insufficient_corpus", "neighbors": []}
    dist = stumpy.mass(query, corpus)

    ranked = sorted(candidates, key=lambda j: (float(dist[j - W + 1]), j))
    selected = []
    for j in ranked:
        di = float(dist[j - W + 1])
        if np.isfinite(di) and all(abs(j - k) >= W for k in selected):
            selected.append(j)
            if len(selected) == 20:
                break
    if len(selected) < K:
        return 0.0, 0.0, {
            "reason": "insufficient_independent_neighbors", "neighbors": []
        }

    label = lambda j: float((close[j + h] - close[j]) / f.atr.iloc[j])
    mass_pred = float(np.median([label(j) for j in selected[:K]]))
    qz = z(query)
    reranked = sorted(
        selected,
        key=lambda j: (
            dtw(
                qz, z(logs[j - W + 1:j + 1]),
                global_constraint="sakoe_chiba",
                sakoe_chiba_radius=4,
            ),
            j,
        ),
    )
    best = reranked[:K]
    pred = float(np.median([label(j) for j in best]))
    info = {
        "reason": "ok",
        "neighbors": best,
        "neighbor_times": [int(f.t.iloc[j]) for j in best],
        "min_pattern_start": int(min(f.t.iloc[j - W + 1] for j in best)),
        "max_label_time": int(max(f.t.iloc[j + h] for j in best)),
        "query_context_start": int(f.t.iloc[context_start]),
        "rolling_cutoff": int(f.t.iloc[q]) - LOOKBACK_MS,
    }
    if info["min_pattern_start"] < info["rolling_cutoff"]:
        raise AssertionError("rolling bank exceeded 60 days")
    if info["max_label_time"] >= info["query_context_start"]:
        raise AssertionError("analogue label overlaps query context")
    return mass_pred, pred, info


def metrics(g: pd.DataFrame):
    good = g[g.status == "ok"]
    if good.empty:
        return {"status": "failed", "n": 0}
    active = good[good.direction != 0]
    sign_rows = active[active.actual != 0]
    return {
        "status": "ok",
        "n": int(len(good)),
        "active": int(len(active)),
        "coverage": float(len(active) / len(good)),
        "mae_atr": float(np.mean(abs(good.pred - good.actual))),
        "direction_accuracy": (
            float(np.mean(sign_rows.direction == np.sign(sign_rows.actual)))
            if len(sign_rows) else None
        ),
        "c1_win_rate": float(np.mean(active.c1 > 0)) if len(active) else None,
        **{
            c + "_mean_per_opportunity": float(good[c].mean())
            for c in ("c0", "c1", "c2")
        },
        "c1_mean_per_trade": float(active.c1.mean()) if len(active) else None,
        "total_seconds": float(good.seconds.sum()),
    }


def summarize(records):
    df = pd.DataFrame(records)
    overall = []
    quarterly = []
    for (track, model), g in df.groupby(["track", "model"]):
        row = {"track": track, "model": model, **metrics(g)}
        row["evidence"] = (
            "PRETRAINED_CONTAMINATION_UNKNOWN"
            if model == "kronos_mini" else "TRAIN_DEVELOPMENT_ONLY"
        )
        overall.append(row)

        ok = g[g.status == "ok"].copy()
        if len(ok):
            ok["quarter"] = pd.to_datetime(
                ok.time, unit="ms", utc=True
            ).dt.to_period("Q").astype(str)
            for quarter, qg in ok.groupby("quarter"):
                quarterly.append({
                    "track": track,
                    "model": model,
                    "quarter": quarter,
                    **metrics(qg),
                })
    return overall, quarterly


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--vendor", required=True)
    a = p.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)
    versions = {
        n: md.version(n)
        for n in ("numpy", "pandas", "stumpy", "tslearn", "torch", "huggingface-hub")
    }
    protocol = HERE / "PROTOCOL_V02.md"
    (out / "environment.json").write_text(json.dumps({
        "python": sys.version,
        "packages": versions,
        "protocol_sha256": hashlib.sha256(protocol.read_bytes()).hexdigest(),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "source_start": SOURCE_START,
        "eval_start": EVAL_START,
        "eval_end_exclusive": END,
        "anchors_per_track": N_ANCHORS,
        "rolling_bank_days": 60,
    }, indent=2))

    rows = load_source(Path(a.root), out)
    print("SOURCE", len(rows), "M1 bars; Train-safe raw days only", flush=True)

    datasets = {}
    for track, tf, h, step, threshold in (
        ("scalp", "M5", 3, 300000, .001),
        ("swing", "H1", 4, 3600000, .005),
    ):
        f, quality = frame_for(rows, tf, step)
        anchors = eligible_anchors(f, h, step)
        datasets[track] = (f, anchors, h, step, threshold)
        (out / (track + "_cohort.json")).write_text(json.dumps({
            "quality": quality,
            "anchors": [int(f.t.iloc[i]) for i in anchors],
        }, indent=2))
        print("COHORT", track, quality, len(anchors), flush=True)
    del rows

    predictor = None
    model_error = None
    try:
        predictor = kronos_load(Path(a.vendor), out)
    except Exception as e:
        model_error = repr(e)
        (out / "kronos_error.txt").write_text(model_error)
        print("KRONOS_BLOCKED", model_error, flush=True)

    records = []
    checks = {}
    for track, (f, anchors, h, step, threshold) in datasets.items():
        states = dc_states(f.bc.to_numpy(), threshold)
        for n, q in enumerate(anchors):
            tic = time.perf_counter()
            mass, dtw_pred, neighbors = analogue(f, q, h, step, states)
            analogue_seconds = time.perf_counter() - tic

            if n == 0:
                prefix = f.iloc[:q + 1].copy()
                prefix_states = dc_states(prefix.bc.to_numpy(), threshold)
                assert prefix_states == states[:q + 1]
                pm, pd_, pn = analogue(prefix, q, h, step, prefix_states)
                assert pm == mass and pd_ == dtw_pred and pn == neighbors
                checks[track + "_prefix_causality"] = "PASS"
                checks[track + "_rolling_bank_bound"] = "PASS"

            preds = {
                "flat": (0.0, 0.0),
                "drift": (
                    float((f.bc.iloc[q] - f.bc.iloc[q - 12]) * h / 12 / f.atr.iloc[q]),
                    0.0,
                ),
                "dc_direction": (states[q]["direction"] * h / 12, 0.0),
                "dc_mass": (mass, analogue_seconds),
                "dc_mass_dtw": (dtw_pred, analogue_seconds),
            }

            if predictor is not None:
                tic = time.perf_counter()
                kp = kronos_predict(predictor, f.iloc[:q + 1], h, step, SEED + q)
                elapsed = time.perf_counter() - tic
                if n == 0:
                    kp2 = kronos_predict(
                        predictor, f.iloc[:q + 1].copy(), h, step, SEED + q
                    )
                    assert kp == kp2, "Kronos same-seed repeat failed"
                    checks[track + "_kronos_repeat"] = "PASS"
                preds["kronos_mini"] = (kp, elapsed)

            actual = float((f.bc.iloc[q + h] - f.bc.iloc[q]) / f.atr.iloc[q])
            for name, (pred, seconds) in preds.items():
                d = int(np.sign(pred))
                r = {
                    "track": track,
                    "model": name,
                    "time": int(f.t.iloc[q]),
                    "pred": pred,
                    "actual": actual,
                    "direction": d,
                    "seconds": seconds,
                    "status": "ok",
                    **costs(
                        d,
                        float(f.bo.iloc[q + 1]),
                        float(f.ao.iloc[q + 1]),
                        float(f.bc.iloc[q + h]),
                        float(f.ac.iloc[q + h]),
                        float(f.atr.iloc[q]),
                    ),
                }
                if name.startswith("dc_mass"):
                    r["neighbors"] = neighbors
                records.append(r)
                with (out / "predictions.jsonl").open("a") as fh:
                    fh.write(json.dumps(r) + "\n")

            if predictor is None:
                records.append({
                    "track": track,
                    "model": "kronos_mini",
                    "status": "failed",
                    "time": int(f.t.iloc[q]),
                    "error": model_error,
                })
            if (n + 1) % 20 == 0 or n == 0 or n + 1 == len(anchors):
                print("DONE", track, n + 1, "/", len(anchors), flush=True)

        (out / "checks.json").write_text(json.dumps(checks, indent=2))

    overall, quarterly = summarize(records)
    report = {
        "scope": "Train-wide stability expansion; 2021-09-29 to 2024-03-20 exclusive",
        "validation_read": False,
        "holdout_read": False,
        "checks": checks,
        "results": overall,
        "quarterly": quarterly,
        "limitations": [
            "Train development evidence only; not OOS",
            "Kronos pretraining overlap unknown",
            "no fine tuning",
            "fixed-horizon quotes; no stop/target simulation",
            "C1 is an assumed spread/slippage benchmark, not actual account fees",
            "quarter breakdown is descriptive and may not be cherry-picked",
        ],
    }
    (out / "summary.json").write_text(json.dumps(report, indent=2, allow_nan=False))
    print(json.dumps({
        "checks": checks,
        "results": overall,
        "quarter_rows": len(quarterly),
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
