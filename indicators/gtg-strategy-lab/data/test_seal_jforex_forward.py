import json
import tempfile
import unittest
from pathlib import Path

import seal_jforex_forward as sjf
from store import read_manifest


class JForexForwardSealTests(unittest.TestCase):
    def make_side(self, base: Path, day: str, side: str, raw: bytes):
        d = sjf.day_dir(base, day)
        d.mkdir(parents=True, exist_ok=True)
        p = d / f"{side}_candles_min_1.bi5"
        p.write_bytes(raw)
        return p

    def make_export(self, base: Path, day: str, bid: bytes, ask: bytes):
        self.make_side(base, day, "BID", bid)
        self.make_side(base, day, "ASK", ask)
        marker = sjf.day_dir(base, day) / "FORWARD_COMPLETE.json"
        marker.write_text(json.dumps({
            "day": day,
            "bid_rows": len(bid) // sjf.RECORD_BYTES,
            "ask_rows": len(ask) // sjf.RECORD_BYTES,
            "source": "JForex API/IHistory",
            "api": "jforex-api 4.8.13",
            "completed_utc": "2026-10-04T00:00:00Z",
        }), encoding="utf-8")

    def test_seal_requires_and_records_cache_parity(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            export = base / "export"
            cache = base / "cache"
            root = base / "root"
            raw = bytes(range(24))
            self.make_export(export, "2026-10-01", raw, raw)
            self.make_side(cache, "2026-10-01", "BID", raw)
            self.make_side(cache, "2026-10-01", "ASK", raw)

            rep = sjf.seal(export, cache, root)
            self.assertEqual(rep["status"], "PASS")
            self.assertEqual(rep["sealed_new_days"], ["2026-10-01"])
            rows = read_manifest(root)
            self.assertEqual([x["kind"] for x in rows], ["forward_m1", "forward_m1_verify"])
            self.assertTrue(rows[1]["export_cache_match"])
            self.assertFalse(rows[1]["pristine_price_oos_decoded"])

    def test_cache_mismatch_refuses_seal(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            export = base / "export"
            cache = base / "cache"
            root = base / "root"
            a = bytes(range(24))
            b = bytes(reversed(range(24)))
            self.make_export(export, "2026-10-01", a, a)
            self.make_side(cache, "2026-10-01", "BID", b)
            self.make_side(cache, "2026-10-01", "ASK", a)

            with self.assertRaises(ValueError):
                sjf.seal(export, cache, root)
            self.assertEqual(read_manifest(root), [])

    def test_missing_cache_waits_without_sealing(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            export = base / "export"
            cache = base / "cache"
            root = base / "root"
            raw = bytes(range(24))
            self.make_export(export, "2026-10-01", raw, raw)

            rep = sjf.seal(export, cache, root)
            self.assertEqual(rep["status"], "WAITING_CACHE_VERIFICATION")
            self.assertEqual(rep["pending_cache_verification_days"], ["2026-10-01"])
            self.assertEqual(read_manifest(root), [])

    def test_existing_seal_gets_append_only_verification(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            export = base / "export"
            cache = base / "cache"
            root = base / "root"
            raw = bytes(range(24))
            self.make_export(export, "2026-10-01", raw, raw)
            self.make_side(cache, "2026-10-01", "BID", raw)
            self.make_side(cache, "2026-10-01", "ASK", raw)

            sjf.seal(export, cache, root)
            first = read_manifest(root)
            self.assertEqual(len(first), 2)
            rep = sjf.seal(export, cache, root)
            second = read_manifest(root)
            self.assertEqual(len(second), 2)
            self.assertEqual(rep["verified_existing_days"], ["2026-10-01"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
