import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from state_transition_handoff_v03 import (
    HORIZONS,
    MAX_CONTIG_GAP,
    STEP,
    post_resolution_outcomes,
    state_hash_from_csv,
)


class StateTransitionHandoffV03Tests(unittest.TestCase):
    def frame(self, n=40):
        x = np.arange(n)
        c = 1800.0 + x
        return pd.DataFrame({
            "t": 1577836800000 + x*STEP,
            "bo": c,
            "bh": c + 0.5,
            "bl": c - 0.5,
            "bc": c,
            "ao": c + 0.1,
            "ah": c + 0.6,
            "al": c - 0.4,
            "ac": c + 0.1,
            "atr": np.full(n, 2.0),
        })

    def test_long_resolution_scores_positive_on_rising_path(self):
        f = self.frame()
        out = post_resolution_outcomes(
            f, 10, 1,
            frozen_lower=float(f.bl.iloc[8]),
            frozen_upper=float(f.bh.iloc[9]),
        )
        self.assertTrue(out["h4_mature"])
        self.assertGreater(out["h4_signed_displacement_atr"], 0)
        self.assertTrue(out["h4_directional_correct"])

    def test_short_resolution_scores_negative_on_rising_path(self):
        f = self.frame()
        out = post_resolution_outcomes(
            f, 10, -1,
            frozen_lower=float(f.bl.iloc[8]),
            frozen_upper=float(f.bh.iloc[9]),
        )
        self.assertTrue(out["h4_mature"])
        self.assertLess(out["h4_signed_displacement_atr"], 0)
        self.assertFalse(out["h4_directional_correct"])

    def test_short_market_gap_is_accepted(self):
        f = self.frame()
        f.loc[11:, "t"] += STEP
        out = post_resolution_outcomes(
            f, 10, 1,
            frozen_lower=float(f.bl.iloc[8]),
            frozen_upper=float(f.bh.iloc[9]),
        )
        self.assertTrue(out["h1_mature"])
        self.assertEqual(out["h1_elapsed_wall_hours"], 2.0)

    def test_long_market_gap_is_rejected(self):
        f = self.frame()
        f.loc[11:, "t"] += 4*STEP
        out = post_resolution_outcomes(
            f, 10, 1,
            frozen_lower=float(f.bl.iloc[8]),
            frozen_upper=float(f.bh.iloc[9]),
        )
        self.assertFalse(out["h1_mature"])
        self.assertFalse(out["h4_mature"])

    def test_state_hash_matches_freeze_algorithm(self):
        states = pd.DataFrame({"state": ["RANGE", np.nan, "TREND_UP", "TRANSITION"]})
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "states.csv.gz"
            states.to_csv(p, index=False, compression="gzip")
            got = state_hash_from_csv(p)

        import hashlib
        expected = hashlib.sha256(
            "RANGE\n\nTREND_UP\nTRANSITION".encode()
        ).hexdigest()
        self.assertEqual(got, expected)


if __name__ == "__main__":
    unittest.main(verbosity=2)
