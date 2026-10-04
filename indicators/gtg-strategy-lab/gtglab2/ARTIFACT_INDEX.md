# GTGLab2 — Artifact Index

## Canonical GTGLab2 guide
- `indicators/gtg-strategy-lab/gtglab2/`
- `CURRENT_STATE.md` — latest operational/research checkpoint.
- `ULTRA_PLAN_V01.md` — frozen execution roadmap.
- `BLOCKERS.md` — blockers and closure conditions.
- `DECISIONS.md` — active architectural/research decisions.
- `EXPERIMENTS.md` — experiment register including failures.
- `WORKLOG.md` — chronological evidence log.
- `EVENTS.jsonl` — append-only machine-readable event ledger.
- `TOOLS_REGISTRY.md` — Quiver, Liquid and source roles.
- `EXECUTION_STATUS_2026-10-04.md` — current phase-gate matrix.

## Core engine
- `engine/contracts.py`
- `engine/context_features.py`
- `engine/session_context.py`
- `engine/liquidity.py`
- `engine/mtf_context.py`
- `engine/inventory.py`
- `engine/invalidation.py`
- `engine/execution.py`
- `engine/risk_controls.py`
- `engine/shadow_ledger.py`

## Engine tests
- `engine/test_phase1_foundation.py`
- `engine/test_phase2_core.py`
- `engine/test_phase3_sweep_acceptance.py`
- `engine/test_phase4_risk_shadow.py`
- `engine/test_phase5_forward_microstructure.py`

## Development experiments
### Doctrine Reference v0.1
- `PROTOCOL_DOCTRINE_REFERENCE_V01.md`
- `doctrine_reference_v01.py`
- `runs/doctrine-reference-v01-001/`
- `RESULT_DOCTRINE_REFERENCE_V01.md`
- Verdict: FAIL.

### Sweep / Acceptance v0.1
- `PROTOCOL_SWEEP_ACCEPTANCE_V01.md`
- `sweep_acceptance_v01.py`
- `runs/sweep-acceptance-v01-001/`
- `RESULT_SWEEP_ACCEPTANCE_V01.md`
- Verdict: overall FAIL; Acceptance+Retest promising but not robust.

### Forward Microstructure Acceptance Gate v0.1
- `PROTOCOL_FORWARD_MICROSTRUCTURE_ACCEPTANCE_V01.md`
- `engine/forward_microstructure_gate.py`
- outcome linkage: LOCKED until 30 days + 10,000 valid snapshots.
- treatment rule was frozen before any microstructure-to-price outcome linkage.

## Data collection
- `data/capture_microstructure_forward.py`
- `data/audit_microstructure_quality.py`
- `data/microstructure_forward_readiness.py`
- `scripts/capture_microstructure_forward.ps1`
- `MICROSTRUCTURE_READINESS_LATEST.json`

## Pristine Forward
- canonical runtime store: repo `.lab-data`
- `data/jforex/GtgForwardExport.java`
- `data/seal_jforex_forward.py`
- `data/audit_forward_seal.py`
- `scripts/seal_pristine_forward.ps1`
- `FORWARD_SEAL_AUDIT_LATEST.json`
- `LEGACY_FORWARD_STORE_NOTE.md`

## External context
- `EXTERNAL_CONTEXT_SNAPSHOT_2026-10-04.json`
- Liquid / Co-Invest: connected, market reads verified, Paper Mode enabled.
- Quiver: authenticated and dataset discovery verified; paid data blocked by inactive subscription.

## Inherited research protocols
- `library-comparison/PROTOCOL_MICROSTRUCTURE_FORWARD_COLLECTION_V0_3_1.md`
- `library-comparison/PROTOCOL_MICROSTRUCTURE_READINESS_GATE_V0_1.md`
- `library-comparison/PROTOCOL_PRISTINE_FORWARD_JFOREX_V0_2.md`
- `library-comparison/RESEARCH_AUDIT_2026_10_04.md`

## External runtime dependency
PanWatch provides multi-venue proxy microstructure acquisition/fusion. GTGLab2 preserves provenance and keeps proxy evidence distinct from canonical XAU/USD.

## Current branch
- `research/gtglab2`
