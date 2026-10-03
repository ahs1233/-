import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from transition_memory_v01_runner import (
    STEP, SPLIT, K,
    label_event, scalar_vector, sequence_vector,
    training_event_prefix, stable_topk,
)
from multiscale_symbolic_v01 import ms


class TransitionMemoryV01Tests(unittest.TestCase):
    def base_event(self, direction=1, resolution=None):
        if resolution is None:
            resolution = "TREND_UP" if direction == 1 else "TREND_DOWN"
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
            "efficiency24": 0.30,
            "efficiency48": 0.25,
            "spread_atr": 0.05,
            "atr_week_ratio": 1.10,
            "session_utc": "London",
            "fsm_resolution": resolution,
        }

    def frame(self, n=130):
        x = np.arange(n)
        c = 100.0 + 0.05*x
        return pd.DataFrame({
            "t": x*STEP,
            "bo": c, "bh": c+0.5, "bl": c-0.5, "bc": c,
            "ao": c+0.1, "ah": c+0.6, "al": c-0.4, "ac": c+0.1,
            "atr": np.full(n, 2.0),
        })

    def state_map_for(self, f, onset_time):
        states = {int(v): "RANGE" for v in f.t.to_numpy(dtype=np.int64)}
        states[int(onset_time)] = "TRANSITION"
        return states

    def test_label_contract(self):
        self.assertEqual(label_event(self.base_event(1, "TREND_UP")), 1)
        self.assertEqual(label_event(self.base_event(-1, "TREND_DOWN")), 1)
        self.assertEqual(label_event(self.base_event(1, "RANGE")), 0)
        self.assertIsNone(label_event(self.base_event(1, "UNRESOLVED_GAP")))
        with self.assertRaises(ValueError):
            label_event(self.base_event(1, "TREND_DOWN"))

    def test_canonical_scalar_up_down_match(self):
        up = scalar_vector(self.base_event(1))
        down = scalar_vector(self.base_event(-1))
        self.assertEqual(len(up), 15)
        np.testing.assert_allclose(up, down, atol=0.0, rtol=0.0)

    def test_sequence_excludes_onset_and_uses_range_only(self):
        f = self.frame()
        e = self.base_event(1)
        e["time"] = int(f.t.iloc[100])
        e["frozen_lower"] = 90.0
        e["frozen_upper"] = 110.0
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        states = self.state_map_for(f, e["time"])
        seq = sequence_vector(e, f, t_to_i, states)
        self.assertEqual(seq.shape, (8, 3))
        expected = (f.bc.iloc[99] - 90.0) / 20.0
        self.assertAlmostEqual(seq[-1, 0], expected)

    def test_sequence_rejects_non_range_source(self):
        f = self.frame()
        e = self.base_event(1)
        e["time"] = int(f.t.iloc[100])
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        states = self.state_map_for(f, e["time"])
        states[int(f.t.iloc[96])] = "TREND_UP"
        with self.assertRaises(ValueError):
            sequence_vector(e, f, t_to_i, states)

    def test_sequence_accepts_short_gap(self):
        f = self.frame()
        f.loc[96:, "t"] += STEP
        e = self.base_event(1)
        e["time"] = int(f.t.iloc[100])
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        states = self.state_map_for(f, e["time"])
        self.assertEqual(sequence_vector(e, f, t_to_i, states).shape, (8, 3))

    def test_sequence_rejects_hard_gap(self):
        f = self.frame()
        f.loc[96:, "t"] += 4*STEP
        e = self.base_event(1)
        e["time"] = int(f.t.iloc[100])
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        states = self.state_map_for(f, e["time"])
        with self.assertRaises(ValueError):
            sequence_vector(e, f, t_to_i, states)

    def test_sequence_caps_at_24_and_minimum_6(self):
        f = self.frame()
        t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
        e = self.base_event(1)
        e["time"] = int(f.t.iloc[100])
        e["range_age"] = 40
        states = self.state_map_for(f, e["time"])
        self.assertEqual(sequence_vector(e, f, t_to_i, states).shape[0], 24)
        e["range_age"] = 5
        with self.assertRaises(ValueError):
            sequence_vector(e, f, t_to_i, states)

    def test_training_prefix_stops_at_first_2021_event(self):
        old1 = self.base_event(1)
        old1["time"] = ms("2020-06-01")
        old2 = self.base_event(1, "RANGE")
        old2.update({"event_id": 2, "time": ms("2020-12-31")})
        first_eval = self.base_event(-1)
        first_eval.update({"event_id": 3, "time": ms(SPLIT)})
        later = self.base_event(1)
        later.update({"event_id": 4, "time": ms("2021-02-01")})
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "events.jsonl"
            with p.open("w", encoding="utf-8") as fh:
                for e in (old1, old2, first_eval, later):
                    fh.write(json.dumps(e) + "\n")
            events, prefix_sha, stopped_at = training_event_prefix(p)
        self.assertEqual([e["event_id"] for e in events], [1, 2])
        self.assertEqual(stopped_at, ms(SPLIT))
        self.assertTrue(prefix_sha)

    def test_training_prefix_rejects_nonchronological(self):
        newer = self.base_event(1)
        newer["time"] = ms("2020-12-31")
        older = self.base_event(1)
        older.update({"event_id": 2, "time": ms("2020-01-01")})
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "events.jsonl"
            with p.open("w", encoding="utf-8") as fh:
                fh.write(json.dumps(newer) + "\n")
                fh.write(json.dumps(older) + "\n")
            with self.assertRaises(ValueError):
                training_event_prefix(p)

    def test_stable_topk_tie_order(self):
        d = np.array([2.0, 1.0, 1.0, 3.0, 0.5, 0.5, 4.0, 5.0])
        ix = stable_topk(d, K)
        self.assertEqual(list(ix[:6]), [4, 5, 1, 2, 0, 3])


if __name__ == "__main__":
    unittest.main(verbosity=2)
