from __future__ import annotations

import unittest

from contracts import PositionBudget, Side
from execution import (
    ExecutionConfig,
    Quote,
    add_market_tranche,
    market_entry_price,
    market_exit_price,
    pnl_from_fills,
    single_entry_round_trip,
)
from inventory import InventoryState
from metrics import scaled_vs_single, summarize_episode_returns


class ExecutionTests(unittest.TestCase):
    def test_long_uses_ask_to_enter_bid_to_exit(self):
        q = Quote(99.9, 100.1)
        self.assertEqual(market_entry_price(Side.LONG, q, ExecutionConfig()), 100.1)
        self.assertEqual(market_exit_price(Side.LONG, q, ExecutionConfig()), 99.9)

    def test_short_uses_bid_to_enter_ask_to_exit(self):
        q = Quote(99.9, 100.1)
        self.assertEqual(market_entry_price(Side.SHORT, q, ExecutionConfig()), 99.9)
        self.assertEqual(market_exit_price(Side.SHORT, q, ExecutionConfig()), 100.1)

    def test_slippage_hurts_both_directions(self):
        q = Quote(99.9, 100.1)
        cfg = ExecutionConfig(slippage_price=0.2)
        self.assertEqual(market_entry_price(Side.LONG, q, cfg), 100.3)
        self.assertEqual(market_exit_price(Side.LONG, q, cfg), 99.7)
        self.assertEqual(market_entry_price(Side.SHORT, q, cfg), 99.7)
        self.assertEqual(market_exit_price(Side.SHORT, q, cfg), 100.3)

    def test_known_long_round_trip(self):
        r = single_entry_round_trip(
            Side.LONG,
            units=0.10,
            entry_quote=Quote(100, 100),
            exit_quote=Quote(101, 101),
        )
        self.assertAlmostEqual(r["gross_price_units"], 0.10)

    def test_known_short_round_trip(self):
        r = single_entry_round_trip(
            Side.SHORT,
            units=0.10,
            entry_quote=Quote(100, 100),
            exit_quote=Quote(99, 99),
        )
        self.assertAlmostEqual(r["gross_price_units"], 0.10)

    def test_scaled_entry_same_total_units(self):
        inv = InventoryState(Side.LONG, PositionBudget(0.10, 5))
        for p in (100, 99, 98, 97, 96):
            add_market_tranche(inv, Quote(p, p))
        r = pnl_from_fills(Side.LONG, inv.fills, Quote(101, 101))
        self.assertAlmostEqual(r["units"], 0.10)
        self.assertAlmostEqual(r["average_entry"], 98.0)
        self.assertAlmostEqual(r["gross_price_units"], 0.30)

    def test_spread_cost_is_directionally_symmetric(self):
        long = single_entry_round_trip(
            Side.LONG,
            units=1,
            entry_quote=Quote(99.9, 100.1),
            exit_quote=Quote(99.9, 100.1),
        )
        short = single_entry_round_trip(
            Side.SHORT,
            units=1,
            entry_quote=Quote(99.9, 100.1),
            exit_quote=Quote(99.9, 100.1),
        )
        self.assertAlmostEqual(long["gross_price_units"], -0.2)
        self.assertAlmostEqual(short["gross_price_units"], -0.2)


class MetricsTests(unittest.TestCase):
    def test_episode_summary(self):
        s = summarize_episode_returns([1, -0.5, 2, -0.5])
        self.assertEqual(s["n"], 4)
        self.assertAlmostEqual(s["mean"], 0.5)
        self.assertAlmostEqual(s["win_rate"], 0.5)
        self.assertAlmostEqual(s["profit_factor"], 3.0)

    def test_scaled_vs_single(self):
        x = scaled_vs_single(0.3, 0.1)
        self.assertAlmostEqual(x["incremental_pnl"], 0.2)


if __name__ == "__main__":
    unittest.main()
