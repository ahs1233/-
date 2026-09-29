"""M1 construction, sanitation and calendar aggregation (TRADE_CONTRACT §2.2).

A bar is a dict:
  t (ms, bar open, UTC) · bo bh bl bc (BID) · ao ah al ac (ASK, None when absent)
  · v (BID-side volume) · n (tick count, 0 when built from candles) · src ('tick' | 'm1')
BID is the signal/volume series; ASK is kept for execution only.
"""
from __future__ import annotations

MIN_MS = 60_000
TF_SEC = {"M1": 60, "M5": 300, "M15": 900, "H1": 3600, "H4": 14_400, "D": 86_400}
FIELDS = ("t", "bo", "bh", "bl", "bc", "ao", "ah", "al", "ac", "v", "n", "src")


def ticks_to_m1(ticks) -> list[dict]:
    """Ticks (t_ms, ask, bid, askVol, bidVol), time-ordered -> M1 bars per side.

    A minute without ticks produces no bar (no forward fill).
    """
    bars: list[dict] = []
    cur = None
    for t, ask, bid, _av, bv in ticks:
        m = t - t % MIN_MS
        if cur is None or cur["t"] != m:
            if cur is not None and m < cur["t"]:
                raise ValueError("ticks are not time-ordered")
            cur = {"t": m, "bo": bid, "bh": bid, "bl": bid, "bc": bid,
                   "ao": ask, "ah": ask, "al": ask, "ac": ask, "v": 0.0, "n": 0, "src": "tick"}
            bars.append(cur)
        cur["bh"] = max(cur["bh"], bid); cur["bl"] = min(cur["bl"], bid); cur["bc"] = bid
        cur["ah"] = max(cur["ah"], ask); cur["al"] = min(cur["al"], ask); cur["ac"] = ask
        cur["v"] += bv
        cur["n"] += 1
    return bars


def is_dead_candle(o: float, h: float, lo: float, c: float, v: float) -> bool:
    """The only candle excluded by sanitation: no volume AND O = H = L = C."""
    return v == 0 and o == h == lo == c


def candles_to_m1(bid, ask) -> list[dict]:
    """Dukascopy M1 candles per side -> merged M1 bars (fallback when ticks are unavailable).

    Dead BID candles are dropped (the timestamp simply has no bar). ASK is joined by time;
    a BID bar without a matching live ASK candle keeps ASK = None (C1_unavailable, §8).
    """
    ask_by_t = {t: (o, h, lo, c) for t, o, h, lo, c, v in (ask or []) if not is_dead_candle(o, h, lo, c, v)}
    out = []
    for t, o, h, lo, c, v in bid:
        if is_dead_candle(o, h, lo, c, v):
            continue
        a = ask_by_t.get(t)
        out.append({"t": t, "bo": o, "bh": h, "bl": lo, "bc": c,
                    "ao": a[0] if a else None, "ah": a[1] if a else None,
                    "al": a[2] if a else None, "ac": a[3] if a else None,
                    "v": v, "n": 0, "src": "m1"})
    return out


def bucket(t_ms: int, tf: str) -> int:
    sec = TF_SEC[tf]
    return t_ms - t_ms % (sec * 1000)


def aggregate(m1: list[dict], tf: str) -> list[dict]:
    """Calendar aggregation on UTC boundaries (never "every k remaining bars").

    H4 buckets start at 00/04/08/12/16/20 UTC (epoch 1970-01-01T00:00Z is a boundary),
    D = UTC calendar day. ASK of the aggregate is None if any member lacks ASK.
    """
    if tf == "M1":
        return [dict(b) for b in m1]
    out: list[dict] = []
    cur = None
    for b in m1:
        k = bucket(b["t"], tf)
        if cur is None or cur["t"] != k:
            if cur is not None and k < cur["t"]:
                raise ValueError("M1 bars are not time-ordered")
            cur = dict(b)
            cur["t"] = k
            out.append(cur)
            continue
        cur["bh"] = max(cur["bh"], b["bh"]); cur["bl"] = min(cur["bl"], b["bl"]); cur["bc"] = b["bc"]
        if cur["ao"] is None or b["ao"] is None:
            cur["ao"] = cur["ah"] = cur["al"] = cur["ac"] = None
        else:
            cur["ah"] = max(cur["ah"], b["ah"]); cur["al"] = min(cur["al"], b["al"]); cur["ac"] = b["ac"]
        cur["v"] += b["v"]
        cur["n"] += b["n"]
        if cur["src"] != b["src"]:
            cur["src"] = "mixed"
    return out
