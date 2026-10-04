# PROTOCOL — M5 Transition State Machine v0.1

Date: 2026-10-05

## Question
Can we enter a real XAUUSD bottom earlier by detecting the causal transition itself:
selling pressure continues -> a final micro-low is printed -> downside follow-through fails -> price reclaims -> continuation?

This is not a new indicator stack. It is a price-action state machine.

## Fixed context
- H1 = context and ATR risk scale.
- M15 = completed short-term context retained for diagnostics.
- M5 = transition detection and execution.
- Clean JForex/Dukascopy historical data only.
- Pristine Forward OOS remains unread.
- No year feature and no future feature.

## Episode start
A WATCH episode starts when an M5 bar:
1. trades below the minimum low of the previous 12 completed H1 bars; and
2. makes a lower low than the previous 12 completed M5 bars.

This is a fresh micro-low inside a genuine 12H low zone.

## Anchor update
During WATCH:
- if a later M5 bar makes a lower low than the current anchor, that bar becomes the new anchor;
- the transition clock resets from the new anchor;
- maximum episode age = 12 M5 bars (60 minutes);
- maximum age since the latest anchor = 6 M5 bars (30 minutes).

Therefore the engine does not buy merely because price is low. It waits for selling to stop extending the low.

## Three preregistered transition rules

### T1 MID_RECLAIM
After at least one full M5 bar has occurred after the latest anchor:
- no newer lower low exists; and
- current close >= midpoint of anchor [low, high]; and
- current close > previous M5 close.

### T2 HIGH_RECLAIM
After at least one full M5 bar after anchor:
- no newer lower low exists; and
- current close > anchor high.

### T3 HIGHER_LOW_BREAK
After at least one full M5 bar after anchor:
- current low > anchor low; and
- current close > previous M5 high.

The first qualifying transition ends the WATCH episode for that rule.

## Execution
- Signal is known only at M5 close.
- Entry = next M5 open.
- Stop/target are anchored to the latest anchor low and H1 ATR known at that anchor.
- If stop and target are both touched in the same bar after entry: STOP first.
- Overlapping trades within each rule/engine are skipped.

## Engines

### Scalper
- stop = anchor low -0.75 H1 ATR
- target = anchor low +1.50 H1 ATR
- timeout = 12H

### Swing
- stop = anchor low -1.00 H1 ATR
- target = anchor low +4.00 H1 ATR
- timeout = 72H

## Selection
For each engine independently:
- Train = 2018-2022
- Validation = 2023-2024
- Candidate rules = T1/T2/T3 only
- Eligible requires mean R >0 and PF >1 on BOTH Train and Validation
- Minimum fills:
  - Scalper: Train >=100, Validation >=40
  - Swing: Train >=80, Validation >=30
- Rank eligible rules by:
  1. highest worst-split mean R
  2. smaller worst absolute drawdown
  3. more minimum fills

The winner is frozen before 2025-2026 is examined.

If no rule is eligible, the experiment fails without inventing extra filters.

## Pseudo-test
The single frozen winner for each engine is then reported unchanged on 2025-2026.

## Promotion gate
No Execution Candidate unless:
- pseudo-test mean R >0
- PF >1
- and yearly 2025/2026 behavior is not dominated by one positive year and one severe failure.

Pristine Forward OOS remains unread.
