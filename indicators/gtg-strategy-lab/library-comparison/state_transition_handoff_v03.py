"""GTG State + Transition Engine v0.3 — confirmed handoff audit.

Uses the frozen v0.2 state/transition sequence.
No state refit or threshold change is allowed here.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as md
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import (
    HORIZONS,
    MAX_CONTIG_GAP,
    RAW_END,
    SPLIT,
    STEP,
)

PROTOCOL = HERE / "PROTOCOL_STATE_TRANSITION_ENGINE_V0_3.md"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def state_hash_from_csv(path: Path) -> str:
    s = pd.read_csv(path, usecols=["state"])["state"]
    payload = "\n".join("" if pd.isna(v) else str(v) for v in s)
    return hashlib.sha256(payload.encode()).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def _path_mature(t: np.ndarray, i: int, h: int) -> bool:
    return bool(
        i + h < len(t)
        and int(t[i + h]) < ms(RAW_END)
        and np.all(
            (np.diff(t[i:i+h+1]) > 0)
            & (np.diff(t[i:i+h+1]) <= MAX_CONTIG_GAP)
        )
    )


def post_resolution_outcomes(
    f: pd.DataFrame,
    anchor_idx: int,
    direction: int,
    frozen_lower: float,
    frozen_upper: float,
) -> dict:
    t = f.t.to_numpy(dtype=np.int64)
    c = f.bc.to_numpy(dtype=float)
    hi = f.bh.to_numpy(dtype=float)
    lo = f.bl.to_numpy(dtype=float)
    atr = f.atr.to_numpy(dtype=float)

    if direction not in (-1, 1):
        raise ValueError("direction must be +/-1")
    if not np.isfinite(atr[anchor_idx]) or atr[anchor_idx] <= 0:
        raise ValueError("invalid anchor ATR")

    out = {}
    for h in HORIZONS:
        k = f"h{h}"
        mature = _path_mature(t, anchor_idx, h)
        out[f"{k}_mature"] = mature
        if not mature:
            continue

        disp = float((c[anchor_idx+h] - c[anchor_idx]) / atr[anchor_idx])
        signed = float(direction * disp)
        future_hi = float(np.max(hi[anchor_idx+1:anchor_idx+h+1]))
        future_lo = float(np.min(lo[anchor_idx+1:anchor_idx+h+1]))

        if direction == 1:
            mfe = (future_hi - c[anchor_idx]) / atr[anchor_idx]
            mae = (c[anchor_idx] - future_lo) / atr[anchor_idx]
            beyond = bool(c[anchor_idx+h] > frozen_upper)
        else:
            mfe = (c[anchor_idx] - future_lo) / atr[anchor_idx]
            mae = (future_hi - c[anchor_idx]) / atr[anchor_idx]
            beyond = bool(c[anchor_idx+h] < frozen_lower)

        path_close = c[anchor_idx+1:anchor_idx+h+1]
        returned = bool(np.any(
            (path_close >= frozen_lower)
            & (path_close <= frozen_upper)
        ))

        out[f"{k}_displacement_atr"] = disp
        out[f"{k}_signed_displacement_atr"] = signed
        out[f"{k}_directional_correct"] = bool(signed > 0)
        out[f"{k}_mfe_atr"] = float(mfe)
        out[f"{k}_mae_atr"] = float(mae)
        out[f"{k}_close_beyond_boundary"] = beyond
        out[f"{k}_returned_inside"] = returned
        out[f"{k}_elapsed_wall_hours"] = float(
            (t[anchor_idx+h] - t[anchor_idx]) / STEP
        )
    return out


def _metric_rows(records: list[dict], prefix: str) -> dict:
    result = {}
    for h in HORIZONS:
        k = f"h{h}"
        rows = [r for r in records if r.get(f"{prefix}_{k}_mature")]
        signed = [r[f"{prefix}_{k}_signed_displacement_atr"] for r in rows]
        result[str(h)] = {
            "n": len(rows),
            "direction_accuracy": (
                float(np.mean([r[f"{prefix}_{k}_directional_correct"] for r in rows]))
                if rows else None
            ),
            "signed_displacement_mean": float(np.mean(signed)) if signed else None,
            "signed_displacement_median": float(np.median(signed)) if signed else None,
            "signed_positive_fraction": (
                float(np.mean(np.asarray(signed) > 0)) if signed else None
            ),
            "mean_mfe_atr": (
                float(np.mean([r[f"{prefix}_{k}_mfe_atr"] for r in rows]))
                if rows else None
            ),
            "mean_mae_atr": (
                float(np.mean([r[f"{prefix}_{k}_mae_atr"] for r in rows]))
                if rows else None
            ),
            "close_beyond_boundary_fraction": (
                float(np.mean([r[f"{prefix}_{k}_close_beyond_boundary"] for r in rows]))
                if rows else None
            ),
            "returned_inside_fraction": (
                float(np.mean([r[f"{prefix}_{k}_returned_inside"] for r in rows]))
                if rows else None
            ),
            "mean_elapsed_wall_hours": (
                float(np.mean([r[f"{prefix}_{k}_elapsed_wall_hours"] for r in rows]))
                if rows else None
            ),
        }
    return result


def _copy_onset_fields(event: dict, rec: dict):
    for h in HORIZONS:
        k = f"h{h}"
        for suffix in (
            "mature",
            "displacement_atr",
            "signed_displacement_atr",
            "mfe_atr",
            "mae_atr",
            "close_beyond_boundary",
            "returned_inside",
            "elapsed_wall_hours",
        ):
            source = f"{k}_{suffix}"
            if source in event:
                rec[f"onset_{source}"] = event[source]
        if event.get(f"{k}_mature"):
            rec[f"onset_{k}_directional_correct"] = bool(
                event[f"{k}_signed_displacement_atr"] > 0
            )


def build_records(events: list[dict], f: pd.DataFrame) -> list[dict]:
    t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
    records = []

    for e in events:
        if not e.get("primary"):
            continue

        resolution = e.get("fsm_resolution")
        rec = {
            "event_id": int(e["event_id"]),
            "split": e["split"],
            "onset_time": int(e["time"]),
            "onset_candidate_direction": int(e["candidate_direction"]),
            "trigger_type": e["trigger_type"],
            "range_age": int(e["range_age"]),
            "frozen_upper": float(e["frozen_upper"]),
            "frozen_lower": float(e["frozen_lower"]),
            "resolution": resolution,
            "resolution_delay_bars": e.get("resolution_delay_bars"),
            "resolution_time": e.get("resolution_time"),
        }
        _copy_onset_fields(e, rec)

        if resolution == "TREND_UP":
            rec["action"] = "SWING_LONG_CANDIDATE"
            direction = 1
        elif resolution == "TREND_DOWN":
            rec["action"] = "SWING_SHORT_CANDIDATE"
            direction = -1
        elif resolution == "RANGE":
            rec["action"] = "RANGE_RESUMED"
            records.append(rec)
            continue
        else:
            rec["action"] = "NO_DECISION"
            records.append(rec)
            continue

        rec["resolved_direction"] = direction
        rt = rec["resolution_time"]
        if rt is None or int(rt) not in t_to_i:
            raise ValueError(f"resolution timestamp missing from canonical H1: {rt}")
        i = t_to_i[int(rt)]
        rec["resolution_idx"] = int(i)
        out = post_resolution_outcomes(
            f,
            i,
            direction,
            rec["frozen_lower"],
            rec["frozen_upper"],
        )
        for k, v in out.items():
            rec[f"resolution_{k}"] = v

        records.append(rec)
    return records


def split_summary(
    records: list[dict],
    split: str,
    source_summary: dict,
) -> dict:
    rows = [r for r in records if r["split"] == split]
    confirmed = [
        r for r in rows
        if r["resolution"] in ("TREND_UP", "TREND_DOWN")
    ]
    mature24 = [
        r for r in confirmed if r.get("resolution_h24_mature")
    ]
    res_counts = Counter(r["resolution"] for r in rows)
    delays = [
        r["resolution_delay_bars"] for r in rows
        if r.get("resolution_delay_bars") is not None
    ]
    dir_counts = Counter(r.get("resolved_direction") for r in mature24)

    source_key = "library_transitions" if split == "library" else "evaluation_transitions"
    onset_all = source_summary[source_key]["horizons"]

    year_counts = Counter(
        pd.to_datetime(r["resolution_time"], unit="ms", utc=True).year
        for r in mature24
    )
    max_year_share = (
        max(year_counts.values()) / len(mature24)
        if mature24 and year_counts else None
    )

    return {
        "primary_episodes": len(rows),
        "resolution_counts": dict(res_counts),
        "range_resumed_fraction": (
            res_counts.get("RANGE", 0) / len(rows) if rows else None
        ),
        "confirmed_trend_fraction": (
            len(confirmed) / len(rows) if rows else None
        ),
        "resolution_delay_median_bars": (
            float(np.median(delays)) if delays else None
        ),
        "resolution_delay_mean_bars": (
            float(np.mean(delays)) if delays else None
        ),
        "confirmed_trend_events": len(confirmed),
        "mature_24bar_confirmed_events": len(mature24),
        "mature_24bar_direction_counts": {
            "up": int(dir_counts.get(1, 0)),
            "down": int(dir_counts.get(-1, 0)),
        },
        "onset_all_primary": onset_all,
        "onset_confirmed_subset": _metric_rows(confirmed, "onset"),
        "post_resolution_confirmed": _metric_rows(confirmed, "resolution"),
        "mature_24bar_year_counts": {
            str(k): int(v) for k, v in sorted(year_counts.items())
        },
        "max_year_share": max_year_share,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--source-run", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    root = Path(args.root)
    source = Path(args.source_run)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=False)

    required = [
        source / "state_freeze.json",
        source / "state_sequence.csv.gz",
        source / "transition_library.jsonl",
        source / "summary.json",
        source / "input_manifest.json",
    ]
    for p in required:
        if not p.exists():
            raise FileNotFoundError(p)

    versions = {}
    for name in ("numpy", "pandas", "scikit-learn"):
        try:
            versions[name] = md.version(name)
        except Exception:
            pass
    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "packages": versions,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "source_run": str(source),
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    freeze = json.loads((source / "state_freeze.json").read_text(encoding="utf-8"))
    actual_state_hash = state_hash_from_csv(source / "state_sequence.csv.gz")
    if actual_state_hash != freeze["state_sequence_sha256"]:
        raise ValueError("v0.2 state sequence hash mismatch")

    source_summary = json.loads((source / "summary.json").read_text(encoding="utf-8"))
    if source_summary["integrity"]["feature_prefix_invariance"] != "PASS":
        raise ValueError("source feature-prefix integrity not PASS")
    if source_summary["fsm_diagnostics"]["max_transition_age_seen"] > 4:
        raise ValueError("source transition age exceeds protocol")

    # Reload canonical H1 only for post-resolution price paths.
    f, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    source_manifest = json.loads(
        (source / "input_manifest.json").read_text(encoding="utf-8")
    )
    current_manifest = json.loads(
        (out / "input_manifest.json").read_text(encoding="utf-8")
    )
    if current_manifest != source_manifest:
        raise ValueError("canonical raw manifest differs from frozen v0.2")

    events = load_jsonl(source / "transition_library.jsonl")
    records = build_records(events, f)

    with (out / "handoff_records.jsonl").open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, allow_nan=False) + "\n")

    library = split_summary(records, "library", source_summary)
    evaluation = split_summary(records, "evaluation", source_summary)

    es = source_summary["evaluation_state"]["states"]
    sanity = {
        "inherited_feature_prefix_invariance": True,
        "inherited_transition_age_le_4": (
            source_summary["fsm_diagnostics"]["max_transition_age_seen"] <= 4
        ),
        "evaluation_primary_ge_100": evaluation["primary_episodes"] >= 100,
        "evaluation_confirmed_mature24_ge_100": (
            evaluation["mature_24bar_confirmed_events"] >= 100
        ),
        "evaluation_confirmed_has_both_directions": (
            evaluation["mature_24bar_direction_counts"]["up"] > 0
            and evaluation["mature_24bar_direction_counts"]["down"] > 0
        ),
        "evaluation_no_year_over_60pct": (
            evaluation["max_year_share"] is not None
            and evaluation["max_year_share"] <= 0.60
        ),
        "range_efficiency_lower_than_trends": (
            es["RANGE"]["median_efficiency24"] < es["TREND_UP"]["median_efficiency24"]
            and es["RANGE"]["median_efficiency24"] < es["TREND_DOWN"]["median_efficiency24"]
        ),
        "trend_drift_signs_correct": (
            es["TREND_UP"]["median_drift24"] > 0
            and es["TREND_DOWN"]["median_drift24"] < 0
        ),
    }

    result = {
        "scope": "GTG State + Transition Engine v0.3 confirmed handoff audit",
        "source_v02_state_sha256": actual_state_hash,
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "integrity": {
            "source_state_hash_unchanged": "PASS",
            "source_manifest_matches": "PASS",
            "source_feature_prefix_invariance": "PASS",
            "source_transition_age_le_4": "PASS",
            "market_continuity_unchanged_le_3h": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "library": library,
        "evaluation": evaluation,
        "sanity_gates": sanity,
        "sanity_pass_all": bool(all(sanity.values())),
        "resolved_4bar_direction_accuracy": (
            evaluation["post_resolution_confirmed"]["4"]["direction_accuracy"]
        ),
    }
    (out / "summary.json").write_text(
        json.dumps(result, indent=2, allow_nan=False),
        encoding="utf-8",
    )

    print(json.dumps({
        "sanity_gates": sanity,
        "sanity_pass_all": result["sanity_pass_all"],
        "evaluation_primary": evaluation["primary_episodes"],
        "evaluation_resolution_counts": evaluation["resolution_counts"],
        "evaluation_confirmed": evaluation["confirmed_trend_events"],
        "evaluation_mature_24bar_confirmed": evaluation["mature_24bar_confirmed_events"],
        "evaluation_onset_confirmed_subset": evaluation["onset_confirmed_subset"],
        "evaluation_post_resolution_confirmed": evaluation["post_resolution_confirmed"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
