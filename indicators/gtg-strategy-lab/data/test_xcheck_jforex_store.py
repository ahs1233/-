"""JForex cache vs the public store over the local overlap (offline)."""
import lzma
import struct
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import dukascopy as dk
import xcheck_jforex_store as xs
from bars import candles_to_m1
from store import append_manifest, sha256, write_day

DAY = datetime(2026, 3, 4, tzinfo=timezone.utc)
S0 = int(DAY.timestamp())
REC = struct.Struct(">IIIIIf")
TICK = struct.Struct(">IIIff")


def recs(rows):                     # rows: (sec, o, h, l, c, v) in points
    return b"".join(REC.pack(s, o, c, l, h, v) for s, o, h, l, c, v in rows)


class Store(unittest.TestCase):
    def test_classes_rates_and_arbiter(self):
        base = [(13 * 3600 + 60 * k, 4000000 + k, 4000500, 3999500, 4000100, 2.0) for k in range(10)]
        ask = [(s, o + 300, h + 300, l + 300, c + 300, v) for s, o, h, l, c, v in base]
        jf = list(base)
        jf[1] = (jf[1][0], jf[1][1], jf[1][2] + 20, jf[1][3], jf[1][4], 2.0)       # BID high +0.020
        jf[2] = jf[2][:5] + (2.5,)                                                  # volume only
        jf = jf[:9]                                                                 # last minute missing
        with tempfile.TemporaryDirectory() as t:
            root, cache, out = Path(t) / "store", Path(t) / "cache", Path(t) / "out"
            pub = candles_to_m1(dk.decode_candles(lzma.compress(recs(base), format=lzma.FORMAT_ALONE), S0),
                                dk.decode_candles(lzma.compress(recs(ask), format=lzma.FORMAT_ALONE), S0))
            p = write_day(root, DAY, pub)
            append_manifest(root, {"kind": "history_day", "day": "2026-03-04", "source": "m1", "bars": len(pub),
                                   "m1_file": str(p.relative_to(root)), "m1_sha256": sha256(p.read_bytes())})
            for side, rows in (("BID", jf), ("ASK", ask)):
                f = cache / dk.candle_url(DAY, side).split("/datafeed/", 1)[1]
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_bytes(recs(rows))
            t1 = (S0 + 13 * 3600 + 60) * 1000
            ticks = [(t1 + 1000, 4000.3, 4000.001, 1, 1), (t1 + 2000, 4000.8, 4000.5, 1, 1), (t1 + 3000, 3999.8, 3999.5, 1, 1), (t1 + 4000, 4000.4, 4000.1, 1, 1)]
            hour = DAY + timedelta(hours=13)
            body = b"".join(TICK.pack(tt - int(hour.timestamp() * 1000), round(a * 1000), round(b * 1000), av, bv) for tt, a, b, av, bv in ticks)
            feed = {dk.tick_url(hour): lzma.compress(body, format=lzma.FORMAT_ALONE)}
            rep = xs.run(root, cache, "2026-03-01", "2026-03-31", out, arbitrate_max=5, fetch=feed.get, log=lambda s: None)
        self.assertEqual((rep["overlap_days"], rep["exact_days"], rep["total_public_m1_bars"]), (1, 0, 10))
        self.assertEqual(rep["kinds"], {"price": 1, "volume_only": 1, "missing_in_jforex": 1})
        self.assertAlmostEqual(rep["largest_price_difference"], 0.02)
        self.assertEqual(rep["price_bid_vs_ask_only"], {"bid": 1})
        self.assertEqual(rep["arbiter"], {"public": 1})
        self.assertAlmostEqual(rep["price_mismatch_pct"], 10.0)


if __name__ == "__main__":
    unittest.main()
