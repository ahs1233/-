"""Stored official M1 days → BID feeds per timeframe for the JS pipeline (TRADE_CONTRACT §2.2).

Aggregation uses the frozen session calendar (bars.aggregate / tv_calendar). Prices only: no
event, outcome or edge is computed here.

    python export_feeds.py --root <data root> --out feeds.json [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Output: {"meta": {...}, "feeds": {"M5": [[t, o, h, l, c, v], ...], "M15": ..., "W": ...}}
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from bars import aggregate
from integrity import read_day_file
from store import read_manifest

TFS = ("M5", "M15", "H1", "H4", "D", "W")


def load_m1(root: Path, start: str | None = None, end: str | None = None) -> list[dict]:
    entries = {}
    for e in read_manifest(root):
        if e.get("kind") == "history_day" and e.get("source") == "m1" and e.get("bars", 0) > 0:
            entries[e["day"]] = e
    bars = []
    for day in sorted(entries):
        if (start and day < start) or (end and day > end):
            continue
        for b in read_day_file(root / entries[day]["m1_file"]):
            bars.append({"t": b["t"], "bo": b["bo"], "bh": b["bh"], "bl": b["bl"], "bc": b["bc"],
                         "ao": b["ao"], "ah": b["ah"], "al": b["al"], "ac": b["ac"], "v": b["v"], "n": 0, "src": "m1"})
    return bars


def build_feeds(m1: list[dict]) -> tuple[dict, dict]:
    stats: dict = {}
    feeds = {tf: [[b["t"], b["bo"], b["bh"], b["bl"], b["bc"], b["v"]] for b in aggregate(m1, tf, stats if tf == "M5" else None)] for tf in TFS}
    return feeds, stats


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--from", dest="start")
    ap.add_argument("--to", dest="end")
    a = ap.parse_args(argv)
    m1 = load_m1(Path(a.root), a.start, a.end)
    feeds, stats = build_feeds(m1)
    body = json.dumps(feeds, separators=(",", ":"))
    meta = {"m1_bars": len(m1), "out_of_session_dropped": stats.get("out_of_session", 0),
            "counts": {tf: len(v) for tf, v in feeds.items()}, "feeds_sha256": hashlib.sha256(body.encode()).hexdigest(),
            "first": feeds["M5"][0][0] if feeds["M5"] else None, "last": feeds["M5"][-1][0] if feeds["M5"] else None}
    Path(a.out).write_text(json.dumps({"meta": meta, "feeds": feeds}, separators=(",", ":")))
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
