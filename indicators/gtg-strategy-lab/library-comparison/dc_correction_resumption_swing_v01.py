"""GTG DC Correction -> Resumption Swing v0.1.

Structural entry diagnostic after frozen Trend confirmation.
Preregistered before execution outcomes.
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
from compare import costs, dc_states
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END

PROTOCOL = HERE / "PROTOCOL_DC_CORRECTION_RESUMPTION_SWING_V0_1.md"
FINE_THRESHOLD = 0.0025
MACRO_THRESHOLD = 0.0050
HORIZONS = (4, 12, 24)

EXPECTED_HANDOFF = "45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd"
EXPECTED_MANIFEST = "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"
EXPECTED_STATE_CONTENT = "c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as fh:
        return [json.loads(x) for x in fh if x.strip()]


def state_content_hash(s: pd.Series) -> str:
    vals = ["" if pd.isna(x) else str(x) for x in s]
    return hashlib.sha256(("\n".join(vals)).encode()).hexdigest()


def gap_ok(a: int, b: int) -> bool:
    d = int(b) - int(a)
    return 0 < d <= MAX_CONTIG_GAP


def fresh_dc(states: list[dict], i: int, direction: int) -> bool:
    return (
        int(states[i]["confirmed_at"]) == i
        and int(states[i]["direction"]) == int(direction)
    )


def search_signal(
    event: dict,
    f: pd.DataFrame,
    state_by_time: dict[int, str],
    t_to_i: dict[int, int],
    fine: list[dict],
    macro: list[dict],
) -> dict:
    rt = int(event["resolution_time"])
    if rt not in t_to_i:
        raise ValueError("resolution time absent from H1")
    q = t_to_i[rt]
    d = int(event["resolved_direction"])
    if d not in (-1, 1):
        raise ValueError("bad resolved direction")
    trend = "TREND_UP" if d == 1 else "TREND_DOWN"

    if state_by_time.get(rt) != trend:
        raise ValueError("resolution state mismatch")
    if int(macro[q]["direction"]) != d:
        return {"status": "MACRO_NOT_ALIGNED_AT_RESOLUTION"}

    t = f.t.to_numpy(dtype=np.int64)
    correction_i = None
    prev = q

    for j in range(q + 1, len(f)):
        if not gap_ok(t[prev], t[j]):
            return {"status": "HARD_GAP"}
        prev = j

        st = state_by_time.get(int(t[j]))
        if st != trend:
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
            if j + 1 >= len(f) or int(t[j + 1]) >= ms(RAW_END):
                return {"status": "DATA_END"}
            if not gap_ok(t[j], t[j + 1]):
                return {"status": "HARD_GAP"}
            return {
                "status": "DC_RESUMPTION_ENTRY",
                "resolution_idx": int(q),
                "correction_idx": int(correction_i),
                "signal_idx": int(j),
                "entry_idx": int(j + 1),
                "correction_delay_bars": int(correction_i - q),
                "correction_duration_bars": int(j - correction_i),
                "total_delay_bars": int(j - q),
            }

    return {"status": "DATA_END"}


def path_ok(t: np.ndarray, s: int, h: int) -> bool:
    if s + h >= len(t):
        return False
    if int(t[s + h]) >= ms(RAW_END):
        return False
    d = np.diff(t[s:s + h + 1])
    return bool(np.all(d > 0) and np.all(d <= MAX_CONTIG_GAP))


def execution_record(event: dict, signal: dict, f: pd.DataFrame, h: int) -> dict | None:
    s = int(signal["signal_idx"])
    entry = int(signal["entry_idx"])
    t = f.t.to_numpy(dtype=np.int64)
    if not path_ok(t, s, h):
        return None

    d = int(event["resolved_direction"])
    atr = float(f.atr.iloc[s])
    if not np.isfinite(atr) or atr <= 0:
        return None

    exit_i = s + h
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

    lower = float(event["frozen_lower"])
    upper = float(event["frozen_upper"])
    closes = f.bc.iloc[entry:exit_i + 1].to_numpy(dtype=float)
    returned = bool(np.any((closes >= lower) & (closes <= upper)))

    return {
        "event_id": int(event["event_id"]),
        "split": event["split"],
        "resolution_time": int(event["resolution_time"]),
        "signal_time": int(t[s]),
        "entry_time": int(t[entry]),
        "year": int(pd.to_datetime(t[s], unit="ms", utc=True).year),
        "direction": d,
        "horizon": int(h),
        "correction_delay_bars": int(signal["correction_delay_bars"]),
        "correction_duration_bars": int(signal["correction_duration_bars"]),
        "total_delay_bars": int(signal["total_delay_bars"]),
        "signed_displacement_atr": float(signed),
        "directional_correct": bool(signed > 0),
        "mfe_atr": float(mfe),
        "mae_atr": float(mae),
        "returned_inside": returned,
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
        "returned_inside_fraction": float(np.mean([r["returned_inside"] for r in rows])),
        "correction_delay_median": float(np.median([r["correction_delay_bars"] for r in rows])),
        "correction_duration_median": float(np.median([r["correction_duration_bars"] for r in rows])),
        "total_delay_median": float(np.median([r["total_delay_bars"] for r in rows])),
    }


def delay_bin(r: dict, field: str) -> str:
    x = int(r[field])
    if field == "correction_duration_bars":
        if x == 1:
            return "1"
        if x <= 3:
            return "2-3"
        return "4+"
    if x <= 3:
        return "2-3"
    if x <= 6:
        return "4-6"
    return "7+"


def summarize_split(
    split: str,
    events: list[dict],
    signals: list[dict],
    records: list[dict],
) -> dict:
    es = [e for e in events if e["split"] == split]
    ss = [s for s in signals if s["split"] == split]
    entries = [s for s in ss if s["status"] == "DC_RESUMPTION_ENTRY"]
    out = {
        "confirmed_trend_episodes": int(len(es)),
        "entries": int(len(entries)),
        "coverage": float(len(entries) / len(es)) if es else None,
        "no_entry_reason_counts": dict(Counter(s["status"] for s in ss)),
        "up_entries": int(sum(s.get("direction") == 1 and s["status"] == "DC_RESUMPTION_ENTRY" for s in ss)),
        "down_entries": int(sum(s.get("direction") == -1 and s["status"] == "DC_RESUMPTION_ENTRY" for s in ss)),
        "horizons": {},
    }
    for h in HORIZONS:
        rr = [r for r in records if r["split"] == split and r["horizon"] == h]
        out["horizons"][str(h)] = metrics(rr)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--handoff-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root)
    state_run = Path(a.state_run)
    handoff_run = Path(a.handoff_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    if sha(handoff_run / "handoff_records.jsonl") != EXPECTED_HANDOFF:
        raise ValueError("handoff hash changed")
    if sha(state_run / "input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("state manifest hash changed")

    state = pd.read_csv(state_run / "state_sequence.csv.gz")
    if state_content_hash(state.state) != EXPECTED_STATE_CONTENT:
        raise ValueError("state content hash changed")

    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "fine_threshold": FINE_THRESHOLD,
            "macro_threshold": MACRO_THRESHOLD,
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    events = [
        e for e in load_jsonl(handoff_run / "handoff_records.jsonl")
        if e.get("resolution") in ("TREND_UP", "TREND_DOWN")
        and e.get("split") in ("library", "evaluation")
    ]
    eval_events = [e for e in events if e["split"] == "evaluation"]
    if len(eval_events) != 280:
        raise ValueError(f"expected 280 evaluation confirmed trends, got {len(eval_events)}")

    f, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    if json.loads((out / "input_manifest.json").read_text()) != json.loads(
        (state_run / "input_manifest.json").read_text()
    ):
        raise ValueError("canonical manifest mismatch")

    close = f.bc.to_numpy(dtype=float)
    fine = dc_states(close, FINE_THRESHOLD)
    macro = dc_states(close, MACRO_THRESHOLD)
    t = f.t.to_numpy(dtype=np.int64)
    t_to_i = {int(v): i for i, v in enumerate(t)}
    state_by_time = {
        int(r.t): str(r.state)
        for r in state[["t", "state"]].itertuples(index=False)
    }

    prefix_checks = {}
    for split in ("library", "evaluation"):
        ee = [e for e in events if e["split"] == split]
        if not ee:
            continue
        q = t_to_i[int(ee[0]["resolution_time"])]
        pf = dc_states(close[:q + 1], FINE_THRESHOLD)
        pm = dc_states(close[:q + 1], MACRO_THRESHOLD)
        if pf != fine[:q + 1] or pm != macro[:q + 1]:
            raise AssertionError(f"DC prefix invariance failed {split}")
        prefix_checks[split] = "PASS"

    signals = []
    records = []
    for e in events:
        sig = search_signal(e, f, state_by_time, t_to_i, fine, macro)
        sig.update({
            "event_id": int(e["event_id"]),
            "split": e["split"],
            "resolution_time": int(e["resolution_time"]),
            "direction": int(e["resolved_direction"]),
        })
        signals.append(sig)
        if sig["status"] == "DC_RESUMPTION_ENTRY":
            for h in HORIZONS:
                rec = execution_record(e, sig, f, h)
                if rec is not None:
                    records.append(rec)

    with (out / "signals.jsonl").open("w", encoding="utf-8") as fh:
        for s in signals:
            fh.write(json.dumps(s, allow_nan=False) + "\n")
    with (out / "records.jsonl").open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, allow_nan=False) + "\n")

    reports = {
        split: summarize_split(split, events, signals, records)
        for split in ("library", "evaluation")
    }

    eval_entries = [
        s for s in signals
        if s["split"] == "evaluation" and s["status"] == "DC_RESUMPTION_ENTRY"
    ]
    by_dir = {}
    by_year_h12 = {}
    duration_diag = {}
    total_delay_diag = {}
    for h in HORIZONS:
        rr = [r for r in records if r["split"] == "evaluation" and r["horizon"] == h]
        by_dir[str(h)] = {
            "up": metrics([r for r in rr if r["direction"] == 1]),
            "down": metrics([r for r in rr if r["direction"] == -1]),
        }
        duration_diag[str(h)] = {
            b: metrics([r for r in rr if delay_bin(r, "correction_duration_bars") == b])
            for b in ("1", "2-3", "4+")
        }
        total_delay_diag[str(h)] = {
            b: metrics([r for r in rr if delay_bin(r, "total_delay_bars") == b])
            for b in ("2-3", "4-6", "7+")
        }

    rr12 = [r for r in records if r["split"] == "evaluation" and r["horizon"] == 12]
    for year in sorted({r["year"] for r in rr12}):
        yy = [r for r in rr12 if r["year"] == year]
        by_year_h12[str(year)] = metrics(yy) if len(yy) >= 10 else {"n": len(yy)}

    h12 = reports["evaluation"]["horizons"]["12"]
    h24 = reports["evaluation"]["horizons"]["24"]
    full_year_positive = sum(
        1 for y in ("2021", "2022", "2023")
        if by_year_h12.get(y, {}).get("n", 0) >= 10
        and by_year_h12[y].get("c1_mean_per_trade", -999) > 0
    )
    screen = {
        "evaluation_entries_ge_40": len(eval_entries) >= 40,
        "both_sides_ge_15": (
            reports["evaluation"]["up_entries"] >= 15
            and reports["evaluation"]["down_entries"] >= 15
        ),
        "h12_mature_ge_30": h12.get("n", 0) >= 30,
        "h24_mature_ge_25": h24.get("n", 0) >= 25,
        "h12_c1_positive": h12.get("c1_mean_per_trade", -999) > 0,
        "h24_c1_positive": h24.get("c1_mean_per_trade", -999) > 0,
        "one_long_horizon_c2_nonnegative": (
            h12.get("c2_mean_per_trade", -999) >= 0
            or h24.get("c2_mean_per_trade", -999) >= 0
        ),
        "one_long_horizon_c1_win_gt_0_50": (
            h12.get("c1_win_rate", 0) > 0.50
            or h24.get("c1_win_rate", 0) > 0.50
        ),
        "positive_h12_c1_two_full_years": full_year_positive >= 2,
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG DC Correction -> Resumption Swing v0.1 development diagnostic",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "thresholds": {"fine": FINE_THRESHOLD, "macro": MACRO_THRESHOLD},
        "reports": reports,
        "evaluation_by_direction": by_dir,
        "evaluation_h12_by_year": by_year_h12,
        "evaluation_correction_duration_diagnostic": duration_diag,
        "evaluation_total_delay_diagnostic": total_delay_diag,
        "registered_screen": screen,
        "integrity": {
            "handoff_hash_unchanged": "PASS",
            "state_content_hash_unchanged": "PASS",
            "source_manifest_unchanged": "PASS",
            "dc_prefix_invariance": prefix_checks,
            "search_after_resolution": "PASS",
            "fine_correction_then_resumption": "PASS",
            "macro_alignment_required": "PASS",
            "first_valid_signal_only": "PASS",
            "entry_after_resumption": "PASS",
            "no_hard_gap_bridging": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "evidence_status": "DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION",
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "evaluation": reports["evaluation"],
        "by_direction": by_dir,
        "h12_by_year": by_year_h12,
        "screen": screen,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
