from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from liquidity_map import rolling_liquidity_map
from mtf_context import aggregate_completed_bars, align_completed_timeframes
from session_narrative import session_narrative_frame


def minute_frame(start="2026-10-04T00:00:00Z", n=180):
    t = pd.date_range(start, periods=n, freq="1min", tz="UTC")
    base = 100.0 + np.arange(n) * 0.01
    return pd.DataFrame({
        "time": t,
        "open": base,
        "high": base + 0.2,
        "low": base - 0.2,
        "close": base + 0.05,
    })


class MTFTests(unittest.TestCase):
    def test_5m_bar_not_available_before_close(self):
        f = minute_frame(n=12)
        b = aggregate_completed_bars(f, rule="5min")
        first = b.iloc[0]
        self.assertEqual(first["bar_start"], pd.Timestamp("2026-10-04T00:00:00Z"))
        self.assertEqual(first["available_at"], pd.Timestamp("2026-10-04T00:05:00Z"))

    def test_alignment_uses_only_completed_bar(self):
        f = minute_frame(n=20)
        d = [
            pd.Timestamp("2026-10-04T00:04:59Z"),
            pd.Timestamp("2026-10-04T00:05:00Z"),
        ]
        x = align_completed_timeframes(d, f, rules={"M5": "5min"})
        self.assertTrue(pd.isna(x.loc[0, "M5_bar_start"]))
        self.assertEqual(x.loc[1, "M5_bar_start"], pd.Timestamp("2026-10-04T00:00:00Z"))

    def test_mtf_prefix_invariance(self):
        f = minute_frame(n=80)
        cut = pd.Timestamp("2026-10-04T00:50:00Z")
        full = align_completed_timeframes([cut], f, rules={"M5": "5min", "M15": "15min"})
        prefix = align_completed_timeframes(
            [cut], f[f["time"] < cut], rules={"M5": "5min", "M15": "15min"}
        )
        for col in full.columns:
            if col == "decision_time":
                continue
            a, b = full.loc[0, col], prefix.loc[0, col]
            if pd.isna(a) and pd.isna(b):
                continue
            self.assertEqual(a, b, col)


class LiquidityTests(unittest.TestCase):
    def test_current_bar_cannot_define_prior_level(self):
        f = minute_frame(n=10)
        f.loc[5, "high"] = 999.0
        m = rolling_liquidity_map(f, lookback=5)
        self.assertLess(m.loc[5, "prior_liquidity_high"], 999.0)
        self.assertEqual(m.loc[6, "prior_liquidity_high"], 999.0)

    def test_liquidity_prefix_invariance(self):
        rng = np.random.default_rng(1)
        c = 100 + np.cumsum(rng.normal(size=100))
        f = pd.DataFrame({"high": c + 1, "low": c - 1, "close": c})
        cut = 70
        a = rolling_liquidity_map(f, lookback=24).iloc[cut - 1]
        b = rolling_liquidity_map(f.iloc[:cut], lookback=24).iloc[-1]
        pd.testing.assert_series_equal(a, b, check_names=False)


class SessionNarrativeTests(unittest.TestCase):
    def test_previous_session_is_completed_only(self):
        t = pd.to_datetime([
            "2026-10-04T06:58:00Z",
            "2026-10-04T06:59:00Z",
            "2026-10-04T07:00:00Z",
            "2026-10-04T07:01:00Z",
        ], utc=True)
        f = pd.DataFrame({
            "time": t,
            "open": [100, 101, 102, 103],
            "high": [102, 103, 104, 105],
            "low": [99, 100, 101, 102],
            "close": [101, 102, 103, 104],
        })
        x = session_narrative_frame(f)
        self.assertTrue(pd.isna(x.loc[1, "prev_session_high"]))
        self.assertEqual(x.loc[2, "prev_session_high"], 103)
        self.assertEqual(x.loc[3, "prev_session_high"], 103)

    def test_session_cumulative_high_has_no_future_leak(self):
        f = minute_frame(start="2026-10-04T07:00:00Z", n=20)
        f.loc[15, "high"] = 999.0
        x = session_narrative_frame(f)
        self.assertLess(x.loc[10, "session_high_so_far"], 999.0)
        self.assertEqual(x.loc[15, "session_high_so_far"], 999.0)


if __name__ == "__main__":
    unittest.main()
