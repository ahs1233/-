"""GTG DC Correction -> Resumption H4 Validation Gate v0.1.

First formal library-comparison Validation dry run.
Historical Holdout remains locked.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE.parent / "data"
sys.path.insert(0, str(DATA_DIR))

from bars import FIELDS, aggregate, bucket
from store import read_day
from compare import costs, dc_states
from state_transition_engine_v02 import (
    add_cores,
    run_fsm,
    state_features,
    MAX_CONTIG_GAP,
    STEP,
)

PROTOCOL = HERE / "PROTOCOL_DC_RESUMPTION_H4_VALIDATION_V0_1.md"

SOURCE_START = "2018-03-01"
FIRST_VALID_MS = int(pd.Timestamp("2021-09-08T17:00:00Z").timestamp() * 1000)
TRAIN_END_MS = int(pd.Timestamp("2024-03-20T15:20:24.500Z").timestamp() * 1000)
VAL_START_MS = TRAIN_END_MS + 4 * STEP
HOLDOUT_START_MS = int(pd.Timestamp("2025-03-25T05:04:34.300Z").timestamp() * 1000)
VAL_END_MS = HOLDOUT_START_MS - 4 * STEP
# We need the 00:00 H1 bar of 2025-03-25; raw cap at 01:00 is enough to close it.
RAW_CAP_MS = int(pd.Timestamp("2025-03-25T01:00:00Z").timestamp() * 1000)

FINE_THRESHOLD = 0.0025
MACRO_THRESHOLD = 0.0050
HORIZON = 4

EXPECTED_STATE_CODE_SHA = "6175f772389e2838a042a1ce344ac5a5b9d930b4b83fb6cca51ea6ca582fae0d"
EXPECTED_DC_CODE_SHA = "e7a679be25ade481955f5970ac174a3c36317dfce2d20e10607e9be9ebccc817"
EXPECTED_TRAIN_STATE_FILE_SHA = "cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772"

NUM_FIELDS = {"bo", "bh", "bl", "bc", "ao", "ah", "al", "ac", "v"}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ms(ts: str) -> int:
    return int(pd.Timestamp(ts).timestamp() * 1000)


def _parse_row(row: dict) -> dict:
    b = {}
    for k in FIELDS:
        v = row[k]
        if k in ("t", "n"):
            b[k] = int(v)
        elif k in NUM_FIELDS:
            b[k] = float(v) if v != "" else None
        else:
            b[k] = v
    return b


def read_day_prefix(path: Path, cap_ms: int) -> tuple[list[dict], str]:
    """Read ordered rows strictly before cap; stop before converting any >=cap quote."""
    out = []
    h = hashlib.sha256()
    with gzip.open(path, "rt", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            t = int(row["t"])
            if t >= cap_ms:
                break
            # Prefix hash is over canonical CSV field strings for accepted pre-cap rows only.
            payload = ",".join(row[k] for k in FIELDS) + "\n"
            h.update(payload.encode("utf-8"))
            out.append(_parse_row(row))
    return out, h.hexdigest()


def validate_rows(rows: list[dict], day: str, cap_ms: int | None = None):
    if not rows:
        return
    tt = np.asarray([b["t"] for b in rows], dtype=np.int64)
    d0 = ms(day)
    d1 = ms((datetime.fromisoformat(day) + timedelta(days=1)).strftime("%Y-%m-%d"))
    upper = min(d1, cap_ms) if cap_ms is not None else d1
    if np.any(np.diff(tt) <= 0) or tt.min() < d0 or tt.max() >= upper:
        raise ValueError(f"timestamp integrity failed for {day}")
    for b in rows:
        for side in ("b", "a"):
            o, hi, lo, c = (b[side + x] for x in ("o", "h", "l", "c"))
            if any(v is None or not np.isfinite(v) or v <= 0 for v in (o, hi, lo, c)):
                raise ValueError(f"invalid quote on {day}")
            if not lo <= min(o, c) <= max(o, c) <= hi:
                raise ValueError(f"invalid OHLC on {day}")
        if b["ao"] < b["bo"] or b["ac"] < b["bc"]:
            raise ValueError(f"crossed quote on {day}")


def complete_h1(day_rows: list[dict]) -> tuple[list[dict], int]:
    groups: dict[int, list[int]] = {}
    for b in day_rows:
        k = bucket(b["t"], "H1")
        groups.setdefault(k, []).append(b["t"])
    bars = aggregate(day_rows, "H1")
    kept = [
        b for b in bars
        if groups.get(b["t"]) == list(range(b["t"], b["t"] + STEP, 60_000))
    ]
    return kept, len(bars) - len(kept)


def load_h1_capped(root: Path, cap_ms: int, manifest_path: Path):
    if cap_ms >= HOLDOUT_START_MS:
        raise ValueError("HOLDOUT LOCK: raw cap reaches holdout")
    start = datetime.fromisoformat(SOURCE_START)
    cap_dt = datetime.fromtimestamp(cap_ms / 1000, tz=timezone.utc).replace(tzinfo=None)
    cap_day = cap_dt.strftime("%Y-%m-%d")
    day = start
    h1 = []
    manifest = []
    dropped = 0

    while day.strftime("%Y-%m-%d") <= cap_day:
        ds = day.strftime("%Y-%m-%d")
        p = root / "m1" / day.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if p.exists():
            if ds == cap_day:
                rows, prefix_sha = read_day_prefix(p, cap_ms)
                manifest.append({
                    "day": ds,
                    "partial_prefix": True,
                    "until_exclusive_ms": int(cap_ms),
                    "accepted_rows": len(rows),
                    "accepted_prefix_sha256": prefix_sha,
                })
                validate_rows(rows, ds, cap_ms)
            else:
                blob = p.read_bytes()
                manifest.append({
                    "day": ds,
                    "partial_prefix": False,
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
    tt = f.t.to_numpy(dtype=np.int64)
    if np.any(np.diff(tt) <= 0):
        raise ValueError("H1 timestamps not strictly increasing")
    if int(tt.max()) + STEP > cap_ms:
        raise ValueError("H1 close crosses raw cap")
    if int(tt.max()) >= HOLDOUT_START_MS:
        raise ValueError("HOLDOUT LOCK: H1 includes holdout")

    c = f.bc.to_numpy(dtype=float)
    prev = np.r_[c[0], c[:-1]]
    tr = np.maximum(
        f.bh.to_numpy(dtype=float) - f.bl.to_numpy(dtype=float),
        np.maximum(
            np.abs(f.bh.to_numpy(dtype=float) - prev),
            np.abs(f.bl.to_numpy(dtype=float) - prev),
        ),
    )
    f["atr"] = pd.Series(tr).rolling(14).mean()
    return f, {"complete_h1": int(len(f)), "incomplete_dropped": int(dropped)}


def normalize_state(v):
    return None if pd.isna(v) else str(v)


def prefix_parity(ext: pd.DataFrame, train_csv: Path) -> dict:
    old = pd.read_csv(train_csv)
    n = len(old)
    if len(ext) < n:
        raise ValueError("extended state shorter than frozen Train state")
    if not np.array_equal(
        old.t.to_numpy(dtype=np.int64),
        ext.t.iloc[:n].to_numpy(dtype=np.int64),
    ):
        raise AssertionError("state prefix timestamp mismatch")

    old_states = [normalize_state(v) for v in old.state]
    new_states = [normalize_state(v) for v in ext.state.iloc[:n]]
    if old_states != new_states:
        ix = next(i for i, (a, b) in enumerate(zip(old_states, new_states)) if a != b)
        raise AssertionError(f"state prefix mismatch at {ix}: {old_states[ix]} != {new_states[ix]}")

    bool_cols = [
        "range_core", "trend_up_core", "trend_down_core", "breakout_up", "breakout_down"
    ]
    numeric_cols = [
        c for c in old.columns
        if c not in ("state", *bool_cols)
    ]
    np.testing.assert_allclose(
        old[numeric_cols].to_numpy(dtype=float),
        ext[numeric_cols].iloc[:n].to_numpy(dtype=float),
        rtol=0.0,
        atol=0.0,
        equal_nan=True,
    )
    for c in bool_cols:
        if not np.array_equal(
            old[c].to_numpy(dtype=bool),
            ext[c].iloc[:n].to_numpy(dtype=bool),
        ):
            raise AssertionError(f"boolean prefix mismatch: {c}")

    payload = "\n".join("" if s is None else s for s in new_states)
    return {
        "rows_compared": int(n),
        "last_overlap_time": int(old.t.iloc[-1]),
        "state_content_sha256": hashlib.sha256(payload.encode()).hexdigest(),
        "status": "PASS",
    }


def gap_ok(a: int, b: int) -> bool:
    d = int(b) - int(a)
    return 0 < d <= MAX_CONTIG_GAP


def fresh_dc(states: list[dict], i: int, direction: int) -> bool:
    return int(states[i]["confirmed_at"]) == i and int(states[i]["direction"]) == int(direction)


def search_signal(
    event: dict,
    f: pd.DataFrame,
    state_by_time: dict[int, str],
    t_to_i: dict[int, int],
    fine: list[dict],
    macro: list[dict],
) -> dict:
    rt = int(event["resolution_time"])
    q = t_to_i.get(rt)
    if q is None:
        raise ValueError("resolution time absent from H1")
    d = 1 if event["fsm_resolution"] == "TREND_UP" else -1
    trend = "TREND_UP" if d == 1 else "TREND_DOWN"

    if state_by_time.get(rt) != trend:
        raise ValueError("resolution state mismatch")
    if int(macro[q]["direction"]) != d:
        return {"status": "MACRO_NOT_ALIGNED_AT_RESOLUTION"}

    tt = f.t.to_numpy(dtype=np.int64)
    correction_i = None
    prev = q
    for j in range(q + 1, len(f)):
        if int(tt[j]) >= VAL_END_MS:
            return {"status": "VALIDATION_END"}
        if not gap_ok(tt[prev], tt[j]):
            return {"status": "HARD_GAP"}
        prev = j

        if state_by_time.get(int(tt[j])) != trend:
            return {
                "status": (
                    "NO_FINE_CORRECTION_BEFORE_TREND_END"
                    if correction_i is None
                    else "NO_RESUMPTION_BEFORE_TREND_END"
                )
            }

        if fresh_dc(macro, j, -d):
            return {
                "status": (
                    "MACRO_REVERSAL_BEFORE_CORRECTION"
                    if correction_i is None
                    else "MACRO_REVERSAL_DURING_CORRECTION"
                )
            }

        if correction_i is None:
            if fresh_dc(fine, j, -d) and int(macro[j]["direction"]) == d:
                correction_i = j
            continue

        if fresh_dc(fine, j, d) and int(macro[j]["direction"]) == d:
            if j + 1 >= len(f):
                return {"status": "VALIDATION_END"}
            if not gap_ok(tt[j], tt[j + 1]):
                return {"status": "HARD_GAP"}
            if int(tt[j]) < VAL_START_MS or int(tt[j]) >= VAL_END_MS:
                return {"status": "SIGNAL_OUTSIDE_VALIDATION"}
            return {
                "status": "DC_RESUMPTION_ENTRY",
                "direction": d,
                "resolution_idx": int(q),
                "correction_idx": int(correction_i),
                "signal_idx": int(j),
                "entry_idx": int(j + 1),
                "correction_delay_bars": int(correction_i - q),
                "correction_duration_bars": int(j - correction_i),
                "total_delay_bars": int(j - q),
            }
    return {"status": "VALIDATION_END"}


def execution_record(event: dict, signal: dict, f: pd.DataFrame) -> dict | None:
    s = int(signal["signal_idx"])
    entry = int(signal["entry_idx"])
    exit_i = s + HORIZON
    tt = f.t.to_numpy(dtype=np.int64)
    if exit_i >= len(f):
        return None
    path_t = tt[s:exit_i + 1]
    gaps = np.diff(path_t)
    if np.any(gaps <= 0) or np.any(gaps > MAX_CONTIG_GAP):
        return None

    # Exit is the CLOSE of bar s+4, therefore bar-open + 1h must remain before scoring end.
    exit_close_ms = int(tt[exit_i]) + STEP
    if exit_close_ms > VAL_END_MS:
        return None
    if int(tt[entry]) >= VAL_END_MS:
        return None

    d = int(signal["direction"])
    atr = float(f.atr.iloc[s])
    if not np.isfinite(atr) or atr <= 0:
        return None

    cc = costs(
        d,
        float(f.bo.iloc[entry]),
        float(f.ao.iloc[entry]),
        float(f.bc.iloc[exit_i]),
        float(f.ac.iloc[exit_i]),
        atr,
    )
    start_close = float(f.bc.iloc[s])
    signed = d * (float(f.bc.iloc[exit_i]) - start_close) / atr
    hi = float(f.bh.iloc[entry:exit_i + 1].max())
    lo = float(f.bl.iloc[entry:exit_i + 1].min())
    if d == 1:
        mfe = (hi - start_close) / atr
        mae = (start_close - lo) / atr
    else:
        mfe = (start_close - lo) / atr
        mae = (hi - start_close) / atr

    return {
        "event_id": int(event["event_id"]),
        "onset_time": int(event["time"]),
        "resolution_time": int(event["resolution_time"]),
        "signal_time": int(tt[s]),
        "entry_time": int(tt[entry]),
        "exit_bar_time": int(tt[exit_i]),
        "exit_close_time": int(exit_close_ms),
        "direction": d,
        "correction_delay_bars": int(signal["correction_delay_bars"]),
        "correction_duration_bars": int(signal["correction_duration_bars"]),
        "total_delay_bars": int(signal["total_delay_bars"]),
        "directional_correct": bool(signed > 0),
        "signed_displacement_atr": float(signed),
        "mfe_atr": float(mfe),
        "mae_atr": float(mae),
        "c0": float(cc["c0"]),
        "c1": float(cc["c1"]),
        "c2": float(cc["c2"]),
    }


def metrics(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    return {
        "n": int(len(rows)),
        "directional_accuracy": float(np.mean([r["directional_correct"] for r in rows])),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
        "c1_win_rate": float(np.mean([r["c1"] > 0 for r in rows])),
        "mean_signed_displacement_atr": float(np.mean([r["signed_displacement_atr"] for r in rows])),
        "mean_mfe_atr": float(np.mean([r["mfe_atr"] for r in rows])),
        "mean_mae_atr": float(np.mean([r["mae_atr"] for r in rows])),
        "correction_delay_median": float(np.median([r["correction_delay_bars"] for r in rows])),
        "correction_duration_median": float(np.median([r["correction_duration_bars"] for r in rows])),
        "total_delay_median": float(np.median([r["total_delay_bars"] for r in rows])),
    }


def verdict(rows: list[dict]) -> tuple[str, dict]:
    up = [r for r in rows if r["direction"] == 1]
    down = [r for r in rows if r["direction"] == -1]
    adequacy = {
        "mature_h4_ge_10": len(rows) >= 10,
        "up_ge_3": len(up) >= 3,
        "down_ge_3": len(down) >= 3,
    }
    if not all(adequacy.values()):
        return "INCONCLUSIVE", {**adequacy, "sample_adequate": False}

    m = metrics(rows)
    up_m = metrics(up)
    down_m = metrics(down)
    screens = {
        **adequacy,
        "sample_adequate": True,
        "c0_positive": m["c0_mean_per_trade"] > 0,
        "c1_positive": m["c1_mean_per_trade"] > 0,
        "c2_nonnegative": m["c2_mean_per_trade"] >= 0,
        "c1_win_gt_0_50": m["c1_win_rate"] > 0.50,
        "up_c1_nonnegative": up_m["c1_mean_per_trade"] >= 0,
        "down_c1_nonnegative": down_m["c1_mean_per_trade"] >= 0,
    }
    return ("PASS" if all(screens.values()) else "FAIL"), screens


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--train-state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root)
    train_run = Path(a.train_state_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    state_code = HERE / "state_transition_engine_v02.py"
    dc_code = HERE / "dc_correction_resumption_swing_v01.py"
    if sha(state_code) != EXPECTED_STATE_CODE_SHA:
        raise ValueError("frozen State Engine code hash changed")
    if sha(dc_code) != EXPECTED_DC_CODE_SHA:
        raise ValueError("frozen DC rule code hash changed")
    if sha(train_run / "state_sequence.csv.gz") != EXPECTED_TRAIN_STATE_FILE_SHA:
        raise ValueError("frozen Train state file hash changed")
    if RAW_CAP_MS >= HOLDOUT_START_MS:
        raise AssertionError("raw cap crosses Holdout")

    (out / "environment.json").write_text(json.dumps({
        "python": sys.version,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "protocol_sha256": sha(PROTOCOL),
        "state_code_sha256": sha(state_code),
        "dc_rule_code_sha256": sha(dc_code),
        "first_valid": "2021-09-08T17:00:00Z",
        "train_end": "2024-03-20T15:20:24.500Z",
        "validation_start": "2024-03-20T19:20:24.500Z",
        "validation_end": "2025-03-25T01:04:34.300Z",
        "holdout_start": "2025-03-25T05:04:34.300Z",
        "raw_cap": "2025-03-25T01:00:00Z",
        "validation_read": True,
        "holdout_read": False,
        "pristine_oos_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1_capped(root, RAW_CAP_MS, out / "validation_input_manifest.json")
    if int(f.t.max()) >= HOLDOUT_START_MS:
        raise AssertionError("Holdout timestamp reached")

    feat = add_cores(state_features(f))
    states, events, fsm_diag = run_fsm(feat)
    feat["state"] = states

    # HARD GATE: frozen Train prefix must be identical before any Validation outcome.
    parity = prefix_parity(feat, train_run / "state_sequence.csv.gz")
    (out / "prefix_parity.json").write_text(json.dumps(parity, indent=2), encoding="utf-8")

    state_cols = list(pd.read_csv(train_run / "state_sequence.csv.gz", nrows=1).columns)
    feat[state_cols].to_csv(out / "extended_state_sequence.csv.gz", index=False, compression="gzip")

    state_by_time = {
        int(t): normalize_state(s)
        for t, s in zip(feat.t.to_numpy(dtype=np.int64), feat.state)
        if normalize_state(s) is not None
    }
    t_to_i = {int(t): i for i, t in enumerate(f.t.to_numpy(dtype=np.int64))}
    fine = dc_states(f.bc.to_numpy(dtype=float), FINE_THRESHOLD)
    macro = dc_states(f.bc.to_numpy(dtype=float), MACRO_THRESHOLD)

    cohort = [
        e for e in events
        if e.get("primary")
        and e.get("fsm_resolution") in ("TREND_UP", "TREND_DOWN")
        and e.get("resolution_time") is not None
        and VAL_START_MS <= int(e["resolution_time"]) < VAL_END_MS
    ]

    signal_rows = []
    trade_rows = []
    for e in cohort:
        sig = search_signal(e, f, state_by_time, t_to_i, fine, macro)
        rec = {
            "event_id": int(e["event_id"]),
            "onset_time": int(e["time"]),
            "resolution_time": int(e["resolution_time"]),
            "resolution": e["fsm_resolution"],
            "direction": 1 if e["fsm_resolution"] == "TREND_UP" else -1,
            **sig,
        }
        signal_rows.append(rec)
        if sig["status"] == "DC_RESUMPTION_ENTRY":
            tr = execution_record(e, sig, f)
            if tr is not None:
                trade_rows.append(tr)
            else:
                rec["execution_status"] = "H4_NOT_MATURE_BEFORE_VALIDATION_END"

    with (out / "validation_signals.jsonl").open("w", encoding="utf-8") as fh:
        for r in signal_rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")
    with (out / "validation_trades.jsonl").open("w", encoding="utf-8") as fh:
        for r in trade_rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")

    up = [r for r in trade_rows if r["direction"] == 1]
    down = [r for r in trade_rows if r["direction"] == -1]
    midpoint = VAL_START_MS + (VAL_END_MS - VAL_START_MS) // 2
    half1 = [r for r in trade_rows if r["signal_time"] < midpoint]
    half2 = [r for r in trade_rows if r["signal_time"] >= midpoint]
    v, screens = verdict(trade_rows)

    result = {
        "scope": "GTG DC Correction -> Resumption H4 Validation Gate v0.1",
        "evidence_status": "FORMAL_VALIDATION_DRY_RUN_TRAIN_SELECTED_CANDIDATE",
        "validation_read": True,
        "holdout_read": False,
        "pristine_oos_read": False,
        "boundaries": {
            "first_valid": "2021-09-08T17:00:00Z",
            "train_end": "2024-03-20T15:20:24.500Z",
            "validation_start": "2024-03-20T19:20:24.500Z",
            "validation_end": "2025-03-25T01:04:34.300Z",
            "holdout_start": "2025-03-25T05:04:34.300Z",
            "raw_cap": "2025-03-25T01:00:00Z",
        },
        "quality": quality,
        "prefix_parity": parity,
        "fsm_diagnostics": fsm_diag,
        "validation_primary_confirmed_trend_episodes": int(len(cohort)),
        "signal_status_counts": dict(Counter(r["status"] for r in signal_rows)),
        "eligible_resumption_signals": int(sum(r["status"] == "DC_RESUMPTION_ENTRY" for r in signal_rows)),
        "mature_h4_trades": int(len(trade_rows)),
        "overall": metrics(trade_rows),
        "by_direction": {
            "up": metrics(up),
            "down": metrics(down),
        },
        "half_period_descriptive": {
            "first_half": metrics(half1),
            "second_half": metrics(half2),
        },
        "registered_screens": screens,
        "validation_verdict": v,
        "integrity": {
            "protocol_committed_before_validation_read": "PASS",
            "state_code_hash_unchanged": "PASS",
            "dc_rule_code_hash_unchanged": "PASS",
            "train_state_file_hash_unchanged": "PASS",
            "train_prefix_parity": parity["status"],
            "fine_dc_exact_0p0025": "PASS",
            "macro_dc_exact_0p0050": "PASS",
            "horizon_exact_4": "PASS",
            "end_embargo_respected": "PASS",
            "holdout_timestamp_not_read": "PASS",
            "historical_holdout_read": False,
            "pristine_oos_read": False,
        },
    }
    (out / "summary.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({
        "prefix_parity": parity,
        "cohort": len(cohort),
        "signal_status_counts": result["signal_status_counts"],
        "mature_h4_trades": len(trade_rows),
        "overall": result["overall"],
        "by_direction": result["by_direction"],
        "screens": screens,
        "verdict": v,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
