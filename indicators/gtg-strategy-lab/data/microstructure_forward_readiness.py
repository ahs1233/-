"""Readiness gate for GTG Microstructure Forward research.

This module uses collection metadata and microstructure quality only.
It never reads trading outcomes, Historical Holdout, or Pristine Price OOS.
"""
from __future__ import annotations

import argparse
import json
import statistics
from datetime import timedelta
from pathlib import Path
from typing import Any

from audit_microstructure_quality import audit_quality, parse_time
from capture_microstructure_forward import read_manifest

MIN_VALID_SNAPSHOTS = 10_000
MIN_ELAPSED_DAYS = 30
GAP_WARN_SECONDS = 90.0
GAP_SEVERE_SECONDS = 300.0
RECENT_INTERVALS = 60


def _intervals(rows: list[dict[str, Any]]) -> list[float]:
    times = []
    for row in rows:
        dt = parse_time(row.get("capture_received_utc"))
        if dt is not None:
            times.append(dt)
    times.sort()
    return [
        max(0.0, (b - a).total_seconds())
        for a, b in zip(times, times[1:])
    ]


def build_readiness(root: Path) -> dict[str, Any]:
    quality = audit_quality(root)
    if quality.get("status") != "PASS":
        return {
            "scope": "GTG Microstructure Forward Readiness Gate v0.1",
            "status": "BLOCKED",
            "reason": "quality_or_integrity_failed",
            "quality_status": quality.get("status"),
            "eligible_now": False,
            "historical_holdout_read": False,
            "pristine_price_oos_decoded": False,
            "trading_outcomes_read": False,
        }

    rows = read_manifest(root)
    count = int(quality.get("capture_count") or 0)
    first = parse_time(quality.get("first_capture"))
    last = parse_time(quality.get("last_capture"))

    elapsed_seconds = 0.0
    if first is not None and last is not None:
        elapsed_seconds = max(0.0, (last - first).total_seconds())
    elapsed_days = elapsed_seconds / 86400.0

    snapshot_gate = count >= MIN_VALID_SNAPSHOTS
    time_gate = elapsed_seconds >= MIN_ELAPSED_DAYS * 86400.0
    eligible_now = snapshot_gate and time_gate

    unlock_time = first + timedelta(days=MIN_ELAPSED_DAYS) if first else None
    snapshots_remaining = max(0, MIN_VALID_SNAPSHOTS - count)
    days_remaining = max(0.0, MIN_ELAPSED_DAYS - elapsed_days)

    grades = quality.get("grade_counts") or {}
    fusion_count = int(grades.get("fusion_grade") or 0)
    fusion_ratio = fusion_count / count if count else 0.0

    source_counts = quality.get("source_available_counts") or {}
    source_coverage = {
        name: {
            "available_count": int(n),
            "coverage_ratio": (int(n) / count if count else 0.0),
        }
        for name, n in sorted(source_counts.items())
    }
    ready_family_counts = quality.get("ready_source_family_counts") or {}
    ready_family_coverage = {
        name: {
            "ready_count": int(n),
            "coverage_ratio": (int(n) / count if count else 0.0),
        }
        for name, n in sorted(ready_family_counts.items())
    }

    intervals = _intervals(rows)
    recent = intervals[-RECENT_INTERVALS:]
    cadence = {
        "interval_count": len(intervals),
        "median_interval_seconds": statistics.median(intervals) if intervals else None,
        "max_gap_seconds": max(intervals) if intervals else None,
        "gaps_over_90s": sum(x > GAP_WARN_SECONDS for x in intervals),
        "gaps_over_300s": sum(x > GAP_SEVERE_SECONDS for x in intervals),
        "recent_interval_count": len(recent),
        "recent_median_interval_seconds": statistics.median(recent) if recent else None,
        "recent_max_gap_seconds": max(recent) if recent else None,
        "recent_gaps_over_90s": sum(x > GAP_WARN_SECONDS for x in recent),
        "recent_gaps_over_300s": sum(x > GAP_SEVERE_SECONDS for x in recent),
    }

    return {
        "scope": "GTG Microstructure Forward Readiness Gate v0.1",
        "status": "ELIGIBLE" if eligible_now else "COLLECTING",
        "eligible_now": eligible_now,
        "registered_eligibility": {
            "minimum_elapsed_days": MIN_ELAPSED_DAYS,
            "minimum_valid_snapshots": MIN_VALID_SNAPSHOTS,
        },
        "gates": {
            "integrity_pass": True,
            "elapsed_time_gate": time_gate,
            "snapshot_count_gate": snapshot_gate,
        },
        "progress": {
            "valid_snapshots": count,
            "snapshots_remaining": snapshots_remaining,
            "elapsed_days": elapsed_days,
            "days_remaining": days_remaining,
            "first_capture": quality.get("first_capture"),
            "last_capture": quality.get("last_capture"),
            "time_gate_unlock_utc": unlock_time.isoformat() if unlock_time else None,
        },
        "quality": {
            "grade_counts": grades,
            "fusion_grade_count": fusion_count,
            "fusion_grade_ratio": fusion_ratio,
            "source_coverage": source_coverage,
            "ready_source_family_coverage": ready_family_coverage,
            "cadence": cadence,
        },
        "research_locks": {
            "historical_holdout_read": False,
            "pristine_price_oos_decoded": False,
            "trading_outcomes_read": False,
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out")
    args = ap.parse_args()

    report = build_readiness(Path(args.root))
    if args.out:
        Path(args.out).write_text(
            json.dumps(report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    summary = {
        "status": report.get("status"),
        "eligible_now": report.get("eligible_now"),
        "gates": report.get("gates", {}),
        "progress": report.get("progress", {}),
        "fusion_grade_ratio": (report.get("quality") or {}).get("fusion_grade_ratio"),
        "cadence": (report.get("quality") or {}).get("cadence", {}),
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
