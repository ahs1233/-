import unittest
import numpy as np
import pandas as pd

from confirmed_handoff_execution_v01 import STEP, path_ok, make_record

class ConfirmedHandoffExecutionTests(unittest.TestCase):
    def frame(self,n=40):
        x=np.arange(n); c=1900.0+0.5*x; s=np.full(n,0.1)
        return pd.DataFrame({
            "t":1577836800000+x*STEP,
            "bo":c,"bh":c+0.3,"bl":c-0.3,"bc":c,
            "ao":c+s,"ah":c+s+0.3,"al":c+s-0.3,"ac":c+s,
            "atr":np.full(n,5.0),
        })

    def event(self,d=1):
        return {
            "event_id":1,"onset_time":1577836800000,
            "resolution_time":1577836800000,
            "resolution_delay_bars":1,
            "resolved_direction":d,
            "resolution":"TREND_UP" if d==1 else "TREND_DOWN",
            "frozen_lower":1899.0,"frozen_upper":1902.0,
        }

    def test_path_accepts_short_closure(self):
        f=self.frame(); f.loc[1:,"t"]+=STEP
        self.assertTrue(path_ok(f.t.to_numpy(np.int64),0,4))

    def test_path_rejects_long_gap(self):
        f=self.frame(); f.loc[1:,"t"]+=4*STEP
        self.assertFalse(path_ok(f.t.to_numpy(np.int64),0,4))

    def test_entry_is_next_open(self):
        f=self.frame(); r=make_record(self.event(1),f,0,4)
        expected=(float(f.bc.iloc[4])-float(f.bo.iloc[1]))/5.0
        self.assertAlmostEqual(r["c0"],expected)

    def test_short_direction(self):
        f=self.frame(); r=make_record(self.event(-1),f,0,4)
        self.assertFalse(r["directional_correct"])
        self.assertLess(r["signed_displacement_atr"],0)

if __name__=="__main__":
    unittest.main(verbosity=2)
