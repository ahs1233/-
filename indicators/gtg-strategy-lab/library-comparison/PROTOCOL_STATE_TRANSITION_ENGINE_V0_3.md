# GTG State + Transition Engine v0.3 — confirmed handoff protocol

Registered 2026-10-03 before any v0.3 post-resolution outcomes are computed.

Clarification note: this file was initially preregistered before v0.2 completed. This rewrite fixes encoding and clarifies lineage only; the registered v0.3 outcome logic and sanity gates are unchanged.

## Relationship to prior versions
- v0.1: introduced the explicit four-state causal FSM, but used overly strict exact-1h continuity.
- v0.2: fixed trading-time continuity to allow adjacent complete H1 bars separated by <=3 wall-clock hours. State thresholds and FSM logic stayed unchanged.
- v0.3: uses the frozen v0.2 state/transition sequence and changes the **primary evaluation anchor only**:
  - TRANSITION onset = stop Range/Scalper behavior and wait.
  - TRANSITION resolution to TREND_UP/TREND_DOWN = candidate Swing handoff.
  - resolution back to RANGE = Range resumed / fake-break family.

v0.3 does not refit or alter the State Engine.

## Frozen source
Primary state source:
- run: runs/state-transition-v02-001
- state rules: unchanged from v0.1/v0.2
- market continuity: unchanged from v0.2
- Validation/Historical Holdout: closed

Before scoring v0.3:
- verify v0.2 state-sequence hash is unchanged,
- verify the canonical raw-file manifest matches the v0.2 manifest,
- verify v0.2 integrity flags are PASS,
- verify v0.2 max TRANSITION age <=4.

## Data boundary
Canonical local JForex BID/ASK M1 -> complete H1 bars.

2018-03-01 <= raw timestamp < 2024-03-20T00:00:00Z.

Descriptive split:
- library: before 2021-01-01
- evaluation: 2021-01-01 through raw gate

Validation and Historical Holdout remain closed.

## Frozen state contract
Exactly:
- RANGE
- TRANSITION
- TREND_UP
- TREND_DOWN

Operational interpretation:
- RANGE -> future Scalper engine may operate.
- TRANSITION -> SCALPER_STAND_DOWN; no directional Swing entry.
- TREND_UP resolution -> SWING_LONG_CANDIDATE.
- TREND_DOWN resolution -> SWING_SHORT_CANDIDATE.
- RANGE resolution -> RANGE_RESUMED.

All structural features, DC thresholds, cores, breakout threshold, source-range age >=6 criterion, transition maximum age, and confirmation logic are inherited unchanged from v0.2.

## Trading-time continuity
Unchanged from v0.2:
- adjacent complete H1 bars are operationally continuous when timestamp gap is >0 and <=3h,
- gap >3h is a hard episode boundary,
- future horizons count subsequent complete H1 trading bars,
- future outcome paths reject any gap >3h.

## Primary episodes
Use only v0.2 RANGE -> TRANSITION events with:
- primary = true,
- source range age >=6 trading H1 bars.

No new event selection is introduced.

## Handoff classification
For every primary episode use the frozen v0.2 FSM resolution:

### TREND_UP
- resolution direction = +1
- action label = SWING_LONG_CANDIDATE
- primary outcome anchor = resolution_time

### TREND_DOWN
- resolution direction = -1
- action label = SWING_SHORT_CANDIDATE
- primary outcome anchor = resolution_time

### RANGE
- action label = RANGE_RESUMED
- no directional Swing outcome

### UNRESOLVED_GAP / UNRESOLVED_DATA_END
- action label = NO_DECISION
- no directional Swing outcome

No post-resolution information may affect the resolution label.

## Post-resolution outcomes
For TREND_UP / TREND_DOWN resolutions, use ATR at the resolution bar.

For horizons:
- 1 complete H1 trading bar
- 4 bars
- 12 bars
- 24 bars

Require:
- endpoint exists and remains before 2024-03-20,
- every adjacent timestamp gap from resolution through endpoint is >0 and <=3h.

Record:
- displacement_atr = (BidClose[t+h]-BidClose[t])/ATR[t]
- signed_displacement_atr = resolved_direction * displacement_atr
- directional_correct = signed_displacement_atr > 0
- MFE_atr in resolved direction
- MAE_atr against resolved direction
- final close beyond the original frozen RANGE boundary
- whether price returned inside the original frozen RANGE at any point
- elapsed wall-clock hours

## Onset comparator
Retain the already-frozen v0.2 onset outcomes as descriptive comparators.

Report:
1. all primary onset episodes,
2. onset outcomes restricted to episodes that later resolve TREND_UP/TREND_DOWN,
3. confirmed-resolution outcomes for the same trend-resolved episodes.

The purpose is to measure the value of waiting for confirmation. No threshold is selected from this comparison.

## Reports
Separately for library and evaluation:

### FSM handoff
- primary RANGE->TRANSITION episode count
- resolution counts
- RANGE-resumed fraction
- confirmed-trend fraction
- resolution-delay distribution
- confirmed up/down counts

### Post-resolution persistence
For each horizon:
- n
- direction accuracy
- signed displacement mean/median
- signed positive fraction
- mean MFE/MAE
- final-close-beyond-range fraction
- returned-inside-range fraction
- mean elapsed wall-clock hours

### Stability
For evaluation confirmed-trend 24-bar outcomes:
- calendar-year counts
- no state/model profitability optimization
- up/down balance

## Registered v0.3 sanity gates
All are structural/informational, not profit gates.

1. inherited v0.2 state feature prefix invariance = PASS.
2. inherited max TRANSITION age <=4 bars.
3. evaluation has >=100 primary RANGE->TRANSITION episodes.
4. evaluation has >=100 confirmed TREND resolutions with mature 24-bar outcomes.
5. mature confirmed resolutions include both TREND_UP and TREND_DOWN.
6. no single evaluation calendar year contributes >60% of mature confirmed-trend 24-bar outcomes.
7. inherited RANGE median efficiency24 < both trend-state medians.
8. inherited TREND_UP median drift24 >0 and TREND_DOWN median drift24 <0.
9. resolved-trend 4-bar direction accuracy is reported with no required pass threshold.

No threshold may be modified from the result of these gates.

## Integrity
- protocol committed before post-resolution outcomes
- v0.2 state sequence/hash unchanged
- canonical raw manifest matches v0.2
- no Validation/Holdout read
- no state assignment or transition resolution uses future outcome data
- frozen RANGE boundaries remain unchanged
- future path uses only post-resolution bars
- market continuity <=3h unchanged
- no execution-cost or profitability filter selected in v0.3

## Next phase
If confirmed resolution is materially more stable than onset:
- freeze State Engine v0.2 as the market-state authority,
- construct Transition Memory from onset features,
- predict the three-way resolution:
  P(RANGE resumes),
  P(TREND_UP),
  P(TREND_DOWN),
- use historical episode similarity + ML/Kronos as experts inside TRANSITION,
- do not let Kronos decide the market state.

If confirmed resolution is unstable, revise the structural state/confirmation representation in a new preregistered version.

No Holdout opens automatically.
