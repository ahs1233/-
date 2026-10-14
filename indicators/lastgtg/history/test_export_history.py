"""export_history.stream gives the same bars as gtg-strategy-lab bars.aggregate.

    python3 -m unittest indicators/lastgtg/history/test_export_history.py
"""
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_history as eh  # noqa: E402
from bars import aggregate  # noqa: E402  (path added by export_history)


def synthetic_days(seed=7, start=1735689600000, days=20):
    """M1 bars over `days` UTC days from 2025-01-01, with gaps, in time order."""
    rnd = random.Random(seed)
    out, px = [], 2600.0
    for d in range(days):
        day = []
        t0 = start + d * 86_400_000
        for m in range(1440):
            if rnd.random() < 0.05:
                continue
            o = px; c = round(o + rnd.uniform(-1, 1), 3); px = c
            day.append({"t": t0 + m * 60_000, "bo": o, "bh": max(o, c) + 0.2, "bl": min(o, c) - 0.2, "bc": c,
                        "ao": o + 0.3, "ah": max(o, c) + 0.5, "al": min(o, c) + 0.1, "ac": c + 0.3, "v": rnd.uniform(0, 5), "n": 0, "src": "m1"})
        out.append(day)
    return out


class StreamEqualsAggregate(unittest.TestCase):
    def test_every_timeframe(self):
        days = synthetic_days()
        flat = [b for d in days for b in d]
        got = {tf: [] for tf in ("M1",) + eh.TFS}
        sinks = {tf: got[tf].append for tf in got}
        counts = eh.stream(days, eh.TFS, days[3][0]["t"], sinks)
        for tf in eh.TFS:
            ref = [[b["t"], b["bo"], b["bh"], b["bl"], b["bc"], b["v"]] for b in aggregate(flat, tf)]
            self.assertEqual(len(got[tf]), len(ref), tf)
            for x, y in zip(got[tf], ref):
                self.assertEqual(x[:5], y[:5], tf)
                self.assertAlmostEqual(x[5], y[5], places=9)
        ref_m1 = [b for b in aggregate(flat, "M1") if b["t"] >= days[3][0]["t"]]
        self.assertEqual([r[0] for r in got["M1"]], [b["t"] for b in ref_m1])
        self.assertEqual([r[6:] for r in got["M1"]], [[b["ah"], b["al"], b["ac"]] for b in ref_m1])
        self.assertEqual(counts["in_session"] + counts["out_of_session"], len(flat))
        self.assertGreater(counts["out_of_session"], 0)


if __name__ == "__main__":
    unittest.main()
