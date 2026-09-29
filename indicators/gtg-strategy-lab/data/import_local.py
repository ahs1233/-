"""Path B (message 26): the same Dukascopy feed obtained through JForex, imported locally.

Two modes; neither changes the feed, the decoding or the sanitation of §2.2:
  cache  JForex keeps the Dukascopy M1 files it downloads in a local cache, same path layout
         (0-based month) and the same 24-byte records as the datafeed, but uncompressed (F-012).
         They go through build_history.build_day with compressed=False (fetch = read the local
         file instead of HTTP) → the same decoding and sanitation; raw_format = "plain".
  csv    Historical Data Manager CSV exports (one BID file, one ASK file, GMT, 1 minute) are
         parsed into the same candle tuples, then candles_to_m1 → write_day. Timezone must be
         GMT/UTC; anything else is refused.
Both tag the manifest with `origin`. `crosscheck` compares imported days with days already
downloaded from the datafeed: identical raw sha256 (cache) or identical bars (csv).

  python import_local.py cache --cache <dir containing XAUUSD/...> --root <data root> --from 2003-01-01 --to 2026-09-30
  python import_local.py csv --bid bid.csv --ask ask.csv --root <data root>
  python import_local.py crosscheck --root <data root> --ref <datafeed data root>
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import dukascopy as dk
from bars import candles_to_m1
from build_history import build_day, days_between
from integrity import read_day_file
from lab_config import T_FREEZE_MS
from store import append_manifest, read_manifest, root_dir, sha256, write_day

UTC = timezone.utc


# ---------- cache mode ----------
def cache_path(cache: Path, url: str) -> Path:
    """datafeed URL → the same relative path under the local cache root."""
    rel = url.split("/datafeed/", 1)[1]
    return cache / rel


def cache_fetch(cache: Path):
    def fetch(url: str):
        p = cache_path(cache, url)
        return p.read_bytes() if p.exists() else None
    return fetch


def import_cache(cache: Path, root: Path, start: datetime, end: datetime, log=print) -> dict:
    done = {e["day"] for e in read_manifest(root) if e.get("kind") == "history_day" and e.get("source") == "m1"}
    n = found = 0
    for d in days_between(start, end, newest_first=False):
        if f"{d:%Y-%m-%d}" in done:
            continue
        r = build_day(d, fetch=cache_fetch(cache), root=root, origin="jforex-cache", compressed=False)["entry"]
        n += 1
        found += r["source"] == "m1"
    log(f"cache import: {n} days processed, {found} with data")
    return {"processed": n, "with_data": found}


# ---------- csv mode ----------
TIME_FORMATS = ("%d.%m.%Y %H:%M:%S.%f", "%Y.%m.%d %H:%M:%S.%f", "%d.%m.%Y %H:%M:%S", "%Y.%m.%d %H:%M:%S", "%Y-%m-%d %H:%M:%S")
TIME_HEADERS = ("gmt time", "time (utc)", "time (gmt)", "utc time", "time")


def parse_time(s: str) -> int:
    s = s.strip().replace(" GMT", "").replace(" UTC", "")
    for f in TIME_FORMATS:
        try:
            return int(datetime.strptime(s, f).replace(tzinfo=UTC).timestamp() * 1000)
        except ValueError:
            pass
    raise ValueError(f"unrecognised time {s!r}")


def read_jforex_csv(path: Path) -> list[tuple]:
    """→ [(t_ms, o, h, l, c, v)] from a JForex export in GMT."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    head = [h.strip().lower() for h in rows[0]]
    tcol = next((i for i, h in enumerate(head) if h in TIME_HEADERS), None)
    if tcol is None or not any("gmt" in h or "utc" in h for h in head[tcol:tcol + 1]):
        raise ValueError(f"{path.name}: the time column must be GMT/UTC, header = {rows[0]}")
    idx = {k: head.index(k) for k in ("open", "high", "low", "close", "volume")}
    out = []
    for r in rows[1:]:
        if not r or not r[tcol].strip():
            continue
        t = parse_time(r[tcol])
        if t % 60_000:
            raise ValueError(f"{path.name}: {r[tcol]} is not a minute")
        o, h, lo, c, v = (float(r[idx[k]]) for k in ("open", "high", "low", "close", "volume"))
        for px in (o, h, lo, c):
            if not (dk.PRICE_SANITY[0] <= px <= dk.PRICE_SANITY[1]):
                raise dk.FeedError(f"{path.name}: price {px} outside sanity range")
        out.append((t, o, h, lo, c, v))
    return out


