import unittest
import numpy as np
import pandas as pd
from selective_swing_v03 import (
    agree2_direction, agree3_direction, guard_dates,
    eligible_anchors, ms, N_ANCHORS, W, H, STEP
)

class SelectiveSwingV03Tests(unittest.TestCase):
    def test_rules(self):
        self.assertEqual(agree2_direction(1.2,0.3),1)
        self.assertEqual(agree2_direction(-1.2,-0.3),-1)
        self.assertEqual(agree2_direction(1.2,-0.3),0)
        self.assertEqual(agree3_direction(1.2,0.3,0.7),1)
        self.assertEqual(agree3_direction(1.2,0.3,-0.7),0)

    def test_date_gate(self):
        guard_dates()

    def test_anchor_selection_uses_time_not_return(self):
        n=10000
        t0=ms("2019-12-20")
        t=t0+np.arange(n)*STEP
        f=pd.DataFrame({
            "t":t,
            "atr":np.ones(n),
            "bc":100+np.sin(np.arange(n)/17),
        })
        anchors=eligible_anchors(f)
        self.assertEqual(len(anchors),N_ANCHORS)
        self.assertTrue(all(ms("2020-01-01")<=f.t.iloc[q]<ms("2021-07-31") for q in anchors))
        self.assertTrue(all(b>a+H for a,b in zip(anchors,anchors[1:])))

if __name__=="__main__":
    unittest.main(verbosity=2)
