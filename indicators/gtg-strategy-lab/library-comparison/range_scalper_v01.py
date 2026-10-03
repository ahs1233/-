"""GTG Range Scalper v0.1.

Frozen-channel mean-reversion baseline inside State Engine v0.2 RANGE.
"""
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
from compare import costs
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END

PROTOCOL = HERE / "PROTOCOL_RANGE_SCALPER_V0_1.md"
SPLIT = "2021-01-01"

EXPECTED_STATE_FILE = "cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772"
EXPECTED_STATE_CONTENT = "c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e"
EXPECTED_MANIFEST = "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"


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


def signal_at(i: int, f: pd.DataFrame, state_row: dict) -> dict | None:
    if state_row.get("state") != "RANGE":
        return None

    lower = float(state_row["prior24_lower"])
    upper = float(state_row["prior24_upper"])
    if not np.isfinite(lower) or not np.isfinite(upper) or upper <= lower:
        return None

    close = float(f.bc.iloc[i])
    open_ = float(f.bo.iloc[i])
    atr = float(f.atr.iloc[i])
    if not np.isfinite(atr) or atr <= 0:
        return None
    if close < lower or close > upper:
        return None

    width = upper - lower
    pos = (close - lower) / width
    long_ok = pos <= 0.25 and close > open_
    short_ok = pos >= 0.75 and close < open_

    if long_ok and short_ok:
        raise ValueError("both long and short range signals")
    if not long_ok and not short_ok:
        return None

    direction = 1 if long_ok else -1
    return {
        "signal_idx": int(i),
        "signal_time": int(f.t.iloc[i]),
        "direction": direction,
        "lower": lower,
        "upper": upper,
        "midpoint": float((lower + upper) / 2.0),
        "width": float(width),
        "position": float(pos),
        "atr_ref": atr,
    }


def execute_trade(
    sig: dict,
    f: pd.DataFrame,
    state_by_time: dict[int, dict],
    split_end: int,
) -> dict:
    t = f.t.to_numpy(dtype=np.int64)
    i = int(sig["signal_idx"])
    if i + 1 >= len(f) or int(t[i + 1]) >= split_end:
        return {"status": "SPLIT_END", "resume_idx": i + 1}
    if not gap_ok(t[i], t[i + 1]):
        return {"status": "ENTRY_HARD_GAP", "resume_idx": i + 1}

    entry = i + 1
    direction = int(sig["direction"])
    midpoint = float(sig["midpoint"])
    atr = float(sig["atr_ref"])
    prev = i

    for k in range(entry, len(f)):
        tk = int(t[k])
        if tk >= split_end:
            return {"status": "SPLIT_END", "resume_idx": k}

        if not gap_ok(t[prev], t[k]):
            return {"status": "HARD_GAP", "resume_idx": k}
        prev = k

        sr = state_by_time.get(tk)
        if sr is None:
            return {"status": "MISSING_STATE", "resume_idx": k + 1}

        close = float(f.bc.iloc[k])
        target = (close >= midpoint) if direction == 1 else (close <= midpoint)
        state_exit = sr["state"] != "RANGE"

        if not target and not state_exit:
            continue

        reason = (
            "TARGET_AND_STATE_EXIT" if target and state_exit
            else "TARGET" if target
            else "STATE_EXIT"
        )
        exit_i = k + 1
        if exit_i >= len(f) or int(t[exit_i]) >= split_end:
            return {"status": "SPLIT_END", "resume_idx": exit_i}
        if not gap_ok(t[k], t[exit_i]):
            return {"status": "HARD_GAP", "resume_idx": exit_i}

        cc = costs(
            direction,
            float(f.bo.iloc[entry]),
            float(f.ao.iloc[entry]),
            float(f.bo.iloc[exit_i]),
            float(f.ao.iloc[exit_i]),
            atr,
        )

        entry_mid = (float(f.bo.iloc[entry]) + float(f.ao.iloc[entry])) / 2.0
        exit_mid = (float(f.bo.iloc[exit_i]) + float(f.ao.iloc[exit_i])) / 2.0
        signed_mid = direction * (exit_mid - entry_mid) / atr

        hi = float(f.bh.iloc[entry:k + 1].max())
        lo = float(f.bl.iloc[entry:k + 1].min())
        if direction == 1:
            mfe = (hi - entry_mid) / atr
            mae = (entry_mid - lo) / atr
        else:
            mfe = (entry_mid - lo) / atr
            mae = (hi - entry_mid) / atr

        return {
            "status": "TRADE",
            "resume_idx": exit_i,
            "entry_idx": int(entry),
            "exit_signal_idx": int(k),
            "exit_idx": int(exit_i),
            "entry_time": int(t[entry]),
            "exit_signal_time": int(t[k]),
            "exit_time": int(t[exit_i]),
            "exit_reason": reason,
            "direction": direction,
            "duration_bars": int(k - i),
            "elapsed_wall_hours": float((t[exit_i] - t[entry]) / 3_600_000),
            "signed_mid_displacement_atr": float(signed_mid),
            "directional_correct": bool(signed_mid > 0),
            "mfe_atr": float(mfe),
            "mae_atr": float(mae),
            "c0": float(cc["c0"]),
            "c1": float(cc["c1"]),
            "c2": float(cc["c2"]),
        }

    return {"status": "DATA_END", "resume_idx": len(f)}


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
        "state_exit_before_target_fraction": float(np.mean([
            r["exit_reason"] == "STATE_EXIT" for r in rows
        ])),
    }


