"""Raw Pristine-OOS forward capture — Step 2 (TRADE_CONTRACT §22).

Stores the exact Dukascopy tick files for every complete UTC hour from the T_freeze hour
onward, and records each file's sha256 in the manifest. It does NOT build bars, compute
GTG, or look at prices: forward data stays sealed until the registered stop rule.
Idempotent: hours already in the manifest are skipped.
(The T_freeze hour itself also holds pre-freeze ticks; the later analysis keeps only
ticks with t > T_freeze.)

Usage: python3 capture_forward.py [--root DIR] [--until 2026-10-05T00:00]
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

import dukascopy as dk
from lab_config import T_FREEZE
from store import append_manifest, read_manifest, root_dir, sha256, write_raw

PUBLISH_LAG = timedelta(hours=2)  # Dukascopy publishes an hour's file after the hour ends


def pending_hours(done: set[str], now: datetime) -> list[datetime]:
    h = T_FREEZE.replace(minute=0, second=0, microsecond=0)
    out = []
    while h + timedelta(hours=1) + PUBLISH_LAG <= now:
        key = h.strftime("%Y-%m-%dT%HZ")
        if key not in done:
            out.append(h)
        h += timedelta(hours=1)
    return out


def capture(root, now: datetime, fetch=dk.fetch) -> list[dict]:
    done = {e["hour"] for e in read_manifest(root) if e.get("kind") == "forward_tick"}
    rows = []
    for h in pending_hours(done, now):
        if h < T_FREEZE.replace(minute=0, second=0, microsecond=0):
            raise AssertionError("forward capture must never touch hours before T_freeze")
        url = dk.tick_url(h)
        raw = fetch(url)
        key = h.strftime("%Y-%m-%dT%HZ")
        entry = {"kind": "forward_tick", "hour": key, "url": url,
                 "status": "absent" if raw is None else "stored",
                 "sha256": sha256(raw) if raw is not None else None,
                 "bytes": len(raw) if raw is not None else 0}
        if raw is not None:
            write_raw(root, "forward", h, f"{h:%H}h_ticks", raw)
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
    print(f"captured {sum(r['status'] == 'stored' for r in rows)} files, {sum(r['status'] == 'absent' for r in rows)} absent hours")


if __name__ == "__main__":
    main()
