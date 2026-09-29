"""F-012 evidence: JForex cache vs the public datafeed on a deterministic sample of old days.

Sample: 2 weekdays per year (seed 20260929), years given on the command line. For each day and
side the datafeed file is fetched (paced, dukascopy.fetch), decompressed and compared byte for
byte with the JForex cache file (uncompressed records); differing minutes are classified.
Prices and volumes only — no event, no outcome.

    python xcheck_jforex.py --cache <JForex4/.cache> --years 2004 2025 --out xcheck.json
"""
from __future__ import annotations

import argparse
import json
import lzma
import random
import struct
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import dukascopy as dk

REC = struct.Struct(">IIIIIf")
SEED = 20260929


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
    kinds = {}
    detail = []
    for x, z in zip(a, b):
        if x == z:
            continue
        if dead(z) and not dead(x):
            k = "jforex_flat_where_datafeed_traded"
        elif dead(x) and not dead(z):
            k = "datafeed_flat_where_jforex_traded"
        elif x[1:5] == z[1:5]:
            k = "volume_only"
        else:
            k = "price"
        kinds[k] = kinds.get(k, 0) + 1
        if len(detail) < 3:
            detail.append({"minute": f"{x[0] // 3600:02d}:{x[0] % 3600 // 60:02d}", "kind": k, "datafeed": x[1:], "jforex": z[1:]})
    return kinds, detail


def run(cache: Path, days: list[date], fetch=dk.fetch, log=print) -> dict:
    rows, bytes_identical, files = [], 0, 0
    for d in days:
        dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        for side in ("BID", "ASK"):
            url = dk.candle_url(dt, side)
            local = cache / url.split("/datafeed/", 1)[1]
            if not local.exists():
                rows.append({"day": d.isoformat(), "side": side, "status": "not_in_cache"}); continue
            raw = fetch(url)
            if raw is None:
                rows.append({"day": d.isoformat(), "side": side, "status": "no_datafeed_file"}); continue
            a = list(REC.iter_unpack(lzma.decompress(raw))) if raw else []
            b = list(REC.iter_unpack(local.read_bytes()))
            files += 1
            same = a == b
            bytes_identical += same
            kinds, detail = ({}, []) if same else classify(a, b)
            rows.append({"day": d.isoformat(), "side": side, "status": "identical" if same else "differs", "kinds": kinds, "detail": detail})
            log(f"{d} {side} {'identical' if same else kinds}")
    return {"files_compared": files, "files_identical": bytes_identical, "rows": rows}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--cache", required=True)
    ap.add_argument("--years", nargs=2, type=int, required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    rep = run(Path(a.cache), sample_days(*a.years), log=lambda s: print(s, flush=True))   # cache root (holds XAUUSD/...)
    Path(a.out).write_text(json.dumps(rep, indent=1))
    print(json.dumps({k: v for k, v in rep.items() if k != "rows"}))


if __name__ == "__main__":
    main()
