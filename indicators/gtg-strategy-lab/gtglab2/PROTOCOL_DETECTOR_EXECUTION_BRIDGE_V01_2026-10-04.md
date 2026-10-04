# PROTOCOL — Detector Execution Bridge v0.1

Date: 2026-10-04

## Goal
Test whether the causal Swing and Scalper detector scores convert into executable next-open trading edge.

This is an execution bridge, not final production validation.
Pristine Forward OOS remains unread.

## Frozen models
Use Swing / Scalper Detector v0.1 models trained on 2018-2022.

Frozen operating thresholds selected on 2023-2024 validation:
- Swing balanced threshold: score >= 0.5669356193705579
- Swing high-confidence diagnostic: score >= 0.70656536
- Scalper high-confidence/top-quarter threshold: score >= 0.6786512019247182
- Scalper broader diagnostic: score >= 0.5160156476601278

Primary thresholds:
- Swing = 0.5669356193705579
- Scalper = 0.6786512019247182

## Candidate
Same causal Bottom Atlas candidate:
H1 low below prior 12H low.

Models score every candidate causally.
No future label is required to generate a trade.

## Swing execution
At candidate close:
- if Swing Score >= frozen threshold and flat, reserve entry.
- enter next H1 open.
- ATR frozen at signal candidate.
- stop = candidate low - 1.0 ATR
- target = candidate low + 4.0 ATR
- quantity chosen so entry-to-stop risk = 1R = $100
- timeout = 72 H1 bars
- no other discretionary exit.

## Scalper execution
At candidate close:
- if Scalper Score >= frozen threshold and flat, reserve entry.
- enter next H1 open.
- ATR frozen at signal candidate.
- stop = candidate low - 0.75 ATR
- target = candidate low + 1.5 ATR
- quantity chosen so entry-to-stop risk = 1R = $100
- timeout = 12 H1 bars
- no other discretionary exit.

## Fill semantics
- Gap beyond stop: fill at next/open price.
- Gap beyond target: fill at next/open price.
- If stop and target are both touched inside one H1 bar, assume stop first.
- Target/stop can execute intrabar.
- Timeout exits at next H1 open.
- one active position per engine; candidates occurring while in trade are ignored.

## Baseline
For each engine, run the exact same stop/target/timeout mechanics on ALL bottom candidates without score filtering.
This measures whether the detector adds value beyond simply buying every fresh low.

## Evaluation
Report separately for:
- Train 2018-2022
- Validation 2023-2024
- Pseudo-test 2025-2026

Primary evidence:
Pseudo-test detector-filtered versus pseudo-test baseline:
- trades
- total R
- mean R
- win rate
- profit factor
- max drawdown
- target/stop/timeout counts
- average actual reward/risk at entry

No threshold may be changed after seeing pseudo-test output.
