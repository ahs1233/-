"""GTG Joint State + Strategy Learning v0.1.

Symbolic state constraints + learned expected C1 utility.
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

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import RobustScaler

HERE = Path(__file__).resolve().parent
from compare import costs
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END

PROTOCOL = HERE / "PROTOCOL_JOINT_STATE_STRATEGY_LEARNING_V0_1.md"
SPLIT = "2021-01-01"
SPLIT_MS = ms(SPLIT)
HORIZON = 4

EXPECTED_STATE_FILE = "cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772"
EXPECTED_STATE_CONTENT = "c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e"
EXPECTED_MANIFEST = "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"

STATE_CATS = ("RANGE", "TREND_UP", "TREND_DOWN")
SESSIONS = ("Asia", "London", "NewYork", "Late")
NUMERIC_NAMES = (
    "action_direction",
    "aligned_action_vs_state",
    "position24",
    "prior24_width_atr",
    "signed_midpoint_distance_atr",
    "range_age",
    "trend_age",
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
    "rejection_body_atr",
    "close_to_upper_atr",
    "close_to_lower_atr",
)
FEATURE_NAMES = (
    NUMERIC_NAMES
    + tuple("state_" + s for s in STATE_CATS)
    + tuple("session_" + s for s in SESSIONS)
)
STATE_COLUMNS = (
    "t", "state", "atr",
    "dc0p5_dir", "dc1p0_dir", "dc2p0_dir", "dc4p0_dir",
    "dc_up_count", "dc_down_count",
    "drift12", "drift24", "drift48",
    "efficiency24", "efficiency48",
    "spread_atr", "atr_week_ratio",
    "prior24_upper", "prior24_lower", "prior24_width_atr", "position24",
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def state_content_hash(s: pd.Series) -> str:
    vals = ["" if pd.isna(x) else str(x) for x in s]
    return hashlib.sha256(("\n".join(vals)).encode()).hexdigest()


def gap_ok(a: int, b: int) -> bool:
    d = int(b) - int(a)
    return 0 < d <= MAX_CONTIG_GAP


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
            v = row[k]
            out[k] = float(v) if v not in ("", None) else np.nan
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
    df = pd.read_csv(path, usecols=list(STATE_COLUMNS))
    for k in STATE_COLUMNS:
        if k not in ("state",):
            df[k] = pd.to_numeric(df[k], errors="raise")
    return df


def state_map(df: pd.DataFrame) -> dict[int, dict]:
    return {
        int(r["t"]): {k: r[k] for k in STATE_COLUMNS if k != "t"}
        for r in df.to_dict(orient="records")
    }


def state_age_maps(f: pd.DataFrame, smap: dict[int, dict]) -> tuple[dict[int, int], dict[int, int]]:
    range_age, trend_age = {}, {}
    prev_t = None
    prev_state = None
    ra = ta = 0
    for ti0 in f.t.to_numpy(dtype=np.int64):
        ti = int(ti0)
        sr = smap.get(ti)
        st = str(sr["state"]) if sr is not None else ""
        cont = prev_t is not None and gap_ok(prev_t, ti) and st == prev_state
        if st == "RANGE":
            ra = ra + 1 if cont else 1
            ta = 0
        elif st in ("TREND_UP", "TREND_DOWN"):
            ta = ta + 1 if cont else 1
            ra = 0
        else:
            ra = ta = 0
        range_age[ti] = ra
        trend_age[ti] = ta
        prev_t, prev_state = ti, st
    return range_age, trend_age


def allowed_directions(state: str) -> tuple[int, ...]:
    if state == "RANGE":
        return (1, -1)
    if state == "TREND_UP":
        return (1,)
    if state == "TREND_DOWN":
        return (-1,)
    return ()


def direction_allowed(state: str, direction: int) -> bool:
    return int(direction) in allowed_directions(str(state))


def feature_vector(
    i: int,
    direction: int,
    f: pd.DataFrame,
    sr: dict,
    range_age: int,
    trend_age: int,
) -> tuple[np.ndarray, np.ndarray]:
    st = str(sr["state"])
    d = int(direction)
    if d not in allowed_directions(st):
        raise ValueError("action not allowed by state")
    atr = float(sr["atr"])
    if not np.isfinite(atr) or atr <= 0:
        raise ValueError("bad ATR")

    vals = [
        float(sr["position24"]), float(sr["prior24_width_atr"]),
        float(sr["drift12"]), float(sr["drift24"]), float(sr["drift48"]),
        float(sr["efficiency24"]), float(sr["efficiency48"]),
        float(sr["dc0p5_dir"]), float(sr["dc1p0_dir"]),
        float(sr["dc2p0_dir"]), float(sr["dc4p0_dir"]),
        float(sr["dc_up_count"]), float(sr["dc_down_count"]),
        float(sr["spread_atr"]), float(sr["atr_week_ratio"]),
        float(sr["prior24_upper"]), float(sr["prior24_lower"]),
    ]
    if not np.all(np.isfinite(vals)):
        raise ValueError("nonfinite state feature")

    close = float(f.bc.iloc[i])
    open_ = float(f.bo.iloc[i])
    high = float(f.bh.iloc[i])
    low = float(f.bl.iloc[i])
    midpoint = (float(sr["prior24_upper"]) + float(sr["prior24_lower"])) / 2.0
    state_dir = 1 if st == "TREND_UP" else -1 if st == "TREND_DOWN" else 0
    aligned_count = float(sr["dc_up_count"] if d == 1 else sr["dc_down_count"])
    opposing_count = float(sr["dc_down_count"] if d == 1 else sr["dc_up_count"])

    numeric = np.asarray([
        d,
        1.0 if state_dir == d else 0.0,
        float(sr["position24"]),
        float(sr["prior24_width_atr"]),
        d * (midpoint - close) / atr,
        math.log1p(max(0, int(range_age))),
        math.log1p(max(0, int(trend_age))),
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
        d * (close - open_) / atr,
        (float(sr["prior24_upper"]) - close) / atr,
        (close - float(sr["prior24_lower"])) / atr,
    ], dtype=float)
    if not np.all(np.isfinite(numeric)):
        raise ValueError("nonfinite numeric feature")

    state_oh = np.asarray([1.0 if st == s else 0.0 for s in STATE_CATS], dtype=float)
    sess = session_name(int(f.t.iloc[i]))
    session_oh = np.asarray([1.0 if sess == s else 0.0 for s in SESSIONS], dtype=float)
    return numeric, np.concatenate([state_oh, session_oh])


def action_outcome(
    i: int,
    direction: int,
    f: pd.DataFrame,
    smap: dict[int, dict],
    split_end: int,
) -> dict:
    t = f.t.to_numpy(dtype=np.int64)
    ti = int(t[i])
    sr0 = smap.get(ti)
    if sr0 is None or int(direction) not in allowed_directions(str(sr0["state"])):
        return {"mature": False, "reason": "NOT_ALLOWED"}
    atr = float(sr0["atr"])
    if not np.isfinite(atr) or atr <= 0:
        return {"mature": False, "reason": "BAD_ATR"}

    entry = i + 1
    if entry >= len(f) or int(t[entry]) >= split_end:
        return {"mature": False, "reason": "SPLIT_END", "resume_idx": int(entry)}
    if not gap_ok(t[i], t[entry]):
        return {"mature": False, "reason": "ENTRY_HARD_GAP", "resume_idx": int(entry)}

    horizon_signal = i + HORIZON
    prev = i
    for k in range(entry, min(horizon_signal, len(f) - 1) + 1):
        tk = int(t[k])
        if tk >= split_end:
            return {"mature": False, "reason": "SPLIT_END", "resume_idx": int(k)}
        if not gap_ok(t[prev], t[k]):
            return {"mature": False, "reason": "HARD_GAP", "resume_idx": int(k)}
        prev = k
        sr = smap.get(tk)
        if sr is None:
            return {"mature": False, "reason": "MISSING_STATE", "resume_idx": int(k + 1)}

        disallowed = not direction_allowed(str(sr["state"]), int(direction))
        horizon = k == horizon_signal
        if not disallowed and not horizon:
            continue

        exit_i = k + 1
        if exit_i >= len(f) or int(t[exit_i]) >= split_end:
            return {"mature": False, "reason": "SPLIT_END", "resume_idx": int(exit_i)}
        if not gap_ok(t[k], t[exit_i]):
            return {"mature": False, "reason": "HARD_GAP", "resume_idx": int(exit_i)}

        cc = costs(
            int(direction),
            float(f.bo.iloc[entry]), float(f.ao.iloc[entry]),
            float(f.bo.iloc[exit_i]), float(f.ao.iloc[exit_i]),
            atr,
        )
        return {
            "mature": True,
            "reason": "STATE_DISALLOW" if disallowed else "HORIZON",
            "entry_idx": int(entry),
            "exit_signal_idx": int(k),
            "exit_idx": int(exit_i),
            "resume_idx": int(exit_i),
            "entry_time": int(t[entry]),
            "exit_signal_time": int(t[k]),
            "exit_time": int(t[exit_i]),
            "duration_bars": int(k - i),
            "elapsed_wall_hours": float((t[exit_i] - t[entry]) / 3_600_000),
            "c0": float(cc["c0"]),
            "c1": float(cc["c1"]),
            "c2": float(cc["c2"]),
        }

    return {"mature": False, "reason": "DATA_END"}


def enumerate_action_samples(
    f: pd.DataFrame,
    state_df: pd.DataFrame,
    start_ms: int,
    end_ms: int,
) -> tuple[list[dict], dict]:
    smap = state_map(state_df)
    range_age, trend_age = state_age_maps(f, smap)
    samples: list[dict] = []
    censor = Counter()
    t = f.t.to_numpy(dtype=np.int64)

    for i in range(len(f)):
        ti = int(t[i])
        if not (start_ms <= ti < end_ms):
            continue
        sr = smap.get(ti)
        if sr is None:
            continue
        st = str(sr["state"])
        dirs = allowed_directions(st)
        if not dirs:
            continue

        for d in dirs:
            try:
                numeric, onehot = feature_vector(
                    i, d, f, sr, range_age.get(ti, 0), trend_age.get(ti, 0)
                )
            except ValueError:
                censor["BAD_FEATURE"] += 1
                continue
            out = action_outcome(i, d, f, smap, end_ms)
            if not out.get("mature"):
                censor[out.get("reason", "UNKNOWN")] += 1
                continue
            samples.append({
                "signal_idx": int(i),
                "signal_time": ti,
                "state": st,
                "direction": int(d),
                "numeric": numeric.tolist(),
                "onehot": onehot.tolist(),
                "target_c1": float(out["c1"]),
                "target_c0": float(out["c0"]),
                "target_c2": float(out["c2"]),
                "outcome_reason": out["reason"],
                "exit_time": int(out["exit_time"]),
                "duration_bars": int(out["duration_bars"]),
            })
    return samples, dict(censor)


def design_matrix(
    samples: list[dict],
    scaler: RobustScaler | None = None,
) -> tuple[np.ndarray, RobustScaler]:
    Xn = np.asarray([r["numeric"] for r in samples], dtype=float)
    Xc = np.asarray([r["onehot"] for r in samples], dtype=float)
    if scaler is None:
        scaler = RobustScaler()
        Z = scaler.fit_transform(Xn)
    else:
        Z = scaler.transform(Xn)
    return np.column_stack([Z, Xc]), scaler


def primary_model() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.05,
        max_iter=200,
        max_leaf_nodes=15,
        max_depth=4,
        min_samples_leaf=30,
        l2_regularization=1.0,
        early_stopping=False,
        random_state=20261003,
    )


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")


def fit_command(a) -> None:
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
        "horizon": HORIZON,
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    state_df = load_state_prefix(state_path, SPLIT_MS)
    f, quality = load_h1(root, SPLIT, out / "input_manifest_fit.json")
    samples, censor = enumerate_action_samples(f, state_df, 0, SPLIT_MS)
    if len(samples) < 1000:
        raise ValueError(f"insufficient training samples {len(samples)}")

    X, scaler = design_matrix(samples)
    y = np.asarray([r["target_c1"] for r in samples], dtype=float)

    primary = primary_model()
    primary.fit(X, y)
    ridge = Ridge(alpha=1.0)
    ridge.fit(X, y)

    artifact = {
        "scaler": scaler,
        "primary": primary,
        "ridge": ridge,
        "numeric_names": list(NUMERIC_NAMES),
        "feature_names": list(FEATURE_NAMES),
        "state_categories": list(STATE_CATS),
        "session_categories": list(SESSIONS),
        "horizon": HORIZON,
        "utility_threshold": 0.0,
    }
    model_path = out / "models.joblib"
    joblib.dump(artifact, model_path, compress=3)

    compact = [{
        "signal_time": r["signal_time"],
        "state": r["state"],
        "direction": r["direction"],
        "target_c1": r["target_c1"],
        "target_c0": r["target_c0"],
        "target_c2": r["target_c2"],
        "outcome_reason": r["outcome_reason"],
        "exit_time": r["exit_time"],
        "numeric": r["numeric"],
        "onehot": r["onehot"],
    } for r in samples]
    write_jsonl(out / "training_samples.jsonl", compact)

    counts = Counter((r["state"], r["direction"]) for r in samples)
    fit_summary = {
        "training_n": int(len(samples)),
        "counts_by_state_action": {
            f"{s}:{d}": int(n) for (s, d), n in sorted(counts.items())
        },
        "target_c1_mean": float(np.mean(y)),
        "target_c1_median": float(np.median(y)),
        "censor_counts": censor,
        "quality": quality,
        "max_signal_time": int(max(r["signal_time"] for r in samples)),
        "max_exit_time": int(max(r["exit_time"] for r in samples)),
        "fit_end_exclusive": SPLIT_MS,
        "validation_read": False,
        "holdout_read": False,
    }
    (out / "fit_summary.json").write_text(
        json.dumps(fit_summary, indent=2, allow_nan=False), encoding="utf-8"
    )

    freeze = {
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "models_sha256": sha(model_path),
        "training_samples_sha256": sha(out / "training_samples.jsonl"),
        "fit_summary_sha256": sha(out / "fit_summary.json"),
        "fit_manifest_sha256": sha(out / "input_manifest_fit.json"),
        "evaluation_opened": False,
        "evaluation_opened_at": None,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "validation_read": False,
        "holdout_read": False,
    }
    (out / "freeze.json").write_text(
        json.dumps(freeze, indent=2), encoding="utf-8"
    )
    print(json.dumps({"fit": fit_summary, "freeze": freeze}, indent=2), flush=True)


def open_command(a) -> None:
    out = Path(a.out)
    freeze_path = out / "freeze.json"
    freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
    if freeze.get("evaluation_opened"):
        raise ValueError("evaluation already opened")
    if sha(out / "models.joblib") != freeze["models_sha256"]:
        raise ValueError("models hash changed")
    if sha(out / "training_samples.jsonl") != freeze["training_samples_sha256"]:
        raise ValueError("training samples hash changed")
    if sha(out / "fit_summary.json") != freeze["fit_summary_sha256"]:
        raise ValueError("fit summary hash changed")
    freeze["evaluation_opened"] = True
    freeze["evaluation_opened_at"] = datetime.now(timezone.utc).isoformat()
    freeze_path.write_text(json.dumps(freeze, indent=2), encoding="utf-8")
    print(json.dumps(freeze, indent=2), flush=True)


def predict_utility(artifact: dict, numeric: np.ndarray, onehot: np.ndarray, model_key: str = "primary") -> float:
    scaler = artifact["scaler"]
    z = scaler.transform(np.asarray(numeric, dtype=float).reshape(1, -1))
    x = np.column_stack([z, np.asarray(onehot, dtype=float).reshape(1, -1)])
    model = artifact[model_key]
    return float(model.predict(x)[0])


def corr_value(y: np.ndarray, p: np.ndarray):
    if len(y) < 2 or float(np.std(y)) == 0 or float(np.std(p)) == 0:
        return None
    return float(np.corrcoef(y, p)[0, 1])


def regression_metrics(y: np.ndarray, p: np.ndarray) -> dict:
    if len(y) == 0:
        return {"n": 0}
    pos = p > 0
    return {
        "n": int(len(y)),
        "target_c1_mean": float(np.mean(y)),
        "target_c1_median": float(np.median(y)),
        "prediction_mean": float(np.mean(p)),
        "mae": float(mean_absolute_error(y, p)),
        "rmse": float(mean_squared_error(y, p) ** 0.5),
        "correlation": corr_value(y, p),
        "positive_sign_accuracy": float(np.mean((p > 0) == (y > 0))),
        "predicted_positive_fraction": float(np.mean(pos)),
        "realized_c1_mean_predicted_positive": float(np.mean(y[pos])) if np.any(pos) else None,
        "realized_c1_win_predicted_positive": float(np.mean(y[pos] > 0)) if np.any(pos) else None,
    }


def trade_metrics(trades: list[dict], decision_count: int) -> dict:
    if not trades:
        return {
            "n": 0,
            "decision_count": int(decision_count),
            "c1_mean_per_opportunity": 0.0 if decision_count else None,
        }
    return {
        "n": int(len(trades)),
        "decision_count": int(decision_count),
        "long_n": int(sum(r["direction"] == 1 for r in trades)),
        "short_n": int(sum(r["direction"] == -1 for r in trades)),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in trades])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in trades])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in trades])),
        "c1_total": float(sum(r["c1"] for r in trades)),
        "c1_mean_per_opportunity": float(sum(r["c1"] for r in trades) / decision_count) if decision_count else None,
        "c1_win_rate": float(np.mean([r["c1"] > 0 for r in trades])),
        "duration_median_bars": float(np.median([r["duration_bars"] for r in trades])),
        "duration_mean_bars": float(np.mean([r["duration_bars"] for r in trades])),
        "elapsed_wall_hours_mean": float(np.mean([r["elapsed_wall_hours"] for r in trades])),
        "exit_reason_counts": dict(Counter(r["outcome_reason"] for r in trades)),
        "entry_state_counts": dict(Counter(r["entry_state"] for r in trades)),
    }


def choose_learned_action(
    i: int,
    f: pd.DataFrame,
    sr: dict,
    range_age: int,
    trend_age: int,
    artifact: dict,
) -> tuple[int, dict]:
    st = str(sr["state"])
    dirs = allowed_directions(st)
    if not dirs:
        return 0, {"predictions": {}}
    preds = {}
    for d in dirs:
        try:
            numeric, onehot = feature_vector(i, d, f, sr, range_age, trend_age)
        except ValueError:
            continue
        preds[d] = predict_utility(artifact, numeric, onehot, "primary")
    if not preds:
        return 0, {"predictions": {}}
    best_val = max(preds.values())
    best_dirs = [d for d, v in preds.items() if v == best_val]
    if best_val <= 0 or len(best_dirs) != 1:
        return 0, {"predictions": {str(k): v for k, v in preds.items()}}
    return int(best_dirs[0]), {
        "predictions": {str(k): v for k, v in preds.items()},
        "selected_predicted_c1": float(best_val),
    }


def choose_symbolic_action(sr: dict) -> int:
    st = str(sr["state"])
    if st == "TREND_UP":
        return 1
    if st == "TREND_DOWN":
        return -1
    if st == "RANGE":
        pos = float(sr["position24"])
        if not np.isfinite(pos):
            return 0
        if pos < 0.5:
            return 1
        if pos > 0.5:
            return -1
    return 0


def simulate_policy(
    mode: str,
    f: pd.DataFrame,
    state_df: pd.DataFrame,
    artifact: dict | None,
) -> tuple[dict, list[dict], list[dict]]:
    if mode not in ("learned", "symbolic"):
        raise ValueError(mode)
    smap = state_map(state_df)
    range_age, trend_age = state_age_maps(f, smap)
    t = f.t.to_numpy(dtype=np.int64)
    start = int(np.searchsorted(t, SPLIT_MS, side="left"))
    end_ms = ms(RAW_END)
    end = int(np.searchsorted(t, end_ms, side="left"))
    i = start
    decisions: list[dict] = []
    trades: list[dict] = []
    censor = Counter()
    selected = Counter()
    decision_state = Counter()

    while i < end:
        ti = int(t[i])
        sr = smap.get(ti)
        if sr is None:
            i += 1
            continue
        st = str(sr["state"])
        decision_state[st] += 1

        if mode == "learned":
            d, meta = choose_learned_action(
                i, f, sr, range_age.get(ti, 0), trend_age.get(ti, 0), artifact
            )
        else:
            d = choose_symbolic_action(sr)
            meta = {}

        selected["FLAT" if d == 0 else "LONG" if d == 1 else "SHORT"] += 1
        decision = {
            "time": ti,
            "year": int(pd.to_datetime(ti, unit="ms", utc=True).year),
            "state": st,
            "direction": int(d),
            **meta,
        }

        if d == 0:
            decision["result"] = "FLAT"
            decisions.append(decision)
            i += 1
            continue

        out = action_outcome(i, d, f, smap, end_ms)
        decision["result"] = "TRADE" if out.get("mature") else out.get("reason")
        decisions.append(decision)

        if not out.get("mature"):
            censor[out.get("reason", "UNKNOWN")] += 1
            i = max(i + 1, int(out.get("resume_idx", i + 1)))
            continue

        trade = {
            "signal_time": ti,
            "year": int(pd.to_datetime(ti, unit="ms", utc=True).year),
            "entry_state": st,
            "direction": int(d),
            "entry_time": int(out["entry_time"]),
            "exit_time": int(out["exit_time"]),
            "duration_bars": int(out["duration_bars"]),
            "elapsed_wall_hours": float(out["elapsed_wall_hours"]),
            "outcome_reason": out["reason"],
            "c0": float(out["c0"]),
            "c1": float(out["c1"]),
            "c2": float(out["c2"]),
            "predicted_c1": float(meta["selected_predicted_c1"]) if mode == "learned" and "selected_predicted_c1" in meta else None,
        }
        trades.append(trade)
        i = max(i + 1, int(out["exit_idx"]))

    total_decisions = int(sum(decision_state.values()))
    overall = trade_metrics(trades, total_decisions)

    by_state = {}
    for s in STATE_CATS:
        rr = [r for r in trades if r["entry_state"] == s]
        by_state[s] = trade_metrics(rr, int(decision_state.get(s, 0)))

    by_direction = {
        "long": trade_metrics([r for r in trades if r["direction"] == 1], total_decisions),
        "short": trade_metrics([r for r in trades if r["direction"] == -1], total_decisions),
    }
    by_year = {}
    for y in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == y]
        yd = sum(1 for d in decisions if d["year"] == y)
        by_year[str(y)] = trade_metrics(rr, yd) if len(rr) >= 20 else {"n": len(rr), "decision_count": yd}

    report = {
        "mode": mode,
        "decision_count": total_decisions,
        "decision_state_counts": dict(decision_state),
        "selected_action_counts": dict(selected),
        "censored_counts": dict(censor),
        "overall": overall,
        "by_entry_state": by_state,
        "by_direction": by_direction,
        "by_year": by_year,
    }
    return report, trades, decisions


def evaluate_command(a) -> None:
    root = Path(a.root)
    state_run = Path(a.state_run)
    out = Path(a.out)

    freeze = json.loads((out / "freeze.json").read_text(encoding="utf-8"))
    if not freeze.get("evaluation_opened"):
        raise ValueError("evaluation not opened")
    if sha(out / "models.joblib") != freeze["models_sha256"]:
        raise ValueError("models hash changed")
    if sha(out / "training_samples.jsonl") != freeze["training_samples_sha256"]:
        raise ValueError("training samples hash changed")
    if sha(out / "fit_summary.json") != freeze["fit_summary_sha256"]:
        raise ValueError("fit summary hash changed")
    if sha(state_run / "state_sequence.csv.gz") != EXPECTED_STATE_FILE:
        raise ValueError("state file hash changed")
    if sha(state_run / "input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("state manifest hash changed")

    artifact = joblib.load(out / "models.joblib")
    if artifact["feature_names"] != list(FEATURE_NAMES):
        raise ValueError("feature order changed")
    if int(artifact["horizon"]) != HORIZON or float(artifact["utility_threshold"]) != 0.0:
        raise ValueError("policy contract changed")

    (out / "environment_evaluate.json").write_text(json.dumps({
        "python": sys.version,
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "horizon": HORIZON,
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1(root, RAW_END, out / "input_manifest_evaluate.json")
    if json.loads((out / "input_manifest_evaluate.json").read_text()) != json.loads(
        (state_run / "input_manifest.json").read_text()
    ):
        raise ValueError("evaluation manifest mismatch")

    state_df = load_state_full(state_run / "state_sequence.csv.gz")
    if state_content_hash(state_df.state) != EXPECTED_STATE_CONTENT:
        raise ValueError("state content hash changed")

    samples, sample_censor = enumerate_action_samples(
        f, state_df, SPLIT_MS, ms(RAW_END)
    )
    X, _ = design_matrix(samples, artifact["scaler"])
    y = np.asarray([r["target_c1"] for r in samples], dtype=float)
    p_primary = np.asarray(artifact["primary"].predict(X), dtype=float)
    p_ridge = np.asarray(artifact["ridge"].predict(X), dtype=float)

    diag = {
        "primary": regression_metrics(y, p_primary),
        "ridge": regression_metrics(y, p_ridge),
        "by_state_action": {},
    }
    groups = {}
    for j, r in enumerate(samples):
        key = f'{r["state"]}:{r["direction"]}'
        groups.setdefault(key, []).append(j)
    for key, idx in sorted(groups.items()):
        ix = np.asarray(idx, dtype=int)
        diag["by_state_action"][key] = {
            "primary": regression_metrics(y[ix], p_primary[ix]),
            "ridge": regression_metrics(y[ix], p_ridge[ix]),
        }

    eval_rows = []
    for r, pp, pr in zip(samples, p_primary, p_ridge):
        eval_rows.append({
            "signal_time": r["signal_time"],
            "state": r["state"],
            "direction": r["direction"],
            "actual_c1": r["target_c1"],
            "pred_primary": float(pp),
            "pred_ridge": float(pr),
            "outcome_reason": r["outcome_reason"],
            "exit_time": r["exit_time"],
        })
    write_jsonl(out / "evaluation_action_samples.jsonl", eval_rows)

    learned_report, learned_trades, learned_decisions = simulate_policy(
        "learned", f, state_df, artifact
    )
    symbolic_report, symbolic_trades, symbolic_decisions = simulate_policy(
        "symbolic", f, state_df, None
    )
    write_jsonl(out / "learned_trades.jsonl", learned_trades)
    write_jsonl(out / "learned_decisions.jsonl", learned_decisions)
    write_jsonl(out / "symbolic_trades.jsonl", symbolic_trades)

    lo = learned_report["overall"]
    so = symbolic_report["overall"]
    years_positive = sum(
        1 for y0 in ("2021", "2022", "2023")
        if learned_report["by_year"].get(y0, {}).get("n", 0) >= 20
        and learned_report["by_year"][y0].get("c1_mean_per_trade", -999) > 0
    )
    screen = {
        "evaluation_action_candidates_ge_1000": len(samples) >= 1000,
        "prediction_correlation_gt_0_10": (
            diag["primary"]["correlation"] is not None
            and diag["primary"]["correlation"] > 0.10
        ),
        "positive_sign_accuracy_gt_0_55": diag["primary"]["positive_sign_accuracy"] > 0.55,
        "completed_trades_ge_150": lo.get("n", 0) >= 150,
        "long_trades_ge_50": lo.get("long_n", 0) >= 50,
        "short_trades_ge_50": lo.get("short_n", 0) >= 50,
        "c0_positive": lo.get("c0_mean_per_trade", -999) > 0,
        "c1_positive": lo.get("c1_mean_per_trade", -999) > 0,
        "c2_nonnegative": lo.get("c2_mean_per_trade", -999) >= 0,
        "c1_win_gt_0_50": lo.get("c1_win_rate", 0) > 0.50,
        "c1_mean_trade_beats_symbolic": (
            lo.get("c1_mean_per_trade", -999) > so.get("c1_mean_per_trade", -999)
        ),
        "c1_opportunity_beats_symbolic": (
            lo.get("c1_mean_per_opportunity", -999) > so.get("c1_mean_per_opportunity", -999)
        ),
        "two_full_years_positive_c1": years_positive >= 2,
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Joint State + Strategy Learning v0.1 Train-development diagnostic",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "evaluation_action_candidates": int(len(samples)),
        "evaluation_sample_censor": sample_censor,
        "model_diagnostics": diag,
        "learned_policy": learned_report,
        "symbolic_always_baseline": symbolic_report,
        "registered_screen": screen,
        "integrity": {
            "frozen_model_hash_unchanged": "PASS",
            "training_samples_hash_unchanged": "PASS",
            "state_file_hash_unchanged": "PASS",
            "state_content_hash_unchanged": "PASS",
            "source_manifest_unchanged": "PASS",
            "feature_order_frozen": "PASS",
            "horizon_exact_4": "PASS",
            "utility_threshold_exact_0": "PASS",
            "symbolic_constraints_enforced": "PASS",
            "transition_forced_flat": "PASS",
            "one_active_trade": "PASS",
            "no_hard_gap_bridge": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "evidence_status": "TEMPORALLY_SEPARATED_TRAIN_DEVELOPMENT_NOT_INDEPENDENT_CONFIRMATION",
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "model": diag["primary"],
        "learned": lo,
        "symbolic": so,
        "screen": screen,
    }, indent=2), flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("fit", "evaluate"):
        p = sub.add_parser(name)
        p.add_argument("--root", required=True)
        p.add_argument("--state-run", required=True)
        p.add_argument("--out", required=True)
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
