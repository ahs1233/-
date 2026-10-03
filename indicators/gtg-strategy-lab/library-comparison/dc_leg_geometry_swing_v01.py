"""GTG DC Leg Geometry Swing v0.1.

Parameter-light structural filter over frozen DC correction/resumption signals.
No outcome field enters the filter.
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
from compare import dc_states
from regime_atlas_v01 import load_h1
from state_transition_engine_v02 import RAW_END

PROTOCOL = HERE / "PROTOCOL_DC_LEG_GEOMETRY_SWING_V0_1.md"
FINE_THRESHOLD = 0.0025
HORIZONS = (4, 12, 24)

EXPECTED = {
    "signals": "3c8fc33e85e317ae45e91e01458d6074a2cc8b6764c95e4edf98b80103f8a736",
    "records": "d2d11157e64481667d4212b241a0c95c96fa0630e19bfd6b04689ec81725a13f",
    "summary": "bb17fbecfb3a8cb08287c91a4bbc484992287a465a4fa82abda3cffb4082dc60",
    "handoff": "45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd",
    "manifest": "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as fh:
        return [json.loads(x) for x in fh if x.strip()]


def previous_confirmation(states: list[dict], c: int) -> int | None:
    for i in range(c - 1, -1, -1):
        if int(states[i]["confirmed_at"]) == i:
            return i
    return None


def leg_geometry(
    signal: dict,
    event: dict,
    f: pd.DataFrame,
    fine: list[dict],
) -> dict:
    c = int(signal["correction_idx"])
    s = int(signal["signal_idx"])
    d = int(signal["direction"])
    if not (0 <= c < s < len(f)):
        raise ValueError("bad correction/signal indices")
    if int(fine[c]["confirmed_at"]) != c or int(fine[c]["direction"]) != -d:
        raise ValueError("correction is not a fresh opposite fine DC confirmation")
    if int(fine[s]["confirmed_at"]) != s or int(fine[s]["direction"]) != d:
        raise ValueError("signal is not a fresh resumption fine DC confirmation")

    p = previous_confirmation(fine, c)
    if p is None:
        return {"status": "NO_PREVIOUS_FINE_CONFIRMATION"}
    if int(fine[p]["direction"]) != d:
        return {"status": "PREVIOUS_FINE_DIRECTION_MISMATCH"}

    impulse_start_price = float(fine[p]["pivot_price"])
    impulse_end_price = float(fine[c]["pivot_price"])
    correction_end_price = float(fine[s]["pivot_price"])
    impulse_start_idx = int(fine[p]["pivot_at"])
    impulse_end_idx = int(fine[c]["pivot_at"])
    correction_end_idx = int(fine[s]["pivot_at"])

    impulse_amp = float(d * (impulse_end_price - impulse_start_price))
    correction_amp = float(d * (impulse_end_price - correction_end_price))
    impulse_bars = int(impulse_end_idx - impulse_start_idx)
    correction_bars = int(correction_end_idx - impulse_end_idx)

    if impulse_amp <= 0 or correction_amp <= 0 or impulse_bars <= 0 or correction_bars <= 0:
        return {
            "status": "INVALID_LEG_GEOMETRY",
            "impulse_amp": impulse_amp,
            "correction_amp": correction_amp,
            "impulse_bars": impulse_bars,
            "correction_bars": correction_bars,
        }

    impulse_speed = impulse_amp / impulse_bars
    correction_speed = correction_amp / correction_bars
    depth_ratio = correction_amp / impulse_amp
    speed_ratio = correction_speed / impulse_speed

    atr = float(f.atr.iloc[s])
    if not np.isfinite(atr) or atr <= 0:
        return {"status": "INVALID_SIGNAL_ATR"}

    boundary = float(event["frozen_upper"] if d == 1 else event["frozen_lower"])
    close_s = float(f.bc.iloc[s])
    boundary_distance_atr = float(d * (close_s - boundary) / atr)

    passed = bool(
        impulse_amp > correction_amp
        and correction_speed < impulse_speed
        and boundary_distance_atr > 0
    )

    return {
        "status": "OK",
        "previous_confirmation_idx": int(p),
        "impulse_start_idx": impulse_start_idx,
        "impulse_end_idx": impulse_end_idx,
        "correction_end_idx": correction_end_idx,
        "impulse_amp": impulse_amp,
        "correction_amp": correction_amp,
        "impulse_bars": impulse_bars,
        "correction_bars": correction_bars,
        "impulse_speed": float(impulse_speed),
        "correction_speed": float(correction_speed),
        "depth_ratio": float(depth_ratio),
        "speed_ratio": float(speed_ratio),
        "impulse_amp_atr": float(impulse_amp / atr),
        "correction_amp_atr": float(correction_amp / atr),
        "signal_distance_from_boundary_atr": boundary_distance_atr,
        "filter_pass": passed,
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
    }


def geom_stats(rows: list[dict]) -> dict:
    good = [r for r in rows if r.get("status") == "OK"]
    if not good:
        return {"n": 0}
    return {
        "n": len(good),
        "depth_ratio_median": float(np.median([r["depth_ratio"] for r in good])),
        "speed_ratio_median": float(np.median([r["speed_ratio"] for r in good])),
        "impulse_amp_atr_median": float(np.median([r["impulse_amp_atr"] for r in good])),
        "correction_amp_atr_median": float(np.median([r["correction_amp_atr"] for r in good])),
        "boundary_distance_atr_median": float(np.median([r["signal_distance_from_boundary_atr"] for r in good])),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--dc-run", required=True)
    ap.add_argument("--handoff-run", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root)
    dc_run = Path(a.dc_run)
    handoff_run = Path(a.handoff_run)
    state_run = Path(a.state_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    targets = {
        "signals": dc_run / "signals.jsonl",
        "records": dc_run / "records.jsonl",
        "summary": dc_run / "summary.json",
        "handoff": handoff_run / "handoff_records.jsonl",
        "manifest": state_run / "input_manifest.json",
    }
    for key, path in targets.items():
        actual = sha(path)
        if actual != EXPECTED[key]:
            raise ValueError(f"frozen source hash changed {key}: {actual}")

    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "fine_threshold": FINE_THRESHOLD,
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    signals = [
        s for s in load_jsonl(dc_run / "signals.jsonl")
        if s.get("status") == "DC_RESUMPTION_ENTRY"
    ]
    source_records = load_jsonl(dc_run / "records.jsonl")
    handoff = load_jsonl(handoff_run / "handoff_records.jsonl")
    event_map = {
        (e["split"], int(e["event_id"])): e
        for e in handoff
        if e.get("split") in ("library", "evaluation")
    }

    f, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    if json.loads((out / "input_manifest.json").read_text()) != json.loads(
        (state_run / "input_manifest.json").read_text()
    ):
        raise ValueError("canonical manifest mismatch")

    fine = dc_states(f.bc.to_numpy(dtype=float), FINE_THRESHOLD)

    geometry = []
    for s in signals:
        key = (s["split"], int(s["event_id"]))
        if key not in event_map:
            raise ValueError(f"source event missing {key}")
        e = event_map[key]
        if int(e["resolved_direction"]) != int(s["direction"]):
            raise ValueError("signal/event direction mismatch")
        g = leg_geometry(s, e, f, fine)
        g.update({
            "event_id": int(s["event_id"]),
            "split": s["split"],
            "direction": int(s["direction"]),
            "resolution_time": int(s["resolution_time"]),
            "correction_idx": int(s["correction_idx"]),
            "signal_idx": int(s["signal_idx"]),
        })
        geometry.append(g)

    with (out / "geometry.jsonl").open("w", encoding="utf-8") as fh:
        for g in geometry:
            fh.write(json.dumps(g, allow_nan=False) + "\n")

    passed = {
        (g["split"], g["event_id"])
        for g in geometry
        if g.get("status") == "OK" and g.get("filter_pass") is True
    }

    reports = {}
    for split in ("library", "evaluation"):
        sig_split = [g for g in geometry if g["split"] == split]
        filt_split = [g for g in sig_split if (g["split"], g["event_id"]) in passed]
        reports[split] = {
            "source_entries": len(sig_split),
            "geometry_valid": int(sum(g.get("status") == "OK" for g in sig_split)),
            "filtered_entries": len(filt_split),
            "retained_fraction": float(len(filt_split) / len(sig_split)) if sig_split else None,
            "invalid_geometry_counts": dict(Counter(
                g["status"] for g in sig_split if g.get("status") != "OK"
            )),
            "source_geometry": geom_stats(sig_split),
            "filtered_geometry": geom_stats(filt_split),
            "horizons": {},
        }
        for h in HORIZONS:
            all_rows = [
                r for r in source_records
                if r["split"] == split and int(r["horizon"]) == h
            ]
            filtered_rows = [
                r for r in all_rows
                if (r["split"], int(r["event_id"])) in passed
            ]
            reports[split]["horizons"][str(h)] = {
                "ALL_DC_RESUMPTIONS": metrics(all_rows),
                "LEG_GEOMETRY_FILTER": metrics(filtered_rows),
            }

    eval_h4 = [
        r for r in source_records
        if r["split"] == "evaluation" and int(r["horizon"]) == 4
        and ("evaluation", int(r["event_id"])) in passed
    ]
    by_direction_h4 = {
        "up": metrics([r for r in eval_h4 if int(r["direction"]) == 1]),
        "down": metrics([r for r in eval_h4 if int(r["direction"]) == -1]),
    }
    by_year_h4 = {}
    for year in sorted({int(r["year"]) for r in eval_h4}):
        rr = [r for r in eval_h4 if int(r["year"]) == year]
        by_year_h4[str(year)] = metrics(rr) if len(rr) >= 5 else {"n": len(rr)}

    lib_h4 = reports["library"]["horizons"]["4"]["LEG_GEOMETRY_FILTER"]
    ev_h4 = reports["evaluation"]["horizons"]["4"]["LEG_GEOMETRY_FILTER"]
    ev_all_h4 = reports["evaluation"]["horizons"]["4"]["ALL_DC_RESUMPTIONS"]
    positive_years = sum(
        1 for y in ("2021", "2022", "2023")
        if by_year_h4.get(y, {}).get("n", 0) >= 5
        and by_year_h4[y].get("c1_mean_per_trade", -999) > 0
    )
    screen = {
        "library_h4_n_ge_10": lib_h4.get("n", 0) >= 10,
        "evaluation_h4_n_ge_15": ev_h4.get("n", 0) >= 15,
        "evaluation_both_sides_ge_5": (
            by_direction_h4["up"].get("n", 0) >= 5
            and by_direction_h4["down"].get("n", 0) >= 5
        ),
        "library_h4_c1_positive": lib_h4.get("c1_mean_per_trade", -999) > 0,
        "evaluation_h4_c1_positive": ev_h4.get("c1_mean_per_trade", -999) > 0,
        "library_h4_c2_nonnegative": lib_h4.get("c2_mean_per_trade", -999) >= 0,
        "evaluation_h4_c2_nonnegative": ev_h4.get("c2_mean_per_trade", -999) >= 0,
        "evaluation_h4_c1_win_gt_0_50": ev_h4.get("c1_win_rate", 0) > 0.50,
        "positive_two_evaluation_full_years": positive_years >= 2,
        "evaluation_c1_better_than_all_dc": (
            ev_h4.get("c1_mean_per_trade", -999)
            > ev_all_h4.get("c1_mean_per_trade", 999)
        ),
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG DC Leg Geometry Swing v0.1 development diagnostic",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "reports": reports,
        "evaluation_h4_by_direction": by_direction_h4,
        "evaluation_h4_by_year": by_year_h4,
        "registered_stability_screen": screen,
        "integrity": {
            "frozen_source_hashes_unchanged": "PASS",
            "canonical_manifest_unchanged": "PASS",
            "source_signal_timing_unchanged": "PASS",
            "geometry_uses_confirmed_pivots_only": "PASS",
            "no_delay_bin_selection": "PASS",
            "no_outcome_field_in_filter": "PASS",
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
        "by_direction_h4": by_direction_h4,
        "by_year_h4": by_year_h4,
        "screen": screen,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
