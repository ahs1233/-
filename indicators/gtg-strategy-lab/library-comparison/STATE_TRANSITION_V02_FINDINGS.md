# GTG State + Transition Engine v0.2 — Findings

Date: 2026-10-03  
Scope: H1 Train-only. Validation and Historical Holdout remained closed.

## What v0.2 changed
v0.2 preserved the v0.1 state thresholds and FSM logic, but corrected XAUUSD trading-time continuity:
- adjacent complete H1 bars with timestamp gaps <=3 hours remain in the same market episode,
- gaps >3 hours reset transient state memory,
- 1/4/12/24 horizons count complete trading H1 bars and reject paths crossing a >3h gap.

This was preregistered before v0.2 outcomes.

## Integrity
- 8/8 implementation tests PASS.
- Raw gate: 2018-03-01 <= data < 2024-03-20.
- State sequence frozen before outcomes.
- Feature prefix invariance PASS.
- Max TRANSITION age = 4 bars.
- Validation/Holdout not read.

## Structural state map — evaluation
- RANGE: 55.13%
  - median run 7 bars
  - mean run 11.28 bars
  - median efficiency24 0.118
  - median drift24 -0.021 ATR

- TRANSITION: 6.93%
  - median run 1 bar
  - mean run 1.51 bars

- TREND_UP: 20.55%
  - median run 9.5 bars
  - mean run 15.17 bars
  - median drift24 +3.93 ATR

- TREND_DOWN: 17.39%
  - median run 7 bars
  - mean run 13.81 bars
  - median drift24 -3.94 ATR

Compared with v0.1, correcting maintenance-gap handling reduced artificial resets and lengthened persistent state runs.

## State transition structure
Evaluation one-step persistence:
- RANGE -> RANGE: 92.21%
- TREND_UP -> TREND_UP: 94.76%
- TREND_DOWN -> TREND_DOWN: 93.83%

From TRANSITION:
- -> RANGE: 31.48%
- -> TRANSITION: 33.95%
- -> TREND_UP: 17.98%
- -> TREND_DOWN: 16.59%

This supports TRANSITION as a genuine handoff/uncertainty state rather than an immediate directional command.

## RANGE -> TRANSITION episodes
Evaluation primary events with source range age >=6:
- 456 events
- onset direction up: 237
- onset direction down: 219
- median source range age: 16 trading H1 bars
- mean source range age: 17.87 bars

FSM resolutions:
- RANGE: 174
- TREND_UP: 148
- TREND_DOWN: 132
- UNRESOLVED_GAP: 2

So roughly two fifths of range exits return to RANGE rather than becoming a confirmed trend.

## Trading-time horizon coverage
The continuity correction worked:
- evaluation mature 24-bar events: 337
- library mature 24-bar events: 254
- evaluation year counts: 2021=113, 2022=108, 2023=92, 2024=24
- max single-year share: 33.5%

All registered v0.2 structural sanity screens passed.

## Onset direction remains weak
The direction that first triggered TRANSITION was not robust in the later evaluation period:

- 1 bar: n=454, mean signed displacement -0.131 ATR, positive fraction 44.7%
- 4 bars: n=445, mean -0.150 ATR, positive fraction 46.3%
- 12 bars: n=379, mean -0.041 ATR, positive fraction 45.9%
- 24 bars: n=337, mean -0.092 ATR, positive fraction 48.4%

The library period was more favorable, including +0.436 ATR mean at 24 bars, but that behavior did not persist into the later evaluation.

Therefore:
- TRANSITION ONSET is useful as a warning that RANGE behavior may be ending,
- but the onset candidate direction should not be treated as the Swing direction.

## Decision
State Engine v0.2 passes structural sanity and is suitable as the base state map.

The next registered question is v0.3:
- use TRANSITION onset as SCALPER_STAND_DOWN,
- wait for the FSM to resolve,
- use TREND_UP/TREND_DOWN resolution as the candidate Swing handoff,
- evaluate post-resolution directional persistence,
- RANGE resolution means resume Range logic.

No state threshold is changed.
Validation/Holdout remain closed.
