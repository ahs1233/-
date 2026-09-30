"""JForex API feasibility (GPT messages 46/47) — Engineering Feasibility Test, NOT research evidence.

Inputs: the CSVs written by jforex/GtgHistoryExport.java (authenticated IHistory, fixed day list).
Compared with the public Dukascopy datafeed (fetched here, paced, cached in --out):
  ticks       API ticks vs the public tick bi5 on fixed hours: the (t, ask, bid) sequence exactly, volumes
  ticks → M1  M1 rebuilt from the API ticks vs the public M1 candle files, BID and ASK, traded minutes
  bars        API M1 bars (Filter.NO_FILTER) vs the public candle files, and vs the JForex cache files
  timing      ms per day for the API bars and ticks → throughput estimate for 2018–2026
The day list contains days known to be disputed (F-012): its mismatch rates say nothing about the
source in general (GPT message 47). Nothing is imported, merged or corrected.

  python xcheck_jforex_api.py --api <captures/jforex_api> --cache <JForex4/.cache> --out <dir>
"""
from __future__ import annotations

import argparse
import csv
import json
import struct
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import dukascopy as dk
from bars import is_dead_candle

REC = struct.Struct(">IIIIIf")
# fixed before any result: three plain hours per day plus the hours of the known disputes
BASE_HOURS = (8, 13, 20)
DISPUTED_HOURS = {"2026-07-07": (12,), "2026-07-14": (10,), "2026-09-22": (7, 23), "2015-06-30": (21,)}


def pts(p: float) -> int:
    return round(p * 1000)


def read_csv(path: Path) -> list[dict]:
    with open(path, newline="") as fh:
        return [{k: float(v) for k, v in r.items()} for r in csv.DictReader(fh)]


def fetch_cached(url: str, out: Path, fetch=dk.fetch) -> bytes | None:
    p = out / "public" / url.split("/datafeed/", 1)[1]
    if p.exists():
        return p.read_bytes() or None
    raw = fetch(url)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(raw or b"")
    return raw


def compare_ticks(api: list[dict], pub: list[tuple]) -> dict:
    """Same ticks, same order, same prices (points), volumes to float32 precision."""
    a = [(int(t["t"]), pts(t["ask"]), pts(t["bid"])) for t in api]
    b = [(t, pts(ask), pts(bid)) for t, ask, bid, _, _ in pub]
    vol_ok = len(api) == len(pub) and all(abs(x["askVol"] - y[3]) <= 1e-5 * max(1, y[3]) and abs(x["bidVol"] - y[4]) <= 1e-5 * max(1, y[4]) for x, y in zip(api, pub))
    first = next((i for i, (x, y) in enumerate(zip(a, b)) if x != y), None if len(a) == len(b) else min(len(a), len(b)))
    return {"api": len(a), "public": len(b), "identical": a == b, "volumes_identical": vol_ok,
            "first_difference": None if first is None else {"api": a[first] if first < len(a) else None, "public": b[first] if first < len(b) else None}}


def ticks_to_m1(ticks: list[dict], side: str) -> dict[int, tuple]:
    """minute (ms) → (o, h, l, c) in points and summed volume, from the API ticks of one side."""
    px, vk = ("bid", "bidVol") if side == "BID" else ("ask", "askVol")
    m: dict[int, list] = {}
    for t in ticks:
        k = int(t["t"]) // 60_000 * 60_000
        p = pts(t[px])
        if k not in m:
            m[k] = [p, p, p, p, t[vk]]
        else:
            x = m[k]; x[1] = max(x[1], p); x[2] = min(x[2], p); x[3] = p; x[4] += t[vk]
    return {k: (tuple(v[:4]), v[4]) for k, v in m.items()}


def compare_m1(candles: list[tuple], built: dict[int, tuple]) -> dict:
    """Public candles (t, o, h, l, c, v) vs tick-built minutes on the traded (non-dead) minutes."""
    traded = {c[0]: c for c in candles if not is_dead_candle(c[1], c[2], c[3], c[4], c[5])}
    common = [t for t in traded if t in built]
    same = [t for t in common if tuple(pts(x) for x in traded[t][1:5]) == built[t][0]]
    vol = [abs(built[t][1] - traded[t][5]) / traded[t][5] for t in common if traded[t][5] > 0]
    diff = sorted(set(common) - set(same))
    return {"traded_public": len(traded), "built_minutes": len(built), "common": len(common),
            "only_public": len(set(traded) - set(built)), "only_ticks": len(set(built) - set(traded)),
            "ohlc_identical": len(same), "ohlc_differs": len(diff),
            "differing_minutes_utc": [datetime.fromtimestamp(t / 1000, timezone.utc).strftime("%H:%M") for t in diff[:20]],
            "volume_rel_diff_max": max(vol) if vol else None}


