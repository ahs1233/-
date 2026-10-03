# GTG Trend Lifecycle Swing v0.1 — Findings

Date: 2026-10-03
Scope: Train-development diagnostic.
Validation/Historical Holdout remained closed.

## Rule
- enter after causal TREND_UP/TREND_DOWN confirmation
- remain in the Swing while the same frozen Trend state persists
- exit at the first open after the Trend state ends
- no fixed 4/12/24 holding period

## Cohort
- confirmed evaluation episodes: 280
- active lifecycle trades: 224
- hard-gap censored: 56
- median duration: 7 H1 trading bars
- mean duration: 12.78 bars

## Overall economics
- direction accuracy: 36.16%
- C0: -0.484 ATR/trade
- C1: -0.669
- C2: -0.853
- C1 win rate: 31.70%
- mean MFE: 1.985 ATR
- mean MAE: 2.020 ATR

Registered screen: FAIL.

## Direction
UP:
- n=115
- C1 -0.659
- C2 -0.844

DOWN:
- n=109
- C1 -0.679
- C2 -0.864

Both directions fail.

## Year stability
C1/trade:
- 2021: -0.635
- 2022: -0.451
- 2023: -0.892
- 2024 partial: -1.117

No year rescue.

## Exit behavior
The first state change was overwhelmingly TREND -> RANGE:
- RANGE: 219
- TRANSITION: 5

This means the frozen State Engine keeps the TREND label much longer than is useful for trade management.

## Conclusion
State Engine v0.2 remains useful for routing market mode, but the Trend-state lifetime is not a viable Swing holding rule.

The Swing Engine requires its own microstructure:
- confirmed Trend allows Swing mode,
- then wait for a causal correction,
- enter only after directional resumption,
- trade management cannot simply wait for the coarse Trend state to disappear.

Next experiment:
Directional-Change Correction -> Resumption entry.

No duration, direction, or retest subgroup from this result may be tuned into the next rule.
Historical Holdout remains closed.
