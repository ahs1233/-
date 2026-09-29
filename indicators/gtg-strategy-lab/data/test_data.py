"""Data-layer tests on synthetic bi5 files (no network).  Run: python3 -m unittest -v test_data"""
from __future__ import annotations

import lzma
import struct
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import build_history
import capture_forward
import dukascopy as dk
from bars import aggregate, bucket, candles_to_m1, is_dead_candle, ticks_to_m1
from lab_config import T_FREEZE, T_FREEZE_MS
from store import read_day, read_manifest, sha256, write_day

UTC = timezone.utc


def bi5(records, fmt):
    return lzma.compress(b"".join(struct.pack(fmt, *r) for r in records), format=lzma.FORMAT_ALONE)


def tick_file(rows):  # rows: (ms, ask, bid, av, bv) with prices as floats
    return bi5([(ms, round(a * 1000), round(b * 1000), av, bv) for ms, a, b, av, bv in rows], ">IIIff")


def candle_file(rows):  # rows: (sec, o, c, l, h, v)
    return bi5([(s, round(o * 1000), round(c * 1000), round(lo * 1000), round(h * 1000), v) for s, o, c, lo, h, v in rows], ">IIIIIf")


class Urls(unittest.TestCase):
    def test_month_is_zero_based(self):
        self.assertEqual(dk.tick_url(datetime(2026, 1, 5, 7, tzinfo=UTC)),
                         "https://datafeed.dukascopy.com/datafeed/XAUUSD/2026/00/05/07h_ticks.bi5")
        self.assertEqual(dk.candle_url(datetime(2025, 12, 31, tzinfo=UTC), "ASK"),
                         "https://datafeed.dukascopy.com/datafeed/XAUUSD/2025/11/31/ASK_candles_min_1.bi5")

    def test_naive_datetime_refused(self):
        with self.assertRaises(ValueError):
            dk.tick_url(datetime(2026, 1, 5, 7))


class Decode(unittest.TestCase):
    def test_tick_roundtrip_and_scale(self):
        raw = tick_file([(0, 2650.125, 2649.875, 1.5, 2.5), (59_999, 2651.0, 2650.5, 0.1, 0.2)])
        t = dk.decode_ticks(raw, 1_000_000_000_000)
        self.assertEqual(t[0], (1_000_000_000_000, 2650.125, 2649.875, 1.5, 2.5))
        self.assertEqual(t[1][0], 1_000_000_059_999)

    def test_empty_file_is_no_ticks(self):
        self.assertEqual(dk.decode_ticks(b"", 0), [])

    def test_insane_price_refused(self):  # wrong divisor would give 2.65 or 2650000
        raw = bi5([(0, 2650, 2649, 1.0, 1.0)], ">IIIff")
        with self.assertRaises(dk.FeedError):
            dk.decode_ticks(raw, 0)

    def test_truncated_payload_refused(self):
        raw = lzma.compress(b"\x00" * 21, format=lzma.FORMAT_ALONE)
        with self.assertRaises(dk.FeedError):
            dk.decode_ticks(raw, 0)

    def test_out_of_order_ticks_refused(self):
        with self.assertRaises(dk.FeedError):
            dk.decode_ticks(tick_file([(500, 2650, 2649, 1, 1), (100, 2650, 2649, 1, 1)]), 0)

    def test_candle_field_order_o_c_l_h(self):
        raw = candle_file([(60, 2650.0, 2652.0, 2649.0, 2653.0, 12.5)])
        (t, o, h, lo, c, v), = dk.decode_candles(raw, 86_400)
        self.assertEqual((t, o, h, lo, c, v), (86_460_000, 2650.0, 2653.0, 2649.0, 2652.0, 12.5))


