import unittest
import numpy as np
from dc_resumption_market_condition_atlas_v01 import FEATURES, canonical_labels, hypothesis_status


class MarketConditionAtlasTests(unittest.TestCase):
    def test_no_outcome_feature(self):
        forbidden={"c0","c1","c2","exit_reason","holding_minutes","mfe_atr","mae_atr"}
        self.assertTrue(forbidden.isdisjoint(FEATURES))

    def test_canonical_labels_by_atr_then_efficiency(self):
        centers=np.zeros((4,len(FEATURES)))
        ai=FEATURES.index("atr_week_ratio")
        ei=FEATURES.index("efficiency24")
        centers[:,ai]=[2.0,1.0,1.0,3.0]
        centers[:,ei]=[0.1,0.4,0.2,0.1]
        raw=np.array([0,1,2,3])
        got=canonical_labels(raw,centers)
        # order old 2, old 1, old 0, old 3
        self.assertEqual(list(got),[2,1,0,3])

    def test_hypothesis_requires_stable_sign(self):
        s={"n":20,"by_period":{
            "LIBRARY_2018_2020":{"n":7,"c1_mean_per_trade":0.1},
            "TRAIN_2021_2024":{"n":8,"c1_mean_per_trade":0.2},
            "VALIDATION_2024_2025":{"n":5,"c1_mean_per_trade":0.3},
        }}
        ok,reason=hypothesis_status(s)
        self.assertTrue(ok)
        self.assertEqual(reason,"stable_positive")
        s["by_period"]["VALIDATION_2024_2025"]["c1_mean_per_trade"]=-0.1
        ok,_=hypothesis_status(s)
        self.assertFalse(ok)


if __name__=="__main__":
    unittest.main(verbosity=2)
