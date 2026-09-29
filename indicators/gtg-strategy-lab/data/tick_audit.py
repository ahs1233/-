"""Tick Audit of the official Dukascopy M1 candles — TRADE_CONTRACT v0.2.1 §2.3.

1. select_days(): 20 deterministic, stratified UTC days (5 year buckets × 4 day types),
   chosen from the official BID M1 before any comparison is made.
2. audit_day(): tick-built M1 vs official M1 per side (timestamps, OHLC within one feed
   tick = 0.001), volume statistics, and the Fuel decision check (JS, engine/fuel-compare.mjs).
3. verdict(): PASS-A / PASS-B / FAIL, or TICK_AUDIT_BLOCKED_BY_SOURCE when the source
   throttles (that is not a FAIL of the M1 data).

Usage: python tick_audit.py --root DIR [--select-only]
"""
from __future__ import annotations

import argparse
import json
import math
import random
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import dukascopy as dk
from bars import is_dead_candle, ticks_to_m1
from store import read_day, read_manifest, root_dir

SEED = 20260929
FEED_TICK = 0.001
OHLC_TOL = FEED_TICK + 1e-9          # one Dukascopy point; 1e-9 absorbs float representation only
MIN_FULL_DAY_BARS = 1200
FUEL_JS = Path(__file__).resolve().parents[1] / "engine" / "fuel-compare.mjs"
UTC = timezone.utc


def _day_range(bars):
    return max(b["bh"] for b in bars) - min(b["bl"] for b in bars)


