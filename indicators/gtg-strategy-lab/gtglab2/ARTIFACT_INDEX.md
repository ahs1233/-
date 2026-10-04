# GTGLab2 — Artifact Index

## Canonical GTGLab2 guide
- `indicators/gtg-strategy-lab/gtglab2/`
- `indicators/gtg-strategy-lab/gtglab2/BLOCKERS.md` — prioritized obstacles and closure conditions.
- `indicators/gtg-strategy-lab/gtglab2/ULTRA_PLAN_V01.md` — active gated implementation roadmap.
- `indicators/gtg-strategy-lab/gtglab2/engine/contracts.py` — bidirectional state/action/timeframe contracts.
- `indicators/gtg-strategy-lab/gtglab2/engine/context_features.py` — causal session compatibility and raw MA geometry.
- `indicators/gtg-strategy-lab/gtglab2/engine/test_phase1_foundation.py` — Phase 1 symmetry/no-lookahead tests.

## Data collection
- `data/capture_microstructure_forward.py`
- `data/audit_microstructure_quality.py`
- `data/microstructure_forward_readiness.py`
- `scripts/capture_microstructure_forward.ps1`

## Pristine Forward
- `data/jforex/GtgForwardExport.java`
- `data/seal_jforex_forward.py`
- `data/audit_forward_seal.py`
- `scripts/seal_pristine_forward.ps1`

## Protocol / evidence
- `library-comparison/PROTOCOL_MICROSTRUCTURE_FORWARD_COLLECTION_V0_3_1.md`
- `library-comparison/PROTOCOL_MICROSTRUCTURE_READINESS_GATE_V0_1.md`
- `library-comparison/PROTOCOL_PRISTINE_FORWARD_JFOREX_V0_2.md`
- `library-comparison/RESEARCH_AUDIT_2026_10_04.md`
- `library-comparison/MICROSTRUCTURE_FORWARD_READINESS_V01.json`

## External runtime dependency
PanWatch provides multi-venue microstructure acquisition/fusion. GTGLab2 stores forward evidence and evaluates research validity; it must preserve source provenance.

## Current branch
- `research/gtglab2`


## GTGLab2 engine — implemented foundation
- `gtglab2/engine/session_narrative.py` — causal session-to-session evidence.
- `gtglab2/engine/mtf_context.py` — completed-bar-only MTF aggregation/alignment.
- `gtglab2/engine/liquidity_map.py` — prior-only liquidity references.
- `gtglab2/engine/inventory.py` — fixed-risk tranche state machine.
- `gtglab2/engine/setup_policy.py` — Range/Trend Long/Short mapping.
- `gtglab2/engine/execution.py` — BID/ASK and slippage execution.
- `gtglab2/engine/metrics.py` — episode-level metrics.
- `gtglab2/engine/test_phase1_foundation.py`
- `gtglab2/engine/test_phase2_context.py`
- `gtglab2/engine/test_phase3_inventory.py`
- `gtglab2/engine/test_phase4_execution.py`
