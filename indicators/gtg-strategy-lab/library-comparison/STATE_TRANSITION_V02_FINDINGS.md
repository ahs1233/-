# GTG State + Transition Engine v0.2 — Findings

Date: 2026-10-03
Scope: H1 XAUUSD Train-only state/transition research.
Validation and Historical Holdout remained closed.

## Why v0.2
v0.1 exposed a clock-definition defect: every H1 gap above one hour reset state, so normal XAUUSD maintenance closures broke episodes and produced zero mature 24-bar outcomes.

v0.2 was preregistered before rerun. It preserved all market-state thresholds/rules and changed only trading-time continuity:
- adjacent complete H1 bars remain in the same episode when gap <=3 wall-clock hours,
- gap >3h resets transient state,
- 1/4/12/24 horizons mean subsequent complete H1 trading bars,
- weekend/large holiday gaps are not crossed.

## Integrity
- v0.2 unit tests: 8/8 PASS.
- raw date gate: PASS.
- complete H1 aggregation: PASS.
- feature prefix invariance: PASS.
- state sequence frozen before outcomes: PASS.
- trading-path gap <=3h rule: PASS.
- Validation read: false.
- Holdout read: false.
- complete H1 bars: 34,816.
- incomplete H1 bars dropped: 964.

## State map — evaluation 2021-01-01 to 2024-03-20
Occupancy:
- RANGE: 55.13%
- TRANSITION: 6.93%
- TREND_UP: 20.55%
- TREND_DOWN: 17.39%

Median state characteristics:
- RANGE: efficiency24 0.118, drift24 -0.021 ATR
- TRANSITION: efficiency24 0.281, drift24 +0.325 ATR
- TREND_UP: efficiency24 0.344, drift24 +3.933 ATR
- TREND_DOWN: efficiency24 0.341, drift24 -3.942 ATR

Median/mean run length:
- RANGE: 7 / 11.28 trading bars
- TRANSITION: 1 / 1.51 trading bars
- TREND_UP: 9.5 / 15.17 trading bars
- TREND_DOWN: 7 / 13.81 trading bars

This is structurally coherent with the intended finite-state design:
RANGE is low-efficiency/near-zero drift, trends are high directional drift, and TRANSITION is short-lived.

## Primary RANGE -> TRANSITION library
Library/discovery 2018-2020:
- primary events: 374
- mature 24-trading-bar events: 254
- up candidates: 193
- down candidates: 181

Evaluation 2021-2024:
- primary events: 456
- mature 24-trading-bar events: 337
- up candidates: 237
- down candidates: 219
- median source RANGE age: 16 trading bars
- mean source RANGE age: 17.87 trading bars

Evaluation transition resolutions:
- RANGE: 174 (38.2%)
- TREND_UP: 148 (32.5%)
- TREND_DOWN: 132 (28.9%)
- UNRESOLVED_GAP: 2 (0.4%)

So about 61.4% of primary transitions resolved into a trend state and about 38.2% returned to RANGE.

Resolution is fast:
- median delay: 1 trading bar
- mean delay: 1.47 bars
- max observed delay: 3 bars
- registered maximum: 4 bars

## Critical interpretation
The first breakout direction is NOT itself a robust forecast.

Evaluation candidate-direction signed displacement:
- 1 bar: -0.131 ATR mean
- 4 bars: -0.150 ATR mean
- 12 bars: -0.041 ATR mean
- 24 bars: -0.092 ATR mean

At 24 trading bars only 48.4% of mature cases finished positive in the original candidate direction.

Therefore the system should not switch directly from:
RANGE -> BREAKOUT -> SWING.

It needs:
RANGE -> TRANSITION -> CONFIRM/REJECT -> SWING or RANGE.

## Confirmed trend vs false-break structure
Among evaluation primary transitions:
- BREAKOUT trigger: 381
- TREND_CORE trigger: 75

For events that resolved into TREND_UP/TREND_DOWN, the resolution direction matched the transition candidate direction; no opposite-trend resolution was observed in the evaluated primary set.

24-bar outcome measured from the original transition start, grouped by eventual FSM resolution:

### Resolved RANGE — false/rejected transition
- mature n: 124
- candidate-signed displacement: -1.341 ATR mean
- positive in original candidate direction: 32.3%
- returned inside frozen source range: 96.8%

These are genuine false-break/rejection episodes.

### Resolved TREND_UP
- mature n: 115
- candidate-signed displacement: +0.897 ATR mean
- positive in candidate direction: 60.0%
- returned inside source range at some point: 59.1%

### Resolved TREND_DOWN
- mature n: 98
- candidate-signed displacement: +0.329 ATR mean
- positive in candidate direction: 55.1%
- returned inside source range at some point: 64.3%

This separation is the most useful result of the phase: the TRANSITION state is functioning as a handoff layer that separates many failed range exits from confirmed directional states.

## Timing correction worked
Mature 24-trading-bar events:
- library: 254
- evaluation: 337

Mean elapsed wall-clock time for a 24-trading-bar outcome:
- library: 25.49 hours
- evaluation: 25.22 hours

Thus ordinary daily maintenance closures are represented while weekend/large gaps remain excluded.

## Evaluation-year coverage
Mature 24-bar primary transitions:
- 2021: 113
- 2022: 108
- 2023: 92
- 2024 partial: 24
Largest year share: 33.5%.

No single year dominates.

## Sanity screens
All 7/7 summary sanity screens PASS:
- RANGE efficiency lower than both trends
- trend drift signs correct
- transitions in both splits
- >=100 mature evaluation transitions
- both directions represented
- no year >60%
- >=100 mature library transitions

## Decision
State + Transition Engine v0.2 is accepted as a structurally coherent first market-state layer.

It is NOT yet an executable trading strategy.

The next causal question is now sharply defined:
At the bar where TRANSITION resolves to TREND_UP or TREND_DOWN, does a Swing handoff entered only after that confirmation have positive forward expectancy after realistic execution costs?

That must be tested from the resolution bar, not from the original breakout bar, and must be preregistered before reading those post-resolution outcomes.
