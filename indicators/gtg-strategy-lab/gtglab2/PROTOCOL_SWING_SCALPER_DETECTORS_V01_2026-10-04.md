# PROTOCOL — Swing / Scalper Bottom Detectors v0.1

Date: 2026-10-04

## Goal
Split the general Bottom Detector into two causal questions:

1. Swing Detector:
Can this fresh local low develop into a large upward leg?

2. Scalper Detector:
Can this fresh local low produce a fast tradable bounce?

No entry/exit strategy is optimized here.
No Pristine Forward OOS is read.

## Candidate population
Same Bottom Atlas candidate:
H1 low below prior 12H low.

## Swing target
Using ATR14 frozen at candidate time:
- SWING_GOOD: price reaches candidate low +4 ATR before reaching candidate low -1 ATR within 72 H1 bars.
- SWING_FALSE: -1 ATR is reached first.
- ambiguous or unresolved cases are excluded.

This target seeks a large favorable excursion with asymmetric downside.

## Scalper target
Using ATR14 frozen at candidate time:
- SCALP_GOOD: price reaches candidate low +1.5 ATR before reaching candidate low -0.75 ATR within 12 H1 bars.
- SCALP_FALSE: -0.75 ATR is reached first.
- ambiguous or unresolved cases are excluded.

This target seeks a fast bounce rather than a large trend leg.

## Causal features
Same frozen feature set as Bottom Detector v0.1:
- drift5/20/50 ATR
- efficiency5/20/50
- position24/72
- ATR relative120
- candle close location, body, lower/upper wick
- EMA50/200 distances and slopes
- decline from prior 24H/72H high

No future fields as inputs.

## Temporal split
- Train: 2018-2022
- Validation: 2023-2024
- Internal pseudo-test: 2025-2026

## Model
Logistic regression only for this pass:
- train median imputation
- train standardization
- class_weight balanced
- C candidates: 0.1, 0.3, 1.0, 3.0
- select C by validation ROC-AUC, then Brier score.

## Operating points
Choose on validation only:
- top ~50% score threshold
- top ~25% score threshold
- high-confidence threshold reaching >=60% precision if possible

Freeze and report on pseudo-test.

## Research gate
Candidate remains useful if:
- validation AUC >0.58
- pseudo-test AUC >0.55
- high-score subset has material precision lift over the target baseline.

No Pine strategy is promoted directly from this run.
