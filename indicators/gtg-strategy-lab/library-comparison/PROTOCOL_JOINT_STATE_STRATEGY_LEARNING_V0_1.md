# GTG Joint State + Strategy Learning v0.1 — preregistered symbolic-constrained utility policy

Registered 2026-10-03 before model fitting or policy evaluation.

## Purpose
Stop hand-writing another Range/Swing rule.

Keep the causal State Engine v0.2 as the symbolic authority:
- RANGE
- TRANSITION
- TREND_UP
- TREND_DOWN

Learn only the expected economic utility of actions that are symbolically allowed in the current state.

## Evidence status
Train-development research only.
The feature family and architecture were motivated by earlier experiments on the same broad research region. Therefore this is NOT independent confirmation.
Validation and Historical Holdout remain closed.

## Frozen structural source
State Engine v0.2 is unchanged.
No state threshold, transition rule, DC threshold, or state label is retrained.

## Symbolic action constraints
Allowed actions:
- RANGE: LONG, SHORT, FLAT
- TRANSITION: FLAT only
- TREND_UP: LONG, FLAT
- TREND_DOWN: SHORT, FLAT

The learned model cannot violate these constraints.

## Decision horizon
Primary action horizon is exactly 4 complete H1 trading bars.

Reason:
- this is fixed before fitting,
- it is short enough to represent local action utility,
- the policy will also exit early if the symbolic state ceases to allow the selected direction.

No horizon comparison is permitted in v0.1.

## Execution contract
Decision at close t.
If action is LONG or SHORT:
- enter at open(t+1)
- maximum exit signal bar = t+4
- if before that the frozen symbolic state no longer allows the action direction, exit signal occurs on that first disallowing close
- exit executes next open
- no hard-gap bridging
- no split crossing
- one active trade only

If FLAT:
- no trade; advance to the next bar.

Costs:
- use compare.costs exactly
- target utility = realized C1 under this same execution contract
- C0/C2 are evaluation diagnostics only

## Training population
FIT period:
- complete H1 decision bars with timestamp < 2021-01-01
- warm-up may use earlier causal bars
- all labels/exits must mature before 2021-01-01

For every eligible decision bar:
- generate only symbolically allowed non-flat action candidates
- compute the candidate action's realized C1 utility using the frozen future execution path
- one training row per non-flat action candidate

TRANSITION produces no non-flat training row because only FLAT is allowed.

## Evaluation period
Frozen evaluation:
- 2021-01-01 <= decision time < 2024-03-20T00:00:00Z
- no evaluation statistic may affect scaler, model, threshold, feature set, or hyperparameters.

Fit artifacts must be frozen and committed before evaluation is opened.

## Causal features
All features are t-or-earlier only.

Core state context:
1. state one-hot: RANGE / TREND_UP / TREND_DOWN
2. action direction (+1/-1)
3. aligned_action_vs_state:
   - +1 when action direction matches TREND direction
   - 0 in RANGE
4. prior24 position
5. prior24 width / ATR
6. distance to prior24 midpoint / ATR, signed in action direction
7. range_age = consecutive RANGE bars if RANGE else 0
8. trend_age = consecutive same TREND state bars if TREND else 0

Momentum / structure aligned to candidate action:
9. action * drift12
10. action * drift24
11. action * drift48
12. efficiency24
13. efficiency48
14. action * dc0p5_dir
15. action * dc1p0_dir
16. action * dc2p0_dir
17. action * dc4p0_dir
18. aligned DC count
19. opposing DC count

Execution context:
20. spread_atr
21. atr_week_ratio
22. rejection_body_atr = action*(close-open)/ATR
23. close_to_upper_atr
24. close_to_lower_atr
25. UTC session one-hot: Asia / London / NewYork / Late

No future return, outcome, MFE/MAE, state-exit time, or previously observed trade result may enter features.

## Scaling
RobustScaler fit on pre-2021 numeric features only.
Fixed session/state categories.

## Primary model
HistGradientBoostingRegressor with fixed parameters:
- loss = squared_error
- learning_rate = 0.05
- max_iter = 200
- max_leaf_nodes = 15
- max_depth = 4
- min_samples_leaf = 30
- l2_regularization = 1.0
- random_state = 20261003

