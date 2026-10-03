import unittest
import numpy as np
import pandas as pd

from pre_transition_guard_v01 import (
    range_age_map, raw_features, structural_label, frozen_predict, SESSIONS
)
from range_scalper_v01 import signal_at

STEP = 3_600_000
T0 = 1577836800000


class PreTransitionGuardV01Tests(unittest.TestCase):
    def frame(self, closes, opens=None, gaps=None):
        n = len(closes)
        if opens is None:
            opens = closes
        times = [T0]
        for i in range(1, n):
            times.append(times[-1] + (STEP if gaps is None else gaps[i-1]))
        c = np.asarray(closes, dtype=float)
        o = np.asarray(opens, dtype=float)
        hi = np.maximum(o, c) + 0.2
        lo = np.minimum(o, c) - 0.2
        spr = 0.05
        return pd.DataFrame({
            "t": times,
            "bo": o, "bh": hi, "bl": lo, "bc": c,
            "ao": o+spr, "ah": hi+spr, "al": lo+spr, "ac": c+spr,
            "atr": np.ones(n),
        })

    def sr(self, state="RANGE", direction=1):
        return {
            "state": state,
            "prior24_lower": 100.0,
            "prior24_upper": 104.0,
            "position24": 0.25 if direction == 1 else 0.75,
            "atr": 1.0,
            "dc0p5_dir": direction,
            "dc1p0_dir": direction,
            "dc2p0_dir": direction,
            "dc4p0_dir": direction,
            "dc_up_count": 4 if direction == 1 else 0,
            "dc_down_count": 4 if direction == -1 else 0,
            "drift12": 0.2*direction,
            "drift24": 0.4*direction,
            "drift48": 0.6*direction,
            "efficiency24": 0.2,
            "efficiency48": 0.2,
            "spread_atr": 0.05,
            "atr_week_ratio": 1.0,
        }

    def smap(self, f, states):
        return {
            int(t): self.sr(state=s)
            for t, s in zip(f.t, states)
        }

    def test_safe_target_label(self):
        f = self.frame([101.0, 102.2, 102.4], opens=[100.5, 101.1, 102.3])
        sm = self.smap(f, ["RANGE", "RANGE", "RANGE"])
        sig = signal_at(0, f, sm[int(f.t.iloc[0])])
        lab = structural_label(sig, f, sm, T0 + 10*STEP)
        self.assertTrue(lab["mature"])
        self.assertEqual(lab["label"], 0)

    def test_handoff_before_target_label(self):
        f = self.frame([101.0, 101.2, 101.1], opens=[100.5, 101.0, 101.2])
        sm = self.smap(f, ["RANGE", "TRANSITION", "TRANSITION"])
        sig = signal_at(0, f, sm[int(f.t.iloc[0])])
        lab = structural_label(sig, f, sm, T0 + 10*STEP)
        self.assertTrue(lab["mature"])
        self.assertEqual(lab["label"], 1)

    def test_target_and_state_same_bar_is_safe(self):
        f = self.frame([101.0, 102.2, 102.4], opens=[100.5, 101.1, 102.3])
        sm = self.smap(f, ["RANGE", "TRANSITION", "TRANSITION"])
        sig = signal_at(0, f, sm[int(f.t.iloc[0])])
        lab = structural_label(sig, f, sm, T0 + 10*STEP)
        self.assertEqual(lab["label"], 0)

    def test_range_age_resets(self):
        f = self.frame([101,101,101,101,101])
        sm = self.smap(f, ["RANGE","RANGE","TRANSITION","RANGE","RANGE"])
        ages = range_age_map(f, sm)
        self.assertEqual([ages[int(t)] for t in f.t], [1,2,0,1,2])

    def test_features_and_frozen_prediction(self):
        f = self.frame([101.0], opens=[100.5])
        sr = self.sr("RANGE", 1)
        sig = signal_at(0, f, sr)
        num, one = raw_features(sig, 0, f, sr, 3)
        self.assertEqual(len(num), 19)
        self.assertEqual(len(one), len(SESSIONS))
        self.assertAlmostEqual(float(one.sum()), 1.0)
        model = {
            "scaler_center": [0.0]*19,
            "scaler_scale": [1.0]*19,
            "coef": [0.0]*(19+len(SESSIONS)),
            "intercept": 0.0,
        }
        self.assertAlmostEqual(frozen_predict(model, num, one), 0.5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
