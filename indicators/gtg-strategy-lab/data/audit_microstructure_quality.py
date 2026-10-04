"""Quality audit for GTG microstructure forward captures.

No trading outcomes are read. This tool classifies capture quality only.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from capture_microstructure_forward import audit_root, read_manifest


def parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def venue_quality(payload: dict[str, Any], capture_time: datetime) -> list[dict[str, Any]]:
    rows = []
    for venue in payload.get("venues") or []:
        if not isinstance(venue, dict):
            continue
        tape = venue.get("trade_tape") or {}
        quality = venue.get("quality") or {}
        observed = parse_time(venue.get("observed_at"))
        latest_trade = parse_time(tape.get("latest_trade_at"))
        latest_age = None
        if latest_trade is not None:
            latest_age = max(0.0, (capture_time - latest_trade).total_seconds())
        flow = venue.get("flow") or {}
        coverage = {}
        trade_counts = {}
        for tf in ("5m", "15m", "30m", "1h", "4h", "1d", "1w"):
            row = flow.get(tf) or {}
            coverage[tf] = bool(row.get("coverage_complete"))
            trade_counts[tf] = int(row.get("trade_count") or 0)
        rows.append({
            "venue": venue.get("venue"),
            "source_family": venue.get("source_family"),
            "status": venue.get("status"),
            "observed_at": venue.get("observed_at"),
            "latest_trade_at": tape.get("latest_trade_at"),
            "latest_trade_age_seconds": latest_age,
            "trade_count_total": int(tape.get("trade_count") or 0),
            "coverage_seconds": float(tape.get("coverage_seconds") or 0.0),
            "quality_freshness": quality.get("freshness"),
            "quality_freshness_state": quality.get("freshness_state"),
            "raw_weight": quality.get("raw_weight"),
            "flow_coverage_complete": coverage,
            "flow_trade_counts": trade_counts,
        })
    return rows


def classify(payload: dict[str, Any], capture_time: datetime) -> dict[str, Any]:
    venues = venue_quality(payload, capture_time)
    independent = int(payload.get("independent_source_count") or 0)
    status = str(payload.get("status") or "unavailable")
    ready_sources = [
        v for v in venues
        if v.get("status") == "ready"
        and v.get("latest_trade_age_seconds") is not None
        and v["latest_trade_age_seconds"] <= 900
        and int(v.get("trade_count_total") or 0) > 0
    ]
    ready_families = sorted({
        str(v.get("source_family") or v.get("venue") or "unknown")
        for v in ready_sources
    })
    stale_sources = [
        v for v in venues
        if v.get("latest_trade_age_seconds") is not None and v["latest_trade_age_seconds"] > 900
    ]

    if len(ready_families) >= 2:
        grade = "fusion_grade"
    elif ready_sources:
        grade = "single_source_grade"
    elif venues:
        grade = "degraded_or_stale"
    else:
        grade = "unavailable"

    return {
        "grade": grade,
        "fusion_status": status,
        "independent_source_count": independent,
        "venue_count": int(payload.get("venue_count") or len(venues)),
        "ready_source_count": len(ready_sources),
        "ready_source_family_count": len(ready_families),
        "ready_source_families": ready_families,
        "stale_source_count": len(stale_sources),
        "ready_directional_timeframes": payload.get("ready_directional_timeframes") or [],
        "freshness_state": payload.get("freshness_state"),
        "coverage_state": payload.get("coverage_state"),
        "source_health": payload.get("source_health") or {},
        "venues": venues,
    }


def audit_quality(root: Path) -> dict[str, Any]:
    integrity = audit_root(root)
    if integrity["status"] != "PASS":
        return {
            "scope": "GTG Microstructure Forward Quality Audit v0.2",
            "status": "FAIL_INTEGRITY",
            "integrity": integrity,
            "captures": [],
        }

    captures = []
    grades = Counter()
    source_available = Counter()
    ready_source_families = Counter()
    rows = read_manifest(root)
    for row in rows:
        capture_time = parse_time(row.get("capture_received_utc"))
        if capture_time is None:
            raise ValueError("manifest capture time missing/invalid")
        raw_path = root / str(row["path"])
        payload = json.loads(raw_path.read_text(encoding="utf-8"))
        q = classify(payload, capture_time)
        grades[q["grade"]] += 1
        for name, health in (q.get("source_health") or {}).items():
            if isinstance(health, dict) and health.get("available"):
                source_available[name] += 1
        for family in q.get("ready_source_families") or []:
            ready_source_families[str(family)] += 1
        captures.append({
            "capture_received_utc": row.get("capture_received_utc"),
            "observed_at": row.get("observed_at"),
            "sha256": row.get("sha256"),
            "transport": row.get("transport"),
            "panwatch_commit": row.get("panwatch_commit"),
            **q,
        })

    return {
        "scope": "GTG Microstructure Forward Quality Audit v0.2",
        "status": "PASS",
        "integrity": integrity,
        "capture_count": len(captures),
        "grade_counts": dict(grades),
        "source_available_counts": dict(source_available),
        "ready_source_family_counts": dict(ready_source_families),
        "first_capture": captures[0]["capture_received_utc"] if captures else None,
        "last_capture": captures[-1]["capture_received_utc"] if captures else None,
        "captures": captures,
        "historical_holdout_read": False,
        "pristine_price_oos_decoded": False,
        "trading_outcomes_read": False,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out")
    args = ap.parse_args()
    report = audit_quality(Path(args.root))
    if args.out:
        Path(args.out).write_text(
            json.dumps(report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    summary = {
        "status": report["status"],
        "capture_count": report.get("capture_count", 0),
        "grade_counts": report.get("grade_counts", {}),
        "source_available_counts": report.get("source_available_counts", {}),
        "ready_source_family_counts": report.get("ready_source_family_counts", {}),
        "first_capture": report.get("first_capture"),
        "last_capture": report.get("last_capture"),
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