No hyperparameter search.

## Linear reference
Ridge(alpha=1.0) on the same frozen scaled feature matrix.

The primary policy uses ONLY HistGradientBoostingRegressor.
The Ridge result is diagnostic and cannot replace the primary after evaluation.

## Policy
At every flat evaluation decision bar:
1. apply symbolic action constraints
2. predict C1 utility for each allowed non-flat action
3. compare best predicted non-flat utility with FLAT utility = 0
4. select non-flat action only if best predicted C1 > 0
5. otherwise FLAT

No probability threshold or margin tuning.

If a non-flat action is selected:
- execute using the frozen 4-bar/state-handoff contract
- while active, ignore new decisions
- resume scanning from exit execution bar.

## Fit/freeze/open discipline
1. FIT:
   - read/build only pre-2021 training rows
   - fit scaler, primary model, Ridge reference
   - freeze model artifacts and hashes
   - evaluation_opened=false

2. Commit fit artifacts.

3. OPEN-EVALUATION:
   - verify frozen hashes
   - mark opening timestamp
   - no parameter changes

4. Commit open marker.

5. EVALUATE:
   - compute out-of-time predictions/policy for 2021-2024
   - no refit.

## Metrics
Model diagnostics:
- training sample count
- evaluation candidate-action count
- MAE / RMSE / correlation predicted vs actual C1
- sign accuracy for C1 >0
- by state/action

Policy diagnostics:
- decision bars while flat
- selected LONG/SHORT/FLAT counts
- completed trades
- long/short counts
- state-at-entry counts
- C0/C1/C2 mean per trade
- C1 win rate
- C1 mean per flat decision opportunity
- mean/median duration
- by year
- by entry state
- hard-gap/split censor counts

Baselines on the SAME eligible decision stream:
A. SYMBOLIC_ALWAYS:
- RANGE: action = sign toward midpoint from position:
  position <0.5 => LONG; position >0.5 => SHORT; exact midpoint FLAT
- TREND_UP => LONG
- TREND_DOWN => SHORT
- TRANSITION => FLAT
- same 4-bar/state-handoff execution

B. FLAT:
- zero trades, C1 opportunity = 0

The learned policy must be compared to SYMBOLIC_ALWAYS, not cherry-picked legacy strategies with different entry populations.

## Registered development screen
All must hold to call the learned policy useful for further temporal testing:

Model:
1. evaluation action candidates >=1000
2. primary prediction-vs-realized C1 correlation >0.10
3. primary C1-positive sign accuracy >0.55

Policy:
4. completed trades >=150
5. long trades >=50
6. short trades >=50
7. C0 mean/trade >0
8. C1 mean/trade >0
9. C2 mean/trade >=0
10. C1 win rate >0.50
11. learned C1 mean/trade > SYMBOLIC_ALWAYS C1 mean/trade
12. learned C1 mean/opportunity > SYMBOLIC_ALWAYS C1 mean/opportunity
13. at least two of 2021, 2022, 2023 have positive learned C1 with n>=20

Passing remains development evidence only.

## Integrity
- protocol committed before fit
- State Engine hashes unchanged
- training decisions/labels/exits mature before 2021
- no evaluation scaler/model fitting
- primary model fixed before evaluation
- action constraints enforced
- TRANSITION always FLAT
- threshold exactly predicted C1 >0
- one active trade
- no hard-gap bridge
- no split crossing
- Validation read=false
- Historical Holdout read=false

## Decision
If primary policy fails:
- do not tune model depth, threshold, or horizon on evaluation;
- preserve failure;
- next step is larger/pristine data or a different representation learned from raw sequence context.

If primary policy passes:
- freeze it as a candidate symbolic-constrained policy;
- require a new independent temporal gate before opening Historical Holdout.

No Holdout opens automatically.

## Implementation clarification before fit
For early symbolic state exit versus the fixed four-bar maximum horizon:
- inspect state changes on bars t+1, t+2, and t+3; a disallowed state there exits at the following open,
- bar t+4 is the registered maximum horizon and exits at its BID/ASK close regardless of its closing state,
- therefore no action extends to open(t+5).
This priority rule was frozen before any model fit or action outcome was computed.
