import unittest
import numpy as np
import pandas as pd

from transition_logistic_shadow_v01 import (
    STEP, path_ok, policy_active, trade_record
)

class ShadowAuditTests(unittest.TestCase):
    def frame(self, n=40):
        x=np.arange(n)
        c=1900.0+0.5*x
        s=np.full(n,0.1)
        return pd.DataFrame({
            "t":1577836800000+x*STEP,
            "bo":c, "bh":c+0.3, "bl":c-0.3, "bc":c,
            "ao":c+s, "ah":c+s+0.3, "al":c+s-0.3, "ac":c+s,
            "atr":np.full(n,5.0),
        })

    def pred(self,p=.5,label=1):
        return {"p_logistic":p,"actual_label":label,"event_id":1,"time":1577836800000,
                "candidate_direction":1}

    def event(self,d=1):
        return {"event_id":1,"time":1577836800000,"candidate_direction":d,
                "frozen_lower":1899.0,"frozen_upper":1902.0}

    def test_gate_fixed_at_half(self):
        self.assertFalse(policy_active("LOGISTIC_GATE",self.pred(.4999)))
        self.assertTrue(policy_active("LOGISTIC_GATE",self.pred(.5)))
        self.assertTrue(policy_active("ALL_TRANSITIONS",self.pred(.1)))
        self.assertTrue(policy_active("ORACLE_TREND_SUBSET",self.pred(.1,1)))
        self.assertFalse(policy_active("ORACLE_TREND_SUBSET",self.pred(.9,0)))

    def test_short_closure_is_operationally_contiguous(self):
        f=self.frame()
        f.loc[1:,"t"] += STEP
        self.assertTrue(path_ok(f.t.to_numpy(np.int64),0,4))

    def test_long_gap_rejected(self):
        f=self.frame()
        f.loc[1:,"t"] += 4*STEP
        self.assertFalse(path_ok(f.t.to_numpy(np.int64),0,4))

    def test_trade_uses_next_open(self):
        f=self.frame()
        p=self.pred(.8,1); e=self.event(1)
        r=trade_record("LOGISTIC_GATE",p,e,f,0,4)
        self.assertTrue(r["active"])
        expected=(float(f.bc.iloc[4])-float(f.bo.iloc[1]))/5.0
        self.assertAlmostEqual(r["c0"],expected)

if __name__=="__main__":
    unittest.main(verbosity=2)
