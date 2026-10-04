# RESULT — GTGLab2 Bottom Atlas v0.1

Date: 2026-10-04

## What was measured
This study did not optimize a trading strategy.
It mapped historical gold lows, rallies, peaks, and false lows using clean H1 data from 2018-03-01 through T_FREEZE 2026-09-30.

Pristine Forward OOS was not read.

## Swing map

### 1 ATR scale
- 27,281 pivots
- 13,641 lows
- Median next rise: 1.88 ATR
- Median prior decline: 1.86 ATR
- Median rise duration: 1 H1 bar
- Median confirmation delay: 1 H1 bar

### 2 ATR scale
- 7,993 pivots
- 3,997 lows
- 3,995 completed low-to-high swings
- Median next rise: 3.32 ATR
- Median prior decline: 3.23 ATR
- Median rise duration: 4 H1 bars
- Median confirmation delay: 1 H1 bar

Major 2-ATR swing bottoms, defined descriptively as next rise >=4 ATR:
- 1,361 bottoms
- Median prior decline: 3.07 ATR
- Median next rise: 5.14 ATR
- Median rise duration: 7 H1 bars
- Median confirmation delay: 1 H1 bar

### 4 ATR scale
- 1,438 pivots
- 719 lows
- 718 completed low-to-high swings
- Median prior decline: 6.42 ATR
- Median next rise: 6.80 ATR
- Median rise duration: 26.5 H1 bars
- Median confirmation delay: 9 H1 bars

Interpretation:
waiting for a 4-ATR reversal identifies large bottoms, but it confirms them late.
The 2-ATR scale identifies major swing bottoms much earlier.

## Bottom-candidate atlas

Candidate definition:
an H1 bar makes a low below the previous 12H low.

Total candidates:
- 6,426

48H resolved outcomes:
- GOOD: 2,588
- FALSE LOW: 3,714
- Ambiguous: 43
- Baseline GOOD rate among resolved candidates: 41.07%

A GOOD 48H bottom means:
+3 ATR was reached before price fell another -1 ATR.

A FALSE LOW means:
-1 ATR lower was reached first.

## The strongest difference: rejection, not cheapness

### Lower wick
GOOD bottoms:
- median lower wick = 0.510 ATR

FALSE lows:
- median lower wick = 0.376 ATR

If lower wick >=0.5 ATR:
- 2,614 cases
- GOOD rate = 50.46%
- baseline lift = 1.23x

### Close location inside the candle
GOOD bottoms:
- median close location = 47.7% of the candle range

FALSE lows:
- median = 33.4%

If the candle closes in its upper half:
- 2,413 cases
- GOOD rate = 50.93%
- baseline lift = 1.24x

### Both together
Lower wick >=0.5 ATR AND close in upper half:
- 1,609 cases
- GOOD rate = 54.44%
- lift versus baseline = 1.33x

Add short-term decline that is no worse than -1.5 ATR over 5 bars:
- 1,026 cases
- GOOD rate = 58.67%
- lift = 1.43x

Adding 5-bar efficiency <=0.60:
- 832 cases
- GOOD rate = 58.89%
- almost no additional gain beyond the first three observations.

These combinations are descriptive findings, not promoted entry rules.

## Important negative result: the absolute cheapest point is not the best bottom

24H range position:
- GOOD median = 0.128
- FALSE median = 0.093

The false lows were, on average, even closer to the absolute bottom of the recent range.

Therefore:
"buy the lowest price" is not enough.
The market can be very low and still be falling.

The useful event is:
low price + rejection + loss of downside momentum.

## Momentum before the bottom

5H drift:
- GOOD median = -1.46 ATR
- FALSE median = -1.67 ATR

5H efficiency:
- GOOD median = 0.608
- FALSE median = 0.666

Interpretation:
false lows more often occur during a cleaner, more efficient one-way decline.
Good bottoms more often appear after the decline begins to lose efficiency and the low is rejected.

## EMA information was secondary

The differences in EMA50 / EMA200 slope and distance existed but were much weaker than:
- lower wick
- closing recovery
- short-term deceleration

This supports the project compass:
first understand price behavior at the low itself; do not let moving averages define the bottom.

## Year stability

48H GOOD rate among resolved candidates:
- 2018: 39.86%
- 2019: 46.35%
- 2020: 45.11%
- 2021: 39.38%
- 2022: 37.09%
- 2023: 41.07%
- 2024: 42.57%
- 2025: 45.28%
- 2026 through Sep: 34.39%

The basic bottom phenomenon exists across all years, although difficulty varies.

## Swing and Scalper populations

Swing population:
- 1,361 major 2-ATR bottoms with a following rise >=4 ATR.

Scalper population:
- 566 1-ATR bottoms whose following rise was 1-3 ATR and remained inside a <=4 ATR 48H range.

These are now separate research populations.

## Core conclusion

The historical data does not say:
"buy because price is very low."

It says a better bottom signature is:

1. price makes a fresh local low,
2. downside momentum is beginning to lose efficiency,
3. the candle rejects the low with a meaningful lower wick,
4. the close recovers materially away from the low,
5. then price begins the upward leg.

The strongest information came from the behavior AT the low, not from a macro story or a large set of indicators.

No Pine entry rule is promoted from this study.
The next scientific step is to build a causal Bottom Detector from these observations using a development/validation split, then test Swing and Scalper separately.
