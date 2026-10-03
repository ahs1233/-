"""GTG Structural Range Box Scalper v0.1."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
from compare import costs, dc_states
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import RAW_END, MAX_CONTIG_GAP

PROTOCOL = HERE / "PROTOCOL_STRUCTURAL_RANGE_BOX_SCALPER_V0_1.md"
SPLIT = "2021-01-01"
DC_THRESHOLD = 0.0025

EXPECTED_STATE_FILE = "cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772"
EXPECTED_STATE_CONTENT = "c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e"
EXPECTED_MANIFEST = "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"
V01_C1_EVAL = -0.1811011018983893


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def state_content_hash(s: pd.Series) -> str:
    vals = ["" if pd.isna(x) else str(x) for x in s]
    return hashlib.sha256(("\n".join(vals)).encode()).hexdigest()


def gap_ok(a: int, b: int) -> bool:
    d = int(b) - int(a)
    return 0 < d <= MAX_CONTIG_GAP


def split_bounds(split: str) -> tuple[int, int]:
    if split == "library":
        return 0, ms(SPLIT)
    if split == "evaluation":
        return ms(SPLIT), ms(RAW_END)
    raise ValueError(split)


def fresh_pivot(dc: dict, i: int, episode_start: int) -> tuple[str, dict] | None:
    if int(dc["confirmed_at"]) != int(i):
        return None
    if int(dc["pivot_at"]) < int(episode_start):
        return None
    direction = int(dc["direction"])
    if direction not in (-1, 1):
        return None
    rec = {
        "confirmed_at": int(dc["confirmed_at"]),
        "pivot_at": int(dc["pivot_at"]),
        "pivot_price": float(dc["pivot_price"]),
    }
    return ("LOW" if direction == 1 else "HIGH"), rec


def current_box(lows: list[dict], highs: list[dict]) -> dict | None:
    if len(lows) < 2 or len(highs) < 2:
        return None
    ll = lows[-2:]
    hh = highs[-2:]
    lower = float(np.median([x["pivot_price"] for x in ll]))
    upper = float(np.median([x["pivot_price"] for x in hh]))
    if not np.isfinite(lower) or not np.isfinite(upper) or upper <= lower:
        return None
    confs = [x["confirmed_at"] for x in ll + hh]
    return {
        "lower": lower,
        "upper": upper,
        "midpoint": float((lower + upper) / 2.0),
        "width": float(upper - lower),
        "low_confirmations": [int(x["confirmed_at"]) for x in ll],
        "high_confirmations": [int(x["confirmed_at"]) for x in hh],
        "low_prices": [float(x["pivot_price"]) for x in ll],
        "high_prices": [float(x["pivot_price"]) for x in hh],
        "oldest_confirmation": int(min(confs)),
        "newest_confirmation": int(max(confs)),
    }


def signal_from_box(i: int, f: pd.DataFrame, box: dict) -> dict | None:
    close = float(f.bc.iloc[i])
    open_ = float(f.bo.iloc[i])
    atr = float(f.atr.iloc[i])
    if not np.isfinite(atr) or atr <= 0:
        return None
    lower, upper = float(box["lower"]), float(box["upper"])
    if not (lower <= close <= upper):
        return None
    width = upper - lower
    pos = (close - lower) / width
    long_ok = pos <= 0.25 and close > open_
    short_ok = pos >= 0.75 and close < open_
    if long_ok and short_ok:
        raise ValueError("both structural range signals")
    if not long_ok and not short_ok:
        return None
    d = 1 if long_ok else -1
    return {
        "signal_idx": int(i),
        "signal_time": int(f.t.iloc[i]),
        "direction": d,
        "lower": lower,
        "upper": upper,
        "midpoint": float(box["midpoint"]),
        "width": float(width),
        "position": float(pos),
        "atr_ref": atr,
        "low_confirmations": list(box["low_confirmations"]),
        "high_confirmations": list(box["high_confirmations"]),
        "low_prices": list(box["low_prices"]),
        "high_prices": list(box["high_prices"]),
        "oldest_confirmation": int(box["oldest_confirmation"]),
        "newest_confirmation": int(box["newest_confirmation"]),
    }


def metrics(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    return {
        "n": int(len(rows)),
        "long_n": int(sum(r["direction"] == 1 for r in rows)),
        "short_n": int(sum(r["direction"] == -1 for r in rows)),
        "directional_accuracy": float(np.mean([r["directional_correct"] for r in rows])),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
        "c1_win_rate": float(np.mean([r["c1"] > 0 for r in rows])),
        "duration_median_bars": float(np.median([r["duration_bars"] for r in rows])),
        "duration_mean_bars": float(np.mean([r["duration_bars"] for r in rows])),
        "elapsed_wall_hours_mean": float(np.mean([r["elapsed_wall_hours"] for r in rows])),
        "mean_mfe_atr": float(np.mean([r["mfe_atr"] for r in rows])),
        "mean_mae_atr": float(np.mean([r["mae_atr"] for r in rows])),
        "exit_reason_counts": dict(Counter(r["exit_reason"] for r in rows)),
        "target_exit_fraction": float(np.mean([
            r["exit_reason"] in ("TARGET", "TARGET_AND_STATE_EXIT") for r in rows
        ])),
        "boundary_invalidation_fraction": float(np.mean([
            r["exit_reason"] in ("BOUNDARY_INVALIDATION", "BOUNDARY_AND_STATE_EXIT")
            for r in rows
        ])),
        "state_exit_only_fraction": float(np.mean([
            r["exit_reason"] == "STATE_EXIT" for r in rows
        ])),
    }


def execute_trade(
    sig: dict,
    f: pd.DataFrame,
    states: dict[int, str],
    split_end: int,
) -> dict:
    t = f.t.to_numpy(dtype=np.int64)
    i = int(sig["signal_idx"])
    if i + 1 >= len(f) or int(t[i + 1]) >= split_end:
        return {"status": "SPLIT_END", "resume_idx": i + 1}
    if not gap_ok(t[i], t[i + 1]):
        return {"status": "ENTRY_HARD_GAP", "resume_idx": i + 1}

    entry = i + 1
    d = int(sig["direction"])
    lower, upper = float(sig["lower"]), float(sig["upper"])
    mid, atr = float(sig["midpoint"]), float(sig["atr_ref"])
    prev = i

    for k in range(entry, len(f)):
        tk = int(t[k])
        if tk >= split_end:
            return {"status": "SPLIT_END", "resume_idx": k}
        if not gap_ok(t[prev], t[k]):
            return {"status": "HARD_GAP", "resume_idx": k}
        prev = k
        st = states.get(tk)
        if st is None:
            return {"status": "MISSING_STATE", "resume_idx": k + 1}

        close = float(f.bc.iloc[k])
        target = close >= mid if d == 1 else close <= mid
        boundary = close < lower if d == 1 else close > upper
        state_exit = st != "RANGE"
        if target and boundary:
            raise AssertionError("target and adverse boundary both true")
        if not target and not boundary and not state_exit:
            continue

        reason = (
            "TARGET_AND_STATE_EXIT" if target and state_exit
            else "BOUNDARY_AND_STATE_EXIT" if boundary and state_exit
            else "TARGET" if target
            else "BOUNDARY_INVALIDATION" if boundary
            else "STATE_EXIT"
        )
        exit_i = k + 1
        if exit_i >= len(f) or int(t[exit_i]) >= split_end:
            return {"status": "SPLIT_END", "resume_idx": exit_i}
        if not gap_ok(t[k], t[exit_i]):
            return {"status": "HARD_GAP", "resume_idx": exit_i}

        cc = costs(
            d,
            float(f.bo.iloc[entry]), float(f.ao.iloc[entry]),
            float(f.bo.iloc[exit_i]), float(f.ao.iloc[exit_i]),
            atr,
        )
        entry_mid = (float(f.bo.iloc[entry]) + float(f.ao.iloc[entry])) / 2
        exit_mid = (float(f.bo.iloc[exit_i]) + float(f.ao.iloc[exit_i])) / 2
        hi = float(f.bh.iloc[entry:k+1].max())
        lo = float(f.bl.iloc[entry:k+1].min())
        if d == 1:
            mfe, mae = (hi-entry_mid)/atr, (entry_mid-lo)/atr
        else:
            mfe, mae = (entry_mid-lo)/atr, (hi-entry_mid)/atr

        return {
            "status": "TRADE",
            "resume_idx": int(exit_i),
            "entry_idx": int(entry),
            "exit_signal_idx": int(k),
            "entry_time": int(t[entry]),
            "exit_signal_time": int(t[k]),
            "exit_time": int(t[exit_i]),
            "exit_reason": reason,
            "direction": d,
            "duration_bars": int(k - i),
            "elapsed_wall_hours": float((t[exit_i] - t[entry]) / 3_600_000),
            "directional_correct": bool(d * (exit_mid-entry_mid) > 0),
            "mfe_atr": float(mfe),
            "mae_atr": float(mae),
            "c0": float(cc["c0"]),
            "c1": float(cc["c1"]),
            "c2": float(cc["c2"]),
        }
    return {"status": "DATA_END", "resume_idx": len(f)}


def run_split(
    split: str,
    f: pd.DataFrame,
    states: dict[int, str],
    dc: list[dict],
) -> tuple[dict, list[dict], list[dict]]:
    start_t, end_t = split_bounds(split)
    t = f.t.to_numpy(dtype=np.int64)
    idxs = np.where((t >= start_t) & (t < end_t))[0]
    if not len(idxs):
        raise ValueError("empty split")
    first, last_excl = int(idxs[0]), int(idxs[-1]) + 1

    lows: list[dict] = []
    highs: list[dict] = []
    episode_start = None
    prev_i = None
    trades, events = [], []
    counters = Counter()
    box_diag = []
    i = first

    while i < last_excl:
        ti = int(t[i])
        st = states.get(ti)
        continuous = prev_i is not None and gap_ok(t[prev_i], ti)

        if prev_i is not None and not continuous:
            lows, highs = [], []
            episode_start = None
            counters["hard_gap_resets"] += 1

        if st != "RANGE":
            lows, highs = [], []
            episode_start = None
            prev_i = i
            i += 1
            continue

        counters["range_bars"] += 1
        if episode_start is None:
            episode_start = i
            lows, highs = [], []
            counters["range_episodes"] += 1

        fp = fresh_pivot(dc[i], i, episode_start)
        if fp is not None:
            kind, rec = fp
            if kind == "LOW":
                lows.append(rec)
                counters["confirmed_low_pivots"] += 1
            else:
                highs.append(rec)
                counters["confirmed_high_pivots"] += 1

        box = current_box(lows, highs)
        if box is not None:
            close = float(f.bc.iloc[i])
            atr = float(f.atr.iloc[i])
            if np.isfinite(atr) and atr > 0 and box["lower"] <= close <= box["upper"]:
                counters["mature_box_bars"] += 1
                box_diag.append({
                    "time": ti,
                    "width_atr": float(box["width"]/atr),
                    "low_dispersion_atr": float(abs(box["low_prices"][1]-box["low_prices"][0])/atr),
                    "high_dispersion_atr": float(abs(box["high_prices"][1]-box["high_prices"][0])/atr),
                    "oldest_age_bars": int(i - box["oldest_confirmation"]),
                    "newest_age_bars": int(i - box["newest_confirmation"]),
                })

        sig = signal_from_box(i, f, box) if box is not None else None
        if sig is None:
            prev_i = i
            i += 1
            continue

        counters["flat_candidate_signals"] += 1
        result = execute_trade(sig, f, states, end_t)
        evt = {**sig, "split": split, "result_status": result["status"]}
        if result["status"] == "TRADE":
            row = {
                **sig,
                **{k:v for k,v in result.items() if k not in ("status","resume_idx")},
                "split": split,
                "year": int(pd.to_datetime(sig["signal_time"], unit="ms", utc=True).year),
                "box_width_atr": float(sig["width"]/sig["atr_ref"]),
                "low_dispersion_atr": float(abs(sig["low_prices"][1]-sig["low_prices"][0])/sig["atr_ref"]),
                "high_dispersion_atr": float(abs(sig["high_prices"][1]-sig["high_prices"][0])/sig["atr_ref"]),
            }
            trades.append(row)
            counters["completed_trades"] += 1
            evt["exit_reason"] = result["exit_reason"]
            evt["entry_time"] = result["entry_time"]
            evt["exit_time"] = result["exit_time"]
            # While trade is active the box is frozen for execution, and new flat
            # signals are ignored. Resume at execution bar with structural memory
            # rebuilt causally from RANGE start to avoid skipping DC confirmations.
            resume = int(result["resume_idx"])
            events.append(evt)
            # Rebuild current RANGE episode memory up to resume-1.
            lows, highs = [], []
            episode_start = None
            rebuild_start = resume - 1
            while rebuild_start >= first:
                tt = int(t[rebuild_start])
                if states.get(tt) != "RANGE":
                    rebuild_start += 1
                    break
                if rebuild_start > first and not gap_ok(t[rebuild_start-1], t[rebuild_start]):
                    break
                rebuild_start -= 1
            rebuild_start = max(first, rebuild_start)
            for j in range(rebuild_start, min(resume, last_excl)):
                if states.get(int(t[j])) != "RANGE":
                    lows, highs = [], []
                    episode_start = None
                    continue
                if episode_start is None:
                    episode_start = j
                z = fresh_pivot(dc[j], j, episode_start)
                if z is not None:
                    (lows if z[0] == "LOW" else highs).append(z[1])
            prev_i = resume - 1 if resume - 1 >= first else None
            i = max(i + 1, resume)
            continue
        else:
            counters["censored_" + result["status"].lower()] += 1
            events.append(evt)
            prev_i = i
            i = max(i + 1, int(result.get("resume_idx", i+1)))
            # hard gap / split naturally resets on next iteration
            continue

    overall = metrics(trades)
    by_dir = {
        "long": metrics([r for r in trades if r["direction"] == 1]),
        "short": metrics([r for r in trades if r["direction"] == -1]),
    }
    by_year = {}
    for y in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == y]
        by_year[str(y)] = metrics(rr) if len(rr) >= 20 else {"n": len(rr)}

    diag = {
        "n": int(len(box_diag)),
        "width_atr_median": float(np.median([x["width_atr"] for x in box_diag])) if box_diag else None,
        "width_atr_mean": float(np.mean([x["width_atr"] for x in box_diag])) if box_diag else None,
        "low_dispersion_atr_median": float(np.median([x["low_dispersion_atr"] for x in box_diag])) if box_diag else None,
        "high_dispersion_atr_median": float(np.median([x["high_dispersion_atr"] for x in box_diag])) if box_diag else None,
        "oldest_age_bars_median": float(np.median([x["oldest_age_bars"] for x in box_diag])) if box_diag else None,
        "newest_age_bars_median": float(np.median([x["newest_age_bars"] for x in box_diag])) if box_diag else None,
    }
    report = {
        "range_bars": int(counters["range_bars"]),
        "range_episodes": int(counters["range_episodes"]),
        "confirmed_low_pivots": int(counters["confirmed_low_pivots"]),
        "confirmed_high_pivots": int(counters["confirmed_high_pivots"]),
        "mature_box_bars": int(counters["mature_box_bars"]),
        "mature_box_coverage": (
            float(counters["mature_box_bars"]/counters["range_bars"])
            if counters["range_bars"] else None
        ),
        "flat_candidate_signals": int(counters["flat_candidate_signals"]),
        "completed_trades": int(counters["completed_trades"]),
        "censored_counts": {
            k:int(v) for k,v in counters.items() if k.startswith("censored_")
        },
        "overall": overall,
        "by_direction": by_dir,
        "by_year": by_year,
        "box_diagnostics": diag,
    }
    return report, trades, events



def precompute_box_state(
    split: str,
    f: pd.DataFrame,
    states: dict[int, str],
    dc: list[dict],
) -> tuple[dict[int, dict], dict, list[dict]]:
    start_t, end_t = split_bounds(split)
    t = f.t.to_numpy(dtype=np.int64)
    idxs = np.where((t >= start_t) & (t < end_t))[0]
    if not len(idxs):
        raise ValueError("empty split")

    first, last_excl = int(idxs[0]), int(idxs[-1]) + 1
    boxes: dict[int, dict] = {}
    diag: list[dict] = []
    counters = Counter()
    lows: list[dict] = []
    highs: list[dict] = []
    episode_start = None
    prev_i = None

    for i in range(first, last_excl):
        ti = int(t[i])
        st = states.get(ti)
        continuous = prev_i is not None and gap_ok(t[prev_i], ti)

        if prev_i is not None and not continuous:
            lows, highs = [], []
            episode_start = None
            counters["hard_gap_resets"] += 1

        if st != "RANGE":
            lows, highs = [], []
            episode_start = None
            prev_i = i
            continue

        counters["range_bars"] += 1
        if episode_start is None:
            episode_start = i
            lows, highs = [], []
            counters["range_episodes"] += 1

        fp = fresh_pivot(dc[i], i, episode_start)
        if fp is not None:
            kind, rec = fp
            if kind == "LOW":
                lows.append(rec)
                counters["confirmed_low_pivots"] += 1
            else:
                highs.append(rec)
                counters["confirmed_high_pivots"] += 1

        box = current_box(lows, highs)
        if box is not None:
            close = float(f.bc.iloc[i])
            atr = float(f.atr.iloc[i])
            if np.isfinite(atr) and atr > 0 and box["lower"] <= close <= box["upper"]:
                boxes[i] = dict(box)
                counters["mature_box_bars"] += 1
                diag.append({
                    "time": ti,
                    "width_atr": float(box["width"] / atr),
                    "low_dispersion_atr": float(
                        abs(box["low_prices"][1] - box["low_prices"][0]) / atr
                    ),
                    "high_dispersion_atr": float(
                        abs(box["high_prices"][1] - box["high_prices"][0]) / atr
                    ),
                    "oldest_age_bars": int(i - box["oldest_confirmation"]),
                    "newest_age_bars": int(i - box["newest_confirmation"]),
                })
        prev_i = i

    stats = {
        "first_idx": first,
        "last_exclusive": last_excl,
        "range_bars": int(counters["range_bars"]),
        "range_episodes": int(counters["range_episodes"]),
        "confirmed_low_pivots": int(counters["confirmed_low_pivots"]),
        "confirmed_high_pivots": int(counters["confirmed_high_pivots"]),
        "mature_box_bars": int(counters["mature_box_bars"]),
        "hard_gap_resets": int(counters["hard_gap_resets"]),
    }
    return boxes, stats, diag


# Override the earlier path-dependent draft: representation is precomputed
# causally for every bar before the one-position execution simulation.
def run_split(
    split: str,
    f: pd.DataFrame,
    states: dict[int, str],
    dc: list[dict],
) -> tuple[dict, list[dict], list[dict]]:
    start_t, end_t = split_bounds(split)
    t = f.t.to_numpy(dtype=np.int64)
    boxes, structural, box_diag = precompute_box_state(split, f, states, dc)
    first = int(structural["first_idx"])
    last_excl = int(structural["last_exclusive"])

    trades: list[dict] = []
    events: list[dict] = []
    counters = Counter()
    i = first
    while i < last_excl:
        box = boxes.get(i)
        if box is None:
            i += 1
            continue

        sig = signal_from_box(i, f, box)
        if sig is None:
            i += 1
            continue

        counters["flat_candidate_signals"] += 1
        result = execute_trade(sig, f, states, end_t)
        evt = {**sig, "split": split, "result_status": result["status"]}
        if result["status"] == "TRADE":
            row = {
                **sig,
                **{
                    k: v for k, v in result.items()
                    if k not in ("status", "resume_idx")
                },
                "split": split,
                "year": int(
                    pd.to_datetime(sig["signal_time"], unit="ms", utc=True).year
                ),
                "box_width_atr": float(sig["width"] / sig["atr_ref"]),
                "low_dispersion_atr": float(
                    abs(sig["low_prices"][1] - sig["low_prices"][0])
                    / sig["atr_ref"]
                ),
                "high_dispersion_atr": float(
                    abs(sig["high_prices"][1] - sig["high_prices"][0])
                    / sig["atr_ref"]
                ),
            }
            trades.append(row)
            counters["completed_trades"] += 1
            evt["exit_reason"] = result["exit_reason"]
            evt["entry_time"] = result["entry_time"]
            evt["exit_time"] = result["exit_time"]
            events.append(evt)
            i = max(i + 1, int(result["resume_idx"]))
        else:
            counters["censored_" + result["status"].lower()] += 1
            events.append(evt)
            i = max(i + 1, int(result.get("resume_idx", i + 1)))

    overall = metrics(trades)
    by_dir = {
        "long": metrics([r for r in trades if r["direction"] == 1]),
        "short": metrics([r for r in trades if r["direction"] == -1]),
    }
    by_year = {}
    for y in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == y]
        by_year[str(y)] = metrics(rr) if len(rr) >= 20 else {"n": len(rr)}

    diag = {
        "n": int(len(box_diag)),
        "width_atr_median": (
            float(np.median([x["width_atr"] for x in box_diag]))
            if box_diag else None
        ),
        "width_atr_mean": (
            float(np.mean([x["width_atr"] for x in box_diag]))
            if box_diag else None
        ),
        "low_dispersion_atr_median": (
            float(np.median([x["low_dispersion_atr"] for x in box_diag]))
            if box_diag else None
        ),
        "high_dispersion_atr_median": (
            float(np.median([x["high_dispersion_atr"] for x in box_diag]))
            if box_diag else None
        ),
        "oldest_age_bars_median": (
            float(np.median([x["oldest_age_bars"] for x in box_diag]))
            if box_diag else None
        ),
        "newest_age_bars_median": (
            float(np.median([x["newest_age_bars"] for x in box_diag]))
            if box_diag else None
        ),
    }

    report = {
        "range_bars": structural["range_bars"],
        "range_episodes": structural["range_episodes"],
        "confirmed_low_pivots": structural["confirmed_low_pivots"],
        "confirmed_high_pivots": structural["confirmed_high_pivots"],
        "mature_box_bars": structural["mature_box_bars"],
        "mature_box_coverage": (
            float(structural["mature_box_bars"] / structural["range_bars"])
            if structural["range_bars"] else None
        ),
        "flat_candidate_signals": int(counters["flat_candidate_signals"]),
        "completed_trades": int(counters["completed_trades"]),
        "censored_counts": {
            k: int(v) for k, v in counters.items() if k.startswith("censored_")
        },
        "overall": overall,
        "by_direction": by_dir,
        "by_year": by_year,
        "box_diagnostics": diag,
    }
    return report, trades, events


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    root, state_run, out = Path(a.root), Path(a.state_run), Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    if sha(state_run/"state_sequence.csv.gz") != EXPECTED_STATE_FILE:
        raise ValueError("state file hash changed")
    if sha(state_run/"input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("manifest hash changed")
    state = pd.read_csv(state_run/"state_sequence.csv.gz")
    if state_content_hash(state.state) != EXPECTED_STATE_CONTENT:
        raise ValueError("state content hash changed")
    states = {int(r.t): str(r.state) for r in state.itertuples(index=False)}

    (out/"environment.json").write_text(json.dumps({
        "python": sys.version,
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "dc_threshold": DC_THRESHOLD,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1(root, RAW_END, out/"input_manifest.json")
    if json.loads((out/"input_manifest.json").read_text()) != json.loads((state_run/"input_manifest.json").read_text()):
        raise ValueError("raw manifest mismatch")
    dc = dc_states(f.bc.to_numpy(dtype=float), DC_THRESHOLD)
    if len(dc) != len(f):
        raise ValueError("DC length mismatch")

    reports, all_trades, all_events = {}, [], []
    for split in ("library","evaluation"):
        rep, tr, ev = run_split(split, f, states, dc)
        reports[split] = rep
        all_trades.extend(tr)
        all_events.extend(ev)

    for name, rows in (("trades.jsonl",all_trades),("signals.jsonl",all_events)):
        with (out/name).open("w",encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r,allow_nan=False)+"\n")

    lib, ev = reports["library"], reports["evaluation"]
    evyears = ev["by_year"]
    positive_years = sum(
        1 for y in ("2021","2022","2023")
        if evyears.get(y,{}).get("n",0) >= 20 and evyears[y].get("c1_mean_per_trade",-999)>0
    )
    counts = [evyears[y]["n"] for y in ("2021","2022","2023") if y in evyears]
    max_share = max(counts)/sum(counts) if counts and sum(counts) else None

    screen = {
        "library_trades_ge_100": lib["overall"].get("n",0)>=100,
        "evaluation_trades_ge_100": ev["overall"].get("n",0)>=100,
        "evaluation_long_ge_40": ev["by_direction"]["long"].get("n",0)>=40,
        "evaluation_short_ge_40": ev["by_direction"]["short"].get("n",0)>=40,
        "library_mature_coverage_ge_0_20": lib["mature_box_coverage"] is not None and lib["mature_box_coverage"]>=0.20,
        "evaluation_mature_coverage_ge_0_20": ev["mature_box_coverage"] is not None and ev["mature_box_coverage"]>=0.20,
        "library_c1_positive": lib["overall"].get("c1_mean_per_trade",-999)>0,
        "evaluation_c1_positive": ev["overall"].get("c1_mean_per_trade",-999)>0,
        "library_c2_nonnegative": lib["overall"].get("c2_mean_per_trade",-999)>=0,
        "evaluation_c2_nonnegative": ev["overall"].get("c2_mean_per_trade",-999)>=0,
        "library_c1_win_gt_0_50": lib["overall"].get("c1_win_rate",0)>0.50,
        "evaluation_c1_win_gt_0_50": ev["overall"].get("c1_win_rate",0)>0.50,
        "two_full_years_positive_c1": positive_years>=2,
        "no_full_year_over_60pct": max_share is not None and max_share<=0.60,
        "evaluation_c1_better_than_v01": ev["overall"].get("c1_mean_per_trade",-999)>V01_C1_EVAL,
    }
    screen["pass"] = bool(all(screen.values()))

    summary = {
        "scope":"GTG Structural Range Box Scalper v0.1 development diagnostic",
        "validation_read":False,"holdout_read":False,"quality":quality,
        "reports":reports,"registered_screen":screen,
        "integrity":{
            "state_file_hash_unchanged":"PASS",
            "state_content_hash_unchanged":"PASS",
            "canonical_manifest_unchanged":"PASS",
            "dc_threshold_exact_0_0025":"PASS",
            "pivot_confirmation_current_bar_only":"PASS",
            "pivot_at_inside_range_episode":"PASS",
            "two_highs_two_lows_required":"PASS",
            "box_frozen_per_trade":"PASS",
            "entry_next_open":"PASS",
            "one_active_trade":"PASS",
            "exit_next_open":"PASS",
            "no_hard_gap_bridge":"PASS",
            "split_boundary_not_crossed":"PASS",
            "validation_read":False,"holdout_read":False,
        },
        "evidence_status":"DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION",
    }
    (out/"summary.json").write_text(json.dumps(summary,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({"library":lib,"evaluation":ev,"screen":screen},indent=2),flush=True)


if __name__=="__main__":
    main()