class M1(unittest.TestCase):
    def test_ticks_to_m1_per_side(self):
        ticks = [(0, 10.3, 10.1, 1, 2), (30_000, 10.6, 10.4, 1, 3), (59_000, 10.2, 10.0, 1, 1), (120_000, 11.2, 11.0, 1, 5)]
        b = ticks_to_m1(ticks)
        self.assertEqual(len(b), 2)  # minute 1 has no ticks -> no bar (no forward fill)
        self.assertEqual((b[0]["bo"], b[0]["bh"], b[0]["bl"], b[0]["bc"], b[0]["v"], b[0]["n"]), (10.1, 10.4, 10.0, 10.0, 6, 3))
        self.assertEqual((b[0]["ao"], b[0]["ah"], b[0]["al"], b[0]["ac"]), (10.3, 10.6, 10.2, 10.2))
        self.assertEqual(b[1]["t"], 120_000)

    def test_dead_candle_rule_is_exact(self):
        self.assertTrue(is_dead_candle(5, 5, 5, 5, 0))
        self.assertFalse(is_dead_candle(5, 5, 5, 5, 0.1))   # flat bar with activity stays
        self.assertFalse(is_dead_candle(5, 6, 5, 5, 0))     # zero volume but a range stays

    def test_candles_fallback_drops_only_dead_bid_and_keeps_timestamps(self):
        bid = [(0, 1, 2, 0.5, 1.5, 3), (60_000, 1.5, 1.5, 1.5, 1.5, 0), (120_000, 1.5, 1.5, 1.5, 1.5, 2)]
        ask = [(0, 1.1, 2.1, 0.6, 1.6, 3)]
        m = candles_to_m1(bid, ask)
        self.assertEqual([b["t"] for b in m], [0, 120_000])
        self.assertEqual(m[0]["ao"], 1.1)
        self.assertIsNone(m[1]["ao"])  # no ASK -> C1_unavailable downstream


class Aggregation(unittest.TestCase):
    def test_h4_boundaries_are_utc_calendar(self):
        t = int(datetime(2026, 3, 2, 5, 17, tzinfo=UTC).timestamp() * 1000)
        self.assertEqual(bucket(t, "H4"), int(datetime(2026, 3, 2, 4, tzinfo=UTC).timestamp() * 1000))
        self.assertEqual(bucket(t, "D"), int(datetime(2026, 3, 2, tzinfo=UTC).timestamp() * 1000))

    def test_removed_bar_does_not_shift_boundaries(self):
        m1 = [{"t": i * 60_000, "bo": i, "bh": i + 1, "bl": i - 1, "bc": i + 0.5, "ao": i, "ah": i + 1, "al": i - 1, "ac": i + 0.5,
               "v": 1.0, "n": 1, "src": "tick"} for i in range(20)]
        full = aggregate(m1, "M5")
        gap = aggregate([b for b in m1 if b["t"] != 7 * 60_000], "M5")
        self.assertEqual([b["t"] for b in full], [b["t"] for b in gap])
        self.assertEqual(gap[1]["v"], 4.0)
        self.assertEqual((gap[1]["bo"], gap[1]["bc"], gap[1]["bh"]), (5, 9.5, 10))

    def test_missing_ask_poisons_aggregate_ask(self):
        m1 = [{"t": 0, "bo": 1, "bh": 1, "bl": 1, "bc": 1, "ao": 1, "ah": 1, "al": 1, "ac": 1, "v": 1.0, "n": 1, "src": "tick"},
              {"t": 60_000, "bo": 1, "bh": 1, "bl": 1, "bc": 1, "ao": None, "ah": None, "al": None, "ac": None, "v": 1.0, "n": 0, "src": "m1"}]
        a = aggregate(m1, "M5")[0]
        self.assertIsNone(a["ao"])
        self.assertEqual(a["src"], "mixed")


