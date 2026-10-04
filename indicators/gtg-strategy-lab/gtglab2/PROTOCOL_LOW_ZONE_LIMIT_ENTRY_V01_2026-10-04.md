# PROTOCOL — Low-Zone Limit Entry v0.1

Date: 2026-10-04

## Diagnosis carried forward
Bottom classification has edge, but next-H1-open market entry is too late.
The confirmation/rejection candle consumes too much of the favorable excursion.

This study changes ONLY entry timing.
Detector models and detector score thresholds remain frozen.

Pristine Forward OOS remains unread.

## Frozen detector thresholds
Swing:
score >= 0.5669356193705579

Scalper:
score >= 0.6786512019247182

## Core rule
After a qualifying bottom signal closes:
do NOT chase at market.
Place a buy limit near the candidate low for a limited number of H1 bars.

If target is reached before the limit fills:
cancel the order — the move was missed.

If stop level is breached before the limit fills:
cancel the order — the bottom thesis failed before entry.

Only one pending order/position per engine.

## Swing fixed bracket
- stop = candidate low -1.0 ATR
- target = candidate low +4.0 ATR
- trade timeout after fill = 72H

Grid:
- limit offset above candidate low: 0.25, 0.50, 0.75, 1.00 ATR
- pending-order expiry: 3, 6, 12 H1 bars

## Scalper fixed bracket
- stop = candidate low -0.75 ATR
- target = candidate low +1.5 ATR
- trade timeout after fill = 12H

Grid:
- limit offset above candidate low: 0.10, 0.25, 0.40 ATR
- pending-order expiry: 1, 3, 6 H1 bars

## Fill semantics
For each pending H1 bar:
1. if open <= stop: cancel as pre-entry failure.
2. if open >= target: cancel as missed move.
3. if open <= limit and open > stop: fill at open (price improvement).
4. else if low <= stop before fill: conservative cancel as pre-entry failure.
5. else if high >= target before fill: cancel as missed move.
6. else if low <= limit: fill at limit.

On the fill bar:
- if the same bar also touches stop and target, count stop first.
- if stop is touched after a limit fill in the same bar, count a stop.
- target/stop are intrabar.
- risk size uses actual fill-to-stop distance = 1R.

## Selection data
Grid selection uses ONLY:
- development: 2018-2022
- validation: 2023-2024

No 2025-2026 outcome is used to rank entry configurations.

Eligibility:
Swing:
- >=30 fills in train and >=20 fills in validation
- positive mean R in both
- PF >1 in both

Scalper:
- >=50 fills in train and >=25 fills in validation
- positive mean R in both
- PF >1 in both

Selection:
maximize the WORST of train/validation mean R.
Tie-break:
1. smaller worst-segment drawdown
2. higher minimum fill count.

## Temporal diagnostic
After the best configuration is frozen:
run exactly that configuration on 2025-2026 without modification.

2025-2026 is not true clean OOS because this historical period has been inspected in earlier GTGLab work.
It is only a temporal robustness diagnostic.

No Pine promotion until the entry-timing bridge is positive and stable.

## Fill-order clarification before first run
Added before any grid outcome was observed.

For a pending bar with open above the buy limit:
- if low does not reach limit and high reaches target: cancel as missed move.
- if low reaches limit AND high also reaches target in the same H1 bar while stop is not already gapped: intrabar order is unknowable; cancel as AMBIGUOUS rather than assume a profitable fill-then-target sequence.
- if low reaches limit but target is not touched: fill at the limit.
- after a fill, if the same bar reaches stop, count STOP.

For a bar opening at/below the limit but above stop, the order fills immediately at open; subsequent H1 high/low can trigger the bracket, with STOP taking precedence if both stop and target are touched.
