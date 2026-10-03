import unittest
import numpy as np
import pandas as pd
from transition_logistic_execution_v01 import path_ok, trade_result, policy_copy
from state_transition_engine_v02 import STEP

class TransitionLogisticExecutionTests(unittest.TestCase):
    def frame(self,n=40):
        x=np.arange(n); c=1900.0+x
        return pd.DataFrame({"t":1577836800000+x*STEP,
          "bo":c,"bh":c+.5,"bl":c-.5,"bc":c,
          "ao":c+.2,"ah":c+.7,"al":c-.3,"ac":c+.2,
          "atr":np.full(n,5.0)})

    def test_path_accepts_short_gap(self):
        f=self.frame(); f.loc[11:,"t"]+=STEP
        self.assertTrue(path_ok(f,10,4))

    def test_path_rejects_hard_gap(self):
        f=self.frame(); f.loc[11:,"t"]+=4*STEP
        self.assertFalse(path_ok(f,10,4))

    def test_long_trade_result(self):
        f=self.frame(); r=trade_result(f,10,4,1)
        self.assertTrue(r["direction_correct"])
        self.assertAlmostEqual(r["c0"],(f.bc.iloc[14]-f.bo.iloc[11])/5.0)

    def test_short_trade_result(self):
        f=self.frame(); r=trade_result(f,10,4,-1)
        self.assertFalse(r["direction_correct"])
        self.assertLess(r["c0"],0)

    def test_policy_copy_preserves_horizon_metadata(self):
        base={"horizon":4,"event_id":7,"policy":"ALL_ONSET"}
        got=policy_copy(base,"LOGISTIC_GATE")
        self.assertEqual(got["horizon"],4)
        self.assertEqual(got["event_id"],7)
        self.assertEqual(got["policy"],"LOGISTIC_GATE")

if __name__=="__main__":
    unittest.main(verbosity=2)
