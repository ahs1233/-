import unittest
import numpy as np
import pandas as pd

from wave_memory_v01 import build_events, signatures, candidate_pool, feature_row, SIG_N

class WaveMemorySafetyTests(unittest.TestCase):
    def synthetic_frame(self, n=500, step=300000):
        # Deterministic triangular movement large enough to trigger DC confirmations.
        base = []
        levels = [100.0, 110.0, 90.0, 112.0, 88.0]
        while len(base) < n:
            for a, b in zip(levels[:-1], levels[1:]):
                for x in np.linspace(a, b, 12, endpoint=False):
                    base.append(float(x))
                    if len(base) >= n:
                        break
                if len(base) >= n:
                    break
        c = np.array(base[:n], dtype=float)
        return pd.DataFrame({
            "t": np.arange(n, dtype=np.int64) * step + 1640995200000,
            "bc": c,
            "atr": np.full(n, 2.0),
        })

    def test_confirmation_not_backdated(self):
        f = self.synthetic_frame()
        _, events = build_events(f, 0.05)
        self.assertGreater(len(events), 8)
        for e in events:
            self.assertGreaterEqual(e["confirm_i"], e["pivot_i"])

    def test_prefix_event_invariance(self):
        f = self.synthetic_frame()
        _, full = build_events(f, 0.05)
        self.assertGreater(len(full), 8)
        cut = full[7]["confirm_i"]
        _, prefix = build_events(f.iloc[:cut+1].copy(), 0.05)
        expected = [e for e in full if e["confirm_i"] <= cut]
        self.assertEqual(prefix, expected)

    def test_signature_uses_only_event_features(self):
        f = self.synthetic_frame()
        _, events = build_events(f, 0.05)
        x = np.vstack([feature_row(e) for e in events])
        med = np.median(x, axis=0)
        scale = np.maximum(np.percentile(x, 75, axis=0)-np.percentile(x, 25, axis=0), 1e-9)
        sigs = signatures(events, med, scale)
        self.assertTrue(sigs)
        for end, sig in sigs.items():
            self.assertEqual(sig.shape, (SIG_N, 6))
            self.assertTrue(np.all(np.isfinite(sig)))
            self.assertLessEqual(events[end]["confirm_i"], len(f)-1)

    def test_phase_alignment_and_maturity(self):
        n = 1400
        step = 300000
        f = pd.DataFrame({
            "t": np.arange(n, dtype=np.int64) * step + 1640995200000,
            "bc": 100 + np.arange(n, dtype=float) * 0.01,
            "atr": np.full(n, 1.0),
        })
        events = []
        for k in range(60):
            ci = 20 + k*20
            events.append({
                "confirm_i": ci,
                "confirm_t": int(f.t.iloc[ci]),
            })
        sigs = {e: np.zeros((SIG_N,6)) for e in range(SIG_N-1, len(events))}
        query_end = 59
        q = events[query_end]["confirm_i"] + 5
        pool = candidate_pool(f, events, sigs, query_end, q, h=3, step=step)
        self.assertTrue(pool)
        for end, anchor, _, _ in pool:
            self.assertEqual(anchor-events[end]["confirm_i"], 5)
            self.assertLess(anchor+3, q)
            if end+1 < len(events):
                self.assertGreater(events[end+1]["confirm_i"], anchor)

if __name__ == "__main__":
    unittest.main(verbosity=2)
