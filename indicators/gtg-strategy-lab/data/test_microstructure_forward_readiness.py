import unittest
from pathlib import Path
from unittest.mock import patch

import microstructure_forward_readiness as r


class ReadinessGateTests(unittest.TestCase):
    def quality(self, count=10000, first="2026-10-01T00:00:00+00:00", last="2026-10-31T00:00:00+00:00"):
        return {
            "status": "PASS",
            "capture_count": count,
            "grade_counts": {"fusion_grade": max(0, count - 3), "single_source_grade": min(3, count)},
            "source_available_counts": {
                "bitfinex_xaut": count,
                "binance_xau_perp": max(0, count - 2),
                "kraken_paxg_spot": max(0, count - 3),
            },
            "first_capture": first,
            "last_capture": last,
        }

    def rows(self, times):
        return [{"capture_received_utc": x} for x in times]

    @patch.object(r, "read_manifest")
    @patch.object(r, "audit_quality")
    def test_registered_gates_require_both_time_and_count(self, aq, rm):
        aq.return_value = self.quality()
        rm.return_value = self.rows([
            "2026-10-01T00:00:00+00:00",
            "2026-10-01T00:01:00+00:00",
            "2026-10-31T00:00:00+00:00",
        ])
        report = r.build_readiness(Path("unused"))
        self.assertTrue(report["gates"]["elapsed_time_gate"])
        self.assertTrue(report["gates"]["snapshot_count_gate"])
        self.assertTrue(report["eligible_now"])
        self.assertEqual(report["status"], "ELIGIBLE")

    @patch.object(r, "read_manifest")
    @patch.object(r, "audit_quality")
    def test_count_alone_does_not_unlock_research(self, aq, rm):
        aq.return_value = self.quality(last="2026-10-08T00:00:00+00:00")
        rm.return_value = self.rows([
            "2026-10-01T00:00:00+00:00",
            "2026-10-01T00:01:00+00:00",
        ])
        report = r.build_readiness(Path("unused"))
        self.assertTrue(report["gates"]["snapshot_count_gate"])
        self.assertFalse(report["gates"]["elapsed_time_gate"])
        self.assertFalse(report["eligible_now"])

    @patch.object(r, "read_manifest")
    @patch.object(r, "audit_quality")
    def test_time_alone_does_not_unlock_research(self, aq, rm):
        aq.return_value = self.quality(count=500)
        rm.return_value = self.rows([
            "2026-10-01T00:00:00+00:00",
            "2026-10-31T00:00:00+00:00",
        ])
        report = r.build_readiness(Path("unused"))
        self.assertTrue(report["gates"]["elapsed_time_gate"])
        self.assertFalse(report["gates"]["snapshot_count_gate"])
        self.assertFalse(report["eligible_now"])
        self.assertEqual(report["progress"]["snapshots_remaining"], 9500)

    @patch.object(r, "read_manifest")
    @patch.object(r, "audit_quality")
    def test_cadence_reports_gaps_without_changing_eligibility(self, aq, rm):
        aq.return_value = self.quality(count=3)
        rm.return_value = self.rows([
            "2026-10-01T00:00:00+00:00",
            "2026-10-01T00:01:00+00:00",
            "2026-10-01T00:10:00+00:00",
        ])
        report = r.build_readiness(Path("unused"))
        cadence = report["quality"]["cadence"]
        self.assertEqual(cadence["gaps_over_90s"], 1)
        self.assertEqual(cadence["gaps_over_300s"], 1)
        self.assertEqual(cadence["max_gap_seconds"], 540.0)

    @patch.object(r, "audit_quality")
    def test_integrity_failure_blocks_gate(self, aq):
        aq.return_value = {"status": "FAIL_INTEGRITY"}
        report = r.build_readiness(Path("unused"))
        self.assertEqual(report["status"], "BLOCKED")
        self.assertFalse(report["eligible_now"])
        self.assertFalse(report["historical_holdout_read"])
        self.assertFalse(report["pristine_price_oos_decoded"])
        self.assertFalse(report["trading_outcomes_read"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
