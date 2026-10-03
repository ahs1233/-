"""Causal Regime Atlas v0.1 for XAUUSD H1.

Preregistered in PROTOCOL_REGIME_ATLAS_V0_1.md.
Two-stage execution:
  fit      -> reads raw dates strictly before 2021-01-01 and freezes atlas
  evaluate -> requires frozen atlas, then reads through 2024-03-20 exclusive
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as md
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import RobustScaler

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "data"))
from store import read_day
from bars import aggregate, bucket
from multiscale_symbolic_v01 import multiscale_matrix, ms

PROTOCOL = HERE / "PROTOCOL_REGIME_ATLAS_V0_1.md"
SOURCE_START = "2018-03-01"
FIT_END = "2021-01-01"
EVAL_END = "2024-03-20"
STEP = 3_600_000
BASE = 0.005
SEED = 20261003
K_CANDIDATES = (4, 5, 6, 7, 8)
BOOT_N = 500
HORIZONS = (1, 4, 12)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_rows(rows, day: str):
    if not rows:
        return
    t = np.asarray([b["t"] for b in rows], dtype=np.int64)
    d0 = ms(day)
    d1 = ms((datetime.fromisoformat(day) + timedelta(days=1)).strftime("%Y-%m-%d"))
    if np.any(np.diff(t) <= 0) or t.min() < d0 or t.max() >= d1:
        raise ValueError(f"timestamp integrity failed for {day}")
    for b in rows:
        for side in ("b", "a"):
            o, h, l, c = (b[side + x] for x in ("o", "h", "l", "c"))
            if any(v is None or not np.isfinite(v) or v <= 0 for v in (o, h, l, c)):
                raise ValueError(f"invalid quote on {day}")
            if not l <= min(o, c) <= max(o, c) <= h:
                raise ValueError(f"invalid OHLC on {day}")
        if b["ao"] < b["bo"] or b["ac"] < b["bc"]:
            raise ValueError(f"crossed quote on {day}")


def complete_h1(day_rows):
    groups = {}
    for b in day_rows:
        k = bucket(b["t"], "H1")
        groups.setdefault(k, []).append(b["t"])
    bars = aggregate(day_rows, "H1")
    kept = [
        b for b in bars
        if groups.get(b["t"]) == list(range(b["t"], b["t"] + STEP, 60_000))
    ]
    return kept, len(bars) - len(kept)


def load_h1(root: Path, end_exclusive: str, manifest_path: Path):
    if not (SOURCE_START < end_exclusive <= EVAL_END):
        raise ValueError("Regime Atlas raw date gate")
    day = datetime.fromisoformat(SOURCE_START)
    stop = datetime.fromisoformat(end_exclusive)
    manifest = []
    h1 = []
    dropped = 0
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
            rows = read_day(p)
            validate_rows(rows, ds)
            kept, n_drop = complete_h1(rows)
            h1.extend(kept)
            dropped += n_drop
        day += timedelta(days=1)

    if not h1:
        raise ValueError("no H1 data")
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    f = pd.DataFrame(h1).sort_values("t").reset_index(drop=True)
    t = f.t.to_numpy(dtype=np.int64)
    if np.any(np.diff(t) <= 0):
        raise ValueError("H1 timestamps not strictly increasing")
    if t.min() < ms(SOURCE_START) or t.max() >= ms(end_exclusive):
        raise ValueError("H1 data crossed date gate")

    c = f.bc.to_numpy(dtype=float)
    prev = np.r_[c[0], c[:-1]]
    tr = np.maximum(
        f.bh.to_numpy() - f.bl.to_numpy(),
        np.maximum(
            np.abs(f.bh.to_numpy() - prev),
            np.abs(f.bl.to_numpy() - prev),
        ),
    )
    f["atr"] = pd.Series(tr).rolling(14).mean()
    return f, {"complete_h1": int(len(f)), "incomplete_dropped": int(dropped)}


def efficiency(close: np.ndarray, n: int):
    out = np.full(len(close), np.nan, dtype=float)
    absdiff = np.abs(np.diff(close))
    for i in range(n, len(close)):
        path = float(absdiff[i-n:i].sum())
        out[i] = abs(close[i] - close[i-n]) / path if path > 0 else 0.0
    return out


def regime_features(f: pd.DataFrame):
    base, names, states = multiscale_matrix(f, BASE)
    c = f.bc.to_numpy(dtype=float)
    atr = f.atr.to_numpy(dtype=float)

    drift48 = np.full(len(f), np.nan, dtype=float)
    drift48[48:] = (c[48:] - c[:-48]) / atr[48:]

    atr_s = pd.Series(atr)
    med24 = atr_s.rolling(24, min_periods=24).median().to_numpy()
    med168 = atr_s.rolling(168, min_periods=168).median().to_numpy()
    atr_week_ratio = atr / med168
    atr_day_week_ratio = med24 / med168

    eff12 = efficiency(c, 12)
    eff48 = efficiency(c, 48)

    extra = np.column_stack([
        drift48,
        atr_week_ratio,
        atr_day_week_ratio,
        eff12,
        eff48,
    ])
    extra_names = [
        "drift48",
        "atr_week_ratio",
        "atr_day_week_ratio",
        "efficiency12",
        "efficiency48",
    ]
    X = np.column_stack([base, extra])
    return X, names + extra_names, states


def valid_rows(f: pd.DataFrame, X: np.ndarray, start: str, end: str):
    t = f.t.to_numpy(dtype=np.int64)
    mask = (
        (t >= ms(start))
        & (t < ms(end))
        & np.all(np.isfinite(X), axis=1)
    )
    return np.flatnonzero(mask)


def atlas_environment(stage):
    versions = {}
    for name in ("numpy", "pandas", "scikit-learn"):
        try:
            versions[name] = md.version(name)
        except Exception:
            pass
    return {
        "stage": stage,
        "python": sys.version,
        "packages": versions,
        "protocol_sha256": sha(PROTOCOL),
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }


def fit_atlas(root: Path, out: Path):
    out.mkdir(parents=True, exist_ok=False)
    (out / "environment_fit.json").write_text(
        json.dumps(atlas_environment("fit"), indent=2), encoding="utf-8"
    )
    f, quality = load_h1(root, FIT_END, out / "input_manifest_fit.json")
    X, names, states = regime_features(f)

    # Prefix-causality check on every feature column at a deterministic cut.
    cut = min(len(f) - 1, max(500, len(f) // 2))
    Xp, pnames, _ = regime_features(f.iloc[:cut+1].copy())
    if pnames != names:
        raise AssertionError("feature contract changed on prefix")
    np.testing.assert_allclose(
        Xp,
        X[:cut+1],
        rtol=0.0,
        atol=0.0,
        equal_nan=True,
    )

    fit_idx = valid_rows(f, X, SOURCE_START, FIT_END)
    if len(fit_idx) < 5000:
        raise ValueError("insufficient fit rows")
    Xfit_raw = X[fit_idx]

    scaler = RobustScaler()
    Xfit = scaler.fit_transform(Xfit_raw)
    if not np.all(np.isfinite(Xfit)):
        raise ValueError("scaled fit matrix nonfinite")

    rng = np.random.default_rng(SEED)
    sample_n = min(5000, len(Xfit))
    sample_idx = np.sort(rng.choice(len(Xfit), size=sample_n, replace=False))

    models = {}
    scores = {}
    for k in K_CANDIDATES:
        model = KMeans(
            n_clusters=k,
            random_state=SEED,
            n_init=20,
            max_iter=500,
        )
        labels = model.fit_predict(Xfit)
        score = float(silhouette_score(Xfit[sample_idx], labels[sample_idx]))
        models[k] = model
        scores[k] = score
        print(f"K {k} silhouette {score:.6f}", flush=True)

    selected_k = sorted(K_CANDIDATES, key=lambda k: (-scores[k], k))[0]
    model = models[selected_k]

    atlas = {
        "selected_k": int(selected_k),
        "silhouette_scores": {str(k): scores[k] for k in K_CANDIDATES},
        "feature_names": names,
        "scaler_center": scaler.center_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "centers_scaled": model.cluster_centers_.tolist(),
        "fit_rows": int(len(fit_idx)),
        "silhouette_sample_rows": int(sample_n),
        "silhouette_sample_indices_sha256": hashlib.sha256(
            np.asarray(sample_idx, dtype=np.int64).tobytes()
        ).hexdigest(),
        "fit_start": SOURCE_START,
        "fit_end_exclusive": FIT_END,
        "quality": quality,
        "selection_rule": "max silhouette; tie lower k; no outcome/PnL input",
    }
    atlas_path = out / "ATLAS_FROZEN.json"
    atlas_path.write_text(json.dumps(atlas, indent=2), encoding="utf-8")
    (out / "freeze.json").write_text(json.dumps({
        "atlas_file": atlas_path.name,
        "atlas_sha256": sha(atlas_path),
        "frozen_utc": datetime.now(timezone.utc).isoformat(),
        "evaluation_opened": False,
    }, indent=2), encoding="utf-8")

    print(json.dumps({
        "selected_k": selected_k,
        "scores": scores,
        "fit_rows": len(fit_idx),
        "atlas_sha256": sha(atlas_path),
    }, indent=2), flush=True)


def transform_with_atlas(X, atlas):
    center = np.asarray(atlas["scaler_center"], dtype=float)
    scale = np.asarray(atlas["scaler_scale"], dtype=float)
    centers = np.asarray(atlas["centers_scaled"], dtype=float)
    Z = (X - center) / scale
    d2 = ((Z[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    labels = np.argmin(d2, axis=1)
    return Z, labels


def nonoverlap_anchors(f, X, start, end):
    t = f.t.to_numpy(dtype=np.int64)
    good = np.all(np.isfinite(X), axis=1)
    out = []
    i = 0
    while i < len(f) - max(HORIZONS):
        if t[i] < ms(start) or t[i] >= ms(end) or not good[i]:
            i += 1
            continue
        h = max(HORIZONS)
        if t[i+h] >= ms(end):
            i += 1
            continue
        if not np.all(np.diff(t[i:i+h+1]) == STEP):
            i += 1
            continue
        out.append(i)
        i += h + 1
    if not out:
        raise ValueError("no evaluation anchors")
    return out


def state_runs(times, labels):
    runs = {}
    if not len(labels):
        return runs
    current = int(labels[0])
    length = 1
    for i in range(1, len(labels)):
        contiguous = int(times[i] - times[i-1]) == STEP
        same = int(labels[i]) == current
        if contiguous and same:
            length += 1
        else:
            runs.setdefault(str(current), []).append(length)
            current = int(labels[i])
            length = 1
    runs.setdefault(str(current), []).append(length)
    return runs


def transition_matrix(times, labels, k):
    counts = np.zeros((k, k), dtype=int)
    for i in range(len(labels)-1):
        if int(times[i+1] - times[i]) != STEP:
            continue
        counts[int(labels[i]), int(labels[i+1])] += 1
    probs = np.zeros_like(counts, dtype=float)
    for i in range(k):
        s = counts[i].sum()
        if s:
            probs[i] = counts[i] / s
    return counts, probs


def descriptive_table(df):
    rows = []
    for (state, h), g in df.groupby(["state", "horizon"]):
        overall = df[df.horizon == h].target.mean()
        a = g.target.to_numpy(dtype=float)
        rows.append({
            "state": int(state),
            "horizon": int(h),
            "n": int(len(g)),
            "mean": float(np.mean(a)),
            "median": float(np.median(a)),
            "std": float(np.std(a, ddof=1)) if len(a) > 1 else 0.0,
            "positive_fraction": float(np.mean(a > 0)),
            "p10": float(np.quantile(a, 0.10)),
            "p25": float(np.quantile(a, 0.25)),
            "p75": float(np.quantile(a, 0.75)),
            "p90": float(np.quantile(a, 0.90)),
            "mean_lift": float(np.mean(a) - overall),
        })
    return rows


def bootstrap_lift(df, k):
    rng = np.random.default_rng(SEED)
    weeks = np.asarray(sorted(df.week.unique()))
    by_week = {w: df[df.week == w] for w in weeks}
    buckets = {(s, h): [] for s in range(k) for h in HORIZONS}

    for _ in range(BOOT_N):
        sampled = rng.choice(weeks, size=len(weeks), replace=True)
        parts = [by_week[w] for w in sampled]
        boot = pd.concat(parts, ignore_index=True)
        for h in HORIZONS:
            bh = boot[boot.horizon == h]
            overall = float(bh.target.mean())
            for s in range(k):
                g = bh[bh.state == s]
                if len(g) < 20:
                    continue
                buckets[(s, h)].append(float(g.target.mean() - overall))

    out = {}
    for (s, h), vals in buckets.items():
        arr = np.asarray(vals, dtype=float)
        if len(arr):
            lo, hi = np.quantile(arr, [0.025, 0.975])
            out[f"R{s}_H{h}"] = {
                "valid_replicates": int(len(arr)),
                "ci95_low": float(lo),
                "ci95_high": float(hi),
            }
        else:
            out[f"R{s}_H{h}"] = {
                "valid_replicates": 0,
                "ci95_low": None,
                "ci95_high": None,
            }
    return out


def evaluate_atlas(root: Path, out: Path):
    atlas_path = out / "ATLAS_FROZEN.json"
    freeze_path = out / "freeze.json"
    if not atlas_path.exists() or not freeze_path.exists():
        raise FileNotFoundError("frozen atlas required")

    freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
    if freeze["atlas_sha256"] != sha(atlas_path):
        raise ValueError("atlas changed after freeze")
    if freeze.get("evaluation_opened"):
        raise ValueError("evaluation already opened")

    freeze["evaluation_opened"] = True
    freeze["evaluation_opened_utc"] = datetime.now(timezone.utc).isoformat()
    freeze_path.write_text(json.dumps(freeze, indent=2), encoding="utf-8")

    (out / "environment_evaluate.json").write_text(
        json.dumps(atlas_environment("evaluate"), indent=2), encoding="utf-8"
    )

    f, quality = load_h1(root, EVAL_END, out / "input_manifest_evaluate.json")
    X, names, states = regime_features(f)
    atlas = json.loads(atlas_path.read_text(encoding="utf-8"))
    if names != atlas["feature_names"]:
        raise ValueError("feature contract differs from frozen atlas")

    eval_idx = valid_rows(f, X, FIT_END, EVAL_END)
    Zeval, eval_labels = transform_with_atlas(X[eval_idx], atlas)
    if not np.all(np.isfinite(Zeval)):
        raise ValueError("nonfinite evaluation matrix")

    times = f.t.to_numpy(dtype=np.int64)[eval_idx]
    k = int(atlas["selected_k"])
    counts, probs = transition_matrix(times, eval_labels, k)
    runs = state_runs(times, eval_labels)

    profiles = {}
    for s in range(k):
        m = eval_labels == s
        profiles[f"R{s}"] = {
            "n_bars": int(m.sum()),
            "occupancy": float(m.mean()),
            "median_raw_features": {
                name: float(v)
                for name, v in zip(names, np.median(X[eval_idx][m], axis=0))
            } if m.any() else {},
            "stay_probability": float(probs[s, s]) if counts[s].sum() else None,
            "run_length": {
                "n_runs": len(runs.get(str(s), [])),
                "median": float(np.median(runs.get(str(s), [0]))),
                "p90": float(np.quantile(runs.get(str(s), [0]), 0.90)),
                "max": int(max(runs.get(str(s), [0]))),
            },
        }

    anchors = nonoverlap_anchors(f, X, FIT_END, EVAL_END)
    _, anchor_labels = transform_with_atlas(X[anchors], atlas)
    records = []
    for q, state in zip(anchors, anchor_labels):
        atr = float(f.atr.iloc[q])
        ts = pd.Timestamp(int(f.t.iloc[q]), unit="ms", tz="UTC")
        iso = ts.isocalendar()
        week = f"{int(iso.year)}-W{int(iso.week):02d}"
        for h in HORIZONS:
            target = float((f.bc.iloc[q+h] - f.bc.iloc[q]) / atr)
            records.append({
                "time": int(f.t.iloc[q]),
                "state": int(state),
                "horizon": int(h),
                "target": target,
                "week": week,
            })

    df = pd.DataFrame(records)
    desc = descriptive_table(df)
    boot = bootstrap_lift(df, k)

    interesting = []
    for row in desc:
        ci = boot[f"R{row['state']}_H{row['horizon']}"]
        excludes_zero = (
            ci["ci95_low"] is not None
            and (ci["ci95_low"] > 0 or ci["ci95_high"] < 0)
        )
        flag = (
            row["n"] >= 100
            and abs(row["mean_lift"]) >= 0.10
            and excludes_zero
        )
        if flag:
            interesting.append({
                "state": row["state"],
                "horizon": row["horizon"],
                "n": row["n"],
                "mean_lift": row["mean_lift"],
                **ci,
            })

    # Safety: every evaluation outcome matures strictly inside gate and anchors do not overlap.
    for a, b in zip(anchors, anchors[1:]):
        if not b > a + max(HORIZONS):
            raise AssertionError("evaluation anchor overlap")
    for q in anchors:
        if f.t.iloc[q + max(HORIZONS)] >= ms(EVAL_END):
            raise AssertionError("outcome crossed evaluation gate")

    report = {
        "scope": "Causal H1 Regime Atlas v0.1 — Train descriptive evaluation",
        "validation_read": False,
        "holdout_read": False,
        "atlas_sha256": sha(atlas_path),
        "selected_k": k,
        "quality": quality,
        "evaluation_bars": int(len(eval_idx)),
        "evaluation_anchors": int(len(anchors)),
        "checks": {
            "frozen_atlas_before_evaluation": "PASS",
            "feature_contract_unchanged": "PASS",
            "target_maturity": "PASS",
            "anchor_12h_nonoverlap": "PASS",
            "validation_holdout_closed": "PASS",
        },
        "state_profiles": profiles,
        "transition_counts": counts.tolist(),
        "transition_probabilities": probs.tolist(),
        "future_distributions": desc,
        "bootstrap_mean_lift": boot,
        "distributionally_interesting": interesting,
        "limitations": [
            "Train descriptive research only",
            "No trading rule or PnL is selected in this phase",
            "Bootstrap intervals are exploratory and not multiple-comparison adjusted",
        ],
    }
    (out / "evaluation_records.jsonl").write_text(
        "".join(json.dumps(r) + "\n" for r in records),
        encoding="utf-8",
    )
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "selected_k": k,
        "evaluation_bars": len(eval_idx),
        "anchors": len(anchors),
        "interesting": interesting,
    }, indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["fit", "evaluate"])
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    root = Path(args.root)
    out = Path(args.out)
    if args.stage == "fit":
        fit_atlas(root, out)
    else:
        evaluate_atlas(root, out)


if __name__ == "__main__":
    main()
