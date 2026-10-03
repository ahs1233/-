# GTG Range Scalper v0.1 — Findings

Date: 2026-10-03
Scope: frozen State Engine RANGE mean-reversion baseline.
Validation/Historical Holdout remained closed.

## Rule
While frozen state = RANGE:
- long from lower quartile after bullish inward rejection
- short from upper quartile after bearish inward rejection
- freeze the prior-24h channel at signal
- enter next open
- target = frozen channel midpoint, confirmed by close then exited next open
- if RANGE state ends first, exit next open
- only one active trade

No stop, ML, threshold search, or intrabar target assumption.

## Sample
Library:
- RANGE bars: 5,921
- completed trades: 432
- long 191 / short 241

Evaluation:
- RANGE bars: 6,955
- completed trades: 548
- long 283 / short 265

## Overall economics

Library:
- C0 -0.012 ATR/trade
- C1 -0.226
- C2 -0.440
- C1 win 40.05%

Evaluation:
- C0 +0.006
- C1 -0.181
- C2 -0.368
- C1 win 40.33%

Both directions are similarly negative after friction.

Registered screen: FAIL.

## Key decomposition — evaluation

### Midpoint target reached before Range failure
TARGET:
- n=186
- C0 +1.935
- C1 +1.751
- C2 +1.566
- C1 win 100%
- mean MFE 2.307 ATR
- mean MAE 0.601 ATR

TARGET_AND_STATE_EXIT:
- n=17
- C1 +3.806
- C2 +3.615

### RANGE ended before midpoint target
STATE_EXIT:
- n=345
- C0 -1.231
- C1 -1.419
- C2 -1.607
- C1 win 5.22%
- mean MFE 0.662 ATR
- mean MAE 1.674 ATR

62.96% of evaluation trades were still open when the frozen RANGE state ended before target.

The old State handoff therefore reacts too late for Range-trade risk management.

## Historical stability
Evaluation C1:
- 2021 -0.142
- 2022 -0.259
- 2023 -0.294
- 2024 partial +0.415

Library years were also negative after C1.

## Interpretation
The mean-reversion idea has real structure:
- when the midpoint is reached, payoff is large and consistent,
- but failed ranges create losses larger than successful mean-reversion expectancy,
- waiting for the coarse State Engine to formally leave RANGE is too late.

This directly supports a distinct early Range-breakdown protection layer.

## Next experiment
Range Scalper v0.2 — Frozen Boundary Breakdown Exit:

Keep v0.1 entries and midpoint target unchanged.

Add an earlier causal invalidation:
- Long: if a complete bar closes below the frozen lower boundary, Range thesis is invalidated.
- Short: if a complete bar closes above the frozen upper boundary, invalidate.
- exit next open.
- State exit remains fallback.
- no ATR buffer and no fitted tolerance.

This uses the economic meaning of the frozen channel itself rather than tuning a stop distance from v0.1 outcomes.

## Decision
- Reject Range Scalper v0.1 as an executable baseline.
- Preserve the entry/target structure for v0.2.
- Do not tune quartiles or midpoint from this result.
- Improve only the Range-failure exit logic.
- Historical Holdout remains closed.
