# PROTOCOL — Adaptive Walk-Forward State Evolution v0.2

Date: 2026-10-05

## Objective
Test whether State Evolution must adapt to changing market relationships over time.

The prior v0.1 showed concept drift:
- Scalper improved substantially.
- Swing relationship between context and outcome changed, especially in 2026.

This experiment keeps the SAME causal features and SAME model structure, but retrains annually using only recent history available before each test year.

## Frozen architecture
Unchanged:
- feature set = State Evolution v0.1
- Logistic Regression C=1.0
- StandardScaler + median imputation
- threshold = 60th percentile of TRAIN probabilities
- Scalper trigger/states/geometry unchanged
- Swing trigger/states/geometry unchanged
- FIXED management

No hyperparameter search.
No threshold optimization.

## Walk-forward schedule
For each test year Y from 2021 through 2026:
- training years = Y-3, Y-2, Y-1
- train only on events from those completed calendar years
- threshold fixed from those training probabilities
- score and execute year Y
- never use any event from Y to fit its model

Examples:
- 2021 model trains on 2018-2020
- 2024 model trains on 2021-2023
- 2026 model trains on 2023-2025

2018 is partial from March 1 but remains valid historical input.

## Evaluation
For each test year:
- AUC on that year
- selected-event fraction
- real overlapping execution metrics
- coefficient snapshot
- especially track sign/magnitude of 120H return, 72H return, recovery, and efficiency terms

Aggregate all walk-forward test-year trades 2021-2026.

## Interpretation
This is a historical walk-forward simulation, not fresh OOS for 2025-2026 because those years have already been inspected elsewhere.

However, each annual model is causally trained only on prior data, so it tests whether adaptive learning could have reacted without future leakage.

## Success criterion
Adaptive approach is useful if:
- annual aggregate PF > 1
- 2026 materially improves versus static v0.1 Swing (-27.403R, PF 0.686)
- no single earlier year deterioration negates the gain

If annual adaptation still fails 2026 badly:
- conclude regime change is faster than annual retraining
- next cadence test = quarterly/monthly adaptive health model

Pristine Forward OOS remains unread.
