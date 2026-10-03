import unittest
import numpy as np
import pandas as pd

from structural_range_box_scalper_v01 import (
    fresh_pivot, current_box, signal_from_box, precompute_box_state
)

T0 = 1577836800000
STEP = 3_600_000


class StructuralRangeBoxV01Tests(unittest.TestCase):
    def frame(self, closes, opens=None):
        if opens is None:
            opens = closes
        c = np.asarray(closes, dtype=float)
        o = np.asarray(opens, dtype=float)
        n = len(c)
        return pd.DataFrame({
            "t": [T0+i*STEP for i in range(n)],
            "bo": o, "bh": np.maximum(o,c)+0.2,
            "bl": np.minimum(o,c)-0.2, "bc": c,
            "ao": o+0.05, "ah": np.maximum(o,c)+0.25,
            "al": np.minimum(o,c)-0.15, "ac": c+0.05,
            "atr": np.ones(n),
        })

    def dc_event(self, direction, confirmed_at, pivot_at, pivot_price):
        return {
            "direction": direction,
            "confirmed_at": confirmed_at,
            "pivot_at": pivot_at,
            "pivot_price": pivot_price,
            "extreme_at": confirmed_at,
            "extreme": pivot_price,
        }

    def test_fresh_pivot_requires_current_confirmation_and_episode_pivot(self):
        d = self.dc_event(1, 5, 3, 100.0)
        self.assertIsNone(fresh_pivot(d, 4, 2))
        self.assertIsNone(fresh_pivot(d, 5, 4))
        kind, rec = fresh_pivot(d, 5, 2)
        self.assertEqual(kind, "LOW")
        self.assertEqual(rec["pivot_price"], 100.0)

    def test_current_box_uses_latest_two_each(self):
        lows = [
            {"confirmed_at":1,"pivot_at":0,"pivot_price":99.0},
            {"confirmed_at":3,"pivot_at":2,"pivot_price":100.0},
            {"confirmed_at":5,"pivot_at":4,"pivot_price":101.0},
        ]
        highs = [
            {"confirmed_at":2,"pivot_at":1,"pivot_price":106.0},
            {"confirmed_at":4,"pivot_at":3,"pivot_price":105.0},
            {"confirmed_at":6,"pivot_at":5,"pivot_price":104.0},
        ]
        b = current_box(lows, highs)
        self.assertAlmostEqual(b["lower"], 100.5)
        self.assertAlmostEqual(b["upper"], 104.5)

    def test_signal_quartile_rejection(self):
        f = self.frame([101.0, 104.0], opens=[100.5, 104.5])
        box = {
            "lower":100.0,"upper":104.0,"midpoint":102.0,"width":4.0,
            "low_confirmations":[1,2],"high_confirmations":[3,4],
            "low_prices":[99.8,100.2],"high_prices":[103.8,104.2],
            "oldest_confirmation":1,"newest_confirmation":4,
        }
        self.assertEqual(signal_from_box(0,f,box)["direction"],1)
        self.assertEqual(signal_from_box(1,f,box)["direction"],-1)

    def test_precompute_requires_two_highs_two_lows(self):
        f = self.frame([102.0]*8)
        states = {int(t):"RANGE" for t in f.t}
        dc = [self.dc_event(0,-1,-1,102.0) for _ in range(8)]
        dc[1] = self.dc_event(1,1,0,100.0)
        dc[2] = self.dc_event(-1,2,1,104.0)
        dc[3] = self.dc_event(1,3,2,100.5)
        boxes, stats, _ = precompute_box_state("library", f, states, dc)
        self.assertEqual(stats["mature_box_bars"],0)
        dc[4] = self.dc_event(-1,4,3,103.5)
        boxes, stats, _ = precompute_box_state("library", f, states, dc)
        self.assertGreater(stats["mature_box_bars"],0)
        self.assertIn(4, boxes)

    def test_hard_gap_resets_episode_memory(self):
        f = self.frame([102.0]*8)
        f.loc[4:,"t"] += 4*STEP
        states = {int(t):"RANGE" for t in f.t}
        dc = [self.dc_event(0,-1,-1,102.0) for _ in range(8)]
        dc[1] = self.dc_event(1,1,0,100.0)
        dc[2] = self.dc_event(-1,2,1,104.0)
        dc[3] = self.dc_event(1,3,2,100.5)
        dc[4] = self.dc_event(-1,4,4,103.5)
        boxes, stats, _ = precompute_box_state("library", f, states, dc)
        self.assertEqual(stats["hard_gap_resets"],1)
        self.assertNotIn(4, boxes)


if __name__ == "__main__":
    unittest.main(verbosity=2)
