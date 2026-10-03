# GTG Joint State + Strategy Learning v0.1 — symbolic router + learned action utility

Registered 2026-10-03 before fitting or evaluating the learned policy.

## Purpose
Stop adding hand-written Range/Swing rules.

Keep the frozen causal State Engine v0.2 as the symbolic authority:
- RANGE
- TRANSITION
- TREND_UP
- TREND_DOWN

Learn only action utility inside the actions allowed by each state.

## Symbolic action constraints
At decision close t:

RANGE:
- NO_TRADE
- SCALP_LONG
- SCALP_SHORT

TRANSITION:
- NO_TRADE only

TREND_UP:
- NO_TRADE
- SWING_LONG

TREND_DOWN:
- NO_TRADE
- SWING_SHORT

The learned model cannot override these constraints.

## Evidence status
Train-development research only.
Earlier manual strategies already used this broad historical region.
Validation and Historical Holdout remain closed.

## Frozen source
State Engine v0.2:
- state_sequence.csv.gz SHA256:
  cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772
- state content SHA256:
  c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e
- canonical input_manifest.json SHA256:
  30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

No State Engine threshold is changed.

## Temporal split
FIT:
- decision timestamp < 2021-01-01
- all action outcomes must mature before 2021-01-01

FROZEN EVALUATION:
- 2021-01-01 <= decision timestamp < 2024-03-20T00:00:00Z
- no evaluation-derived model/scaler/threshold/feature choice

Fit artifacts must be frozen and committed before evaluation is opened.

## Decision horizon
Fixed maximum holding horizon:
- 4 complete H1 trading bars after decision close.

Reason:
- preregistered as a single short-horizon decision problem before outcomes;
- no 12/24 horizon comparison in this experiment.

## Action execution contract
For a non-flat allowed action decided at close t:
- enter at open(t+1)
- direction:
  - LONG = +1
  - SHORT = -1
- ATR denominator = ATR[t]

Maximum exit:
- close of bar t+4.

Early symbolic state exit:
- RANGE action exits when first future close has state != RANGE
- SWING_LONG exits when first future close has state != TREND_UP
- SWING_SHORT exits when first future close has state != TREND_DOWN
- early state exit is executed at next open after the state-change close.

If no early symbolic exit:
- exit using BID/ASK close at t+4.

No hard-gap bridging.
Any >3h gap before planned/early exit censors that action label.
No stop, target, leverage, sizing, compounding, or pyramiding.

Costs:
- use compare.costs C0/C1/C2 exactly.
Primary utility target:
- C1 ATR per trade.

## Training action examples
For every mature FIT decision bar:
- RANGE produces two supervised examples:
  - RANGE_LONG
  - RANGE_SHORT
- TREND_UP produces one:
  - TREND_LONG
- TREND_DOWN produces one:
  - TREND_SHORT
- TRANSITION produces no action example.

Target = realized C1 from the frozen action execution contract.

NO_TRADE has utility exactly 0 and is not separately fitted.

## Causal features at t
Numeric:
1. position24
2. prior24_width_atr
3. drift12
4. drift24
5. drift48
6. efficiency24
7. efficiency48
8. dc0p5_dir
9. dc1p0_dir
10. dc2p0_dir
11. dc4p0_dir
12. dc_up_count
13. dc_down_count
14. spread_atr
15. atr_week_ratio
16. log_state_age
17. distance_to_upper_atr
18. distance_to_lower_atr
19. distance_to_midpoint_atr
20. candle_body_atr
21. candle_range_atr

Fixed categorical one-hot:
- state: RANGE / TREND_UP / TREND_DOWN
- UTC session: Asia / London / NewYork / Late
- action family: RANGE_LONG / RANGE_SHORT / TREND_LONG / TREND_SHORT

No future field, resolution label, PnL subgroup, or post-hoc manual strategy result enters the features.

State age:
- consecutive bars in the same frozen state under <=3h trading continuity.

