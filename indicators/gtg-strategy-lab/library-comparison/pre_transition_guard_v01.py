"""GTG Pre-Transition Guard v0.1.

Fit on pre-2021 structural Range signals, freeze, then evaluate on 2021-2024.
Predicts whether RANGE will hand off before frozen-midpoint mean reversion.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.preprocessing import RobustScaler

HERE = Path(__file__).resolve().parent
from multiscale_symbolic_v01 import ms
from regime_atlas_v01 import load_h1
from range_scalper_v01 import (
    EXPECTED_MANIFEST,
    EXPECTED_STATE_CONTENT,
    EXPECTED_STATE_FILE,
    execute_trade,
    gap_ok,
    metrics as range_metrics,
    signal_at,
)

PROTOCOL = HERE / "PROTOCOL_PRE_TRANSITION_GUARD_V0_1.md"
SPLIT = "2021-01-01"
SPLIT_MS = ms(SPLIT)
RAW_END = "2024-03-20"
THRESHOLD = 0.50
EXPECTED_NO_GUARD_SUMMARY = "63e972c35a7d7a98e7ba4f0c1750d9f5bb439a93257f39c6b3409c42a8e6f8f5"
SESSIONS = ("Asia", "London", "NewYork", "Late")

NUMERIC_NAMES = (
    "candidate_direction",
    "edge_depth",
    "channel_width_atr",
    "midpoint_distance_atr",
    "rejection_body_atr",
    "aligned_drift12",
    "aligned_drift24",
    "aligned_drift48",
    "efficiency24",
    "efficiency48",
    "aligned_dc0p5",
    "aligned_dc1p0",
    "aligned_dc2p0",
    "aligned_dc4p0",
    "aligned_dc_count",
    "opposing_dc_count",
    "spread_atr",
    "atr_week_ratio",
    "log_range_age",
)
FEATURE_NAMES = NUMERIC_NAMES + tuple("session_" + s for s in SESSIONS)

STATE_COLUMNS = (
    "t", "state", "prior24_upper", "prior24_lower", "position24", "atr",
    "dc0p5_dir", "dc1p0_dir", "dc2p0_dir", "dc4p0_dir",
    "dc_up_count", "dc_down_count",
    "drift12", "drift24", "drift48",
    "efficiency24", "efficiency48", "spread_atr", "atr_week_ratio",
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def state_content_hash(s: pd.Series) -> str:
    vals = ["" if pd.isna(x) else str(x) for x in s]
    return hashlib.sha256(("\n".join(vals)).encode()).hexdigest()


def session_name(t_ms: int) -> str:
    h = pd.to_datetime(int(t_ms), unit="ms", utc=True).hour
    if h <= 6:
        return "Asia"
    if h <= 12:
        return "London"
    if h <= 20:
        return "NewYork"
    return "Late"


def row_dict_from_csv(row: dict) -> dict:
    out = {}
    for k in STATE_COLUMNS:
        if k == "state":
            out[k] = str(row[k])
        elif k == "t":
            out[k] = int(float(row[k]))
        else:
            raw = row[k]
            out[k] = float(raw) if raw not in (None, "") else float("nan")
    return out


def load_state_prefix(path: Path, end_ms: int) -> pd.DataFrame:
    rows = []
    with gzip.open(path, "rt", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for raw in reader:
            t = int(float(raw["t"]))
            if t >= end_ms:
                break
            rows.append(row_dict_from_csv(raw))
    if not rows:
        raise ValueError("no state prefix rows")
    df = pd.DataFrame(rows)
    if np.any(np.diff(df.t.to_numpy(dtype=np.int64)) <= 0):
        raise ValueError("state prefix not sorted")
    return df


def load_state_full(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = set(STATE_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"state sequence missing columns {sorted(missing)}")
    df = df.loc[:, STATE_COLUMNS].copy()
    for k in STATE_COLUMNS:
        if k not in ("state",):
            df[k] = pd.to_numeric(df[k], errors="raise")
    return df


def state_map(df: pd.DataFrame) -> dict[int, dict]:
    return {
        int(r["t"]): {k: r[k] for k in STATE_COLUMNS if k != "t"}
        for r in df.to_dict(orient="records")
    }


def range_age_map(f: pd.DataFrame, smap: dict[int, dict]) -> dict[int, int]:
    out = {}
    age = 0
    prev_t = None
    prev_was_range = False
    for t in f.t.to_numpy(dtype=np.int64):
        ti = int(t)
        sr = smap.get(ti)
        is_range = sr is not None and str(sr["state"]) == "RANGE"
        continuous = (
            prev_t is not None and gap_ok(prev_t, ti) and prev_was_range and is_range
        )
        if is_range:
            age = age + 1 if continuous else 1
        else:
            age = 0
        out[ti] = age
        prev_t = ti
        prev_was_range = is_range
    return out


def raw_features(
    sig: dict,
    i: int,
    f: pd.DataFrame,
    sr: dict,
    range_age: int,
) -> tuple[np.ndarray, np.ndarray]:
    d = int(sig["direction"])
    atr = float(sig["atr_ref"])
    if d not in (-1, 1) or not np.isfinite(atr) or atr <= 0:
        raise ValueError("bad signal direction/ATR")

    pos = float(sig["position"])
    edge_depth = pos if d == 1 else 1.0 - pos
    close = float(f.bc.iloc[i])
    open_ = float(f.bo.iloc[i])
    aligned_count = float(sr["dc_up_count"] if d == 1 else sr["dc_down_count"])
    opposing_count = float(sr["dc_down_count"] if d == 1 else sr["dc_up_count"])

    numeric = np.asarray([
        float(d),
        edge_depth,
        float(sig["width"]) / atr,
        abs(float(sig["midpoint"]) - close) / atr,
        d * (close - open_) / atr,
        d * float(sr["drift12"]),
        d * float(sr["drift24"]),
        d * float(sr["drift48"]),
        float(sr["efficiency24"]),
        float(sr["efficiency48"]),
        d * float(sr["dc0p5_dir"]),
        d * float(sr["dc1p0_dir"]),
        d * float(sr["dc2p0_dir"]),
        d * float(sr["dc4p0_dir"]),
        aligned_count,
        opposing_count,
        float(sr["spread_atr"]),
        float(sr["atr_week_ratio"]),
        math.log1p(max(0, int(range_age))),
    ], dtype=float)
    if not np.all(np.isfinite(numeric)):
        raise ValueError("nonfinite feature")

    sess = session_name(int(sig["signal_time"]))
    onehot = np.asarray([1.0 if sess == s else 0.0 for s in SESSIONS], dtype=float)
    return numeric, onehot


def structural_label(
    sig: dict,
    f: pd.DataFrame,
    smap: dict[int, dict],
    split_end: int,
) -> dict:
    t = f.t.to_numpy(dtype=np.int64)
    i = int(sig["signal_idx"])
    if i + 1 >= len(f) or int(t[i + 1]) >= split_end:
        return {"mature": False, "reason": "SPLIT_END"}
    if not gap_ok(t[i], t[i + 1]):
        return {"mature": False, "reason": "ENTRY_HARD_GAP"}

    entry = i + 1
    d = int(sig["direction"])
    midpoint = float(sig["midpoint"])
    prev = i
    for k in range(entry, len(f)):
        tk = int(t[k])
        if tk >= split_end:
            return {"mature": False, "reason": "SPLIT_END"}
        if not gap_ok(t[prev], t[k]):
            return {"mature": False, "reason": "HARD_GAP"}
        prev = k
        sr = smap.get(tk)
        if sr is None:
            return {"mature": False, "reason": "MISSING_STATE"}
        close = float(f.bc.iloc[k])
        target = close >= midpoint if d == 1 else close <= midpoint
        state_exit = str(sr["state"]) != "RANGE"
        if target:
            return {
                "mature": True,
                "label": 0,
                "reason": "SAFE_MEAN_REVERSION",
                "resolution_time": tk,
                "bars_to_resolution": int(k - i),
            }
        if state_exit:
            return {
                "mature": True,
                "label": 1,
                "reason": "HANDOFF_BEFORE_TARGET",
                "resolution_time": tk,
                "bars_to_resolution": int(k - i),
            }
    return {"mature": False, "reason": "DATA_END"}


def enumerate_samples(
    f: pd.DataFrame,
    state_df: pd.DataFrame,
    start_ms: int,
    end_ms: int,
) -> tuple[list[dict], dict]:
    smap = state_map(state_df)
    ages = range_age_map(f, smap)
    samples = []
    censor = Counter()
    t = f.t.to_numpy(dtype=np.int64)
    for i in range(len(f)):
        ti = int(t[i])
        if not (start_ms <= ti < end_ms):
            continue
        sr = smap.get(ti)
        if sr is None:
            continue
        sig = signal_at(i, f, sr)
        if sig is None:
            continue
        try:
            numeric, onehot = raw_features(sig, i, f, sr, ages.get(ti, 0))
        except ValueError:
            censor["BAD_FEATURE"] += 1
            continue
        lab = structural_label(sig, f, smap, end_ms)
        if not lab["mature"]:
            censor[lab["reason"]] += 1
            continue
        samples.append({
            "signal_time": ti,
            "direction": int(sig["direction"]),
            "numeric": numeric.tolist(),
            "onehot": onehot.tolist(),
            "label": int(lab["label"]),
            "label_reason": lab["reason"],
            "resolution_time": int(lab["resolution_time"]),
            "bars_to_resolution": int(lab["bars_to_resolution"]),
        })
    return samples, dict(censor)


def fit_matrix(samples: list[dict], scaler: RobustScaler | None = None):
    Xn = np.asarray([s["numeric"] for s in samples], dtype=float)
    Xc = np.asarray([s["onehot"] for s in samples], dtype=float)
    if scaler is None:
        scaler = RobustScaler()
        Z = scaler.fit_transform(Xn)
    else:
        Z = scaler.transform(Xn)
    return np.column_stack([Z, Xc]), scaler


def frozen_predict(model: dict, numeric: np.ndarray, onehot: np.ndarray) -> float:
    center = np.asarray(model["scaler_center"], dtype=float)
    scale = np.asarray(model["scaler_scale"], dtype=float)
    scale = np.where(scale == 0, 1.0, scale)
    z = (np.asarray(numeric, dtype=float) - center) / scale
    x = np.concatenate([z, np.asarray(onehot, dtype=float)])
    coef = np.asarray(model["coef"], dtype=float)
    logit = float(model["intercept"]) + float(np.dot(coef, x))
    if logit >= 0:
        return float(1.0 / (1.0 + math.exp(-logit)))
    e = math.exp(logit)
    return float(e / (1.0 + e))


def write_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")


def fit_command(a):
    root = Path(a.root)
    state_run = Path(a.state_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    state_path = state_run / "state_sequence.csv.gz"
    if sha(state_path) != EXPECTED_STATE_FILE:
        raise ValueError("state file hash changed")
    if sha(state_run / "input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("state manifest hash changed")

    (out / "environment_fit.json").write_text(json.dumps({
        "python": sys.version,
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "fit_end_exclusive": SPLIT,
        "evaluation_opened": False,
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1(root, SPLIT, out / "input_manifest_fit.json")
    state = load_state_prefix(state_path, SPLIT_MS)
    samples, censor = enumerate_samples(f, state, 0, SPLIT_MS)
    if len(samples) < 100:
        raise ValueError(f"too few training samples {len(samples)}")
    y = np.asarray([s["label"] for s in samples], dtype=int)
    if set(y.tolist()) != {0, 1}:
        raise ValueError("training requires both classes")

    X, scaler = fit_matrix(samples)
    clf = LogisticRegression(
        penalty="l2", C=1.0, class_weight="balanced",
        max_iter=5000, random_state=20261003,
    )
    clf.fit(X, y)
    if list(clf.classes_) != [0, 1]:
        raise ValueError(f"unexpected classes {clf.classes_}")

    write_jsonl(out / "training_samples.jsonl", samples)
    frozen = {
        "feature_names": list(FEATURE_NAMES),
        "numeric_names": list(NUMERIC_NAMES),
        "sessions": list(SESSIONS),
        "threshold": THRESHOLD,
        "scaler_center": scaler.center_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "coef": clf.coef_[0].tolist(),
        "intercept": float(clf.intercept_[0]),
        "classes": [0, 1],
        "training_n": int(len(samples)),
        "label_counts": {str(k): int(v) for k, v in Counter(y.tolist()).items()},
        "handoff_prevalence": float(np.mean(y)),
        "training_censor_counts": censor,
        "fit_quality": quality,
        "max_training_signal_time": int(max(s["signal_time"] for s in samples)),
        "max_training_resolution_time": int(max(s["resolution_time"] for s in samples)),
        "fit_end_exclusive": SPLIT_MS,
        "validation_read": False,
        "holdout_read": False,
    }
    (out / "frozen_model.json").write_text(
        json.dumps(frozen, indent=2, allow_nan=False), encoding="utf-8"
    )
    freeze = {
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "frozen_model_sha256": sha(out / "frozen_model.json"),
        "training_samples_sha256": sha(out / "training_samples.jsonl"),
        "fit_manifest_sha256": sha(out / "input_manifest_fit.json"),
        "evaluation_opened": False,
        "evaluation_opened_at": None,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "validation_read": False,
        "holdout_read": False,
    }
    (out / "freeze.json").write_text(json.dumps(freeze, indent=2), encoding="utf-8")
    print(json.dumps({
        "training_n": len(samples),
        "label_counts": frozen["label_counts"],
        "handoff_prevalence": frozen["handoff_prevalence"],
        "censor": censor,
        "freeze": freeze,
    }, indent=2), flush=True)


def open_command(a):
    out = Path(a.out)
    freeze_path = out / "freeze.json"
    freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
    if freeze.get("evaluation_opened"):
        raise ValueError("evaluation already opened")
    if sha(out / "frozen_model.json") != freeze["frozen_model_sha256"]:
        raise ValueError("frozen model hash changed")
    if sha(out / "training_samples.jsonl") != freeze["training_samples_sha256"]:
        raise ValueError("training samples hash changed")
    freeze["evaluation_opened"] = True
    freeze["evaluation_opened_at"] = datetime.now(timezone.utc).isoformat()
    freeze_path.write_text(json.dumps(freeze, indent=2), encoding="utf-8")
    print(json.dumps(freeze, indent=2), flush=True)


def classification_metrics(y: np.ndarray, p: np.ndarray) -> dict:
    pred = (p >= THRESHOLD).astype(int)
    pr, rc, f1, sup = precision_recall_fscore_support(
        y, pred, labels=[0, 1], zero_division=0
    )
    return {
        "n": int(len(y)),
        "handoff_prevalence": float(np.mean(y)),
        "accuracy": float(accuracy_score(y, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y, pred)),
        "roc_auc": float(roc_auc_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
        "confusion_matrix": confusion_matrix(y, pred, labels=[0, 1]).tolist(),
        "safe": {
            "precision": float(pr[0]), "recall": float(rc[0]),
            "f1": float(f1[0]), "support": int(sup[0]),
        },
        "handoff": {
            "precision": float(pr[1]), "recall": float(rc[1]),
            "f1": float(f1[1]), "support": int(sup[1]),
        },
        "p_quantiles": {
            "q10": float(np.quantile(p, 0.10)),
            "q25": float(np.quantile(p, 0.25)),
            "q50": float(np.quantile(p, 0.50)),
            "q75": float(np.quantile(p, 0.75)),
            "q90": float(np.quantile(p, 0.90)),
        },
    }


def guarded_simulation(
    f: pd.DataFrame,
    state: pd.DataFrame,
    model: dict,
) -> tuple[dict, list[dict], list[dict]]:
    smap = state_map(state)
    ages = range_age_map(f, smap)
    t = f.t.to_numpy(dtype=np.int64)
    start = int(np.searchsorted(t, SPLIT_MS, side="left"))
    end_ms = ms(RAW_END)
    end = int(np.searchsorted(t, end_ms, side="left"))
    i = start
    decisions = []
    trades = []
    censor = Counter()
    candidates = allowed = skipped = 0

    while i < end:
        ti = int(t[i])
        sr = smap.get(ti)
        if sr is None:
            i += 1
            continue
        sig = signal_at(i, f, sr)
        if sig is None:
            i += 1
            continue
        try:
            numeric, onehot = raw_features(sig, i, f, sr, ages.get(ti, 0))
        except ValueError:
            i += 1
            continue
        p = frozen_predict(model, numeric, onehot)
        candidates += 1
        lab = structural_label(sig, f, smap, end_ms)
        decision = {
            "signal_time": ti,
            "year": int(pd.to_datetime(ti, unit="ms", utc=True).year),
            "direction": int(sig["direction"]),
            "p_handoff": p,
            "allowed": bool(p < THRESHOLD),
            "actual_label_mature": bool(lab["mature"]),
            "actual_handoff": int(lab["label"]) if lab["mature"] else None,
        }
        if p >= THRESHOLD:
            skipped += 1
            decision["result_status"] = "STAND_DOWN"
            decisions.append(decision)
            i += 1
            continue

        allowed += 1
        result = execute_trade(sig, f, smap, end_ms)
        decision["result_status"] = result["status"]
        decisions.append(decision)
        if result["status"] == "TRADE":
            row = {
                **sig,
                **{k: v for k, v in result.items() if k not in ("status", "resume_idx")},
                "p_handoff": p,
                "actual_handoff": int(lab["label"]) if lab["mature"] else None,
                "year": int(pd.to_datetime(ti, unit="ms", utc=True).year),
            }
            trades.append(row)
            i = max(i + 1, int(result["resume_idx"]))
        else:
            censor[result["status"]] += 1
            i = max(i + 1, int(result.get("resume_idx", i + 1)))

    overall = range_metrics(trades)
    by_dir = {
        "long": range_metrics([r for r in trades if r["direction"] == 1]),
        "short": range_metrics([r for r in trades if r["direction"] == -1]),
    }
    by_year = {}
    for y in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == y]
        by_year[str(y)] = range_metrics(rr) if len(rr) >= 20 else {"n": len(rr)}

    completed_c1_total = float(sum(r["c1"] for r in trades))
    mature_allowed = [
        d for d in decisions if d["allowed"] and d["actual_label_mature"]
    ]
    mature_skipped = [
        d for d in decisions if (not d["allowed"]) and d["actual_label_mature"]
    ]
    report = {
        "flat_candidate_signals": int(candidates),
        "allowed_signals": int(allowed),
        "skipped_signals": int(skipped),
        "coverage": float(allowed / candidates) if candidates else None,
        "completed_trades": int(len(trades)),
        "censored_counts": dict(censor),
        "overall": overall,
        "c1_mean_per_flat_opportunity": (
            completed_c1_total / candidates if candidates else None
        ),
        "actual_handoff_rate_allowed": (
            float(np.mean([d["actual_handoff"] for d in mature_allowed]))
            if mature_allowed else None
        ),
        "actual_handoff_rate_skipped": (
            float(np.mean([d["actual_handoff"] for d in mature_skipped]))
            if mature_skipped else None
        ),
        "by_direction": by_dir,
        "by_year": by_year,
    }
    return report, trades, decisions


def evaluate_command(a):
    root = Path(a.root)
    state_run = Path(a.state_run)
    no_guard_run = Path(a.no_guard_run)
    out = Path(a.out)

    freeze = json.loads((out / "freeze.json").read_text(encoding="utf-8"))
    if not freeze.get("evaluation_opened"):
        raise ValueError("evaluation not opened")
    if sha(out / "frozen_model.json") != freeze["frozen_model_sha256"]:
        raise ValueError("frozen model hash changed")
    if sha(out / "training_samples.jsonl") != freeze["training_samples_sha256"]:
        raise ValueError("training samples hash changed")
    if sha(state_run / "state_sequence.csv.gz") != EXPECTED_STATE_FILE:
        raise ValueError("state file hash changed")
    if sha(state_run / "input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("state manifest hash changed")
    if sha(no_guard_run / "summary.json") != EXPECTED_NO_GUARD_SUMMARY:
        raise ValueError("NO_GUARD summary hash changed")

    model = json.loads((out / "frozen_model.json").read_text(encoding="utf-8"))
    if model["feature_names"] != list(FEATURE_NAMES):
        raise ValueError("feature order changed")
    if float(model["threshold"]) != THRESHOLD:
        raise ValueError("threshold changed")

    (out / "environment_evaluate.json").write_text(json.dumps({
        "python": sys.version,
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "threshold": THRESHOLD,
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1(root, RAW_END, out / "input_manifest_evaluate.json")
    if json.loads((out / "input_manifest_evaluate.json").read_text()) != json.loads(
        (state_run / "input_manifest.json").read_text()
    ):
        raise ValueError("evaluation manifest differs from State Engine")
    state = load_state_full(state_run / "state_sequence.csv.gz")
    if state_content_hash(state.state) != EXPECTED_STATE_CONTENT:
        raise ValueError("state content hash changed")

    samples, sample_censor = enumerate_samples(
        f, state, SPLIT_MS, ms(RAW_END)
    )
    if len(samples) < 100:
        raise ValueError("too few evaluation samples")
    p = np.asarray([
        frozen_predict(
            model,
            np.asarray(s["numeric"], dtype=float),
            np.asarray(s["onehot"], dtype=float),
        )
        for s in samples
    ])
    y = np.asarray([s["label"] for s in samples], dtype=int)
    class_report = classification_metrics(y, p)

    eval_rows = []
    for s, prob in zip(samples, p):
        eval_rows.append({**s, "p_handoff": float(prob), "pred_handoff": int(prob >= THRESHOLD)})
    write_jsonl(out / "evaluation_samples.jsonl", eval_rows)

    guard, trades, decisions = guarded_simulation(f, state, model)
    write_jsonl(out / "guarded_trades.jsonl", trades)
    write_jsonl(out / "guard_decisions.jsonl", decisions)

    no_guard = json.loads((no_guard_run / "summary.json").read_text(encoding="utf-8"))
    baseline = no_guard["reports"]["evaluation"]["overall"]

    positive_years = sum(
        1 for yy in ("2021", "2022", "2023")
        if guard["by_year"].get(yy, {}).get("n", 0) >= 20
        and guard["by_year"][yy].get("c1_mean_per_trade", -999) > 0
    )
    ov = guard["overall"]
    screen = {
        "evaluation_labels_ge_500": class_report["n"] >= 500,
        "balanced_accuracy_gt_0_60": class_report["balanced_accuracy"] > 0.60,
        "handoff_recall_ge_0_60": class_report["handoff"]["recall"] >= 0.60,
        "completed_trades_ge_100": ov.get("n", 0) >= 100,
        "long_completed_ge_40": guard["by_direction"]["long"].get("n", 0) >= 40,
        "short_completed_ge_40": guard["by_direction"]["short"].get("n", 0) >= 40,
        "coverage_ge_0_25": guard["coverage"] is not None and guard["coverage"] >= 0.25,
        "c0_positive": ov.get("c0_mean_per_trade", -999) > 0,
        "c1_positive": ov.get("c1_mean_per_trade", -999) > 0,
        "c2_nonnegative": ov.get("c2_mean_per_trade", -999) >= 0,
        "c1_win_gt_0_50": ov.get("c1_win_rate", 0) > 0.50,
        "c1_better_than_no_guard": (
            ov.get("c1_mean_per_trade", -999) > float(baseline["c1_mean_per_trade"])
        ),
        "state_exit_fraction_lower_than_no_guard": (
            ov.get("state_exit_before_target_fraction", 1.0)
            < float(baseline["state_exit_before_target_fraction"])
        ),
        "two_full_years_positive_c1": positive_years >= 2,
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Pre-Transition Guard v0.1 Train-development diagnostic",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "threshold": THRESHOLD,
        "classification": class_report,
        "evaluation_sample_censor": sample_censor,
        "guarded_execution": guard,
        "no_guard_baseline": baseline,
        "registered_screen": screen,
        "integrity": {
            "frozen_model_hash_unchanged": "PASS",
            "training_samples_hash_unchanged": "PASS",
            "state_file_hash_unchanged": "PASS",
            "state_content_hash_unchanged": "PASS",
            "source_manifest_unchanged": "PASS",
            "no_guard_hash_unchanged": "PASS",
            "feature_order_frozen": "PASS",
            "threshold_0_50": "PASS",
            "one_active_trade": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "evidence_status": "TEMPORALLY_SEPARATED_TRAIN_DEVELOPMENT_NOT_INDEPENDENT_CONFIRMATION",
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "classification": class_report,
        "guarded_execution": guard,
        "no_guard": baseline,
        "screen": screen,
    }, indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("fit", "evaluate"):
        p = sub.add_parser(name)
        p.add_argument("--root", required=True)
        p.add_argument("--state-run", required=True)
        p.add_argument("--out", required=True)
        if name == "evaluate":
            p.add_argument("--no-guard-run", required=True)
    p = sub.add_parser("open-evaluation")
    p.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.cmd == "fit":
        fit_command(a)
    elif a.cmd == "open-evaluation":
        open_command(a)
    else:
        evaluate_command(a)


if __name__ == "__main__":
    main()
