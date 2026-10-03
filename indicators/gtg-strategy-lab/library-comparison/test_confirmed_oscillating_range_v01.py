import unittest
import numpy as np
import pandas as pd

from confirmed_oscillating_range_v01 import (
    new_episode, update_episode, eligible_signal, zone, INIT_BARS
)

T0 = 1577836800000
STEP = 3_600_000


class ConfirmedOscillatingRangeV01Tests(unittest.TestCase):
    def row(self, i, o, h, l, c):
        return pd.Series({"t":T0+i*STEP,"bo":o,"bh":h,"bl":l,"bc":c})

    def test_freeze_after_exactly_six_bars(self):
        ep = new_episode(0,T0)
        rows = [
            self.row(0,101,102,100,101),
            self.row(1,101,103,100.5,102),
            self.row(2,102,104,101,103),
            self.row(3,103,103.5,100.2,101),
            self.row(4,101,102.5,99.5,100.5),
            self.row(5,100.5,103,100,102),
        ]
        for i,r in enumerate(rows):
            ep, event = update_episode(ep,i,r)
        self.assertTrue(ep["frozen"])
        self.assertEqual(ep["bars"], INIT_BARS)
        self.assertAlmostEqual(ep["lower"],99.5)
        self.assertAlmostEqual(ep["upper"],104.0)
        self.assertEqual(event,"BOX_FROZEN")

    def test_full_traverse_confirms(self):
        ep = new_episode(0,T0)
        for i in range(6):
            ep, _ = update_episode(ep,i,self.row(i,101,104,100,102))
        # lower zone first, then upper zone
        ep, _ = update_episode(ep,6,self.row(6,101.2,101.5,100.2,100.8))
        self.assertEqual(ep["first_zone"],"LOWER")
        ep, event = update_episode(ep,7,self.row(7,102.8,103.8,102.5,103.4))
        self.assertTrue(ep["confirmed"])
        self.assertEqual(event,"OSCILLATION_CONFIRMED")
        self.assertEqual(ep["traverse"],"LOWER_TO_UPPER")

    def test_confirmation_bar_not_eligible(self):
        ep = new_episode(0,T0)
        for i in range(6):
            ep, _ = update_episode(ep,i,self.row(i,101,104,100,102))
        ep, _ = update_episode(ep,6,self.row(6,101.2,101.5,100.2,100.8))
        ep, _ = update_episode(ep,7,self.row(7,103.8,103.9,102.5,103.4))
        # bearish upper rejection on confirmation bar must still be blocked
        d = eligible_signal(ep,7,self.row(7,103.8,103.9,102.5,103.4))
        self.assertEqual(d,0)

    def test_next_bar_edge_rejection_eligible(self):
        ep = new_episode(0,T0)
        for i in range(6):
            ep, _ = update_episode(ep,i,self.row(i,101,104,100,102))
        ep, _ = update_episode(ep,6,self.row(6,101.2,101.5,100.2,100.8))
        ep, _ = update_episode(ep,7,self.row(7,102.8,103.8,102.5,103.4))
        # next bar remains upper quartile and closes inward/bearish
        r = self.row(8,103.6,103.8,102.8,103.2)
        ep, _ = update_episode(ep,8,r)
        self.assertEqual(eligible_signal(ep,8,r),-1)

    def test_close_outside_invalidates_box(self):
        ep = new_episode(0,T0)
        for i in range(6):
            ep, _ = update_episode(ep,i,self.row(i,101,104,100,102))
        ep, event = update_episode(ep,6,self.row(6,104.2,104.5,103.8,104.2))
        self.assertEqual(event,"BOX_INVALIDATED")
        self.assertFalse(ep["valid"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
