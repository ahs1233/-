import unittest
from dc_resumption_atr_bracket_v01 import barrier_levels, trigger_on_bar, scan_barrier


class ATRBracketTests(unittest.TestCase):
    def bar(self, t, bo=100, bh=100, bl=100, ao=100.1, ah=100.1, al=100.1):
        return {"t":t,"bo":bo,"bh":bh,"bl":bl,"bc":bo,"ao":ao,"ah":ah,"al":al,"ac":ao}

    def test_long_levels_use_ask(self):
        tp, sl = barrier_levels(1, 100.0, 100.2, 1.0)
        self.assertAlmostEqual(tp, 101.2)
        self.assertAlmostEqual(sl, 99.2)

    def test_short_levels_use_bid(self):
        tp, sl = barrier_levels(-1, 100.0, 100.2, 1.0)
        self.assertAlmostEqual(tp, 99.0)
        self.assertAlmostEqual(sl, 101.0)

    def test_ambiguous_is_conservative_stop(self):
        rows = [
            self.bar(0, bh=101.5, bl=98.5),
            self.bar(60000, bo=99.0, ao=99.1),
        ]
        r = scan_barrier(1, 100.0, 100.0, 1.0, rows, 240000)
        self.assertEqual(r["status"], "BARRIER")
        self.assertEqual(r["trigger"], "SL_AMBIGUOUS")

    def test_tp_executes_next_minute_open(self):
        rows = [
            self.bar(0, bh=101.2, bl=99.8),
            self.bar(60000, bo=101.1, ao=101.2),
        ]
        r = scan_barrier(1, 100.0, 100.0, 1.0, rows, 240000)
        self.assertEqual(r["trigger"], "TP")
        self.assertEqual(r["exit_time"], 60000)
        self.assertAlmostEqual(r["exit_bo"], 101.1)

    def test_missing_next_minute_censors(self):
        rows = [self.bar(0, bh=101.2, bl=99.8), self.bar(120000)]
        r = scan_barrier(1, 100.0, 100.0, 1.0, rows, 240000)
        self.assertEqual(r["status"], "CENSOR_NEXT_MINUTE_MISSING")

    def test_no_touch_times_out(self):
        rows = [self.bar(0, bh=100.5, bl=99.5), self.bar(60000, bh=100.4, bl=99.6)]
        r = scan_barrier(1, 100.0, 100.0, 1.0, rows, 120000)
        self.assertEqual(r["status"], "TIMEOUT")


if __name__ == "__main__":
    unittest.main(verbosity=2)
