"""Path B importers: JForex cache (official bi5 files) and CSV export, plus the cross-check."""
import lzma
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import dukascopy as dk
import import_local as il
from build_history import build_day
from test_data import candle_file

UTC = timezone.utc
DAY = datetime(2026, 7, 15, tzinfo=UTC)
M = lambda hh, mm: hh * 3600 + mm * 60
BID = [(M(13, 0), 4000.0, 4000.5, 3999.5, 4001.0, 7.0), (M(13, 1), 4000.5, 4001.0, 4000.0, 4001.5, 3.0)]
ASK = [(s, o + 0.2, c + 0.2, lo + 0.2, h + 0.2, v) for s, o, c, lo, h, v in BID]


class Cache(unittest.TestCase):
    def test_cache_files_go_through_the_same_build_and_match_the_datafeed(self):
        files = {dk.candle_url(DAY, "BID"): candle_file(BID), dk.candle_url(DAY, "ASK"): candle_file(ASK)}
        cache = Path(tempfile.mkdtemp())
        for url, raw in files.items():
            p = il.cache_path(cache, url)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(lzma.decompress(raw))                       # the cache keeps plain records
        self.assertTrue(str(il.cache_path(cache, dk.candle_url(DAY, "BID"))).endswith("XAUUSD/2026/06/15/BID_candles_min_1.bi5".replace("/", "/")))
        a, ref = Path(tempfile.mkdtemp()), Path(tempfile.mkdtemp())
        il.import_cache(cache, a, DAY, datetime(2026, 7, 16, tzinfo=UTC), log=lambda *_: None)
        build_day(DAY, fetch=lambda u: files.get(u), root=ref)            # the datafeed path
        rep = il.crosscheck(a, ref)
        self.assertEqual((rep["verdict"], rep["overlap_days"]), ("PASS", 1))
        self.assertIsNone(rep["days"][0]["same_raw_sha256"])                # plain vs lzma: not comparable
        self.assertTrue(rep["days"][0]["same_bars"])

    def test_a_compressed_file_read_as_plain_is_refused(self):
        with self.assertRaises(dk.FeedError):
            dk.decode_candles(candle_file(BID), int(DAY.timestamp()), compressed=False)


class Csv(unittest.TestCase):
    def write(self, rows, header="Gmt time,Open,High,Low,Close,Volume"):
        p = Path(tempfile.mkdtemp()) / "x.csv"
        p.write_text(header + "\n" + "".join(
            f"{datetime.fromtimestamp((DAY.timestamp() + s), UTC):%d.%m.%Y %H:%M:%S}.000,{o},{h},{lo},{c},{v}\n" for s, o, c, lo, h, v in rows))
        return p

    def test_csv_import_equals_the_datafeed_bars(self):
        a, ref = Path(tempfile.mkdtemp()), Path(tempfile.mkdtemp())
        il.import_csv(self.write(BID), self.write(ASK), a, log=lambda *_: None)
        build_day(DAY, fetch=lambda u: {dk.candle_url(DAY, "BID"): candle_file(BID), dk.candle_url(DAY, "ASK"): candle_file(ASK)}.get(u), root=ref)
        rep = il.crosscheck(a, ref)
        self.assertEqual(rep["verdict"], "PASS", rep)
        self.assertEqual(rep["days"][0]["volume_ratio"], 1.0)

    def test_non_gmt_time_or_bad_price_is_refused(self):
        with self.assertRaises(ValueError):
            il.read_jforex_csv(self.write(BID, header="Local time,Open,High,Low,Close,Volume"))
        with self.assertRaises(dk.FeedError):
            il.read_jforex_csv(self.write([(M(13, 0), 40.0, 40.5, 39.5, 41.0, 1.0)]))


if __name__ == "__main__":
    unittest.main()
