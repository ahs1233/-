"""Audit the Pristine-OOS forward seal without decoding market data.

Allowed operations:
- manifest metadata
- filenames / byte counts
- SHA256 of raw files
- derived-file existence checks

Forbidden:
- decoding BI5
- reading OHLC values
- building M1/H1 bars
- price statistics
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from lab_config import T_FREEZE
from store import read_manifest, root_dir

FREEZE_DAY = T_FREEZE.strftime("%Y-%m-%d")


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def raw_path(root: Path, day: str, side: str) -> Path:
    d = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)
    return root / "raw" / "forward" / f"{d:%Y/%m/%d}" / f"{side}_candles_min_1.bi5"


def audit(root: Path) -> dict:
    rows = read_manifest(root)
    forward = [e for e in rows if e.get("kind") == "forward_m1"]
    forward.sort(key=lambda e: e["day"])

    issues: list[dict] = []
    checked: list[dict] = []

    days_seen = set()
    for e in forward:
        day = str(e.get("day", ""))
        if day in days_seen:
            issues.append({"type": "DUPLICATE_FORWARD_DAY", "day": day})
            continue
        days_seen.add(day)

        if day < FREEZE_DAY:
            issues.append({"type": "PRE_FREEZE_FORWARD_DAY", "day": day})

        item = {"day": day}
        for side in ("BID", "ASK"):
            p = raw_path(root, day, side)
            prefix = side.lower()
            exp_bytes = int(e.get(f"{prefix}_bytes") or 0)
            exp_sha = e.get(f"{prefix}_sha256")
            exists = p.exists()
            item[f"{prefix}_exists"] = exists
            item[f"{prefix}_bytes"] = p.stat().st_size if exists else 0
            item[f"{prefix}_sha256"] = file_sha256(p) if exists else None

            if not exists:
                issues.append({"type": "MISSING_RAW_FILE", "day": day, "side": side})
                continue
            if p.stat().st_size != exp_bytes:
                issues.append({
                    "type": "BYTE_COUNT_MISMATCH",
                    "day": day,
                    "side": side,
                    "manifest": exp_bytes,
                    "actual": p.stat().st_size,
                })
            actual_sha = item[f"{prefix}_sha256"]
            if actual_sha != exp_sha:
                issues.append({
                    "type": "SHA256_MISMATCH",
                    "day": day,
                    "side": side,
                    "manifest": exp_sha,
                    "actual": actual_sha,
                })

        # Any strictly post-freeze day must remain absent from canonical M1.
        if day > FREEZE_DAY:
            d = datetime.fromisoformat(day)
            m1 = root / "m1" / f"{d:%Y/%m}" / f"{day}.csv.gz"
            item["canonical_m1_exists"] = m1.exists()
            if m1.exists():
                issues.append({"type": "DERIVED_CANONICAL_M1_EXISTS", "day": day, "path": str(m1)})

        checked.append(item)

    # Strictly post-freeze days may only have forward_m1 manifest records.
    for e in rows:
        day = str(e.get("day", ""))
        kind = e.get("kind")
        if day > FREEZE_DAY and kind != "forward_m1":
            issues.append({
                "type": "NON_FORWARD_MANIFEST_AFTER_FREEZE_DAY",
                "day": day,
                "kind": kind,
            })

    return {
        "scope": "GTG Pristine Forward Seal Audit v0.1",
        "freeze_day": FREEZE_DAY,
        "forward_days": len(forward),
        "first_forward_day": forward[0]["day"] if forward else None,
        "last_forward_day": forward[-1]["day"] if forward else None,
        "checked": checked,
        "issues": issues,
        "status": "PASS" if not issues else "FAIL",
        "decoded_market_data": False,
        "derived_bars_built": False,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root")
    ap.add_argument("--out")
    a = ap.parse_args(argv)

    root = root_dir(a.root)
    report = audit(root)

    if a.out:
        Path(a.out).write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps({
        "status": report["status"],
        "forward_days": report["forward_days"],
        "first_forward_day": report["first_forward_day"],
        "last_forward_day": report["last_forward_day"],
        "issues": report["issues"],
        "decoded_market_data": False,
    }, indent=2))
    raise SystemExit(0 if report["status"] == "PASS" else 2)


if __name__ == "__main__":
    main()
