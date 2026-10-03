import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from dc_resumption_h4_validation_v01 import (
    STEP, VAL_END_MS, FINE_THRESHOLD, MACRO_THRESHOLD,
    gap_ok, fresh_dc, search_signal, execution_record, verdict
)

T0 = int(pd.Timestamp("2024-06-01T00:00:00Z").timestamp() * 1000)


class DCResumptionH4ValidationTests(unittest.TestCase):
    def frame(self, n=20):
        x = np.arange(n)
        c = 2000.0 + x.astype(float)
        spr = 0.2
        return pd.DataFrame({
            "t": T0 + x*STEP,
            "bo": c, "bh": c+0.5, "bl": c-0.5, "bc": c,
            "ao": c+spr, "ah": c+spr+0.5,
            "al": c+spr-0.5, "ac": c+spr,
            "atr": np.full(n, 5.0),
        })

    def dc(self, n, default_dir=1):
        return [
            {"direction": default_dir, "confirmed_at": -1}
            for _ in range(n)
        ]

    def event(self, resolution_time, direction=1):
        return {
            "event_id": 1,
            "time": resolution_time - STEP,
            "resolution_time": resolution_time,
            "fsm_resolution": "TREND_UP" if direction == 1 else "TREND_DOWN",
        }

    def test_thresholds_are_frozen(self):
        self.assertEqual(FINE_THRESHOLD, 0.0025)
        self.assertEqual(MACRO_THRESHOLD, 0.0050)

    def test_gap_contract(self):
        self.assertTrue(gap_ok(T0, T0+STEP))
        self.assertTrue(gap_ok(T0, T0+3*STEP))
        self.assertFalse(gap_ok(T0, T0+4*STEP))

    def test_correction_then_resumption(self):
        f = self.frame()
        q = 5
        event = self.event(int(f.t.iloc[q]), 1)
        state = {int(t): "TREND_UP" for t in f.t}
        idx = {int(t): i for i, t in enumerate(f.t)}
        fine = self.dc(len(f), 1)
        macro = self.dc(len(f), 1)
        fine[q+2] = {"direction": -1, "confirmed_at": q+2}
        fine[q+5] = {"direction": 1, "confirmed_at": q+5}
        sig = search_signal(event, f, state, idx, fine, macro)
        self.assertEqual(sig["status"], "DC_RESUMPTION_ENTRY")
        self.assertEqual(sig["correction_delay_bars"], 2)
        self.assertEqual(sig["correction_duration_bars"], 3)
        self.assertEqual(sig["signal_idx"], q+5)

    def test_macro_reversal_cancels(self):
        f = self.frame()
        q = 5
        event = self.event(int(f.t.iloc[q]), 1)
        state = {int(t): "TREND_UP" for t in f.t}
        idx = {int(t): i for i, t in enumerate(f.t)}
        fine = self.dc(len(f), 1)
        macro = self.dc(len(f), 1)
        macro[q+1] = {"direction": -1, "confirmed_at": q+1}
        sig = search_signal(event, f, state, idx, fine, macro)
        self.assertEqual(sig["status"], "MACRO_REVERSAL_BEFORE_CORRECTION")

    def test_execution_uses_h4(self):
        f = self.frame()
        s = 5
        event = self.event(int(f.t.iloc[1]), 1)
        sig = {
            "signal_idx": s,
            "entry_idx": s+1,
            "direction": 1,
            "correction_delay_bars": 2,
            "correction_duration_bars": 3,
            "total_delay_bars": 5,
        }
        # Synthetic timestamps are long before VAL_END, so h4 is mature.
        rec = execution_record(event, sig, f)
        self.assertIsNotNone(rec)
        self.assertEqual(rec["exit_bar_time"], int(f.t.iloc[s+4]))
        self.assertAlmostEqual(rec["signed_displacement_atr"], 0.8)

    def test_inconclusive_small_sample(self):
        rows = [
            {"direction": 1, "c0": 1.0, "c1": 1.0, "c2": 1.0,
             "directional_correct": True, "signed_displacement_atr": 1.0,
             "mfe_atr": 1.0, "mae_atr": 0.2,
             "correction_delay_bars": 1, "correction_duration_bars": 1,
             "total_delay_bars": 2}
            for _ in range(5)
        ]
        v, screens = verdict(rows)
        self.assertEqual(v, "INCONCLUSIVE")
        self.assertFalse(screens["sample_adequate"])

    def test_pass_screen_requires_both_sides(self):
        rows = []
        for d in (1, -1):
            for _ in range(5):
                rows.append({
                    "direction": d, "c0": 0.4, "c1": 0.2, "c2": 0.05,
                    "directional_correct": True,
                    "signed_displacement_atr": 0.5,
                    "mfe_atr": 0.8, "mae_atr": 0.2,
                    "correction_delay_bars": 2,
                    "correction_duration_bars": 2,
                    "total_delay_bars": 4,
                })
        v, screens = verdict(rows)
        self.assertEqual(v, "PASS")
        self.assertTrue(all(screens.values()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
