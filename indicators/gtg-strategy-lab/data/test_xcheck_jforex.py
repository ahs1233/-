"""F-012 evidence tool: classification, tick arbiter, resumability, clean stop."""
import json
import lzma
import struct
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

import dukascopy as dk
import xcheck_jforex as xj

REC = struct.Struct(">IIIIIf")
TICK = struct.Struct(">IIIff")
DAY = date(2010, 3, 3)
DT = datetime(2010, 3, 3, tzinfo=timezone.utc)


def recs(rows):
    return b"".join(REC.pack(*r) for r in rows)


BASE = [(60 * k, 1100000, 1100500, 1099500, 1101000, 2.0) for k in range(4)]


class Classify(unittest.TestCase):
    def test_four_kinds(self):
        jf = list(BASE)
        jf[0] = (0, 1100000, 1100500, 1099500, 1101000, 2.5)            # volume only
        jf[1] = (60, 1100100, 1100500, 1099500, 1101000, 2.0)           # price
        jf[2] = (120, 1100000, 1100000, 1100000, 1100000, 0.0)          # flat where the datafeed traded
        jf = jf[:3]                                                     # minute 180 missing → boundary
        kinds = {s: k for s, k, _, _ in xj.classify(BASE, jf)}
        self.assertEqual(kinds, {0: "volume_only", 60: "price", 120: "flat_zero_volume", 180: "timestamp_boundary"})
        self.assertEqual(xj.classify(BASE, BASE), [])

    def test_arbiter_names_the_candle_the_ticks_reproduce(self):
        t0 = int(DT.timestamp() * 1000)
        ticks = [(t0 + 1000, 1100.7, 1100.0, 1.0, 1.0), (t0 + 2000, 1101.7, 1101.0, 1.0, 0.5),
                 (t0 + 3000, 1100.2, 1099.5, 1.0, 0.5), (t0 + 4000, 1101.2, 1100.5, 1.0, 0.0)]
        tc = xj.tick_candle(ticks, t0, "BID")
        self.assertEqual(tc["ocLh"], [1100000, 1100500, 1099500, 1101000])
        good, bad = BASE[0], (0, 1100100, 1100500, 1099500, 1101000, 2.0)
        self.assertEqual(xj.arbitrate(tc, good, bad)["price_matches"], "datafeed")
        self.assertEqual(xj.arbitrate(tc, bad, good)["price_matches"], "jforex")

    def test_no_ticks_is_no_verdict(self):
        # F-014: two differently filled flat candles with no ticks were reported as "datafeed"
        flat_df, flat_jf = (0, 5, 5, 5, 5, 0.0), (0, 6, 6, 6, 6, 0.0)
        for x, z in ((flat_df, flat_jf), (flat_df, BASE[0]), (BASE[0], flat_jf), (BASE[0], BASE[1])):
            self.assertEqual(xj.arbitrate(None, x, z), {"ticks": 0, "price_matches": "no_ticks"})


class Run(unittest.TestCase):
    def setUp(self):
        self.cache = Path(tempfile.mkdtemp())
        self.out = Path(tempfile.mkdtemp()) / "x.json"
        jf = list(BASE); jf[1] = (60, 1100100, 1100500, 1099500, 1101000, 2.0)
        for side, rows in (("BID", jf), ("ASK", BASE)):
            p = self.cache / dk.candle_url(DT, side).split("/datafeed/", 1)[1]
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(recs(rows))
        t0 = 0
        self.ticks = lzma.compress(b"".join(TICK.pack(*t) for t in [(t0 + 61_000, 1100700, 1100000, 1.0, 1.0), (t0 + 62_000, 1101700, 1101000, 1.0, 1.0),
                                                                  (t0 + 63_000, 1100200, 1099500, 1.0, 1.0), (t0 + 64_000, 1101200, 1100500, 1.0, 1.0)]), format=lzma.FORMAT_ALONE)
        self.feed = {dk.candle_url(DT, s): lzma.compress(recs(BASE), format=lzma.FORMAT_ALONE) for s in ("BID", "ASK")}
        self.feed[dk.tick_url(DT)] = self.ticks

    def test_report_and_summary(self):
        rep = xj.run(self.cache, [DAY], self.out, "sample", fetch=self.feed.get, log=lambda *_: None)
        s = xj.summarize(rep)["sample"]
        self.assertEqual((s["files_compared"], s["files_identical"], s["days_differing"], s["minutes_differing"]), (2, 1, 1, 1))
        self.assertEqual(s["arbiter"], {"price:datafeed": 1})
        self.assertEqual(s["price_mismatch_rate"], 1 / 8)

    def test_throttling_stops_cleanly_and_resumes_without_refetching(self):
        calls = []
        def flaky(url):
            calls.append(url)
            if len(calls) == 1:
                return self.feed[url]
            raise ConnectionError("timeout")
        rep = xj.run(self.cache, [DAY], self.out, "sample", fetch=flaky, sleep=lambda s: None, max_cooldowns=2, log=lambda *_: None)
        self.assertIn("stopped", rep)
        self.assertEqual(len(rep["rows"]), 0)          # BID row needs its tick hour → not written before the stop
        rep = xj.run(self.cache, [DAY], self.out, "sample", fetch=self.feed.get, log=lambda *_: None)
        self.assertEqual(len(rep["rows"]), 2)
        n = len(json.loads(self.out.read_text())["rows"])
        again = []
        xj.run(self.cache, [DAY], self.out, "sample", fetch=lambda u: again.append(u), log=lambda *_: None)
        self.assertEqual((again, n), ([], 2))           # nothing fetched twice


if __name__ == "__main__":
    unittest.main()
