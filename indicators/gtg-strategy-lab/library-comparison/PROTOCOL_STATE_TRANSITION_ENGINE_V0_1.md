# GTG State + Transition Engine v0.1 — preregistered causal finite-state map

Registered 2026-10-03 before running this engine on historical outcomes.

## Purpose
Implement the user-facing market logic directly:

1. determine the current market state,
2. use RANGE for future scalper research,
3. stop range logic when a transition begins,
4. determine whether the transition resolves into TREND_UP, TREND_DOWN, or returns to RANGE,
5. create a historical Transition Library for later similarity/ML work.

This is a market-state experiment, not a trading strategy. No entry/exit profitability rule is selected in v0.1.

## States
Exactly four online states:
- RANGE
- TRANSITION
- TREND_UP
- TREND_DOWN

TRANSITION is a control state: execution research should treat it as a handoff/uncertainty state, not as an automatic trade.

## Data boundary
Canonical local JForex BID/ASK M1 store.
Use complete H1 bars only.

Raw gate:
- 2018-03-01 <= raw timestamp < 2024-03-20T00:00:00Z

Validation and Historical Holdout remain closed.

Descriptive split:
- library/discovery: 2018-03-01 <= bar < 2021-01-01
- frozen-rule evaluation: 2021-01-01 <= bar < 2024-03-20

The state rules below are fixed before outcomes are scored. No threshold may be changed after evaluation outcomes are read without a new protocol version.

## Causal measurements
All use t-or-earlier data only.

H1 ATR:
- 14-bar simple true-range mean, identical to existing library-comparison infrastructure.

Directional Change thresholds:
- 0.0025
- 0.005
- 0.010
- 0.020
Use existing confirmation-time semantics. No backdating.

At each bar compute:
- dc_up_count: number of the four confirmed DC directions equal +1
- dc_down_count: number equal -1
- drift12 = (BidClose[t] - BidClose[t-12]) / ATR[t]
- drift24 = (BidClose[t] - BidClose[t-24]) / ATR[t]
- drift48 = (BidClose[t] - BidClose[t-48]) / ATR[t]
- efficiency24 = abs(C[t]-C[t-24]) / sum(abs(diff(C[t-24:t])))
- efficiency48 similarly
- spread_atr = (AskClose[t]-BidClose[t]) / ATR[t]
- atr_week_ratio = ATR[t] / median(ATR[t-167:t])
- prior24_upper = maximum BidHigh over t-24..t-1
- prior24_lower = minimum BidLow over t-24..t-1
- prior24_width_atr = (upper-lower)/ATR[t]
- position24 = (C[t]-lower)/(upper-lower), clipped only for reporting, not for breakout detection
- breakout_up_atr = (C[t]-prior24_upper)/ATR[t]
- breakout_down_atr = (prior24_lower-C[t])/ATR[t]

## Fixed structural cores
These are starting structural hypotheses, not optimized thresholds.

RANGE core:
- efficiency24 <= 0.35
- efficiency48 <= 0.35
- abs(drift24) <= 1.50 ATR
- abs(drift48) <= 3.00 ATR
At least 3 of these 4 conditions must hold.

TREND_UP core:
- dc_up_count >= 3
- drift24 >= +1.00 ATR
- efficiency24 >= 0.35

TREND_DOWN core:
- dc_down_count >= 3
- drift24 <= -1.00 ATR
- efficiency24 >= 0.35

Breakout trigger:
- up if close exceeds prior24_upper by >= 0.10 ATR
- down if close falls below prior24_lower by >= 0.10 ATR

If both breakout triggers somehow hold, fail closed.

## Finite-state machine

### Initialization
At the first valid row:
- RANGE if range core
- else TREND_UP if trend-up core
- else TREND_DOWN if trend-down core
- else TRANSITION with direction 0

### From RANGE
Remain RANGE unless one of:
- breakout up -> TRANSITION direction +1
- breakout down -> TRANSITION direction -1
- trend-up core -> TRANSITION direction +1
- trend-down core -> TRANSITION direction -1

On entry from RANGE, freeze:
- transition source = RANGE
- prior24_upper/lower
- range age at transition
- all causal measurements at transition start

### From TRANSITION sourced from RANGE
Maximum transition age = 4 H1 bars.

