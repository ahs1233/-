from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from contracts import (
    Action,
    MarketState,
    PositionBudget,
    Side,
    TIMEFRAME_ROLES,
    TimeframeRole,
    mirror_side,
    mirror_state,
    natural_side_for_state,
)
from context_features import EMA_LENGTHS, ma_geometry_frame, session_bucket_utc


class ContractTests(unittest.TestCase):
    def test_timeframe_roles(self):
        self.assertEqual(TIMEFRAME_ROLES["D1"], TimeframeRole.MACRO_CONTEXT)
        self.assertEqual(TIMEFRAME_ROLES["H4"], TimeframeRole.STRUCTURAL_CONTEXT)
        self.assertEqual(TIMEFRAME_ROLES["H1"], TimeframeRole.OPERATIONAL_STATE)
        self.assertEqual(TIMEFRAME_ROLES["M15"], TimeframeRole.SETUP)
        self.assertEqual(TIMEFRAME_ROLES["M5"], TimeframeRole.SETUP)
        self.assertEqual(TIMEFRAME_ROLES["M1"], TimeframeRole.TRIGGER)

    def test_bidirectional_state_symmetry(self):
        self.assertEqual(mirror_state(MarketState.TREND_UP), MarketState.TREND_DOWN)
        self.assertEqual(mirror_state(MarketState.TREND_DOWN), MarketState.TREND_UP)
        self.assertEqual(mirror_state(MarketState.RANGE), MarketState.RANGE)
        self.assertEqual(mirror_side(Side.LONG), Side.SHORT)
        self.assertEqual(mirror_side(Side.SHORT), Side.LONG)

    def test_natural_trend_side_only(self):
        self.assertEqual(natural_side_for_state(MarketState.TREND_UP), Side.LONG)
        self.assertEqual(natural_side_for_state(MarketState.TREND_DOWN), Side.SHORT)
        self.assertEqual(natural_side_for_state(MarketState.RANGE), Side.FLAT)
        self.assertEqual(natural_side_for_state(MarketState.TRANSITION), Side.FLAT)

    def test_fixed_budget_equal_tranches(self):
        b = PositionBudget(total_units=0.10, tranches=5)
        self.assertAlmostEqual(b.equal_tranche_units, 0.02)
        self.assertAlmostEqual(b.equal_tranche_units * b.tranches, b.total_units)

    def test_actions_include_invalidation_path(self):
        self.assertIn(Action.EXIT, set(Action))
        self.assertIn(Action.FLIP_WAIT, set(Action))


class SessionTests(unittest.TestCase):
    def test_inherited_session_bucket_boundaries(self):
        cases = {
            "2026-10-04T00:00:00Z": "Asia",
            "2026-10-04T06:59:00Z": "Asia",
            "2026-10-04T07:00:00Z": "London",
            "2026-10-04T12:59:00Z": "London",
            "2026-10-04T13:00:00Z": "New York",
            "2026-10-04T20:59:00Z": "New York",
            "2026-10-04T21:00:00Z": "Late",
            "2026-10-04T23:59:00Z": "Late",
        }
        for ts, expected in cases.items():
            with self.subTest(ts=ts):
                self.assertEqual(session_bucket_utc(ts), expected)


class MAGeometryTests(unittest.TestCase):
    def test_expected_columns_exist(self):
        c = pd.Series(np.linspace(100.0, 120.0, 1200))
        g = ma_geometry_frame(c)
        for n in EMA_LENGTHS:
            self.assertIn(f"ema_{n}", g.columns)
            self.assertIn(f"price_minus_ema_{n}", g.columns)
            self.assertIn(f"ema_{n}_slope1", g.columns)
        self.assertIn("ema_stack_score", g.columns)
        self.assertIn("ema_family_dispersion", g.columns)

    def test_long_short_price_mirror_symmetry(self):
        up = pd.Series(np.linspace(100.0, 140.0, 1200))
        pivot = 250.0
        down = 2 * pivot - up
        a = ma_geometry_frame(up)
        b = ma_geometry_frame(down)
        i = -1
        for n in EMA_LENGTHS:
            self.assertAlmostEqual(
                float(a[f"price_minus_ema_{n}"].iloc[i]),
                -float(b[f"price_minus_ema_{n}"].iloc[i]),
                places=10,
            )
            self.assertAlmostEqual(
                float(a[f"ema_{n}_slope1"].iloc[i]),
                -float(b[f"ema_{n}_slope1"].iloc[i]),
                places=10,
            )
        self.assertAlmostEqual(
            float(a["ema_stack_score"].iloc[i]),
            -float(b["ema_stack_score"].iloc[i]),
        )

    def test_prefix_invariance_no_future_leakage(self):
        rng = np.random.default_rng(7)
        full = pd.Series(2000.0 + np.cumsum(rng.normal(0, 1, 1500)))
        cut = 1100
        g_full = ma_geometry_frame(full)
        g_prefix = ma_geometry_frame(full.iloc[:cut])
        cols = [c for c in g_prefix.columns if c != "close"]
        for col in cols:
            av = float(g_full[col].iloc[cut - 1])
            bv = float(g_prefix[col].iloc[-1])
            if np.isnan(av) and np.isnan(bv):
                continue
            self.assertAlmostEqual(av, bv, places=12, msg=col)


if __name__ == "__main__":
    unittest.main()
