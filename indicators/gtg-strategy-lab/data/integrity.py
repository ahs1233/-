"""Data-integrity gates on the stored official M1 dataset (TRADE_CONTRACT §2.2, §20 Train role
"data diagnostics"). Reads only prices and volumes: no GTG event, outcome or edge.

Hard gates (any failure → FAIL, the day is unusable until explained):
  G1  manifest ↔ file: every built day has its file and the file's sha256 matches the manifest
  G2  time axis: minute-aligned, strictly increasing, unique, inside the file's UTC day
  G3  OHLC consistency per side: low ≤ min(open, close) ≤ max(open, close) ≤ high
  G4  price sanity: every price inside dukascopy.PRICE_SANITY; volume ≥ 0; no dead candle kept
  G5  BID/ASK order: ASK ≥ BID on open and close whenever ASK exists
Diagnostics (reported, never deleted or altered; they feed the Train diagnostics):
  D1  bars outside the §2.2 session calendar (dropped later by aggregation)
  D2  in-session gaps longer than GAP_MIN minutes
  D3  ASK coverage per day (C1_unavailable share, §8)
  D4  spikes: |close − previous close| > SPIKE_K × the day's median |Δclose|
  D5  missing weekdays between the first and last day (candidate holidays / source gaps)

    python integrity.py --root <data root> [--out report.json]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import statistics
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import tv_calendar as cal
from dukascopy import PRICE_SANITY
from store import read_manifest, sha256

GAP_MIN = 15
SPIKE_K = 25.0
PRICE_KEYS = ("bo", "bh", "bl", "bc", "ao", "ah", "al", "ac")


def _num(s):
    return None if s in ("", None) else float(s)


def read_day_file(path: Path) -> list[dict]:
    rows = list(csv.DictReader(io.StringIO(gzip.decompress(path.read_bytes()).decode("utf-8"))))
    out = []
    for r in rows:
        b = {k: _num(r[k]) for k in PRICE_KEYS}
        b["t"] = int(r["t"]); b["v"] = float(r["v"]); b["src"] = r.get("src")
        out.append(b)
    return out


def check_day(day: str, bars: list[dict]) -> dict:
    errors, diag = [], {}
    d0 = int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp() * 1000)
    prev_t = None
    for b in bars:
        t = b["t"]
        if t % 60_000 or not (d0 <= t < d0 + 86_400_000):
            errors.append(("G2", t, "not a minute of the file's UTC day"))
        if prev_t is not None and t <= prev_t:
            errors.append(("G2", t, "not strictly increasing"))
        prev_t = t
        for side in ("b", "a"):
            o, h, lo, c = (b[side + k] for k in "ohlc")
            if o is None:
                if side == "b":
                    errors.append(("G3", t, "BID missing"))
                continue
            if not (lo <= min(o, c) and max(o, c) <= h):
                errors.append(("G3", t, f"{side} OHLC inconsistent"))
            if any(not (PRICE_SANITY[0] <= x <= PRICE_SANITY[1]) for x in (o, h, lo, c)):
                errors.append(("G4", t, f"{side} price outside sanity range"))
        if b["v"] < 0:
            errors.append(("G4", t, "negative volume"))
        if b["v"] == 0 and b["bo"] == b["bh"] == b["bl"] == b["bc"]:
            errors.append(("G4", t, "dead candle kept"))
        if b["ao"] is not None and (b["ao"] < b["bo"] or b["ac"] < b["bc"]):
            errors.append(("G5", t, "ASK below BID"))
    ins = [b for b in bars if cal.in_session(b["t"])]
    diag["bars"] = len(bars)
    diag["out_of_session"] = len(bars) - len(ins)
    gaps = [(ins[k - 1]["t"], (ins[k]["t"] - ins[k - 1]["t"]) // 60_000) for k in range(1, len(ins))
            if ins[k]["t"] - ins[k - 1]["t"] > GAP_MIN * 60_000 and cal.trading_date(ins[k]["t"]) == cal.trading_date(ins[k - 1]["t"])]
    diag["gaps"] = [{"after": datetime.fromtimestamp(t / 1000, timezone.utc).isoformat(), "minutes": m} for t, m in gaps]
    diag["ask_coverage"] = (sum(1 for b in bars if b["ao"] is not None) / len(bars)) if bars else None
    moves = [abs(bars[k]["bc"] - bars[k - 1]["bc"]) for k in range(1, len(bars))]
    med = statistics.median(moves) if moves else 0.0
    diag["spikes"] = [{"t": datetime.fromtimestamp(bars[k]["t"] / 1000, timezone.utc).isoformat(), "move": moves[k - 1], "median": med}
                      for k in range(1, len(bars)) if med > 0 and moves[k - 1] > SPIKE_K * med]
    return {"day": day, "errors": errors, "diagnostics": diag}


def run(root: Path) -> dict:
    entries = {}
    for e in read_manifest(root):
        if e.get("kind") == "history_day" and e.get("source") == "m1" and e.get("bars", 0) > 0:
            entries[e["day"]] = e                                      # the latest entry of a day wins
    days, hard = [], 0
    for day in sorted(entries):
        e = entries[day]
        p = root / e["m1_file"]
        if not p.exists():
            days.append({"day": day, "errors": [("G1", None, "file missing")], "diagnostics": {}}); hard += 1; continue
        if sha256(p.read_bytes()) != e["m1_sha256"]:
            days.append({"day": day, "errors": [("G1", None, "sha256 differs from the manifest")], "diagnostics": {}}); hard += 1; continue
        r = check_day(day, read_day_file(p))
        hard += bool(r["errors"])
        days.append(r)
    have = set(entries)
    missing = []
    if have:
        d, last = date.fromisoformat(min(have)), date.fromisoformat(max(have))
        while d <= last:
            if d.weekday() < 5 and d.isoformat() not in have:
                missing.append(d.isoformat())
            d += timedelta(days=1)
    return {
        "verdict": "PASS" if hard == 0 else "FAIL",
        "days": len(days), "days_with_errors": hard,
        "first_day": min(have) if have else None, "last_day": max(have) if have else None,
        "missing_weekdays": missing,
        "bars": sum(d["diagnostics"].get("bars", 0) for d in days),
        "out_of_session_bars": sum(d["diagnostics"].get("out_of_session", 0) for d in days),
        "gap_count": sum(len(d["diagnostics"].get("gaps", [])) for d in days),
        "spike_count": sum(len(d["diagnostics"].get("spikes", [])) for d in days),
        "min_ask_coverage": min((d["diagnostics"].get("ask_coverage") for d in days if d["diagnostics"].get("ask_coverage") is not None), default=None),
        "per_day": days,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", required=True)
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    rep = run(Path(a.root))
    text = json.dumps(rep, indent=1, default=str)
    if a.out:
        Path(a.out).write_text(text)
    summary = {k: v for k, v in rep.items() if k != "per_day"}
    print(json.dumps(summary, indent=1, default=str))
    return 0 if rep["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
