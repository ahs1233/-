"""Append-only shadow decision ledger for GTGLab2.

The ledger records what a frozen candidate *would* do. It does not place orders
and does not read future outcomes while recording a decision.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class ShadowDecision:
    decision_time_utc: str
    candidate_version: str
    symbol: str
    state: str
    strategy_mode: str
    side: str
    action: str
    planned_r: float
    context_digest: str
    source_digest: str


def canonical_json(obj: dict) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def decision_hash(d: ShadowDecision) -> str:
    return hashlib.sha256(canonical_json(asdict(d)).encode("utf-8")).hexdigest()


def append_decision(path: Path, d: ShadowDecision) -> dict:
    if d.planned_r < 0:
        raise ValueError("planned_r cannot be negative")
    record = {
        "recorded_utc": datetime.now(timezone.utc).isoformat(),
        **asdict(d),
        "decision_sha256": decision_hash(d),
        "order_executed": False,
        "outcome_attached": False,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(canonical_json(record) + "\n")
    return record


def read_ledger(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]
