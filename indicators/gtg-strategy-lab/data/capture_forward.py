"""LEGACY / AUDIT-REFERENCE forward capture from the public Dukascopy datafeed.

This module belongs to TRADE_CONTRACT v0.2.1. Under the frozen v0.2.3 contract it is
NOT a canonical Pristine-OOS source and MUST NOT be mixed with the JForex/IHistory
forward record. Canonical v0.2.3 forward collection is GtgForwardExport.java followed
by seal_jforex_forward.py.

For v0.2.1-era audit/reference work only, this stores the public Dukascopy M1 candle
files (BID and ASK) for complete UTC days and records each file's sha256 in the manifest.
It does NOT decode, build bars or compute GTG: forward data stays sealed until the
registered stop rule. Idempotent: days already in the manifest are skipped.
(The T_freeze day itself also holds pre-freeze minutes; the later analysis keeps only
bars with t > T_freeze.)

Usage: python capture_forward.py [--root DIR] [--until 2026-10-05T00:00]
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

import dukascopy as dk
from lab_config import T_FREEZE
from store import append_manifest, read_manifest, root_dir, sha256, write_raw

PUBLISH_LAG = timedelta(hours=3)  # a day's M1 file appears after the UTC day has ended


def pending_days(done: set[str], now: datetime) -> list[datetime]:
    d = T_FREEZE.replace(hour=0, minute=0, second=0, microsecond=0)
    out = []
    while d + timedelta(days=1) + PUBLISH_LAG <= now:
        if f"{d:%Y-%m-%d}" not in done:
            out.append(d)
        d += timedelta(days=1)
    return out


def capture(root, now: datetime, fetch=dk.fetch) -> list[dict]:
    done = {e["day"] for e in read_manifest(root) if e.get("kind") == "forward_m1"}
    rows = []
    for d in pending_days(done, now):
        if d < T_FREEZE.replace(hour=0, minute=0, second=0, microsecond=0):
            raise AssertionError("forward capture must never touch days before T_freeze")
        entry = {"kind": "forward_m1", "day": f"{d:%Y-%m-%d}"}
        for side in ("BID", "ASK"):
            url = dk.candle_url(d, side)
            raw = fetch(url)
            entry[f"{side.lower()}_url"] = url
            entry[f"{side.lower()}_sha256"] = sha256(raw) if raw is not None else None
            entry[f"{side.lower()}_bytes"] = len(raw) if raw is not None else 0
            if raw is not None:
                write_raw(root, "forward", d, f"{side}_candles_min_1", raw)
        append_manifest(root, entry)
        rows.append(entry)
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root")
    ap.add_argument("--until", help="UTC ISO time used as 'now' (default: current time)")
    a = ap.parse_args(argv)
    now = datetime.fromisoformat(a.until).replace(tzinfo=timezone.utc) if a.until else datetime.now(timezone.utc)
    rows = capture(root_dir(a.root), now)
    print(f"captured {len(rows)} day(s): {[r['day'] for r in rows]}")


if __name__ == "__main__":
    main()
