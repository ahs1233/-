import unittest
from datetime import datetime, timezone

from audit_microstructure_quality import classify


class MicrostructureQualityTests(unittest.TestCase):
    def capture_time(self):
        return datetime(2026, 10, 4, 0, 0, tzinfo=timezone.utc)

    def venue(self, name, family, latest, status="ready"):
        return {
            "venue": name,
            "source_family": family,
            "status": status,
            "observed_at": "2026-10-04T00:00:00+00:00",
            "trade_tape": {
                "latest_trade_at": latest,
                "trade_count": 100,
                "coverage_seconds": 3600,
            },
            "quality": {"freshness": 1.0, "freshness_state": "fresh", "raw_weight": 0.7},
            "flow": {"5m": {"coverage_complete": True, "trade_count": 10}},
        }

    def test_two_independent_ready_sources_are_fusion_grade(self):
        p = {
            "status": "ready",
            "independent_source_count": 2,
            "venue_count": 2,
            "venues": [
                self.venue("a", "a", "2026-10-03T23:59:30+00:00"),
                self.venue("b", "b", "2026-10-03T23:59:20+00:00"),
            ],
        }
        self.assertEqual(classify(p, self.capture_time())["grade"], "fusion_grade")

    def test_one_source_is_single_source_grade(self):
        p = {
            "status": "degraded",
            "independent_source_count": 1,
            "venue_count": 1,
            "venues": [self.venue("a", "a", "2026-10-03T23:59:30+00:00")],
        }
        self.assertEqual(classify(p, self.capture_time())["grade"], "single_source_grade")

    def test_old_trade_is_not_ready_source(self):
        p = {
            "status": "degraded",
            "independent_source_count": 1,
            "venue_count": 1,
            "venues": [self.venue("a", "a", "2026-10-03T23:00:00+00:00")],
        }
        q = classify(p, self.capture_time())
        self.assertEqual(q["grade"], "degraded_or_stale")
        self.assertEqual(q["stale_source_count"], 1)

    def test_missing_executed_trade_evidence_is_not_ready(self):
        v = self.venue("a", "a", None)
        p = {
            "status": "ready",
            "independent_source_count": 1,
            "venue_count": 1,
            "venues": [v],
        }
        q = classify(p, self.capture_time())
        self.assertEqual(q["grade"], "degraded_or_stale")
        self.assertEqual(q["ready_source_count"], 0)

    def test_fusion_requires_distinct_ready_source_families(self):
        p = {
            "status": "degraded",
            "independent_source_count": 2,
            "venue_count": 3,
            "venues": [
                self.venue("okx-a", "okx", "2026-10-03T23:59:30+00:00"),
                self.venue("okx-b", "okx", "2026-10-03T23:59:20+00:00"),
                self.venue("binance", "binance", "2026-10-03T23:00:00+00:00"),
            ],
        }
        q = classify(p, self.capture_time())
        self.assertEqual(q["grade"], "single_source_grade")
        self.assertEqual(q["ready_source_family_count"], 1)
        self.assertEqual(q["ready_source_families"], ["okx"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
