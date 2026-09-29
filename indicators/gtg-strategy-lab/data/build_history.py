"""Build the historical (RETROSPECTIVE) M1 dataset — TRADE_CONTRACT v0.2.1 §2.2.

Source: the official Dukascopy M1 candles, BID and ASK files per UTC day. Ticks are not
used (full tick history = REJECTED_METHOD, F-002/F-003). Every minute whose bar would end
after T_freeze_v0.2.1 is dropped: that data belongs to the sealed Pristine OOS capture.

Usage: python build_history.py --from 2010-01-01 --to 2026-09-30 [--root DIR] [--keep-raw]
Idempotent: days already in the manifest are skipped.
"""
from __future__ import annotations

import argparse
import time
from datetime import datetime, timedelta, timezone

import dukascopy as dk
from bars import candles_to_m1
from lab_config import T_FREEZE_MS
from store import append_manifest, read_manifest, root_dir, sha256, write_day, write_raw


def build_day(day: datetime, fetch=dk.fetch, root=None, keep_raw=False) -> dict:
    day = day.replace(hour=0, minute=0, second=0, microsecond=0)
    day_ms = int(day.timestamp() * 1000)
    bid_raw = fetch(dk.candle_url(day, "BID"))
    ask_raw = fetch(dk.candle_url(day, "ASK"))
    if keep_raw and root is not None:
        for side, raw in (("BID", bid_raw), ("ASK", ask_raw)):
            if raw is not None:
                write_raw(root, "m1", day, f"{side}_candles_min_1", raw)
    bid = dk.decode_candles(bid_raw or b"", day_ms // 1000)
    ask = dk.decode_candles(ask_raw or b"", day_ms // 1000)
    bars = [b for b in candles_to_m1(bid, ask) if b["t"] + 60_000 <= T_FREEZE_MS]
    ask_cov = sum(1 for b in bars if b["ao"] is not None) / len(bars) if bars else None
    entry = {"kind": "history_day", "day": f"{day:%Y-%m-%d}", "source": "m1" if bid_raw else "none",
             "bars": len(bars), "ask_coverage": ask_cov,
             "bid_sha256": sha256(bid_raw) if bid_raw else None, "ask_sha256": sha256(ask_raw) if ask_raw else None}
    if root is not None:
        if bars:
            p = write_day(root, day, bars)
            entry["m1_file"] = str(p.relative_to(root)).replace("\\", "/")
            entry["m1_sha256"] = sha256(p.read_bytes())
        append_manifest(root, entry)
    return {"entry": entry, "bars": bars}


def days_between(start: datetime, end: datetime, newest_first: bool) -> list[datetime]:
    """UTC days in [start, end), clipped to T_freeze, optionally newest first (message 16)."""
    out, d = [], start
    while d < end and int(d.timestamp() * 1000) < T_FREEZE_MS:
        out.append(d)
        d += timedelta(days=1)
    return out[::-1] if newest_first else out


def run(days, root, keep_raw=False, build=build_day, sleep=time.sleep, cooldown_s=600, max_cooldowns=6, log=print):
    """Quiet acquisition: sequential, paced by dukascopy.fetch; a throttled day triggers a long
    cool-down and is retried; after `max_cooldowns` consecutive cool-downs the run stops cleanly.
    Days already in the manifest are never downloaded again."""
    done = {e["day"] for e in read_manifest(root) if e.get("kind") == "history_day"}
    streak = 0
    for d in days:
        if f"{d:%Y-%m-%d}" in done:
            continue
        while True:
            try:
                r = build(d, root=root, keep_raw=keep_raw)["entry"]
                streak = 0
                log(f"{r['day']} {r['source']:>4} bars={r['bars']} ask={r['ask_coverage']}")
                break
            except (dk.RateLimited, ConnectionError) as e:
                streak += 1
                log(f"{d:%Y-%m-%d} THROTTLED ({e}); cool-down {cooldown_s}s [{streak}/{max_cooldowns}]")
                if streak >= max_cooldowns:
                    log("STOP: source persistently throttled; rerun later (idempotent)")
                    return False
                sleep(cooldown_s)
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--from", dest="start", required=True)
    ap.add_argument("--to", dest="end", required=True, help="exclusive; clipped to T_freeze")
    ap.add_argument("--root")
    ap.add_argument("--keep-raw", action="store_true")
    ap.add_argument("--newest-first", action="store_true")
    a = ap.parse_args(argv)
    root = root_dir(a.root)
    start = datetime.fromisoformat(a.start).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(a.end).replace(tzinfo=timezone.utc)
    run(days_between(start, end, a.newest_first), root, keep_raw=a.keep_raw, log=lambda s: print(s, flush=True))


if __name__ == "__main__":
    main()
