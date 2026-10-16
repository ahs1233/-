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


def build_day(day: datetime, fetch=dk.fetch, root=None, keep_raw=False, origin: str = "datafeed", compressed: bool = True,
              extra: dict | None = None) -> dict:
    day = day.replace(hour=0, minute=0, second=0, microsecond=0)
    day_ms = int(day.timestamp() * 1000)
    bid_raw = fetch(dk.candle_url(day, "BID"))
    ask_raw = fetch(dk.candle_url(day, "ASK"))
    if keep_raw and root is not None:
        for side, raw in (("BID", bid_raw), ("ASK", ask_raw)):
            if raw is not None:
                write_raw(root, "m1", day, f"{side}_candles_min_1", raw)
    bid = dk.decode_candles(bid_raw or b"", day_ms // 1000, compressed)
    ask = dk.decode_candles(ask_raw or b"", day_ms // 1000, compressed)
    bars = [b for b in candles_to_m1(bid, ask) if b["t"] + 60_000 <= T_FREEZE_MS]
    ask_cov = sum(1 for b in bars if b["ao"] is not None) / len(bars) if bars else None
    entry = {"kind": "history_day", "day": f"{day:%Y-%m-%d}", "source": "m1" if bid_raw else "none", "origin": origin,
             "raw_format": "lzma" if compressed else "plain",
             "bars": len(bars), "ask_coverage": ask_cov,
             "bid_sha256": sha256(bid_raw) if bid_raw else None, "ask_sha256": sha256(ask_raw) if ask_raw else None,
             **(extra or {})}
    if root is not None:
        if bars:
            p = write_day(root, day, bars)
            entry["m1_file"] = str(p.relative_to(root)).replace("\\", "/")
            entry["m1_sha256"] = sha256(p.read_bytes())
        append_manifest(root, entry)
    return {"entry": entry, "bars": bars}


PUBLISH_LAG = timedelta(hours=3)  # a day's M1 file exists only after the UTC day has ended


def days_between(start: datetime, end: datetime, newest_first: bool, now: datetime | None = None) -> list[datetime]:
    """Complete UTC days in [start, end), clipped to T_freeze, optionally newest first (message 16).
    A day that has not ended (plus the publish lag) is never requested: its file does not exist yet."""
    now = now or datetime.now(timezone.utc)
    out, d = [], start
    while d < end and int(d.timestamp() * 1000) < T_FREEZE_MS and d + timedelta(days=1) + PUBLISH_LAG <= now:
        out.append(d)
        d += timedelta(days=1)
    return out[::-1] if newest_first else out


def run(days, root, keep_raw=False, build=build_day, sleep=time.sleep, cooldown_s=120, long_cooldown_s=600,
        burst=3, burst_window_s=1800, max_cooldowns=6, log=print, clock=time.monotonic):
    """Quiet acquisition: sequential, paced by dukascopy.fetch; a throttled day triggers a cool-down
    and is retried. The cool-down is `cooldown_s`, or `long_cooldown_s` once `burst` cool-downs fall
    within `burst_window_s` (GPT message 36); after `max_cooldowns` consecutive cool-downs the run
    stops cleanly. Days already in the manifest are never downloaded again."""
    # a "none" entry (no file answered) is not final: it is retried on the next run
    done = {e["day"] for e in read_manifest(root) if e.get("kind") == "history_day" and e.get("source") != "none"}
    streak = 0
    recent: list[float] = []
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
                now = clock()
                recent = [t for t in recent if now - t < burst_window_s] + [now]
                wait = long_cooldown_s if len(recent) >= burst else cooldown_s
                log(f"{d:%Y-%m-%d} THROTTLED ({e}); cool-down {wait}s [{streak}/{max_cooldowns}]")
                if streak >= max_cooldowns:
                    log("STOP: source persistently throttled; rerun later (idempotent)")
                    return False
                sleep(wait)
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
