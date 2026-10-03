import unittest
import numpy as np
import pandas as pd

from tslearn.metrics import cdist_dtw
from wave_memory_v01 import (
    build_events, signatures, candidate_pool, feature_row, dtw_distances,
    robust_params, last_event_at, ms, SIG_N
)


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
            self.assertEqual(e["confirm_t"], int(f.t.iloc[e["confirm_i"]]))

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
        scale = np.maximum(
            np.percentile(x, 75, axis=0) - np.percentile(x, 25, axis=0),
            1e-9,
        )
        sigs = signatures(events, med, scale)
        self.assertTrue(sigs)
        for end, sig in sigs.items():
            self.assertEqual(sig.shape, (SIG_N, 6))
            self.assertTrue(np.all(np.isfinite(sig)))
            self.assertLessEqual(events[end]["confirm_i"], len(f)-1)

    def test_chunked_dtw_exact_equivalence(self):
        rng = np.random.default_rng(7)
        query = rng.normal(size=(1, SIG_N, 6))
        bank = rng.normal(size=(17, SIG_N, 6))
        full = cdist_dtw(
            query, bank,
            global_constraint="sakoe_chiba",
            sakoe_chiba_radius=2,
        )[0]
        chunked = dtw_distances(query, bank, chunk_size=4)
        np.testing.assert_allclose(chunked, full, rtol=0.0, atol=1e-12)

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
        sigs = {e: np.zeros((SIG_N, 6)) for e in range(SIG_N-1, len(events))}
        query_end = 59
        q = events[query_end]["confirm_i"] + 5
        pool = candidate_pool(f, events, sigs, query_end, q, h=3, step=step)
        self.assertTrue(pool)
        for end, anchor, _, _ in pool:
            self.assertEqual(anchor-events[end]["confirm_i"], 5)
            self.assertLess(anchor+3, q)
            if end+1 < len(events):
                self.assertGreater(events[end+1]["confirm_i"], anchor)

    def test_last_event_at_never_uses_future_confirmation(self):
        f = self.synthetic_frame(n=800)
        _, events = build_events(f, 0.05)
        for q in (100, 250, 500, 700):
            k = last_event_at(events, q)
            if k >= 0:
                self.assertLessEqual(events[k]["confirm_i"], q)
                if k + 1 < len(events):
                    self.assertGreater(events[k+1]["confirm_i"], q)

    def test_robust_scaler_ignores_development_events(self):
        base = []
        for i in range(30):
            base.append({
                "confirm_t": ms("2022-06-01") + i,
                "amplitude_pct": 0.01 + i*1e-5,
                "duration_bars": 10,
                "confirmation_lag_bars": 2,
                "speed": 0.001,
                "atr_amplitude": 1.0,
                "retrace_ratio": 1.0,
            })
        poison = dict(base[-1])
        poison["confirm_t"] = ms("2023-06-01")
        poison["amplitude_pct"] = 999.0
        med1, scale1 = robust_params(base)
        med2, scale2 = robust_params(base + [poison])
        np.testing.assert_allclose(med1, med2)
        np.testing.assert_allclose(scale1, scale2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
