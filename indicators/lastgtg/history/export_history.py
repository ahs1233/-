"""Canonical M1 store -> per-timeframe CSV feeds for the lastgtg historical test, one day at a time.

Same bars as gtg-strategy-lab/data/bars.py aggregate (in-session minutes only, frozen
TradingView calendar), computed in a stream so the whole history never sits in memory
(test_export_history.py checks the equality). Prices only: no lamp, signal or outcome here.

    python export_history.py --root C:/Users/alk/gtg-lab-data-jforex --out <dir>
        [--from 2019-06-01] [--m1-from 2024-11-01] [--to 2026-09-30]
Writes <out>/XAUUSD_{M1,M5,M15,H1,H4,D,W}.csv (t,o,h,l,c,v BID; M1 also ah,al,ac) and meta.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "gtg-strategy-lab" / "data"))
import tv_calendar  # noqa: E402
from integrity import read_day_file  # noqa: E402
from store import read_manifest  # noqa: E402

TFS = ("M5", "M15", "H1", "H4", "D", "W")


class StreamAgg:
    """bars.aggregate for one timeframe, fed in time order (BID side only)."""

    def __init__(self, tf: str, emit):
        self.tf, self.emit, self.cur = tf, emit, None

    def push(self, b: dict) -> None:
        k = tv_calendar.bucket(b["t"], self.tf)
        cur = self.cur
        if cur is None or cur[0] != k:
            if cur is not None:
                if k < cur[0]:
                    raise ValueError("M1 bars are not time-ordered")
                self.emit(cur)
            self.cur = [k, b["bo"], b["bh"], b["bl"], b["bc"], b["v"]]
            return
        cur[2] = max(cur[2], b["bh"]); cur[3] = min(cur[3], b["bl"]); cur[4] = b["bc"]; cur[5] += b["v"]

    def close(self) -> None:
        if self.cur is not None:
            self.emit(self.cur)
            self.cur = None


def stream(days, tfs=TFS, m1_from_ms: int | None = None, sinks=None):
    """days: iterable of per-day M1 bar lists in time order. sinks[tf](row) receives each bar."""
    aggs = {tf: StreamAgg(tf, sinks[tf]) for tf in tfs}
    counts = {"in_session": 0, "out_of_session": 0, "M1": 0}
    for bars in days:
        for b in bars:
            if not tv_calendar.in_session(b["t"]):
                counts["out_of_session"] += 1
                continue
            counts["in_session"] += 1
            for a in aggs.values():
                a.push(b)
            if m1_from_ms is not None and b["t"] >= m1_from_ms:
                counts["M1"] += 1
                sinks["M1"]([b["t"], b["bo"], b["bh"], b["bl"], b["bc"], b["v"], b["ah"], b["al"], b["ac"]])
    for a in aggs.values():
        a.close()
    return counts


def _fmt(x) -> str:
    return "" if x is None else repr(x) if isinstance(x, float) else str(x)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--from", dest="start", default="2019-06-01")
    ap.add_argument("--m1-from", dest="m1_from", default="2024-11-01")
    ap.add_argument("--to", dest="end", default="2026-09-30")
    a = ap.parse_args(argv)
    root, out = Path(a.root), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    entries = {}
    for e in read_manifest(root):
        if e.get("kind") == "history_day" and e.get("source") == "m1" and e.get("bars", 0) > 0:
            entries[e["day"]] = e
    days = [d for d in sorted(entries) if a.start <= d <= a.end]
    files = {tf: open(out / f"XAUUSD_{tf}.csv", "w", newline="\n") for tf in ("M1",) + TFS}
    files["M1"].write("t,o,h,l,c,v,ah,al,ac\n")
    for tf in TFS:
        files[tf].write("t,o,h,l,c,v\n")
    sinks = {tf: (lambda f: lambda r: f.write(",".join(_fmt(x) for x in r) + "\n"))(f) for tf, f in files.items()}
    m1_from_ms = int(datetime.fromisoformat(a.m1_from).replace(tzinfo=timezone.utc).timestamp() * 1000)
    counts = stream((read_day_file(root / entries[d]["m1_file"]) for d in days), TFS, m1_from_ms, sinks)
    for f in files.values():
        f.close()
    meta = {"root": str(root), "days": len(days), "first_day": days[0] if days else None, "last_day": days[-1] if days else None,
            "m1_from": a.m1_from, "counts": counts,
            "sha256": {tf: hashlib.sha256((out / f"XAUUSD_{tf}.csv").read_bytes()).hexdigest() for tf in files}}
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
