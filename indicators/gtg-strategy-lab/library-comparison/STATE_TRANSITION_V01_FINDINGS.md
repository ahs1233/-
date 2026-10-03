# GTG State + Transition Engine v0.1 — Findings

Date: 2026-10-03  
Scope: H1 Train-only. Validation and Historical Holdout remained closed.

## Integrity
- Protocol fixed before historical outcome scoring.
- 6/6 synthetic safety tests passed before the official run.
- Raw gate: 2018-03-01 <= data < 2024-03-20.
- State sequence was frozen before outcome columns were attached.
- Feature prefix invariance passed.
- Transition age never exceeded 4 H1 bars.

## State map — evaluation 2021-01-01 to 2024-03-20
The explicit four-state machine produced:

- RANGE: 57.76% occupancy
  - median run: 6 bars
  - median efficiency24: 0.120
  - median drift24: -0.021 ATR

- TRANSITION: 9.21%
  - median run: 1 bar
  - mean run: 1.68 bars

- TREND_UP: 18.03%
  - median run: 8 bars
  - median efficiency24: 0.365
  - median drift24: +4.18 ATR

- TREND_DOWN: 15.01%
  - median run: 7 bars
  - median efficiency24: 0.371
  - median drift24: -4.27 ATR

The intended structural separation is visible:
- RANGE has much lower efficiency than either trend state.
- TREND_UP and TREND_DOWN have the expected drift signs and large normalized displacement.

## RANGE -> TRANSITION library
Primary evaluation events with source range age >=6:
- 428 events
- candidate up: 224
- candidate down: 204
- median source range age: 12 H1 bars
- mean source range age: 11.81 H1 bars

FSM resolution:
- back to RANGE: 162
- TREND_UP: 138
- TREND_DOWN: 121
- unresolved at a market gap: 7

This is already useful operationally:
- entering TRANSITION is not equivalent to a confirmed new trend,
- a substantial share of attempts return to RANGE,
- direction should therefore be decided at transition resolution, not automatically at transition onset.

## Initial transition-direction outcome
Using the direction that triggered TRANSITION at the first bar:

Evaluation:
- 1-bar mature n=423: mean signed displacement -0.137 ATR
- 4-bar mature n=377: mean signed displacement -0.283 ATR
- 12-bar mature n=107: mean +0.256 ATR, but median -0.072 ATR and positive fraction 48.6%

Therefore the first transition trigger does not provide a robust directional Swing signal.

This does not invalidate TRANSITION as a control state. It supports the two-stage interpretation:
1. Transition onset = stop/reduce Range/Scalper behavior.
2. Transition resolution = determine whether a new trend is confirmed or Range resumes.

## Measurement failure discovered
The registered 24h outcome required every adjacent H1 timestamp to be exactly one hour apart.

JForex XAUUSD contains regular short market-maintenance gaps:
- many 2-hour timestamp gaps,
- some 3-hour gaps,
- weekend gaps around 50 hours.

As a result:
- mature 24h transitions = 0,
- the 24h sample-size/year-balance sanity screens could not be evaluated.

The same exact-one-hour rule also reset FSM memory across normal daily maintenance, fragmenting state runs more than intended.

This is a protocol/design failure in v0.1, not a reason to rewrite v0.1 after seeing results.

## Decision
Preserve v0.1 unchanged as evidence.

v0.2 should:
- keep the structural state thresholds unchanged,
- treat short market-maintenance gaps <=3 hours as continuous market operation,
- reset state memory only for gaps >3 hours,
- measure future horizons in next complete trading H1 bars while rejecting paths that cross a >3h closure,
- evaluate outcome from TRANSITION RESOLUTION as the candidate Swing handoff point,
- keep TRANSITION ONSET as the point that tells the Range/Scalper engine to stand down,
- still store onset outcomes for comparison,
- keep Validation/Holdout closed.

No v0.1 threshold is tuned from these outcomes.
