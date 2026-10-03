"""Kronos Swing Stress v0.1 — preregistered Train-only robustness test."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as md
import json
import math
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "data"))

from store import read_day
from compare import frame_for, dc_states, costs, kronos_predict, W

PROTOCOL = HERE / "PROTOCOL_KRONOS_SWING_STRESS_V01.md"
RAW_START = "2021-09-01"
RAW_END = "2024-03-20"
ANCHOR_START = "2021-10-01"
SEED = 20261003
STEP = 3_600_000
H = 4
DC_THRESHOLD = 0.005
SOURCE_REV = "67b630e67f6a18c9e9be918d9b4337c960db1e9a"
PINNED = {
    "NeoQuasar/Kronos-Tokenizer-2k": "26966d0035065a0cae0ebad7af8ece35bc1fb51c",
    "NeoQuasar/Kronos-mini": "f4e68697d9d5aed55cef5c96aabc3376bcad9f81",
}
QUARTERS = [
    ("2021Q4", "2021-10-01", "2022-01-01"),
    ("2022Q1", "2022-01-01", "2022-04-01"),
    ("2022Q2", "2022-04-01", "2022-07-01"),
    ("2022Q3", "2022-07-01", "2022-10-01"),
    ("2022Q4", "2022-10-01", "2023-01-01"),
    ("2023Q1", "2023-01-01", "2023-04-01"),
    ("2023Q2", "2023-04-01", "2023-07-01"),
    ("2023Q3", "2023-07-01", "2023-10-01"),
    ("2023Q4", "2023-10-01", "2024-01-01"),
    ("2024Q1", "2024-01-01", "2024-03-20"),
]


def ms(s: str) -> int:
    return int(pd.Timestamp(s, tz="UTC").timestamp() * 1000)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_bar(b):
    for side in ("b", "a"):
        o, h, l, c = (b[side + x] for x in ("o", "h", "l", "c"))
        if any(v is None or not np.isfinite(v) or v <= 0 for v in (o, h, l, c)):
            raise ValueError("missing/invalid quote")
        if not l <= min(o, c) <= max(o, c) <= h:
            raise ValueError("invalid OHLC")
    if b["ao"] < b["bo"] or b["ac"] < b["bc"]:
        raise ValueError("crossed quote")


def load_source(root: Path, manifest_path: Path):
    rows, manifest = [], []
    day = datetime.fromisoformat(RAW_START)
    stop = datetime.fromisoformat(RAW_END)
    while day < stop:
        ds = day.strftime("%Y-%m-%d")
        p = root / "m1" / day.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if p.exists():
            blob = p.read_bytes()
            manifest.append({
                "day": ds,
                "sha256": hashlib.sha256(blob).hexdigest(),
                "bytes": len(blob),
            })
            rr = read_day(p)
            for b in rr:
                validate_bar(b)
            rows.extend(rr)
        day += timedelta(days=1)

    if not rows:
        raise ValueError("no source rows")
    t = np.asarray([b["t"] for b in rows], dtype=np.int64)
    if np.any(np.diff(t) <= 0):
        raise ValueError("timestamps not strictly increasing")
    if t.min() < ms(RAW_START) or t.max() >= ms(RAW_END):
        raise ValueError("raw date gate violated")
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return rows


def load_pinned(vendor: Path, out: Path):
    import torch
    from huggingface_hub import snapshot_download

    actual = subprocess.check_output(
        ["git", "-C", str(vendor), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual != SOURCE_REV:
        raise ValueError(f"Kronos source revision mismatch: {actual}")

    sys.path.insert(0, str(vendor))
    from model import Kronos, KronosTokenizer, KronosPredictor

    local = {}
    for repo, revision in PINNED.items():
        local[repo] = snapshot_download(
            repo_id=repo,
            revision=revision,
            allow_patterns=["*.json", "*.safetensors"],
        )

    (out / "model_revisions.json").write_text(
        json.dumps({"source": SOURCE_REV, **PINNED}, indent=2),
        encoding="utf-8",
    )
    torch.set_num_threads(2)
    tok = KronosTokenizer.from_pretrained(local["NeoQuasar/Kronos-Tokenizer-2k"])
    model = Kronos.from_pretrained(local["NeoQuasar/Kronos-mini"])
    tok.eval()
    model.eval()
    return KronosPredictor(model, tok, device="cpu", max_context=2048)


def eligible_quarter(f: pd.DataFrame, start: str, end: str):
    t = f.t.to_numpy()
    s, e = ms(start), ms(end)
    candidates = []
    for i in range(max(W - 1, 12), len(f) - H):
        if not (s <= t[i] < e):
            continue
        if t[i + H] >= e:
            continue
        if not np.all(np.diff(t[i:i + H + 1]) == STEP):
            continue
        if not np.isfinite(f.atr.iloc[i]) or f.atr.iloc[i] <= 0:
            continue
        if candidates and i <= candidates[-1] + H:
            continue
        candidates.append(i)
    if len(candidates) < 60:
        raise ValueError(f"{start}..{end}: only {len(candidates)} eligible anchors")
    pick = np.unique(np.linspace(0, len(candidates) - 1, 60, dtype=int))
    if len(pick) != 60:
        raise AssertionError("quarter anchor count")
    return [candidates[int(j)] for j in pick]


def drift_pred(f, q):
    return float((f.bc.iloc[q] - f.bc.iloc[q - 12]) * H / 12 / f.atr.iloc[q])


def vol_percentile_60d(f: pd.DataFrame, q: int):
    now = int(f.t.iloc[q])
    lo = now - 60 * 24 * STEP
    vals = (f.atr / f.bc).to_numpy(dtype=float)
    t = f.t.to_numpy()
    hist = vals[(t >= lo) & (t < now) & np.isfinite(vals)]
    cur = float(vals[q])
    if len(hist) < 200:
        raise ValueError("insufficient 60d volatility history")
    return float(np.mean(hist <= cur))


def strength_bin(x):
    if x < 0.5:
        return "<0.5"
    if x < 1:
        return "0.5-<1"
    if x < 2:
        return "1-<2"
    return ">=2"


def magnitude_bin(x):
    x = abs(x)
    if x < 0.25:
        return "<0.25"
    if x < 0.5:
        return "0.25-<0.5"
    if x < 1:
        return "0.5-<1"
    return ">=1"


def volatility_bin(p):
    if p <= 1 / 3:
        return "low"
    if p < 2 / 3:
        return "mid"
    return "high"


def spread_bin(x):
    if x <= 0.05:
        return "<=0.05"
    if x <= 0.10:
        return ">0.05-<=0.10"
    return ">0.10"


def session_bin(t_ms):
    h = pd.to_datetime(t_ms, unit="ms", utc=True).hour
    if h <= 6:
        return "Asia"
    if h <= 12:
        return "London"
    if h <= 20:
        return "New York"
    return "Late"


def wilson(k, n, z=1.959963984540054):
    if n <= 0:
        return [None, None]
    p = k / n
    den = 1 + z * z / n
    center = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [float(center - half), float(center + half)]


def metrics(g: pd.DataFrame):
    active = g[g.direction != 0]
    sign_rows = active[active.actual != 0]
    d = {
        "n": int(len(g)),
        "active": int(len(active)),
        "coverage": float(len(active) / len(g)) if len(g) else 0.0,
        "direction_accuracy": (
            float(np.mean(sign_rows.direction == np.sign(sign_rows.actual)))
            if len(sign_rows) else None
        ),
        "c1_win_rate": float(np.mean(active.c1 > 0)) if len(active) else None,
        "mae_atr": float(np.mean(np.abs(g.pred - g.actual))) if len(g) else None,
        "mean_pred_atr": float(g.pred.mean()) if len(g) else None,
        "mean_abs_pred_atr": float(np.abs(g.pred).mean()) if len(g) else None,
    }
    for c in ("c0", "c1", "c2"):
        d[f"{c}_mean_per_trade"] = float(active[c].mean()) if len(active) else None
        d[f"{c}_mean_per_opportunity"] = float(g[c].mean()) if len(g) else None
    return d


def summarize_bins(df: pd.DataFrame, col: str):
    rows = []
    kg = df[df.model == "kronos_mini"]
    for value, part in kg.groupby(col, dropna=False):
        rows.append({
            "dimension": col,
            "bin": str(value),
            **metrics(part),
            "interpretable": bool(len(part) >= 30),
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--vendor", required=True)
    args = ap.parse_args()

    root, out, vendor = Path(args.root), Path(args.out), Path(args.vendor)
    out.mkdir(parents=True, exist_ok=False)

    versions = {}
    for name in ("numpy", "pandas", "torch", "huggingface-hub"):
        try:
            versions[name] = md.version(name)
        except Exception:
            pass
    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "packages": versions,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    rows = load_source(root, out / "input_manifest.json")
    f, quality = frame_for(rows, "H1", STEP)
    del rows
    states = dc_states(f.bc.to_numpy(), DC_THRESHOLD)

    cohorts = {}
    all_anchors = []
    for label, start, end in QUARTERS:
        anchors = eligible_quarter(f, start, end)
        for a, b in zip(anchors, anchors[1:]):
            if b <= a + H:
                raise AssertionError(f"{label}: overlapping targets")
        for q in anchors:
            if int(f.t.iloc[q + H]) >= ms(end):
                raise AssertionError(f"{label}: target crosses cohort end")
        cohorts[label] = [int(f.t.iloc[q]) for q in anchors]
        all_anchors.extend((label, q) for q in anchors)

    if len(all_anchors) != 600:
        raise AssertionError(f"expected 600 anchors, got {len(all_anchors)}")
    (out / "cohorts.json").write_text(
        json.dumps({
            "quality": quality,
            "quarters": cohorts,
            "total": len(all_anchors),
        }, indent=2),
        encoding="utf-8",
    )

    predictor = load_pinned(vendor, out)
    checks = {
        "raw_date_gate": "PASS",
        "exactly_60_per_quarter": "PASS",
        "exactly_600_total": "PASS",
        "target_matures_inside_cohort": "PASS",
        "nonoverlapping_targets": "PASS",
        "pinned_revisions": "PASS",
        "validation_read": False,
        "holdout_read": False,
    }

    records = []
    pred_path = out / "predictions.jsonl"

    for qi, (label, q) in enumerate(all_anchors):
        quarter_pos = qi % 60
        if quarter_pos == 0:
            prefix = f.iloc[:q + 1].copy()
            p_states = dc_states(prefix.bc.to_numpy(), DC_THRESHOLD)
            if p_states != states[:q + 1]:
                raise AssertionError(f"{label}: DC prefix causality failed")
            checks[f"{label}_dc_prefix"] = "PASS"

        dp = drift_pred(f, q)
        dc = float(states[q]["direction"] * H / 12)
        actual = float((f.bc.iloc[q + H] - f.bc.iloc[q]) / f.atr.iloc[q])
        drift_dir = int(np.sign(dp))
        dc_dir = int(np.sign(dc))

        tic = time.perf_counter()
        kp = kronos_predict(
            predictor, f.iloc[:q + 1], H, STEP, SEED + q
        )
        elapsed = time.perf_counter() - tic

        if quarter_pos == 0:
            kp2 = kronos_predict(
                predictor, f.iloc[:q + 1].copy(), H, STEP, SEED + q
            )
            if kp != kp2:
                raise AssertionError(f"{label}: same-seed repeat failed")
            checks[f"{label}_same_seed_repeat"] = "PASS"

        kdir = int(np.sign(kp))
        atr = float(f.atr.iloc[q])
        spread_atr = float((f.ac.iloc[q] - f.bc.iloc[q]) / atr)
        cost_proxy = 2.0 * spread_atr
        strength = float(abs(kp) / cost_proxy) if cost_proxy > 0 else float("inf")
        vp = vol_percentile_60d(f, q)
        agree = int(kdir == drift_dir) + int(kdir == dc_dir)

        common = {
            "quarter": label,
            "time": int(f.t.iloc[q]),
            "actual": actual,
            "spread_atr": spread_atr,
            "cost_proxy": cost_proxy,
            "vol_percentile_60d": vp,
            "volatility_regime": volatility_bin(vp),
            "spread_regime": spread_bin(spread_atr),
            "session_utc": session_bin(int(f.t.iloc[q])),
        }

        preds = {
            "flat": (0.0, 0, 0.0),
            "drift": (dp, drift_dir, 0.0),
            "dc_direction": (dc, dc_dir, 0.0),
            "kronos_mini": (float(kp), kdir, elapsed),
        }
        for model, (pred, direction, seconds) in preds.items():
            rec = {
                **common,
                "model": model,
                "pred": float(pred),
                "direction": int(direction),
                "seconds": float(seconds),
                "strength_ratio": strength if model == "kronos_mini" else None,
                "strength_bin": strength_bin(strength) if model == "kronos_mini" else None,
                "magnitude_bin": magnitude_bin(kp) if model == "kronos_mini" else None,
                "agreement_count": agree if model == "kronos_mini" else None,
                **costs(
                    int(direction),
                    float(f.bo.iloc[q + 1]),
                    float(f.ao.iloc[q + 1]),
                    float(f.bc.iloc[q + H]),
                    float(f.ac.iloc[q + H]),
                    atr,
                ),
            }
            records.append(rec)
            with pred_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec) + "\n")

        if quarter_pos == 59:
            print(f"DONE {label} 60/60", flush=True)

    df = pd.DataFrame(records)
    results = []
    for model, g in df.groupby("model"):
        results.append({"model": model, **metrics(g)})

    quarter_rows = []
    for (quarter, model), g in df.groupby(["quarter", "model"]):
        quarter_rows.append({"quarter": quarter, "model": model, **metrics(g)})

    kronos = df[df.model == "kronos_mini"].copy()
    halfyear = []
    kronos["halfyear"] = pd.to_datetime(
        kronos.time, unit="ms", utc=True
    ).map(lambda x: f"{x.year}H{1 if x.month <= 6 else 2}")
    for hlabel, g in kronos.groupby("halfyear"):
        halfyear.append({"halfyear": hlabel, **metrics(g)})

    diagnostics = []
    for col in (
        "strength_bin",
        "magnitude_bin",
        "agreement_count",
        "volatility_regime",
        "spread_regime",
        "session_utc",
    ):
        diagnostics.extend(summarize_bins(df, col))

    kquarter = [
        x for x in quarter_rows if x["model"] == "kronos_mini"
    ]
    positive_q = sum(1 for x in kquarter if x["c1_mean_per_trade"] > 0)
    kr = next(x for x in results if x["model"] == "kronos_mini")
    dr = next(x for x in results if x["model"] == "drift")
    correct = int(round(kr["direction_accuracy"] * kr["active"]))
    ci = wilson(correct, kr["active"])

    primary = {
        "exactly_600": kr["n"] == 600,
        "c0_positive": kr["c0_mean_per_trade"] > 0,
        "c1_positive": kr["c1_mean_per_trade"] > 0,
        "positive_c1_quarters": positive_q,
        "positive_c1_quarters_ge_6": positive_q >= 6,
        "direction_accuracy_gt_0_52": kr["direction_accuracy"] > 0.52,
        "c1_better_than_drift": kr["c1_mean_per_trade"] > dr["c1_mean_per_trade"],
    }
    primary["pass"] = all(
        primary[k] for k in (
            "exactly_600", "c0_positive", "c1_positive",
            "positive_c1_quarters_ge_6",
            "direction_accuracy_gt_0_52", "c1_better_than_drift",
        )
    )
    primary["cost_robust_c2"] = kr["c2_mean_per_trade"] >= 0

    positive_contrib = [
        (x["quarter"], x["c1_mean_per_trade"] * x["active"])
        for x in kquarter if x["c1_mean_per_trade"] > 0
    ]
    total_pos = sum(v for _, v in positive_contrib)
    best_share = (
        max(v for _, v in positive_contrib) / total_pos
        if total_pos > 0 else None
    )

    stability = {
        "direction_accuracy_wilson95": ci,
        "best_quarter": max(kquarter, key=lambda x: x["c1_mean_per_trade"]),
        "worst_quarter": min(kquarter, key=lambda x: x["c1_mean_per_trade"]),
        "single_best_quarter_share_of_positive_c1": best_share,
        "halfyear": halfyear,
    }

    report = {
        "scope": "Kronos Swing Stress v0.1 Train-only",
        "validation_read": False,
        "holdout_read": False,
        "checks": checks,
        "primary_screen": primary,
        "results": results,
        "quarterly": quarter_rows,
        "diagnostic_regimes": diagnostics,
        "stability": stability,
        "limitations": [
            "Kronos pretraining overlap remains unknown",
            "Diagnostic regimes are descriptive only",
            "Passing Train screen is not live-profitability proof",
        ],
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    print(json.dumps({
        "primary_screen": primary,
        "kronos": kr,
        "drift": dr,
        "positive_quarters": positive_q,
        "wilson95": ci,
        "best_quarter": stability["best_quarter"]["quarter"],
        "worst_quarter": stability["worst_quarter"]["quarter"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