class History(unittest.TestCase):
    def test_official_m1_candles_and_freeze_cutoff(self):
        day = datetime(2026, 9, 29, tzinfo=UTC)
        m = lambda hh, mm: (hh * 3600 + mm * 60)
        bid = [(m(14, 57), 3800, 3801, 3799, 3802, 5),   # 14:57 kept (ends 14:58 ≤ T_freeze 14:58:45)
               (m(14, 58), 3801, 3802, 3800, 3803, 5),   # 14:58 minute contains T_freeze → dropped
               (m(15, 10), 3802, 3803, 3801, 3804, 5)]   # after freeze → dropped
        ask = [(s_, o + 0.3, c + 0.3, lo + 0.3, h + 0.3, v) for s_, o, c, lo, h, v in bid]
        files = {dk.candle_url(day, "BID"): candle_file(bid), dk.candle_url(day, "ASK"): candle_file(ask)}
        with tempfile.TemporaryDirectory() as d:
            r = build_history.build_day(day, fetch=lambda u: files.get(u), root=Path(d))
            self.assertEqual(r["entry"]["source"], "m1")
            self.assertEqual([b["t"] for b in r["bars"]], [int(datetime(2026, 9, 29, 14, 57, tzinfo=UTC).timestamp() * 1000)])
            self.assertTrue(all(b["t"] + 60_000 <= T_FREEZE_MS for b in r["bars"]))
            (e,) = read_manifest(Path(d))
            self.assertEqual((e["bars"], e["ask_coverage"]), (1, 1.0))
            self.assertEqual(read_day(Path(d) / e["m1_file"])[0]["ah"], 3802.3)

    def test_ticks_are_never_requested(self):
        asked = []
        build_history.build_day(datetime(2020, 5, 5, tzinfo=UTC), fetch=lambda u: asked.append(u) or None)
        self.assertTrue(asked and all("candles_min_1" in u for u in asked))


class QuietRun(unittest.TestCase):
    def test_newest_first_clipped_to_freeze(self):
        days = build_history.days_between(datetime(2026, 9, 27, tzinfo=UTC), datetime(2026, 10, 3, tzinfo=UTC), True)
        self.assertEqual([f"{d:%m-%d}" for d in days], ["09-29", "09-28", "09-27"])

    def test_throttle_cools_down_retries_and_skips_done_days(self):
        calls, sleeps, logs = [], [], []
        state = {"fail": 2}

        def build(d, root, keep_raw):
            calls.append(d)
            if state["fail"]:
                state["fail"] -= 1
                raise dk.RateLimited("503")
            return {"entry": {"day": f"{d:%Y-%m-%d}", "source": "m1", "bars": 1, "ask_coverage": 1.0}}
        with tempfile.TemporaryDirectory() as t:
            from store import append_manifest
            append_manifest(Path(t), {"kind": "history_day", "day": "2020-01-01"})
            days = [datetime(2020, 1, 2, tzinfo=UTC), datetime(2020, 1, 1, tzinfo=UTC)]
            ok = build_history.run(days, Path(t), build=build, sleep=sleeps.append, log=logs.append)
        self.assertTrue(ok)
        self.assertEqual(len(calls), 3)           # 2 throttled attempts + 1 success; the done day is skipped
        self.assertEqual(sleeps, [600, 600])

    def test_persistent_throttle_stops_cleanly(self):
        def build(d, root, keep_raw):
            raise dk.RateLimited("503")
        with tempfile.TemporaryDirectory() as t:
            ok = build_history.run([datetime(2020, 1, 2, tzinfo=UTC)], Path(t), build=build, sleep=lambda s: None, log=lambda s: None, max_cooldowns=3)
        self.assertFalse(ok)


