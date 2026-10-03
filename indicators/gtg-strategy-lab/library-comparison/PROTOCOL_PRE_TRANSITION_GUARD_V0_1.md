# GTG Pre-Transition Guard v0.1 — preregistered Range handoff-risk model

Registered 2026-10-03 before fitting the guard or computing guarded evaluation economics.

## Purpose
Add the missing early-warning layer:

RANGE
-> candidate Range scalp
-> Pre-Transition Guard asks whether RANGE is likely to end before mean reversion reaches the frozen midpoint
-> high handoff risk: STAND_DOWN
-> low handoff risk: allow the unchanged Range Scalper v0.1 trade
-> TRANSITION: Scalper OFF

This experiment does NOT change the frozen State Engine, RANGE definition, quartiles, midpoint, execution costs, or state-handoff exit.

## Evidence status
Train-development research only.
The failure mechanism was discovered in Range Scalper v0.1 on the same broad research region, so this is not independent confirmation even though model fitting and evaluation are temporally separated.
Validation and Historical Holdout remain closed.

## Frozen structural source
State Engine v0.2:
- state_sequence.csv.gz SHA256:
  cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772
- state content SHA256:
  c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e
- canonical full raw manifest SHA256:
  30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

Range Scalper v0.1 rule remains unchanged:
- lower quartile + bullish rejection = long candidate
- upper quartile + bearish rejection = short candidate
- midpoint target
- state exit when RANGE ends
- next-open execution
- C0/C1/C2 from compare.costs
- one active trade in execution simulation

## Temporal fit/evaluation split
FIT / historical library:
- complete H1 bars < 2021-01-01
- model labels must resolve before 2021-01-01

FROZEN EVALUATION:
- 2021-01-01 <= signal < 2024-03-20T00:00:00Z
- no evaluation-derived scaler, coefficient, feature, threshold, or class weight

Fit artifacts must be committed before evaluation is opened.

## Independent signal population for model learning
For model construction, enumerate every valid Range Scalper edge-zone signal on every complete H1 RANGE bar, irrespective of whether another hypothetical trade would have been open.

This avoids path-dependent sampling from the one-position execution simulator.

Each signal freezes:
- direction
- lower
- upper
- midpoint
- channel width
- ATR_ref

## Supervised structural label
Starting from the candidate's next bar, using frozen State Engine states and the candidate's frozen midpoint:

SAFE_MEAN_REVERSION = 0 if:
- midpoint target occurs before RANGE ends, or
- midpoint target and RANGE exit occur on the same close.

HANDOFF_BEFORE_TARGET = 1 if:
- frozen state leaves RANGE before the frozen midpoint target is reached.

Censor, do not label, if:
- entry crosses hard gap,
- hard gap occurs before either event,
- split/data boundary occurs before either event,
- required state is missing.

No C0/C1/C2, MFE, MAE, or trade PnL enters training.

## Causal onset features
All measured at signal close t only.

Numeric features:
1. candidate_direction
2. edge_depth: long=position, short=1-position
3. channel_width_atr
4. midpoint_distance_atr
5. rejection_body_atr = direction*(close-open)/ATR
6. aligned_drift12 = direction*drift12
7. aligned_drift24
8. aligned_drift48
9. efficiency24
10. efficiency48
11. aligned_dc0p5 = direction*dc0p5_dir
12. aligned_dc1p0
13. aligned_dc2p0
14. aligned_dc4p0
15. aligned_dc_count
16. opposing_dc_count
17. spread_atr
18. atr_week_ratio
19. log_range_age = log1p(consecutive causal RANGE bars in the current trading episode)

Fixed UTC session one-hot:
- Asia: 00-06
- London: 07-12
- NewYork: 13-20
- Late: 21-23

RANGE age increments only across adjacent observed H1 bars with gap >0 and <=3h and frozen state still RANGE. It resets at non-RANGE, missing state, or hard gap.

## Scaling
Fit RobustScaler on FIT numeric features only.
Evaluation uses frozen center/scale.
Session categories use the fixed vocabulary above.

