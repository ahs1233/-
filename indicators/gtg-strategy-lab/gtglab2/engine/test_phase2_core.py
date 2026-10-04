from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from contracts import Side
from execution import CostModel, entry_fill, exit_fill, net_pnl_points
from invalidation import BreakEvidence, BreakResolution, InvalidationEvidence, is_invalidated, resolve_break
from inventory import InventoryEngine, InventoryState, RiskPlan
from liquidity import liquidity_map_frame
from mtf_context import latest_completed_asof
from session_context import primary_session, session_narrative_frame


class SessionNarrativeTests(unittest.TestCase):
    def _frame(self, n=80):
        t0 = pd.Timestamp("2026-03-27T00:00:00Z").value // 1_000_000
        t = t0 + np.arange(n) * 3_600_000
        x = 2000 + np.sin(np.arange(n) / 5)
        return pd.DataFrame({"t": t, "bo": x, "bh": x + 1, "bl": x - 1, "bc": x + 0.2, "atr": 2.0})

    def test_dst_aware_sessions(self):
        self.assertEqual(primary_session("2026-01-15T09:00:00Z"), "London")
        self.assertIn(primary_session("2026-07-15T13:00:00Z"), {"London_NewYork", "NewYork"})

    def test_prefix_invariance(self):
        f = self._frame()
        cut = 55
        a = session_narrative_frame(f)
        b = session_narrative_frame(f.iloc[:cut])
        cols = [c for c in b.columns if c != "prev_session_label"]
        for c in cols:
            av = a[c].iloc[cut-1]
            bv = b[c].iloc[-1]
            if pd.isna(av) and pd.isna(bv):
                continue
            self.assertEqual(av, bv, c)


class LiquidityTests(unittest.TestCase):
    def test_prefix_invariance(self):
        n = 120
        x = 1900 + np.cumsum(np.random.default_rng(2).normal(0, 1, n))
        f = pd.DataFrame({"bh": x + 1, "bl": x - 1, "bc": x, "atr": 3.0})
        cut = 90
        a = liquidity_map_frame(f)
        b = liquidity_map_frame(f.iloc[:cut])
        for c in b.columns:
            av, bv = a[c].iloc[cut-1], b[c].iloc[-1]
            if pd.isna(av) and pd.isna(bv):
                continue
            self.assertAlmostEqual(float(av), float(bv), places=12, msg=c)


class MTFTests(unittest.TestCase):
    def test_only_completed_bar_is_visible(self):
        h4 = pd.DataFrame({"t": [0, 4*3_600_000], "v": [1.0, 2.0]})
        d = latest_completed_asof(pd.Series([4*3_600_000, 7*3_600_000]), h4, "H4", ["v"])
        self.assertEqual(float(d["v"].iloc[0]), 1.0)
        self.assertEqual(float(d["v"].iloc[1]), 1.0)


class InventoryTests(unittest.TestCase):
    def test_fixed_risk_and_no_add_after_invalidation(self):
        eng = InventoryEngine(RiskPlan())
        s = InventoryState()
        for i in range(5):
            s, _ = eng.add(s, Side.LONG, 2000-i, hypothesis_valid=True)
        self.assertAlmostEqual(s.risk_committed_r, 1.0)
        s2, _ = eng.add(s, Side.LONG, 1900, hypothesis_valid=True)
        self.assertEqual(s2, s)
        s, _ = eng.invalidate(s)
        s2, _ = eng.add(s, Side.LONG, 1800, hypothesis_valid=True)
        self.assertEqual(s2, s)

    def test_long_short_price_average_symmetry(self):
        eng = InventoryEngine(RiskPlan())
        a = InventoryState(); b = InventoryState()
        prices = [100, 99, 98]
        for p in prices:
            a, _ = eng.add(a, Side.LONG, p, hypothesis_valid=True)
            b, _ = eng.add(b, Side.SHORT, 200-p, hypothesis_valid=True)
        self.assertAlmostEqual(a.average_price + b.average_price, 200.0)


class InvalidationTests(unittest.TestCase):
    def test_break_resolution(self):
        self.assertEqual(resolve_break(BreakEvidence(True, True, False, False, False)), BreakResolution.REJECTION)
        self.assertEqual(resolve_break(BreakEvidence(True, False, True, True, True)), BreakResolution.ACCEPTANCE)
        self.assertTrue(is_invalidated(InvalidationEvidence(opposite_acceptance=True)))
        self.assertFalse(is_invalidated(InvalidationEvidence(flow_against=True)))


class ExecutionTests(unittest.TestCase):
    def test_bid_ask_long_short_symmetry(self):
        bar = {"bo": 100.0, "ao": 100.2}
        nxt = {"bo": 101.0, "ao": 101.2}
        c = CostModel(slippage_bps=0, fee_bps=0)
        le = entry_fill(bar, Side.LONG, c)
        lx = exit_fill(nxt, Side.LONG, c)
        se = entry_fill(nxt, Side.SHORT, c)
        sx = exit_fill(bar, Side.SHORT, c)
        self.assertAlmostEqual(net_pnl_points(le, lx, Side.LONG, c), 0.8)
        self.assertAlmostEqual(net_pnl_points(se, sx, Side.SHORT, c), 0.8)


if __name__ == "__main__":
    unittest.main()
