from __future__ import annotations

import unittest

from contracts import Action, MarketState, PositionBudget, Side
from inventory import InventoryState, InventoryStatus
from setup_policy import RangeLocation, candidate_side


class InventoryTests(unittest.TestCase):
    def test_five_equal_tranches_never_exceed_budget(self):
        inv = InventoryState(Side.LONG, PositionBudget(0.10, 5))
        actions = [inv.add_tranche(100 - i) for i in range(5)]
        self.assertEqual(actions[0], Action.PROBE)
        self.assertTrue(all(a is Action.ADD for a in actions[1:]))
        self.assertAlmostEqual(inv.units, 0.10)
        self.assertEqual(inv.tranche_count, 5)
        with self.assertRaises(RuntimeError):
            inv.add_tranche(94)

    def test_average_price(self):
        inv = InventoryState(Side.LONG, PositionBudget(0.10, 5))
        inv.add_tranche(100)
        inv.add_tranche(98)
        self.assertAlmostEqual(inv.average_price, 99.0)

    def test_invalidation_blocks_averaging(self):
        inv = InventoryState(Side.LONG, PositionBudget(0.10, 5))
        inv.add_tranche(100)
        action, units = inv.invalidate()
        self.assertEqual(action, Action.EXIT)
        self.assertAlmostEqual(units, 0.02)
        with self.assertRaises(RuntimeError):
            inv.add_tranche(99)

    def test_flip_wait_is_opposite_and_requires_invalidation(self):
        inv = InventoryState(Side.LONG, PositionBudget(0.10, 5))
        with self.assertRaises(RuntimeError):
            inv.enter_flip_wait()
        inv.add_tranche(100)
        inv.invalidate()
        action, side = inv.enter_flip_wait()
        self.assertEqual(action, Action.FLIP_WAIT)
        self.assertEqual(side, Side.SHORT)
        self.assertEqual(inv.status, InventoryStatus.FLIP_WAIT)

    def test_short_has_identical_budget_behavior(self):
        inv = InventoryState(Side.SHORT, PositionBudget(0.10, 5))
        for p in (100, 101, 102, 103, 104):
            inv.add_tranche(p)
        self.assertAlmostEqual(inv.units, 0.10)
        self.assertAlmostEqual(inv.average_price, 102.0)
        inv.invalidate()
        _, side = inv.enter_flip_wait()
        self.assertEqual(side, Side.LONG)


class SetupPolicyTests(unittest.TestCase):
    def test_range_is_bidirectional_by_location(self):
        self.assertEqual(
            candidate_side(MarketState.RANGE, range_location=RangeLocation.LOWER),
            Side.LONG,
        )
        self.assertEqual(
            candidate_side(MarketState.RANGE, range_location=RangeLocation.UPPER),
            Side.SHORT,
        )
        self.assertEqual(
            candidate_side(MarketState.RANGE, range_location=RangeLocation.MIDDLE),
            Side.FLAT,
        )

    def test_trend_is_bidirectional_by_state(self):
        self.assertEqual(candidate_side(MarketState.TREND_UP), Side.LONG)
        self.assertEqual(candidate_side(MarketState.TREND_DOWN), Side.SHORT)
        self.assertEqual(candidate_side(MarketState.TRANSITION), Side.FLAT)


if __name__ == "__main__":
    unittest.main()
