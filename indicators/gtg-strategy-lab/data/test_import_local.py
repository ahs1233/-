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


class Export(unittest.TestCase):
    def test_export_imports_with_provenance_and_freeze_clip(self):
        from datetime import timedelta
        from lab_config import T_FREEZE, T_FREEZE_MS
        from store import read_manifest
        fd = T_FREEZE.replace(hour=0, minute=0, second=0)
        prev = fd - timedelta(days=1)
        fm = T_FREEZE.hour * 3600 + T_FREEZE.minute * 60
        late = [(fm - 60, 4000.0, 4000.5, 3999.5, 4001.0, 7.0), (fm, 4000.5, 4001.0, 4000.0, 4001.5, 3.0)]
        export = Path(tempfile.mkdtemp())
        for day, rows in ((prev, BID), (fd, late)):
            for side, rr in (("BID", rows), ("ASK", [(s_, o + 0.2, c + 0.2, lo + 0.2, h + 0.2, v) for s_, o, c, lo, h, v in rows])):
                f = il.cache_path(export, dk.candle_url(day, side))
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_bytes(lzma.decompress(candle_file(rr)))
        (export / "export_log.csv").write_text(f"day,side,rows,ms,exported_at_utc,from,to\n{prev:%Y-%m-%d},BID,2,1,2026-10-01T00:00:00Z,a,b\n")
        root = Path(tempfile.mkdtemp())
        r = il.import_export(export, root, prev, fd + timedelta(days=3), log=lambda *_: None)
        self.assertEqual(r, {"processed": 2, "with_data": 2})
        m = {e["day"]: e for e in read_manifest(root)}
        e = m[f"{prev:%Y-%m-%d}"]
        self.assertEqual((e["origin"], e["raw_format"], e["exported_at"], e["provenance"]["channel"]),
                         ("jforex-ihistory-export", "plain", "2026-10-01T00:00:00Z", "JForex API/IHistory -> local export"))
        self.assertEqual(m[f"{fd:%Y-%m-%d}"]["bars"], 1)                         # the minute holding T_freeze is dropped
        self.assertEqual(il.import_export(export, root, prev, fd, log=lambda *_: None)["processed"], 0)   # idempotent


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
