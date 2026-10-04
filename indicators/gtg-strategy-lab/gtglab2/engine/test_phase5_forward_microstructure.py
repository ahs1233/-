from __future__ import annotations

import unittest

from contracts import Side
from forward_microstructure_gate import MicroAlignment, MicroEvidence, classify_alignment, treatment_action


class ForwardMicrostructureGateTests(unittest.TestCase):
    def test_requires_two_ready_families(self):
        e = MicroEvidence(ready_families=1, votes=(1, 1))
        self.assertEqual(classify_alignment(Side.LONG, e), MicroAlignment.INSUFFICIENT)

    def test_long_short_symmetry(self):
        pos = MicroEvidence(ready_families=3, votes=(1, 1, -1))
        neg = MicroEvidence(ready_families=3, votes=(-1, -1, 1))
        self.assertEqual(classify_alignment(Side.LONG, pos), MicroAlignment.ALIGNED)
        self.assertEqual(classify_alignment(Side.SHORT, neg), MicroAlignment.ALIGNED)
        self.assertEqual(classify_alignment(Side.LONG, neg), MicroAlignment.OPPOSED)
        self.assertEqual(classify_alignment(Side.SHORT, pos), MicroAlignment.OPPOSED)

    def test_mixed_does_not_force_trade_change(self):
        e = MicroEvidence(ready_families=2, votes=(1, -1))
        self.assertEqual(classify_alignment(Side.LONG, e), MicroAlignment.MIXED)
        self.assertEqual(treatment_action(Side.LONG, e), "BASELINE_UNCHANGED")

    def test_invalid_vote_rejected(self):
        with self.assertRaises(ValueError):
            MicroEvidence(ready_families=2, votes=(2,))

if __name__ == "__main__":
    unittest.main()
