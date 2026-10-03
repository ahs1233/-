# GTG Pre-Transition Guard v0.1 — Findings

Date: 2026-10-03
Scope: temporally separated Train-development diagnostic.
Validation and Historical Holdout remained closed.

## Design
FIT:
- pre-2021 complete H1 only
- 853 mature independent RANGE edge signals
- HANDOFF_BEFORE_TARGET: 565
- SAFE_MEAN_REVERSION: 288
- handoff prevalence: 66.24%

Frozen model:
- LogisticRegression
- 19 numeric causal onset features + fixed UTC session one-hot
- RobustScaler fit on pre-2021 only
- threshold fixed at 0.50
- model/scaler/training sample hashes frozen and committed before evaluation

Evaluation:
- 2021-01-01 <= signal < 2024-03-20
- 1,139 mature independent labels
- evaluation opened only after frozen artifacts were committed

## Integrity
PASS:
- frozen model hash unchanged
- training sample hash unchanged
- frozen State Engine hashes unchanged
- NO_GUARD baseline hash unchanged
- exact feature order frozen
- threshold exactly 0.50
- one active guarded trade
- no Validation read
- no Historical Holdout read
- unit tests 5/5 PASS

## Classification performance
Evaluation n=1,139

- accuracy: 55.75%
- balanced accuracy: 53.89%
- ROC AUC: 0.5637
- Brier: 0.2541
- HANDOFF prevalence: 63.92%

Confusion matrix [SAFE, HANDOFF]:
- SAFE -> SAFE: 194
- SAFE -> HANDOFF: 217
- HANDOFF -> SAFE: 287
- HANDOFF -> HANDOFF: 441

HANDOFF class:
- precision: 67.02%
- recall: 60.58%
- F1: 63.64%

SAFE class:
- precision: 40.33%
- recall: 47.20%
- F1: 43.50%

The registered balanced-accuracy screen >0.60 failed.

## Guarded execution
Flat candidate signals: 889
Allowed: 328
Skipped: 561
Coverage: 36.90%
Completed trades: 304
Long: 167
Short: 137

Economics:
- C0: -0.0159 ATR/trade
- C1: -0.2061
- C2: -0.3964
- C1 win rate: 44.41%

NO_GUARD Range Scalper v0.1:
- C0: +0.0061
- C1: -0.1811
- C2: -0.3683
- C1 win rate: 40.33%

So the Guard did not improve economics:
- C1 worsened from -0.1811 to -0.2061
- C2 worsened from -0.3683 to -0.3964

## What the Guard did improve
State-exit-before-target fraction:
- NO_GUARD: 62.96%
- Guarded: 57.24%

Actual HANDOFF rate:
- allowed candidates: 57.38%
- skipped candidates: 65.13%

So the model has weak structural information about imminent RANGE termination, but not enough to create positive execution expectancy.

## Direction
Guarded C1:
- long: -0.1926
- short: -0.2227

Both directions remain negative.

## Year stability
Guarded C1:
- 2021: -0.3473
- 2022: -0.3237
- 2023: -0.0493
- 2024 partial: +0.2016

The three full evaluation years are non-positive.

## Registered screen
FAIL.

Passed:
- evaluation labels >=500
- handoff recall >=0.60
- sample sizes
- long/short sizes
- coverage >=0.25
- lower state-exit fraction than NO_GUARD

Failed:
- balanced accuracy >0.60
- C0 >0
- C1 >0
- C2 >=0
- C1 win >0.50
- better C1 than NO_GUARD
- two full evaluation years positive

## Decision
Reject Pre-Transition Guard v0.1 as an execution filter.

Do NOT tune:
- probability threshold
- feature set
- class weights
- quartile entry zones
- midpoint target

on this same evaluation.

The failure indicates that the simple frozen 24-bar channel representation itself is likely too crude for the RANGE branch. The next experiment must change the market representation rather than optimize the same guard.

State Engine v0.2 remains the routing authority.
Validation/Historical Holdout remain closed.
