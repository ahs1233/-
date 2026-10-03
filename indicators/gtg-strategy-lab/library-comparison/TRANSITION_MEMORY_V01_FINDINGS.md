# GTG Transition Memory v0.1 — Findings

Date: 2026-10-03
Scope: Train-development research using frozen State + Transition Engine v0.2.
Validation/Historical Holdout outside the library-comparison raw gate were not read.

## Design
Fit and memory library:
- onset < 2021-01-01
- 373 resolved primary RANGE -> TRANSITION episodes
- RANGE_RESUMED: 139
- TREND_CONFIRMED: 234
- trend prevalence: 62.73%

Frozen evaluation:
- 2021-01-01 <= onset < 2024-03-20
- 454 resolved primary episodes
- RANGE_RESUMED: 174
- TREND_CONFIRMED: 280
- trend prevalence: 61.67%

Fit stopped reading the transition file at the first 2021 event.
Raw H1 fit also stopped before 2021.
Memory/scalers/logistic coefficients were frozen and hashed before evaluation opened.

## Integrity
PASS:
- frozen memory SHA unchanged
- training memory SHA unchanged
- no training event at/after 2021
- no evaluation event before 2021
- source state SHA unchanged
- source manifest matches State Engine v0.2
- historical range sequence excludes the transition-onset bar
- no Validation/Holdout read by this experiment

## Models

### Prior baseline
Always behaves like the library prevalence:
- accuracy 61.67%
- balanced accuracy 50.0%
- Brier 0.2365
- RANGE recall 0%

### Logistic baseline — strongest frozen model
- accuracy: 77.97%
- balanced accuracy: 74.31%
- Brier: 0.1750
- ROC AUC: 0.7763
- TREND precision: 77.78%
- TREND recall: 90.00%
- RANGE precision: 78.46%
- RANGE recall: 58.62%

Confusion matrix:
- actual RANGE correctly rejected: 102 / 174
- actual RANGE wrongly treated as trend: 72 / 174
- actual TREND missed: 28 / 280
- actual TREND identified: 252 / 280

This is the clearest evidence so far that onset-state variables contain useful information about whether a range exit will become a real trend.

### Scalar historical memory K=7
- accuracy 72.25%
- balanced accuracy 67.60%
- Brier 0.2025
- RANGE recall 47.70%
- TREND precision 72.92%

Useful, but materially weaker than Logistic.

### DTW range-shape memory K=7
- accuracy 60.35%
- balanced accuracy 51.65%
- Brier 0.2643
- ROC AUC 0.5208
- RANGE recall 14.37%

The 6-24 bar raw range-shape sequence, under the registered 3-channel DTW representation, adds little useful discrimination.

### Primary scalar+DTW hybrid
- accuracy 71.37%
- balanced accuracy 63.41%
- Brier 0.2094
- TREND precision 68.94%
- TREND recall 97.50%
- RANGE recall 29.31%

The registered primary hybrid FAILED its utility screen because RANGE recall was below the fixed 0.35 requirement.

## Directional stability of hybrid
Candidate up:
- n=237
- balanced accuracy 66.29%
- RANGE recall 35.96%

Candidate down:
- n=217
- balanced accuracy 60.42%
- RANGE recall 22.35%

The hybrid is especially poor at rejecting false downside breaks.

## Time stability of hybrid
- 2021: balanced accuracy 63.46%
- 2022: 62.00%
- 2023: 65.44%
- 2024 partial: 62.50% (n=32)

The hybrid's weakness is persistent rather than caused by one isolated year.

## Interpretation
The experiment rejects the hypothesis that simple DTW similarity of the preceding range shape is the best Transition Memory.

The stronger signal is in the compact causal onset state:
- range age/width/position
- aligned multi-scale DC state
- aligned drift
- efficiency
- spread/ATR
- volatility ratio
- trigger type

A fixed linear Logistic model on these variables generalized far better than the registered historical-shape memory.

Because Logistic was one of the preregistered models, its evaluation result is valid descriptive out-of-time evidence. However, choosing it for the next phase after seeing this comparison is model selection; it requires another gate before any confirmatory edge claim.

## Decision
- Keep State Engine v0.2 frozen.
- Keep TRANSITION as SCALPER_STAND_DOWN.
- Reject DTW/hybrid as the primary Transition expert in v0.1.
- Preserve Logistic as the candidate Transition expert.
- Do not tune K/radius/thresholds on this evaluation.
- Next: fixed-threshold Logistic shadow execution audit at Transition onset, using the already-preregistered p>=0.50 threshold and unchanged C0/C1/C2 cost model.
- That audit is explicitly post-selection diagnostic, not independent validation.
- Historical Holdout remains closed.
