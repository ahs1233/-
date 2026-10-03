import unittest
import numpy as np
import pandas as pd

from dc_correction_resumption_swing_v01 import (
    MAX_CONTIG_GAP, search_signal, path_ok
)


class DCCorrectionResumptionSwingTests(unittest.TestCase):
    def frame(self, n=12):
        t0 = 1_600_000_000_000
        t = t0 + np.arange(n) * 3_600_000
        c = 1900.0 + np.arange(n)
        return pd.DataFrame({
            "t": t,
            "bo": c, "bh": c+0.5, "bl": c-0.5, "bc": c,
            "ao": c+0.1, "ah": c+0.6, "al": c-0.4, "ac": c+0.1,
            "atr": np.full(n, 5.0),
        })

    def dc(self, n, direction=1):
        return [
            {"direction": direction, "confirmed_at": -1, "pivot_at": -1,
             "pivot_price": 0.0, "extreme_at": 0, "extreme": 0.0}
            for _ in range(n)
        ]

    def event(self, f, q=3, d=1):
        return {
            "event_id": 1,
            "split": "evaluation",
            "resolution_time": int(f.t.iloc[q]),
            "resolved_direction": d,
            "resolution": "TREND_UP" if d == 1 else "TREND_DOWN",
            "frozen_lower": 1890.0,
            "frozen_upper": 1910.0,
        }

    def test_successful_correction_then_resumption(self):
        f = self.frame()
        q = 3
        fine = self.dc(len(f), 1)
        macro = self.dc(len(f), 1)
        fine[5] = {**fine[5], "direction": -1, "confirmed_at": 5}
        for i in range(5, 7):
            fine[i]["direction"] = -1
        fine[7] = {**fine[7], "direction": 1, "confirmed_at": 7}
        state = {int(t): "TREND_UP" for t in f.t}
        t_to_i = {int(t): i for i, t in enumerate(f.t)}
        s = search_signal(self.event(f, q, 1), f, state, t_to_i, fine, macro)
        self.assertEqual(s["status"], "DC_RESUMPTION_ENTRY")
        self.assertEqual(s["correction_idx"], 5)
        self.assertEqual(s["signal_idx"], 7)
        self.assertEqual(s["entry_idx"], 8)
        self.assertEqual(s["correction_delay_bars"], 2)
        self.assertEqual(s["correction_duration_bars"], 2)

    def test_macro_not_aligned_at_resolution(self):
        f = self.frame()
        fine = self.dc(len(f), 1)
        macro = self.dc(len(f), -1)
        state = {int(t): "TREND_UP" for t in f.t}
        t_to_i = {int(t): i for i, t in enumerate(f.t)}
        s = search_signal(self.event(f, 3, 1), f, state, t_to_i, fine, macro)
        self.assertEqual(s["status"], "MACRO_NOT_ALIGNED_AT_RESOLUTION")

    def test_macro_reversal_during_correction(self):
        f = self.frame()
        fine = self.dc(len(f), 1)
        macro = self.dc(len(f), 1)
        fine[5] = {**fine[5], "direction": -1, "confirmed_at": 5}
        for i in range(5, len(f)):
            fine[i]["direction"] = -1
        macro[6] = {**macro[6], "direction": -1, "confirmed_at": 6}
        for i in range(6, len(f)):
            macro[i]["direction"] = -1
        state = {int(t): "TREND_UP" for t in f.t}
        t_to_i = {int(t): i for i, t in enumerate(f.t)}
        s = search_signal(self.event(f, 3, 1), f, state, t_to_i, fine, macro)
        self.assertEqual(s["status"], "MACRO_REVERSAL_DURING_CORRECTION")

    def test_trend_end_before_correction(self):
        f = self.frame()
        fine = self.dc(len(f), 1)
        macro = self.dc(len(f), 1)
        state = {int(t): "TREND_UP" for t in f.t}
        state[int(f.t.iloc[5])] = "RANGE"
        t_to_i = {int(t): i for i, t in enumerate(f.t)}
        s = search_signal(self.event(f, 3, 1), f, state, t_to_i, fine, macro)
        self.assertEqual(s["status"], "NO_FINE_CORRECTION_BEFORE_TREND_END")

    def test_path_gap_rule(self):
        f = self.frame()
        t = f.t.to_numpy(dtype=np.int64)
        self.assertTrue(path_ok(t, 3, 4))
        t2 = t.copy()
        t2[5:] += MAX_CONTIG_GAP + 1
        self.assertFalse(path_ok(t2, 3, 4))


if __name__ == "__main__":
    unittest.main(verbosity=2)
