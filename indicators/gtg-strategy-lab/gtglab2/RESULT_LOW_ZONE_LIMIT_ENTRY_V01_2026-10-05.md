# RESULT — Low-Zone Limit Entry v0.1

Date: 2026-10-05

## Purpose
Test whether waiting for a low-zone retest after a high-quality Bottom Detector signal improves executable entry versus chasing at next H1 open.

Detector models and thresholds were frozen.
Limit-entry grids were selected using 2018-2024 only.
The selected configurations were then applied unchanged to 2025-2026.

Pristine Forward OOS remained unread.

## Selected from 2018-2024

### Swing
Selected:
- score >= 0.5669356193705579
- buy limit = candidate low +1.00 ATR
- pending expiry = 3H
- stop = candidate low -1.00 ATR
- target = candidate low +4.00 ATR
- timeout after fill = 72H

2018-2022:
- 478 fills
- +22.4520R
- mean +0.0470R
- PF 1.0781
- max DD -17.2056R
- win rate 39.75%
- avg entry R:R 1.658

2023-2024:
- 212 fills
- +9.5000R
- mean +0.0448R
- PF 1.0748
- max DD -13.5961R
- win rate 40.09%
- avg entry R:R 1.625

### Scalper
Selected:
- score >= 0.6786512019247182
- buy limit = candidate low +0.10 ATR
- pending expiry = 3H
- stop = candidate low -0.75 ATR
- target = candidate low +1.50 ATR
- timeout after fill = 12H

2018-2022:
- 125 fills
- +6.6225R
- mean +0.0530R
- PF 1.0871
- max DD -14.2789R
- win rate 39.20%
- avg entry R:R 1.648

2023-2024:
- 61 fills
- +6.9896R
- mean +0.1146R
- PF 1.1997
- max DD -5.2456R
- win rate 42.62%
- avg entry R:R 1.647

## Frozen temporal diagnostic — 2025-2026

### Swing
- attempts: 217
- fills: 167
- fill rate: 76.96%
- missed target before fill: 11
- expired: 38
- ambiguous cancelled: 1

Performance:
- 167 trades
- total -23.6262R
- mean -0.1415R
- PF 0.7895
- max DD -30.7628R
- win rate 33.53%
- avg entry R:R 1.608

FAIL.

### Scalper
- attempts: 264
- fills: 53
- fill rate: 20.08%
- missed target before fill: 187
- expired: 13
- ambiguous cancelled: 11

Performance:
- 53 trades
- total -11.4090R
- mean -0.2153R
- PF 0.6916
- max DD -15.9972R
- win rate 30.19%
- avg entry R:R 1.720

FAIL.

## Comparison with next-open execution

Swing next-open pseudo-test:
- -19.7914R
- PF 0.8393
- win rate 42.45%
- avg entry R:R 1.284

Swing limit pseudo-test:
- -23.6262R
- PF 0.7895
- win rate 33.53%
- avg entry R:R 1.608

The limit improved entry R:R but selected a worse conditional population: if price returns deeply enough after H1 rejection, the bottom is more likely to fail.

Scalper next-open pseudo-test:
- -8.8965R
- PF 0.7995
- win rate 77.45%
- avg entry R:R 0.273

Scalper limit pseudo-test:
- -11.4090R
- PF 0.6916
- win rate 30.19%
- avg entry R:R 1.720

For Scalper, most strong signals never retested the low zone:
187 of 264 attempts reached the target zone before the selected low limit could fill.
The cases that did retest were disproportionately weak/failing bottoms.

## Core conclusion
Two H1-only execution methods have now failed:
1. next-H1-open market entry = too late / reward already consumed,
2. deep post-confirmation limit retest = adverse selection / return toward low often signals failure.

Therefore the main bottleneck is temporal resolution.

The Bottom Detector sees useful information in the H1 rejection candle, but the executable opportunity exists DURING formation of that rejection, not after the H1 candle is fully closed.

## Decision
Do not tune another H1 limit offset on the same historical corpus.

Next research direction:
- keep H1 as context / candidate-bottom frame,
- move execution to a lower timeframe (M5/M15),
- detect rejection and recovery causally while the H1 candidate is forming,
- enter before the full H1 recovery consumes the reward,
- retain separate Swing and Scalper objectives.

This is a change in execution resolution, not another threshold optimization.

Pristine Forward OOS remains unread.
