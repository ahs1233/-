# GTGLab2 — Experiment Register

This register inherits closed GTGLab experiments and will hold all GTGLab2 experiments.

## E-001 — Transition logistic classifier
- Task: fake break vs true trend after range exit.
- Approx. accuracy: 78.0%.
- Balanced accuracy: 74.3%.
- Result: classification useful, execution economics not sufficient.
- Verdict: **classification signal ≠ proven trading edge**.

## E-002 — Early breakout execution / logistic filter
- Early breakout C1: about -0.337 ATR/trade.
- Logistic filter C1: about -0.361.
- Delayed confirmation improved economics but timing remained weak.
- Verdict: **FAIL as execution solution**.

## E-003 — Directional Change leg geometry
- Goal: refine Swing entry timing.
- Result: weakened signal.
- Verdict: **CLOSED**.

## E-004 — Range scalper Pre-Transition Guard
- Guard C1: about -0.206.
- No-Guard C1: about -0.181.
- Verdict: **FAIL**.

## E-005 — Raw Sequence Utility
- 48 H1-candle sequence.
- correlation: ~0.010.
- directional accuracy: ~55.6%.
- C1: ~-0.316 ATR/trade.
- Verdict: **FAIL**.

## E-006 — DC Correction → Resumption H4
- Validation C1: ~-0.054.
- C2: ~-0.199.
- Verdict: **FAIL**.

## E-007 — Chronos-2 DC Gate v0.1
- zero-shot context: 256 H1
- horizon: 4
- 109 signals → 62 trades
- Chronos C1: +0.0049
- baseline C1: +0.1013
- temporal instability observed
- Verdict: **FAIL incremental edge**.

## E-008 — Microstructure Forward
- Features available include flow, delta, footprint, order-book imbalance, volume profile, and market agreement.
- Status: **COLLECTING ONLY**.
- Outcome linkage: **NOT YET PERMITTED**.
- First edge-analysis experiment: pending readiness gate.

## Sweep / Acceptance v0.1 � 2026-10-04
- Development only; locks preserved.
- Boundary breaks: 1,134; acceptance: 774; rejection: 360.
- BASE C1 single overall: -0.0516 R/trade.
- BASE C1 acceptance single: +0.0210 R/trade.
- BASE C1 rejection single: -0.1249 R/trade.
- BASE C1 acceptance staged: -0.0291 R/trade.
- Verdict: overall FAIL; rejection-fade branch rejected; acceptance continuation retained as a new-version research lead; current staging rule rejected.

