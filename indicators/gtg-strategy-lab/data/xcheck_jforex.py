"""F-012 evidence (message 30): JForex cache vs the public datafeed, raw ticks as audit arbiter.

Sample: 2 weekdays per year (seed 20260929) over the given years, plus the recent group of days
where the 23:59 flats were seen (--recent). For each day and side the datafeed M1 file is
fetched (paced by dukascopy.fetch), decompressed and compared record by record with the JForex
cache file (plain records). Every differing minute gets one class:
  timestamp_boundary   the minute exists on one side only (record offsets differ)
  flat_zero_volume     one side has a flat zero-volume candle, the other a traded one
  price                OHLC differ
  volume_only          OHLC equal, volume differs
Price and flat minutes are arbitrated against the raw ticks of that hour (audit only, one tick
file per hour, capped): which candle the ticks reproduce, field by field. Nothing is corrected,
nothing is merged, nothing is imported. Prices and volumes only — no event, no outcome.
The run is resumable (rows already in --out are kept) and stops cleanly after repeated
cool-downs; no aggressive retry.

    python xcheck_jforex.py --cache <JForex4/.cache> --years 2004 2025 --recent 2026-09-22 2026-09-28 --out x.json
"""
from __future__ import annotations

import argparse
import json
import lzma
import random
import struct
import time
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import dukascopy as dk

REC = struct.Struct(">IIIIIf")
SEED = 20260929
NY = ZoneInfo("America/New_York")
MAX_TICK_HOURS = 80


def sample_days(y0: int, y1: int, per_year: int = 2, seed: int = SEED) -> list[date]:
    rng = random.Random(seed)
    out = []
    for y in range(y0, y1 + 1):
        days = [date(y, 1, 1) + timedelta(days=k) for k in range(366) if (date(y, 1, 1) + timedelta(days=k)).year == y]
        days = [d for d in days if d.weekday() < 5]
        out += sorted(rng.sample(days, per_year))
    return out


def dead(r):
    return r[5] == 0 and r[1] == r[2] == r[3] == r[4]


def classify(a, b):
    """a = datafeed records, b = JForex records → [(sec, kind, datafeed_rec|None, jforex_rec|None)]."""
    da, db = {r[0]: r for r in a}, {r[0]: r for r in b}
    out = []
    for s in sorted(set(da) | set(db)):
        x, z = da.get(s), db.get(s)
        if x == z:
            continue
        if x is None or z is None:
            k = "timestamp_boundary"
        elif dead(x) != dead(z):
            k = "flat_zero_volume"
        elif x[1:5] == z[1:5]:
            k = "volume_only"
        else:
            k = "price"
        out.append((s, k, x, z))
    return out


def ny_context(day: date, sec: int) -> dict:
    t = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) + timedelta(seconds=sec)
    ny = t.astimezone(NY)
    mins_from_close = (ny.hour * 60 + ny.minute) - 17 * 60        # the 17:00 NY session boundary
    return {"utc_hhmm": f"{t:%H:%M}", "ny_hour": ny.hour, "near_session_boundary": -5 <= mins_from_close < 65}


def tick_candle(ticks, t0_ms: int, side: str):
    """Candle of one minute built from raw ticks: (o, c, l, h) in points and summed volume."""
    ins = [t for t in ticks if t0_ms <= t[0] < t0_ms + 60_000]
    if not ins:
        return None
    px = [t[2] if side == "BID" else t[1] for t in ins]
    vol = sum(t[4] if side == "BID" else t[3] for t in ins)
    pts = [round(p * dk.POINT_DIVISOR) for p in px]
    return {"n": len(ins), "ocLh": [pts[0], pts[-1], min(pts), max(pts)], "v": vol}


def arbitrate(tc, x, z) -> dict:
    """Which candle the ticks reproduce (exact points for prices; volume reported as numbers)."""
    if tc is None:
        return {"ticks": 0, "price_matches": "no_ticks"}
    def m(r):
        return r is not None and not dead(r) and list(r[1:5]) == tc["ocLh"]
    pa, pz = m(x), m(z)
    return {"ticks": tc["n"], "tick_ocLh": tc["ocLh"], "tick_v": round(tc["v"], 6),
            "price_matches": "both" if pa and pz else "datafeed" if pa else "jforex" if pz else "neither"}


