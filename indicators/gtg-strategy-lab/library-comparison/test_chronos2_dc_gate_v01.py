import unittest
from chronos2_dc_gate_v01 import metrics

class Chronos2DCGateTests(unittest.TestCase):
    def test_metrics_empty(self):
        self.assertEqual(metrics([])["n"],0)

    def test_metrics(self):
        rows=[
            {"direction":1,"c0":1.0,"c1":0.5,"c2":0.0,"exit_reason":"TP"},
            {"direction":-1,"c0":-1.0,"c1":-0.5,"c2":-1.0,"exit_reason":"SL"},
        ]
        m=metrics(rows)
        self.assertEqual(m["n"],2)
        self.assertEqual(m["long_n"],1)
        self.assertEqual(m["short_n"],1)
        self.assertAlmostEqual(m["c1_mean_per_trade"],0.0)
        self.assertAlmostEqual(m["c1_win_rate"],0.5)

if __name__=="__main__":
    unittest.main(verbosity=2)
