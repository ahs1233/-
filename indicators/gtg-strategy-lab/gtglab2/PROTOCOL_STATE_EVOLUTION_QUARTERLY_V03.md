# PROTOCOL — Quarterly Adaptive State Evolution v0.3

Date: 2026-10-05

## Objective
Test whether the concept drift observed in Swing changes faster than annual retraining can follow.

Use the exact State Evolution v0.1 features and exact model structure, but retrain at each calendar quarter using only the previous 4 completed quarters.

## Frozen components
Unchanged:
- State Evolution v0.1 feature set
- Logistic Regression C=1.0
- StandardScaler + median imputation
- threshold = 60th percentile of TRAIN probabilities
- frozen triggers and accepted states
- FIXED management
- frozen risk geometry/timeouts

No hyperparameter search.
No threshold optimization.

## Walk-forward cadence
For each test quarter Q:
- training data = previous 4 completed calendar quarters only
- model fit occurs before Q starts
- threshold fixed from training probabilities
- model remains frozen throughout Q
- score and select events in Q
- never use any event from Q to fit Q's model

Test range:
- 2021 Q1 through 2026 Q3
- 2026 data ends 2026-09-30

## Continuous execution
Quarterly selections are combined into one chronological allowed-signal stream.
Execution is simulated continuously so open trades can cross quarter boundaries and overlapping signals remain handled correctly.

## Report
For each quarter:
- AUC
- selected fraction
- event positive rate
- selected positive rate
- key coefficient snapshot

Then report real execution:
- quarter metrics
- yearly metrics
- aggregate 2021Q1-2026Q3

## Success
Useful if:
- aggregate PF >1
- Swing Q2/Q3 2026 materially improve versus State Evolution v0.1
- improvement is not purchased by broad degradation across earlier quarters

If quarterly adaptation still cannot protect Swing in 2026:
conclude that prediction alone is insufficient and introduce an explicit live regime-health / risk-off management layer.

Pristine Forward OOS remains unread.
