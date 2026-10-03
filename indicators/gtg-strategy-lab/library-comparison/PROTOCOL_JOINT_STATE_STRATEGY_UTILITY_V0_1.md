# GTG Joint State + Strategy Utility v0.1

Registered 2026-10-03 before fitting any action-utility model or reading evaluation outcomes.

## Purpose
Move from hand-written entry rules to a neuro-symbolic policy:
- State Engine v0.2 remains the symbolic market-state authority.
- RANGE permits only Scalper actions or FLAT.
- TRANSITION forces FLAT.
- TREND_UP permits only Swing Long or FLAT.
- TREND_DOWN permits only Swing Short or FLAT.
- learned models estimate expected C1 utility of the permitted action at the current causal bar.

This is Train-development research, not independent confirmation. Validation and Historical Holdout remain closed.

## Frozen State source
state_sequence SHA256: cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772
state content SHA256: c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e
canonical manifest SHA256: 30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

## Temporal discipline
FIT: complete H1 signal bars and target paths resolving strictly before 2021-01-01.
FROZEN EVALUATION: 2021-01-01 <= signal < 2024-03-20T00:00:00Z.
Fit artifacts must be committed before evaluation is opened. No evaluation-derived feature, model parameter, utility threshold or horizon.

## Permitted actions and fixed contracts
RANGE:
- RANGE_LONG, max holding 4 complete H1 bars.
- RANGE_SHORT, max holding 4 complete H1 bars.
- FLAT.

TREND_UP:
- TREND_LONG, max holding 12 complete H1 bars.
- FLAT.

TREND_DOWN:
- TREND_SHORT, max holding 12 complete H1 bars.
- FLAT.

TRANSITION:
- FLAT only.

The 4/12-bar contracts encode Scalper vs Swing roles. They are development choices informed by the architecture and are not independent validation claims.

## Execution contract for an action at close t
- enter at open(t+1), requiring gap >0 and <=3h and same split.
- required state is the signal state: RANGE for scalp; exact TREND_UP/TREND_DOWN for swing.
- while held, if required state ends at close k before max horizon, exit open(k+1).
- otherwise at close(t+H), exit open(t+H+1).
- if state exit and horizon coincide, one next-open exit.
- hard gap >3h before causal exit censors the action target/trade.
- no stop, target, leverage, sizing, compounding or overlap.
- costs reuse compare.costs exactly with open-to-open BID/ASK and ATR[t].

Target utility is realized C1 from this fixed action contract. C0/C2 are never model targets.

## Causal feature contract
All features are available at signal close t only:
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
16. breakout_up_atr
17. breakout_down_atr
18. range_votes
19. log_state_age = log1p(consecutive bars in the exact current frozen state, reset on state change or hard gap)
20. candle_body_atr = (BidClose-BidOpen)/ATR
21. upper_wick_atr = (BidHigh-max(BidOpen,BidClose))/ATR
22. lower_wick_atr = (min(BidOpen,BidClose)-BidLow)/ATR
23-26. fixed UTC session one-hot: Asia 00-06, London 07-12, NewYork 13-20, Late 21-23.

No future state, resolution delay, PnL, MFE/MAE, future return, or model output is a feature.

## Models
Four fixed HistGradientBoostingRegressor models, one per permitted non-flat action:
- RANGE_LONG
- RANGE_SHORT
- TREND_LONG trained only on TREND_UP
- TREND_SHORT trained only on TREND_DOWN

Fixed sklearn parameters for every model:
- loss = squared_error
- learning_rate = 0.05
- max_iter = 150
- max_leaf_nodes = 15
- min_samples_leaf = 30
- l2_regularization = 1.0
- early_stopping = false
- random_state = 20261003

No hyperparameter comparison or feature selection.

## Policy
At a flat evaluation bar:
- RANGE: predict RANGE_LONG and RANGE_SHORT utility. Choose the larger only if predicted C1 > 0; otherwise FLAT.
- TREND_UP: enter TREND_LONG only if predicted C1 > 0.
- TREND_DOWN: enter TREND_SHORT only if predicted C1 > 0.
- TRANSITION: FLAT.

Utility threshold is exactly 0.0 ATR and may not be tuned.
If RANGE long/short predictions tie exactly, choose FLAT.
Only one position may be active. New decisions are ignored while active. Scanning resumes on the exit execution bar.

## Fit/freeze/open discipline
FIT command:
- reads only pre-2021 H1/state rows,
- constructs all mature independent action targets for each permitted model,
- fits four fixed models,
- writes training samples and frozen model artifact,
- freeze evaluation_opened=false.

Commit frozen fit artifacts.

OPEN-EVALUATION command:
- verifies hashes,
- records timestamp only,
- no model change.

Commit open marker.

EVALUATE command:
- reads 2021-2024 only after open marker,
- reports model diagnostics and sequential policy economics.

## Model diagnostics
Per action model on mature evaluation action targets:
- n
- target mean/median C1
- prediction mean
- MAE
- RMSE
- Pearson correlation when defined
- fraction predicted >0
- realized mean C1 among predicted-positive rows
- realized C1 win rate among predicted-positive rows

These diagnostics do not change the policy.

## Sequential policy metrics
- total decision opportunities by state
- trades / flat decisions
- coverage
- RANGE vs TREND trade counts
- long/short counts
- C0/C1/C2 mean per trade
- C1 win rate
- C1 total and mean per decision opportunity
- duration
- state-exit vs horizon-exit counts
- by state branch
- by direction
- by calendar year n>=30

Descriptive baselines:
- TREND_ALWAYS: whenever flat in TREND_UP/DOWN, take aligned 12-bar action under same exit contract.
- prior manual Range results may be quoted separately but are not same-opportunity baselines.

## Registered screen
All must hold to call the policy worth forward testing:
1. each training model has >=1000 mature targets
2. each evaluation model has >=1000 mature targets
3. sequential evaluation trades >=150
4. RANGE trades >=50
5. TREND trades >=50
6. long trades >=50
7. short trades >=50
8. overall C1 mean/trade >0
9. overall C2 mean/trade >=0
10. overall C1 win rate >0.50
11. RANGE branch C1 mean/trade >0
12. TREND branch C1 mean/trade >0
13. at least two of 2021/2022/2023 positive C1 with n>=30
14. no full evaluation year >60% of trades
15. policy C1 mean/trade > TREND_ALWAYS baseline C1 mean/trade

Passing is development evidence only.

## Integrity
- protocol committed before fit
- State hashes unchanged
- fit H1/state data ends before 2021
- all fit target exits resolve before 2021
- target is C1 only; no C0/C2 optimization
- exact feature order frozen
- model parameters frozen
- model hashes frozen before evaluation
- threshold exactly 0.0
- evaluation open marker committed before evaluation
- one active trade
- symbolic action constraints enforced
- TRANSITION forced FLAT
- no hard-gap bridge
- no split crossing
- Validation read=false
- Historical Holdout read=false

## Decision
If pass: freeze as Joint State+Strategy candidate and require a new forward/temporal gate before Holdout.
If fail: do not tune model/horizons/threshold on evaluation; preserve result and move to prospective/forward data or a fundamentally different representation rather than further in-sample rule search.
