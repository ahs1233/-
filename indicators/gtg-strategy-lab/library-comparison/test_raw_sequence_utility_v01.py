import unittest
import numpy as np
import pandas as pd
import torch

from raw_sequence_utility_v01 import (
    WINDOW, CHANNELS, ACTIONS, SequenceUtilityCNN,
    action_onehot, sequence_window, normalize_fit, normalize_apply
)

STEP = 3_600_000
T0 = 1577836800000


class RawSequenceUtilityV01Tests(unittest.TestCase):
    def frame(self, n=60, gap_at=None, gap_size=None):
        ts = [T0]
        for i in range(1, n):
            step = STEP
            if gap_at is not None and i == gap_at:
                step = gap_size
            ts.append(ts[-1] + step)
        c = 1900.0 + np.arange(n) * 0.2
        o = c - 0.05
        h = c + 0.2
        l = c - 0.2
        spr = 0.1
        return pd.DataFrame({
            "t": ts,
            "bo": o, "bh": h, "bl": l, "bc": c,
            "ao": o+spr, "ah": h+spr, "al": l+spr, "ac": c+spr,
            "atr": np.full(n, 2.0),
        })

    def smap(self, f):
        states = ["RANGE", "TRANSITION", "TREND_UP", "TREND_DOWN"]
        out = {}
        for i, t in enumerate(f.t):
            out[int(t)] = {
                "state": states[i % 4],
                "spread_atr": 0.05,
            }
        return out

    def test_action_onehot(self):
        for i, a in enumerate(ACTIONS):
            z = action_onehot(a)
            self.assertEqual(z.shape, (4,))
            self.assertEqual(float(z.sum()), 1.0)
            self.assertEqual(float(z[i]), 1.0)

    def test_exact_window_and_current_close_anchor(self):
        f = self.frame(60)
        sm = self.smap(f)
        idx = {int(t): i for i, t in enumerate(f.t)}
        dt = int(f.t.iloc[55])
        x = sequence_window(dt, f, sm, idx)
        self.assertEqual(x.shape, (CHANNELS, WINDOW))
        self.assertAlmostEqual(float(x[3, -1]), 0.0)
        self.assertEqual(float(x[6:, -1].sum()), 1.0)

    def test_hard_gap_rejects_window(self):
        f = self.frame(60, gap_at=40, gap_size=4*STEP)
        sm = self.smap(f)
        idx = {int(t): i for i, t in enumerate(f.t)}
        dt = int(f.t.iloc[55])
        self.assertIsNone(sequence_window(dt, f, sm, idx))

    def test_normalization_fit_apply_identity(self):
        rng = np.random.default_rng(1)
        X = rng.normal(size=(8, CHANNELS, WINDOW)).astype(np.float32)
        X[:, 6:, :] = 0
        z, m, s = normalize_fit(X)
        z2 = normalize_apply(X, m, s)
        np.testing.assert_allclose(z, z2, rtol=0, atol=1e-6)

    def test_model_shape(self):
        model = SequenceUtilityCNN()
        x = torch.zeros((3, CHANNELS, WINDOW), dtype=torch.float32)
        a = torch.zeros((3, 4), dtype=torch.float32)
        a[:, 0] = 1
        y = model(x, a)
        self.assertEqual(tuple(y.shape), (3,))


if __name__ == "__main__":
    unittest.main(verbosity=2)
