import unittest
import numpy as np
import pandas as pd
from compare import dc_states, costs, guard_dates, bank_indices, frame_for, W, ms

class SafetyTests(unittest.TestCase):
    def test_dc_confirmation_not_backdated(self):
        states=dc_states([100,102,105,104,103.9],.01)
        self.assertEqual(states[2]["direction"],1)
        self.assertEqual(states[3]["direction"],1)
        self.assertEqual(states[4]["direction"],-1)
        self.assertEqual(states[4]["pivot_at"],2)
        self.assertEqual(states[4]["confirmed_at"],4)
    def test_dc_prefix(self):
        p=100*np.exp(np.cumsum(np.random.default_rng(3).normal(0,.004,300)))
        full=dc_states(p,.01)
        for cut in (1,3,50,150,299):
            self.assertEqual(full[:cut],dc_states(p[:cut],.01))
    def test_bad_price(self):
        with self.assertRaises(ValueError): dc_states([100,0],.01)
    def test_date_gate(self):
        guard_dates("2022-01-01","2022-04-01")
        for a,b in (("2022-01-01","2026-01-01"),("2021-01-01","2022-03-01"),
                    ("2022-03-01","2022-02-01")):
            with self.assertRaises(ValueError): guard_dates(a,b)
    def test_cost_sides(self):
        self.assertEqual(costs(1,100,101,110,111,2),{"c0":5.,"c1":4.,"c2":3.})
        self.assertEqual(costs(-1,110,111,100,101,2),{"c0":5.,"c1":4.,"c2":3.})
        self.assertEqual(costs(0,100,101,110,111,2),{"c0":0.,"c1":0.,"c2":0.})
        self.assertEqual(costs(1,100,102,110,111,1)["c1"],6.5)
        self.assertEqual(costs(-1,110,112,100,101,1)["c1"],7.5)
    def test_bank_labels_matured(self):
        n=450
        f=pd.DataFrame({"t":ms("2022-02-01")+np.arange(n)*300000,"atr":np.ones(n)})
        states=[{"direction":1}]*n
        chosen=bank_indices(f,400,3,300000,1,states)
        self.assertTrue(chosen)
        self.assertTrue(all(j+3<400-W+1 for j in chosen))
        self.assertTrue(all(f.t.iloc[j+3]+300000<=ms("2022-03-01") for j in chosen))
    def test_complete_buckets(self):
        t=ms("2022-01-03")+12*3600000
        rows=[dict(t=t+i*60000,bo=100.,bh=101.,bl=99.,bc=100.,
                   ao=100.1,ah=101.1,al=99.1,ac=100.1,v=1.,n=0,src="m1")
              for i in range(100)]
        f,q=frame_for(rows,"M5",300000)
        self.assertEqual(len(f),20)
        rows.pop(2)
        f,q=frame_for(rows,"M5",300000)
        self.assertEqual(len(f),19)
        self.assertEqual(q["incomplete_dropped"],1)
if __name__=="__main__": unittest.main(verbosity=2)
