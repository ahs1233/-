# GTG MiniRocket Sequence Utility v0.1 — preregistered raw-sequence neuro-symbolic policy

Registered 2026-10-03 before installing/fitting MiniRocket or reading sequence-model evaluation outcomes.

## Purpose
Test whether the failure of Joint State + Strategy Utility v0.1 comes from the hand-crafted tabular representation.

Keep unchanged:
- State Engine v0.2 symbolic authority
- action permissions
- Range horizon = 4 H1 bars
- Trend horizon = 12 H1 bars
- TRANSITION = FLAT
- compare.costs C0/C1/C2
- threshold predicted C1 > 0
- one active trade

Change only the representation/model:
- use a fixed causal multivariate raw-sequence window
- MiniRocket transform
- fixed Ridge(alpha=1.0) regressors per action

## Evidence status
Train-development research only.
The architecture and action contracts were developed on the same broad research region.
Validation and Historical Holdout remain closed.

## Temporal discipline
FIT:
- decision times and all action exits strictly before 2021-01-01
- sequence windows use t-or-earlier data only

FROZEN EVALUATION:
- 2021-01-01 <= decision time < 2024-03-20T00:00:00Z

Fit artifacts must be frozen and committed before evaluation opens.

## Symbolic actions
- RANGE: RANGE_LONG / RANGE_SHORT / FLAT
- TRANSITION: FLAT only
- TREND_UP: TREND_LONG / FLAT
- TREND_DOWN: TREND_SHORT / FLAT

Action execution contract is identical to Joint State + Strategy Utility v0.1:
- decision close t
- enter open(t+1)
- RANGE max horizon = close(t+4) signal, exit open(t+5)
- TREND max horizon = close(t+12) signal, exit open(t+13)
- if required symbolic state ends earlier, exit open after first disallowing close
- no hard-gap bridge
- no split crossing

Target utility = realized C1 only.

## Sequence window
Window length W = 48 observed complete H1 bars ending at decision bar t.

Require:
- exactly 48 bars
- every adjacent timestamp gap >0 and <=3h
- no weekend/large closure gap inside sequence

No padding and no imputation.

## Sequence channels
For every decision t, let:
- C_ref = BidClose[t]
- ATR_ref = frozen State Engine ATR[t]

Require finite ATR_ref >0.

Channels over j=t-W+1 ... t:
1. bid_open_rel = (BidOpen[j] - C_ref) / ATR_ref
2. bid_high_rel = (BidHigh[j] - C_ref) / ATR_ref
3. bid_low_rel = (BidLow[j] - C_ref) / ATR_ref
4. bid_close_rel = (BidClose[j] - C_ref) / ATR_ref
5. spread_rel = (AskClose[j] - BidClose[j]) / ATR_ref
6. symbolic_state_code:
   - TREND_DOWN = -1
   - RANGE = 0
   - TRANSITION = 0.5
   - TREND_UP = +1

All channels are causal and fixed before outcomes.
No handcrafted drift, DC, RSI, MACD, future label, MFE/MAE, or PnL channel is included.

## MiniRocket transform
Use aeon MiniRocket multivariate transform with:
- n_kernels = 5000
- max_dilations_per_kernel = 32
- random_state = 20261003
- n_jobs = -1

One shared MiniRocket transform is fit on unique pre-2021 decision windows from all states that have at least one mature non-flat action target.

No label is passed to the transform.

## Utility regressors
Four separate sklearn Ridge regressors:
- RANGE_LONG
- RANGE_SHORT
- TREND_LONG
- TREND_SHORT

Fixed:
- alpha = 1.0
- fit_intercept = True

Input = frozen MiniRocket features.
Target = realized C1 under the unchanged action contract.

No alpha search / RidgeCV.
No feature selection.
No probability calibration.

## Policy
Same as Joint State + Strategy Utility v0.1:
- at flat decision bar, enforce symbolic action set
- predict C1 for permitted non-flat action(s)
- choose best action only if max predicted C1 > 0
- otherwise FLAT
- exact RANGE tie => FLAT
- TRANSITION always FLAT

## Fit/freeze/open discipline
FIT:
- load only pre-2021 H1/state prefix
- build causal W=48 windows
- fit one MiniRocket transform
- transform pre-2021 windows
- fit four fixed Ridge models
- persist training decision-time index and model artifacts
- evaluation_opened=false

Commit fit artifacts.

OPEN-EVALUATION:
- verify all hashes
- record opening timestamp only
- commit marker

EVALUATE:
- read 2021-2024
- transform evaluation windows with frozen MiniRocket
- no refit
- evaluate independent action utilities and sequential learned policy

## Diagnostics
Per action:
- training n
- evaluation n
- target mean/median C1
- predicted mean
- MAE
- RMSE
- Pearson correlation
- C1-positive sign accuracy
- predicted-positive fraction
- realized mean C1 among predicted-positive
- realized C1 win rate among predicted-positive

Aggregate model diagnostics:
- pooled Pearson correlation
- pooled sign accuracy

Sequential policy:
- decision opportunities by state
- trades
- RANGE/TREND counts
- long/short
- C0/C1/C2 mean/trade
- C1 win rate
- C1 mean/decision opportunity
- by year
- by branch
- censor counts

## Frozen comparisons
A. Tabular Joint State + Strategy Utility v0.1:
- overall C1/trade = -0.1610302450
- RANGE branch C1 = -0.1394250546
- TREND branch C1 = -0.2209656965
- aggregate eval correlation = -0.0122860617
- aggregate sign accuracy = 0.5492452029

B. TREND_ALWAYS baseline under the same action contract:
- C1/trade = -0.2291680825

These comparison values are descriptive and may not tune MiniRocket.

## Registered development screen
All must hold:
1. every training action model >=1000 targets
2. every evaluation action model >=1000 targets
3. pooled eval correlation >0.10
4. pooled C1-positive sign accuracy >0.55
5. sequential trades >=150
6. RANGE trades >=50
7. TREND trades >=50
8. long trades >=50
9. short trades >=50
10. overall C0 >0
11. overall C1 >0
12. overall C2 >=0
13. C1 win rate >0.50
14. RANGE branch C1 >0
15. TREND branch C1 >0
16. at least two of 2021/2022/2023 positive C1 with n>=30
17. MiniRocket overall C1 > tabular utility C1 (-0.1610302450)
18. MiniRocket pooled correlation > tabular pooled correlation (-0.0122860617)

Passing remains development evidence only.

## Integrity
- protocol committed before aeon install/fit
- aeon version pinned/recorded
- state hashes unchanged
- W exactly 48
- sequence gap <=3h only
- sequence ends at t
- no future channel
- shared transform fit pre-2021 only
- Ridge alpha exactly 1.0
- model/transform hashes frozen before evaluation
- action contracts unchanged
- threshold exactly predicted C1 >0
- TRANSITION forced FLAT
- one active trade
- no gap/split bridge
- Validation read=false
- Historical Holdout read=false

## Decision
If fail:
- do not tune W, kernels, alpha, channels, or threshold on evaluation.
- preserve failure.
- stop further retrospective model search on the same 2018-2024 development slice.
- next work must use prospective/new data or formally open a separate predefined validation gate.

If pass:
- freeze as sequence-policy candidate.
- still require an independent temporal/forward gate before Historical Holdout.
