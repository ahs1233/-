from __future__ import annotations

import unittest

from contracts import Side
from forward_microstructure_gate import (
    MicroAlignment,
    classify_source_votes,
    evidence_from_source_votes,
    leave_one_source_out_alignments,
)
from metrics import (
    EpisodeOutcome,
    paired_incremental_summary,
    summarize_execution_episodes,
)


class SourceVoteAblationTests(unittest.TestCase):
    def test_source_family_count_is_preserved(self):
        e = evidence_from_source_votes({
            "binance": (1, 0),
            "kraken": (1,),
            "bitfinex": (-1,),
        })
        self.assertEqual(e.ready_families, 3)
        self.assertEqual(e.votes, (1, 0, -1, 1))

    def test_alignment_is_long_short_symmetric(self):
        votes = {"binance": (1,), "kraken": (1,), "bitfinex": (-1,)}
        self.assertEqual(classify_source_votes(Side.LONG, votes), MicroAlignment.ALIGNED)
        self.assertEqual(classify_source_votes(Side.SHORT, votes), MicroAlignment.OPPOSED)

    def test_leave_one_source_out_is_deterministic(self):
        votes = {"binance": (1,), "kraken": (1,), "bitfinex": (-1,)}
        out = leave_one_source_out_alignments(Side.LONG, votes)
        self.assertEqual(tuple(out), ("binance", "bitfinex", "kraken"))
        self.assertEqual(out["bitfinex"], MicroAlignment.ALIGNED)


class EpisodeMetricTests(unittest.TestCase):
    def test_execution_summary_reports_risk_and_breakdowns(self):
        rows = [
            EpisodeOutcome("a", 0.5, 0.2, 0.8, 1.0, "LONG", "London", 3),
            EpisodeOutcome("b", -0.2, 0.6, 0.3, 0.5, "SHORT", "NewYork", 5),
        ]
        r = summarize_execution_episodes(rows)
        self.assertEqual(r["n"], 2)
        self.assertAlmostEqual(r["mean"], 0.15)
        self.assertAlmostEqual(r["mean_used_r"], 0.75)
        self.assertAlmostEqual(r["pnl_per_used_r"], 0.3 / 1.5)
        self.assertEqual(r["by_side_mean_pnl_r"]["LONG"], 0.5)
        self.assertEqual(r["mean_time_to_invalidation_bars"], 4.0)

    def test_paired_incremental_is_shared_episode_only(self):
        b = [
            EpisodeOutcome("a", 0.1, 0.1, 0.2, 1.0),
            EpisodeOutcome("b", -0.2, 0.3, 0.1, 1.0),
        ]
        t = [
            EpisodeOutcome("a", 0.3, 0.1, 0.4, 1.0),
            EpisodeOutcome("c", 9.0, 0.1, 9.0, 1.0),
        ]
        r = paired_incremental_summary(b, t)
        self.assertEqual(r["paired_n"], 1)
        self.assertAlmostEqual(r["mean_incremental_pnl_r"], 0.2)
        self.assertEqual(r["treatment_better_fraction"], 1.0)

    def test_duplicate_episode_ids_are_rejected(self):
        x = EpisodeOutcome("a", 0.1, 0.1, 0.2, 1.0)
        with self.assertRaises(ValueError):
            paired_incremental_summary([x, x], [x])


if __name__ == "__main__":
    unittest.main()

