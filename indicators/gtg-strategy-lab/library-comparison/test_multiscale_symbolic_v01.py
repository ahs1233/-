import unittest
import numpy as np
import pandas as pd

from multiscale_symbolic_v01 import (
    threshold_features, multiscale_matrix, greedy_interval_anchors,
    replication_anchors, eval_expression, MULTS, TRACKS, ms
)


class MultiScaleSymbolicSafetyTests(unittest.TestCase):
    def frame(self, n=3000, step=300000, start="2020-01-01"):
        x = np.arange(n)
        c = 1500.0 * np.exp(
            0.004*np.sin(x/17.0) + 0.002*np.sin(x/53.0) + 0.000001*x
        )
        atr = np.full(n, 3.0)
        spread = np.full(n, 0.15)
        t = ms(start) + x*step
        return pd.DataFrame({
            "t": t,
            "bo": c, "bh": c+1.0, "bl": c-1.0, "bc": c,
            "ao": c+spread, "ah": c+spread+1.0,
            "al": c+spread-1.0, "ac": c+spread,
            "atr": atr,
        })

    def test_threshold_features_prefix_invariant(self):
        f = self.frame()
        th = 0.001
        full_states, full = threshold_features(f, th)
        cut = 1800
        p_states, p = threshold_features(f.iloc[:cut+1].copy(), th)
        self.assertEqual(p_states, full_states[:cut+1])
        np.testing.assert_allclose(p, full[:cut+1], rtol=0.0, atol=0.0)

    def test_confirmation_age_never_negative(self):
        f = self.frame()
        for mult in MULTS:
            _, mat = threshold_features(f, TRACKS["scalp"]["base"]*mult)
            self.assertTrue(np.all(mat[:, 1] >= 0))
            self.assertTrue(np.all(np.isfinite(mat)))

    def test_multiscale_contract_is_18_features(self):
        f = self.frame()
        X, names, _ = multiscale_matrix(f, TRACKS["scalp"]["base"])
        self.assertEqual(X.shape, (len(f), 18))
        self.assertEqual(len(names), 18)
        self.assertEqual(names[-2:], ["drift12", "spread_atr"])

    def test_greedy_anchor_outcomes_do_not_overlap(self):
        f = self.frame(start="2019-01-01")
        h = 3
        anchors = greedy_interval_anchors(
            f, "2019-01-01", "2019-01-10", h, 300000
        )
        self.assertTrue(anchors)
        for a, b in zip(anchors, anchors[1:]):
            self.assertGreater(b, a+h)

    def test_split_outcomes_mature_before_boundary(self):
        f = self.frame(n=8000, step=300000, start="2019-12-20")
        h = 3
        end = "2020-01-10"
        anchors = greedy_interval_anchors(
            f, "2020-01-01", end, h, 300000
        )
        self.assertTrue(anchors)
        for i in anchors:
            self.assertLess(int(f.t.iloc[i+h]), ms(end))

    def test_replication_exact_count_and_non_overlap(self):
        # Long synthetic H1 frame covering the full registered replication interval.
        start = "2020-06-01"
        end = pd.Timestamp("2021-07-31", tz="UTC")
        t0 = pd.Timestamp(start, tz="UTC")
        n = int((end-t0).total_seconds()//3600)
        x = np.arange(n)
        c = 1700 + 0.02*x + 10*np.sin(x/31)
        f = pd.DataFrame({
            "t": ms(start)+x*3600000,
            "bo": c, "bh": c+1, "bl": c-1, "bc": c,
            "ao": c+0.2, "ah": c+1.2, "al": c-0.8, "ac": c+0.2,
            "atr": np.full(n, 4.0),
        })
        anchors = replication_anchors(f, 4, 3600000)
        self.assertEqual(len(anchors), 240)
        for a, b in zip(anchors, anchors[1:]):
            self.assertGreater(b, a+4)

    def test_expression_eval_uses_named_features(self):
        names = ["x0", "x1"]
        X = np.array([[1.0, 2.0], [3.0, 4.0]])
        y = eval_expression("x0 + 2*x1", names, X)
        np.testing.assert_allclose(y, [5.0, 11.0])

    def test_multiscale_prefix_invariant(self):
        f = self.frame()
        full, names, _ = multiscale_matrix(f, TRACKS["scalp"]["base"])
        cut = 2000
        pref, pnames, _ = multiscale_matrix(
            f.iloc[:cut+1].copy(), TRACKS["scalp"]["base"]
        )
        self.assertEqual(names, pnames)
        # drift12/spread and every DC feature must be identical on the prefix.
        np.testing.assert_allclose(pref, full[:cut+1], rtol=0.0, atol=0.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
