import unittest
import numpy as np
import pandas as pd

from joint_state_strategy_utility_v01 import (
    permitted_actions, feature_vector, state_age_map, action_outcome,
)

STEP = 3_600_000
T0 = 1577836800000


class JointUtilityTests(unittest.TestCase):
    def frame(self, n=24, gap_at=None):
        t=[T0]
        for i in range(1,n):
            d=4*STEP if gap_at is not None and i==gap_at else STEP
            t.append(t[-1]+d)
        c=1900.0+np.arange(n,dtype=float)
        spr=0.1
        return pd.DataFrame({
            "t":t,
            "bo":c,"bh":c+0.5,"bl":c-0.5,"bc":c,
            "ao":c+spr,"ah":c+spr+0.5,"al":c+spr-0.5,"ac":c+spr,
            "atr":np.full(n,5.0),
        })

    def sr(self,state="RANGE"):
        return {
            "state":state,"atr":5.0,"position24":0.25,
            "prior24_upper":1910.0,"prior24_lower":1890.0,
            "prior24_width_atr":4.0,"drift12":0.2,"drift24":0.4,"drift48":0.8,
            "efficiency24":0.2,"efficiency48":0.25,
            "dc0p5_dir":1,"dc1p0_dir":1,"dc2p0_dir":-1,"dc4p0_dir":1,
            "dc_up_count":3,"dc_down_count":1,"spread_atr":0.02,"atr_week_ratio":1.0,
            "breakout_up_atr":0.0,"breakout_down_atr":0.0,"range_votes":4,
        }

    def smap(self,f,states):
        return {int(t):self.sr(s) for t,s in zip(f.t,states)}

    def test_symbolic_constraints(self):
        self.assertEqual(permitted_actions("RANGE"),("RANGE_LONG","RANGE_SHORT"))
        self.assertEqual(permitted_actions("TREND_UP"),("TREND_LONG",))
        self.assertEqual(permitted_actions("TREND_DOWN"),("TREND_SHORT",))
        self.assertEqual(permitted_actions("TRANSITION"),())

    def test_feature_shape(self):
        f=self.frame(2)
        x=feature_vector(0,f,self.sr("RANGE"),3)
        self.assertEqual(len(x),26)
        self.assertAlmostEqual(float(x[-4:].sum()),1.0)

    def test_state_age_resets(self):
        f=self.frame(5)
        sm=self.smap(f,["RANGE","RANGE","TRANSITION","RANGE","RANGE"])
        ages=state_age_map(f,sm)
        self.assertEqual([ages[int(t)] for t in f.t],[1,2,1,1,2])

    def test_range_horizon_next_open(self):
        f=self.frame()
        sm=self.smap(f,["RANGE"]*len(f))
        out=action_outcome("RANGE_LONG",0,f,sm,T0+40*STEP)
        self.assertTrue(out["mature"])
        self.assertEqual(out["exit_kind"],"HORIZON")
        self.assertEqual(out["exit_idx"],5)
        self.assertEqual(out["duration_bars"],4)

    def test_early_state_exit_next_open(self):
        f=self.frame()
        states=["TREND_UP","TREND_UP","TRANSITION"]+["RANGE"]*(len(f)-3)
        sm=self.smap(f,states)
        out=action_outcome("TREND_LONG",0,f,sm,T0+40*STEP)
        self.assertTrue(out["mature"])
        self.assertEqual(out["exit_kind"],"STATE_EXIT")
        self.assertEqual(out["exit_signal_idx"],2)
        self.assertEqual(out["exit_idx"],3)

    def test_hard_gap_censors(self):
        f=self.frame(gap_at=2)
        sm=self.smap(f,["RANGE"]*len(f))
        out=action_outcome("RANGE_LONG",0,f,sm,T0+80*STEP)
        self.assertFalse(out["mature"])
        self.assertEqual(out["reason"],"HARD_GAP")

    def test_state_mismatch(self):
        f=self.frame()
        sm=self.smap(f,["RANGE"]*len(f))
        out=action_outcome("TREND_LONG",0,f,sm,T0+40*STEP)
        self.assertFalse(out["mature"])
        self.assertEqual(out["reason"],"STATE_MISMATCH")


if __name__=="__main__":
    unittest.main(verbosity=2)