def select_days(day_bars: dict[str, list[dict]], seed: int = SEED) -> list[dict]:
    """day_bars: 'YYYY-MM-DD' -> official M1 bars of that day (BID fields used)."""
    full = {d: b for d, b in day_bars.items() if len(b) >= MIN_FULL_DAY_BARS}
    days = sorted(full)
    if not days:
        return []
    first, last = datetime.fromisoformat(days[0]), datetime.fromisoformat(days[-1])
    span = (last - first) / 5
    rng = random.Random(seed)
    chosen: list[dict] = []
    taken: set[str] = set()
    for k in range(5):
        lo, hi = first + span * k, first + span * (k + 1)
        months = sorted({d[:7] for d in days if lo <= datetime.fromisoformat(d) < hi or (k == 4 and datetime.fromisoformat(d) == last)})
        if not months:
            continue
        month = rng.choice(months)
        mdays = [d for d in days if d.startswith(month)]
        ranges = {d: _day_range(full[d]) for d in mdays}
        med = sorted(ranges.values())[len(ranges) // 2]
        by_week = [d for d in mdays if 8 <= int(d[8:]) <= 14]
        orders = {
            "week_reopen": sorted(by_week, key=lambda d: d) + [d for d in mdays if d not in by_week],
            "high_vol": sorted(mdays, key=lambda d: (-ranges[d], d)),
            "low_vol": sorted(mdays, key=lambda d: (ranges[d], d)),
            "normal": sorted(mdays, key=lambda d: (abs(ranges[d] - med), d)),
        }
        for typ, order in orders.items():
            pick = next((d for d in order if d not in taken), None)
            if pick:
                taken.add(pick)
                chosen.append({"bucket": k, "month": month, "type": typ, "day": pick})
    return chosen


def compare_side(tick_bars, off_bars, side: str) -> dict:
    p = "b" if side == "BID" else "a"
    t_map = {b["t"]: b for b in tick_bars}
    o_map = {b["t"]: b for b in off_bars if b[p + "o"] is not None}
    only_tick = sorted(set(t_map) - set(o_map))
    only_off = sorted(set(o_map) - set(t_map))
    worst, n_bad = 0.0, 0
    for t in set(t_map) & set(o_map):
        for f in ("o", "h", "l", "c"):
            d = abs(t_map[t][p + f] - o_map[t][p + f])
            worst = max(worst, d)
            if d > OHLC_TOL:
                n_bad += 1
    return {"common": len(set(t_map) & set(o_map)), "only_tick": len(only_tick), "only_official": len(only_off),
            "first_only_tick": only_tick[:3], "first_only_official": only_off[:3], "max_abs_diff": worst, "fields_beyond_tol": n_bad}


def volume_stats(tick_bars, off_bars) -> dict:
    o = {b["t"]: b["v"] for b in off_bars}
    pairs = [(b["v"], o[b["t"]]) for b in tick_bars if b["t"] in o]
    if len(pairs) < 3:
        return {"n": len(pairs)}
    xs, ys = zip(*pairs)
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxy = sum((x - mx) * (y - my) for x, y in pairs)
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    corr = sxy / math.sqrt(sxx * syy) if sxx > 0 and syy > 0 else None
    ratios = sorted(y / x for x, y in pairs if x > 0)
    return {"n": len(pairs), "corr": corr, "median_scale_official_over_tick": ratios[len(ratios) // 2] if ratios else None,
            "zero_official": sum(1 for _, y in pairs if y == 0), "zero_tick": sum(1 for x, _ in pairs if x == 0)}


def fuel_check(off_bars, vol_by_t: dict[int, float], node: str = "node") -> dict:
    """Fuel decisions with the official volume vs the tick-derived volume (all else identical)."""
    a = [{"t": b["t"], "o": b["bo"], "h": b["bh"], "l": b["bl"], "c": b["bc"], "v": b["v"]} for b in off_bars]
    bvol = [dict(x, v=vol_by_t.get(x["t"], float("nan"))) for x in a]
    with tempfile.TemporaryDirectory() as d:
        pa, pb = Path(d) / "a.json", Path(d) / "b.json"
        pa.write_text(json.dumps(a)); pb.write_text(json.dumps(bvol).replace("NaN", "null"))
        out = subprocess.run([node, str(FUEL_JS), str(pa), str(pb)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def audit_day(day: str, off_bars: list[dict], fetch=dk.fetch, fuel=fuel_check) -> dict:
    d0 = datetime.fromisoformat(day).replace(tzinfo=UTC)
    ticks = []
    try:
        for h in range(24):
            raw = fetch(dk.tick_url(d0 + timedelta(hours=h)))
            if raw:
                ticks.extend(dk.decode_ticks(raw, int((d0 + timedelta(hours=h)).timestamp() * 1000)))
    except dk.RateLimited as e:
        return {"day": day, "status": "TICK_AUDIT_BLOCKED_BY_SOURCE", "detail": str(e)}
    tick_bars = [b for b in ticks_to_m1(ticks) if not is_dead_candle(b["bo"], b["bh"], b["bl"], b["bc"], b["v"])]
    res = {"day": day, "status": "done", "bid": compare_side(tick_bars, off_bars, "BID"), "ask": compare_side(tick_bars, off_bars, "ASK"),
           "volume": volume_stats(tick_bars, off_bars)}
    res["fuel"] = fuel(off_bars, {b["t"]: b["v"] for b in tick_bars})
    return res


def verdict(results: list[dict]) -> str:
    if any(r["status"] == "TICK_AUDIT_BLOCKED_BY_SOURCE" for r in results):
        return "TICK_AUDIT_BLOCKED_BY_SOURCE"
    ohlc_ok = all(r[s]["only_tick"] == 0 and r[s]["only_official"] == 0 and r[s]["fields_beyond_tol"] == 0
                  for r in results for s in ("bid", "ask"))
    fuel_ok = all(r["fuel"]["mismatches"] == 0 for r in results)
    if not (ohlc_ok and fuel_ok):
        return "FAIL"
    scales = [r["volume"].get("median_scale_official_over_tick") for r in results]
    same_scale = all(s is not None and abs(s - 1.0) <= 1e-9 for s in scales)
    return "PASS-A" if same_scale else "PASS-B"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root")
    ap.add_argument("--select-only", action="store_true")
    a = ap.parse_args(argv)
    root = root_dir(a.root)
    files = {e["day"]: root / e["m1_file"] for e in read_manifest(root) if e.get("kind") == "history_day" and e.get("m1_file")}
    day_bars = {d: read_day(p) for d, p in files.items()}
    days = select_days(day_bars)
    (root / "tick_audit_days.json").write_text(json.dumps(days, indent=1))
    print(json.dumps(days, indent=1))
    if a.select_only:
        return
    results = [audit_day(x["day"], day_bars[x["day"]]) for x in days]
    report = {"verdict": verdict(results), "days": days, "results": results}
    (root / "tick_audit_report.json").write_text(json.dumps(report, indent=1))
    print("VERDICT", report["verdict"])


if __name__ == "__main__":
    main()
