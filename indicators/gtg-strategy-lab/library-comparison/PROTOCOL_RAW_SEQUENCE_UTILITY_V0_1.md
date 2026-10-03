# GTG Raw Sequence Utility v0.1 — preregistered temporal representation

Registered 2026-10-03 before fitting the temporal model.

## Status
Exploratory Train-development only.
2021-2024 has already been observed by previous research, so even a positive result here is NOT independent confirmation.
Validation and Historical Holdout remain closed.

## Purpose
Keep the frozen State Engine and symbolic action constraints, but replace the hand-crafted point-in-time utility representation with a fixed causal raw-sequence representation.

The question:
Can the path into the current state predict 4-H1 action C1 utility better than the failed static Joint State + Strategy Utility v0.1?

## Frozen source contracts

State Engine v0.2:
- state_sequence.csv.gz SHA256:
  cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772
- input_manifest.json SHA256:
  30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

Joint State + Strategy Utility v0.1:
- freeze.json SHA256:
  5671d7872d36769784d2540e9a90485c33b359e1da4b44769a79a557c8553dda
- evaluation_action_predictions.jsonl SHA256:
  f467c07e88f41b664ba4bacf67aa4708ffe06da220ea1606969def5bfd0a5dac
- summary.json SHA256:
  a36588efd58246617b3fb76e5ea91dc40a61050351caac8d9811f80b89a59e29

The action target/execution contract is unchanged from Joint State + Strategy Utility v0.1.

## Symbolic actions
- RANGE: RANGE_LONG / RANGE_SHORT / FLAT
- TRANSITION: FLAT only
- TREND_UP: TREND_LONG / FLAT
- TREND_DOWN: TREND_SHORT / FLAT

The temporal model cannot choose a symbolically disallowed action.

## Target
For each allowed non-flat action candidate:
- target = frozen realized C1 utility from the 4-H1/state-handoff contract already defined in Joint State + Strategy Utility v0.1.

Fit targets:
- use only the four frozen pre-2021 training JSONLs from the source utility run.

Evaluation targets:
- read the frozen source evaluation_action_predictions.jsonl only after this temporal model is frozen and evaluation is opened.

No target definition changes.

## Sequence window
Exactly 48 observed complete H1 trading bars ending at decision bar t.

A sample is eligible only when:
- all 48 bars exist,
- every adjacent timestamp gap is >0 and <=3h,
- every bar has a frozen State Engine row,
- decision action is symbolically allowed.

No weekend/large-gap bridging.

## Sequence channels
For each of the 48 bars j, normalized using only information available by decision t:

Price geometry relative to decision close and decision ATR:
1. (BidOpen[j] - BidClose[t]) / ATR[t]
2. (BidHigh[j] - BidClose[t]) / ATR[t]
3. (BidLow[j] - BidClose[t]) / ATR[t]
4. (BidClose[j] - BidClose[t]) / ATR[t]

Execution/volatility:
5. spread_atr[j]
6. ATR[j] / ATR[t]

Frozen state one-hot:
7. RANGE
8. TRANSITION
9. TREND_UP
10. TREND_DOWN

No engineered drift, efficiency, DC, quartile, retest, future outcome, MFE, MAE, or previously fitted prediction enters the temporal sequence.

## Static action input
One-hot only:
- RANGE_LONG
- RANGE_SHORT
- TREND_LONG
- TREND_SHORT

No other current-bar engineered feature is supplied.

## Model
One fixed 1D CNN utility regressor shared across all actions.

Input:
- sequence [10 channels x 48 bars]
- action one-hot [4]

Architecture:
- Conv1d(10, 16, kernel_size=5, padding=2)
- ReLU
- Conv1d(16, 32, kernel_size=5, padding=2)
- ReLU
- AdaptiveAvgPool1d(1)
- concatenate pooled 32-vector with 4 action inputs
- Linear(36, 32)
- ReLU
- Linear(32, 1)

No dropout.
No attention.
No recurrence.

Training:
- PyTorch CPU
- seed = 20261003
- deterministic algorithms where available
- optimizer Adam
- learning_rate = 0.001
- weight_decay = 0.0001
- batch_size = 256
- epochs = 20 exactly
- loss = MSE
- no early stopping
- no LR search
- no architecture search

## Channel normalization
Fit-period only.

For numeric sequence channels 1-6:
- compute global mean/std over eligible pre-2021 training windows only
- standardize with those frozen values.

State one-hot channels 7-10 remain {0,1}.

Action one-hot remains {0,1}.

Persist normalization statistics and model weights before evaluation.

## Fit / freeze / evaluation discipline
FIT:
- only raw H1/state rows <2021-01-01
- only source training targets <2021
- build eligible windows
- train fixed CNN
- persist model, normalization, training manifest, sample count
- evaluation_opened=false

Commit fit artifacts.

OPEN-EVALUATION:
- verify model/source hashes
- set evaluation_opened=true with timestamp
- no parameter changes

Commit open marker.

EVALUATE:
- load frozen source evaluation targets
- construct 48-bar windows from 2021-2024
- generate prediction for every eligible source action candidate
- run one-active-trade symbolic policy using predicted C1 >0 rule
- no refit.

## Policy
At each flat decision bar:
- TRANSITION => FLAT
- otherwise enumerate only symbolically allowed non-flat actions
- use frozen CNN predictions
- choose highest predicted utility
- trade only if best predicted C1 >0
- otherwise FLAT
- execute with the unchanged source 4-H1/state-handoff contract.

## Diagnostics
Model:
- n
- MAE
- RMSE
- Pearson correlation predicted vs realized C1
- C1-positive sign accuracy
- realized C1 among predicted-positive candidates
- by action

Policy:
- decision opportunities
- FLAT count
- trades
- long/short
- RANGE/TREND entries
- C0/C1/C2 mean per trade
- C1 win rate
- C1 total
- C1 per decision opportunity
- by year
- by branch

## Fixed comparisons
Compare against frozen Joint State + Strategy Utility v0.1:
- learned static policy C1/trade = -0.1610302450
- C1/opportunity = -0.0267167697
- aggregate utility correlation = -0.0122860617
- aggregate sign accuracy = 0.5492452029

These numbers are frozen descriptive references, not tuning targets.

## Registered exploratory screen
All must hold to mark the sequence representation worth future independent testing:

Model:
1. eligible evaluation candidates >=10000
2. aggregate Pearson correlation >0.10
3. C1-positive sign accuracy >0.55

Policy:
4. completed trades >=150
5. long >=50
6. short >=50
7. RANGE entries >=50
8. TREND entries >=50
9. C0 mean/trade >0
10. C1 mean/trade >0
11. C2 mean/trade >=0
12. C1 win rate >0.50
13. C1/trade > frozen static policy -0.1610302450
14. C1/opportunity > frozen static policy -0.0267167697
15. at least two of 2021/2022/2023 positive C1 with n>=20

Passing remains exploratory only.

## Integrity
- protocol committed before fit
- source hashes unchanged
- fit source rows/targets <2021 only
- 48-bar windows causal and contiguous
- no evaluation normalization/model fit
- model hash frozen before evaluation
- symbolic constraints unchanged
- threshold predicted C1 >0 fixed
- one active trade
- no hard-gap bridge
- Validation read=false
- Historical Holdout read=false

## Decision
If failed:
- do not tune window length, CNN depth, threshold, or epochs on 2021-2024.
- preserve result.
- stop extracting more hypotheses from the same Train evaluation and require genuinely new/pristine temporal data for further confirmation.

If passed:
- freeze as a candidate representation only.
- still require a new pristine forward/temporal gate before any Holdout decision.
