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
    verifications = [e for e in rows if e.get("kind") == "forward_m1_verify"]

    issues: list[dict] = []
    checked: list[dict] = []
    expected_raw: set[Path] = set()

    days_seen = set()
    for e in forward:
        day = str(e.get("day", ""))
        if day in days_seen:
            issues.append({"type": "DUPLICATE_FORWARD_DAY", "day": day})
            continue
        days_seen.add(day)

        if day < FREEZE_DAY:
            issues.append({"type": "PRE_FREEZE_FORWARD_DAY", "day": day})

        if e.get("origin") != "jforex-ihistory-export":
            issues.append({
                "type": "NON_CANONICAL_FORWARD_ORIGIN",
                "day": day,
                "origin": e.get("origin"),
            })

        item = {"day": day}
        for side in ("BID", "ASK"):
            p = raw_path(root, day, side)
            expected_raw.add(p.resolve())
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

        valid_verification = any(
            v.get("day") == day
            and v.get("origin") == "jforex-ihistory-export"
            and v.get("source") == "JForex API/IHistory"
            and v.get("export_cache_match") is True
            and v.get("bid_export_sha256") == e.get("bid_sha256")
            and v.get("bid_cache_sha256") == e.get("bid_sha256")
            and v.get("ask_export_sha256") == e.get("ask_sha256")
            and v.get("ask_cache_sha256") == e.get("ask_sha256")
            for v in verifications
        )
        item["jforex_cache_verified"] = valid_verification
        if not valid_verification:
            issues.append({"type": "MISSING_JFOREX_CACHE_VERIFICATION", "day": day})

        checked.append(item)

    forward_root = root / "raw" / "forward"
    if forward_root.exists():
        for p in forward_root.rglob("*"):
            if not p.is_file():
                continue
            rp = p.resolve()
            if p.name.endswith(".part"):
                issues.append({"type": "ORPHAN_PARTIAL_FORWARD", "path": str(p)})
            elif p.suffix == ".bi5" and rp not in expected_raw:
                issues.append({"type": "ORPHAN_RAW_FORWARD", "path": str(p)})

    forward_days = {str(e.get("day")) for e in forward}
    for v in verifications:
        day = str(v.get("day", ""))
        if day not in forward_days:
            issues.append({"type": "ORPHAN_FORWARD_VERIFICATION", "day": day})

    # Strictly post-freeze data-layer records may only be sealed forward data or its byte-parity verification.
    allowed_kinds = {"forward_m1", "forward_m1_verify"}
    for e in rows:
        day = str(e.get("day", ""))
        kind = e.get("kind")
        if day > FREEZE_DAY and kind not in allowed_kinds:
            issues.append({
                "type": "NON_FORWARD_MANIFEST_AFTER_FREEZE_DAY",
                "day": day,
                "kind": kind,
            })

    return {
        "scope": "GTG Pristine Forward Seal Audit v0.2",
        "freeze_day": FREEZE_DAY,
        "forward_days": len(forward),
        "verification_records": len(verifications),
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
