# GTG Confirmed Handoff v0.3 — Findings

Date: 2026-10-03
Scope: Train-only confirmed handoff audit using frozen State + Transition Engine v0.2.
Validation and Historical Holdout remained closed.

## Integrity
- frozen v0.2 state SHA unchanged
- raw manifest matches v0.2
- inherited feature-prefix causality PASS
- max transition age <=4 PASS
- trading continuity <=3h unchanged
- 12/12 combined v0.2 + v0.3 unit tests PASS before official run
- all registered v0.3 sanity gates PASS

## Evaluation cohort
Primary RANGE -> TRANSITION episodes: 456

Resolution:
- RANGE resumed: 174 (38.2%)
- TREND_UP: 148
- TREND_DOWN: 132
- unresolved gap: 2
- confirmed trend total: 280 (61.4%)

Resolution delay:
- median 1 trading bar
- mean 1.47 bars

Confirmed-trend mature 24-bar outcomes:
- 213
- up: 115
- down: 98
- year concentration max: 33.8%

## What the transition onset tells us
Using every transition onset and its initial candidate direction is weak:
- 1 bar: mean signed displacement -0.131 ATR
- 4 bars: -0.150 ATR
- 12 bars: -0.041 ATR
- 24 bars: -0.092 ATR

So RANGE -> first breakout is not sufficient for Swing entry.

## Ex-post confirmed subset at the original onset
If we look only at episodes that the causal FSM later confirms as TREND, their original onset direction was much cleaner:

Evaluation:
- 1 bar: 60.0% direction accuracy, +0.314 ATR mean
- 4 bars: 56.8%, +0.477 ATR
- 12 bars: 54.3%, +0.555 ATR
- 24 bars: 57.7%, +0.636 ATR

This is not directly tradable at onset because the future resolution label was not yet known. But it proves the key research target:
the valuable information is distinguishing, during TRANSITION, which onset episodes will become a real trend versus return to RANGE.

## Entering only after full confirmation
Post-resolution evaluation from the causal confirmation bar:

- 1 bar:
  - n=278
  - direction accuracy 51.1%
  - mean signed displacement -0.005 ATR

- 4 bars:
  - n=268
  - direction accuracy 48.5%
  - mean signed displacement +0.102 ATR

- 12 bars:
  - n=231
  - direction accuracy 48.5%
  - mean signed displacement +0.193 ATR

- 24 bars:
  - n=213
  - direction accuracy 54.0%
  - mean signed displacement +0.221 ATR

Waiting for full confirmation removes many false breaks, but much of the early directional move has already occurred by the confirmation bar.

## Core conclusion
The architecture is now clearer:

RANGE
-> TRANSITION onset
-> stop Scalper immediately
-> classify the transition while it is unresolved
-> if likely RANGE resume: do not Swing; later return Scalper
-> if likely TREND_UP: prepare/allow Swing Long
-> if likely TREND_DOWN: prepare/allow Swing Short

The FSM should remain the market-state authority.
Kronos/historical memory/ML should not decide whether the market is RANGE or TREND.
Their best role is inside TRANSITION, where they estimate the three-way resolution:
- P(RANGE resumes)
- P(TREND_UP)
- P(TREND_DOWN)

This targets the 1-3 trading-bar window where the current deterministic confirmation logic is waiting.

## Decision
- Accept State + Transition Engine v0.2 as the structural market-state layer.
- Accept TRANSITION as a stand-down state for Range Scalper.
- Do not use first breakout direction as an automatic Swing entry.
- Do not treat confirmed TREND state alone as sufficient Swing edge.
- Next experiment: Transition Memory / three-way causal classifier trained only on pre-2021 episodes and evaluated frozen on 2021-2024.
- Validation/Holdout remain closed.
