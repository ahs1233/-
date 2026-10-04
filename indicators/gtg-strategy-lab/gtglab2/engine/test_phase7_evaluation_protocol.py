from __future__ import annotations

import unittest

from action_contracts import SCALPER_V1, SWING_V1
from evaluation_protocol import (
    Episode,
    TimeBlock,
    assert_no_episode_overlap,
    cluster_overlapping_episodes,
    coverage_report,
    leave_one_source_out,
    purge_ms_for_contract,
    purged_train_test,
)


H = 3_600_000


class PurgeTests(unittest.TestCase):
    def test_purge_is_contract_derived(self):
        self.assertEqual(purge_ms_for_contract(SWING_V1), 25 * H)
        self.assertEqual(purge_ms_for_contract(SCALPER_V1), 13 * H)

    def test_near_test_training_episode_is_purged(self):
        eps = [
            Episode(0, 2*H, "LONG"),
            Episode(70*H, 79*H, "SHORT"),
            Episode(100*H, 102*H, "LONG"),
        ]
        train, test = purged_train_test(
            eps,
            train=TimeBlock(0, 90*H),
            test=TimeBlock(100*H, 120*H),
            purge_ms=25*H,
        )
        self.assertEqual(train, [eps[0]])
        self.assertEqual(test, [eps[2]])
        assert_no_episode_overlap(train, test)

    def test_rejects_overlapping_time_blocks(self):
        with self.assertRaises(ValueError):
            purged_train_test(
                [],
                train=TimeBlock(0, 100),
                test=TimeBlock(100, 200),
                purge_ms=0,
            )


class DependencyTests(unittest.TestCase):
    def test_overlap_clusters_reduce_effective_count(self):
        eps = [
            Episode(0, 10),
            Episode(5, 20),
            Episode(20, 30),
            Episode(40, 50),
        ]
        clusters = cluster_overlapping_episodes(eps)
        self.assertEqual(len(clusters), 2)
        self.assertEqual(clusters[0], TimeBlock(0, 30))

    def test_coverage_reports_episode_not_row_counts(self):
        eps = [
            Episode(0, 10, "LONG", "London", "TREND_UP", "x"),
            Episode(20, 30, "SHORT", "NewYork", "TREND_DOWN", "x"),
            Episode(25, 35, "SHORT", "NewYork", "TREND_DOWN", "x"),
        ]
        r = coverage_report(eps)
        self.assertEqual(r["episodes"], 3)
        self.assertEqual(r["dependency_clusters"], 2)
        self.assertEqual(r["by_side"]["SHORT"], 2)


class SourceAblationTests(unittest.TestCase):
    def test_leave_one_out_is_deterministic(self):
        x = leave_one_source_out(["Kraken", "Binance", "Bitfinex"])
        self.assertEqual(
            x["Binance"],
            ("Bitfinex", "Kraken"),
        )
        self.assertEqual(len(x), 3)

    def test_ablation_requires_redundancy(self):
        with self.assertRaises(ValueError):
            leave_one_source_out(["Binance"])


if __name__ == "__main__":
    unittest.main()
