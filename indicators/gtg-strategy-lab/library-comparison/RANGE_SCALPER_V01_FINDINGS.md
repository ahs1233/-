# GTG Range Scalper v0.1 — Findings

Date: 2026-10-03
Scope: Train-development diagnostic using frozen State Engine v0.2.
Validation and Historical Holdout remained closed.

## Rule
While frozen state = RANGE:
- long candidate in lower channel quartile with inward bullish rejection,
- short candidate in upper channel quartile with inward bearish rejection,
- enter next H1 open,
- frozen source-range midpoint is the mean-reversion target,
- if state leaves RANGE before target, exit causally at the next open,
- one active trade only,
- no stop/target fill assumption, leverage, sizing, overlap, or threshold fitting.

## Integrity
PASS:
- frozen state file SHA unchanged
- frozen state content SHA unchanged
- canonical raw manifest unchanged
- RANGE-only signals
- t-or-earlier frozen channel
- next-open entry
- one active trade
- causal target/state exit
- no hard-gap bridging
- split boundary not crossed
- Validation read=false
- Historical Holdout read=false
- unit tests: 6/6 PASS

## Library 2018-2020
- RANGE bars: 5,921
- flat edge signals: 503
- completed trades: 432
- long: 191
- short: 241
- directional accuracy: 43.52%
- C0: -0.012 ATR/trade
- C1: -0.226
- C2: -0.440
- C1 win rate: 40.05%
- median duration: 5 H1 bars
- mean duration: 6.76 bars
- target reached before/with state exit: 35.19%
- state left RANGE before target: 64.81%

## Evaluation 2021-2024
- RANGE bars: 6,955
- flat edge signals: 590
- completed trades: 548
- long: 283
- short: 265
- directional accuracy: 42.34%
- C0: +0.006 ATR/trade
- C1: -0.181
- C2: -0.368
- C1 win rate: 40.33%
- median duration: 5 H1 bars
- mean duration: 6.43 bars
- target reached before/with state exit: 37.04%
- state left RANGE before target: 62.96%

Both long and short are negative after C1:
- long C1 -0.166
- short C1 -0.197

## Evaluation year stability
C1/trade:
- 2021: -0.142
- 2022: -0.259
- 2023: -0.294
- 2024 partial: +0.415

The three full evaluation years are negative. The 2024 partial result is not enough to rescue the rule.

## Exit-path diagnostic — descriptive only
Evaluation:

TARGET only:
- n=186
- C1 +1.751
- C2 +1.566

STATE_EXIT before target:
- n=345
- C1 -1.419
- C2 -1.607

TARGET_AND_STATE_EXIT:
- n=17
- C1 +3.806
- C2 +3.615

Library shows the same qualitative split:
- TARGET C1 +1.648
- STATE_EXIT C1 -1.286
- TARGET_AND_STATE_EXIT C1 +2.500

This grouping uses the future exit outcome and therefore is NOT an executable filter.
It does, however, identify the failure mechanism: most edge-zone entries are made too close to a future RANGE termination.

## Registered stability screen
FAIL.

Passed:
- sample sizes
- long/short counts
- no year concentration

Failed:
- library/evaluation C1 >0
- library/evaluation C2 >=0
- library/evaluation C1 win >50%
- two full evaluation years positive

## Interpretation
The frozen RANGE state is useful as routing context, but a simple edge-quartile rejection is not enough to trade every range.

The main research problem is now exactly the user's original transition question:

> while the market is still classified as RANGE, can we detect that the range is close to ending soon enough to stop the scalper before the losing state-exit path?

Do not tune:
- 0.25/0.75 quartiles
- midpoint
- direction
- holding duration
- target/state-exit subgroups

on this same sample.

## Next experiment
Pre-Transition Guard v0.1:
- enumerate all causal edge-zone signals,
- label whether the frozen RANGE ends before the frozen midpoint is reached,
- fit only on library 2018-2020,
- freeze the model,
- evaluate classification and guarded Range-Scalper execution on 2021-2024,
- use the same entry/exit/cost contract,
- threshold fixed before evaluation,
- Historical Holdout remains closed.