def run(cache: Path, days: list[date], out: Path, group: str, fetch=dk.fetch, sleep=time.sleep,
        cooldown_s=600, max_cooldowns=6, log=print, tick_budget=None) -> dict:
    rep = json.loads(out.read_text()) if out.exists() else {"rows": []}
    done = {(r["day"], r["side"]) for r in rep["rows"] if r["status"] != "fetch_failed"}
    rep["rows"] = [r for r in rep["rows"] if r["status"] != "fetch_failed"]
    tick_budget = tick_budget if tick_budget is not None else [MAX_TICK_HOURS - sum(r.get("tick_hours", 0) for r in rep["rows"])]
    tick_cache = {}
    streak = 0

    def get(url):
        nonlocal streak
        while True:
            try:
                raw = fetch(url)
                streak = 0
                return raw
            except (dk.RateLimited, ConnectionError) as e:
                streak += 1
                log(f"THROTTLED ({e}); cool-down {cooldown_s}s [{streak}/{max_cooldowns}]")
                if streak >= max_cooldowns:
                    raise
                sleep(cooldown_s)

    try:
        for d in days:
            dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
            for side in ("BID", "ASK"):
                if (d.isoformat(), side) in done:
                    continue
                url = dk.candle_url(dt, side)
                local = cache / url.split("/datafeed/", 1)[1]
                row = {"group": group, "day": d.isoformat(), "side": side}
                if not local.exists():
                    rep["rows"].append({**row, "status": "not_in_cache"}); continue
                raw = get(url)
                if raw is None:
                    rep["rows"].append({**row, "status": "no_datafeed_file"}); continue
                a = list(REC.iter_unpack(lzma.decompress(raw)))
                b = list(REC.iter_unpack(local.read_bytes()))
                diffs = classify(a, b)
                minutes, hours = [], 0
                for sec, k, x, z in diffs:
                    item = {"sec": sec, "kind": k, **ny_context(d, sec), "datafeed": list(x[1:]) if x else None, "jforex": list(z[1:]) if z else None}
                    if k in ("price", "flat_zero_volume"):
                        hk = (d, sec // 3600)
                        if hk not in tick_cache and tick_budget[0] > 0:
                            hour = dt + timedelta(hours=sec // 3600)
                            traw = get(dk.tick_url(hour))
                            tick_cache[hk] = dk.decode_ticks(traw or b"", int(hour.timestamp() * 1000))
                            tick_budget[0] -= 1
                            hours += 1
                        if hk in tick_cache:
                            item["arbiter"] = arbitrate(tick_candle(tick_cache[hk], int(dt.timestamp() * 1000) + sec * 1000, side), x, z)
                    minutes.append(item)
                traded = sum(1 for r in a if not dead(r))
                rep["rows"].append({**row, "status": "identical" if not diffs else "differs", "records": [len(a), len(b)],
                                    "traded_minutes_datafeed": traded, "kinds": dict(Counter(m["kind"] for m in minutes)),
                                    "minutes": minutes, "tick_hours": hours})
                log(f"{d} {side} {'identical' if not diffs else dict(Counter(m['kind'] for m in minutes))}")
                out.write_text(json.dumps(rep, indent=1))
    except (dk.RateLimited, ConnectionError) as e:
        log(f"stopped cleanly after {max_cooldowns} cool-downs: {e}")
        rep["stopped"] = str(e)
    out.write_text(json.dumps(rep, indent=1))
    return rep


def summarize(rep: dict) -> dict:
    """Message 30 §5 metrics per group: days/minutes differing, rates, timing, arbiter verdicts."""
    res = {}
    for g in sorted({r["group"] for r in rep["rows"]}):
        rows = [r for r in rep["rows"] if r["group"] == g and r["status"] in ("identical", "differs")]
        mins = [m for r in rows for m in r.get("minutes", [])]
        traded = sum(r["traded_minutes_datafeed"] for r in rows)
        kinds = Counter(m["kind"] for m in mins)
        res[g] = {
            "files_compared": len(rows), "files_identical": sum(r["status"] == "identical" for r in rows),
            "days_compared": len({r["day"] for r in rows}), "days_differing": len({r["day"] for r in rows if r["status"] == "differs"}),
            "minutes_differing": len(mins), "kinds": dict(kinds), "traded_minutes_compared": traded,
            "price_mismatch_rate": (kinds["price"] + kinds["flat_zero_volume"]) / traded if traded else None,
            "volume_only_rate": kinds["volume_only"] / traded if traded else None,
            "utc_minute_of_differences": dict(Counter(m["utc_hhmm"] for m in mins).most_common(10)),
            "near_session_boundary": sum(m["near_session_boundary"] for m in mins),
            "by_year": dict(Counter(r["day"][:4] for r in rows if r["status"] == "differs")),
            "arbiter": dict(Counter(f'{m["kind"]}:{m["arbiter"]["price_matches"]}' for m in mins if "arbiter" in m)),
            "not_in_cache": sum(r["status"] == "not_in_cache" for r in rep["rows"] if r["group"] == g),
        }
    return res


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--cache", required=True)
    ap.add_argument("--years", nargs=2, type=int, required=True)
    ap.add_argument("--recent", nargs=2, default=None, help="first and last day of the recent group (ISO)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    out, cache = Path(a.out), Path(a.cache)        # cache root (holds XAUUSD/...)
    log = lambda s: print(s, flush=True)
    rep = run(cache, sample_days(*a.years), out, "sample", log=log)
    if a.recent and "stopped" not in rep:
        d0, d1 = date.fromisoformat(a.recent[0]), date.fromisoformat(a.recent[1])
        rep = run(cache, [d0 + timedelta(days=k) for k in range((d1 - d0).days + 1)], out, "recent", log=log)
    rep["summary"] = summarize(rep)
    out.write_text(json.dumps(rep, indent=1))
    print(json.dumps(rep["summary"], indent=1))


if __name__ == "__main__":
    main()
