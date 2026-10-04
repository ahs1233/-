from __future__ import annotations

import unittest

from forward_gatekeeper import evaluate


REG = {
    "candidates": {
        "x": {
            "forward_microstructure_test_eligible": True,
            "historical_holdout_eligible": False,
        }
    }
}


def micro(ok=True):
    return {
        "eligible_now": ok,
        "gates": {
            "integrity_pass": True,
            "elapsed_time_gate": ok,
            "snapshot_count_gate": ok,
        },
    }


class ForwardGatekeeperTests(unittest.TestCase):
    def test_unlocks_only_when_every_gate_passes(self):
        r = evaluate(micro(True), {"status": "PASS"}, {"status": "PASS"}, REG, "x")
        self.assertTrue(r["eligible_for_outcome_linkage"])
        self.assertFalse(r["historical_holdout_allowed"])
        self.assertFalse(r["production_execution_allowed"])

    def test_time_gate_blocks(self):
        m = micro(True)
        m["gates"]["elapsed_time_gate"] = False
        m["eligible_now"] = False
        r = evaluate(m, {"status": "PASS"}, {"status": "PASS"}, REG, "x")
        self.assertFalse(r["eligible_for_outcome_linkage"])
        self.assertIn("30-calendar-day corpus gate is not met", r["reasons"])

    def test_freshness_blocks_even_with_mature_microstructure(self):
        r = evaluate(
            micro(True),
            {"status": "PASS"},
            {"status": "BLOCKED_MISSING_JFOREX_EXPORT"},
            REG,
            "x",
        )
        self.assertFalse(r["eligible_for_outcome_linkage"])
        self.assertIn("canonical forward exporter is not caught up", r["reasons"])

    def test_unregistered_candidate_fails_closed(self):
        r = evaluate(micro(True), {"status": "PASS"}, {"status": "PASS"}, REG, "missing")
        self.assertFalse(r["eligible_for_outcome_linkage"])


if __name__ == "__main__":
    unittest.main()
