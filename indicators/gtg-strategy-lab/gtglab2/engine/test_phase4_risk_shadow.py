from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from risk_controls import RiskLimits, RiskState, apply_close, can_open, reserve
from shadow_ledger import ShadowDecision, append_decision, read_ledger


class RiskGuardTests(unittest.TestCase):
    def limits(self):
        return RiskLimits(
            max_trade_r=1.0,
            max_session_loss_r=2.0,
            max_daily_loss_r=3.0,
            max_consecutive_losses=3,
            max_active_r=1.5,
        )

    def test_allows_inside_limits_and_blocks_active_r(self):
        lim = self.limits()
        s = RiskState(active_r=0.5)
        self.assertTrue(can_open(s, lim, 0.5).allowed)
        d = can_open(s, lim, 1.1)
        self.assertFalse(d.allowed)
        self.assertIn("trade_r_limit", d.reasons)

    def test_loss_guards(self):
        lim = self.limits()
        s = RiskState(session_realized_r=-2.0, daily_realized_r=-2.0)
        self.assertIn("session_loss_guard", can_open(s, lim, 0.5).reasons)
        s = RiskState(daily_realized_r=-3.0)
        self.assertIn("daily_loss_guard", can_open(s, lim, 0.5).reasons)
        s = RiskState(consecutive_losses=3)
        self.assertIn("consecutive_loss_guard", can_open(s, lim, 0.5).reasons)

    def test_reserve_and_close(self):
        s = reserve(RiskState(), 0.8)
        self.assertAlmostEqual(s.active_r, 0.8)
        s = apply_close(s, -0.4, 0.8)
        self.assertAlmostEqual(s.active_r, 0.0)
        self.assertEqual(s.consecutive_losses, 1)


class ShadowLedgerTests(unittest.TestCase):
    def test_append_only_decision_has_no_execution_or_outcome(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "shadow.jsonl"
            d = ShadowDecision(
                decision_time_utc="2026-10-04T10:00:00Z",
                candidate_version="candidate-x",
                symbol="XAUUSD",
                state="RANGE",
                strategy_mode="RANGE_SCALP",
                side="LONG",
                action="PROBE",
                planned_r=0.2,
                context_digest="abc",
                source_digest="def",
            )
            a = append_decision(p, d)
            b = append_decision(p, d)
            rows = read_ledger(p)
            self.assertEqual(len(rows), 2)
            self.assertFalse(a["order_executed"])
            self.assertFalse(a["outcome_attached"])
            self.assertEqual(a["decision_sha256"], b["decision_sha256"])


if __name__ == "__main__":
    unittest.main()
