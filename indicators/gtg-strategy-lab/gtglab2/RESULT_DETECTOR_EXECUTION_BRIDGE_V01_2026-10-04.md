# RESULT — Detector Execution Bridge v0.1

Date: 2026-10-04

## Purpose
Test whether Swing/Scalper detector classification edge survives causal next-H1-open execution.

## Swing primary
Frozen score threshold: 0.5669356193705579
Execution:
- stop candidate low -1 ATR
- target candidate low +4 ATR
- timeout 72H
- enter next H1 open

Pseudo-test 2025-2026:
- 212 trades
- win rate 42.45%
- total -19.7914R
- mean -0.0934R
- PF 0.8393
- max DD -29.7758R
- average actual entry R:R 1.284

Baseline all fresh lows:
- 385 trades
- win rate 33.51%
- total +19.5549R
- mean +0.0508R
- PF 1.0765
- max DD -44.5309R
- average entry R:R 2.343

The detector improved hit rate and drawdown but destroyed enough reward/risk that net expectancy became negative.

Swing high-confidence:
- 32 pseudo-test trades
- 56.25% win
- -0.4986R
- PF 0.959
- average entry R:R only 0.754

The highest-quality classification cases were the latest entries because the rejection/recovery had already traveled far from the candidate low.

## Scalper primary
Frozen score threshold: 0.6786512019247182
Execution:
- stop candidate low -0.75 ATR
- target candidate low +1.5 ATR
- timeout 12H
- enter next H1 open

Pseudo-test 2025-2026:
- 204 trades
- win rate 77.45%
- total -8.8965R
- mean -0.0436R
- PF 0.7995
- max DD -15.5706R
- average actual entry R:R 0.273

Baseline:
- 569 trades
- win rate 56.24%
- total -12.8537R
- PF 0.9484
- max DD -36.1605R
- average entry R:R 0.904

The detector strongly improves hit rate and reduces drawdown, but the target remaining after next-open entry is too small.

## Core diagnosis

The classification targets were defined from the candidate LOW:
- Swing: low +4 ATR versus low -1 ATR.
- Scalper: low +1.5 ATR versus low -0.75 ATR.

But the detector requires rejection evidence such as:
- lower wick,
- recovery close,
- downside deceleration.

By the time the H1 signal closes, part of the favorable excursion has already happened.

Therefore:
classification quality != executable expectancy at next-open market entry.

This is not a reason to discard the Bottom Detector.
It identifies an ENTRY TIMING problem.

## Decision
Reject next-H1-open market entry as the default bridge for both detectors.

Next research:
After a high-quality bottom signal, place a time-limited BUY LIMIT on a retrace near the candidate low.
If price never retests the low zone, do not chase it.

This directly matches the project objective:
buy low, then sell higher.
