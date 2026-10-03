"""Regime-conditioned model audit v0.1.

Preregistered in PROTOCOL_REGIME_MODEL_AUDIT_V0_1.md.
No model fitting or inference occurs here. Existing predictions are joined to the
frozen causal Regime Atlas state at the exact anchor timestamp.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as md
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from regime_atlas_v01 import (
    load_h1, regime_features, transform_with_atlas, EVAL_END, FIT_END, sha, ms
)

HERE = Path(__file__).resolve().parent
PROTOCOL = HERE / "PROTOCOL_REGIME_MODEL_AUDIT_V0_1.md"
EXPECTED_ATLAS_SHA = "77907757195387913a993d5e13dff957cd9884a7ef942a93c78de68b2a9e6e7b"
A_START = "2021-01-01"
A_END = "2021-07-31"
B_START = "2021-09-29"
B_END = "2024-03-20"
MODELS = ("kronos_mini", "drift", "dc_direction")


def read_jsonl(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def metric_block(g: pd.DataFrame):
    active = g[g.direction != 0]
    sign_rows = active[active.actual != 0]
    return {
        "n": int(len(g)),
        "active": int(len(active)),
        "direction_accuracy": (
            float(np.mean(sign_rows.direction == np.sign(sign_rows.actual)))
            if len(sign_rows) else None
        ),
        "c0_mean_per_trade": float(active.c0.mean()) if len(active) else None,
        "c1_mean_per_trade": float(active.c1.mean()) if len(active) else None,
        "c2_mean_per_trade": float(active.c2.mean()) if len(active) else None,
        "c1_win_rate": float(np.mean(active.c1 > 0)) if len(active) else None,
    }


def common_model_rows(rows, start, end, window):
    df = pd.DataFrame(rows)
    if df.empty:
        raise ValueError(f"{window}: no prediction rows")
    df = df[
        (df.track == "swing")
        & (df.model.isin(MODELS))
        & (df.time >= ms(start))
        & (df.time < ms(end))
    ].copy()
    if df.empty:
        raise ValueError(f"{window}: no rows after filters")

    sets = {
        model: set(df.loc[df.model == model, "time"].astype(np.int64))
        for model in MODELS
    }
    common = set.intersection(*sets.values())
    if not common:
        raise ValueError(f"{window}: no common model timestamps")
    common = sorted(common)
    out = df[df.time.isin(common)].copy()

    for model in MODELS:
        m = out[out.model == model].sort_values("time")
        if len(m) != len(common):
            raise AssertionError(f"{window}: duplicate/missing rows for {model}")
        if list(m.time.astype(np.int64)) != common:
            raise AssertionError(f"{window}: timestamp order mismatch {model}")
    return out, common


def candidate_screen(joined: pd.DataFrame, state: int):
    ka = joined[
        (joined.window == "A")
        & (joined.model == "kronos_mini")
        & (joined.state == state)
    ].copy()
    kb = joined[
        (joined.window == "B")
        & (joined.model == "kronos_mini")
        & (joined.state == state)
    ].copy()

    ma = metric_block(ka)
    mb = metric_block(kb)
    pooled = pd.concat([ka, kb], ignore_index=True)
    mp = metric_block(pooled)

    q = kb.copy()
    if len(q):
        q["quarter"] = (
            pd.to_datetime(q.time, unit="ms", utc=True)
            .dt.tz_localize(None)
            .dt.to_period("Q")
            .astype(str)
        )
    eligible = []
    quarter_rows = []
    if len(q):
        for quarter, part in q.groupby("quarter"):
            m = metric_block(part)
            quarter_rows.append({"quarter": quarter, **m})
            if m["n"] >= 5:
                eligible.append(m["c1_mean_per_trade"] > 0)

    positive_quarters = int(sum(eligible))
    eligible_count = len(eligible)
    positive_fraction = (
        float(positive_quarters / eligible_count) if eligible_count else None
    )

    checks = {
        "n_A_ge_30": ma["n"] >= 30,
        "n_B_ge_30": mb["n"] >= 30,
        "c1_A_positive": bool(ma["c1_mean_per_trade"] is not None and ma["c1_mean_per_trade"] > 0),
        "c1_B_positive": bool(mb["c1_mean_per_trade"] is not None and mb["c1_mean_per_trade"] > 0),
        "direction_A_ge_052": bool(ma["direction_accuracy"] is not None and ma["direction_accuracy"] >= 0.52),
        "direction_B_ge_052": bool(mb["direction_accuracy"] is not None and mb["direction_accuracy"] >= 0.52),
        "pooled_c2_nonnegative": bool(mp["c2_mean_per_trade"] is not None and mp["c2_mean_per_trade"] >= 0),
        "late_positive_quarters_ge_2": positive_quarters >= 2,
        "late_positive_quarter_fraction_ge_050": bool(
            positive_fraction is not None and positive_fraction >= 0.50
        ),
    }
    return {
        "state": int(state),
        "window_A": ma,
        "window_B": mb,
        "pooled": mp,
        "late_quarters": quarter_rows,
        "eligible_late_quarters": eligible_count,
        "positive_late_quarters": positive_quarters,
        "positive_late_quarter_fraction": positive_fraction,
        "checks": checks,
        "pass": all(checks.values()),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--atlas-run", required=True)
    ap.add_argument("--early-run", required=True)
    ap.add_argument("--late-run", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    root = Path(args.root)
    atlas_run = Path(args.atlas_run)
    early_run = Path(args.early_run)
    late_run = Path(args.late_run)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=False)

    atlas_path = atlas_run / "ATLAS_FROZEN.json"
    if sha(atlas_path) != EXPECTED_ATLAS_SHA:
        raise ValueError("frozen atlas SHA mismatch")
    atlas = json.loads(atlas_path.read_text(encoding="utf-8"))
    if int(atlas["selected_k"]) != 4:
        raise ValueError("unexpected atlas k")

    versions = {}
    for name in ("numpy", "pandas", "scikit-learn"):
        try:
            versions[name] = md.version(name)
        except Exception:
            pass
    (out / "environment.json").write_text(json.dumps({
        "python": sys.version,
        "packages": versions,
        "protocol_sha256": sha(PROTOCOL),
        "atlas_sha256": sha(atlas_path),
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }, indent=2), encoding="utf-8")

    # Compute only the frozen causal state representation; no model outcome is used.
    f, quality = load_h1(root, EVAL_END, out / "input_manifest.json")
    X, names, _ = regime_features(f)
    if names != atlas["feature_names"]:
        raise ValueError("atlas feature contract mismatch")
    valid = np.all(np.isfinite(X), axis=1)
    _, labels = transform_with_atlas(X[valid], atlas)
    valid_idx = np.flatnonzero(valid)
    state_by_time = {
        int(f.t.iloc[i]): int(s)
        for i, s in zip(valid_idx, labels)
        if ms(A_START) <= int(f.t.iloc[i]) < ms(B_END)
    }

    # Window A: Kronos file + symbolic file references.
    early_k = read_jsonl(early_run / "replication_predictions_kronos.jsonl")
    early_s = read_jsonl(early_run / "replication_predictions_symbolic.jsonl")
    early_rows = [
        r for r in early_k if r.get("model") == "kronos_mini"
    ] + [
        r for r in early_s if r.get("model") in ("drift", "dc_direction")
    ]
    A, times_a = common_model_rows(early_rows, A_START, A_END, "A")

    # Window B: existing Stability v0.2 predictions.
    late_rows = read_jsonl(late_run / "predictions.jsonl")
    B, times_b = common_model_rows(late_rows, B_START, B_END, "B")

    if max(times_a) >= min(times_b):
        raise AssertionError("windows are not disjoint")

    joined_parts = []
    for window, df in (("A", A), ("B", B)):
        missing = sorted(set(df.time.astype(np.int64)) - set(state_by_time))
        if missing:
            raise ValueError(f"{window}: {len(missing)} anchors missing frozen state")
        x = df.copy()
        x["window"] = window
        x["state"] = x.time.map(state_by_time).astype(int)
        joined_parts.append(x)

    joined = pd.concat(joined_parts, ignore_index=True)

    # Exact timestamp equality after state join for each model.
    checks = {
        "atlas_sha": "PASS",
        "feature_contract": "PASS",
        "windows_disjoint": "PASS",
        "all_anchors_have_state": "PASS",
    }
    for window in ("A", "B"):
        w = joined[joined.window == window]
        ref = sorted(w[w.model == MODELS[0]].time.astype(np.int64))
        for model in MODELS[1:]:
            if sorted(w[w.model == model].time.astype(np.int64)) != ref:
                raise AssertionError(f"{window}: model timestamp mismatch after join")
        checks[f"{window}_same_model_anchors"] = "PASS"

    unconditional = []
    by_state = []
    for (window, model), g in joined.groupby(["window", "model"]):
        unconditional.append({
            "window": window,
            "model": model,
            **metric_block(g),
        })
    for (window, model, state), g in joined.groupby(["window", "model", "state"]):
        by_state.append({
            "window": window,
            "model": model,
            "state": int(state),
            **metric_block(g),
        })

    screens = [candidate_screen(joined, s) for s in range(4)]
    passing = [s["state"] for s in screens if s["pass"]]

    with (out / "joined_rows.jsonl").open("w", encoding="utf-8") as fh:
        for r in joined.to_dict(orient="records"):
            # normalize numpy scalars
            clean = {}
            for k, v in r.items():
                if isinstance(v, (np.integer,)):
                    v = int(v)
                elif isinstance(v, (np.floating,)):
                    v = float(v)
                clean[k] = v
            fh.write(json.dumps(clean, allow_nan=False) + "\n")

    report = {
        "scope": "Regime-conditioned Swing model audit v0.1 — Train only",
        "validation_read": False,
        "holdout_read": False,
        "atlas_sha256": EXPECTED_ATLAS_SHA,
        "quality": quality,
        "window_A_common_anchors": len(times_a),
        "window_B_common_anchors": len(times_b),
        "checks": checks,
        "unconditional": unconditional,
        "by_state": by_state,
        "kronos_candidate_screens": screens,
        "passing_kronos_states": passing,
        "result": (
            "PASS_CANDIDATE_EXISTS" if passing
            else "FAIL_NO_PERSISTENT_KRONOS_REGIME"
        ),
        "limitations": [
            "Train research only",
            "Kronos PRETRAINED_CONTAMINATION_UNKNOWN",
            "No new inference or model fitting",
            "Reference model state metrics are descriptive only",
        ],
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "A_anchors": len(times_a),
        "B_anchors": len(times_b),
        "passing_kronos_states": passing,
        "screens": screens,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
