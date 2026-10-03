import unittest
import numpy as np
import pandas as pd

from state_transition_engine_v01 import STEP, add_cores, add_outcomes, run_fsm, state_features


class StateTransitionEngineTests(unittest.TestCase):
    def synthetic_frame(self, n=500):
        x = np.arange(n)
        c = 1800.0 + 0.08*x + 5*np.sin(x/13.0) + 2*np.sin(x/37.0)
        atr = np.full(n, 4.0)
        spread = np.full(n, 0.12)
        return pd.DataFrame({
            "t": 1577836800000 + x*STEP,
            "bo": c, "bh": c+1.0, "bl": c-1.0, "bc": c,
            "ao": c+spread, "ah": c+spread+1.0,
            "al": c+spread-1.0, "ac": c+spread,
            "atr": atr,
        })

    def manual_features(self, rows):
        defaults = {
            "valid": True, "range_core": True,
            "trend_up_core": False, "trend_down_core": False,
            "breakout_up": False, "breakout_down": False,
            "t": 0, "close": 95.0,
            "prior24_upper": 100.0, "prior24_lower": 90.0,
            "prior24_width_atr": 2.5, "position24": 0.5,
            "dc0p5_dir": 1, "dc1p0_dir": 1, "dc2p0_dir": 1, "dc4p0_dir": 1,
            "dc_up_count": 4, "dc_down_count": 0,
            "drift12": 0.0, "drift24": 0.0, "drift48": 0.0,
            "efficiency24": 0.2, "efficiency48": 0.2,
            "spread_atr": 0.03, "atr_week_ratio": 1.0,
        }
        built = []
        for i, overrides in enumerate(rows):
            r = defaults.copy()
            r["t"] = i*STEP
            r.update(overrides)
            built.append(r)
        return pd.DataFrame(built)

    def test_feature_prefix_invariance(self):
        f = self.synthetic_frame()
        full = add_cores(state_features(f))
        cut = 350
        pref = add_cores(state_features(f.iloc[:cut+1].copy()))
        numeric = [
            "drift12", "drift24", "drift48", "efficiency24", "efficiency48",
            "spread_atr", "atr_week_ratio", "prior24_upper", "prior24_lower",
            "prior24_width_atr", "position24", "breakout_up_atr",
            "breakout_down_atr", "dc_up_count", "dc_down_count",
        ]
        np.testing.assert_allclose(
            pref[numeric].to_numpy(),
            full[numeric].iloc[:cut+1].to_numpy(),
            rtol=0.0, atol=0.0, equal_nan=True,
        )

    def test_range_breakout_resolves_up(self):
        rows = [{} for _ in range(6)]
        rows += [
            {"range_core": False, "breakout_up": True, "close": 101.0,
             "drift24": 1.2, "efficiency24": 0.5},
            {"range_core": False, "close": 102.0, "drift24": 1.4,
             "efficiency24": 0.5, "trend_up_core": True},
        ]
        x = self.manual_features(rows)
        states, events, _ = run_fsm(x)
        self.assertEqual(states[:6], ["RANGE"]*6)
        self.assertEqual(states[6], "TRANSITION")
        self.assertEqual(states[7], "TREND_UP")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["range_age"], 6)
        self.assertTrue(events[0]["primary"])
        self.assertEqual(events[0]["fsm_resolution"], "TREND_UP")
        self.assertEqual(events[0]["resolution_delay_bars"], 1)

    def test_fake_break_returns_to_range(self):
        rows = [{} for _ in range(6)]
        rows += [
            {"range_core": False, "breakout_up": True, "close": 101.0,
             "drift24": 0.5, "dc_up_count": 2},
            {"range_core": True, "close": 99.0, "dc_up_count": 2},
            {"range_core": True, "close": 98.0, "dc_up_count": 2},
        ]
        x = self.manual_features(rows)
        states, events, _ = run_fsm(x)
        self.assertEqual(states[6], "TRANSITION")
        self.assertEqual(states[7], "TRANSITION")
        self.assertEqual(states[8], "RANGE")
        self.assertEqual(events[0]["fsm_resolution"], "RANGE")
        self.assertEqual(events[0]["resolution_delay_bars"], 2)

    def test_transition_forced_resolution_by_age_four(self):
        rows = [{} for _ in range(6)]
        rows += [
            {"range_core": False, "breakout_up": True, "close": 101.0,
             "drift24": 0.5, "dc_up_count": 2},
            {"range_core": False, "close": 101.2, "drift24": 0.4, "dc_up_count": 2},
            {"range_core": False, "close": 101.1, "drift24": 0.3, "dc_up_count": 2},
            {"range_core": False, "close": 101.3, "drift24": 0.2, "dc_up_count": 2},
        ]
        x = self.manual_features(rows)
        states, events, diag = run_fsm(x)
        self.assertEqual(states[6:9], ["TRANSITION"]*3)
        self.assertEqual(states[9], "RANGE")
        self.assertEqual(events[0]["fsm_resolution"], "RANGE")
        self.assertLessEqual(diag["max_transition_age_seen"], 4)

    def test_gap_resets_open_transition(self):
        rows = [{} for _ in range(6)]
        rows += [
            {"range_core": False, "breakout_up": True, "close": 101.0,
             "drift24": 0.5, "dc_up_count": 2},
            {"t": 8*STEP, "range_core": True, "close": 97.0},
        ]
        x = self.manual_features(rows)
        states, events, diag = run_fsm(x)
        self.assertEqual(states[6], "TRANSITION")
        self.assertEqual(events[0]["fsm_resolution"], "UNRESOLVED_GAP")
        self.assertGreaterEqual(diag["gap_resets"], 1)
        self.assertEqual(states[7], "RANGE")

    def test_outcome_requires_contiguous_path(self):
        f = self.synthetic_frame(40)
        f.loc[11:, "t"] += STEP
        event = {
            "start_idx": 10,
            "time": int(f.t.iloc[10]),
            "candidate_direction": 1,
            "frozen_upper": float(f.bh.iloc[9]),
            "frozen_lower": float(f.bl.iloc[9]),
        }
        out = add_outcomes([event], f)[0]
        self.assertFalse(out["h1_mature"])
        self.assertFalse(out["h4_mature"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
