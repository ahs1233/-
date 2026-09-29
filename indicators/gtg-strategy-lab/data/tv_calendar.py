"""Research calendar (TRADE_CONTRACT v0.2.2 §2.2): the temporal semantics of the chart GTG
actually runs on — OANDA:XAUUSD on TradingView — applied to the Dukascopy M1 prices.

Taken literally from the symbol's session definition (symbolInfo, captured 2026-09-29,
parity/captures/2026-09-29-mtf/symbolinfo.json):
    session "1700-1700", timezone "America/New_York", trading days Mon–Fri,
    session-correction "1700-1430:20241128;1800-1445:20241129"
and checked against TradingView's own H4 / D / W bars (data/test_calendar.py).

    trading day d   runs from its open on the previous calendar day (17:00 New York, DST
                    included) to its close on day d (17:00), unless corrected.
    D bucket        = the open of the trading day.
    H4 bucket       = open + 4h·k (17/21/01/05/09/13 New York on a normal day; the grid
                      follows a corrected open, e.g. 18:00 on 2024-11-29).
    W bucket        = Sunday 17:00 New York (the open of the week's Monday session).
    M1..H1          = clock boundaries (New York offsets are whole hours, so these equal UTC).
A minute outside every session (weekend, a corrected early close or late open) belongs to
no bar: it is dropped before aggregation and counted.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
SESSION_OPEN = time(17, 0)
SESSION_CLOSE = time(17, 0)
# trading date -> (open on the previous calendar day, close on the day), New York time
CORRECTIONS: dict[date, tuple[time, time]] = {
    date(2024, 11, 28): (time(17, 0), time(14, 30)),
    date(2024, 11, 29): (time(18, 0), time(14, 45)),
}
H4_MS = 4 * 3_600_000
CLOCK_MS = {"M1": 60_000, "M5": 300_000, "M15": 900_000, "H1": 3_600_000}


def _local(t_ms: int) -> datetime:
    return datetime.fromtimestamp(t_ms / 1000, timezone.utc).astimezone(NY)


def _ms(d: date, tm: time) -> int:
    return int(datetime.combine(d, tm, tzinfo=NY).timestamp() * 1000)


def trading_date(t_ms: int) -> date:
    """The trading day an instant belongs to by the default 17:00 roll (corrections aside)."""
    loc = _local(t_ms)
    return loc.date() + timedelta(days=1) if loc.time() >= SESSION_OPEN else loc.date()


def session_open(d: date) -> int:
    return _ms(d - timedelta(days=1), CORRECTIONS.get(d, (SESSION_OPEN, SESSION_CLOSE))[0])


def session_close(d: date) -> int:
    return _ms(d, CORRECTIONS.get(d, (SESSION_OPEN, SESSION_CLOSE))[1])


def in_session(t_ms: int) -> bool:
    d = trading_date(t_ms)
    return d.weekday() < 5 and session_open(d) <= t_ms < session_close(d)


def bucket(t_ms: int, tf: str) -> int:
    """Open time (ms, UTC) of the `tf` bar that holds the in-session instant t_ms."""
    if tf in CLOCK_MS:
        return t_ms - t_ms % CLOCK_MS[tf]
    d = trading_date(t_ms)
    if tf == "D":
        return session_open(d)
    if tf == "H4":
        o = session_open(d)
        return o + (t_ms - o) // H4_MS * H4_MS
    if tf == "W":
        monday = d - timedelta(days=d.weekday())
        return _ms(monday - timedelta(days=1), SESSION_OPEN)
    raise ValueError(f"unsupported timeframe {tf!r}")
