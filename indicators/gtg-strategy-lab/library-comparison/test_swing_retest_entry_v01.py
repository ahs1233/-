import unittest
import numpy as np
import pandas as pd
from swing_retest_entry_v01 import STEP, find_retest, make_trade

class RetestTests(unittest.TestCase):
    def frame(self):
        n=20; x=np.arange(n); c=np.full(n,101.0)
        f=pd.DataFrame({"t":1577836800000+x*STEP,"bo":c.copy(),"bh":c+0.2,
          "bl":c-0.2,"bc":c.copy(),"ao":c+0.1,"ah":c+0.3,"al":c-0.1,
          "ac":c+0.1,"atr":np.ones(n)})
        return f
    def ev(self,d=1):
        return {"event_id":1,"split":"evaluation","onset_time":1577836800000,
          "resolution_time":1577836800000,"resolved_direction":d,
          "frozen_upper":100.0,"frozen_lower":100.0}
    def test_up_first_retest(self):
        f=self.frame(); f.loc[1,["bo","bh","bl","bc"]]=[100.8,101.1,100.3,100.9]
        s=find_retest(self.ev(1),f,{int(v):i for i,v in enumerate(f.t)})
        self.assertEqual(s["reason"],"RETEST_ENTRY"); self.assertEqual(s["delay_bars"],1)
    def test_down_symmetric(self):
        f=self.frame(); f.loc[:,["bo","bh","bl","bc"]]=99.0
        f.loc[1,["bo","bh","bl","bc"]]=[99.2,99.7,98.9,99.1]
        s=find_retest(self.ev(-1),f,{int(v):i for i,v in enumerate(f.t)})
        self.assertEqual(s["reason"],"RETEST_ENTRY")
    def test_invalidation(self):
        f=self.frame(); f.loc[1,["bo","bh","bl","bc"]]=[99.0,99.2,98.8,99.0]
        s=find_retest(self.ev(1),f,{int(v):i for i,v in enumerate(f.t)})
        self.assertEqual(s["reason"],"INVALIDATED_BEFORE_RETEST")
    def test_next_open_execution(self):
        f=self.frame(); f.loc[1,["bo","bh","bl","bc"]]=[100.8,101.1,100.3,100.9]
        s=find_retest(self.ev(1),f,{int(v):i for i,v in enumerate(f.t)})
        r=make_trade(self.ev(1),s,f,4)
        self.assertEqual(r["entry_time"],int(f.t.iloc[2]))

if __name__=="__main__": unittest.main(verbosity=2)
