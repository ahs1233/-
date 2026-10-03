"""GTG Transition Logistic Shadow v0.1.

Post-selection execution audit of the frozen Logistic transition classifier.
No model refit, no threshold tuning, no Holdout access.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
from compare import costs
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END, STEP

PROTOCOL = HERE / "PROTOCOL_TRANSITION_LOGISTIC_SHADOW_V0_1.md"
HORIZONS = (4, 12, 24)
THRESHOLD = 0.50

EXPECTED_SHA = {
    "frozen_memory.json": "0dc860e3291e3f288580aa7b52187f86d05108fc44d67061da0320a8db82e410",
    "evaluation_predictions.jsonl": "a4da81fef57742c86d3ee341eef8862e9bd9321bca69917798b830b7927e0e6c",
    "transition_memory_summary.json": "87f2cd444d11a859d35d735d0a989be7660e78ddad86f87d0d49e6e2576dd528",
    "transition_library.jsonl": "e134c33eac1109efa7c1e81ad7d71de238344ad0fb763e0e93c47b29d2b5a565",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def path_ok(t: np.ndarray, i: int, h: int) -> bool:
    if i + h >= len(t):
        return False
    d = np.diff(t[i:i+h+1])
    return bool(
        int(t[i+h]) < ms(RAW_END)
        and np.all(d > 0)
        and np.all(d <= MAX_CONTIG_GAP)
    )


def policy_active(name: str, pred: dict) -> bool:
    if name == "ALL_TRANSITIONS":
        return True
    if name == "LOGISTIC_GATE":
        return float(pred["p_logistic"]) >= THRESHOLD
    if name == "ORACLE_TREND_SUBSET":
        return int(pred["actual_label"]) == 1
    raise ValueError(name)


def trade_record(
    policy: str,
    pred: dict,
    event: dict,
    f: pd.DataFrame,
    q: int,
    h: int,
) -> dict | None:
    t = f.t.to_numpy(dtype=np.int64)
    if not path_ok(t, q, h):
        return None
    if q + 1 >= len(f):
        return None

    direction = int(event["candidate_direction"])
    if direction not in (-1, 1):
        raise ValueError("bad candidate direction")

    atr = float(f.atr.iloc[q])
    if not np.isfinite(atr) or atr <= 0:
        return None

    active = policy_active(policy, pred)
    actual_trend = int(pred["actual_label"]) == 1

    signed_disp = float(
        direction * (float(f.bc.iloc[q+h]) - float(f.bc.iloc[q])) / atr
    )

    path_hi = float(f.bh.iloc[q+1:q+h+1].max())
    path_lo = float(f.bl.iloc[q+1:q+h+1].min())
    start_close = float(f.bc.iloc[q])
    if direction == 1:
        mfe = (path_hi - start_close) / atr
        mae = (start_close - path_lo) / atr
    else:
        mfe = (start_close - path_lo) / atr
        mae = (path_hi - start_close) / atr

    lower = float(event["frozen_lower"])
    upper = float(event["frozen_upper"])
    closes = f.bc.iloc[q+1:q+h+1].to_numpy(dtype=float)
    returned_inside = bool(np.any((closes >= lower) & (closes <= upper)))

    if active:
        cc = costs(
            direction,
            float(f.bo.iloc[q+1]),
            float(f.ao.iloc[q+1]),
            float(f.bc.iloc[q+h]),
            float(f.ac.iloc[q+h]),
            atr,
        )
    else:
        cc = {"c0": 0.0, "c1": 0.0, "c2": 0.0}

    return {
        "policy": policy,
        "horizon": int(h),
        "event_id": int(event["event_id"]),
        "time": int(event["time"]),
        "year": int(pd.to_datetime(event["time"], unit="ms", utc=True).year),
        "direction": direction,
        "p_logistic": float(pred["p_logistic"]),
        "actual_label": int(pred["actual_label"]),
        "actual_trend": bool(actual_trend),
        "active": bool(active),
        "signed_displacement_atr": signed_disp,
        "directional_correct": bool(signed_disp > 0),
        "mfe_atr": float(mfe),
        "mae_atr": float(mae),
        "returned_inside": returned_inside,
        "c0": float(cc["c0"]),
        "c1": float(cc["c1"]),
        "c2": float(cc["c2"]),
    }


def summarize(rows: list[dict]) -> dict:
    if not rows:
        return {}
    n = len(rows)
    active = [r for r in rows if r["active"]]
    out = {
        "eligible_opportunities": int(n),
        "active_trades": int(len(active)),
        "coverage": float(len(active) / n),
        "actual_trend_precision": (
            float(np.mean([r["actual_trend"] for r in active]))
            if active else None
        ),
        "directional_accuracy": (
            float(np.mean([r["directional_correct"] for r in active]))
            if active else None
        ),
        "mean_signed_displacement_atr": (
            float(np.mean([r["signed_displacement_atr"] for r in active]))
            if active else None
        ),
        "mean_mfe_atr": (
            float(np.mean([r["mfe_atr"] for r in active])) if active else None
        ),
        "mean_mae_atr": (
            float(np.mean([r["mae_atr"] for r in active])) if active else None
        ),
        "returned_inside_fraction": (
            float(np.mean([r["returned_inside"] for r in active]))
            if active else None
        ),
        "c1_win_rate": (
            float(np.mean([r["c1"] > 0 for r in active])) if active else None
        ),
    }
    for c in ("c0", "c1", "c2"):
        out[f"{c}_mean_per_trade"] = (
            float(np.mean([r[c] for r in active])) if active else None
        )
        out[f"{c}_mean_per_opportunity"] = float(
            np.mean([r[c] for r in rows])
        )
    return out


def subgroup_summary(rows: list[dict]) -> dict:
    active = [r for r in rows if r["active"]]
    if not active:
        return {"active": 0}
    return {
        "active": int(len(active)),
        "precision": float(np.mean([r["actual_trend"] for r in active])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in active])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in active])),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--memory-run", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root)
    memory = Path(a.memory_run)
    state = Path(a.state_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    targets = {
        "frozen_memory.json": memory / "frozen_memory.json",
        "evaluation_predictions.jsonl": memory / "evaluation_predictions.jsonl",
        "transition_memory_summary.json": memory / "summary.json",
        "transition_library.jsonl": state / "transition_library.jsonl",
    }
    for name, path in targets.items():
        actual = sha(path).lower()
        if actual != EXPECTED_SHA[name]:
            raise ValueError(f"frozen input hash changed {name}: {actual}")

    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "threshold": THRESHOLD,
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    preds = load_jsonl(memory / "evaluation_predictions.jsonl")
    events_all = load_jsonl(state / "transition_library.jsonl")
    events = {
        (int(e["event_id"]), int(e["time"])): e
        for e in events_all
        if e.get("primary") and e.get("split") == "evaluation"
    }

    if len(preds) != 454:
        raise ValueError(f"expected 454 classifier rows, got {len(preds)}")

    for p in preds:
        key = (int(p["event_id"]), int(p["time"]))
        if key not in events:
            raise ValueError(f"prediction missing source event {key}")
        e = events[key]
        if int(e["candidate_direction"]) != int(p["candidate_direction"]):
            raise ValueError("candidate direction mismatch")
        expected_label = (
            0 if e["fsm_resolution"] == "RANGE"
            else 1 if e["fsm_resolution"] in ("TREND_UP", "TREND_DOWN")
            else None
        )
        if expected_label is None or expected_label != int(p["actual_label"]):
            raise ValueError("resolution label mismatch")

    f, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    source_manifest = json.loads(
        (state / "input_manifest.json").read_text(encoding="utf-8")
    )
    current_manifest = json.loads(
        (out / "input_manifest.json").read_text(encoding="utf-8")
    )
    if current_manifest != source_manifest:
        raise ValueError("H1 source manifest differs from State Engine v0.2")

    t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
    rows = []
    for p in preds:
        key = (int(p["event_id"]), int(p["time"]))
        e = events[key]
        if int(e["time"]) not in t_to_i:
            raise ValueError("event onset missing from H1")
        q = t_to_i[int(e["time"])]
        for h in HORIZONS:
            for policy in (
                "ALL_TRANSITIONS",
                "LOGISTIC_GATE",
                "ORACLE_TREND_SUBSET",
            ):
                rec = trade_record(policy, p, e, f, q, h)
                if rec is not None:
                    rows.append(rec)

    with (out / "records.jsonl").open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")

    summary = {}
    for policy in ("ALL_TRANSITIONS", "LOGISTIC_GATE", "ORACLE_TREND_SUBSET"):
        summary[policy] = {}
        for h in HORIZONS:
            rr = [r for r in rows if r["policy"] == policy and r["horizon"] == h]
            summary[policy][str(h)] = summarize(rr)

    gate4 = [
        r for r in rows
        if r["policy"] == "LOGISTIC_GATE" and r["horizon"] == 4
    ]
    active4 = [r for r in gate4 if r["active"]]
    all4 = summary["ALL_TRANSITIONS"]["4"]
    log4 = summary["LOGISTIC_GATE"]["4"]
    by_dir = {
        "up": subgroup_summary([r for r in gate4 if r["direction"] == 1]),
        "down": subgroup_summary([r for r in gate4 if r["direction"] == -1]),
    }

    avoided = [r for r in gate4 if not r["active"]]
    avoidance = {
        "avoided_events": int(len(avoided)),
        "avoided_range_resumed": int(sum(not r["actual_trend"] for r in avoided)),
        "avoided_trend_confirmed": int(sum(r["actual_trend"] for r in avoided)),
        "false_trend_trades": int(sum(not r["actual_trend"] for r in active4)),
    }

    yearly = {}
    for year in sorted({r["year"] for r in gate4}):
        rr = [r for r in gate4 if r["year"] == year]
        active = [r for r in rr if r["active"]]
        yearly[str(year)] = {
            "opportunities": len(rr),
            "active": len(active),
            "coverage": float(len(active)/len(rr)) if rr else None,
            "precision": (
                float(np.mean([r["actual_trend"] for r in active]))
                if len(active) >= 10 else None
            ),
            "c1_mean_per_trade": (
                float(np.mean([r["c1"] for r in active]))
                if len(active) >= 10 else None
            ),
        }

    screen = {
        "active_trades_ge_150": log4["active_trades"] >= 150,
        "trend_precision_ge_0_70": log4["actual_trend_precision"] >= 0.70,
        "c0_positive": log4["c0_mean_per_trade"] > 0,
        "c1_positive": log4["c1_mean_per_trade"] > 0,
        "c1_better_than_all_transitions": (
            log4["c1_mean_per_trade"] > all4["c1_mean_per_trade"]
        ),
        "c2_nonnegative": log4["c2_mean_per_trade"] >= 0,
        "both_sides_ge_50": by_dir["up"]["active"] >= 50 and by_dir["down"]["active"] >= 50,
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Transition Logistic Shadow v0.1 post-selection diagnostic",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "frozen_input_hashes": EXPECTED_SHA,
        "threshold": THRESHOLD,
        "summary": summary,
        "logistic_h4_avoidance": avoidance,
        "logistic_h4_by_direction": by_dir,
        "logistic_h4_by_year": yearly,
        "registered_h4_screen": screen,
        "integrity": {
            "frozen_input_hashes_unchanged": "PASS",
            "prediction_event_exact_join": "PASS",
            "candidate_direction_match": "PASS",
            "source_manifest_match": "PASS",
            "decision_uses_no_actual_resolution": "PASS",
            "threshold_unchanged_0_50": "PASS",
            "entry_after_onset": "PASS",
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
        "ALL_h4": all4,
        "LOGISTIC_h4": log4,
        "LOGISTIC_h12": summary["LOGISTIC_GATE"]["12"],
        "LOGISTIC_h24": summary["LOGISTIC_GATE"]["24"],
        "avoidance": avoidance,
        "by_direction": by_dir,
        "screen": screen,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
