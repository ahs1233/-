# PROTOCOL — Linked H1/M15/M5 Entry Resolution v0.1

Date: 2026-10-05

## Purpose
Test whether a causal M5 trigger can preserve the known bottom-classification edge while entering before H1/M15 confirmation consumes the move.

## Fixed architecture
- H1: context and risk scale only.
- M15: completed short-term context only.
- M5: current rejection/recovery trigger and execution resolution.
- No year feature.
- No future feature.
- Pristine Forward OOS remains unread.

## Candidate
At M5 close:
1. current M5 low is below the minimum low of the previous 12 completed H1 bars;
2. current M5 low is below the previous 12 completed M5 lows.

This identifies a fresh micro low occurring inside a genuine 12H low zone.

## Causal features
M5 current bar:
- close location
- lower wick / H1 ATR
- body / H1 ATR
- 15m and 60m drift / H1 ATR
- 15m and 60m directional efficiency

Last completed M15 context:
- close location
- lower wick / H1 ATR
- 1H and 5H drift / H1 ATR
- 1H and 5H directional efficiency

Last completed H1 context:
- close location
- lower wick / H1 ATR
- 5H drift / H1 ATR
- 5H directional efficiency
- 24H position
- decline from 24H high / H1 ATR

## Targets
Scalper:
- +1.5 H1 ATR before -0.75 H1 ATR
- horizon 12H

Swing:
- +4.0 H1 ATR before -1.0 H1 ATR
- horizon 72H

## Selection
- Train: 2018-2022
- Validation: 2023-2024
- Pseudo-test: 2025-2026, report only
- Logistic regression C chosen on Validation AUC.
- High-quality threshold = Validation top quartile score.
- No parameter selection from 2025-2026.

## Execution
- Signal becomes available only after M5 bar closes.
- Entry = next M5 open.
- Stop/target anchored to signal M5 low and frozen H1 ATR.
- Same-bar stop+target after entry = STOP first.
- Overlapping positions are skipped.

## Decision
Promote only if pseudo-test execution expectancy is positive and reasonably stable; otherwise diagnose timing rather than add filters.
