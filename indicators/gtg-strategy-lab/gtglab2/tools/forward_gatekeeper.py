"""Fail-closed GTGLab2 forward research gatekeeper.

This tool reads metadata/status only. It never decodes protected market data.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def evaluate(
    micro: dict[str, Any],
    audit: dict[str, Any],
    seal: dict[str, Any],
    registry: dict[str, Any],
    candidate: str,
) -> dict[str, Any]:
    reasons: list[str] = []
    gates: dict[str, bool] = {}

    gates["micro_integrity"] = bool(micro.get("gates", {}).get("integrity_pass"))
    gates["micro_elapsed_30d"] = bool(micro.get("gates", {}).get("elapsed_time_gate"))
    gates["micro_snapshots_10k"] = bool(micro.get("gates", {}).get("snapshot_count_gate"))
    gates["micro_eligible_now"] = bool(micro.get("eligible_now"))
    gates["canonical_forward_audit"] = audit.get("status") == "PASS"
    gates["canonical_forward_fresh"] = seal.get("status") == "PASS"

    cand = registry.get("candidates", {}).get(candidate)
    gates["candidate_registered"] = cand is not None
    gates["candidate_forward_test_allowed"] = bool(
        cand and cand.get("forward_microstructure_test_eligible")
    )

    labels = {
        "micro_integrity": "microstructure integrity is not PASS",
        "micro_elapsed_30d": "30-calendar-day corpus gate is not met",
        "micro_snapshots_10k": "10,000-valid-snapshot corpus gate is not met",
        "micro_eligible_now": "microstructure readiness report is not eligible",
        "canonical_forward_audit": "canonical forward seal audit is not PASS",
        "canonical_forward_fresh": "canonical forward exporter is not caught up",
        "candidate_registered": "candidate is not registered",
        "candidate_forward_test_allowed": "candidate is not approved for forward microstructure testing",
    }
    for name, ok in gates.items():
        if not ok:
            reasons.append(labels[name])

    eligible = all(gates.values())
    return {
        "candidate": candidate,
        "eligible_for_outcome_linkage": eligible,
        "action": "UNLOCK_FORWARD_OUTCOME_LINKAGE" if eligible else "BLOCK",
        "gates": gates,
        "reasons": reasons,
        "historical_holdout_allowed": False,
        "production_execution_allowed": False,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--micro", required=True)
    ap.add_argument("--audit", required=True)
    ap.add_argument("--seal", required=True)
    ap.add_argument("--registry", required=True)
    ap.add_argument("--candidate", default="forward-microstructure-acceptance-v01")
    ap.add_argument("--out")
    args = ap.parse_args()

    report = evaluate(
        load(Path(args.micro)),
        load(Path(args.audit)),
        load(Path(args.seal)),
        load(Path(args.registry)),
        args.candidate,
    )
    text = json.dumps(report, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0 if report["eligible_for_outcome_linkage"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
