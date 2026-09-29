"""Research calendar v0.2.2 (tv_calendar): rules, DST, the session correction, and the
check against TradingView's own OANDA:XAUUSD bars (parity/captures/2026-09-29-mtf)."""
import gzip
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

import tv_calendar as cal
from bars import aggregate

UTC = timezone.utc
CAP = Path(__file__).resolve().parent.parent / "parity" / "captures" / "2026-09-29-mtf"
VOLUME_SETTLED_MS = 8 * 86_400_000
ms = lambda *a: int(datetime(*a, tzinfo=UTC).timestamp() * 1000)


def tv_bars(res):
    """TradingView bars → lab bars (BID fields; TradingView has no ASK)."""
    raw = json.loads(gzip.open(CAP / f"bars_{res}.json.gz").read())["bars"]
    return [{"t": t * 1000, "bo": o, "bh": h, "bl": lo, "bc": c, "ao": None, "ah": None, "al": None, "ac": None,
             "v": v, "n": 0, "src": "tv"} for t, o, h, lo, c, v in raw]


class Rules(unittest.TestCase):
    def test_summer_winter_h4_grid_and_day(self):
        # EDT (UTC-4): session opens 21:00 UTC; grid 21/01/05/09/13/17 UTC
        t = ms(2026, 7, 15, 14, 30)                      # 10:30 New York
        self.assertEqual(cal.bucket(t, "H4"), ms(2026, 7, 15, 13))   # 09:00 NY
        self.assertEqual(cal.bucket(t, "D"), ms(2026, 7, 14, 21))    # 17:00 NY the day before
        # EST (UTC-5): opens 22:00 UTC; grid 22/02/06/10/14/18 UTC
        t = ms(2026, 1, 15, 14, 30)                      # 09:30 New York
        self.assertEqual(cal.bucket(t, "H4"), ms(2026, 1, 15, 14))   # 09:00 NY
        self.assertEqual(cal.bucket(t, "D"), ms(2026, 1, 14, 22))

    def test_dst_switch_weeks(self):
        # 2026-03-08 (spring forward): Friday before in EST, Sunday open in EDT
        self.assertEqual(cal.bucket(ms(2026, 3, 6, 20, 0), "H4"), ms(2026, 3, 6, 18))     # 13:00 EST
        self.assertEqual(cal.bucket(ms(2026, 3, 8, 22, 30), "H4"), ms(2026, 3, 8, 21))    # 17:00 EDT
        self.assertEqual(cal.bucket(ms(2026, 3, 8, 22, 30), "W"), ms(2026, 3, 8, 21))
        self.assertEqual(cal.bucket(ms(2026, 3, 6, 20, 0), "W"), ms(2026, 3, 1, 22))      # previous Sunday, EST
        # 2026-11-01 (fall back)
        self.assertEqual(cal.bucket(ms(2026, 11, 1, 23, 30), "D"), ms(2026, 11, 1, 22))   # 17:00 EST
        self.assertEqual(cal.bucket(ms(2026, 10, 30, 20, 0), "D"), ms(2026, 10, 29, 21))  # 17:00 EDT

    def test_clock_timeframes_unchanged(self):
        t = ms(2026, 7, 15, 14, 37, 0)
        self.assertEqual(cal.bucket(t, "M5"), ms(2026, 7, 15, 14, 35))
        self.assertEqual(cal.bucket(t, "M15"), ms(2026, 7, 15, 14, 30))
        self.assertEqual(cal.bucket(t, "H1"), ms(2026, 7, 15, 14))

    def test_session_correction_thanksgiving_2024(self):
        self.assertTrue(cal.in_session(ms(2024, 11, 28, 19, 0)))    # 14:00 EST, before the 14:30 close
        self.assertFalse(cal.in_session(ms(2024, 11, 28, 19, 45)))  # 14:45 EST, after the early close
        self.assertFalse(cal.in_session(ms(2024, 11, 28, 22, 30)))  # 17:30 EST, before the 18:00 open
        self.assertTrue(cal.in_session(ms(2024, 11, 28, 23, 30)))   # 18:30 EST
        self.assertEqual(cal.bucket(ms(2024, 11, 29, 4, 0), "H4"), ms(2024, 11, 29, 3))   # grid 18/22/02 EST
        self.assertEqual(cal.bucket(ms(2024, 11, 29, 4, 0), "D"), ms(2024, 11, 28, 23))

    def test_weekend_is_out_of_session(self):
        self.assertFalse(cal.in_session(ms(2026, 9, 26, 12)))       # Saturday
        self.assertFalse(cal.in_session(ms(2026, 9, 25, 21, 30)))   # Friday 17:30 EDT
        self.assertTrue(cal.in_session(ms(2026, 9, 27, 22, 0)))     # Sunday 18:00 EDT
        stats = {}
        agg = aggregate([{"t": ms(2026, 9, 26, 12), "bo": 1, "bh": 1, "bl": 1, "bc": 1, "ao": None, "ah": None, "al": None,
                          "ac": None, "v": 1.0, "n": 0, "src": "m1"}], "H1", stats)
        self.assertEqual((agg, stats["out_of_session"]), ([], 1))


