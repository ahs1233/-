"""JForex vs the public canonical store over the whole local overlap (GPT message 50) — NOT research evidence.

Local only: the public side is the Path A store (sanitised M1 as built from the public candle files),
the JForex side is the JForex cache (proved identical to the authenticated IHistory bars on every
exported day, message 49), sanitised the same way (bars.candles_to_m1, T_freeze clip). No network
except the optional tick arbitration of a capped number of price differences (public tick bi5, paced,
cached). Nothing is imported, merged or corrected.

Per minute: missing / extra candle, BID price, ASK price (incl. ASK present on one side only),
volume only. Report: overlap days, exact days, days with price / volume-only differences, totals,
mismatch rates, largest price difference, UTC hour and New York session-boundary pattern.

  python xcheck_jforex_store.py --root <store> --cache <JForex4/.cache> --from 2025-10-16 --to 2026-09-29 --out <dir> [--arbitrate 20]
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import dukascopy as dk
from bars import candles_to_m1
from integrity import read_day_file
from lab_config import T_FREEZE_MS
from store import read_manifest
from xcheck_jforex import ny_context, tick_candle
from xcheck_jforex_api import fetch_cached, pts

BID, ASK = ("bo", "bh", "bl", "bc"), ("ao", "ah", "al", "ac")


def jforex_day(cache: Path, day: datetime) -> list[dict] | None:
    files = [cache / dk.candle_url(day, s).split("/datafeed/", 1)[1] for s in ("BID", "ASK")]
    if not files[0].exists():
        return None
    s = int(day.timestamp())
    bid = dk.decode_candles(files[0].read_bytes(), s, compressed=False)
    ask = dk.decode_candles(files[1].read_bytes(), s, compressed=False) if files[1].exists() else []
    return [b for b in candles_to_m1(bid, ask) if b["t"] + 60_000 <= T_FREEZE_MS]


def diff_day(pub: list[dict], jf: list[dict]) -> list[dict]:
    P, J = {b["t"]: b for b in pub}, {b["t"]: b for b in jf}
    out = []
    for t in sorted(set(P) | set(J)):
        p, j = P.get(t), J.get(t)
        if p is None or j is None:
            out.append({"t": t, "kind": "missing_in_jforex" if j is None else "extra_in_jforex"})
            continue
        bid = [abs(p[k] - j[k]) for k in BID if p[k] != j[k]]
        ask_one_side = (p["ao"] is None) != (j["ao"] is None)
        ask = [abs(p[k] - j[k]) for k in ASK if p[k] is not None and j[k] is not None and p[k] != j[k]]
        if bid or ask or ask_one_side:
            out.append({"t": t, "kind": "price", "bid": bool(bid), "ask": bool(ask), "ask_one_side": ask_one_side,
                        "max_abs": max(bid + ask, default=0.0), "public": [p[k] for k in BID + ASK], "jforex": [j[k] for k in BID + ASK]})
        elif p["v"] != j["v"]:
            out.append({"t": t, "kind": "volume_only", "ratio": j["v"] / p["v"] if p["v"] else None})
    return out


def arbitrate(item: dict, out: Path, fetch=dk.fetch) -> dict:
    """Public ticks of that minute rebuild which BID candle (points, o c l h)?"""
    hour = datetime.fromtimestamp(item["t"] // 3_600_000 * 3600, timezone.utc)
    raw = fetch_cached(dk.tick_url(hour), out, fetch)
    tc = tick_candle(dk.decode_ticks(raw or b"", int(hour.timestamp() * 1000)), item["t"], "BID")
    if tc is None:
        return {"ticks": 0, "matches": "no_ticks"}
    ocLh = lambda v: [pts(v[0]), pts(v[3]), pts(v[2]), pts(v[1])]
    a, b = ocLh(item["public"][:4]) == tc["ocLh"], ocLh(item["jforex"][:4]) == tc["ocLh"]
    return {"ticks": tc["n"], "matches": "both" if a and b else "public" if a else "jforex" if b else "neither"}


def run(root: Path, cache: Path, start: str, end: str, out: Path, arbitrate_max: int = 0, fetch=dk.fetch, log=print) -> dict:
    days = sorted({e["day"]: e for e in read_manifest(root)
                   if e.get("kind") == "history_day" and e.get("source") == "m1" and e.get("bars", 0) > 0 and start <= e["day"] <= end}.items())
    rows, not_in_cache, total = [], [], 0
    for d, e in days:
        day = datetime.fromisoformat(d).replace(tzinfo=timezone.utc)
        jf = jforex_day(cache, day)
        if jf is None:
            not_in_cache.append(d)
            continue
        pub = read_day_file(root / e["m1_file"])
        total += len(pub)
        rows.append({"day": d, "bars": len(pub), "diffs": diff_day(pub, jf)})
    diffs = [dict(x, day=r["day"]) for r in rows for x in r["diffs"]]
    kinds = Counter(x["kind"] for x in diffs)
    for x in diffs:
        c = ny_context(datetime.fromisoformat(x["day"]).date(), (x["t"] // 1000) % 86_400)
        x.update(utc_hhmm=c["utc_hhmm"], near_session_boundary=c["near_session_boundary"])
    price = [x for x in diffs if x["kind"] == "price"]
    arb = []
    for x in sorted(price, key=lambda x: -x["max_abs"])[:arbitrate_max]:
        x["arbiter"] = arbitrate(x, out, fetch)
        arb.append(x["arbiter"]["matches"])
    per_day = {r["day"]: dict(Counter(x["kind"] for x in r["diffs"])) for r in rows if r["diffs"]}
    rep = {
        "label": "JForex vs public canonical store — NOT RESEARCH EVIDENCE",
        "range": [start, end], "overlap_days": len(rows), "not_in_cache": not_in_cache,
        "exact_days": sum(1 for r in rows if not r["diffs"]),
        "days_with_price_differences": sum(1 for r in rows if any(x["kind"] == "price" for x in r["diffs"])),
        "days_with_volume_only_differences": sum(1 for r in rows if r["diffs"] and all(x["kind"] == "volume_only" for x in r["diffs"])),
        "days_with_missing_or_extra": sum(1 for r in rows if any(x["kind"] in ("missing_in_jforex", "extra_in_jforex") for x in r["diffs"])),
        "total_public_m1_bars": total, "kinds": dict(kinds),
        "price_mismatch_pct": 100 * kinds["price"] / total if total else None,
        "volume_only_mismatch_pct": 100 * kinds["volume_only"] / total if total else None,
        "missing_or_extra_pct": 100 * (kinds["missing_in_jforex"] + kinds["extra_in_jforex"]) / total if total else None,
        "largest_price_difference": max((x["max_abs"] for x in price), default=0.0),
        "price_bid_vs_ask_only": dict(Counter("bid" if x["bid"] else ("ask_one_side" if x["ask_one_side"] else "ask") for x in price)),
        "utc_hour_of_differences": dict(sorted(Counter(x["utc_hhmm"][:2] for x in diffs).items())),
        "utc_minute_top": dict(Counter(x["utc_hhmm"] for x in diffs).most_common(10)),
        "near_session_boundary": sum(x["near_session_boundary"] for x in diffs),
        "per_day": per_day,
        "arbiter": dict(Counter(arb)),
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "store_report.json").write_text(json.dumps(rep, indent=1))
    (out / "store_diffs.json").write_text(json.dumps(diffs, indent=1))
    log(json.dumps({k: v for k, v in rep.items() if k != "per_day"}, indent=1))
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--from", dest="start", required=True)
    ap.add_argument("--to", dest="end", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--arbitrate", type=int, default=0)
    a = ap.parse_args(argv)
    run(Path(a.root), Path(a.cache), a.start, a.end, Path(a.out), a.arbitrate, log=lambda s: print(s, flush=True))


if __name__ == "__main__":
    main()
