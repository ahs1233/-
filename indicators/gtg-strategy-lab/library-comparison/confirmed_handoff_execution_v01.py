"""GTG Confirmed Handoff Execution v0.1.

Post-selection diagnostic of entering only after frozen FSM TREND confirmation.
No state/model refit and no Holdout access.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
from compare import costs
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END, STEP

PROTOCOL = HERE / "PROTOCOL_CONFIRMED_HANDOFF_EXECUTION_V0_1.md"
HORIZONS = (4, 12, 24)

EXPECTED_SHA = {
    "handoff_records.jsonl": "45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd",
    "handoff_summary.json": "bc0902d4c348baf6c01d63c72679d1cca0c94e046f8fe9ea0805eb3b4f42e22e",
    "state_input_manifest.json": "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a",
    "shadow_summary.json": "9a2220effc20c35548a25caf6e5c568dd4c79580b1a2a4b9806d6b03bb8a9207",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    out = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                out.append(json.loads(line))
    return out


def path_ok(t: np.ndarray, i: int, h: int) -> bool:
    if i + h >= len(t):
        return False
    d = np.diff(t[i:i+h+1])
    return bool(
        int(t[i+h]) < ms(RAW_END)
        and np.all(d > 0)
        and np.all(d <= MAX_CONTIG_GAP)
    )


def trade_record(e: dict, f: pd.DataFrame, q: int, h: int) -> dict | None:
    t = f.t.to_numpy(dtype=np.int64)
    if not path_ok(t, q, h) or q + 1 >= len(f):
        return None

    direction = int(e["resolved_direction"])
    if direction not in (-1, 1):
        raise ValueError("resolved direction must be +/-1")

    expected = 1 if e["resolution"] == "TREND_UP" else -1 if e["resolution"] == "TREND_DOWN" else 0
    if direction != expected:
        raise ValueError("resolution/direction mismatch")

    atr = float(f.atr.iloc[q])
    if not np.isfinite(atr) or atr <= 0:
        return None

    signed_disp = direction * (float(f.bc.iloc[q+h]) - float(f.bc.iloc[q])) / atr
    path_hi = float(f.bh.iloc[q+1:q+h+1].max())
    path_lo = float(f.bl.iloc[q+1:q+h+1].min())
    start_close = float(f.bc.iloc[q])
    if direction == 1:
        mfe = (path_hi - start_close) / atr
        mae = (start_close - path_lo) / atr
    else:
        mfe = (start_close - path_lo) / atr
        mae = (path_hi - start_close) / atr

    closes = f.bc.iloc[q+1:q+h+1].to_numpy(dtype=float)
    lower = float(e["frozen_lower"])
    upper = float(e["frozen_upper"])
    returned = bool(np.any((closes >= lower) & (closes <= upper)))

    cc = costs(
        direction,
        float(f.bo.iloc[q+1]),
        float(f.ao.iloc[q+1]),
        float(f.bc.iloc[q+h]),
        float(f.ac.iloc[q+h]),
        atr,
    )

    return {
        "event_id": int(e["event_id"]),
        "onset_time": int(e["onset_time"]),
        "resolution_time": int(e["resolution_time"]),
        "resolution_delay_bars": int(e["resolution_delay_bars"]),
        "year": int(pd.to_datetime(e["resolution_time"], unit="ms", utc=True).year),
        "direction": direction,
        "horizon": int(h),
        "signed_displacement_atr": float(signed_disp),
        "directional_correct": bool(signed_disp > 0),
        "mfe_atr": float(mfe),
        "mae_atr": float(mae),
        "returned_inside": returned,
        "c0": float(cc["c0"]),
        "c1": float(cc["c1"]),
        "c2": float(cc["c2"]),
    }


def summarize(rows: list[dict]) -> dict:
    if not rows:
        return {}
    return {
        "active_trades": int(len(rows)),
        "directional_accuracy": float(np.mean([r["directional_correct"] for r in rows])),
        "mean_signed_displacement_atr": float(np.mean([r["signed_displacement_atr"] for r in rows])),
        "mean_mfe_atr": float(np.mean([r["mfe_atr"] for r in rows])),
        "mean_mae_atr": float(np.mean([r["mae_atr"] for r in rows])),
        "returned_inside_fraction": float(np.mean([r["returned_inside"] for r in rows])),
        "c1_win_rate": float(np.mean([r["c1"] > 0 for r in rows])),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
    }


def subgroup(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    return {
        "n": int(len(rows)),
        "directional_accuracy": float(np.mean([r["directional_correct"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--handoff-run", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--shadow-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root)
    handoff = Path(a.handoff_run)
    state = Path(a.state_run)
    shadow = Path(a.shadow_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    targets = {
        "handoff_records.jsonl": handoff / "handoff_records.jsonl",
        "handoff_summary.json": handoff / "summary.json",
        "state_input_manifest.json": state / "input_manifest.json",
        "shadow_summary.json": shadow / "summary.json",
    }
    for name, path in targets.items():
        actual = sha(path)
        if actual != EXPECTED_SHA[name]:
            raise ValueError(f"frozen input hash changed {name}: {actual}")

    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    handoff_rows = load_jsonl(handoff / "handoff_records.jsonl")
    cohort = [
        e for e in handoff_rows
        if e.get("split") == "evaluation"
        and e.get("resolution") in ("TREND_UP", "TREND_DOWN")
        and e.get("action") in ("SWING_LONG_CANDIDATE", "SWING_SHORT_CANDIDATE")
    ]
    if len(cohort) != 280:
        raise ValueError(f"expected 280 confirmed evaluation episodes, got {len(cohort)}")

    f, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    current_manifest = json.loads((out / "input_manifest.json").read_text(encoding="utf-8"))
    source_manifest = json.loads((state / "input_manifest.json").read_text(encoding="utf-8"))
    if current_manifest != source_manifest:
        raise ValueError("canonical H1 manifest differs from State Engine v0.2")

    t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
    records = []
    for e in cohort:
        rt = int(e["resolution_time"])
        if rt not in t_to_i:
            raise ValueError(f"resolution timestamp absent from H1 {rt}")
        q = t_to_i[rt]
        for h in HORIZONS:
            rec = trade_record(e, f, q, h)
            if rec is not None:
                records.append(rec)

    with (out / "records.jsonl").open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, allow_nan=False) + "\n")

    horizon_summary = {}
    by_direction = {}
    by_year = {}
    for h in HORIZONS:
        rr = [r for r in records if r["horizon"] == h]
        horizon_summary[str(h)] = summarize(rr)
        by_direction[str(h)] = {
            "up": subgroup([r for r in rr if r["direction"] == 1]),
            "down": subgroup([r for r in rr if r["direction"] == -1]),
        }
        years = {}
        for year in sorted({r["year"] for r in rr}):
            yy = [r for r in rr if r["year"] == year]
            years[str(year)] = subgroup(yy) if len(yy) >= 10 else {"n": len(yy)}
        by_year[str(h)] = years

    h4 = horizon_summary["4"]
    screen = {
        "active_trades_ge_150": h4["active_trades"] >= 150,
        "c0_positive": h4["c0_mean_per_trade"] > 0,
        "c1_positive": h4["c1_mean_per_trade"] > 0,
        "c2_nonnegative": h4["c2_mean_per_trade"] >= 0,
        "c1_win_rate_gt_0_50": h4["c1_win_rate"] > 0.50,
        "both_sides_ge_50": (
            by_direction["4"]["up"]["n"] >= 50 and
            by_direction["4"]["down"]["n"] >= 50
        ),
    }
    screen["pass"] = bool(all(screen.values()))

    shadow_summary = json.loads((shadow / "summary.json").read_text(encoding="utf-8"))
    comparison_h4 = {
        "ALL_TRANSITIONS_ONSET": shadow_summary["summary"]["ALL_TRANSITIONS"]["4"],
        "LOGISTIC_GATE_ONSET": shadow_summary["summary"]["LOGISTIC_GATE"]["4"],
        "CONFIRMED_HANDOFF": h4,
        "ORACLE_TREND_SUBSET_ONSET": shadow_summary["summary"]["ORACLE_TREND_SUBSET"]["4"],
    }

    report = {
        "scope": "GTG Confirmed Handoff Execution v0.1 post-selection diagnostic",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "confirmed_evaluation_episodes": 280,
        "summary": horizon_summary,
        "by_direction": by_direction,
        "by_year": by_year,
        "comparison_h4": comparison_h4,
        "registered_h4_screen": screen,
        "integrity": {
            "frozen_input_hashes_unchanged": "PASS",
            "confirmed_cohort_exact_280": "PASS",
            "resolution_direction_match": "PASS",
            "source_manifest_match": "PASS",
            "entry_after_resolution": "PASS",
            "market_continuity_le_3h": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "evidence_status": "POST_SELECTION_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION",
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    print(json.dumps({
        "h4": h4,
        "h12": horizon_summary["12"],
        "h24": horizon_summary["24"],
        "by_direction_h4": by_direction["4"],
        "screen": screen,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