## Scaling
Fit RobustScaler on FIT numeric features only.
Evaluation uses frozen scaler.
Fixed categorical vocabularies.

## Primary model
RandomForestRegressor with fixed settings:
- n_estimators = 600
- max_depth = 8
- min_samples_leaf = 20
- max_features = sqrt
- random_state = 20261003
- n_jobs = 1

No hyperparameter search.
No model-family comparison for promotion.

## Policy
At each flat evaluation decision close:
- generate only actions allowed by symbolic state
- predict C1 utility for each allowed non-flat action
- select the action with highest predicted utility
- execute it only if predicted utility > 0.0
- otherwise NO_TRADE

For RANGE:
- model may choose LONG, SHORT, or NO_TRADE.

For TREND:
- model may choose state-aligned direction or NO_TRADE.

TRANSITION:
- always NO_TRADE.

Threshold 0.0 is fixed before evaluation and means predicted positive net utility after benchmark friction.

## One-active-trade evaluation
Chronological simulation:
- only one active trade
- while active, no new decision
- after fixed-horizon close or causal state exit, next decision may occur at/after that exit point
- no overlapping actions.

## Baselines
Evaluation comparison only:
1. ALWAYS_ALLOWED:
   - RANGE: choose direction toward midpoint from current position
     - position <0.5 -> LONG
     - position >=0.5 -> SHORT
   - TREND_UP -> LONG
   - TREND_DOWN -> SHORT
   - TRANSITION -> NO_TRADE
2. NO_TRADE = zero.

Baselines do not affect model fitting.

## Fit/freeze/open discipline
FIT:
- read only pre-2021 rows/outcomes
- persist training examples, scaler, RF structure/config, feature order, action vocabulary
- freeze hashes
- evaluation_opened=false

Commit fit artifacts.

OPEN-EVALUATION:
- verify frozen hashes
- set immutable open marker
- no model changes

Commit marker.

EVALUATE:
- read 2021-2024
- persist predictions, chosen actions, trades, metrics.

## Evaluation metrics
Model:
- n supervised mature action examples
- MAE
- RMSE
- Pearson/Spearman prediction-vs-C1
- sign accuracy of predicted positive vs actual positive

Policy:
- decision opportunities
- trades
- coverage
- state mix of trades
- action mix
- C0/C1/C2 mean/trade
- C1 mean/decision opportunity
- C1 win rate
- median/mean holding bars
- early state-exit fraction
- long/short counts
- RANGE vs TREND economics
- by 2021/2022/2023 when n>=20

## Registered screen
All must hold to call the learned policy useful for further testing:
1. evaluation completed trades >=150
2. coverage >=0.10
3. C0 mean/trade >0
4. C1 mean/trade >0
5. C2 mean/trade >=0
6. C1 win rate >0.50
7. C1 mean/decision opportunity >0
8. at least 50 RANGE trades OR at least 50 TREND trades
9. both long and short trades >=40
10. at least two of 2021/2022/2023 positive C1 with n>=20
11. learned policy C1/trade > ALWAYS_ALLOWED C1/trade
12. model sign accuracy >0.55

Passing is still development evidence only.

## Integrity
- protocol committed before fit
- source state hashes unchanged
- fit samples/outcomes <2021
- no evaluation read before freeze
- exact feature/action vocab frozen
- RF hyperparameters fixed
- utility threshold exactly 0.0
- symbolic action constraints enforced
- TRANSITION always NO_TRADE
- one active trade
- no hard-gap bridge
- no split crossing
- Validation read=false
- Historical Holdout read=false

## Decision
If fail:
- preserve failure;
- do not tune RF/horizon/threshold on evaluation;
- next step is prospective/new data or a new representation, not further optimization on this slice.

If pass:
- freeze as Joint Policy candidate;
- require a fresh independent temporal gate before any Historical Holdout decision.

No Holdout opens automatically.
