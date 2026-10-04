# PROTOCOL — M15 Entry Resolution Study v0.1

Date: 2026-10-04

## Why
H1 Bottom Detectors classify bottoms with useful accuracy, but next-H1-open execution is late.
The rejection candle often consumes much of the rebound before entry.

The historical clean archive contains M1 bars, so M15 can be reconstructed causally and exactly.

## Architecture
- H1 remains context / larger movement map.
- M15 becomes the entry-resolution timeframe.
- No macro inputs.
- No forward/OOS data read.

## Data
Aggregate clean M1 BID bars into UTC-aligned 15-minute OHLC.
Period: 2018-03-01 through T_FREEZE 2026-09-30.

## M15 candidate
A candidate M15 low:
- current M15 low < lowest low of previous 12 M15 bars.

At candidate close use only known M15 information:
- drift 5/20/50 bars normalized by M15 ATR14
- efficiency 5/20/50
- position in prior 24 / 72 M15-bar ranges
- close location
- body / lower wick / upper wick normalized by ATR
- EMA50 / EMA200 distance and slope
- decline from prior 24 / 72 M15-bar highs

## Targets
Scalper M15:
- GOOD if candidate low +1.5 M15 ATR occurs before candidate low -0.75 M15 ATR within next 16 M15 bars (4H).
- FALSE if downside level hits first.

Swing-entry M15:
- GOOD if candidate low +3 M15 ATR occurs before candidate low -1 M15 ATR within next 32 M15 bars (8H).
- FALSE if downside level hits first.

These are entry-quality labels, not full final swing exits.

## Temporal split
- Train: 2018-2022
- Validation: 2023-2024
- Pseudo-test: 2025-2026

## Model
Same causal logistic framework:
- train median imputation
- train standardization
- balanced class weight
- C = 0.1, 0.3, 1, 3 selected on validation ROC-AUC

## Executable check
For frozen validation threshold at top 25% score:
- enter next M15 open
- risk from actual entry to candidate low - stop multiple
- Scalper: stop -0.75 ATR, target +1.5 ATR, max hold 16 M15
- Swing-entry: stop -1 ATR, target +3 ATR, max hold 32 M15
- conservative same-bar stop-first semantics
- compare filtered vs all-candidate baseline

## Primary question
Does M15 preserve enough reward after confirmation that next-bar execution becomes positive and robust?

No threshold retuning on 2025-2026.
