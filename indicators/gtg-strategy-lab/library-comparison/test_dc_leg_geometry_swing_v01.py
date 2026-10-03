import unittest
import numpy as np
import pandas as pd

from dc_leg_geometry_swing_v01 import leg_geometry, previous_confirmation


class DCLegGeometrySwingTests(unittest.TestCase):
    def frame(self, n=12):
        c = 100.0 + np.arange(n) * 0.1
        return pd.DataFrame({
            "bc": c,
            "atr": np.full(n, 2.0),
        })

    def states(self, n=12):
        return [
            {"direction": 1, "confirmed_at": -1, "pivot_at": -1,
             "pivot_price": 100.0, "extreme_at": 0, "extreme": 100.0}
            for _ in range(n)
        ]

    def signal(self):
        return {
            "correction_idx": 6,
            "signal_idx": 9,
            "direction": 1,
        }

    def event(self):
        return {"frozen_upper": 100.5, "frozen_lower": 95.0}

    def test_previous_confirmation(self):
        s = self.states()
        s[2].update(direction=1, confirmed_at=2, pivot_at=1, pivot_price=98.0)
        s[6].update(direction=-1, confirmed_at=6, pivot_at=5, pivot_price=104.0)
        self.assertEqual(previous_confirmation(s, 6), 2)

    def test_geometry_pass(self):
        f = self.frame()
        f.loc[9, "bc"] = 101.0
        s = self.states()
        # prior trend leg: 98 -> 104 = 6 over 4 bars
        s[2].update(direction=1, confirmed_at=2, pivot_at=1, pivot_price=98.0)
        s[6].update(direction=-1, confirmed_at=6, pivot_at=5, pivot_price=104.0)
        # correction: 104 -> 101 = 3 over 3 bars; slower and smaller
        s[9].update(direction=1, confirmed_at=9, pivot_at=8, pivot_price=101.0)
        g = leg_geometry(self.signal(), self.event(), f, s)
        self.assertEqual(g["status"], "OK")
        self.assertAlmostEqual(g["depth_ratio"], 0.5)
        self.assertLess(g["speed_ratio"], 1.0)
        self.assertTrue(g["filter_pass"])

    def test_geometry_fails_deep_correction(self):
        f = self.frame()
        f.loc[9, "bc"] = 101.0
        s = self.states()
        s[2].update(direction=1, confirmed_at=2, pivot_at=1, pivot_price=98.0)
        s[6].update(direction=-1, confirmed_at=6, pivot_at=5, pivot_price=104.0)
        s[9].update(direction=1, confirmed_at=9, pivot_at=8, pivot_price=97.0)
        g = leg_geometry(self.signal(), self.event(), f, s)
        self.assertEqual(g["status"], "OK")
        self.assertGreater(g["depth_ratio"], 1.0)
        self.assertFalse(g["filter_pass"])

    def test_geometry_fails_inside_source_range(self):
        f = self.frame()
        f.loc[9, "bc"] = 100.0
        s = self.states()
        s[2].update(direction=1, confirmed_at=2, pivot_at=1, pivot_price=98.0)
        s[6].update(direction=-1, confirmed_at=6, pivot_at=5, pivot_price=104.0)
        s[9].update(direction=1, confirmed_at=9, pivot_at=8, pivot_price=101.0)
        g = leg_geometry(self.signal(), self.event(), f, s)
        self.assertLess(g["signal_distance_from_boundary_atr"], 0)
        self.assertFalse(g["filter_pass"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
