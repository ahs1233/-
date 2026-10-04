# PROTOCOL — Bottom Detector v0.1

Date: 2026-10-04

## Goal
Build a causal detector that distinguishes a real bottom from a false low using only information known on the candidate H1 bar.

No strategy optimization.
No calendar-year feature.
No macro inputs.
Pristine Forward OOS remains unread.

## Source population
Bottom Atlas v0.1 bottom candidates:
- candidate = H1 low below prior 12H low.
- use only resolved 48H outcomes.
- GOOD = +3 ATR occurs before -1 ATR within the next 48H.
- FALSE = -1 ATR occurs first.
- ambiguous/unresolved cases excluded from detector fitting/evaluation.

## Features
Causal features only:
- drift5_atr, drift20_atr, drift50_atr
- eff5, eff20, eff50
- pos24, pos72
- atr_rel120
- close_location
- body_atr
- lower_wick_atr
- upper_wick_atr
- ema50_dist_atr
- ema200_dist_atr
- ema50_slope_atr
- ema200_slope_atr
- decline_from_24h_high_atr
- decline_from_72h_high_atr

No future MFE/MAE or future-hit fields are allowed as inputs.

## Temporal split
- Development train: 2018-03-01 through 2022-12-31
- Validation: 2023-01-01 through 2024-12-31
- Internal pseudo-test: 2025-01-01 through 2026-09-30

2025-2026 has been used in other GTGLab research before, so this is not true clean OOS.
It is only an internal temporal robustness test.
The true blind gate remains Pristine Forward OOS.

## Models
A. Logistic regression:
- median imputation learned from train only
- standardization learned from train only
- class-weight balanced
- L2 regularization
- C values tested only on validation: 0.1, 0.3, 1.0, 3.0
- choose C by validation ROC-AUC; tie-break by Brier score then simplicity.

B. Shallow decision tree:
- max_depth 2, 3, 4
- min_samples_leaf 50, 100, 200
- class_weight balanced
- choose by validation ROC-AUC with preference for shallower tree within 0.01 AUC of best.

## Score operating points
Thresholds are chosen on validation only for:
- Coverage ~50%
- Coverage ~25%
- High-confidence precision target >=60% if achievable

Then freeze thresholds and report pseudo-test performance without retuning.

## Metrics
- ROC-AUC
- PR-AUC
- Brier score
- precision / recall / coverage at frozen thresholds
- yearly performance
- calibration by score decile
- top coefficients / tree rules

## Promotion criterion
This study can only promote a detector candidate for further strategy research if:
- validation ROC-AUC > 0.58
- pseudo-test ROC-AUC > 0.55
- high-score subset improves GOOD rate materially over baseline
- no future leakage detected

No Pine trading strategy will be promoted directly from this detector run.