def run_split(
    split: str,
    f: pd.DataFrame,
    state_by_time: dict[int, dict],
) -> tuple[dict, list[dict], list[dict]]:
    start, end = split_bounds(split)
    t = f.t.to_numpy(dtype=np.int64)
    idx = np.where((t >= start) & (t < end))[0]
    if len(idx) == 0:
        raise ValueError(f"no rows for split {split}")

    first = int(idx[0])
    last_exclusive = int(idx[-1]) + 1
    i = first
    trades = []
    events = []
    range_bars = 0
    flat_signals = 0
    censored = Counter()

    while i < last_exclusive:
        ti = int(t[i])
        sr = state_by_time.get(ti)
        if sr is None:
            i += 1
            continue

        if sr["state"] == "RANGE":
            range_bars += 1

        sig = signal_at(i, f, sr)
        if sig is None:
            i += 1
            continue

        flat_signals += 1
        result = execute_trade(sig, f, state_by_time, end)
        event = {
            **sig,
            "split": split,
            "result_status": result["status"],
        }
        if result["status"] == "TRADE":
            row = {
                **sig,
                **{k: v for k, v in result.items() if k not in ("status", "resume_idx")},
                "split": split,
                "year": int(pd.to_datetime(sig["signal_time"], unit="ms", utc=True).year),
            }
            trades.append(row)
            event["exit_reason"] = result["exit_reason"]
            event["entry_time"] = result["entry_time"]
            event["exit_time"] = result["exit_time"]
            i = max(i + 1, int(result["resume_idx"]))
        else:
            censored[result["status"]] += 1
            i = max(i + 1, int(result.get("resume_idx", i + 1)))
        events.append(event)

    report = {
        "range_bars": int(range_bars),
        "flat_edge_signals": int(flat_signals),
        "completed_trades": int(len(trades)),
        "censored_counts": dict(censored),
        "overall": metrics(trades),
        "by_direction": {
            "long": metrics([r for r in trades if r["direction"] == 1]),
            "short": metrics([r for r in trades if r["direction"] == -1]),
        },
    }

    by_year = {}
    for year in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == year]
        by_year[str(year)] = metrics(rr) if len(rr) >= 20 else {"n": len(rr)}
    report["by_year"] = by_year

    by_exit_reason = {}
    for reason in ("TARGET", "STATE_EXIT", "TARGET_AND_STATE_EXIT"):
        rr = [r for r in trades if r["exit_reason"] == reason]
        by_exit_reason[reason] = metrics(rr)
    report["by_exit_reason"] = by_exit_reason
    return report, trades, events


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root)
    state_run = Path(a.state_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    if sha(state_run / "state_sequence.csv.gz") != EXPECTED_STATE_FILE:
        raise ValueError("state sequence file hash changed")
    if sha(state_run / "input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("state manifest hash changed")

    state = pd.read_csv(state_run / "state_sequence.csv.gz")
    if state_content_hash(state.state) != EXPECTED_STATE_CONTENT:
        raise ValueError("state content hash changed")

    required = {
        "t", "state", "prior24_upper", "prior24_lower", "position24", "atr"
    }
    if not required.issubset(set(state.columns)):
        raise ValueError(f"state sequence missing {required - set(state.columns)}")

    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "zone_quartile": 0.25,
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    f, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    if json.loads((out / "input_manifest.json").read_text()) != json.loads(
        (state_run / "input_manifest.json").read_text()
    ):
        raise ValueError("canonical manifest mismatch")

    state_by_time = {}
    for r in state.itertuples(index=False):
        state_by_time[int(r.t)] = {
            "state": str(r.state),
            "prior24_upper": float(r.prior24_upper),
            "prior24_lower": float(r.prior24_lower),
            "position24": float(r.position24),
            "atr": float(r.atr),
        }

    reports = {}
    all_trades = []
    all_events = []
    for split in ("library", "evaluation"):
        report, trades, events = run_split(split, f, state_by_time)
        reports[split] = report
        all_trades.extend(trades)
        all_events.extend(events)

    with (out / "trades.jsonl").open("w", encoding="utf-8") as fh:
        for r in all_trades:
            fh.write(json.dumps(r, allow_nan=False) + "\n")
    with (out / "signals.jsonl").open("w", encoding="utf-8") as fh:
        for r in all_events:
            fh.write(json.dumps(r, allow_nan=False) + "\n")

    lib = reports["library"]["overall"]
    ev = reports["evaluation"]["overall"]
    ev_by_dir = reports["evaluation"]["by_direction"]
    ev_by_year = reports["evaluation"]["by_year"]

    positive_years = sum(
        1 for y in ("2021", "2022", "2023")
        if ev_by_year.get(y, {}).get("n", 0) >= 20
        and ev_by_year[y].get("c1_mean_per_trade", -999) > 0
    )
    full_year_counts = [
        ev_by_year[y]["n"] for y in ("2021", "2022", "2023")
        if y in ev_by_year
    ]
    max_year_share = (
        max(full_year_counts) / sum(full_year_counts)
        if full_year_counts and sum(full_year_counts) else None
    )

    screen = {
        "library_completed_ge_100": lib.get("n", 0) >= 100,
        "evaluation_completed_ge_100": ev.get("n", 0) >= 100,
        "evaluation_long_ge_40": ev_by_dir["long"].get("n", 0) >= 40,
        "evaluation_short_ge_40": ev_by_dir["short"].get("n", 0) >= 40,
        "library_c1_positive": lib.get("c1_mean_per_trade", -999) > 0,
        "evaluation_c1_positive": ev.get("c1_mean_per_trade", -999) > 0,
        "library_c2_nonnegative": lib.get("c2_mean_per_trade", -999) >= 0,
        "evaluation_c2_nonnegative": ev.get("c2_mean_per_trade", -999) >= 0,
        "library_c1_win_gt_0_50": lib.get("c1_win_rate", 0) > 0.50,
        "evaluation_c1_win_gt_0_50": ev.get("c1_win_rate", 0) > 0.50,
        "positive_c1_two_full_evaluation_years": positive_years >= 2,
        "no_full_year_over_60pct": (
            max_year_share is not None and max_year_share <= 0.60
        ),
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Range Scalper v0.1 development diagnostic",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "reports": reports,
        "registered_stability_screen": screen,
        "integrity": {
            "state_file_hash_unchanged": "PASS",
            "state_content_hash_unchanged": "PASS",
            "source_manifest_unchanged": "PASS",
            "range_state_only_signals": "PASS",
            "frozen_channel_per_trade": "PASS",
            "entry_after_signal_close": "PASS",
            "single_active_trade": "PASS",
            "causal_target_or_state_exit": "PASS",
            "exit_after_exit_signal_close": "PASS",
            "no_hard_gap_bridging": "PASS",
            "split_boundary_not_crossed": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "evidence_status": "DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION",
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "library": reports["library"],
        "evaluation": reports["evaluation"],
        "screen": screen,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
