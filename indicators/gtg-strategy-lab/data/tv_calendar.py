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

import json
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
SESSION_OPEN = time(17, 0)
SESSION_CLOSE = time(17, 0)
# trading date -> (open on the previous calendar day, close on the day), New York time
CORRECTIONS: dict[date, tuple[time, time]] = {
    date(2024, 11, 28): (time(17, 0), time(14, 30)),
    date(2024, 11, 29): (time(18, 0), time(14, 45)),
}
# Forward session corrections (message 22 §4): feed metadata, not a contract change. Each new
# correction seen in TradingView/OANDA symbolInfo after the freeze is appended to
# calendar_corrections_forward.jsonl BEFORE bars of that trading day are built:
#   {"trading_date": "YYYY-MM-DD", "open": "HHMM", "close": "HHMM", "observed_at": ISO-UTC,
#    "source": "TradingView symbolInfo OANDA:XAUUSD", "symbolinfo_sha256": "..."}
# Rules checked by load_forward_corrections(): the date is after T_freeze_v0.2.2 and not in the
# frozen historical table; observed_at precedes the (default) open of that trading day; the
# entry never depends on a GTG result; the file is append-only (audit log).
FORWARD_FILE = Path(__file__).resolve().parent / "calendar_corrections_forward.jsonl"
FROZEN_UNTIL = date(2026, 9, 29)  # trading dates ≤ this use only the frozen table above


def load_forward_corrections(path: Path = FORWARD_FILE) -> dict[date, tuple[time, time]]:
    out: dict[date, tuple[time, time]] = {}
    if not path.exists():
        return out
    for n, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        e = json.loads(line)
        for k in ("trading_date", "open", "close", "observed_at", "source", "symbolinfo_sha256"):
            if not e.get(k):
                raise ValueError(f"{path.name}:{n}: missing {k}")
        d = date.fromisoformat(e["trading_date"])
        if d <= FROZEN_UNTIL or d in CORRECTIONS:
            raise ValueError(f"{path.name}:{n}: {d} is covered by the frozen table")
        if d in out:
            raise ValueError(f"{path.name}:{n}: duplicate {d}")
        observed = datetime.fromisoformat(e["observed_at"].replace("Z", "+00:00"))
        if observed.timestamp() * 1000 >= _ms(d - timedelta(days=1), SESSION_OPEN):
            raise ValueError(f"{path.name}:{n}: {d} registered after its session opened")
        out[d] = (time(int(e["open"][:2]), int(e["open"][2:])), time(int(e["close"][:2]), int(e["close"][2:])))
    return out


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


_ALL = None


def _corrections() -> dict[date, tuple[time, time]]:
    global _ALL
    if _ALL is None:
        _ALL = {**CORRECTIONS, **load_forward_corrections()}
    return _ALL


def session_open(d: date) -> int:
    return _ms(d - timedelta(days=1), _corrections().get(d, (SESSION_OPEN, SESSION_CLOSE))[0])


def session_close(d: date) -> int:
    return _ms(d, _corrections().get(d, (SESSION_OPEN, SESSION_CLOSE))[1])


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
