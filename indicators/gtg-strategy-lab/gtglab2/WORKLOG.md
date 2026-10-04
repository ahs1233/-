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



## 2026-10-04 — GTGLAB2-0004 — Ultra Plan execution started

**Action**
- Registered `ULTRA_PLAN_V01.md`.
- Implemented Phase 1 typed bidirectional contracts.
- Implemented timeframe roles for D1/H4/H1/M15/M5/M1.
- Implemented inherited coarse session bucket compatibility.
- Implemented causal raw EMA geometry for 9/21/50/200/1000.
- Added synthetic LONG/SHORT symmetry and no-future prefix-invariance tests.

**Verification**
- Independent Python run: 9/9 tests PASS.
- Device-local test rerun is pending because the remote desktop device is online but command execution is timing out.

**Research safety**
- Historical Holdout not opened.
- Pristine OOS not decoded.
- Microstructure not aligned to future outcomes.

**Result**
Sprint A foundation is implemented on `research/gtglab2`. Device-local parity verification remains pending.


## 2026-10-04 — GTGLAB2-0005 — Ultra Plan Sprints B–D implemented

**Implemented**
- causal Session Narrative,
- completed-bar-only multi-timeframe alignment,
- prior-only liquidity map,
- fixed-risk bidirectional inventory state machine,
- Range Long / Range Short / Trend Long / Trend Short policy mapping,
- EXIT → FLIP_WAIT invariant,
- BID/ASK and slippage execution,
- episode metrics and scaled-vs-single comparison.

**Verification**
- Sprint B: 7/7 PASS.
- Sprint C: 7/7 PASS.
- Sprint D: 9/9 PASS.
- Combined Phase 1–4 regression: **32/32 PASS**.

**Important**
This proves code invariants and causality on synthetic/independent verification cases. It does not prove trading profitability.

**Locks**
- Historical Holdout LOCKED.
- Pristine OOS LOCKED.
- Microstructure outcome linkage LOCKED.
