import unittest
import numpy as np
import pandas as pd
from trend_lifecycle_swing_v01 import lifecycle_trade, state_content_hash

STEP=3_600_000

class LifecycleTests(unittest.TestCase):
    def fixture(self):
        n=12; t=1577836800000+np.arange(n)*STEP
        c=1900.0+np.arange(n)*0.5; s=np.full(n,0.1)
        f=pd.DataFrame({"t":t,"bo":c,"bh":c+0.3,"bl":c-0.3,"bc":c,
          "ao":c+s,"ah":c+s+0.3,"al":c+s-0.3,"ac":c+s,
          "atr":np.full(n,5.0)})
        st=pd.DataFrame({"t":t,"state":["RANGE","TRANSITION","TREND_UP","TREND_UP",
          "TREND_UP","RANGE","RANGE","RANGE","RANGE","RANGE","RANGE","RANGE"]})
        e={"event_id":1,"resolution_time":int(t[2]),"resolved_direction":1,
           "resolution":"TREND_UP"}
        return e,st,f
    def test_exit_after_first_state_change(self):
        e,st,f=self.fixture()
        m={int(v):i for i,v in enumerate(f.t)}
        sm={int(v):i for i,v in enumerate(st.t)}
        r=lifecycle_trade(e,st,f,m,sm)
        self.assertEqual(r["status"],"TRADE")
        self.assertEqual(r["entry_time"],int(f.t.iloc[3]))
        self.assertEqual(r["exit_signal_time"],int(f.t.iloc[5]))
        self.assertEqual(r["exit_time"],int(f.t.iloc[6]))
        self.assertEqual(r["duration_trading_bars"],3)
    def test_hard_gap_censors(self):
        e,st,f=self.fixture()
        f.loc[4:,"t"]+=4*STEP; st.loc[4:,"t"]+=4*STEP
        m={int(v):i for i,v in enumerate(f.t)}
        sm={int(v):i for i,v in enumerate(st.t)}
        r=lifecycle_trade(e,st,f,m,sm)
        self.assertEqual(r["status"],"CENSORED_HARD_GAP")
    def test_direction_must_match_state(self):
        e,st,f=self.fixture(); e["resolved_direction"]=-1; e["resolution"]="TREND_DOWN"
        m={int(v):i for i,v in enumerate(f.t)}
        sm={int(v):i for i,v in enumerate(st.t)}
        with self.assertRaises(ValueError): lifecycle_trade(e,st,f,m,sm)
    def test_state_hash_deterministic(self):
        _,st,_=self.fixture()
        self.assertEqual(state_content_hash(st.state),state_content_hash(st.state.copy()))

if __name__=="__main__": unittest.main(verbosity=2)
