# GTGLab2 â€” Execution Status 2026-10-04

## Executive status
The Ultra Plan has been executed through every phase currently permitted by the research gates.

No protected gate was bypassed.

## Phase matrix
| Phase | Status | Result |
|---|---|---|
| 0 Safety / evidence | PASS | Liquid Paper enabled; JForex canonical forward fresh through 2026-10-03; evidence trail active |
| 1 Architecture | PASS | typed bidirectional contracts; Long/Short symmetry |
| 2 MTF / Sessions / Liquidity / MA | PASS | causal modules implemented and tested |
| 3 Entry / inventory | PASS as infrastructure | fixed-risk staged inventory; no Martingale |
| 4 Invalidation / Flip | PASS as infrastructure | rejection/acceptance + invalidation contracts |
| 5 Microstructure | COLLECTING / LOCKED | 241 valid snapshots; collector recovered and LastResult=0; first outcome-free treatment preregistered; 30d/10k not met |
| 6 Execution simulator | PASS | canonical BID/ASK + slippage execution primitives |
| 7 Preregister hypotheses | PASS | Doctrine Reference v0.1 + Sweep/Acceptance v0.1 + Forward Microstructure Acceptance Gate v0.1 + frozen Swing/Scalper execution contracts + frozen episode/purged evaluation protocol |
| 8 Historical development evaluation | COMPLETE | both integrated candidates failed promotion |
| 9 Forward shadow/paper | INFRA READY / CANDIDATE BLOCKED | risk guard + append-only shadow ledger ready |
| 10 Final Holdout | SEALED | correctly not opened |
| 11 Liquid positioning | CONNECTED / CAPTURE LOCKED | market/positioning available; Paper Mode enabled; raw event-time snapshot + SHA manifest active; not part of primary first test |
| 12 Quiver macro | CONNECTED / DATA BLOCKED | account authenticated, no active paid subscription |
| 13 Paper strategy execution | BLOCKED | no candidate passed economics gate |
| 14 Final validation | BLOCKED BY DESIGN | no eligible frozen candidate |
| 15 Production | NOT ELIGIBLE | no proven edge |

## Test status
- Unified GTGLab2 engine: **72/72 PASS**
- GTGLab2 tools: **7/7 PASS**
- Core data regression: **107/107 PASS**
- One Windows-only path assertion was corrected in the test to use `Path.as_posix()`; production data code was unchanged.

## Canonical forward price
Operational store: repo `.lab-data`.
Integrity / freshness audit:
- PASS
- 4 JForex/IHistory days
- 2026-09-30 through 2026-10-03
- exportâ†”JForex-cache byte parity verified
- expected settled through 2026-10-03
- missing expected export days: none
- no decoded forward outcome

2026-10-03 was recovered after `GtgForwardExport.jfx` was started in JForex. The sealer lifecycle was hardened so an already verified historical seal remains valid after JForex later evicts its local cache; first-time verification for any new day still requires exact cache parity.

Important:
`C:\Users\alk\gtg-lab-data-jforex` contains legacy historical/public-datafeed forward-looking records from older work and is **not** the canonical Pristine Forward store. It must not be used for forward outcome validation.

## Microstructure gate
Latest recorded readiness:
- integrity: PASS
- valid snapshots: 241
- snapshot target remaining: 9,759
- elapsed: ~0.559 days
- time remaining at check: ~29.441 days
- registered earliest 30-day unlock: 2026-11-02T21:37:13Z
- Fusion Grade ratio: ~95.44%

The outcome linkage remains locked.

The executable gatekeeper currently returns `BLOCK` only because the 30-day and 10,000-snapshot microstructure gates are not met. Canonical JForex audit and freshness are both PASS. Historical Holdout and production execution remain hard-disallowed at this stage.

A Windows task, `GTGLab2 Research Gate Audit`, reruns the metadata-only readiness/seal/audit/gate chain every 3 hours. The order is now `seal â†’ audit â†’ gate`, and the latest verified cycle logged `micro=0 audit=0 seal=0 gate=3`; gate=3 is the expected fail-closed result while 30d/10k remain unmet.

## Economic results
Doctrine Reference v0.1:
- FAIL
- Single C1 -0.1891R
- Staged C1 -0.1491R nominal, but -0.4707 per used R

Sweep/Acceptance v0.1:
- overall FAIL
- Acceptance+Retest Single C1 +0.0210R
- positive in Early/Late and Long/Short
- but C2 -0.0254R and median strongly negative
- status: promising hypothesis, not robust edge

## Current scientific conclusion
The project has progressed from â€œwhere is the entry?â€ to a stricter result:

1. State recognition alone is insufficient.
2. Generic staged averaging is not edge.
3. Waiting for observable Acceptance + Retest is materially better than blind edge entries.
4. Rejection/fade logic as currently defined is negative.
5. The strongest surviving research direction is **Acceptance â†’ Retest â†’ Continuation**, but execution-cost robustness is not yet sufficient.
6. The next independent source of information must come from forward evidence, not more historical threshold hunting.

## Current next gate
Continue clean forward collection.
Do not tune Acceptance v0.1 on the same development history.
When the registered corpus gate is met, run the frozen PanWatch sign-vote treatment against Acceptance/Retest using episode/purged time-block evaluation and leave-one-source-out ablation. Liquid positioning remains a separately archived secondary context layer and is not added to the primary first test.

