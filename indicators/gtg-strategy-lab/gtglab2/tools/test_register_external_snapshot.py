from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from register_external_snapshot import register_snapshot


class ExternalSnapshotRegistryTests(unittest.TestCase):
    def make_snapshot(self, root: Path, value: int = 1) -> Path:
        p = root / "liquid" / "x.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({
            "source": "Liquid / Co-Invest MCP",
            "symbol": "GOLD",
            "canonical_market_symbol": "xyz:GOLD",
            "source_created_at": "2026-10-04T10:00:00Z",
            "paper_mode_verified": True,
            "value": value,
        }), encoding="utf-8")
        return p

    def test_append_only_registration_and_idempotence(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            p = self.make_snapshot(root)
            a = register_snapshot(root, p)
            b = register_snapshot(root, p)
            self.assertTrue(a["registered"])
            self.assertTrue(b["duplicate"])
            self.assertEqual(len((root / "manifest.jsonl").read_text().splitlines()), 1)

    def test_mutating_registered_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            p = self.make_snapshot(root, 1)
            register_snapshot(root, p)
            self.make_snapshot(root, 2)
            with self.assertRaises(ValueError):
                register_snapshot(root, p)

    def test_snapshot_must_stay_under_root(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            p = self.make_snapshot(Path(a))
            with self.assertRaises(ValueError):
                register_snapshot(Path(b), p)


if __name__ == "__main__":
    unittest.main()
