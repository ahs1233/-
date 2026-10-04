# GTGLab2 — Historical Clean Validation v0.1

Status: PREREGISTERED BEFORE VALIDATION OUTCOMES
Registered: 2026-10-04

## Purpose
Run the already-frozen GTGLab2 Sweep/Acceptance execution logic on the authoritative Historical Validation interval using the immutable clean JForex snapshot.

This is Stage 1 historical validation. It is not Historical Holdout and not Forward/OOS.

## Data
Snapshot:
- id: GTGLAB2-HIST-CLEAN-V1
- root: C:\Users\alk\gtg-lab-data-historical-clean-v1
- source: Dukascopy JForex API/IHistory BID+ASK
- history start: 2018-03-01
- T_FREEZE: 2026-09-30T13:40:49Z

Authoritative split:
- first valid: 2021-09-08T17:00:00Z
- Train end: 2024-03-20T15:20:24.500Z
- Validation start after 4h embargo: 2024-03-20T19:20:24.500Z
- Validation end: 2025-03-25T01:04:34.300Z
- Historical Holdout starts: 2025-03-25T05:04:34.300Z

Raw input is hard-capped at 2025-03-25T01:00:00Z. Any attempted read reaching Holdout must fail closed.

## Hard gates before outcomes
1. Rebuild State Engine v0.2 causally through Validation.
2. Frozen Train prefix must match the clean Train state sequence exactly.
3. Historical Holdout read = false.
4. Pristine OOS read = false.
5. No microstructure outcomes.

## Strategy
Use the existing frozen Sweep/Acceptance v0.1 semantics:
- Rejection / range fade reference path,
- Acceptance -> Retest -> Continuation path,
- Long/Short symmetry,
- next-H1-open execution,
- C0/C1/C2 cost tiers,
- SINGLE and STAGED policies,
- no additions after invalidation.

No threshold or rule may be changed after Validation outcomes are opened.

## Reporting
Publish:
- discovery counts,
- Validation episode count,
- overall C0/C1/C2,
- Acceptance vs Rejection,
- Long vs Short,
- first half vs second half of Validation,
- SINGLE vs STAGED at equal registered risk semantics,
- censored-at-validation-end counts.

The rejected Rejection/Fade branch remains diagnostic; a positive cell may not retroactively promote it.

Acceptance/Retest remains the only price-only research direction eligible for further consideration.

## Decision
Validation does not open Historical Holdout.
Any strategy modification after this run creates a new development candidate and cannot claim this same Validation result as fresh confirmation.
