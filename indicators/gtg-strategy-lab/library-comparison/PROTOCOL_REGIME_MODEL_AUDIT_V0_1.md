# Regime-Conditioned Model Audit v0.1 — preregistered Train-only interaction test

Registered 2026-10-03 before joining model predictions to frozen regime IDs.

## Purpose
Test whether the already-frozen H1 Regime Atlas explains when the existing Swing models work or fail.

Primary question:
Does pinned Kronos-mini have a persistent executable edge inside the same frozen regime in two disjoint post-fit Train windows?

This phase does not refit Kronos, the atlas, or any predictor. It only joins already-generated predictions to frozen causal regime assignments.

## Frozen inputs
Regime Atlas:
- run: regime-atlas-v01-001
- atlas SHA256: 77907757195387913a993d5e13dff957cd9884a7ef942a93c78de68b2a9e6e7b
- fit ended before 2021-01-01
- selected k=4
- no centroid/scaler updates allowed

Primary model:
- Kronos-mini source/model/tokenizer revisions exactly as pinned in prior runs
- PRETRAINED_CONTAMINATION_UNKNOWN remains a permanent evidence limitation
- no fine tuning
- no sampling/temperature/context changes

Reference models:
- 12-bar drift
- base-threshold DC direction

Reference models are descriptive comparators only. The registered candidate screen applies only to Kronos.

## Two disjoint post-atlas-fit windows

### Window A — early post-fit
Source run: multiscale-symbolic-v01-003
Use Swing anchors only with:
- 2021-01-01 <= anchor < 2021-07-31
Read:
- replication_predictions_kronos.jsonl for Kronos
- replication_predictions_symbolic.jsonl for drift/DC
Only anchors common to all three models are retained.

### Window B — later post-fit
Source run: stability-v02-001
Use Swing anchors only:
- 2021-09-29 <= anchor < 2024-03-20
Read existing predictions.jsonl.
Only Kronos, drift and dc_direction are retained.

No new model inference is run in this phase.

## Regime assignment
Reload canonical JForex BID/ASK source only to compute the already-registered causal 23-feature H1 representation.
Raw gate:
- 2018-03-01 <= raw date < 2024-03-20

For every model anchor:
- compute the exact same 23 causal features used by Regime Atlas v0.1
- transform with frozen RobustScaler parameters
- assign nearest frozen center
- no future-return feature and no model outcome enters state assignment

Every anchor must map to exactly one R0-R3 state.

## Integrity requirements
- frozen atlas SHA unchanged
- feature contract exact match
- source raw files before 2024-03-20 only
- Window A and B timestamp ranges disjoint
- model rows joined by exact timestamp
- within each window, Kronos/drift/DC use the same anchor timestamps
- no state relabeling based on performance
- no parameter or threshold change after results

## Metrics
For every window x model x state:
- n
- direction accuracy
- C0 mean/trade
- C1 mean/trade
- C2 mean/trade
- C1 win rate

Also report each model's unconditional window metrics for comparison.

No annualization, Sharpe, leverage, position sizing, or compounding.

## Primary Kronos regime screen
A state R0-R3 becomes a "persistent Kronos candidate" only if ALL hold:

1. sample size:
   - n >= 30 in Window A
   - n >= 30 in Window B

2. execution:
   - C1 mean/trade > 0 in Window A
   - C1 mean/trade > 0 in Window B

3. direction:
   - direction accuracy >= 0.52 in Window A
   - direction accuracy >= 0.52 in Window B

4. stress:
   - pooled C2 mean/trade across A+B >= 0

5. not concentration-only:
   - in Window B, at least two calendar quarters with >=5 state observations must have positive C1 mean/trade
   - positive-C1 quarters / eligible quarters >= 0.50

If no state passes every condition, the regime-gated Kronos hypothesis fails in Train and Validation/Holdout remain closed.

If one or more states pass, this only creates a validation candidate; it does not authorize opening Validation/Holdout automatically.

## Secondary descriptive outputs
For drift and DC direction:
- same per-state metrics
- no candidate selection/ranking
- used only to determine whether any apparent regime effect is Kronos-specific or generic directional behavior

## Evidence status
All outputs remain Train research.
Kronos remains PRETRAINED_CONTAMINATION_UNKNOWN regardless of result.
