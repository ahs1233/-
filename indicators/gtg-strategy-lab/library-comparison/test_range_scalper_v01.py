import unittest
import numpy as np
import pandas as pd

from range_scalper_v01 import signal_at, execute_trade, MAX_CONTIG_GAP


class RangeScalperV01Tests(unittest.TestCase):
    def frame(self):
        t0 = 1_600_000_000_000
        t = t0 + np.arange(10) * 3_600_000
        bo = np.array([100,100,91,92,94,101,101,101,101,101], dtype=float)
        bc = np.array([100,100,92,93,95,101,101,101,101,101], dtype=float)
        return pd.DataFrame({
            "t": t,
            "bo": bo, "bh": np.maximum(bo,bc)+1, "bl": np.minimum(bo,bc)-1, "bc": bc,
            "ao": bo+0.1, "ah": np.maximum(bo,bc)+1.1,
            "al": np.minimum(bo,bc)-0.9, "ac": bc+0.1,
            "atr": np.full(10, 2.0),
        })

    def state(self, state="RANGE", lower=90.0, upper=110.0):
        return {
            "state": state,
            "prior24_lower": lower,
            "prior24_upper": upper,
            "position24": 0.0,
            "atr": 2.0,
        }

    def test_long_signal_outer_quartile_rejection(self):
        f = self.frame()
        s = signal_at(2, f, self.state())
        self.assertIsNotNone(s)
        self.assertEqual(s["direction"], 1)
        self.assertAlmostEqual(s["midpoint"], 100.0)

    def test_no_signal_without_inward_candle(self):
        f = self.frame()
        f.loc[2, "bc"] = 90.5
        f.loc[2, "bo"] = 91.0
        self.assertIsNone(signal_at(2, f, self.state()))

    def test_target_exit_is_causal_next_open(self):
        f = self.frame()
        sig = signal_at(2, f, self.state())
        states = {int(t): self.state() for t in f.t}
        r = execute_trade(sig, f, states, int(f.t.iloc[-1]) + 3_600_000)
        self.assertEqual(r["status"], "TRADE")
        self.assertEqual(r["exit_reason"], "TARGET")
        # close crosses midpoint at bar 5, exit is open bar 6
        self.assertEqual(r["exit_signal_idx"], 5)
        self.assertEqual(r["exit_idx"], 6)

    def test_state_exit_before_target(self):
        f = self.frame()
        # keep below midpoint
        f.loc[3:6, "bc"] = [93,94,95,96]
        f.loc[3:6, "bo"] = [92,93,94,95]
        sig = signal_at(2, f, self.state())
        states = {int(t): self.state() for t in f.t}
        states[int(f.t.iloc[4])] = self.state("TRANSITION")
        r = execute_trade(sig, f, states, int(f.t.iloc[-1]) + 3_600_000)
        self.assertEqual(r["status"], "TRADE")
        self.assertEqual(r["exit_reason"], "STATE_EXIT")
        self.assertEqual(r["exit_signal_idx"], 4)
        self.assertEqual(r["exit_idx"], 5)

    def test_hard_gap_censors(self):
        f = self.frame()
        sig = signal_at(2, f, self.state())
        f.loc[4:, "t"] += MAX_CONTIG_GAP + 1
        states = {int(t): self.state() for t in f.t}
        r = execute_trade(sig, f, states, int(f.t.iloc[-1]) + 3_600_000)
        self.assertEqual(r["status"], "HARD_GAP")


if __name__ == "__main__":
    unittest.main(verbosity=2)
