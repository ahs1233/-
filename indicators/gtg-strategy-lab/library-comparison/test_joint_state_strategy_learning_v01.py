import unittest
import numpy as np
import pandas as pd

from joint_state_strategy_learning_v01 import (
    allowed_directions, direction_allowed, action_outcome,
    feature_vector, state_age_maps, choose_symbolic_action,
    FEATURE_NAMES, NUMERIC_NAMES,
)

STEP = 3_600_000
T0 = 1577836800000


class JointStateStrategyLearningV01Tests(unittest.TestCase):
    def frame(self, n=12):
        x = np.arange(n, dtype=float)
        c = 100.0 + 0.2*x
        o = c - 0.05
        spr = 0.02
        return pd.DataFrame({
            "t": [T0+i*STEP for i in range(n)],
            "bo": o, "bh": c+0.1, "bl": o-0.1, "bc": c,
            "ao": o+spr, "ah": c+0.1+spr,
            "al": o-0.1+spr, "ac": c+spr,
            "atr": np.ones(n),
        })

    def sr(self, state="RANGE"):
        return {
            "state": state,
            "atr": 1.0,
            "dc0p5_dir": 1.0, "dc1p0_dir": 1.0,
            "dc2p0_dir": -1.0, "dc4p0_dir": -1.0,
            "dc_up_count": 2.0, "dc_down_count": 2.0,
            "drift12": 0.2, "drift24": 0.4, "drift48": 0.6,
            "efficiency24": 0.2, "efficiency48": 0.2,
            "spread_atr": 0.02, "atr_week_ratio": 1.0,
            "prior24_upper": 104.0, "prior24_lower": 96.0,
            "prior24_width_atr": 8.0, "position24": 0.5,
        }

    def smap(self, f, states):
        return {int(t): self.sr(s) for t, s in zip(f.t, states)}

    def test_symbolic_action_constraints(self):
        self.assertEqual(allowed_directions("RANGE"), (1,-1))
        self.assertEqual(allowed_directions("TREND_UP"), (1,))
        self.assertEqual(allowed_directions("TREND_DOWN"), (-1,))
        self.assertEqual(allowed_directions("TRANSITION"), ())
        self.assertTrue(direction_allowed("RANGE", -1))
        self.assertFalse(direction_allowed("TREND_UP", -1))

    def test_action_horizon_exit(self):
        f = self.frame()
        sm = self.smap(f, ["RANGE"]*len(f))
        out = action_outcome(1, 1, f, sm, T0+20*STEP)
        self.assertTrue(out["mature"])
        self.assertEqual(out["reason"], "HORIZON")
        self.assertEqual(out["duration_bars"], 4)
        self.assertEqual(out["exit_idx"], 6)

    def test_transition_forces_early_exit(self):
        f = self.frame()
        states = ["RANGE","RANGE","RANGE","TRANSITION"] + ["RANGE"]*(len(f)-4)
        sm = self.smap(f, states)
        out = action_outcome(1, 1, f, sm, T0+20*STEP)
        self.assertTrue(out["mature"])
        self.assertEqual(out["reason"], "STATE_DISALLOW")
        self.assertEqual(out["exit_signal_idx"], 3)
        self.assertEqual(out["exit_idx"], 4)

    def test_state_age_resets_on_state_change(self):
        f = self.frame(6)
        sm = self.smap(f, ["RANGE","RANGE","TREND_UP","TREND_UP","RANGE","RANGE"])
        ra, ta = state_age_maps(f, sm)
        self.assertEqual([ra[int(t)] for t in f.t], [1,2,0,0,1,2])
        self.assertEqual([ta[int(t)] for t in f.t], [0,0,1,2,0,0])

    def test_feature_is_t_only(self):
        f = self.frame()
        sr = self.sr("RANGE")
        n1, o1 = feature_vector(2, 1, f, sr, 3, 0)
        f2 = f.copy()
        f2.loc[5:, "bc"] += 1000
        f2.loc[5:, "bh"] += 1000
        f2.loc[5:, "bl"] += 1000
        n2, o2 = feature_vector(2, 1, f2, sr, 3, 0)
        np.testing.assert_allclose(n1, n2)
        np.testing.assert_allclose(o1, o2)
        self.assertEqual(len(n1), len(NUMERIC_NAMES))
        self.assertEqual(len(n1)+len(o1), len(FEATURE_NAMES))

    def test_symbolic_baseline(self):
        r = self.sr("RANGE")
        r["position24"] = 0.25
        self.assertEqual(choose_symbolic_action(r), 1)
        r["position24"] = 0.75
        self.assertEqual(choose_symbolic_action(r), -1)
        self.assertEqual(choose_symbolic_action(self.sr("TREND_UP")), 1)
        self.assertEqual(choose_symbolic_action(self.sr("TREND_DOWN")), -1)
        self.assertEqual(choose_symbolic_action(self.sr("TRANSITION")), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
