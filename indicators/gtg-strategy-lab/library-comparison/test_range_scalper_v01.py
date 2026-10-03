import unittest
import numpy as np
import pandas as pd

from range_scalper_v01 import signal_at, execute_trade, gap_ok

STEP = 3_600_000
T0 = 1577836800000


class RangeScalperV01Tests(unittest.TestCase):
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

    def state_row(self, state="RANGE"):
        return {
            "state": state,
            "prior24_lower": 100.0,
            "prior24_upper": 104.0,
            "position24": 0.25,
            "atr": 1.0,
        }

    def state_map(self, f, states):
        return {
            int(t): {
                "state": s,
                "prior24_lower": 100.0,
                "prior24_upper": 104.0,
                "position24": 0.5,
                "atr": 1.0,
            }
            for t, s in zip(f.t, states)
        }

    def test_signal_long_and_short(self):
        f = self.frame([101.0, 103.0], opens=[100.5, 103.5])
        long_sig = signal_at(0, f, self.state_row())
        short_state = self.state_row()
        short_state["position24"] = 0.75
        short_sig = signal_at(1, f, short_state)
        self.assertEqual(long_sig["direction"], 1)
        self.assertEqual(short_sig["direction"], -1)

    def test_midpoint_target_exit(self):
        f = self.frame(
            [101.0, 102.2, 102.5, 102.6],
            opens=[100.5, 101.1, 102.3, 102.5],
        )
        sig = signal_at(0, f, self.state_row())
        smap = self.state_map(f, ["RANGE"]*4)
        result = execute_trade(sig, f, smap, T0 + 10*STEP)
        self.assertEqual(result["status"], "TRADE")
        self.assertEqual(result["exit_reason"], "TARGET")
        self.assertEqual(result["duration_bars"], 1)

    def test_state_handoff_exit(self):
        f = self.frame(
            [101.0, 101.2, 101.1, 101.0],
            opens=[100.5, 101.0, 101.2, 101.1],
        )
        sig = signal_at(0, f, self.state_row())
        smap = self.state_map(f, ["RANGE","TRANSITION","TRANSITION","RANGE"])
        result = execute_trade(sig, f, smap, T0 + 10*STEP)
        self.assertEqual(result["status"], "TRADE")
        self.assertEqual(result["exit_reason"], "STATE_EXIT")

    def test_hard_gap_censors(self):
        f = self.frame(
            [101.0, 101.2, 101.3, 101.4],
            opens=[100.5, 101.0, 101.2, 101.3],
            gaps=[STEP, 4*STEP, STEP],
        )
        sig = signal_at(0, f, self.state_row())
        smap = self.state_map(f, ["RANGE"]*4)
        result = execute_trade(sig, f, smap, T0 + 20*STEP)
        self.assertEqual(result["status"], "HARD_GAP")

    def test_non_range_has_no_signal(self):
        f = self.frame([101.0], opens=[100.5])
        self.assertIsNone(signal_at(0, f, self.state_row("TRANSITION")))

    def test_gap_contract(self):
        self.assertTrue(gap_ok(T0, T0+STEP))
        self.assertTrue(gap_ok(T0, T0+3*STEP))
        self.assertFalse(gap_ok(T0, T0+4*STEP))


if __name__ == "__main__":
    unittest.main(verbosity=2)
