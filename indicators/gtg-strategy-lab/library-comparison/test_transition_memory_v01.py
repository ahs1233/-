import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from transition_memory_v01_runner import (
    STEP, SPLIT, K, label_event, scalar_vector, sequence_vector,
    training_event_prefix, stable_topk
)
from multiscale_symbolic_v01 import ms


class TransitionMemoryV01Tests(unittest.TestCase):
    def base_event(self, direction=1, resolution="TREND_UP"):
        return {
            "event_id": 1,
            "time": ms("2020-06-01"),
            "candidate_direction": direction,
            "trigger_type": "BREAKOUT",
            "range_age": 8,
            "primary": True,
            "frozen_upper": 101.0,
            "frozen_lower": 99.0,
            "prior24_width_atr": 2.0,
            "position24": 0.8 if direction == 1 else 0.2,
            "dc0p5_dir": direction,
            "dc1p0_dir": direction,
            "dc2p0_dir": direction,
            "dc4p0_dir": direction,
            "dc_up_count": 4 if direction == 1 else 0,
            "dc_down_count": 4 if direction == -1 else 0,
            "drift12": 1.0 * direction,
            "drift24": 2.0 * direction,
            "drift48": 3.0 * direction,
            "efficiency24": 0.3,
            "efficiency48": 0.25,
            "spread_atr": 0.05,
            "atr_week_ratio": 1.1,
            "session_utc": "London",
            "fsm_resolution": resolution,
        }

    def test_label_contract(self):
        self.assertEqual(label_event(self.base_event(1, "TREND_UP")), 1)
        self.assertEqual(label_event(self.base_event(-1, "TREND_DOWN")), 1)
        self.assertEqual(label_event(self.base_event(1, "RANGE")), 0)
        with self.assertRaises(ValueError):
            label_event(self.base_event(1, "TREND_DOWN"))

    def test_canonical_scalar_up_down_match(self):
        up = scalar_vector(self.base_event(1, "TREND_UP"))
        down = scalar_vector(self.base_event(-1, "TREND_DOWN"))
        np.testing.assert_allclose(up, down, atol=0.0, rtol=0.0)

    def test_training_prefix_stops_before_2021(self):
        rows = [
            self.base_event(1, "TREND_UP"),
            {**self.base_event(1, "RANGE"), "event_id": 2, "time": ms("2020-12-31")},
            {**self.base_event(1, "TREND_UP"), "event_id": 3, "time": ms(SPLIT)},
            {**self.base_event(1, "TREND_UP"), "event_id": 4, "time": ms("2021-02-01")},
        ]
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "events.jsonl"
            with p.open("w", encoding="utf-8") as fh:
                for r in rows:
                    fh.write(json.dumps(r) + "\n")
            ev, _, first_eval = training_event_prefix(p)
        self.assertEqual([e["event_id"] for e in ev], [1, 2])
        self.assertEqual(first_eval, ms(SPLIT))

    def test_sequence_excludes_onset_and_canonicalizes(self):
        n = 20
        t0 = ms("2020-01-01")
        c = 100.0 + np.arange(n) * 0.1
        f = pd.DataFrame({
            "t": t0 + np.arange(n) * STEP,
            "bo": c, "bh": c + 0.2, "bl": c - 0.2, "bc": c,
            "ao": c + 0.01, "ah": c + 0.21, "al": c - 0.19, "ac": c + 0.01,
            "atr": np.ones(n),
        })
        i = 12
        e = self.base_event(1, "TREND_UP")
        e.update({
            "time": int(f.t.iloc[i]),
            "range_age": 6,
            "frozen_lower": 100.0,
            "frozen_upper": 102.0,
        })
        seq = sequence_vector(e, f, {int(v): j for j, v in enumerate(f.t)})
        self.assertEqual(seq.shape, (6, 3))
        expected_last_position = (float(f.bc.iloc[i-1]) - 100.0) / 2.0
        self.assertAlmostEqual(seq[-1, 0], expected_last_position)

    def test_stable_topk(self):
        d = np.array([1.0, 0.2, 0.2, 0.8, 2.0, 0.1, 3.0, 4.0])
        ix = stable_topk(d, K)
        self.assertEqual(list(ix[:4]), [5, 1, 2, 3])


if __name__ == "__main__":
    unittest.main(verbosity=2)

    def test_sequence_excludes_onset_and_uses_range_only(self):
        f = self.frame()
        e = self.event(1)
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        states = {int(v): "RANGE" for v in f.t.to_numpy(dtype=np.int64)}
        states[int(e["time"])] = "TRANSITION"
        seq = sequence_vector(e, f, t_to_i, states)
        self.assertEqual(seq.shape, (8, 3))
        # Last source row is the bar immediately before onset.
        expected = (f.bc.iloc[99] - 90.0) / 20.0
        self.assertAlmostEqual(seq[-1, 0], expected)

    def test_sequence_rejects_non_range_source(self):
        f = self.frame()
        e = self.event(1)
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        states = {int(v): "RANGE" for v in f.t.to_numpy(dtype=np.int64)}
        states[int(e["time"])] = "TRANSITION"
        states[int(f.t.iloc[96])] = "TREND_UP"
        with self.assertRaises(ValueError):
            sequence_vector(e, f, t_to_i, states)

    def test_sequence_accepts_short_gap_and_rejects_hard_gap(self):
        e = self.event(1)
        f = self.frame()
        # Two-hour timestamp gap between source bars remains operationally continuous.
        f.loc[96:, "t"] += STEP
        e["time"] = int(f.t.iloc[100])
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        states = {int(v): "RANGE" for v in f.t.to_numpy(dtype=np.int64)}
        states[int(e["time"])] = "TRANSITION"
        self.assertEqual(sequence_vector(e, f, t_to_i, states).shape, (8, 3))

        g = self.frame()
        g.loc[96:, "t"] += 4*STEP
        e2 = self.event(1)
        e2["time"] = int(g.t.iloc[100])
        t2 = {int(v): i for i, v in enumerate(g.t.to_numpy(dtype=np.int64))}
        s2 = {int(v): "RANGE" for v in g.t.to_numpy(dtype=np.int64)}
        s2[int(e2["time"])] = "TRANSITION"
        with self.assertRaises(ValueError):
            sequence_vector(e2, g, t2, s2)

    def test_stable_topk_tie_order(self):
        d = np.array([2.0, 1.0, 1.0, 3.0])
        np.testing.assert_array_equal(stable_topk(d, 3), [1, 2, 0])

    def test_fit_reader_stops_at_first_2021_event(self):
        old = self.event(1)
        old["time"] = int(pd.Timestamp("2020-12-31T20:00:00Z").timestamp()*1000)
        new = self.event(-1)
        new["event_id"] = 8
        new["time"] = int(pd.Timestamp("2021-01-01T01:00:00Z").timestamp()*1000)
        later = self.event(1)
        later["event_id"] = 9
        later["time"] = int(pd.Timestamp("2021-02-01T01:00:00Z").timestamp()*1000)

        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "events.jsonl"
            with p.open("w", encoding="utf-8") as fh:
                for e in (old, new, later):
                    fh.write(json.dumps(e) + "\n")
            events, prefix_sha, first_eval = training_event_prefix(p)

        self.assertEqual([e["event_id"] for e in events], [7])
        self.assertEqual(first_eval, new["time"])
        self.assertTrue(prefix_sha)
        self.assertNotIn(8, [e["event_id"] for e in events])
        self.assertNotIn(9, [e["event_id"] for e in events])


if __name__ == "__main__":
    unittest.main(verbosity=2)
