# GTGLab2 — Current State

Updated: 2026-10-04

## Git / track
- Canonical branch: `research/gtglab2`
- GTGLab2 is the active research track.
- Permanent evidence trail is active through WORKLOG, EVENTS, protocols, results, and commits.

## Architecture implemented
The current architecture is:

Higher-TF Context
→ H1 Market State
→ Session Narrative
→ Liquidity Map
→ MA Geometry
→ MTF Alignment
→ Sweep / Break
→ Acceptance / Rejection
→ Fixed-Risk Entry Construction
→ Invalidation
→ Continue / Exit / Flip
→ BID/ASK Execution
→ Risk Guard / Shadow Ledger

The system is explicitly bidirectional:
- Range Long
- Range Short
- Trend Long
- Trend Short

Scalper and Swing remain distinct execution tracks.

## Test status
- GTGLab2 phase tests: **28/28 PASS**
- data-layer regression: **106/106 PASS**

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

Integrity audit of sealed days:
- PASS
- 3 days
- 2026-09-30 through 2026-10-02
- origin: JForex API/IHistory
- export/cache SHA256 parity verified
- decoded market data: false

Freshness check at 2026-10-04 after the settle lag:
- **BLOCKED_MISSING_JFOREX_EXPORT**
- expected missing settled day: **2026-10-03**
- JForex desktop process is running, but no 2026-10-03 export/cache files are present.
- standalone SDK credentials are not configured, so the terminal path cannot legitimately generate the missing authenticated export.

Daily task:
- `GTG Pristine Forward Seal Audit`
- enabled
- last scheduled run succeeded before 2026-10-03 became an expected settled day.

The older `C:\Users\alk\gtg-lab-data-jforex` forward records are legacy public-datafeed records and are not the canonical Pristine Forward store.

## Microstructure Forward
Latest readiness checkpoint:
- status: COLLECTING
- integrity: PASS
- valid snapshots: 221
- snapshots remaining: 9,779
- elapsed: ~0.519 days
- time remaining: ~29.481 days
- earliest registered 30-day unlock: 2026-11-02T21:37:13Z
- Fusion Grade ratio: ~95.02%

Research locks remain:
- outcome linkage: LOCKED
- Historical Holdout: LOCKED
- Pristine Forward OOS decode: LOCKED

Collection task:
- `GTG Microstructure Forward Capture`
- enabled/running at latest check.

## Liquid / Co-Invest
- connection: VERIFIED
- GOLD market/positioning read: VERIFIED
- Paper trading: **ENABLED**
- no GTGLab2 live order placed
- live strategy execution remains prohibited

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
**Acceptance → Retest → Continuation**

but current evidence is not robust to conservative execution costs.

## Current critical path
1. Keep JForex and microstructure collection clean.
2. Do not retune Sweep/Acceptance v0.1 on the same development history.
3. Reach 30 days + 10,000 valid microstructure snapshots.
4. The first incremental forward hypothesis is now frozen in `PROTOCOL_FORWARD_MICROSTRUCTURE_ACCEPTANCE_V01.md` before outcome linkage.
5. When the corpus gate opens, test the frozen sign-majority microstructure treatment against the unchanged Acceptance/Retest baseline; Liquid positioning remains secondary context until a reproducible event-time capture path exists.
6. Promote only a candidate that survives realistic costs and independent forward/paper evidence.
7. Open Final Holdout only at its registered final gate.