def compare_bars(api: list[dict], candles: list[tuple]) -> dict:
    a = {int(b["t"]): (pts(b["o"]), pts(b["h"]), pts(b["l"]), pts(b["c"]), b["v"]) for b in api}
    p = {c[0]: (pts(c[1]), pts(c[2]), pts(c[3]), pts(c[4]), c[5]) for c in candles}
    common = sorted(set(a) & set(p))
    price_diff = [t for t in common if a[t][:4] != p[t][:4]]
    vol_diff = [t for t in common if a[t][:4] == p[t][:4] and abs(a[t][4] - p[t][4]) > 1e-5 * max(1, p[t][4])]
    return {"api": len(a), "reference": len(p), "common": len(common), "price_differs": len(price_diff), "volume_only_differs": len(vol_diff),
            "differing_minutes_utc": [datetime.fromtimestamp(t / 1000, timezone.utc).strftime("%H:%M") for t in price_diff[:20]]}


def run(api_dir: Path, cache: Path | None, out: Path, fetch=dk.fetch, log=print) -> dict:
    days = sorted({p.name.split("_")[0] for p in api_dir.glob("*_ticks.csv")})
    timings = defaultdict(dict)
    if (api_dir / "timings.csv").exists():
        with open(api_dir / "timings.csv", newline="") as fh:
            for r in csv.DictReader(fh):
                timings[r["day"]][r["kind"]] = {"ms": int(r["ms"]), "rows": int(r["rows"])}
    rep = {"label": "JForex API Feasibility — NOT RESEARCH EVIDENCE (disputed days included on purpose)", "days": {}}
    for d in days:
        day = datetime.fromisoformat(d).replace(tzinfo=timezone.utc)
        ticks = read_csv(api_dir / f"{d}_ticks.csv")
        r = {"timing": timings.get(d, {}), "ticks_vs_public": {}, "ticks_m1_vs_public": {}, "bars_vs_public": {}, "bars_vs_cache": {}}
        by_hour = defaultdict(list)
        for t in ticks:
            by_hour[(int(t["t"]) - int(day.timestamp() * 1000)) // 3_600_000].append(t)
        for h in sorted(set(BASE_HOURS) | set(DISPUTED_HOURS.get(d, ()))):
            hour = day + timedelta(hours=h)
            raw = fetch_cached(dk.tick_url(hour), out, fetch)
            pub = dk.decode_ticks(raw or b"", int(hour.timestamp() * 1000))
            r["ticks_vs_public"][f"{h:02d}h"] = compare_ticks(by_hour.get(h, []), pub)
        for side in ("BID", "ASK"):
            url = dk.candle_url(day, side)
            candles = dk.decode_candles(fetch_cached(url, out, fetch) or b"", int(day.timestamp()))
            r["ticks_m1_vs_public"][side] = compare_m1(candles, ticks_to_m1(ticks, side))
            api_bars = read_csv(api_dir / f"{d}_{side}_m1.csv")
            r["bars_vs_public"][side] = compare_bars(api_bars, candles)
            local = cache / url.split("/datafeed/", 1)[1] if cache else None
            if local and local.exists():
                r["bars_vs_cache"][side] = compare_bars(api_bars, dk.decode_candles(local.read_bytes(), int(day.timestamp()), compressed=False))
        rep["days"][d] = r
        log(f"{d} done")
    tick_ms = [v["ticks"]["ms"] for v in timings.values() if "ticks" in v]
    if tick_ms:
        avg = sum(tick_ms) / len(tick_ms)
        rep["throughput"] = {"ticks_ms_per_day_avg": round(avg), "ticks_ms_per_day_max": max(tick_ms),
                             "est_hours_for_3100_days": round(3100 * avg / 3_600_000, 1),
                             "note": "bars of these days were already in the local JForex cache, so bar timings are not network timings"}
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_text(json.dumps(rep, indent=1))
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--api", required=True)
    ap.add_argument("--cache")
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    rep = run(Path(a.api), Path(a.cache) if a.cache else None, Path(a.out), log=lambda s: print(s, flush=True))
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
