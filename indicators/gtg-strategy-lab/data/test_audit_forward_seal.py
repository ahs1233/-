import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import audit_forward_seal as afs


class ForwardSealAuditTests(unittest.TestCase):
    def write_manifest(self, root: Path, rows):
        with (root / "manifest.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r) + "\n")

    def write_raw(self, root: Path, day: str, side: str, raw: bytes):
        y, m, d = day.split("-")
        p = root / "raw" / "forward" / y / m / d / f"{side}_candles_min_1.bi5"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(raw)
        return p

    def row(self, day: str, bid=b"bid", ask=b"ask"):
        return {
            "kind": "forward_m1",
            "day": day,
            "origin": "jforex-ihistory-export",
            "bid_bytes": len(bid),
            "ask_bytes": len(ask),
            "bid_sha256": hashlib.sha256(bid).hexdigest(),
            "ask_sha256": hashlib.sha256(ask).hexdigest(),
        }

    def verification(self, row):
        return {
            "kind": "forward_m1_verify",
            "day": row["day"],
            "origin": "jforex-ihistory-export",
            "source": "JForex API/IHistory",
            "export_cache_match": True,
            "bid_export_sha256": row["bid_sha256"],
            "bid_cache_sha256": row["bid_sha256"],
            "ask_export_sha256": row["ask_sha256"],
            "ask_cache_sha256": row["ask_sha256"],
        }

    def test_valid_sealed_day(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            day = "2026-10-01"
            row = self.row(day)
            self.write_manifest(root, [row, self.verification(row)])
            self.write_raw(root, day, "BID", b"bid")
            self.write_raw(root, day, "ASK", b"ask")
            rep = afs.audit(root)
            self.assertEqual(rep["status"], "PASS")
            self.assertFalse(rep["decoded_market_data"])

    def test_hash_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            day = "2026-10-01"
            row = self.row(day)
            self.write_manifest(root, [row, self.verification(row)])
            self.write_raw(root, day, "BID", b"wrong")
            self.write_raw(root, day, "ASK", b"ask")
            rep = afs.audit(root)
            self.assertEqual(rep["status"], "FAIL")
            self.assertTrue(any(i["type"] == "SHA256_MISMATCH" for i in rep["issues"]))

    def test_derived_m1_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            day = "2026-10-01"
            row = self.row(day)
            self.write_manifest(root, [row, self.verification(row)])
            self.write_raw(root, day, "BID", b"bid")
            self.write_raw(root, day, "ASK", b"ask")
            p = root / "m1" / "2026" / "10" / f"{day}.csv.gz"
            p.parent.mkdir(parents=True)
            p.write_bytes(b"not decoded by audit")
            rep = afs.audit(root)
            self.assertEqual(rep["status"], "FAIL")
            self.assertTrue(any(i["type"] == "DERIVED_CANONICAL_M1_EXISTS" for i in rep["issues"]))

    def test_non_forward_manifest_after_freeze_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            day = "2026-10-01"
            row = self.row(day)
            self.write_manifest(root, [row, self.verification(row), {"kind": "history_day", "day": day}])
            self.write_raw(root, day, "BID", b"bid")
            self.write_raw(root, day, "ASK", b"ask")
            rep = afs.audit(root)
            self.assertEqual(rep["status"], "FAIL")
            self.assertTrue(any(i["type"] == "NON_FORWARD_MANIFEST_AFTER_FREEZE_DAY" for i in rep["issues"]))

    def test_missing_cache_verification_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            day = "2026-10-01"
            row = self.row(day)
            self.write_manifest(root, [row])
            self.write_raw(root, day, "BID", b"bid")
            self.write_raw(root, day, "ASK", b"ask")
            rep = afs.audit(root)
            self.assertEqual(rep["status"], "FAIL")
            self.assertTrue(any(i["type"] == "MISSING_JFOREX_CACHE_VERIFICATION" for i in rep["issues"]))

    def test_orphan_raw_forward_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.write_raw(root, "2026-10-01", "BID", b"orphan")
            rep = afs.audit(root)
            self.assertEqual(rep["status"], "FAIL")
            self.assertTrue(any(i["type"] == "ORPHAN_RAW_FORWARD" for i in rep["issues"]))

    def test_noncanonical_forward_origin_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            day = "2026-10-01"
            row = self.row(day)
            row["origin"] = "public-datafeed"
            self.write_manifest(root, [row, self.verification(row)])
            self.write_raw(root, day, "BID", b"bid")
            self.write_raw(root, day, "ASK", b"ask")
            rep = afs.audit(root)
            self.assertEqual(rep["status"], "FAIL")
            self.assertTrue(any(i["type"] == "NON_CANONICAL_FORWARD_ORIGIN" for i in rep["issues"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
