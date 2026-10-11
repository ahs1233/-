"""OANDA feasibility test (GPT message 42): OANDA v20 M1 vs the Dukascopy store vs TradingView.

Not research evidence and not an import: OANDA never enters the Research Dataset, nothing is
merged or corrected. The day range is every day already in the Dukascopy store inside
[--from, --to] (fixed before any OANDA candle is read; no day is chosen after seeing results).

  timestamps   minutes present in each source (in and out of the §2.2 session)
  OHLC         BID and ASK per field on the common minutes: exact share, |Δ| quantiles, bias
  volume       separately (never a price error): rank correlation and scale ratio
  TradingView  OANDA:XAUUSD captures (M1 CSV, H1 bars) vs OANDA BID / MID / ASK and Dukascopy BID
Writes feeds for the GTG-state comparison (events/source_parity.mjs) and the M1 series for the
volume-only Fuel check (engine/fuel-compare.mjs). No event, outcome, power or edge here.

  python xcheck_oanda.py --root <store> --token-file <file> --from 2025-12-01 --to 2026-09-29 \\
      --tv <parity/captures> --out <dir>
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import oanda
import tv_calendar
from bars import aggregate
from export_feeds import build_feeds, load_m1

FIELDS = ("o", "h", "l", "c")


def _q(xs, p):
    if not xs:
        return None
    s = sorted(xs)
    return s[min(len(s) - 1, int(p * (len(s) - 1) + 0.5))]


def minutes(duk: list[dict], oan: list[dict]) -> dict:
    D, O = {b["t"] for b in duk}, {b["t"] for b in oan}
    only_d, only_o = D - O, O - D
    ins = lambda ts: sum(1 for t in ts if tv_calendar.in_session(t))
    return {"dukascopy": len(D), "oanda": len(O), "common": len(D & O),
            "only_dukascopy": len(only_d), "only_oanda": len(only_o),
            "only_dukascopy_in_session": ins(only_d), "only_oanda_in_session": ins(only_o)}


def price_stats(pairs) -> dict:
    """pairs: [(a, b)] prices → exact / ≤0.01 / ≤0.10 shares, |Δ| quantiles, mean signed Δ (a − b)."""
    d = [round(a - b, 6) for a, b in pairs]
    ad = [abs(x) for x in d]
    n = len(d)
    if not n:
        return {"n": 0}
    return {"n": n, "exact": sum(x < 0.0005 for x in ad) / n, "within_0.01": sum(x <= 0.0105 for x in ad) / n,
            "within_0.10": sum(x <= 0.1005 for x in ad) / n, "p50": _q(ad, 0.5), "p90": _q(ad, 0.9),
            "p99": _q(ad, 0.99), "max": max(ad), "bias": sum(d) / n}


def ohlc(duk: list[dict], oan: list[dict]) -> dict:
    by = {b["t"]: b for b in oan}
    common = [(b, by[b["t"]]) for b in duk if b["t"] in by]
    out = {}
    for side in ("b", "a"):
        for f in FIELDS:
            k = side + f
            out[("BID " if side == "b" else "ASK ") + f.upper()] = price_stats(
                [(x[k], y[k]) for x, y in common if x[k] is not None])
    return out


def _ranks(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        for k in range(i, j + 1):
            r[order[k]] = (i + j) / 2
        i = j + 1
    return r


def spearman(a, b):
    if len(a) < 3:
        return None
    ra, rb = _ranks(a), _ranks(b)
    ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    va, vb = sum((x - ma) ** 2 for x in ra), sum((y - mb) ** 2 for y in rb)
    return cov / (va * vb) ** 0.5 if va and vb else None


def volume(duk: list[dict], oan: list[dict]) -> dict:
    by = {b["t"]: b for b in oan}
    pairs = [(b["v"], by[b["t"]]["v"]) for b in duk if b["t"] in by]
    ratios = [o / d for d, o in pairs if d > 0]
    return {"n": len(pairs), "spearman": spearman([p[0] for p in pairs], [p[1] for p in pairs]),
            "median_oanda_over_dukascopy": _q(ratios, 0.5), "note": "different units: Dukascopy traded volume vs OANDA price-update count"}


def mid(b: dict) -> dict:
    return {"t": b["t"], **{f: round((b["b" + f] + b["a" + f]) / 2, 4) for f in FIELDS}}


def vs_tv(tv: list[dict], series: dict[str, list[dict]]) -> dict:
    """tv: [{t, o, h, l, c, v}]; series: name → [{t, o, h, l, c[, v]}] → OHLC agreement per series."""
    out = {}
    for name, rows in series.items():
        by = {r["t"]: r for r in rows}
        common = [(x, by[x["t"]]) for x in tv if x["t"] in by]
        per = {f.upper(): price_stats([(y[f], x[f]) for x, y in common]) for f in FIELDS}
        all_exact = sum(all(abs(y[f] - x[f]) < 0.0005 for f in FIELDS) for x, y in common)
        vol = sum(1 for x, y in common if "v" in y and y["v"] == x["v"])
        out[name] = {"tv_bars": len(tv), "common": len(common), "ohlc_all_exact": all_exact / len(common) if common else None,
                     "volume_equal": vol / len(common) if common else None, "fields": per}
    return out


def side(bars: list[dict], s: str) -> list[dict]:
    return [{"t": b["t"], "o": b[s + "o"], "h": b[s + "h"], "l": b[s + "l"], "c": b[s + "c"], "v": b["v"]} for b in bars]


def read_tv_m1(path: Path) -> list[dict]:
    rows = csv.DictReader(io.TextIOWrapper(gzip.open(path), encoding="utf-8"))
    return [{"t": int(r["time"]) * 1000, "o": float(r["open"]), "h": float(r["high"]), "l": float(r["low"]),
             "c": float(r["close"]), "v": float(r["m_volume"]) if r.get("m_volume") else None} for r in rows]


def read_tv_bars(path: Path) -> list[dict]:
    return [{"t": t * 1000, "o": o, "h": h, "l": l, "c": c, "v": v} for t, o, h, l, c, v in json.load(gzip.open(path))["bars"]]


def as_m1(bars: list[dict]) -> list[dict]:
    return [{**b, "n": 0, "src": "m1"} for b in bars]


def feeds_doc(m1: list[dict]) -> dict:
    feeds, _ = build_feeds(m1)
    return {"meta": {"m1_bars": len(m1)}, "feeds": feeds}


def run(root: Path, oan: list[dict], start: str, end: str, tv_dir: Path | None, out: Path) -> dict:
    duk = load_m1(root, start, end)
    lo, hi = duk[0]["t"], duk[-1]["t"]
    oan = [b for b in oan if lo <= b["t"] <= hi]
    rep = {"label": "OANDA Feasibility Test — NOT RESEARCH EVIDENCE", "range": [start, end],
           "timestamps": minutes(duk, oan), "ohlc_vs_dukascopy": ohlc(duk, oan), "volume": volume(duk, oan)}
    if tv_dir:
        o_bid, o_ask = side(oan, "b"), side(oan, "a")
        o_mid = [{**mid(b), "v": b["v"]} for b in oan]
        d_bid = side(duk, "b")
        m1 = {"OANDA BID": o_bid, "OANDA MID": o_mid, "OANDA ASK": o_ask, "Dukascopy BID": d_bid}
        tv1 = read_tv_m1(tv_dir / "2026-09-29" / "copy_M1.csv.gz")
        rep["tv_M1"] = vs_tv(tv1, m1)
        h1 = {k: [{"t": b["t"], "o": b["bo"], "h": b["bh"], "l": b["bl"], "c": b["bc"], "v": b["v"]}
                  for b in aggregate(as_m1([{"t": r["t"], "bo": r["o"], "bh": r["h"], "bl": r["l"], "bc": r["c"],
                                              "ao": None, "ah": None, "al": None, "ac": None, "v": r["v"]} for r in v]), "H1")]
              for k, v in m1.items()}
        rep["tv_H1"] = vs_tv(read_tv_bars(tv_dir / "2026-09-29-mtf" / "bars_60.json.gz"), h1)
    out.mkdir(parents=True, exist_ok=True)
    common = {b["t"] for b in oan} & {b["t"] for b in duk}
    by = {b["t"]: b for b in oan}
    dc = [b for b in duk if b["t"] in common]
    (out / "fuel_dukascopy.json").write_text(json.dumps([{"t": b["t"], "o": b["bo"], "h": b["bh"], "l": b["bl"], "c": b["bc"], "v": b["v"]} for b in dc]))
    (out / "fuel_oandavol.json").write_text(json.dumps([{"t": b["t"], "o": b["bo"], "h": b["bh"], "l": b["bl"], "c": b["bc"], "v": by[b["t"]]["v"]} for b in dc]))
    (out / "feeds_dukascopy.json").write_text(json.dumps(feeds_doc(duk), separators=(",", ":")))
    (out / "feeds_oanda.json").write_text(json.dumps(feeds_doc(as_m1(oan)), separators=(",", ":")))
    (out / "report.json").write_text(json.dumps(rep, indent=1))
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", required=True)
    ap.add_argument("--token-file", required=True)
    ap.add_argument("--from", dest="start", required=True)
    ap.add_argument("--to", dest="end", required=True)
    ap.add_argument("--tv")
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    out = Path(a.out)
    cache = out / "oanda_m1.json"
    if cache.exists():
        oan = json.loads(cache.read_text())
    else:
        s = int(datetime.fromisoformat(a.start).replace(tzinfo=timezone.utc).timestamp())
        e = int(datetime.fromisoformat(a.end).replace(tzinfo=timezone.utc).timestamp()) + 86400
        oan = oanda.fetch_m1(s, e, oanda.read_token(Path(a.token_file)), log=lambda x: print(x, flush=True))
        out.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(oan))
    rep = run(Path(a.root), oan, a.start, a.end, Path(a.tv) if a.tv else None, out)
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
