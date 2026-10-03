# GTG Raw Sequence Utility v0.1 — Findings

Date: 2026-10-03
Scope: exploratory Train-development temporal-representation test.
Validation and Historical Holdout remained closed.

## Purpose
Test whether a causal 48-H1 raw temporal path contains action-utility information that static engineered snapshots failed to capture.

The State Engine remained the symbolic authority:
- RANGE: RANGE_LONG / RANGE_SHORT / FLAT
- TRANSITION: FLAT
- TREND_UP: TREND_LONG / FLAT
- TREND_DOWN: TREND_SHORT / FLAT

Target and execution contract were unchanged from Joint State + Strategy Utility v0.1.

## Representation
Exactly 48 complete H1 trading bars ending at decision t.

Per-bar channels:
- Bid OHLC relative to decision close / decision ATR
- spread / ATR
- bar ATR / decision ATR
- State Engine one-hot: RANGE / TRANSITION / TREND_UP / TREND_DOWN

Static input:
- action one-hot only

No drift/DC/efficiency/quartile/retest feature entered the temporal model.

## Model
Fixed shared 1D CNN:
- Conv1d 10->16, kernel 5
- Conv1d 16->32, kernel 5
- global average pooling
- action one-hot concat
- MLP 36->32->1

Training was fixed before evaluation:
- Adam lr 0.001
- weight decay 0.0001
- batch 256
- 20 epochs
- MSE
- no early stopping
- no architecture or threshold search
- seed 20261003

## Fit
Eligible pre-2021 sequence samples:
- total: 8,784
- RANGE_LONG: 3,303
- RANGE_SHORT: 3,303
- TREND_LONG: 1,235
- TREND_SHORT: 943

12,624 source action samples were excluded because a valid 48-bar contiguous trading window was unavailable.

Training MSE:
- epoch 1: 2.6603
- epoch 10: 2.5720
- epoch 20: 2.4825

Frozen model SHA256:
44fc6c53ab0820edb6ac974ffaddd7d77d6e8f24eb2707ebab50ba3d85e32b79

The model was frozen and committed before evaluation opened.

## Evaluation model diagnostics
Eligible action candidates:
- n = 12,948

Aggregate:
- realized mean C1: -0.1990 ATR
- predicted mean: -0.2082
- MAE: 1.2924
- RMSE: 1.9195
- Pearson correlation: +0.0103
- C1-positive sign accuracy: 55.57%
- predicted-positive fraction: 12.57%

Critical diagnostic:
Candidates predicted positive still realized:
- mean C1 = -0.2489 ATR
- C1 win rate = 44.53%

Thus the sequence model did not identify positive-utility actions out of time.

## Sequential policy
Decision rule:
- among symbolically allowed actions choose highest predicted C1
- trade only when best predicted C1 >0
- otherwise FLAT

Results:
- completed trades: 326
- long: 104
- short: 222
- RANGE entries: 180
- TREND entries: 146

Economics:
- C0: -0.1587 ATR/trade
- C1: -0.3160
- C2: -0.4733
- C1 win rate: 41.72%
- total C1: -103.02 ATR
- C1 per decision opportunity: -0.00607

By branch:
RANGE:
- n=180
- C1 -0.2470
- C2 -0.4044

TREND:
- n=146
- C1 -0.4010
- C2 -0.5581

Both branches fail.

## Year stability
C1/trade:
- 2021: -0.1405
- 2022: -0.4023
- 2023: -0.2221
- 2024 partial: n=27

No full evaluation year is positive.

## Comparison with static Joint Utility
Static learned policy:
- C1/trade: -0.1610
- C1/opportunity: -0.02672
- utility correlation: -0.0123
- sign accuracy: 54.92%

Raw sequence:
- C1/trade: -0.3160 — worse
- C1/opportunity: -0.00607 — less negative because it trades much less
- correlation: +0.0103 — still effectively zero
- sign accuracy: 55.57% — marginally above registered sign screen only

The sequence model became more selective but did not discover positive utility.

## Registered screen
FAIL.

Passed:
- evaluation candidate count
- sign accuracy >55%
- trade/side/branch sample sizes
- C1 per opportunity better than static policy

Failed:
- utility correlation >0.10
- C0 >0
- C1 >0
- C2 >=0
- win rate >50%
- C1/trade better than static policy
- two positive full years

## Integrity
PASS:
- protocol committed before fit
- pre-2021 fit only
- model frozen/committed before evaluation
- evaluation marker committed before outcomes
- State Engine/source hashes unchanged
- exact 48-bar causal window
- no large-gap bridge
- symbolic constraints unchanged
- threshold predicted C1 >0 fixed
- one active trade
- Validation read=false
- Historical Holdout read=false
- unit tests 5/5 PASS before fit

## Conclusion
The failure is no longer attributable merely to one hand-crafted rule or to static feature engineering.

Across this research period:
- hand-built RANGE rules failed,
- transition filters failed economically,
- static learned utility failed,
- raw 48-H1 sequence utility also failed.

The strongest structural result remains the State/Transition layer itself, not a stable execution edge.

Continuing to iterate models or thresholds on the already-observed 2021-2024 development region would primarily increase selection bias.

## Decision
Reject Raw Sequence Utility v0.1.

Do NOT tune on this evaluation:
- window length
- CNN architecture
- epochs
- utility threshold
- action subgroups
- years/directions

Next step:
- stop hypothesis extraction from the reused 2021-2024 evaluation;
- establish a genuinely pristine temporal gate / prospective data protocol for the frozen research candidates;
- keep Validation and Historical Holdout closed until the gate and candidate-selection rules are explicitly defined.

No Holdout opens automatically.