class Forward(unittest.TestCase):
    def test_capture_complete_days_from_freeze_day_idempotent_and_raw(self):
        calls = []

        def fetch(u):
            calls.append(u)
            return candle_file([(0, 3800.0, 3800.5, 3799.5, 3801.0, 1)])

        now = T_FREEZE.replace(hour=0, minute=0, second=0) + timedelta(days=2, hours=4)
        with tempfile.TemporaryDirectory() as d:
            rows = capture_forward.capture(Path(d), now, fetch=fetch)
            self.assertEqual([r["day"] for r in rows], [f"{T_FREEZE:%Y-%m-%d}", f"{T_FREEZE + timedelta(days=1):%Y-%m-%d}"])
            self.assertEqual(rows[0]["bid_sha256"], sha256(fetch(dk.candle_url(T_FREEZE, "BID"))))
            n = len(calls)
            self.assertEqual(capture_forward.capture(Path(d), now, fetch=fetch), [])
            self.assertEqual(len(calls), n)
            self.assertEqual(len(list(Path(d).rglob("*.bi5"))), 4)
            self.assertFalse(list(Path(d).rglob("*.csv.gz")))  # nothing decoded: sealed


class Fetch(unittest.TestCase):
    """F-002 regression: HTTP 429 is paced and retried with bounded backoff, never parsed as data."""

    class _Resp:
        def __init__(self, b): self.b = b
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return self.b

    def _err(self, code, retry_after=None):
        import email.message
        import urllib.error
        h = email.message.Message()
        if retry_after is not None:
            h["Retry-After"] = str(retry_after)
        return urllib.error.HTTPError("u", code, "x", h, None)

    def test_429_waits_retry_after_then_succeeds_with_user_agent(self):
        calls, sleeps = [], []
        answers = [self._err(429, 7), self._err(429), self._Resp(b"ok")]

        def opener(req, timeout):
            calls.append(req.get_header("User-agent"))
            a = answers.pop(0)
            if isinstance(a, Exception):
                raise a
            return a
        self.assertEqual(dk.fetch("https://x.test/f.bi5", opener=opener, sleep=sleeps.append), b"ok")
        self.assertTrue(all(ua == dk.USER_AGENT for ua in calls))
        self.assertIn(7.0, sleeps)   # Retry-After honoured
        self.assertIn(10.0, sleeps)  # then 5·2^1

    def test_persistent_429_raises_rate_limited_after_bounded_retries(self):
        n = [0]

        def opener(req, timeout):
            n[0] += 1
            raise self._err(429)
        with self.assertRaises(dk.RateLimited):
            dk.fetch("https://x.test/f.bi5", opener=opener, sleep=lambda s: None, rate_retries=3)
        self.assertEqual(n[0], 4)

    def test_503_is_throttling_like_429(self):  # F-003 regression
        answers = [self._err(503), self._Resp(b"ok")]

        def opener(req, timeout):
            a = answers.pop(0)
            if isinstance(a, Exception):
                raise a
            return a
        sleeps = []
        self.assertEqual(dk.fetch("https://x.test/f.bi5", opener=opener, sleep=sleeps.append), b"ok")
        self.assertIn(5.0, sleeps)

    def test_404_is_no_file_and_500_raises(self):
        def o404(req, timeout): raise self._err(404)
        def o500(req, timeout): raise self._err(500)
        self.assertIsNone(dk.fetch("https://x.test/f.bi5", opener=o404, sleep=lambda s: None))
        import urllib.error
        with self.assertRaises(urllib.error.HTTPError):
            dk.fetch("https://x.test/f.bi5", opener=o500, sleep=lambda s: None)


class Store(unittest.TestCase):
    def test_day_file_is_deterministic(self):
        bars = [{"t": 0, "bo": 1.5, "bh": 2.0, "bl": 1.0, "bc": 1.25, "ao": None, "ah": None, "al": None, "ac": None, "v": 3.0, "n": 0, "src": "m1"}]
        with tempfile.TemporaryDirectory() as d:
            p1 = write_day(Path(d), datetime(2020, 1, 1, tzinfo=UTC), bars)
            h1 = sha256(p1.read_bytes())
            p2 = write_day(Path(d), datetime(2020, 1, 1, tzinfo=UTC), bars)
            self.assertEqual(h1, sha256(p2.read_bytes()))
            self.assertEqual(read_day(p2), bars)


if __name__ == "__main__":
    unittest.main()
