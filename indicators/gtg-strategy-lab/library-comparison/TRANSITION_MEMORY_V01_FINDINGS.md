# GTG Transition Memory v0.1 — Findings

Date: 2026-10-03
Scope: Train-only transition-resolution classification.
Validation and Historical Holdout remained closed.

## Frozen design
- State source: State + Transition Engine v0.2.
- Fit: primary RANGE -> TRANSITION episodes before 2021 only.
- Evaluation: primary episodes 2021-01-01 through 2024-03-20.
- Up/down attempts canonicalized into one question:
  - TREND_CONFIRMED
  - RANGE_RESUMED
- K=7 scalar memory.
- K=7 multivariate DTW memory, Sakoe-Chiba radius=2.
- Logistic baseline fixed before evaluation.
- Primary memory hybrid = mean(scalar-memory probability, DTW-memory probability).
- Decision threshold fixed at 0.50.

## Integrity
- 8/8 implementation tests PASS before fit.
- Training reader stopped at the first 2021 event.
- Frozen fit committed before evaluation.
- Training n=373.
- Training trend prevalence=62.73%.
- Evaluation n=454.
- Evaluation trend prevalence=61.67%.
- Frozen memory SHA unchanged.
- Source state SHA unchanged.
- Full raw manifest matches State Engine v0.2.
- Validation/Holdout not read.

## Results

### Prior baseline
Always predicts the majority outcome, TREND_CONFIRMED:
- accuracy 61.67%
- balanced accuracy 50.0%
- Brier 0.2365
- RANGE recall 0%

### Logistic baseline
The fixed 15-feature onset representation was strongly informative out of time:
- accuracy 77.97%
- balanced accuracy 74.31%
- Brier 0.1750
- ROC AUC 0.7763
- TREND precision 77.78%
- TREND recall 90.00%
- RANGE precision 78.46%
- RANGE recall 58.62%

Confusion matrix:
- true RANGE rejected correctly: 102
- RANGE misclassified as trend: 72
- true TREND missed: 28
- true TREND retained: 252

Operationally, relative to treating every transition as a real breakout:
- rejects 102 of 174 RANGE resumptions (58.6%)
- retains 252 of 280 real trend transitions (90.0%)

Direction stability:
- candidate UP, n=237: balanced accuracy 72.57%, TREND precision 77.38%, TREND recall 87.84%, RANGE recall 57.30%
- candidate DOWN, n=217: balanced accuracy 76.21%, TREND precision 78.21%, TREND recall 92.42%, RANGE recall 60.00%

Year stability:
- 2021: balanced accuracy 75.35%
- 2022: 72.39%
- 2023: 76.22%
- 2024 partial: 65.0% on n=32

### Scalar KNN memory
- accuracy 72.25%
- balanced accuracy 67.60%
- Brier 0.2025
- TREND precision 72.92%
- RANGE recall 47.70%

Useful, but weaker than Logistic.

### DTW range-shape memory
- accuracy 60.35%
- balanced accuracy 51.65%
- Brier 0.2643
- ROC AUC 0.5208
- RANGE recall 14.37%

The historical RANGE shape alone did not distinguish real from false exits.

### Primary hybrid memory
- accuracy 71.37%
- balanced accuracy 63.41%
- Brier 0.2094
- TREND precision 68.94%
- TREND recall 97.50%
- RANGE precision 87.93%
- RANGE recall 29.31%

The preregistered primary hybrid failed its utility screen only because RANGE recall was below the required 35%:
- n >=400: PASS
- balanced accuracy >0.52: PASS
- Brier better than prior: PASS
- RANGE recall >=0.35: FAIL
- TREND precision > prevalence: PASS
- both directions >=100: PASS
- overall utility screen: FAIL

## Interpretation
The main result is not that historical shape memory solved the transition.

Instead, the simple causal onset state vector contains substantially more useful information than raw range-shape similarity.

The 15 scalar features jointly capture:
- source RANGE age/width,
- location at attempted exit,
- multi-scale DC alignment,
- short/medium momentum,
- efficiency,
- spread,
- volatility ratio,
- whether the onset was a literal breakout vs trend-core trigger.

A fixed Logistic model using these features separates many fake breaks from true trend transitions across 2021, 2022 and 2023.

DTW is currently adding noise to the scalar memory rather than helping it, so K/radius must not be tuned on this evaluation.

## Decision
- State Engine v0.2 remains the market-state authority.
- At TRANSITION onset, the fixed Logistic classifier becomes the strongest current early-resolution expert.
- Historical KNN/DTW memory remains diagnostic evidence, not the primary gate.
- Do not tune Logistic coefficients or threshold from this evaluation.
- Next step: a separately preregistered execution audit of the already-frozen Logistic threshold 0.50:
  - compare entering every transition,
  - entering only Logistic TREND predictions at onset,
  - waiting for deterministic FSM trend confirmation.
- Only after that should Kronos be tested as an additional Transition expert.
- Validation/Holdout remain closed.