class SymbolInfo(unittest.TestCase):
    def test_constants_are_the_captured_session_definition(self):
        si = json.loads((CAP / "symbolinfo.json").read_text())
        self.assertEqual((si["full_name"], si["session"], si["timezone"]), ("OANDA:XAUUSD", "1700-1700", "America/New_York"))
        self.assertEqual(str(cal.NY), si["timezone"])
        self.assertEqual(cal.SESSION_OPEN.strftime("%H%M") + "-" + cal.SESSION_CLOSE.strftime("%H%M"), si["session"])
        parsed = {}
        for item in si["corrections"].split(";"):
            span, day = item.split(":")
            o, c = span.split("-")
            parsed[datetime.strptime(day, "%Y%m%d").date()] = (o, c)
        self.assertEqual({d: (o.strftime("%H%M"), c.strftime("%H%M")) for d, (o, c) in cal.CORRECTIONS.items()}, parsed)


class AgainstTradingView(unittest.TestCase):
    """The calendar reproduces TradingView's own H4 / D / W bars of OANDA:XAUUSD."""

    def test_bar_opens_are_calendar_buckets(self):
        for res, tf, since in (("240", "H4", 0), ("1D", "D", 0), ("1W", "W", ms(2006, 1, 1))):
            bars = [b for b in tv_bars(res) if b["t"] >= since]
            bad = [b["t"] for b in bars if cal.bucket(b["t"], tf) != b["t"]]
            self.assertEqual(bad, [], f"{tf}: {len(bad)} of {len(bars)} opens off the calendar")
            self.assertGreater(len(bars), 1000)

    def assert_rebuilt(self, lower, upper, tf):
        src, ref = tv_bars(lower), tv_bars(upper)
        first = cal.bucket(src[0]["t"], tf)
        rebuilt = {b["t"]: b for b in aggregate(src, tf)}
        compared = 0
        for r in ref[:-1]:                              # the last one is still forming
            if r["t"] <= first or r["t"] not in rebuilt:  # the first bucket may be partial
                continue
            a = rebuilt[r["t"]]
            self.assertEqual((a["bo"], a["bh"], a["bl"], a["bc"]), (r["bo"], r["bh"], r["bl"], r["bc"]), f"{tf} {r['t']}")
            # Volume of the latest week is excluded: the timeframes were dumped minutes apart and
            # TradingView still revised the last completed D/W volume (OHLC is compared on all).
            if r["t"] < ref[-1]["t"] - VOLUME_SETTLED_MS:
                self.assertEqual(a["v"], r["v"], f"{tf} volume {r['t']}")
            compared += 1
        self.assertGreater(compared, 50)
        return compared

    def test_h1_rebuilds_h4_d_w(self):
        for tf, res in (("H4", "240"), ("D", "1D"), ("W", "1W")):
            self.assert_rebuilt("60", res, tf)

    def test_h4_rebuilds_d_w_across_three_years(self):
        for tf, res in (("D", "1D"), ("W", "1W")):
            self.assert_rebuilt("240", res, tf)


if __name__ == "__main__":
    unittest.main()
