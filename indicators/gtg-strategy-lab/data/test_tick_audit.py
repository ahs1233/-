"""Tick Audit harness tests (TRADE_CONTRACT v0.2.1 §2.3), offline."""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

import tick_audit as ta
import dukascopy as dk

UTC = timezone.utc


def day_bars(day: str, rng_: float, n: int = 1300):
    t0 = int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp() * 1000)
    return [{"t": t0 + i * 60_000, "bo": 100.0, "bh": 100.0 + (rng_ if i == 5 else 0.1), "bl": 99.9, "bc": 100.0,
             "ao": 100.1, "ah": 100.2, "al": 100.0, "ac": 100.1, "v": 1.0, "n": 0, "src": "m1"} for i in range(n)]


def market(years=range(2012, 2022)):
    out = {}
    for y in years:
        for mth in range(1, 13):
            for dd in range(1, 29):
                d = datetime(y, mth, dd)
                if d.weekday() < 5:
                    out[f"{d:%Y-%m-%d}"] = day_bars(f"{d:%Y-%m-%d}", ((y * 31 + mth * 7 + dd * 13) % 97) / 10)
    return out


class Select(unittest.TestCase):
    def test_twenty_days_deterministic_stratified_distinct(self):
        m = market()
        a, b = ta.select_days(m), ta.select_days(m)
        self.assertEqual(a, b)
        self.assertEqual(len(a), 20)
        self.assertEqual(len({x["day"] for x in a}), 20)
        self.assertEqual(sorted({x["bucket"] for x in a}), [0, 1, 2, 3, 4])
        for k in range(5):
            self.assertEqual(sorted(x["type"] for x in a if x["bucket"] == k), ["high_vol", "low_vol", "normal", "week_reopen"])
        for x in a:
            same_month = [d for d in m if d.startswith(x["month"])]
            if x["type"] == "high_vol":
                self.assertEqual(ta._day_range(m[x["day"]]), max(ta._day_range(m[d]) for d in same_month))

    def test_partial_days_are_not_eligible(self):
        m = {"2020-01-02": day_bars("2020-01-02", 1.0, n=500)}
        self.assertEqual(ta.select_days(m), [])


class Compare(unittest.TestCase):
    def test_one_feed_tick_tolerance_is_exact(self):
        off = day_bars("2020-01-02", 1.0, n=3)
        ok = [dict(b, bh=b["bh"] + 0.001) for b in off]
        bad = [dict(b, bh=b["bh"] + 0.0015) for b in off]
        self.assertEqual(ta.compare_side(ok, off, "BID")["fields_beyond_tol"], 0)
        self.assertEqual(ta.compare_side(bad, off, "BID")["fields_beyond_tol"], 3)
        miss = ta.compare_side(off[:2], off, "ASK")
        self.assertEqual((miss["only_official"], miss["only_tick"]), (1, 0))

    def test_volume_scale_is_measured_not_required(self):
        off = day_bars("2020-01-02", 1.0, n=10)
        for i, b in enumerate(off):
            b["v"] = 1000.0 * (i + 1)
        tick = [dict(b, v=b["v"] / 1000) for b in off]
        v = ta.volume_stats(tick, off)
        self.assertAlmostEqual(v["corr"], 1.0)
        self.assertAlmostEqual(v["median_scale_official_over_tick"], 1000.0)


class Verdict(unittest.TestCase):
    def _r(self, beyond=0, fuel=0, scale=1.0):
        side = {"only_tick": 0, "only_official": 0, "fields_beyond_tol": beyond}
        return {"status": "done", "bid": side, "ask": side, "fuel": {"mismatches": fuel}, "volume": {"median_scale_official_over_tick": scale}}

    def test_gates(self):
        self.assertEqual(ta.verdict([self._r()]), "PASS-A")
        self.assertEqual(ta.verdict([self._r(scale=1000.0)]), "PASS-B")
        self.assertEqual(ta.verdict([self._r(beyond=1)]), "FAIL")
        self.assertEqual(ta.verdict([self._r(fuel=2)]), "FAIL")
        self.assertEqual(ta.verdict([self._r(), {"status": "TICK_AUDIT_BLOCKED_BY_SOURCE"}]), "TICK_AUDIT_BLOCKED_BY_SOURCE")

    def test_throttled_source_is_blocked_not_fail(self):
        def fetch(u):
            raise dk.RateLimited("503")
        r = ta.audit_day("2020-01-02", day_bars("2020-01-02", 1.0), fetch=fetch, fuel=lambda *a: {"mismatches": 0})
        self.assertEqual(r["status"], "TICK_AUDIT_BLOCKED_BY_SOURCE")


class FuelJs(unittest.TestCase):
    def test_constant_volume_scale_does_not_change_fuel_decisions(self):
        import shutil
        if not shutil.which("node"):
            self.skipTest("node not available")
        off = []
        t0 = int(datetime(2020, 1, 2, tzinfo=UTC).timestamp() * 1000)
        px = 100.0
        for i in range(1300):
            px += ((i * 7919) % 13 - 6) * 0.01
            off.append({"t": t0 + i * 60_000, "bo": px, "bh": px + 0.05, "bl": px - 0.05, "bc": px + 0.01, "v": 5 + (i * 31) % 17})
        r = ta.fuel_check(off, {b["t"]: b["v"] * 0.001 for b in off})
        self.assertGreater(r["compared"], 100)
        self.assertEqual(r["mismatches"], 0)
        r2 = ta.fuel_check(off, {b["t"]: (b["v"] if i % 3 else 40.0) for i, b in enumerate(off)})
        self.assertGreater(r2["mismatches"], 0)  # negative control: a different volume path is detected


if __name__ == "__main__":
    unittest.main()
