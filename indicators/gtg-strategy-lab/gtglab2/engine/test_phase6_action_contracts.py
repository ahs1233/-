from __future__ import annotations

import unittest

from contracts import Side
from invalidation import BreakResolution
from action_contracts import (
    BreakDirection,
    ContractKind,
    SCALPER_V1,
    SWING_V1,
    ScalperInvalidation,
    SetupEvidence,
    SwingInvalidation,
    can_add_tranche,
    scalper_invalidated,
    setup_side,
    side_for_break,
    swing_invalidated,
)


class ContractShapeTests(unittest.TestCase):
    def test_fixed_risk_envelope(self):
        self.assertAlmostEqual(SWING_V1.total_r, 1.0)
        self.assertAlmostEqual(SCALPER_V1.total_r, 1.0)
        self.assertEqual(SWING_V1.max_tranches, 5)
        self.assertEqual(SCALPER_V1.max_tranches, 5)

    def test_registered_timeouts(self):
        self.assertEqual(SWING_V1.timeout_h1_bars, 24)
        self.assertEqual(SCALPER_V1.timeout_h1_bars, 12)
        self.assertEqual(SWING_V1.fill_delay_h1_bars, 1)
        self.assertEqual(SCALPER_V1.fill_delay_h1_bars, 1)

    def test_long_short_mirror(self):
        self.assertEqual(side_for_break(ContractKind.SWING_V1, BreakDirection.UP), Side.LONG)
        self.assertEqual(side_for_break(ContractKind.SWING_V1, BreakDirection.DOWN), Side.SHORT)
        self.assertEqual(side_for_break(ContractKind.SCALPER_V1, BreakDirection.UP), Side.SHORT)
        self.assertEqual(side_for_break(ContractKind.SCALPER_V1, BreakDirection.DOWN), Side.LONG)


class SetupTests(unittest.TestCase):
    def test_swing_requires_acceptance_retest_and_mtf(self):
        ok = SetupEvidence(ContractKind.SWING_V1, BreakDirection.UP, BreakResolution.ACCEPTANCE, 1, True)
        self.assertEqual(setup_side(ok), Side.LONG)
        self.assertEqual(setup_side(SetupEvidence(ContractKind.SWING_V1, BreakDirection.UP, BreakResolution.ACCEPTANCE, 1, False)), Side.FLAT)
        self.assertEqual(setup_side(SetupEvidence(ContractKind.SWING_V1, BreakDirection.UP, BreakResolution.ACCEPTANCE, -1, True)), Side.FLAT)
        self.assertEqual(setup_side(SetupEvidence(ContractKind.SWING_V1, BreakDirection.UP, BreakResolution.REJECTION, 1, True)), Side.FLAT)

    def test_swing_short_symmetry(self):
        ok = SetupEvidence(ContractKind.SWING_V1, BreakDirection.DOWN, BreakResolution.ACCEPTANCE, -1, True)
        self.assertEqual(setup_side(ok), Side.SHORT)

    def test_scalper_rejection_symmetry(self):
        self.assertEqual(
            setup_side(SetupEvidence(ContractKind.SCALPER_V1, BreakDirection.UP, BreakResolution.REJECTION, 1)),
            Side.SHORT,
        )
        self.assertEqual(
            setup_side(SetupEvidence(ContractKind.SCALPER_V1, BreakDirection.DOWN, BreakResolution.REJECTION, -1)),
            Side.LONG,
        )


class InventoryRulesTests(unittest.TestCase):
    def test_no_add_without_new_evidence_or_after_invalid(self):
        self.assertFalse(can_add_tranche(SWING_V1, tranches_filled=1, hypothesis_valid=False, new_registered_evidence=True))
        self.assertFalse(can_add_tranche(SWING_V1, tranches_filled=1, hypothesis_valid=True, new_registered_evidence=False))
        self.assertFalse(can_add_tranche(SWING_V1, tranches_filled=5, hypothesis_valid=True, new_registered_evidence=True))
        self.assertTrue(can_add_tranche(SWING_V1, tranches_filled=4, hypothesis_valid=True, new_registered_evidence=True))

    def test_invalidation_is_explicit(self):
        self.assertTrue(swing_invalidated(SwingInvalidation(opposite_trend=True)))
        self.assertTrue(swing_invalidated(SwingInvalidation(two_closes_back_inside=True)))
        self.assertFalse(swing_invalidated(SwingInvalidation()))
        self.assertTrue(scalper_invalidated(ScalperInvalidation(trend_in_original_break_direction=True)))
        self.assertTrue(scalper_invalidated(ScalperInvalidation(two_closes_outside_again=True)))
        self.assertFalse(scalper_invalidated(ScalperInvalidation()))


if __name__ == "__main__":
    unittest.main()
