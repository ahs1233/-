"""Dukascopy XAUUSD raw feed: URLs, download, bi5 decoding (TRADE_CONTRACT §2).

Standard library only. The .bi5 files are LZMA ("alone" format):
  ticks   HHh_ticks.bi5          records '>IIIff'  = ms-in-hour, ask, bid, askVol, bidVol
  candles {BID|ASK}_candles_min_1.bi5  records '>IIIIIf' = sec-in-day, open, close, low, high, volume
Prices are integers in points; XAUUSD has 3 decimals (POINT_DIVISOR = 1000).
Months in URLs are zero-based (January = 00).
"""
from __future__ import annotations

import lzma
import struct
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE_URL = "https://datafeed.dukascopy.com/datafeed"
INSTRUMENT = "XAUUSD"
POINT_DIVISOR = 1000.0
# Sanity range for a decoded XAUUSD price. A price outside it means a wrong divisor
# or a corrupt file; the decoder refuses it instead of storing a silent scale error.
PRICE_SANITY = (100.0, 20000.0)

TICK_REC = struct.Struct(">IIIff")
CANDLE_REC = struct.Struct(">IIIIIf")


class FeedError(Exception):
    """Raw file is present but cannot be trusted (corrupt, wrong size, insane price)."""


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        raise ValueError("naive datetime: every timestamp in the lab is UTC-aware")
    return dt.astimezone(timezone.utc)


def tick_url(hour: datetime, instrument: str = INSTRUMENT) -> str:
    h = _utc(hour)
    return f"{BASE_URL}/{instrument}/{h.year:04d}/{h.month - 1:02d}/{h.day:02d}/{h.hour:02d}h_ticks.bi5"


def candle_url(day: datetime, side: str, instrument: str = INSTRUMENT) -> str:
    if side not in ("BID", "ASK"):
        raise ValueError(f"side must be BID or ASK, got {side!r}")
    d = _utc(day)
    return f"{BASE_URL}/{instrument}/{d.year:04d}/{d.month - 1:02d}/{d.day:02d}/{side}_candles_min_1.bi5"


def _decompress(raw: bytes, rec: struct.Struct) -> bytes:
    if not raw:
        return b""
    try:
        data = lzma.decompress(raw)
    except lzma.LZMAError as e:
        raise FeedError(f"LZMA decode failed: {e}") from e
    if len(data) % rec.size:
        raise FeedError(f"payload {len(data)} bytes is not a multiple of record size {rec.size}")
    return data


def _price(v: int) -> float:
    p = v / POINT_DIVISOR
    if not (PRICE_SANITY[0] <= p <= PRICE_SANITY[1]):
        raise FeedError(f"decoded price {p} outside sanity range {PRICE_SANITY}")
    return p


def decode_ticks(raw: bytes, hour_start_ms: int) -> list[tuple[int, float, float, float, float]]:
    """-> [(t_ms, ask, bid, askVol, bidVol)] in file order (Dukascopy writes them in time order)."""
    data = _decompress(raw, TICK_REC)
    out = []
    prev = -1
    for ms, ask, bid, av, bv in TICK_REC.iter_unpack(data):
        if ms < prev or ms >= 3_600_000:
            raise FeedError(f"tick offset {ms} out of order or outside the hour")
        prev = ms
        out.append((hour_start_ms + ms, _price(ask), _price(bid), float(av), float(bv)))
    return out


def decode_candles(raw: bytes, day_start_s: int) -> list[tuple[int, float, float, float, float, float]]:
    """-> [(t_ms, o, h, l, c, volume)] (file order is time, open, close, low, high, volume)."""
    data = _decompress(raw, CANDLE_REC)
    out = []
    for sec, o, c, lo, hi, vol in CANDLE_REC.iter_unpack(data):
        if sec >= 86_400 or sec % 60:
            raise FeedError(f"candle offset {sec}s is not a minute inside the day")
        out.append(((day_start_s + sec) * 1000, _price(o), _price(hi), _price(lo), _price(c), float(vol)))
    return out


USER_AGENT = "gtg-strategy-lab/0.2 (research; +https://github.com/ahs1233)"
MIN_INTERVAL_S = 0.35     # polite pacing between requests (FAILURE_LOG F-002)
_last_request = [0.0]


class RateLimited(ConnectionError):
    """Dukascopy kept answering 429 after the bounded backoff."""


def _pace(sleep=time.sleep, clock=time.monotonic):
    wait = _last_request[0] + MIN_INTERVAL_S - clock()
    if wait > 0:
        sleep(wait)
    _last_request[0] = clock()


def fetch(url: str, retries: int = 3, timeout: float = 30.0, rate_retries: int = 6,
          opener=urllib.request.urlopen, sleep=time.sleep) -> bytes | None:
    """Raw bytes, or None when Dukascopy has no file (HTTP 404).

    Requests carry an explicit User-Agent and are paced (MIN_INTERVAL_S). HTTP 429 is a
    rate limit, not a data answer: it waits Retry-After (or 5·2^k s, capped at 120 s) and
    retries at most `rate_retries` times, then raises RateLimited. Network errors are
    retried `retries` times. Any other HTTP status is raised at once (Anti-Loop §30).
    """
    last: Exception | None = None
    net_fail = rate_fail = 0
    while True:
        _pace(sleep)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with opener(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 503):  # 503 is Dukascopy's throttling answer too (F-003)
                rate_fail += 1
                if rate_fail > rate_retries:
                    raise RateLimited(f"{url}: HTTP {e.code} after {rate_retries} backoffs") from e
                ra = e.headers.get("Retry-After") if e.headers else None
                delay = float(ra) if ra and ra.isdigit() else min(120.0, 5.0 * 2 ** (rate_fail - 1))
                sleep(delay)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = e
            net_fail += 1
            if net_fail >= retries:
                raise ConnectionError(f"{url}: {last}")
            sleep(2 ** net_fail)
