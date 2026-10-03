import unittest
import numpy as np
import pandas as pd

from state_transition_engine_v02 import STEP
from state_transition_handoff_v03 import trading_path_ok, outcome_at_resolution


class ConfirmedHandoffV03Tests(unittest.TestCase):
    def frame(self, n=40):
        x = np.arange(n)
        c = 1900.0 + x.astype(float)
        atr = np.full(n, 5.0)
        spread = np.full(n, 0.1)
        return pd.DataFrame({
            "t": 1577836800000 + x*STEP,
            "bo": c, "bh": c+0.5, "bl": c-0.5, "bc": c,
            "ao": c+spread, "ah": c+spread+0.5,
            "al": c+spread-0.5, "ac": c+spread,
            "atr": atr,
        })

    def test_trading_path_accepts_short_closure(self):
        f = self.frame()
        f.loc[11:, "t"] += STEP
        t = f.t.to_numpy(dtype=np.int64)
        self.assertTrue(trading_path_ok(t, 10, 1))
        self.assertTrue(trading_path_ok(t, 10, 4))

    def test_trading_path_rejects_long_gap(self):
        f = self.frame()
        f.loc[11:, "t"] += 4*STEP
        t = f.t.to_numpy(dtype=np.int64)
        self.assertFalse(trading_path_ok(t, 10, 1))
        self.assertFalse(trading_path_ok(t, 10, 4))

    def test_resolution_outcome_uses_resolution_bar(self):
        f = self.frame()
        e = {"frozen_upper": 1908.0, "frozen_lower": 1895.0}
        out = outcome_at_resolution(e, 10, 1, f)
        self.assertTrue(out["h4_mature"])
        self.assertAlmostEqual(out["h4_displacement_atr"], 0.8)
        self.assertAlmostEqual(out["h4_signed_displacement_atr"], 0.8)
        self.assertTrue(out["h4_directional_correct"])
        self.assertEqual(out["h4_elapsed_wall_hours"], 4.0)

    def test_short_direction_sign(self):
        f = self.frame()
        e = {"frozen_upper": 1915.0, "frozen_lower": 1905.0}
        out = outcome_at_resolution(e, 10, -1, f)
        self.assertTrue(out["h4_mature"])
        self.assertAlmostEqual(out["h4_signed_displacement_atr"], -0.8)
        self.assertFalse(out["h4_directional_correct"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