## Model
One fixed Logistic Regression:
- target = HANDOFF_BEFORE_TARGET
- penalty = L2
- C = 1.0
- class_weight = balanced
- max_iter = 5000
- random_state = 20261003

No hyperparameter comparison.
No feature selection from outcomes.
No calibration fit.

## Guard threshold
Fixed before evaluation:
- if P(HANDOFF_BEFORE_TARGET) >= 0.50 -> STAND_DOWN
- if P(HANDOFF_BEFORE_TARGET) < 0.50 -> ALLOW Range Scalper trade

The 0.50 threshold may not be tuned from evaluation.

## Fit/freeze/open discipline
1. FIT command:
   - parses only pre-2021 price/state rows for model construction,
   - writes training samples, scaler, coefficients, feature order, class counts,
   - writes freeze with evaluation_opened=false.

2. Commit frozen fit artifacts.

3. OPEN-EVALUATION command:
   - verifies frozen hashes,
   - records opening timestamp,
   - changes no model parameter.

4. Commit the open marker.

5. EVALUATE command:
   - reads 2021-2024 signals,
   - computes classification metrics,
   - runs the guarded one-active-trade Range Scalper simulation.

## Classification metrics
On all mature independent evaluation edge signals:
- n
- class prevalence
- accuracy
- balanced accuracy
- ROC AUC
- Brier score
- precision/recall/F1 for HANDOFF_BEFORE_TARGET
- confusion matrix
- predicted-risk distribution

## Guarded execution
Chronological one-active-position simulation identical to Range Scalper v0.1 except:

When flat and a valid edge-zone signal occurs:
- compute frozen p_handoff
- if p_handoff >=0.50: skip trade and continue scanning next bar
- otherwise execute unchanged v0.1 trade.

Persist every flat candidate and decision.

Compare:
- NO_GUARD = frozen Range Scalper v0.1
- PRE_TRANSITION_GUARD = guarded simulation

Evaluation metrics:
- candidate signals while flat
- allowed trades
- skipped trades
- coverage
- completed trades
- censor counts
- long/short counts
- target/state-exit fractions
- C0/C1/C2 mean/trade
- C1 mean/opportunity over flat candidates
- C1 win rate
- holding duration
- MFE/MAE
- by year where n>=20

Also report:
- actual HANDOFF_BEFORE_TARGET rate among allowed candidates
- actual HANDOFF_BEFORE_TARGET rate among skipped candidates

These future labels are diagnostic only and never used by the guard decision.

## Registered evaluation screen
All must hold:

Classification:
1. mature evaluation labels >=500
2. balanced accuracy >0.60
3. HANDOFF_BEFORE_TARGET recall >=0.60

Guard execution:
4. completed trades >=100
5. long completed >=40
6. short completed >=40
7. coverage >=0.25 of flat candidate signals
8. C0 mean/trade >0
9. C1 mean/trade >0
10. C2 mean/trade >=0
11. C1 win rate >0.50
12. guarded C1 mean/trade > NO_GUARD evaluation C1 (-0.1811011019)
13. state-exit-before-target fraction < NO_GUARD evaluation 0.6295620438
14. at least two of 2021/2022/2023 have positive C1 with n>=20

Passing remains development evidence only.

## Integrity
- protocol committed before fit
- frozen State Engine hashes unchanged
- fit rows/labels <2021 only
- fit label resolves before split
- no PnL/cost field in model features/labels
- scaler/model frozen before evaluation
- evaluation open marker committed before evaluation outcomes
- exact feature order frozen
- threshold exactly 0.50
- one active guarded trade
- no hard-gap bridging
- no split crossing
- Validation read=false
- Historical Holdout read=false

## Decision
If the guard fails:
- do not tune probability threshold or feature set on evaluation;
- preserve the result;
- next Range branch should change the market representation rather than optimize the same guard.

If the guard passes:
- freeze it as the Range execution candidate;
- integrate RANGE -> Guarded Scalper -> TRANSITION OFF with the existing Swing research router;
- require a new temporal/forward gate before any Historical Holdout decision.

No Holdout opens automatically.
