"""Seal canonical JForex/IHistory Forward exports without decoding prices.

Allowed:
- read JForex completion markers
- compare exact exported bytes with the JForex local cache
- copy exact raw bytes
- byte counts and SHA256
- append Forward/verification manifest metadata

Forbidden:
- decode candle records
- read OHLC values
- build M1/H1 bars
- compute or align any trading outcome
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from lab_config import T_FREEZE
from store import append_manifest, read_manifest, root_dir

DEFAULT_EXPORT = Path(r"C:\Users\alk\gtg-lab-work\captures\jforex_forward")
DEFAULT_CACHE = Path(r"C:\Users\alk\AppData\Local\Programs\JForex4\.cache")
RECORD_BYTES = 24
FREEZE_DAY = T_FREEZE.strftime("%Y-%m-%d")
CANONICAL_ORIGIN = "jforex-ihistory-export"
CANONICAL_SOURCE = "JForex API/IHistory"
SETTLE_LAG_HOURS = 3


def expected_settled_days(now: datetime | None = None) -> list[str]:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    today = now.date()
    last = today - timedelta(days=2 if now.hour < SETTLE_LAG_HOURS else 1)
    first = datetime.fromisoformat(FREEZE_DAY).date()
    out: list[str] = []
    day = first
    while day <= last:
        out.append(day.isoformat())
        day += timedelta(days=1)
    return out


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def day_dir(base: Path, day: str) -> Path:
    d = datetime.fromisoformat(day)
    return base / "XAUUSD" / f"{d.year:04d}" / f"{d.month - 1:02d}" / f"{d.day:02d}"


def dest_path(root: Path, day: str, side: str) -> Path:
    d = datetime.fromisoformat(day)
    return (
        root / "raw" / "forward" / f"{d.year:04d}" / f"{d.month:02d}"
        / f"{d.day:02d}" / f"{side}_candles_min_1.bi5"
    )


def atomic_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(dst.suffix + ".part")
    shutil.copyfile(src, tmp)
    os.replace(tmp, dst)


def discover_complete_days(export_root: Path) -> list[str]:
    days: list[str] = []
    for marker in export_root.glob("XAUUSD/*/*/*/FORWARD_COMPLETE.json"):
        try:
            meta = json.loads(marker.read_text(encoding="utf-8-sig"))
            day = str(meta["day"])
            datetime.fromisoformat(day)
        except Exception as exc:
            raise ValueError(f"invalid completion marker {marker}: {exc}") from exc
        if day < FREEZE_DAY:
            raise AssertionError(f"pre-freeze JForex forward day: {day}")
        days.append(day)
    return sorted(set(days))


def side_metadata(base: Path, day: str, side: str) -> dict[str, Any] | None:
    p = day_dir(base, day) / f"{side}_candles_min_1.bi5"
    if not p.exists():
        return None
    n = p.stat().st_size
    if n <= 0 or n % RECORD_BYTES:
        raise ValueError(f"{day} {side} invalid byte count {n}")
    return {
        "path": p,
        "bytes": n,
        "rows": n // RECORD_BYTES,
        "sha256": sha256_file(p),
    }


def source_metadata(export_root: Path, day: str) -> dict[str, Any]:
    d = day_dir(export_root, day)
    marker = d / "FORWARD_COMPLETE.json"
    meta = json.loads(marker.read_text(encoding="utf-8-sig"))
    if str(meta.get("day")) != day:
        raise ValueError(f"{day} marker day mismatch")
    if meta.get("source") != CANONICAL_SOURCE:
        raise ValueError(f"{day} noncanonical marker source: {meta.get('source')!r}")
    api = str(meta.get("api") or "")
    if not api.startswith("jforex-api "):
        raise ValueError(f"{day} invalid JForex API provenance: {api!r}")

    out: dict[str, Any] = {
        "day": day,
        "source": CANONICAL_SOURCE,
        "api": api,
        "completed_utc": meta.get("completed_utc"),
    }
    for side in ("BID", "ASK"):
        sm = side_metadata(export_root, day, side)
        if sm is None:
            raise FileNotFoundError(f"{day} {side} export missing")
        marker_rows = int(meta.get(f"{side.lower()}_rows", -1))
        if marker_rows != sm["rows"]:
            raise ValueError(
                f"{day} {side} rows mismatch marker={marker_rows} bytes={sm['rows']}"
            )
        out[side.lower()] = sm
    return out


def cache_metadata(cache_root: Path, day: str) -> dict[str, Any] | None:
    out: dict[str, Any] = {}
    for side in ("BID", "ASK"):
        sm = side_metadata(cache_root, day, side)
        if sm is None:
            return None
        out[side.lower()] = sm
    return out


def build_verification(day: str, src: dict[str, Any], cache: dict[str, Any]) -> dict[str, Any]:
    rec: dict[str, Any] = {
        "kind": "forward_m1_verify",
        "day": day,
        "origin": CANONICAL_ORIGIN,
        "source": CANONICAL_SOURCE,
        "verification_channel": "JForex local cache byte parity",
        "jforex_api": src.get("api"),
        "export_completed_utc": src.get("completed_utc"),
        "verified_utc": datetime.now(timezone.utc).isoformat(),
        "export_cache_match": True,
        "historical_holdout_read": False,
        "pristine_price_oos_decoded": False,
        "trading_outcomes_read": False,
    }
    for side in ("bid", "ask"):
        a = src[side]
        b = cache[side]
        if a["bytes"] != b["bytes"] or a["sha256"] != b["sha256"]:
            raise ValueError(
                f"{day} {side.upper()} JForex export/cache mismatch "
                f"export={a['sha256']} cache={b['sha256']}"
            )
        rec[f"{side}_bytes"] = a["bytes"]
        rec[f"{side}_rows"] = a["rows"]
        rec[f"{side}_export_sha256"] = a["sha256"]
        rec[f"{side}_cache_sha256"] = b["sha256"]
    return rec


def same_verification(row: dict[str, Any], rec: dict[str, Any]) -> bool:
    return (
        row.get("kind") == "forward_m1_verify"
        and row.get("day") == rec.get("day")
        and row.get("bid_export_sha256") == rec.get("bid_export_sha256")
        and row.get("ask_export_sha256") == rec.get("ask_export_sha256")
        and row.get("bid_cache_sha256") == rec.get("bid_cache_sha256")
        and row.get("ask_cache_sha256") == rec.get("ask_cache_sha256")
        and row.get("export_cache_match") is True
    )


def seal(
    export_root: Path,
    cache_root: Path,
    root: Path,
    *,
    check_expected: bool = False,
    now: datetime | None = None,
) -> dict[str, Any]:
    manifest = read_manifest(root)
    existing = {
        str(e["day"]): e
        for e in manifest
        if e.get("kind") == "forward_m1"
    }
    verification_rows = [e for e in manifest if e.get("kind") == "forward_m1_verify"]

    sealed: list[str] = []
    verified_added: list[str] = []
    verified_existing: list[str] = []
    pending_cache: list[str] = []

    complete_days = discover_complete_days(export_root)
    expected_days = expected_settled_days(now) if check_expected else complete_days
    missing_export = sorted(set(expected_days) - set(complete_days))

    for day in complete_days:
        src = source_metadata(export_root, day)
        cache = cache_metadata(cache_root, day)
        if cache is None:
            pending_cache.append(day)
            continue
        verification = build_verification(day, src, cache)
        prior = existing.get(day)

        if prior is not None:
            for side in ("bid", "ask"):
                if prior.get(f"{side}_sha256") != src[side]["sha256"]:
                    raise ValueError(
                        f"sealed {day} {side.upper()} hash differs from JForex export"
                    )
            if any(same_verification(row, verification) for row in verification_rows):
                verified_existing.append(day)
            else:
                append_manifest(root, verification)
                verification_rows.append(verification)
                verified_added.append(day)
            continue

        for side in ("BID", "ASK"):
            source = src[side.lower()]["path"]
            target = dest_path(root, day, side)
            atomic_copy(source, target)
            if sha256_file(target) != src[side.lower()]["sha256"]:
                raise IOError(f"copy verification failed: {day} {side}")

        entry = {
            "kind": "forward_m1",
            "day": day,
            "origin": CANONICAL_ORIGIN,
            "source": CANONICAL_SOURCE,
            "compressed": False,
            "bid_sha256": src["bid"]["sha256"],
            "bid_bytes": src["bid"]["bytes"],
            "bid_rows": src["bid"]["rows"],
            "ask_sha256": src["ask"]["sha256"],
            "ask_bytes": src["ask"]["bytes"],
            "ask_rows": src["ask"]["rows"],
            "export_completed_utc": src.get("completed_utc"),
            "jforex_api": src.get("api"),
            "historical_holdout_read": False,
            "pristine_price_oos_decoded": False,
            "trading_outcomes_read": False,
        }
        append_manifest(root, entry)
        append_manifest(root, verification)
        existing[day] = entry
        verification_rows.append(verification)
        sealed.append(day)
        verified_added.append(day)

    status = (
        "BLOCKED_MISSING_JFOREX_EXPORT"
        if missing_export
        else "WAITING_CACHE_VERIFICATION"
        if pending_cache
        else "PASS"
    )
    return {
        "scope": "GTG JForex Pristine Forward Seal v0.2",
        "status": status,
        "freeze_day": FREEZE_DAY,
        "expected_settled_through": expected_days[-1] if expected_days else None,
        "complete_export_days": len(complete_days),
        "missing_expected_export_days": missing_export,
        "sealed_new_days": sealed,
        "verification_added_days": verified_added,
        "verified_existing_days": verified_existing,
        "pending_cache_verification_days": pending_cache,
        "historical_holdout_read": False,
        "pristine_price_oos_decoded": False,
        "trading_outcomes_read": False,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export-root", default=str(DEFAULT_EXPORT))
    ap.add_argument("--cache-root", default=str(DEFAULT_CACHE))
    ap.add_argument("--root")
    ap.add_argument("--out")
    args = ap.parse_args()

    report = seal(
        Path(args.export_root),
        Path(args.cache_root),
        root_dir(args.root),
        check_expected=True,
    )
    if args.out:
        Path(args.out).write_text(
            json.dumps(report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(0 if report["status"] == "PASS" else 3)


if __name__ == "__main__":
    main()