def import_csv(bid_path: Path, ask_path: Path, root: Path, log=print) -> dict:
    by_day = defaultdict(lambda: {"bid": [], "ask": []})
    for side, p in (("bid", bid_path), ("ask", ask_path)):
        for t, o, h, lo, c, v in read_jforex_csv(p):
            by_day[datetime.fromtimestamp(t / 1000, UTC).strftime("%Y-%m-%d")][side].append((t, o, h, lo, c, v))
    done = {e["day"] for e in read_manifest(root) if e.get("kind") == "history_day" and e.get("source") == "m1"}
    n = 0
    for day in sorted(by_day):
        if day in done:
            continue
        bars = [b for b in candles_to_m1(by_day[day]["bid"], by_day[day]["ask"]) if b["t"] + 60_000 <= T_FREEZE_MS]
        if not bars:
            continue
        p = write_day(root, datetime.fromisoformat(day).replace(tzinfo=UTC), bars)
        append_manifest(root, {"kind": "history_day", "day": day, "source": "m1", "origin": "jforex-csv", "bars": len(bars),
                               "ask_coverage": sum(b["ao"] is not None for b in bars) / len(bars),
                               "bid_sha256": sha256(bid_path.read_bytes()), "ask_sha256": sha256(ask_path.read_bytes()),
                               "m1_file": str(p.relative_to(root)).replace("\\", "/"), "m1_sha256": sha256(p.read_bytes())})
        n += 1
    log(f"csv import: {n} days written")
    return {"days": n}


# ---------- cross-check ----------
def crosscheck(root: Path, ref: Path) -> dict:
    """Days present in both stores: bars must be identical (the gate). Raw sha256 is reported only
    when both stores hold the same raw format (lzma vs plain files never hash alike)."""
    def days(r):
        return {e["day"]: e for e in read_manifest(r) if e.get("kind") == "history_day" and e.get("source") == "m1"}
    a, b = days(root), days(ref)
    both = sorted(set(a) & set(b))
    rows, bad = [], 0
    for d in both:
        ea, eb = a[d], b[d]
        fa, fb = ea.get("raw_format", "lzma"), eb.get("raw_format", "lzma")
        same_raw = (ea.get("bid_sha256") == eb.get("bid_sha256") and ea.get("ask_sha256") == eb.get("ask_sha256")) if fa == fb else None
        ba, bb = read_day_file(root / ea["m1_file"]), read_day_file(ref / eb["m1_file"])
        same_bars = ba == bb
        vol_ratio = (sum(x["v"] for x in ba) / sum(x["v"] for x in bb)) if bb and sum(x["v"] for x in bb) else None
        bad += not same_bars
        rows.append({"day": d, "same_raw_sha256": same_raw, "same_bars": same_bars, "bars": [len(ba), len(bb)], "volume_ratio": vol_ratio})
    return {"verdict": "PASS" if both and not bad else ("NO_OVERLAP" if not both else "FAIL"), "overlap_days": len(both), "mismatched_days": bad, "days": rows}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="mode", required=True)
    c = sub.add_parser("cache"); c.add_argument("--cache", required=True); c.add_argument("--root", required=True)
    c.add_argument("--from", dest="start", required=True); c.add_argument("--to", dest="end", required=True)
    v = sub.add_parser("csv"); v.add_argument("--bid", required=True); v.add_argument("--ask", required=True); v.add_argument("--root", required=True)
    x = sub.add_parser("crosscheck"); x.add_argument("--root", required=True); x.add_argument("--ref", required=True); x.add_argument("--out")
    a = ap.parse_args(argv)
    if a.mode == "cache":
        s = datetime.fromisoformat(a.start).replace(tzinfo=UTC); e = datetime.fromisoformat(a.end).replace(tzinfo=UTC)
        print(json.dumps(import_cache(Path(a.cache), root_dir(a.root), s, e)))
    elif a.mode == "csv":
        print(json.dumps(import_csv(Path(a.bid), Path(a.ask), root_dir(a.root))))
    else:
        rep = crosscheck(Path(a.root), Path(a.ref))
        if a.out:
            Path(a.out).write_text(json.dumps(rep, indent=1))
        print(json.dumps({k: v for k, v in rep.items() if k != "days"}, indent=1))


if __name__ == "__main__":
    main()
