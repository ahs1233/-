# GTG State + Transition Engine v0.2 — trading-time continuity correction

Registered 2026-10-03 after v0.1 exposed a timing-definition defect and before any v0.2 outcomes are computed.

## Why v0.2 exists
v0.1 treated every H1 timestamp gap >1 hour as a hard reset and required wall-clock-contiguous H1 paths for outcomes.

On canonical XAUUSD data this is inappropriate because normal market-maintenance closures create many 2-hour gaps:
- 1h gaps: 33,013
- 2h gaps: 1,080
- 3h gaps: 235
- >24h gaps: 320, mostly weekends/holidays

As a result, v0.1 reset the finite-state machine around normal daily closures and produced zero mature 24-bar outcomes. v0.1 is preserved as failed timing evidence.

v0.2 changes **only trading-time continuity semantics**. Market-state thresholds, cores, transition rules, range-age requirement, DC thresholds, and outcome definitions remain unchanged.

## State contract
Same four online states as v0.1:
- RANGE
- TRANSITION
- TREND_UP
- TREND_DOWN

Same causal measurements and same fixed thresholds from PROTOCOL_STATE_TRANSITION_ENGINE_V0_1.md.

## Trading-time continuity
Let STEP = 1 hour.

Two successive complete H1 bars are considered part of the same trading episode when:
- timestamp difference > 0
- timestamp difference <= 3 hours

Rationale:
- includes the observed normal/extended daily maintenance gaps,
- does not bridge weekends/large holidays,
- avoids treating market closure as evidence that market structure disappeared.

A gap >3 hours:
- resets transient FSM memory,
- closes an open transition as UNRESOLVED_GAP,
- resets RANGE age and confirmation streaks,
- splits state run-length statistics.

No parameter below is selected from outcome performance.

## Trading-bar horizons
h in {1,4,12,24} means the next h **observed complete H1 trading bars**, not h wall-clock hours.

For an outcome at start index i to mature:
- i+h exists,
- every adjacent gap from i through i+h is >0 and <=3 hours,
- endpoint timestamp remains < 2024-03-20T00:00:00Z,
- ATR at i is finite and positive.

Thus:
- ordinary daily maintenance closures may occur inside the path,
- weekend/large holiday gaps may not occur inside the path.

Record endpoint elapsed wall-clock hours for every mature horizon so trading-bar time and calendar time remain distinguishable.

## Data boundary
Unchanged:
- canonical local JForex BID/ASK M1
- complete H1 bars only
- raw gate 2018-03-01 <= timestamp < 2024-03-20T00:00:00Z
- library/discovery before 2021-01-01
- evaluation 2021-01-01 through raw end
- Validation and Historical Holdout remain closed

## State rules
Unchanged from v0.1.

RANGE core:
- efficiency24 <= 0.35
- efficiency48 <= 0.35
- abs(drift24) <= 1.50 ATR
- abs(drift48) <= 3.00 ATR
- at least 3/4 conditions

TREND_UP:
- dc_up_count >=3
- drift24 >= +1.00 ATR
- efficiency24 >=0.35

TREND_DOWN:
- dc_down_count >=3
- drift24 <= -1.00 ATR
- efficiency24 >=0.35

Breakout:
- close beyond prior 24-trading-bar boundary by >=0.10 ATR.

TRANSITION:
- same source, direction, frozen range-boundary and 4-trading-bar maximum-age rules as v0.1.

Primary RANGE -> TRANSITION library:
- source RANGE
- range_age >=6 trading bars

## Outputs
Persist:
- state_sequence.csv.gz
- transition_library.jsonl
- state_freeze.json
- input_manifest.json
- summary.json

Report library and evaluation separately:
- occupancy
- run lengths
- transition matrix
- primary transition count
- up/down balance
- resolution counts/delay
- source range age
- 1/4/12/24 trading-bar signed displacement
- MFE/MAE
- close beyond frozen boundary
- returned inside frozen range
- wall-clock elapsed hours
- transition counts by calendar year

## Sanity screens
Same conceptual screens, corrected for trading-time:
1. RANGE median efficiency24 below both trend-state medians.
2. TREND_UP median drift24 >0 and TREND_DOWN median drift24 <0.
3. primary transitions exist in both splits.
4. at least 100 mature evaluation transitions at 24 trading bars.
5. mature evaluation transitions contain both candidate directions.
6. no single calendar year contributes >60% of mature evaluation transitions.
7. at least 100 mature library transitions at 24 trading bars.

These are structural sanity checks, not profitability gates.

## Integrity tests
Before accepting:
- short closure gap (<=3h) preserves FSM episode continuity
- long gap (>3h) resets FSM
- 24-trading-bar outcomes may bridge <=3h closure gaps
- outcomes reject >3h gaps
- feature prefix invariance
- fake-break return path
- breakout-to-trend path
- transition forced resolution <=4 trading bars
- raw date gate
- state sequence frozen before outcome attachment
- Validation read=false
- Holdout read=false

## Scientific status
v0.2 does not reinterpret v0.1 outcome values as evidence.
v0.1 remains a failed timing implementation.
v0.2 is a new frozen run with the same market-state hypothesis and corrected clock semantics.

No threshold tuning is allowed from v0.2 outcomes. Any later predictive model for transition direction must use a separately preregistered train/evaluation design.
