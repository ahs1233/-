import unittest
import numpy as np
import pandas as pd

from confirmed_handoff_execution_v01 import STEP, path_ok, trade_record


class ConfirmedHandoffExecutionTests(unittest.TestCase):
    def frame(self, n=40):
        x = np.arange(n)
        c = 1900.0 + x.astype(float)
        atr = np.full(n, 5.0)
        spr = np.full(n, 0.1)
        return pd.DataFrame({
            "t": 1577836800000 + x*STEP,
            "bo": c, "bh": c+0.5, "bl": c-0.5, "bc": c,
            "ao": c+spr, "ah": c+spr+0.5,
            "al": c+spr-0.5, "ac": c+spr,
            "atr": atr,
        })

    def event(self, direction=1):
        return {
            "event_id": 1,
            "onset_time": 1577836800000,
            "resolution_time": 1577836800000 + 10*STEP,
            "resolution_delay_bars": 1,
            "resolved_direction": direction,
            "resolution": "TREND_UP" if direction == 1 else "TREND_DOWN",
            "frozen_lower": 1890.0,
            "frozen_upper": 1915.0,
        }

    def test_short_gap_allowed(self):
        f = self.frame()
        f.loc[11:, "t"] += STEP
        self.assertTrue(path_ok(f.t.to_numpy(dtype=np.int64), 10, 4))

    def test_long_gap_rejected(self):
        f = self.frame()
        f.loc[11:, "t"] += 4*STEP
        self.assertFalse(path_ok(f.t.to_numpy(dtype=np.int64), 10, 4))

    def test_long_trade_uses_resolution_anchor(self):
        f = self.frame()
        r = trade_record(self.event(1), f, 10, 4)
        self.assertIsNotNone(r)
        self.assertAlmostEqual(r["signed_displacement_atr"], 0.8)
        self.assertTrue(r["directional_correct"])

    def test_direction_contract(self):
        f = self.frame()
        e = self.event(1)
        e["resolution"] = "TREND_DOWN"
        with self.assertRaises(ValueError):
            trade_record(e, f, 10, 4)


if __name__ == "__main__":
    unittest.main(verbosity=2)
