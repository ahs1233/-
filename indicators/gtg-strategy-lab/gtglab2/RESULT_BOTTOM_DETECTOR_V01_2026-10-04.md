# RESULT — Bottom Detector v0.1

Date: 2026-10-04

## Dataset
Resolved Bottom Atlas candidates only:
- Train 2018-2022: 3,605, base GOOD rate 41.08%
- Validation 2023-2024: 1,494, base GOOD rate 41.77%
- Pseudo-test 2025-2026: 1,203, base GOOD rate 40.15%

Target:
GOOD48 = +3 ATR reached before -1 ATR within 48H.
FALSE48 = -1 ATR reached first.

No future fields were used as model inputs.
Pristine Forward OOS remained unread.

## Logistic detector
Selected C = 0.1.

ROC-AUC:
- Train: 0.6396
- Validation: 0.6233
- Pseudo-test: 0.6113

PR-AUC:
- Train: 0.5785
- Validation: 0.5632
- Pseudo-test: 0.5328

### Frozen validation thresholds -> pseudo-test

Validation 50%-coverage threshold:
- Validation precision 50.87%, lift 1.22x
- Pseudo-test coverage 49.04%
- Pseudo-test precision 48.31%, lift 1.20x

Validation 25%-coverage threshold:
- Validation precision 57.22%, lift 1.37x
- Pseudo-test coverage 24.11%
- Pseudo-test precision 53.45%, lift 1.33x

High-confidence threshold selected for >=60% validation precision:
- Validation coverage 17.47%
- Validation precision 60.15%, lift 1.44x
- Pseudo-test coverage 16.63%
- Pseudo-test precision 59.50%, lift 1.48x

This is the primary candidate.

## Shallow tree
Selected:
- depth 3
- min_samples_leaf 100

ROC-AUC:
- Train: 0.6358
- Validation: 0.6224
- Pseudo-test: 0.5969

High-confidence leaf threshold:
- Validation precision 69.38% at 10.71% coverage
- Pseudo-test precision 57.50% at 9.98% coverage

The tree is more interpretable but slightly less stable than logistic regression.

## Dominant causal features
Largest standardized logistic contributions:
1. lower_wick_atr: +0.304
2. ema50_slope_atr: +0.264
3. ema50_dist_atr: +0.264
4. close_location: +0.234
5. drift50_atr: -0.204
6. body_atr: +0.176
7. drift20_atr: -0.172
8. drift5_atr: +0.113

Interpretation:
- stronger lower-wick rejection raises bottom quality,
- stronger recovery close raises bottom quality,
- recent downside deceleration matters,
- medium-term context helps but does not dominate.

## Tree interpretation
The first split is lower-wick size.
Large lower wicks strongly shift the probability toward a real bottom.
When lower wick is smaller, a strong close-location recovery becomes more important.

This matches the Bottom Atlas descriptive result.

## Decision
Bottom Detector v0.1 passes the preregistered research promotion gate:
- Validation AUC > 0.58
- Pseudo-test AUC > 0.55
- High-score subset materially improves GOOD rate
- no future leakage detected

Promote the logistic detector as the general Bottom Score candidate for subsequent Swing/Scalper research.

Do NOT promote it directly as a trading strategy.
