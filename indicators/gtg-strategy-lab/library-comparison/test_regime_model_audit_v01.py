import unittest
import pandas as pd

from regime_model_audit_v01 import common_model_rows, candidate_screen


class RegimeModelAuditTests(unittest.TestCase):
    def row(self, t, model, c1=0.2, c2=0.1, direction=1, actual=1.0):
        return {
            "track": "swing", "time": t, "model": model,
            "direction": direction, "actual": actual,
            "c0": c1 + 0.1, "c1": c1, "c2": c2,
        }

    def test_common_model_rows_exact_intersection(self):
        rows = []
        for t in (1609459200000, 1609462800000, 1609466400000):
            for m in ("kronos_mini", "drift", "dc_direction"):
                rows.append(self.row(t, m))
        out, times = common_model_rows(rows, "2021-01-01", "2021-07-31", "A")
        self.assertEqual(len(times), 3)
        self.assertEqual(len(out), 9)

    def test_candidate_screen_requires_both_windows_and_stress(self):
        rows = []
        base_a = 1609459200000
        base_b = 1632873600000
        for i in range(40):
            rows.append({
                **self.row(base_a + i*3600000, "kronos_mini", c1=0.2, c2=0.1),
                "window": "A", "state": 0,
            })
        for i in range(40):
            rows.append({
                **self.row(base_b + i*86400000, "kronos_mini", c1=0.2, c2=0.1),
                "window": "B", "state": 0,
            })
        df = pd.DataFrame(rows)
        result = candidate_screen(df, 0)
        self.assertTrue(result["checks"]["n_A_ge_30"])
        self.assertTrue(result["checks"]["n_B_ge_30"])
        self.assertTrue(result["checks"]["c1_A_positive"])
        self.assertTrue(result["checks"]["c1_B_positive"])
        self.assertTrue(result["checks"]["pooled_c2_nonnegative"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
