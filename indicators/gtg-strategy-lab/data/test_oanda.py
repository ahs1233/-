"""OANDA feasibility test tools: API parsing/paging and the comparison report (offline)."""
import gzip
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import oanda
import xcheck_oanda as xo
from store import append_manifest, sha256, write_day

DAY = datetime(2026, 3, 4, tzinfo=timezone.utc)            # a Wednesday
T0 = int(DAY.timestamp()) + 13 * 3600                       # 13:00 UTC, in session


def candle(t_s, bid, ask=None, v=7, complete=True):
    ask = ask if ask is not None else bid + 0.3
    px = lambda p: {"o": f"{p:.3f}", "h": f"{p + 0.5:.3f}", "l": f"{p - 0.5:.3f}", "c": f"{p + 0.1:.3f}"}
    return {"time": f"{t_s}.000000000", "complete": complete, "volume": v, "bid": px(bid), "ask": px(ask)}


class Api(unittest.TestCase):
    def test_parse_keeps_complete_candles_in_ms(self):
        doc = {"candles": [candle(T0, 4000.0), candle(T0 + 60, 4001.0, complete=False)]}
        (b,) = oanda.parse(doc)
        self.assertEqual((b["t"], b["bo"], b["bh"], b["ac"], b["v"]), (T0 * 1000, 4000.0, 4000.5, 4000.4, 7))

    def test_paging_advances_and_stops_at_end(self):
        pages = {T0: [candle(T0 + 60 * k, 4000 + k) for k in range(3)],
                 T0 + 180: [candle(T0 + 60 * k, 4000 + k) for k in range(3, 5)]}
        urls = []

        def get(url, token):
            urls.append(url)
            frm = int(url.split("from=")[1].split("&")[0])
            return {"candles": pages.get(frm, [])}
        out = oanda.fetch_m1(T0, T0 + 240, "tok", get=get, sleep=lambda s: None, log=lambda s: None)
        self.assertEqual([b["t"] // 1000 - T0 for b in out], [0, 60, 120, 180])   # end is exclusive
        self.assertTrue(all("price=BA" in u and "granularity=M1" in u and "smooth=false" in u for u in urls))


def bar(t_ms, px, v=5.0):
    return {"t": t_ms, "bo": px, "bh": px + 0.5, "bl": px - 0.5, "bc": px + 0.1,
            "ao": px + 0.3, "ah": px + 0.8, "al": px - 0.2, "ac": px + 0.4, "v": v, "n": 0, "src": "m1"}


class Compare(unittest.TestCase):
    def test_minutes_ohlc_volume(self):
        duk = [bar((T0 + 60 * k) * 1000, 4000 + k, v=1 + k) for k in range(4)]
        oan = [dict(b, v=10 * (1 + k)) for k, b in enumerate(duk[1:])] + [bar((T0 + 240) * 1000, 4010)]
        oan[0] = dict(oan[0], bh=oan[0]["bh"] + 0.02)
        m = xo.minutes(duk, oan)
        self.assertEqual((m["common"], m["only_dukascopy"], m["only_oanda"]), (3, 1, 1))
        o = xo.ohlc(duk, oan)
        self.assertEqual(o["BID O"]["exact"], 1.0)
        self.assertAlmostEqual(o["BID H"]["exact"], 2 / 3)
        self.assertAlmostEqual(o["BID H"]["max"], 0.02)
        self.assertEqual(xo.volume(duk, oan)["spearman"], 1.0)

    def test_tv_names_the_matching_series(self):
        tv = [{"t": b["t"], "o": b["bo"], "h": b["bh"], "l": b["bl"], "c": b["bc"], "v": 3} for b in [bar(0, 4000), bar(60_000, 4001)]]
        bid = [dict(x) for x in tv]
        ask = [dict(x, o=x["o"] + 0.3) for x in tv]
        r = xo.vs_tv(tv, {"bid": bid, "ask": ask})
        self.assertEqual((r["bid"]["ohlc_all_exact"], r["ask"]["ohlc_all_exact"], r["bid"]["volume_equal"]), (1.0, 0.0, 1.0))

    def test_run_writes_report_and_inputs(self):
        with tempfile.TemporaryDirectory() as t:
            root, out = Path(t) / "store", Path(t) / "out"
            duk = [bar((T0 + 60 * k) * 1000, 4000 + k * 0.1) for k in range(30)]
            p = write_day(root, DAY, duk)
            append_manifest(root, {"kind": "history_day", "day": "2026-03-04", "source": "m1", "bars": len(duk),
                                   "m1_file": str(p.relative_to(root)), "m1_sha256": sha256(p.read_bytes())})
            oan = [dict(b, v=9) for b in duk[:-1]]
            rep = xo.run(root, oan, "2026-03-04", "2026-03-04", None, out)
            self.assertEqual(rep["timestamps"]["only_dukascopy"], 1)
            self.assertEqual(rep["ohlc_vs_dukascopy"]["ASK C"]["exact"], 1.0)
            fa, fb = (json.loads((out / f).read_text()) for f in ("fuel_dukascopy.json", "fuel_oandavol.json"))
            self.assertEqual(([x["t"] for x in fa], [x["c"] for x in fa]), ([x["t"] for x in fb], [x["c"] for x in fb]))
            self.assertEqual({x["v"] for x in fb}, {9})
            self.assertIn("M5", json.loads((out / "feeds_oanda.json").read_text())["feeds"])


if __name__ == "__main__":
    unittest.main()
