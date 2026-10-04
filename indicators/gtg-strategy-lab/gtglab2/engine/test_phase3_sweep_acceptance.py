from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sweep_acceptance_v01 import discover_breaks


class SweepAcceptanceDiscoveryTests(unittest.TestCase):
    def frame(self):
        n = 24
        f = pd.DataFrame({
            "t": np.arange(n, dtype=np.int64) * 3_600_000,
            "state": ["RANGE"] * n,
            "prior24_upper": [101.0] * n,
            "prior24_lower": [99.0] * n,
            "bh": [100.5] * n,
            "bl": [99.5] * n,
            "bc": [100.0] * n,
        })
        return f

    def test_up_sweep_reclaim_is_rejection_short(self):
        f = self.frame()
        f.loc[2, "state"] = "TRANSITION"
        f.loc[2, ["bh", "bc"]] = [101.4, 101.2]
        f.loc[3, "state"] = "TRANSITION"
        f.loc[3, "bc"] = 100.8
        events, counts = discover_breaks(f)
        self.assertEqual(counts["rejection"], 1)
        self.assertEqual(events[0]["resolution"], "REJECTION")
        self.assertEqual(events[0]["side"].value, "SHORT")
        self.assertEqual(events[0]["signal_idx"], 3)

    def test_up_acceptance_requires_retest_hold(self):
        f = self.frame()
        f.loc[2, "state"] = "TRANSITION"
        f.loc[2, ["bh", "bc"]] = [101.4, 101.2]
        f.loc[3, "state"] = "TRANSITION"
        f.loc[3, ["bh", "bl", "bc"]] = [101.5, 101.1, 101.3]
        f.loc[4, "state"] = "TREND_UP"
        f.loc[4, ["bh", "bl", "bc"]] = [101.6, 100.9, 101.2]
        events, counts = discover_breaks(f)
        self.assertEqual(counts["acceptance"], 1)
        self.assertEqual(counts["acceptance_with_retest"], 1)
        self.assertEqual(events[0]["resolution"], "ACCEPTANCE")
        self.assertEqual(events[0]["side"].value, "LONG")
        self.assertEqual(events[0]["signal_idx"], 4)

    def test_ambiguous_two_sided_break_ignored(self):
        f = self.frame()
        f.loc[2, "state"] = "TRANSITION"
        f.loc[2, ["bh", "bl"]] = [101.4, 98.6]
        events, counts = discover_breaks(f)
        self.assertEqual(events, [])
        self.assertEqual(counts["ambiguous_two_sided"], 1)


if __name__ == "__main__":
    unittest.main()
