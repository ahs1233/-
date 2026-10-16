"""Data-integrity gates (integrity.py) on synthetic stored days."""
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import integrity
from store import append_manifest, sha256, write_day

UTC = timezone.utc


def bar(t, px, ask=0.2, v=5.0):
    return {"t": t, "bo": px, "bh": px + 0.5, "bl": px - 0.5, "bc": px + 0.1,
            "ao": px + ask if ask is not None else None, "ah": px + 0.5 + ask if ask is not None else None,
            "al": px - 0.5 + ask if ask is not None else None, "ac": px + 0.1 + ask if ask is not None else None,
            "v": v, "n": 0, "src": "m1"}


def store_day(root, day, bars):
    p = write_day(root, day, bars)
    append_manifest(root, {"kind": "history_day", "day": f"{day:%Y-%m-%d}", "source": "m1", "bars": len(bars),
                           "m1_file": str(p.relative_to(root)), "m1_sha256": sha256(p.read_bytes())})
    return p


def day_bars(day, n=300, start_min=13 * 60):   # a Wednesday afternoon, in session
    t0 = int(day.timestamp() * 1000) + start_min * 60_000
    return [bar(t0 + k * 60_000, 4000 + (k % 7) * 0.3) for k in range(n)]


class Gates(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.day = datetime(2026, 7, 15, tzinfo=UTC)

    def test_clean_day_passes_with_diagnostics(self):
        bars = day_bars(self.day)
        del bars[100:130]                                     # a 30-minute in-session gap
        bars[200] = {**bars[200], "bc": bars[199]["bc"] + 60, "bh": bars[199]["bc"] + 61, "ac": bars[199]["bc"] + 60.2, "ah": bars[199]["bc"] + 61.2}   # a spike
        bars[201] = {**bars[201], "ao": None, "ah": None, "al": None, "ac": None}
        store_day(self.root, self.day, bars)
        r = integrity.run(self.root)
        self.assertEqual(r["verdict"], "PASS", r["per_day"][0]["errors"])
        d = r["per_day"][0]["diagnostics"]
        self.assertEqual([g["minutes"] for g in d["gaps"]], [31])
        self.assertGreaterEqual(len(d["spikes"]), 1)
        self.assertLess(d["ask_coverage"], 1.0)

    def test_each_hard_gate_fails(self):
        cases = {
            "G3": lambda b: {**b, "bh": b["bl"] - 1},
            "G5": lambda b: {**b, "ao": b["bo"] - 1},
            "G4": lambda b: {**b, "v": 0.0, "bo": 5.0, "bh": 5.0, "bl": 5.0, "bc": 5.0, "ao": None, "ah": None, "al": None, "ac": None},
        }
        for gate, bad in cases.items():
            root = Path(tempfile.mkdtemp())
            bars = day_bars(self.day)
            bars[10] = bad(bars[10])
            store_day(root, self.day, bars)
            r = integrity.run(root)
            self.assertEqual(r["verdict"], "FAIL", gate)
            self.assertIn(gate, {e[0] for e in r["per_day"][0]["errors"]})

    def test_duplicate_time_and_foreign_day_fail_g2(self):
        bars = day_bars(self.day)
        bars[5] = {**bars[5], "t": bars[4]["t"]}
        bars.append(bar(int(self.day.timestamp() * 1000) + 86_400_000, 4000))
        store_day(self.root, self.day, bars)
        errs = integrity.run(self.root)["per_day"][0]["errors"]
        self.assertEqual({e[0] for e in errs}, {"G2"})
        self.assertEqual(len(errs), 2)

    def test_manifest_hash_mismatch_fails_g1(self):
        p = store_day(self.root, self.day, day_bars(self.day))
        store_day(self.root, datetime(2026, 7, 16, tzinfo=UTC), day_bars(datetime(2026, 7, 16, tzinfo=UTC)))
        p.write_bytes(p.read_bytes()[:-3] + b"xyz")
        r = integrity.run(self.root)
        self.assertEqual(r["verdict"], "FAIL")
        self.assertEqual(r["per_day"][0]["errors"][0][0], "G1")

    def test_missing_weekdays_are_listed(self):
        store_day(self.root, self.day, day_bars(self.day))
        mon = datetime(2026, 7, 20, tzinfo=UTC)
        store_day(self.root, mon, day_bars(mon))
        self.assertEqual(integrity.run(self.root)["missing_weekdays"], ["2026-07-16", "2026-07-17"])


if __name__ == "__main__":
    unittest.main()
