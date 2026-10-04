import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from capture_microstructure_forward import (
    _observed_at,
    audit_root,
    canonical_bytes,
    exclusive_lock,
    source_health_summary,
    store_snapshot,
    with_force,
)


class MicrostructureForwardTests(unittest.TestCase):
    def payload(self, value=1):
        return {
            "status": "ready",
            "observed_at": "2026-10-04T00:00:00+00:00",
            "value": value,
            "source_health": {
                "okx_xau_swap": {"available": True, "status": "ready", "error": None},
                "bitfinex_xaut": {"available": False, "status": "unavailable", "error": "TimeoutError"},
            },
        }

    def test_canonical_bytes_deterministic(self):
        a = {"b": 2, "a": 1}
        b = {"a": 1, "b": 2}
        self.assertEqual(canonical_bytes(a), canonical_bytes(b))

    def test_force_query(self):
        self.assertEqual(
            with_force("http://127.0.0.1/x?foo=1", True),
            "http://127.0.0.1/x?foo=1&force=true",
        )

    def test_store_and_audit(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            now = datetime(2026, 10, 4, 1, 2, 3, 456789, tzinfo=timezone.utc)
            r = store_snapshot(root, self.payload(), endpoint="http://test/fusion", now=now)
            self.assertTrue(r["stored"])
            self.assertTrue((root / r["path"]).exists())
            report = audit_root(root)
            self.assertEqual(report["status"], "PASS")
            self.assertEqual(report["manifest_rows"], 1)

    def test_direct_transport_metadata_persisted(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            now = datetime(2026, 10, 4, 1, 2, 3, tzinfo=timezone.utc)
            store_snapshot(
                root,
                self.payload(),
                endpoint="panwatch-direct://gold_market_fusion",
                transport="direct_import",
                panwatch_commit="abc123",
                now=now,
            )
            row = json.loads((root / "manifest.jsonl").read_text(encoding="utf-8").strip())
            self.assertEqual(row["transport"], "direct_import")
            self.assertEqual(row["panwatch_commit"], "abc123")
            self.assertEqual(row["endpoint"], "panwatch-direct://gold_market_fusion")

    def test_duplicate_same_day_skipped(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            a = datetime(2026, 10, 4, 1, 0, tzinfo=timezone.utc)
            b = datetime(2026, 10, 4, 1, 1, tzinfo=timezone.utc)
            r1 = store_snapshot(root, self.payload(), endpoint="http://test/fusion", now=a)
            r2 = store_snapshot(root, self.payload(), endpoint="http://test/fusion", now=b)
            self.assertTrue(r1["stored"])
            self.assertTrue(r2["duplicate"])
            self.assertEqual(len((root / "manifest.jsonl").read_text().splitlines()), 1)

    def test_different_payload_not_overwritten(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            now = datetime(2026, 10, 4, 1, 0, tzinfo=timezone.utc)
            r1 = store_snapshot(root, self.payload(1), endpoint="http://test/fusion", now=now)
            r2 = store_snapshot(root, self.payload(2), endpoint="http://test/fusion", now=now)
            self.assertNotEqual(r1["path"], r2["path"])
            self.assertTrue((root / r1["path"]).exists())
            self.assertTrue((root / r2["path"]).exists())

    def test_audit_detects_tamper(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            now = datetime(2026, 10, 4, 1, 0, tzinfo=timezone.utc)
            r = store_snapshot(root, self.payload(), endpoint="http://test/fusion", now=now)
            (root / r["path"]).write_text(json.dumps({"tampered": True}), encoding="utf-8")
            report = audit_root(root)
            self.assertEqual(report["status"], "FAIL")
            self.assertTrue(any(x["type"] == "SHA_MISMATCH" for x in report["issues"]))

    def test_observed_at_uses_latest_venue_timestamp(self):
        payload = {
            "venues": [
                {"observed_at": "2026-10-04T01:00:00+00:00"},
                {"observed_at": "2026-10-04T01:02:00+00:00"},
            ]
        }
        self.assertEqual(_observed_at(payload), "2026-10-04T01:02:00+00:00")

    def test_source_health_summary_minimal(self):
        got = source_health_summary(self.payload())
        self.assertEqual(got["okx_xau_swap"]["status"], "ready")
        self.assertFalse(got["bitfinex_xaut"]["available"])

    def test_fresh_lock_rejects_overlap(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with exclusive_lock(root, ".test.lock", stale_after_seconds=60):
                with self.assertRaises(RuntimeError):
                    with exclusive_lock(root, ".test.lock", stale_after_seconds=60):
                        pass
            self.assertFalse((root / ".test.lock").exists())

    def test_stale_lock_is_recovered(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            lock = root / ".test.lock"
            lock.mkdir()
            os.utime(lock, (1, 1))
            with exclusive_lock(root, ".test.lock", stale_after_seconds=1):
                self.assertTrue((lock / "owner.json").exists())
            self.assertFalse(lock.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
