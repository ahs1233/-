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


## 2026-10-04T10:01:39.304296Z — GTGLAB2-0008 — ultra_plan_execution_checkpoint

**Action:** Executed all currently eligible GTGLab2 Ultra Plan phases; two historical development candidates evaluated; downstream protected gates enforced.

**Reason:** User requested full execution with results while preserving the GTGLab2 evidence trail.

**Result:** GTGLab2 24/24 tests PASS; data 106/106 PASS; Doctrine Reference v0.1 FAIL; Sweep/Acceptance v0.1 overall FAIL with Acceptance+Retest promising but not robust; JForex forward audit PASS; microstructure 217/10000 and 0.516/30 days; Liquid Paper enabled; Quiver paid datasets blocked by no active subscription.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/EXECUTION_STATUS_2026-10-04.md`
- `indicators/gtg-strategy-lab/gtglab2/RESULT_DOCTRINE_REFERENCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/RESULT_SWEEP_ACCEPTANCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/CURRENT_STATE.md`

**Verification:**
- 24/24 GTGLab2 phase tests PASS
- 106/106 data tests PASS
- Canonical .lab-data forward seal audit PASS
- Historical Holdout not read
- Pristine Forward outcomes not decoded
- Microstructure outcome linkage remains locked


## 2026-10-04T10:03:55.917032Z — GTGLAB2-0009 — jforex_freshness_blocker

**Action:** Canonical sealed JForex days pass integrity, but the now-settled 2026-10-03 authenticated export is missing.

**Reason:** Post-settle Phase 0 freshness verification.

**Result:** Existing .lab-data seals 2026-09-30..2026-10-02 audit PASS; sealer status BLOCKED_MISSING_JFOREX_EXPORT for 2026-10-03; no public-datafeed substitution made.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_AUDIT_CANONICAL_LATEST.json`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_CANONICAL_LATEST.json`

**Verification:**
- JForex Desktop process running
- 2026-10-03 absent from export and cache
- SDK credential environment variables absent
- protected price outcomes not decoded


## 2026-10-04T10:06:55.458138Z — GTGLAB2-0010 — eligible_ultra_plan_complete

**Action:** Completed every GTGLab2 Ultra Plan phase currently permitted by registered research gates.

**Reason:** User requested full execution and results without bypassing Holdout, Pristine OOS, or forward microstructure readiness locks.

**Result:** 28/28 GTGLab2 engine tests PASS; 106/106 data tests PASS; Doctrine Reference v0.1 FAIL; Sweep/Acceptance v0.1 overall FAIL with Acceptance+Retest promising but not C2 robust; forward microstructure treatment v0.1 preregistered before outcomes; 221 valid snapshots and 30d/10k gate still locked; Liquid Paper enabled; Quiver paid data blocked; canonical JForex seals audit PASS for 2026-09-30..10-02 but authenticated 2026-10-03 export is missing and collection fails closed.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/EXECUTION_STATUS_2026-10-04.md`
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_FORWARD_MICROSTRUCTURE_ACCEPTANCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/MICROSTRUCTURE_READINESS_LATEST.json`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_AUDIT_LATEST.json`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_STATUS_LATEST.json`

**Verification:**
- 28/28 GTGLab2 engine tests PASS
- 106/106 core data regression tests PASS
- Historical Holdout read=false
- Pristine Forward outcomes decoded=false
- Microstructure outcome linkage remains locked
- Liquid paper mode enabled


## 2026-10-04T10:18:00.847075Z — GTGLAB2-0011 — parallel_branch_reconciled

**Action:** Reconciled the parallel GTGLab2 foundation branch with the executed research/results branch without force-push.

**Reason:** The remote branch advanced independently with additional setup-policy, metrics, context and execution tests while local work added experiments, risk/shadow infrastructure and forward protocols.

**Result:** Unified engine preserves both APIs and modules; 51/51 engine tests PASS; 106/106 data tests PASS after Windows-path-only test portability fix; Sweep/Acceptance v0.1 rerun results match the recorded run exactly.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/engine/execution.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/inventory.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/mtf_context.py`
- `indicators/gtg-strategy-lab/gtglab2/EXECUTION_STATUS_2026-10-04.md`

**Verification:**
- 51/51 unified engine tests PASS
- 106/106 data regression tests PASS
- Sweep/Acceptance discovery, episodes, pairing and result objects exactly equal after merge
- No force push used
- Historical Holdout remained sealed

## 2026-10-04T10:22:56.892127Z — GTGLAB2-0012 — unified_branch_verified

**Action:** Unified GTGLab2 branch synchronized locally and remotely after parallel-track reconciliation.

**Reason:** Close the execution checkpoint with a reproducible branch head and final device-local regression results.

**Result:** Merge commit 6ff6774 contains both histories; GitHub push succeeded fast-forward; main worktree fast-forwarded to the same head; 51/51 engine and 106/106 data tests PASS.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/EVENTS.jsonl`
- `indicators/gtg-strategy-lab/gtglab2/WORKLOG.md`

**Verification:**
- GitHub research/gtglab2 included 6ff6774
- main device worktree HEAD=6ff6774 before this checkpoint commit
- 51/51 engine tests PASS on main worktree
- 106/106 data tests PASS on main worktree
- Historical Holdout remained sealed
- Pristine Forward OOS remained undecoded

**Commit:** `6ff6774`

## 2026-10-04T10:26:44.849880Z — GTGLAB2-0013 — forward_gatekeeper_installed

**Action:** Installed executable fail-closed forward research gatekeeper and candidate registry after reconciling parallel GTGLab2 branches.

**Reason:** Prevent outcome linkage, Holdout access, or production promotion from being unlocked by narrative/manual decisions before registered gates are satisfied.

**Result:** Unified engine 51/51 PASS; gatekeeper 4/4 PASS; data regression 106/106 PASS. Real gate returns BLOCK with 235 valid snapshots, 30d and 10k gates unmet, and JForex 2026-10-03 freshness missing.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/CANDIDATE_REGISTRY.json`
- `indicators/gtg-strategy-lab/gtglab2/tools/forward_gatekeeper.py`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_GATE_STATUS_LATEST.json`

**Verification:**
- 51/51 unified engine tests PASS
- 4/4 forward gatekeeper tests PASS
- 106/106 data regression tests PASS
- Real gate action=BLOCK
- Historical Holdout remains disallowed

