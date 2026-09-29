"""Build the historical (RETROSPECTIVE) M1 dataset from Dukascopy — Step 3.

Per UTC day: ticks first (24 hourly files); only when Dukascopy has no tick file for
any hour of the day does the day fall back to M1 candles (BID + ASK). Every tick at or
after T_freeze is dropped: data after the freeze belongs to the Pristine OOS capture and
never enters the historical set.

Usage: python3 build_history.py --from 2010-01-01 --to 2026-09-30 [--root DIR] [--keep-raw]
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

import dukascopy as dk
from bars import candles_to_m1, ticks_to_m1
from lab_config import T_FREEZE_MS
from store import append_manifest, root_dir, sha256, write_day, write_raw


def build_day(day: datetime, fetch=dk.fetch, root=None, keep_raw=False) -> dict:
    day = day.replace(hour=0, minute=0, second=0, microsecond=0)
    day_ms = int(day.timestamp() * 1000)
    ticks, raw_hours, missing = [], [], 0
    for h in range(24):
        hour = day + timedelta(hours=h)
        url = dk.tick_url(hour)
        raw = fetch(url)
        if raw is None:
            missing += 1
            continue
        raw_hours.append({"hour": h, "sha256": sha256(raw), "bytes": len(raw)})
        if keep_raw and root is not None:
            write_raw(root, "tick", hour, f"{h:02d}h_ticks", raw)
        ticks.extend(dk.decode_ticks(raw, day_ms + h * 3_600_000))
    if missing == 24:
        bid_raw = fetch(dk.candle_url(day, "BID"))
        ask_raw = fetch(dk.candle_url(day, "ASK"))
        bid = dk.decode_candles(bid_raw or b"", day_ms // 1000)
        ask = dk.decode_candles(ask_raw or b"", day_ms // 1000)
        bars = candles_to_m1(bid, ask)
        source = "m1" if bid_raw else "none"
        raw_info = {"bid_sha256": sha256(bid_raw) if bid_raw else None,
                    "ask_sha256": sha256(ask_raw) if ask_raw else None}
    else:
        bars = ticks_to_m1(ticks)
        source = "tick"
        raw_info = {"hours": raw_hours, "missing_hours": missing}
    bars = [b for b in bars if b["t"] + 60_000 <= T_FREEZE_MS]  # whole minutes strictly before the freeze
    ask_cov = sum(1 for b in bars if b["ao"] is not None) / len(bars) if bars else None
    entry = {"kind": "history_day", "day": f"{day:%Y-%m-%d}", "source": source, "bars": len(bars),
             "ask_coverage": ask_cov, **raw_info}
    if root is not None:
        if bars:
            p = write_day(root, day, bars)
            entry["m1_file"] = str(p.relative_to(root))
            entry["m1_sha256"] = sha256(p.read_bytes())
        append_manifest(root, entry)
    return {"entry": entry, "bars": bars}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--from", dest="start", required=True)
    ap.add_argument("--to", dest="end", required=True, help="exclusive; clipped to T_freeze")
    ap.add_argument("--root")
    ap.add_argument("--keep-raw", action="store_true")
    a = ap.parse_args(argv)
    root = root_dir(a.root)
    d = datetime.fromisoformat(a.start).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(a.end).replace(tzinfo=timezone.utc)
    while d < end and int(d.timestamp() * 1000) < T_FREEZE_MS:
        r = build_day(d, root=root, keep_raw=a.keep_raw)["entry"]
        print(f"{r['day']} {r['source']:>4} bars={r['bars']} ask={r['ask_coverage']}")
        d += timedelta(days=1)


if __name__ == "__main__":
    main()
