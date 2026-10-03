import unittest
import numpy as np
import pandas as pd
from event_library_v02 import (
    dc_states, costs, guard_dates, candidate_indices, event_predict,
    complete_aggregate, ms, W
)

class EventLibrarySafetyTests(unittest.TestCase):
    def test_date_gate(self):
        guard_dates("2018-03-01","2024-03-20")
        for a,b in (
            ("2018-02-28","2024-03-20"),
            ("2018-03-01","2024-03-21"),
            ("2023-01-01","2022-01-01"),
        ):
            with self.assertRaises(ValueError):
                guard_dates(a,b)

    def test_dc_prefix_causal(self):
        p=100*np.exp(np.cumsum(np.random.default_rng(7).normal(0,.004,500)))
        full=dc_states(p,.01)
        for cut in (1,3,50,250,499):
            self.assertEqual(full[:cut],dc_states(p[:cut],.01))

    def test_confirmation_not_backdated(self):
        states=dc_states([100,102,105,104,103.9],.01)
        self.assertEqual(states[4]["direction"],-1)
        self.assertEqual(states[4]["pivot_at"],2)
        self.assertEqual(states[4]["confirmed_at"],4)

    def test_fixed_bank_bounds(self):
        n=300
        t0=ms("2021-12-20")
        f=pd.DataFrame({
            "t":t0+np.arange(n)*3600000,
            "atr":np.ones(n),
            "bc":100+np.sin(np.arange(n)/11),
        })
        states=[{"direction":1,"confirmed_at":i if i%12==0 else -1} for i in range(n)]
        chosen=candidate_indices(f,280,4,3600000,states,"event_fixed")
        self.assertTrue(chosen)
        self.assertTrue(all(f.t.iloc[j+4] < ms("2022-01-01") for j in chosen))

    def test_expanding_maturity(self):
        n=350
        t0=ms("2022-04-01")
        f=pd.DataFrame({
            "t":t0+np.arange(n)*300000,
            "atr":np.ones(n),
            "bc":100+np.sin(np.arange(n)/9),
        })
        states=[{"direction":1,"confirmed_at":i if i%15==0 else -1} for i in range(n)]
        q=320
        chosen=candidate_indices(f,q,3,300000,states,"event_expanding")
        self.assertTrue(chosen)
        self.assertTrue(all(f.t.iloc[j+3] < f.t.iloc[q] for j in chosen))

    def test_independent_neighbor_spacing(self):
        n=15500
        t0=ms("2021-11-01")
        x=np.arange(n)
        f=pd.DataFrame({
            "t":t0+x*300000,
            "atr":np.ones(n),
            "bc":100+0.01*x+np.sin(x/17),
        })
        states=[{"direction":1,"confirmed_at":i if i%120==0 else -1} for i in range(n)]
        pred,meta=event_predict(f,15000,3,300000,states,"event_fixed")
        self.assertEqual(meta["reason"],"ok")
        neigh=meta["neighbors"]
        self.assertGreaterEqual(len(neigh),5)
        for i,a in enumerate(neigh):
            for b in neigh[i+1:]:
                self.assertGreaterEqual(abs(a-b),W)
        self.assertTrue(np.isfinite(pred))

    def test_complete_aggregation(self):
        t=ms("2022-01-03")+12*3600000
        rows=[dict(t=t+i*60000,bo=100.,bh=101.,bl=99.,bc=100.,
                   ao=100.1,ah=101.1,al=99.1,ac=100.1,v=1.,n=0,src="m1")
              for i in range(10)]
        kept,dropped=complete_aggregate(rows,"M5",300000)
        self.assertEqual((len(kept),dropped),(2,0))
        rows.pop(2)
        kept,dropped=complete_aggregate(rows,"M5",300000)
        self.assertEqual((len(kept),dropped),(1,1))

    def test_cost_sides(self):
        self.assertEqual(costs(1,100,101,110,111,2),{"c0":5.,"c1":4.,"c2":3.})
        self.assertEqual(costs(-1,110,111,100,101,2),{"c0":5.,"c1":4.,"c2":3.})
        self.assertEqual(costs(0,100,101,110,111,2),{"c0":0.,"c1":0.,"c2":0.})

if __name__=="__main__":
    unittest.main(verbosity=2)