Resolve TREND_UP when:
- transition direction = +1
- current and previous transition closes are above the frozen upper boundary
- dc_up_count >= 3
- drift24 > 0

Resolve TREND_DOWN symmetrically below the frozen lower boundary.

Resolve back to RANGE when:
- current and previous transition closes are both inside the frozen range boundaries.

If still unresolved at age 4:
- resolve to TREND_UP if trend-up core holds
- else TREND_DOWN if trend-down core holds
- else RANGE.

### From TREND_UP
Stay TREND_UP unless:
- trend-down core appears -> TRANSITION direction -1, source TREND_REVERSAL
- range core holds for 3 consecutive bars -> RANGE

TREND_DOWN is symmetric.

### TRANSITION sourced from TREND_REVERSAL
Maximum age = 4 bars.
- resolve to the indicated opposite trend if its trend core holds for 2 consecutive bars
- resolve to RANGE if range core holds for 2 consecutive bars
- at age 4: choose current trend core if one exists, otherwise RANGE

Trend-reversal transitions are tracked separately. The primary Transition Library in v0.1 uses only transitions sourced from RANGE.

## Range age
Consecutive H1 bars spent in RANGE immediately before entering TRANSITION.
Minimum range age for the primary Transition Library:
- 6 H1 bars

Shorter source ranges remain in the state sequence but are excluded from primary range-exit statistics.

## Transition Library record
For every RANGE -> TRANSITION event with range_age >= 6 persist:
- transition timestamp
- candidate direction {-1,+1}
- trigger type {BREAKOUT, TREND_CORE}
- frozen upper/lower boundaries
- range age
- prior24_width_atr
- position24
- all DC directions/counts
- drift12/24/48
- efficiency24/48
- spread_atr
- atr_week_ratio
- UTC session
- state-machine resolution
- resolution delay in H1 bars

## Future outcomes for research labels
Outcomes are never used by the online state machine.

For horizons 1, 4, 12, 24 H1 bars, if the path is contiguous and mature before the raw gate:
- displacement_atr = (BidClose[t+h]-BidClose[t])/ATR[t]
- signed_displacement_atr = candidate_direction * displacement_atr
- MFE_atr in candidate direction using Bid highs/lows
- MAE_atr against candidate direction
- close_beyond_frozen_boundary flag
- returned_inside_frozen_range_by_h flag

Also record:
- direction_12h = sign(displacement_12h), when mature
- direction_24h = sign(displacement_24h), when mature

No categorical "success" threshold is optimized in v0.1.

## Descriptive evaluation
Report separately for 2018-2020 library and 2021-2024 evaluation:
- state occupancy
- median/mean run length
- one-step transition matrix
- number of RANGE -> TRANSITION events
- candidate direction balance
- source range-age distribution
- state-machine resolution: TREND_UP / TREND_DOWN / RANGE
- resolution delay
- future signed displacement distributions at 1/4/12/24h
- fraction still beyond frozen boundary at each horizon
- fraction returned inside range by each horizon

Basic sanity screens, descriptive only:
1. RANGE median efficiency24 < both trend-state medians.
2. TREND_UP median drift24 > 0 and TREND_DOWN median drift24 < 0.
3. RANGE -> TRANSITION events exist in both library and evaluation periods.
4. At least 100 mature evaluation transitions with range_age >= 6.
5. Evaluation candidate directions include both up and down.
6. No single calendar year contributes >60% of evaluation transitions.

These screens do not authorize trading.

## Integrity checks
- raw gate PASS
- complete H1 aggregation
- all measurements causal
- DC prefix invariance
- feature prefix invariance
- no outcome columns used by state assignment
- frozen range boundaries do not change during transition
- transition max age <=4
- outcome path contiguous
- outcomes mature before 2024-03-20
- library/evaluation split exact
- Validation read = false
- Holdout read = false

## Next phase
Only if v0.1 produces coherent state episodes:
- freeze the state engine,
- build a dedicated historical similarity library for RANGE -> TRANSITION episodes,
- test prediction of transition resolution/direction on a disjoint Train evaluation,
- then integrate Kronos only as one input inside TRANSITION, not as the market-state authority.

No Holdout opens automatically.
