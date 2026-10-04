# GTGLab2 — Worklog

Chronological, append-only in spirit. Corrections should be added as new entries rather than silently rewriting history.

## 2026-10-04 — GTGLab2 initialized

**Action**
- Renamed the current research track to GTGLab2.
- Created Git branch `research/gtglab2`.
- Created canonical documentation directory `indicators/gtg-strategy-lab/gtglab2/`.

**Inherited verified state**
- Microstructure quality audit PASS.
- 128 forward microstructure captures.
- 122 Fusion Grade, 6 Single-source Grade.
- JForex Pristine Forward seal PASS for 2026-09-30 through 2026-10-02.
- Historical Holdout locked.
- Pristine OOS undecoded.

**Documentation system created**
- README
- current-state ledger
- historical baseline
- worklog
- decision register
- experiment register
- research protocol
- artifact index
- machine-readable EVENTS.jsonl
- event-recording helper

**Reason**
The project had accumulated many experiments, protocols, and operational fixes. A single canonical evidence trail is required so future work can be audited and reused rather than reconstructed from chat history.

## 2026-10-04T00:18:51.145074Z — GTGLAB2-0002 — documentation_checkpoint

**Action:** GTGLab2 canonical evidence trail created, validated, committed, and pushed.

**Reason:** Create a durable project guide so future decisions, experiments, failures, fixes, and verification can be reconstructed from the repository.

**Result:** Canonical guide is live on research/gtglab2.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/`

**Verification:**
- record_event.py py_compile PASS
- EVENTS.jsonl parsed successfully
- Git push research/gtglab2 PASS

**Commit:** `896e71a`

## 2026-10-04T00:22:53.749619Z — GTGLAB2-0003 — blocker_review

**Action:** Prioritized the blockers preventing GTGLab2 from proving a defensible trading result.

**Reason:** Convert vague project friction into explicit research and operational blockers with closure conditions.

**Result:** BLOCKERS.md created with critical path from clean collection to validated executable edge.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/BLOCKERS.md`

**Verification:**
- Blockers derived from recorded experiment failures, current collection state, and research protocol


## 2026-10-04T09:33:08.687593Z — GTGLAB2-0004 — ultra_plan_frozen

**Action:** Frozen GTGLab2 Ultra Plan and Phase 1 architecture; Liquid connector switched to paper mode; foundation tests pass 9/9.

**Reason:** User requested full execution of the GTGLab2 Ultra Plan with evidence preservation.

**Result:** ULTRA_PLAN_V01 registered; typed bidirectional contracts and causal MA/session foundation present; 9/9 foundation tests PASS; Liquid paper mode enabled.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/ULTRA_PLAN_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/engine/contracts.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/context_features.py`

**Verification:**
- 9/9 Phase 1 foundation tests PASS
- Liquid paper trading enabled in connected Co-Invest connector


## 2026-10-04T09:43:31.859072Z — GTGLAB2-0005 — phase2_core_implemented

**Action:** Implemented causal session, liquidity, MTF, fixed-risk inventory, invalidation, and bid/ask execution layers; preregistered doctrine reference v0.1.

**Reason:** Execute GTGLab2 Ultra Plan phases 2-8 without opening protected outcome sources.

**Result:** 17/17 GTGLab2 phase tests PASS; doctrine reference protocol frozen before first run; reference experiment started on development-only history.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/engine/session_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/liquidity.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/mtf_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/inventory.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/invalidation.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/execution.py`
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_DOCTRINE_REFERENCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/doctrine_reference_v01.py`

**Verification:**
- 17/17 unit tests PASS
- Historical Holdout not read
- Pristine Forward OOS not decoded


## 2026-10-04T09:50:36.203124Z — GTGLAB2-0006 — phase2_core_complete

**Action:** Implemented causal session, MTF, liquidity, inventory, invalidation, and BID/ASK execution primitives.

**Reason:** Execute GTGLab2 Ultra Plan phases 2-4 before outcome-linked testing.

**Result:** Phase 1 tests 9/9 PASS; Phase 2 core tests 8/8 PASS; fixed-risk/no-add-after-invalidation invariants verified.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/engine/session_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/mtf_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/liquidity.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/inventory.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/invalidation.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/execution.py`

**Verification:**
- 17/17 cumulative GTGLab2 engine tests PASS


## 2026-10-04T09:58:41.327947Z — GTGLAB2-0007 — experiment_complete

**Action:** Sweep/Acceptance v0.1 development screen completed.

**Reason:** Test whether post-break rejection and acceptance create distinct executable paths and whether staged entry improves single entry.

**Result:** 1134 boundary breaks; 774 acceptance, 360 rejection. BASE C1 single overall -0.0516R; acceptance-only +0.0210R; rejection -0.1249R. Current staged acceptance -0.0291R. No Holdout/OOS/microstructure outcomes read.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/runs/sweep-acceptance-v01-001/summary.json`

**Verification:**
- Historical Holdout read=false
- Pristine Forward OOS decoded=false
- Microstructure outcomes read=false

