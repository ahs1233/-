"""JForex API feasibility comparison (offline, synthetic public files)."""
import lzma
import struct
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import dukascopy as dk
import xcheck_jforex_api as xa

DAY = datetime(2026, 3, 4, tzinfo=timezone.utc)
D0 = int(DAY.timestamp() * 1000)
TICK = struct.Struct(">IIIff")
REC = struct.Struct(">IIIIIf")


def ticks_for(hour):
    base = D0 + hour * 3_600_000
    return [(base + 5_000 + k * 20_000, 4000.5 + k * 0.01 + hour, 4000.2 + k * 0.01 + hour, 0.5, 0.25) for k in range(6)]


class Api(unittest.TestCase):
    def setUp(self):
        self.api = Path(tempfile.mkdtemp())
        self.out = Path(tempfile.mkdtemp())
        self.hours = sorted(set(xa.BASE_HOURS))
        allt = [t for h in self.hours for t in ticks_for(h)]
        with open(self.api / "2026-03-04_ticks.csv", "w") as f:
            f.write("t,ask,bid,askVol,bidVol\n" + "".join(f"{t},{a:.3f},{b:.3f},{av},{bv}\n" for t, a, b, av, bv in allt))
        self.feed = {}
        for h in range(24):
            ts = ticks_for(h) if h in self.hours else []
            body = b"".join(TICK.pack(t - D0 - h * 3_600_000, round(a * 1000), round(b * 1000), av, bv) for t, a, b, av, bv in ts)
            self.feed[dk.tick_url(DAY + timedelta(hours=h))] = lzma.compress(body, format=lzma.FORMAT_ALONE) if body else None
        for side, px in (("BID", 2), ("ASK", 1)):
            m1 = xa.ticks_to_m1([{"t": t, "ask": a, "bid": b, "askVol": av, "bidVol": bv} for t, a, b, av, bv in allt], side)
            recs = [REC.pack((k - D0) // 1000, o, c, lo, hi, v) for k, ((o, hi, lo, c), v) in sorted(m1.items())]
            self.feed[dk.candle_url(DAY, side)] = lzma.compress(b"".join(recs), format=lzma.FORMAT_ALONE)
            with open(self.api / f"2026-03-04_{side}_m1.csv", "w") as f:
                f.write("t,o,h,l,c,v\n" + "".join(f"{k},{o / 1000},{hi / 1000},{lo / 1000},{c / 1000},{v}\n" for k, ((o, hi, lo, c), v) in sorted(m1.items())))
        (self.api / "timings.csv").write_text("day,kind,ms,rows\n2026-03-04,ticks,3600,18\n")

    def test_identical_sources_and_throughput(self):
        rep = xa.run(self.api, None, self.out, fetch=self.feed.get, log=lambda s: None)
        d = rep["days"]["2026-03-04"]
        self.assertTrue(all(v["identical"] and v["volumes_identical"] for v in d["ticks_vs_public"].values()))
        self.assertEqual(d["ticks_m1_vs_public"]["BID"]["ohlc_differs"], 0)
        self.assertEqual(d["bars_vs_public"]["ASK"]["price_differs"], 0)
        self.assertEqual(rep["throughput"]["est_hours_for_3100_days"], 3.1)

    def test_a_changed_tick_is_reported(self):
        p = self.api / "2026-03-04_ticks.csv"
        lines = p.read_text().splitlines()
        t, a, b, av, bv = lines[2].split(",")
        lines[2] = ",".join([t, a, f"{float(b) + 0.05:.3f}", av, bv])
        p.write_text("\n".join(lines) + "\n")
        d = xa.run(self.api, None, self.out, fetch=self.feed.get, log=lambda s: None)["days"]["2026-03-04"]
        self.assertFalse(d["ticks_vs_public"]["08h"]["identical"])
        self.assertEqual(d["ticks_m1_vs_public"]["BID"]["ohlc_differs"], 1)
        self.assertEqual(d["ticks_m1_vs_public"]["ASK"]["ohlc_differs"], 0)


if __name__ == "__main__":
    unittest.main()
