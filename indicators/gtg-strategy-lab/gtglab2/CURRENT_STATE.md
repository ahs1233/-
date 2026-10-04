# GTGLab2 â€” Current State

Updated: 2026-10-04

## Git / track
- Canonical branch: `research/gtglab2`
- GTGLab2 is the active research track.
- Permanent evidence trail is active through WORKLOG, EVENTS, protocols, results, and commits.

## Architecture implemented
The current architecture is:

Higher-TF Context
â†’ H1 Market State
â†’ Session Narrative
â†’ Liquidity Map
â†’ MA Geometry
â†’ MTF Alignment
â†’ Sweep / Break
â†’ Acceptance / Rejection
â†’ Fixed-Risk Entry Construction
â†’ Invalidation
â†’ Continue / Exit / Flip
â†’ BID/ASK Execution
â†’ Risk Guard / Shadow Ledger

The system is explicitly bidirectional:
- Range Long
- Range Short
- Trend Long
- Trend Short

Scalper and Swing remain distinct execution tracks.

## Test status
- unified GTGLab2 engine tests: **72/72 PASS**
- GTGLab2 tools tests: **7/7 PASS**
- data-layer regression: **107/107 PASS**

## Historical development experiments

### Doctrine Reference v0.1
Verdict: **FAIL**
- Single C1: -0.1891R / episode
- Staged C1: -0.1491R nominal
- Staged mean per actually used risk: -0.4707R
Conclusion: generic staged entry mainly reduced exposure; it did not improve entry quality.

### Sweep / Acceptance v0.1
Verdict: **OVERALL FAIL**

Rejection/fade:
- Single C1: -0.1249R
- closed as failed in this version.

Acceptance + Retest continuation:
- Single C1: +0.0210R
- Early: +0.0110R
- Late: +0.0298R
- Long: +0.0275R
- Short: +0.0143R
- C2: -0.0254R
- median C1: -0.6868R

Status:
**PROMISING BUT NOT ROBUST**.
Not eligible for Final Holdout or production/paper candidate promotion.

## Canonical Pristine Forward Price
Operational store:
`C:\Users\alk\gtg-lab-library-comparison\.lab-data`

Integrity / freshness audit:
- PASS
- 4 days
- 2026-09-30 through 2026-10-03
- origin: JForex API/IHistory
- export/cache SHA256 parity verified for all sealed days
- expected settled through: 2026-10-03
- missing expected export days: none
- decoded market data: false

2026-10-03 recovery:
- `GtgForwardExport.jfx` was started from JForex Strategies,
- BID rows = 1,440 and ASK rows = 1,440,
- both export/cache SHA256 checks PASS,
- `FORWARD_SEAL_STATUS_LATEST.json` = PASS,
- `FORWARD_SEAL_AUDIT_LATEST.json` = PASS.

The separate cold-start autonomy issue remains open because the exporter still depends on an authenticated JForex session.

Daily task:
- `GTG Pristine Forward Seal Audit`
- enabled
- manually rerun after 2026-10-03 recovery; LastResult `0`.

The older `C:\Users\alk\gtg-lab-data-jforex` forward records are legacy public-datafeed records and are not the canonical Pristine Forward store.

## Microstructure Forward
Latest readiness checkpoint:
- status: COLLECTING
- integrity: PASS
- valid snapshots: 255
- snapshots remaining: 9,745
- elapsed: ~0.569 days
- time remaining: ~29.431 days
- earliest registered 30-day unlock: 2026-11-02T21:37:13Z
- Fusion Grade ratio: ~95.69%

Research locks remain:
- outcome linkage: LOCKED
- Historical Holdout: LOCKED
- Pristine Forward OOS decode: LOCKED

Collection task:
- `GTG Microstructure Forward Capture`
- enabled/running at latest check.

Executable forward gate:
- `tools/forward_gatekeeper.py`
- current action: **BLOCK**
- microstructure integrity: PASS
- 30-day gate: NOT MET
- 10,000-snapshot gate: NOT MET
- canonical forward audit: PASS
- canonical forward freshness: PASS
- candidate registration/forward-test permission: PASS
- remaining block reasons: time gate + snapshot-count gate only
- Historical Holdout allowed: **NO**
- Production execution allowed: **NO**

Automated research-gate audit:
- Windows task: `GTGLab2 Research Gate Audit`
- cadence: every 3 hours
- multiple instances: `IgnoreNew`
- battery start: allowed
- execution limit: 15 minutes
- task-level verification: LastResult `0`
- latest verified audit cycle recorded `micro=0 audit=0 seal=0 gate=3`; canonical price freshness is now PASS and gate=3 remains expected because the 30-day/10k microstructure conditions are still unmet.

## Liquid / Co-Invest
- connection: VERIFIED
- GOLD market/positioning read: VERIFIED
- Paper trading: **ENABLED**
- no GTGLab2 live order placed
- live strategy execution remains prohibited
- raw forward-context snapshot archived under `forward_context/liquid/`
- append-only SHA256 provenance manifest active
- Liquid outcome linkage remains locked and is not part of the first PanWatch microstructure test

Paper mode in the MCP connector does not automatically switch the separate Liquid web app to paper mode.

## Quiver Quant
- MCP authentication: VERIFIED
- free dataset discovery: works
- paid data calls: **BLOCKED**
- reason: connected Quiver account has no active subscription

Quiver is therefore architecturally integrated but not currently available as a live paid-data research layer.

## Current scientific conclusion
The project has rejected two important simplifications:

1. Blind entry at range edges is not enough.
2. Staging alone is not an edge.

The strongest surviving price-only hypothesis is:
**Acceptance â†’ Retest â†’ Continuation**

but current evidence is not robust to conservative execution costs.

## Current critical path
1. Keep JForex and microstructure collection clean.
2. Do not retune Sweep/Acceptance v0.1 on the same development history.
3. Swing v1 / Scalper v1 execution contracts are frozen; do not change their execution semantics after future outcomes are opened.
4. Episode-based / purged evaluation and leave-one-source-out ablation infrastructure is frozen before the forward test.
5. Reach 30 days + 10,000 valid microstructure snapshots.
6. The first incremental forward hypothesis is frozen in `PROTOCOL_FORWARD_MICROSTRUCTURE_ACCEPTANCE_V01.md`.
7. When the corpus gate opens, test the frozen sign-majority PanWatch treatment against the unchanged Acceptance/Retest baseline using the registered episode/time-block protocol.
8. Liquid positioning is now captured with reproducible event-time/SHA provenance but remains secondary and locked from the primary first test.
9. Promote only a candidate that survives realistic costs and independent forward/paper evidence.
10. Open Final Holdout only at its registered final gate.


## 2026-10-04 — Historical Holdout opened by explicit user request
- Exact Pine v0.2 was tested from 2025-01-01 through clean-data T_FREEZE 2026-09-30T13:40:49Z.
- Historical Holdout is no longer unseen for this candidate.
- Pristine Forward OOS remains blind and must stay untouched for future final evidence.

