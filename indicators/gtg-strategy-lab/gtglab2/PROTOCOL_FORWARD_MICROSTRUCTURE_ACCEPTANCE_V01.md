# GTGLab2 — Forward Microstructure Acceptance Gate v0.1

Status: PREREGISTERED BEFORE OUTCOME LINKAGE
Registered: 2026-10-04

## Purpose

Test one incremental question only:

**Does contemporaneous forward microstructure improve the frozen Acceptance -> Retest -> Continuation hypothesis over the same price-only baseline?**

## Baseline

Use the Acceptance + Retest branch from Sweep/Acceptance v0.1 exactly as frozen:
- prior state RANGE,
- current TRANSITION crosses one frozen prior24 boundary,
- two consecutive H1 closes outside the boundary establish ACCEPTANCE,
- within the next 6 H1 bars a retest touches/crosses the boundary and closes outside in the breakout direction,
- signal side follows the accepted break,
- fill timing and exit logic remain unchanged from v0.1.

No rejection/fade branch is included in this forward hypothesis.

Important: the historical Acceptance branch was only **promising, not robust**. This protocol tests incremental timing information; it does not retroactively validate the historical baseline.

## Forward corpus gate

Outcome linkage is forbidden until BOTH are true:
- >= 30 elapsed calendar days since first valid capture,
- >= 10,000 valid append-only snapshots with integrity/source-health metadata.

The readiness script is authoritative.

Historical Holdout remains sealed.
Pristine Forward OOS remains undecoded before the gate.

## Microstructure treatment

At the decision timestamp use only contemporaneous or earlier forward snapshots.

Required source readiness:
- at least 2 distinct ready source families.

Directional evidence votes:
- executed-flow/delta sign when available,
- order-book imbalance sign when available,
- other already-registered directional microstructure fields only if their sign semantics are frozen before unlock.

Each vote is reduced to {-1, 0, +1}.
No magnitude threshold is fitted.

For a LONG baseline signal:
- ALIGNED if sum(nonzero votes) > 0
- OPPOSED if sum(nonzero votes) < 0
- MIXED if sum = 0

For a SHORT signal the interpretation is mirrored.

Treatment policy:
- ALIGNED -> TAKE
- OPPOSED -> SKIP
- MIXED/INSUFFICIENT -> BASELINE_UNCHANGED for the primary analysis, while reported separately.

This rule is frozen before any microstructure-to-price outcome linkage.

## Primary comparison

Baseline:
- all frozen Acceptance+Retest signals.

Treatment:
- same signals, with ALIGNED/OPPOSED classification from forward microstructure.

Primary metrics:
- C1 executable expectancy,
- C2 executable expectancy,
- MAE/MFE,
- invalidation loss,
- time-to-invalidation,
- long/short symmetry,
- session breakdown,
- source-family availability.

Primary success condition:
- ALIGNED subset has higher C1 expectancy than baseline,
- improvement is not solely one direction/session,
- C2 does not materially deteriorate versus baseline,
- no source family is singularly responsible for the result.

## Integrity

- No historical microstructure backfill.
- No threshold search after outcomes are attached.
- No changing source-ready rules after seeing result.
- Failures remain recorded.
