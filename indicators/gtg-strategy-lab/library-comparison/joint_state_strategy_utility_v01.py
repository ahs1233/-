"""GTG Joint State + Strategy Utility v0.1.

Neuro-symbolic action-utility policy:
- frozen State Engine constrains permitted actions
- fixed HistGradientBoostingRegressor predicts C1 utility per permitted action
- fit pre-2021, freeze, then evaluate 2021-2024
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import pickle
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

HERE = Path(__file__).resolve().parent

from compare import costs
from multiscale_symbolic_v01 import ms
from pre_transition_guard_v01 import session_name
from regime_atlas_v01 import load_h1
from state_transition_engine_v02 import MAX_CONTIG_GAP

PROTOCOL = HERE / "PROTOCOL_JOINT_STATE_STRATEGY_UTILITY_V0_1.md"

SPLIT = "2021-01-01"
SPLIT_MS = ms(SPLIT)
RAW_END = "2024-03-20"
RAW_END_MS = ms(RAW_END)

EXPECTED_STATE_FILE = "cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772"
EXPECTED_STATE_CONTENT = "c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e"
EXPECTED_MANIFEST = "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"

ACTIONS = ("RANGE_LONG", "RANGE_SHORT", "TREND_LONG", "TREND_SHORT")
ACTION_SPEC = {
    "RANGE_LONG": ("RANGE", 1, 4),
    "RANGE_SHORT": ("RANGE", -1, 4),
    "TREND_LONG": ("TREND_UP", 1, 12),
    "TREND_SHORT": ("TREND_DOWN", -1, 12),
}
SESSIONS = ("Asia", "London", "NewYork", "Late")

STATE_COLUMNS = (
    "t", "state", "atr",
    "dc0p5_dir", "dc1p0_dir", "dc2p0_dir", "dc4p0_dir",
    "dc_up_count", "dc_down_count",
    "drift12", "drift24", "drift48",
    "efficiency24", "efficiency48",
    "spread_atr", "atr_week_ratio",
    "prior24_upper", "prior24_lower", "prior24_width_atr", "position24",
    "breakout_up_atr", "breakout_down_atr", "range_votes",
)

FEATURE_NAMES = (
    "position24",
    "prior24_width_atr",
    "drift12",
    "drift24",
    "drift48",
    "efficiency24",
    "efficiency48",
    "dc0p5_dir",
    "dc1p0_dir",
    "dc2p0_dir",
    "dc4p0_dir",
    "dc_up_count",
    "dc_down_count",
    "spread_atr",
    "atr_week_ratio",
    "breakout_up_atr",
    "breakout_down_atr",
    "range_votes",
    "log_state_age",
    "candle_body_atr",
    "upper_wick_atr",
    "lower_wick_atr",
) + tuple("session_" + s for s in SESSIONS)

MODEL_PARAMS = {
    "loss": "squared_error",
    "learning_rate": 0.05,
    "max_iter": 150,
    "max_leaf_nodes": 15,
    "min_samples_leaf": 30,
    "l2_regularization": 1.0,
    "early_stopping": False,
    "random_state": 20261003,
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def state_content_hash(s: pd.Series) -> str:
    vals = ["" if pd.isna(x) else str(x) for x in s]
    return hashlib.sha256(("\n".join(vals)).encode()).hexdigest()


def gap_ok(a: int, b: int) -> bool:
    d = int(b) - int(a)
    return 0 < d <= MAX_CONTIG_GAP


def row_dict_from_csv(raw: dict) -> dict:
    out = {}
    for k in STATE_COLUMNS:
        if k == "state":
            out[k] = str(raw[k])
        elif k == "t":
            out[k] = int(float(raw[k]))
        else:
            v = raw[k]
            out[k] = float(v) if v not in ("", None) else float("nan")
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
        raise ValueError(f"state sequence missing {sorted(missing)}")
    df = df.loc[:, STATE_COLUMNS].copy()
    for k in STATE_COLUMNS:
        if k != "state":
            df[k] = pd.to_numeric(df[k], errors="raise")
    return df


def state_map(df: pd.DataFrame) -> dict[int, dict]:
    return {
        int(r["t"]): {k: r[k] for k in STATE_COLUMNS if k != "t"}
        for r in df.to_dict(orient="records")
    }


def state_age_map(f: pd.DataFrame, smap: dict[int, dict]) -> dict[int, int]:
    out = {}
    age = 0
    prev_t = None
    prev_state = None
    for ti in f.t.to_numpy(dtype=np.int64):
        t = int(ti)
        sr = smap.get(t)
        state = None if sr is None else str(sr["state"])
        continuous = (
            prev_t is not None
            and gap_ok(prev_t, t)
            and state is not None
            and state == prev_state
        )
        if state is None:
            age = 0
        else:
            age = age + 1 if continuous else 1
        out[t] = age
        prev_t = t
        prev_state = state
    return out


def permitted_actions(state: str) -> tuple[str, ...]:
    if state == "RANGE":
        return ("RANGE_LONG", "RANGE_SHORT")
    if state == "TREND_UP":
        return ("TREND_LONG",)
    if state == "TREND_DOWN":
        return ("TREND_SHORT",)
    if state == "TRANSITION":
        return ()
    if state is None or str(state).strip() == "" or str(state).lower() == "nan":
        return ()
    raise ValueError(f"unknown state {state}")


def feature_vector(
    i: int,
    f: pd.DataFrame,
    sr: dict,
    state_age: int,
) -> np.ndarray:
    atr = float(sr["atr"])
    if not np.isfinite(atr) or atr <= 0:
        raise ValueError("bad ATR")
    o = float(f.bo.iloc[i])
    h = float(f.bh.iloc[i])
    l = float(f.bl.iloc[i])
    c = float(f.bc.iloc[i])
    body = (c - o) / atr
    upper_wick = (h - max(o, c)) / atr
    lower_wick = (min(o, c) - l) / atr
    sess = session_name(int(f.t.iloc[i]))
    onehot = [1.0 if sess == s else 0.0 for s in SESSIONS]
    vals = [
        float(sr["position24"]),
        float(sr["prior24_width_atr"]),
        float(sr["drift12"]),
        float(sr["drift24"]),
        float(sr["drift48"]),
        float(sr["efficiency24"]),
        float(sr["efficiency48"]),
        float(sr["dc0p5_dir"]),
        float(sr["dc1p0_dir"]),
        float(sr["dc2p0_dir"]),
        float(sr["dc4p0_dir"]),
        float(sr["dc_up_count"]),
        float(sr["dc_down_count"]),
        float(sr["spread_atr"]),
        float(sr["atr_week_ratio"]),
        float(sr["breakout_up_atr"]),
        float(sr["breakout_down_atr"]),
        float(sr["range_votes"]),
        math.log1p(max(0, int(state_age))),
        float(body),
        float(upper_wick),
        float(lower_wick),
        *onehot,
    ]
    x = np.asarray(vals, dtype=float)
    if x.shape[0] != len(FEATURE_NAMES):
        raise AssertionError((x.shape[0], len(FEATURE_NAMES)))
    if not np.all(np.isfinite(x)):
        raise ValueError("nonfinite feature")
    return x


def action_outcome(
    action: str,
    i: int,
    f: pd.DataFrame,
    smap: dict[int, dict],
    split_end: int,
) -> dict:
    required_state, direction, horizon = ACTION_SPEC[action]
    t = f.t.to_numpy(dtype=np.int64)
    sr0 = smap.get(int(t[i]))
    if sr0 is None or str(sr0["state"]) != required_state:
        return {"mature": False, "reason": "STATE_MISMATCH"}
    atr = float(sr0["atr"])
    if not np.isfinite(atr) or atr <= 0:
        return {"mature": False, "reason": "BAD_ATR"}

    entry = i + 1
    if entry >= len(f) or int(t[entry]) >= split_end:
        return {"mature": False, "reason": "SPLIT_END"}
    if not gap_ok(t[i], t[entry]):
        return {"mature": False, "reason": "ENTRY_HARD_GAP"}

    # Check state on bars t+1 ... t+H. If it stops permitting
    # the action, exit next open. Otherwise the fixed horizon signal
    # is close(t+H) and execution is open(t+H+1), per protocol.
    exit_kind = "HORIZON"
    exit_signal_i = i + horizon
    if exit_signal_i >= len(f) or int(t[exit_signal_i]) >= split_end:
        return {"mature": False, "reason": "SPLIT_END"}

    prev = i
    for k in range(entry, exit_signal_i + 1):
        if int(t[k]) >= split_end:
            return {"mature": False, "reason": "SPLIT_END"}
        if not gap_ok(t[prev], t[k]):
            return {"mature": False, "reason": "HARD_GAP"}
        prev = k
        sr = smap.get(int(t[k]))
        if sr is None:
            return {"mature": False, "reason": "MISSING_STATE"}
        if str(sr["state"]) != required_state:
            exit_signal_i = k
            exit_kind = "STATE_EXIT"
            break

    exit_i = exit_signal_i + 1
    if exit_i >= len(f) or int(t[exit_i]) >= split_end:
        return {"mature": False, "reason": "SPLIT_END"}
    if not gap_ok(t[exit_signal_i], t[exit_i]):
        return {"mature": False, "reason": "HARD_GAP"}
    cc = costs(
        direction,
        float(f.bo.iloc[entry]),
        float(f.ao.iloc[entry]),
        float(f.bo.iloc[exit_i]),
        float(f.ao.iloc[exit_i]),
        atr,
    )
    exit_time = int(t[exit_i])
    exit_idx = int(exit_i)
    duration = int(exit_signal_i - i)

    return {
        "mature": True,
        "action": action,
        "required_state": required_state,
        "direction": int(direction),
        "horizon": int(horizon),
        "entry_idx": int(entry),
        "exit_signal_idx": int(exit_signal_i),
        "exit_idx": int(exit_idx),
        "entry_time": int(t[entry]),
        "exit_time": int(exit_time),
        "exit_kind": exit_kind,
        "duration_bars": duration,
        "c0": float(cc["c0"]),
        "c1": float(cc["c1"]),
        "c2": float(cc["c2"]),
    }


def enumerate_action_samples(
    f: pd.DataFrame,
    state_df: pd.DataFrame,
    start_ms: int,
    end_ms: int,
) -> tuple[dict[str, list[dict]], dict]:
    smap = state_map(state_df)
    ages = state_age_map(f, smap)
    by_action = {a: [] for a in ACTIONS}
    censor = Counter()
    t = f.t.to_numpy(dtype=np.int64)

    for i in range(len(f)):
        ti = int(t[i])
        if not (start_ms <= ti < end_ms):
            continue
        sr = smap.get(ti)
        if sr is None:
            continue
        state = str(sr["state"])
        acts = permitted_actions(state)
        if not acts:
            continue
        try:
            x = feature_vector(i, f, sr, ages.get(ti, 0))
        except ValueError:
            censor["BAD_FEATURE"] += 1
            continue
        for action in acts:
            out = action_outcome(action, i, f, smap, end_ms)
            if not out["mature"]:
                censor[f"{action}:{out['reason']}"] += 1
                continue
            by_action[action].append({
                "decision_time": ti,
                "state": state,
                "action": action,
                "features": x.tolist(),
                "c1_target": float(out["c1"]),
                "c0": float(out["c0"]),
                "c2": float(out["c2"]),
                "exit_kind": out["exit_kind"],
                "duration_bars": int(out["duration_bars"]),
            })
    return by_action, dict(censor)


def save_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")


def fit_models(samples: dict[str, list[dict]]) -> dict[str, HistGradientBoostingRegressor]:
    models = {}
    for action in ACTIONS:
        rows = samples[action]
        if len(rows) < 100:
            raise ValueError(f"too few training rows for {action}: {len(rows)}")
        X = np.asarray([r["features"] for r in rows], dtype=float)
        y = np.asarray([r["c1_target"] for r in rows], dtype=float)
        m = HistGradientBoostingRegressor(**MODEL_PARAMS)
        m.fit(X, y)
        models[action] = m
    return models


def model_bundle_metadata(samples: dict[str, list[dict]]) -> dict:
    return {
        "feature_names": list(FEATURE_NAMES),
        "actions": list(ACTIONS),
        "action_spec": {
            k: {"required_state": v[0], "direction": v[1], "horizon": v[2]}
            for k, v in ACTION_SPEC.items()
        },
        "params": MODEL_PARAMS,
        "threshold": 0.0,
        "training_counts": {k: len(v) for k, v in samples.items()},
    }


def load_models(path: Path):
    with path.open("rb") as fh:
        obj = pickle.load(fh)
    if obj["feature_names"] != list(FEATURE_NAMES):
        raise ValueError("feature order mismatch")
    if obj["params"] != MODEL_PARAMS:
        raise ValueError("model params mismatch")
    return obj


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
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    state = load_state_prefix(state_path, SPLIT_MS)
    # State content hash of the full file was already verified by file SHA;
    # fit intentionally reads only the prefix.
    f, quality = load_h1(root, SPLIT, out / "input_manifest_fit.json")
    if int(f.t.max()) >= SPLIT_MS:
        raise ValueError("fit H1 crosses split")

    samples, censor = enumerate_action_samples(f, state, 0, SPLIT_MS)
    models = fit_models(samples)

    for action, rows in samples.items():
        save_jsonl(out / f"training_{action.lower()}.jsonl", rows)

    bundle = {
        **model_bundle_metadata(samples),
        "models": models,
    }
    with (out / "frozen_models.pkl").open("wb") as fh:
        pickle.dump(bundle, fh, protocol=pickle.HIGHEST_PROTOCOL)

    training_hashes = {
        action: sha(out / f"training_{action.lower()}.jsonl")
        for action in ACTIONS
    }
    freeze = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "evaluation_opened": False,
        "split_ms": SPLIT_MS,
        "frozen_models_sha256": sha(out / "frozen_models.pkl"),
        "training_hashes": training_hashes,
        "feature_names": list(FEATURE_NAMES),
        "training_counts": {k: len(v) for k, v in samples.items()},
        "censor": censor,
        "quality": quality,
        "validation_read": False,
        "holdout_read": False,
    }
    (out / "freeze.json").write_text(
        json.dumps(freeze, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "training_counts": freeze["training_counts"],
        "censor": censor,
        "freeze": {
            "evaluation_opened": False,
            "frozen_models_sha256": freeze["frozen_models_sha256"],
        },
    }, indent=2), flush=True)


def verify_freeze(out: Path) -> dict:
    freeze = json.loads((out / "freeze.json").read_text(encoding="utf-8"))
    if sha(out / "frozen_models.pkl") != freeze["frozen_models_sha256"]:
        raise ValueError("frozen model hash changed")
    for action in ACTIONS:
        p = out / f"training_{action.lower()}.jsonl"
        if sha(p) != freeze["training_hashes"][action]:
            raise ValueError(f"training hash changed {action}")
    return freeze


def open_evaluation_command(a):
    out = Path(a.out)
    freeze = verify_freeze(out)
    if freeze.get("evaluation_opened"):
        raise ValueError("evaluation already opened")
    freeze["evaluation_opened"] = True
    freeze["evaluation_opened_utc"] = datetime.now(timezone.utc).isoformat()
    (out / "freeze.json").write_text(
        json.dumps(freeze, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "evaluation_opened": True,
        "evaluation_opened_utc": freeze["evaluation_opened_utc"],
        "frozen_models_sha256": freeze["frozen_models_sha256"],
    }, indent=2), flush=True)


def regression_metrics(y: np.ndarray, p: np.ndarray) -> dict:
    if len(y) == 0:
        return {"n": 0}
    corr = None
    if len(y) >= 2 and np.std(y) > 0 and np.std(p) > 0:
        corr = float(np.corrcoef(y, p)[0, 1])
    return {
        "n": int(len(y)),
        "target_mean_c1": float(np.mean(y)),
        "target_median_c1": float(np.median(y)),
        "prediction_mean": float(np.mean(p)),
        "mae": float(mean_absolute_error(y, p)),
        "rmse": float(math.sqrt(mean_squared_error(y, p))),
        "pearson_corr": corr,
        "c1_positive_sign_accuracy": float(np.mean((p > 0) == (y > 0))),
        "predicted_positive_fraction": float(np.mean(p > 0)),
        "realized_mean_c1_predicted_positive": (
            float(np.mean(y[p > 0])) if np.any(p > 0) else None
        ),
        "realized_c1_win_predicted_positive": (
            float(np.mean(y[p > 0] > 0)) if np.any(p > 0) else None
        ),
    }


def predict_action(models, action: str, x: np.ndarray) -> float:
    return float(models[action].predict(np.asarray(x, dtype=float).reshape(1, -1))[0])


def policy_trade_record(
    action: str,
    i: int,
    f: pd.DataFrame,
    smap: dict[int, dict],
    split_end: int,
) -> dict:
    return action_outcome(action, i, f, smap, split_end)


def summarize_trades(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    return {
        "n": int(len(rows)),
        "long_n": int(sum(r["direction"] == 1 for r in rows)),
        "short_n": int(sum(r["direction"] == -1 for r in rows)),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
        "c1_win_rate": float(np.mean([r["c1"] > 0 for r in rows])),
        "c1_total": float(np.sum([r["c1"] for r in rows])),
        "duration_median_bars": float(np.median([r["duration_bars"] for r in rows])),
        "duration_mean_bars": float(np.mean([r["duration_bars"] for r in rows])),
        "exit_kind_counts": dict(Counter(r["exit_kind"] for r in rows)),
        "entry_state_counts": dict(Counter(r["entry_state"] for r in rows)),
    }


def simulate_policy(
    mode: str,
    f: pd.DataFrame,
    state_df: pd.DataFrame,
    models: dict[str, HistGradientBoostingRegressor],
    start_ms: int,
    end_ms: int,
) -> tuple[list[dict], list[dict], dict]:
    smap = state_map(state_df)
    ages = state_age_map(f, smap)
    t = f.t.to_numpy(dtype=np.int64)
    start_i = int(np.searchsorted(t, start_ms, side="left"))
    end_i = int(np.searchsorted(t, end_ms, side="left"))
    i = start_i
    trades = []
    decisions = []
    counters = Counter()

    while i < end_i:
        ti = int(t[i])
        sr = smap.get(ti)
        if sr is None:
            i += 1
            continue
        state = str(sr["state"])
        counters[f"opportunity_{state}"] += 1
        counters["decision_opportunities"] += 1

        acts = permitted_actions(state)
        chosen = None
        preds = {}
        try:
            x = feature_vector(i, f, sr, ages.get(ti, 0))
        except ValueError:
            counters["bad_feature"] += 1
            i += 1
            continue

        if mode == "learned":
            for action in acts:
                preds[action] = predict_action(models, action, x)
            if preds:
                best_action = max(preds, key=lambda a: preds[a])
                best_value = preds[best_action]
                if best_value > 0:
                    chosen = best_action
        elif mode == "trend_always":
            if state == "TREND_UP":
                chosen = "TREND_LONG"
            elif state == "TREND_DOWN":
                chosen = "TREND_SHORT"
        else:
            raise ValueError(mode)

        decisions.append({
            "decision_time": ti,
            "year": int(pd.to_datetime(ti, unit="ms", utc=True).year),
            "state": state,
            "mode": mode,
            "predictions": preds,
            "chosen_action": chosen or "FLAT",
        })

        if chosen is None:
            counters["flat_decisions"] += 1
            i += 1
            continue

        out = policy_trade_record(chosen, i, f, smap, end_ms)
        if not out["mature"]:
            counters[f"censored_{out['reason']}"] += 1
            i += 1
            continue

        rec = {
            **out,
            "decision_time": ti,
            "entry_state": state,
            "year": int(pd.to_datetime(ti, unit="ms", utc=True).year),
            "predicted_c1": preds.get(chosen) if mode == "learned" else None,
        }
        trades.append(rec)
        counters["trades"] += 1
        counters[f"trade_{state}"] += 1

        # Position exits at the open of exit_idx. We can make the next
        # decision at that same bar's close, so resume at exit_idx.
        i = max(i + 1, int(out["exit_idx"]))

    return trades, decisions, dict(counters)


def by_year_summary(trades: list[dict]) -> dict:
    out = {}
    for y in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == y]
        out[str(y)] = summarize_trades(rr) if len(rr) >= 30 else {"n": len(rr)}
    return out


def by_branch_summary(trades: list[dict]) -> dict:
    return {
        "RANGE": summarize_trades([r for r in trades if r["entry_state"] == "RANGE"]),
        "TREND": summarize_trades([
            r for r in trades if r["entry_state"] in ("TREND_UP", "TREND_DOWN")
        ]),
    }


def evaluate_command(a):
    root = Path(a.root)
    state_run = Path(a.state_run)
    out = Path(a.out)

    freeze = verify_freeze(out)
    if not freeze.get("evaluation_opened"):
        raise ValueError("evaluation not opened")

    state_path = state_run / "state_sequence.csv.gz"
    if sha(state_path) != EXPECTED_STATE_FILE:
        raise ValueError("state file hash changed")
    if sha(state_run / "input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("state manifest hash changed")
    full_state = load_state_full(state_path)
    if state_content_hash(full_state.state) != EXPECTED_STATE_CONTENT:
        raise ValueError("state content hash changed")

    with (out / "environment_evaluate.json").open("w", encoding="utf-8") as fh:
        json.dump({
            "python": sys.version,
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "frozen_models_sha256": freeze["frozen_models_sha256"],
            "validation_read": False,
            "holdout_read": False,
        }, fh, indent=2)

    f, quality = load_h1(root, RAW_END, out / "input_manifest_evaluate.json")
    if json.loads((out / "input_manifest_evaluate.json").read_text()) != json.loads(
        (state_run / "input_manifest.json").read_text()
    ):
        raise ValueError("canonical manifest mismatch")

    bundle = load_models(out / "frozen_models.pkl")
    models = bundle["models"]

    eval_samples, eval_censor = enumerate_action_samples(
        f, full_state, SPLIT_MS, RAW_END_MS
    )

    model_diag = {}
    prediction_rows = []
    for action in ACTIONS:
        rows = eval_samples[action]
        X = np.asarray([r["features"] for r in rows], dtype=float)
        y = np.asarray([r["c1_target"] for r in rows], dtype=float)
        p = models[action].predict(X) if len(rows) else np.asarray([], dtype=float)
        model_diag[action] = regression_metrics(y, p)
        for r, pred in zip(rows, p):
            prediction_rows.append({
                "decision_time": r["decision_time"],
                "state": r["state"],
                "action": action,
                "predicted_c1": float(pred),
                "realized_c1": float(r["c1_target"]),
                "exit_kind": r["exit_kind"],
                "duration_bars": r["duration_bars"],
            })
    save_jsonl(out / "evaluation_action_predictions.jsonl", prediction_rows)

    learned_trades, learned_decisions, learned_counts = simulate_policy(
        "learned", f, full_state, models, SPLIT_MS, RAW_END_MS
    )
    baseline_trades, baseline_decisions, baseline_counts = simulate_policy(
        "trend_always", f, full_state, models, SPLIT_MS, RAW_END_MS
    )
    save_jsonl(out / "learned_policy_trades.jsonl", learned_trades)
    save_jsonl(out / "learned_policy_decisions.jsonl", learned_decisions)
    save_jsonl(out / "trend_always_trades.jsonl", baseline_trades)

    learned = summarize_trades(learned_trades)
    baseline = summarize_trades(baseline_trades)
    learned_opps = learned_counts.get("decision_opportunities", 0)
    baseline_opps = baseline_counts.get("decision_opportunities", 0)
    learned["c1_mean_per_decision_opportunity"] = (
        learned.get("c1_total", 0.0) / learned_opps if learned_opps else None
    )
    baseline["c1_mean_per_decision_opportunity"] = (
        baseline.get("c1_total", 0.0) / baseline_opps if baseline_opps else None
    )

    by_branch = by_branch_summary(learned_trades)
    by_year = by_year_summary(learned_trades)
    positive_full_years = sum(
        1 for y in ("2021", "2022", "2023")
        if by_year.get(y, {}).get("n", 0) >= 30
        and by_year[y].get("c1_mean_per_trade", -999) > 0
    )

    model_eval_counts = [model_diag[a].get("n", 0) for a in ACTIONS]
    # Primary development screen from the learning protocol:
    # use aggregate candidate diagnostics in addition to action-specific detail.
    all_y = np.asarray(
        [r["realized_c1"] for r in prediction_rows], dtype=float
    )
    all_p = np.asarray(
        [r["predicted_c1"] for r in prediction_rows], dtype=float
    )
    aggregate_corr = None
    if len(all_y) >= 2 and np.std(all_y) > 0 and np.std(all_p) > 0:
        aggregate_corr = float(np.corrcoef(all_y, all_p)[0, 1])
    aggregate_sign = (
        float(np.mean((all_p > 0) == (all_y > 0))) if len(all_y) else None
    )

    screen = {
        "each_training_model_ge_1000": all(
            freeze["training_counts"][a] >= 1000 for a in ACTIONS
        ),
        "each_evaluation_model_ge_1000": all(n >= 1000 for n in model_eval_counts),
        "evaluation_action_candidates_ge_1000": len(prediction_rows) >= 1000,
        "aggregate_corr_gt_0_10": (
            aggregate_corr is not None and aggregate_corr > 0.10
        ),
        "aggregate_sign_accuracy_gt_0_55": (
            aggregate_sign is not None and aggregate_sign > 0.55
        ),
        "sequential_trades_ge_150": learned.get("n", 0) >= 150,
        "range_trades_ge_50": by_branch["RANGE"].get("n", 0) >= 50,
        "trend_trades_ge_50": by_branch["TREND"].get("n", 0) >= 50,
        "long_trades_ge_50": learned.get("long_n", 0) >= 50,
        "short_trades_ge_50": learned.get("short_n", 0) >= 50,
        "overall_c1_positive": learned.get("c1_mean_per_trade", -999) > 0,
        "overall_c2_nonnegative": learned.get("c2_mean_per_trade", -999) >= 0,
        "overall_c1_win_gt_0_50": learned.get("c1_win_rate", 0) > 0.50,
        "range_branch_c1_positive": by_branch["RANGE"].get("c1_mean_per_trade", -999) > 0,
        "trend_branch_c1_positive": by_branch["TREND"].get("c1_mean_per_trade", -999) > 0,
        "two_full_years_positive_c1": positive_full_years >= 2,
        "policy_c1_better_than_trend_always": (
            learned.get("c1_mean_per_trade", -999)
            > baseline.get("c1_mean_per_trade", -999)
        ),
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Joint State + Strategy Utility v0.1 Train-development",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "threshold": 0.0,
        "training_counts": freeze["training_counts"],
        "evaluation_censor": eval_censor,
        "model_diagnostics": model_diag,
        "aggregate_model_diagnostics": {
            "n": int(len(all_y)),
            "pearson_corr": aggregate_corr,
            "c1_positive_sign_accuracy": aggregate_sign,
        },
        "learned_policy": {
            "counts": learned_counts,
            "overall": learned,
            "by_branch": by_branch,
            "by_direction": {
                "long": summarize_trades([r for r in learned_trades if r["direction"] == 1]),
                "short": summarize_trades([r for r in learned_trades if r["direction"] == -1]),
            },
            "by_year": by_year,
        },
        "trend_always_baseline": {
            "counts": baseline_counts,
            "overall": baseline,
            "by_year": by_year_summary(baseline_trades),
        },
        "registered_screen": screen,
        "integrity": {
            "frozen_models_hash_unchanged": "PASS",
            "training_hashes_unchanged": "PASS",
            "state_file_hash_unchanged": "PASS",
            "state_content_hash_unchanged": "PASS",
            "source_manifest_unchanged": "PASS",
            "feature_order_frozen": "PASS",
            "threshold_0_0": "PASS",
            "symbolic_action_constraints": "PASS",
            "transition_forced_flat": "PASS",
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
        "training_counts": freeze["training_counts"],
        "model_diag": model_diag,
        "aggregate": report["aggregate_model_diagnostics"],
        "learned": learned,
        "by_branch": by_branch,
        "baseline": baseline,
        "screen": screen,
    }, indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("fit")
    p.add_argument("--root", required=True)
    p.add_argument("--state-run", required=True)
    p.add_argument("--out", required=True)

    p = sub.add_parser("open-evaluation")
    p.add_argument("--out", required=True)

    p = sub.add_parser("evaluate")
    p.add_argument("--root", required=True)
    p.add_argument("--state-run", required=True)
    p.add_argument("--out", required=True)

    a = ap.parse_args()
    if a.cmd == "fit":
        fit_command(a)
    elif a.cmd == "open-evaluation":
        open_evaluation_command(a)
    elif a.cmd == "evaluate":
        evaluate_command(a)


if __name__ == "__main__":
    main()
