"""Append-only provenance registry for external GTGLab2 context snapshots."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def register_snapshot(root: Path, snapshot: Path) -> dict:
    root = Path(root).resolve()
    snapshot = Path(snapshot).resolve()
    try:
        rel = snapshot.relative_to(root)
    except ValueError as exc:
        raise ValueError("snapshot must be inside context root") from exc
    if not snapshot.exists() or not snapshot.is_file():
        raise FileNotFoundError(snapshot)

    raw = json.loads(snapshot.read_text(encoding="utf-8-sig"))
    digest = sha256_file(snapshot)
    nbytes = snapshot.stat().st_size
    manifest = root / "manifest.jsonl"
    rows = []
    if manifest.exists():
        for line in manifest.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))

    rels = [str(r.get("path") or "") for r in rows]
    for row in rows:
        if row.get("path") == rel.as_posix():
            if row.get("sha256") == digest and int(row.get("bytes") or -1) == nbytes:
                return {"registered": False, "duplicate": True, "record": row}
            raise ValueError("registered snapshot path changed after registration")

    rec = {
        "kind": "external_forward_context",
        "source": raw.get("source"),
        "symbol": raw.get("symbol"),
        "canonical_market_symbol": raw.get("canonical_market_symbol"),
        "source_created_at": raw.get("source_created_at"),
        "registered_utc": datetime.now(timezone.utc).isoformat(),
        "path": rel.as_posix(),
        "sha256": digest,
        "bytes": nbytes,
        "paper_mode_verified": bool(raw.get("paper_mode_verified")),
        "historical_holdout_read": False,
        "pristine_price_oos_decoded": False,
        "trading_outcomes_read": False,
    }
    root.mkdir(parents=True, exist_ok=True)
    with manifest.open("a", encoding="utf-8", newline="") as fh:
        fh.write(json.dumps(rec, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n")
    return {"registered": True, "duplicate": False, "record": rec}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--snapshot", required=True)
    args = ap.parse_args()
    result = register_snapshot(Path(args.root), Path(args.snapshot))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
