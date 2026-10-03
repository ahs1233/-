# GTG Swing Retest Entry v0.1 — causal post-confirmation timing layer

Registered 2026-10-03 before any Retest-conditioned execution outcomes are computed.

## Purpose
Test the next layer of the State -> Transition -> Swing architecture:

RANGE
-> TRANSITION: Scalper OFF
-> confirmed TREND_UP / TREND_DOWN: Swing mode permitted
-> wait for a causal pullback/retest of the broken source-range boundary
-> enter only after rejection back in the trend direction

The goal is entry timing, not state classification.

## Evidence status
Development diagnostic only.

The retest concept was specified before this run as part of the intended Swing architecture, but exact v0.1 numeric tolerances below are registered after prior state/handoff research existed.
Therefore this run is not independent validation and does not authorize Historical Holdout access.

## Frozen structural source
Use frozen Confirmed Handoff v0.3 events sourced from State Engine v0.2.

Eligible events:
- primary RANGE -> TRANSITION episode
- split reported separately: library (<2021) and evaluation (2021-2024)
- frozen resolution = TREND_UP or TREND_DOWN
- frozen resolution_time and original range boundaries unchanged

No Logistic/Kronos/DTW signal is used in v0.1.

## Price / time contract
Canonical JForex BID/ASK complete H1 bars.
Raw gate:
- timestamp < 2024-03-20T00:00:00Z

Operational continuity:
- adjacent complete H1 bars may differ by >0 and <=3 wall-clock hours
- gap >3h ends the search/outcome path

ATR:
- ATR at the confirmed resolution bar r is ATR_ref
- ATR_ref remains frozen for retest-zone geometry
- trade return normalization uses ATR at the rejection signal bar s

## Broken boundary
For TREND_UP:
- boundary = original frozen_upper

For TREND_DOWN:
- boundary = original frozen_lower

## Retest search window
After the resolution bar r:
- inspect bars r+1 through r+6 inclusive
- only complete causal bars
- stop at first hard market gap >3h
- first qualifying rejection wins
- no later candidate may replace it

## Fixed retest zone
Tolerance:
- 0.50 * ATR_ref

TREND_UP bar j reaches the retest zone if:
- Low[j] <= frozen_upper + 0.50*ATR_ref

TREND_DOWN:
- High[j] >= frozen_lower - 0.50*ATR_ref

The bar may wick slightly through the source boundary.

## Rejection confirmation
TREND_UP rejection signal at close j requires ALL:
1. retest-zone condition above
2. Close[j] > frozen_upper
3. Close[j] > Open[j]

TREND_DOWN:
1. retest-zone condition above
2. Close[j] < frozen_lower
3. Close[j] < Open[j]

No intrabar assumption beyond observed OHLC.

## Pre-entry invalidation
Before a qualifying rejection occurs, cancel the setup if:

TREND_UP:
- Close[j] < frozen_upper - 0.50*ATR_ref

TREND_DOWN:
- Close[j] > frozen_lower + 0.50*ATR_ref

Cancellation is permanent for that confirmed episode in v0.1.

## Entry
For a qualifying rejection bar s:
- enter at open(s+1)
- direction = frozen resolved_direction
- require operational continuity from s to s+1
- no entry on the rejection bar itself

## Exit horizons
From rejection signal bar s:
- h=4, 12, 24 complete H1 trading bars
- exit at close(s+h)
- every adjacent path gap must be >0 and <=3h
- endpoint before raw gate

No stop, target, trailing logic, leverage, sizing, compounding or re-entry.

## Execution costs
Reuse compare.costs exactly:
- C0
- C1 benchmark
- C2 doubled friction

## No-entry reasons
Persist exactly one:
- RETEST_ENTRY
- INVALIDATED_BEFORE_RETEST
- NO_RETEST_WITHIN_6
- HARD_GAP
- DATA_END

Coverage is an output, not optimized.

## Comparators
Primary comparator:
- IMMEDIATE_CONFIRMED from Confirmed Handoff Execution v0.1

Do not treat different entry timestamps as identical trades.
Compare coverage and mean economics, not paired profit equality.

## Outputs
Separately for library and evaluation:
- confirmed trend episodes
- retest entries
- coverage
- no-entry reason counts
- median retest delay
- up/down counts

For each h in {4,12,24}:
- eligible entered trades
- directional accuracy
- C0/C1/C2 mean/trade
- C1 win rate
- signed displacement/ATR
- MFE/MAE
- returned-inside-source-range fraction

Evaluation additionally:
- year-by-year n and C1 for h=24 when n>=10
- direction-specific metrics
- retest-delay bins: 1, 2-3, 4-6 bars descriptive only

## Registered primary screen — evaluation h=24
All must hold:
1. active retest trades >=60
2. coverage >=0.20 of confirmed evaluation trends
3. C0 mean/trade >0
4. C1 mean/trade >0
5. C2 mean/trade >=0
6. C1 win rate >0.50
7. C1 mean/trade > immediate-confirmed h=24 C1 (+0.0451314463)
8. at least 20 up and 20 down trades

Passing is only development evidence.

## Integrity
- source handoff hash unchanged
- source state manifest unchanged
- source resolution labels/times unchanged
- retest search begins strictly after resolution
- first qualifying rejection only
- entry strictly after rejection close
- no future bar used to choose signal
- no threshold changed from outcomes
- market continuity <=3h
- Validation read=false
- Historical Holdout read=false

## Decision
If Retest Entry fails:
- do not tune 0.50 ATR or 6-bar window on the same evaluation;
- move to a new structural entry representation (for example DC correction/resumption) in a separately registered version.

If Retest Entry passes:
- freeze the rule as a Swing-entry candidate;
- require a new temporal gate before Historical Holdout.
