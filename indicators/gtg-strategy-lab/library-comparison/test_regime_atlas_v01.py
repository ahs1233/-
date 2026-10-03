import unittest
import numpy as np
import pandas as pd

from regime_atlas_v01 import (
    regime_features, transform_with_atlas, nonoverlap_anchors,
    transition_matrix, state_runs, STEP, BASE, ms
)


class RegimeAtlasSafetyTests(unittest.TestCase):
    def frame(self, n=5000, start="2020-01-01"):
        x = np.arange(n)
        c = 1600.0 * np.exp(
            0.003*np.sin(x/13.0)
            + 0.002*np.sin(x/47.0)
            + 0.000002*x
        )
        atr = np.full(n, 4.0)
        spread = np.full(n, 0.2)
        t = ms(start) + x*STEP
        return pd.DataFrame({
            "t": t,
            "bo": c, "bh": c+1.5, "bl": c-1.5, "bc": c,
            "ao": c+spread, "ah": c+spread+1.5,
            "al": c+spread-1.5, "ac": c+spread,
            "atr": atr,
        })

    def test_feature_contract_23(self):
        f = self.frame()
        X, names, _ = regime_features(f)
        self.assertEqual(X.shape, (len(f), 23))
        self.assertEqual(len(names), 23)
        self.assertEqual(names[-5:], [
            "drift48", "atr_week_ratio", "atr_day_week_ratio",
            "efficiency12", "efficiency48"
        ])

    def test_feature_prefix_invariance(self):
        f = self.frame()
        X, names, _ = regime_features(f)
        cut = 3000
        Xp, pnames, _ = regime_features(f.iloc[:cut+1].copy())
        self.assertEqual(names, pnames)
        np.testing.assert_allclose(
            Xp, X[:cut+1], rtol=0.0, atol=0.0, equal_nan=True
        )

    def test_frozen_center_assignment(self):
        X = np.array([[0., 0.], [2., 2.], [9., 9.]])
        atlas = {
            "scaler_center": [1., 1.],
            "scaler_scale": [1., 1.],
            "centers_scaled": [[-1., -1.], [8., 8.]],
        }
        Z, labels = transform_with_atlas(X, atlas)
        np.testing.assert_allclose(Z, [[-1., -1.], [1., 1.], [8., 8.]])
        np.testing.assert_array_equal(labels, [0, 0, 1])

    def test_nonoverlap_anchor_max_horizon(self):
        f = self.frame(n=1200, start="2021-01-01")
        X, _, _ = regime_features(f)
        anchors = nonoverlap_anchors(
            f, X, "2021-01-01", "2021-02-15"
        )
        self.assertTrue(anchors)
        for a, b in zip(anchors, anchors[1:]):
            self.assertGreater(b, a+12)
        for q in anchors:
            self.assertLess(int(f.t.iloc[q+12]), ms("2021-02-15"))

    def test_transition_ignores_time_gaps(self):
        times = np.array([0, STEP, 2*STEP, 5*STEP, 6*STEP], dtype=np.int64)
        labels = np.array([0, 1, 1, 0, 1], dtype=int)
        counts, probs = transition_matrix(times, labels, 2)
        self.assertEqual(int(counts.sum()), 3)
        self.assertEqual(counts[0,1], 2)
        self.assertEqual(counts[1,1], 1)

    def test_runs_break_on_time_gap(self):
        times = np.array([0, STEP, 4*STEP, 5*STEP], dtype=np.int64)
        labels = np.array([1, 1, 1, 1], dtype=int)
        runs = state_runs(times, labels)
        self.assertEqual(runs["1"], [2, 2])


if __name__ == "__main__":
    unittest.main(verbosity=2)
