# GTG Joint State + Strategy Utility v0.1 — Findings

Date: 2026-10-03
Scope: Train-development, temporally separated fit/evaluation.
Validation and Historical Holdout remained closed.

## Design
- frozen State Engine v0.2 remains symbolic authority
- RANGE permits RANGE_LONG / RANGE_SHORT / FLAT
- TRANSITION forces FLAT
- TREND_UP permits TREND_LONG / FLAT
- TREND_DOWN permits TREND_SHORT / FLAT
- four fixed HistGradientBoostingRegressor models estimate C1 utility
- fit before 2021, freeze, then evaluate 2021-2024
- threshold = predicted C1 > 0

## Fit counts
- RANGE_LONG: 8,183
- RANGE_SHORT: 8,183
- TREND_LONG: 2,974
- TREND_SHORT: 2,068

## Evaluation model quality
RANGE_LONG:
- n=9,810
- Pearson=-0.024
- sign accuracy=54.4%
- predicted-positive realized mean C1=-0.189

RANGE_SHORT:
- n=9,810
- Pearson=-0.033
- sign accuracy=54.9%
- predicted-positive realized mean C1=-0.269

TREND_LONG:
- n=3,302
- Pearson=-0.034
- sign accuracy=54.8%
- predicted-positive realized mean C1=-0.187

TREND_SHORT:
- n=2,979
- Pearson=+0.034
- sign accuracy=56.9%
- predicted-positive realized mean C1=-0.081

Aggregate:
- Pearson=-0.012
- positive-sign accuracy=54.9%

The learned utility estimates do not generalize as useful C1 forecasts.

## Sequential learned policy
- decision opportunities: 10,373
- completed trades: 1,721
- RANGE trades: 1,265
- TREND trades: 456
- long: 853
- short: 868

Overall:
- C0 +0.027 ATR/trade
- C1 -0.161
- C2 -0.349
- C1 win rate 43.7%
- C1 total -277.13 ATR
- C1 per decision opportunity -0.0267

RANGE branch:
- C1 -0.139

TREND branch:
- C1 -0.221

By year C1:
- 2021 -0.020
- 2022 -0.086
- 2023 -0.357
- 2024 partial -0.242

## Baseline
TREND_ALWAYS:
- C1 -0.229 ATR/trade

The learned policy is less negative than TREND_ALWAYS but still economically invalid.

## Registered screen
FAIL.

Passed:
- sample sizes
- RANGE/TREND and long/short counts
- learned policy better than TREND_ALWAYS

Failed:
- model correlation
- model sign accuracy threshold
- C1/C2 profitability
- win rate
- RANGE branch profitability
- TREND branch profitability
- year stability

## Decision
Reject Joint State + Strategy Utility v0.1 as a deployable policy.

Do not tune:
- model hyperparameters
- utility threshold
- feature set
- H4/H12 contracts

on this evaluation.

The result suggests that the current causal H1 state features do not contain enough stable information to forecast action-level C1 utility directly.

Historical Holdout remains closed.
