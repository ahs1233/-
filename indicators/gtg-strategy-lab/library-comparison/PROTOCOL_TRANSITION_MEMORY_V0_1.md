# GTG Transition Memory v0.1 — historical range-exit memory

Registered 2026-10-03 before any Transition Memory evaluation predictions are computed.

## Purpose
At TRANSITION onset, estimate whether the current RANGE exit will:
- TREND_CONFIRMED: resolve into the onset candidate direction, or
- RANGE_RESUMED: return to RANGE.

The absolute future trend direction is not separately predicted in v0.1. If TREND_CONFIRMED, direction is the already-causal onset candidate direction from State Engine v0.2.

This directly operationalizes:
- TRANSITION onset -> stop Scalper,
- historical memory -> estimate whether the attempted exit is likely to become a real trend,
- confirmed/high-confidence trend candidates may later feed a Swing engine.

This is Train-only research. It does not authorize live execution.

## Frozen source
Use State Engine:
- runs/state-transition-v02-001
- state sequence and transition library frozen
- state thresholds unchanged
- market continuity <=3h unchanged
- source range age >=6 unchanged

Validation and Historical Holdout remain closed.

## Train/evaluation split
Memory library:
- primary RANGE->TRANSITION events with onset < 2021-01-01
- labels RANGE_RESUMED or TREND_CONFIRMED only
- unresolved gap/data-end events excluded

Frozen evaluation:
- primary events with onset >=2021-01-01 and <2024-03-20
- same labels
- unresolved events excluded

Fit stage must stop reading the transition-event file when the first event at/after 2021-01-01 is encountered.
Fit H1 source must stop before 2021-01-01.

Evaluation is a separate command and requires a frozen memory artifact.

## Label
For onset candidate direction d:
- TREND_CONFIRMED = 1 if frozen FSM resolution is TREND_UP with d=+1 or TREND_DOWN with d=-1.
- RANGE_RESUMED = 0 if frozen FSM resolution is RANGE.
- opposite-trend resolution would be excluded and reported as a contract violation in v0.1.
- unresolved events excluded.

No future return, MFE/MAE, C0/C1/C2, or Kronos prediction enters the label.

## Canonical direction
Up and down attempts are mapped into one canonical orientation.

For candidate direction d in {-1,+1}:
- aligned drift = d * drift
- aligned DC direction = d * DC direction
- canonical range position:
  - if d=+1: position24
  - if d=-1: 1-position24

Thus positive/aligned means "toward the attempted breakout direction."

## Scalar onset features
Exactly 15 causal features:

1. log1p(range_age)
2. prior24_width_atr
3. canonical_position24
4. aligned_dc0p5_dir
5. aligned_dc1p0_dir
6. aligned_dc2p0_dir
7. aligned_dc4p0_dir
8. aligned_drift12
9. aligned_drift24
10. aligned_drift48
11. efficiency24
12. efficiency48
13. spread_atr
14. atr_week_ratio
15. trigger_breakout (1 BREAKOUT, 0 TREND_CORE)

No session, future outcome, model prediction, or post-onset information in v0.1.

Fit sklearn RobustScaler on library scalar features only.
Freeze center/scale before evaluation.

## Historical range sequence
For each event:
- take the preceding RANGE bars only,
- length = min(range_age, 24),
- exclude the TRANSITION onset bar,
- require at least 6 bars,
- every adjacent source-bar gap must be >0 and <=3h.

Per bar use 3 causal sequence channels:

1. canonical_position:
   p = (BidClose - frozen_lower)/(frozen_upper-frozen_lower)
   if candidate direction is down, use 1-p.

2. aligned_return_atr:
   candidate_direction * (BidClose[j]-BidClose[j-1]) / ATR[j]

3. bar_range_atr:
   (BidHigh[j]-BidLow[j]) / ATR[j]

Fit one RobustScaler across all library sequence rows only.
Freeze center/scale before evaluation.

Variable sequence length is retained. No resampling to a fixed shape.

## Models
No hyperparameter search.

### A. Prior baseline
p_trend = library TREND_CONFIRMED prevalence.

### B. Logistic baseline
sklearn LogisticRegression:
- scalar features only
- C=1.0
- penalty=l2
- solver=lbfgs
- max_iter=1000
- random_state=20261003
- no class weighting

Persist coefficients/intercept before evaluation.

### C. Scalar historical memory
K=7 nearest library events by Euclidean distance in frozen RobustScaler scalar space.
p_trend = mean neighbor label.

### D. DTW historical memory
K=7 nearest library range sequences.
Distance:
- tslearn multivariate DTW
- Sakoe-Chiba radius=2
- frozen sequence scaling

p_trend = mean neighbor label.

### E. Primary memory hybrid
p_trend = (p_scalar_knn + p_dtw_knn) / 2.

Classification threshold for every probability model:
- TREND_CONFIRMED if p >=0.50
- RANGE_RESUMED otherwise

K, radius, features, model settings and threshold may not be changed from evaluation outcomes.

## Stored neighbor evidence
For every evaluation event persist:
- event id/time
- actual label
- onset candidate direction
- each model probability/prediction
- top 7 scalar-memory neighbor event ids/times/labels/distances
- top 7 DTW neighbor event ids/times/labels/distances

This keeps the model interpretable as historical cases, not a black-box signal.

## Metrics
For every model:
- n
- accuracy
- balanced accuracy
- Brier score
- ROC AUC when defined
- TREND precision
- TREND recall
- RANGE precision
- RANGE recall
- confusion matrix

Also report:
- evaluation label prevalence
- metrics separately for onset candidate up/down
- metrics by calendar year for the primary hybrid, when each group has both labels

No PnL metric is used in v0.1.

## Registered utility screen for primary memory hybrid
All must hold to call the memory signal worth continuing:

1. evaluation n >=400.
2. balanced accuracy >0.52.
3. Brier score < prior-baseline Brier score.
4. RANGE recall >=0.35.
5. TREND precision > evaluation TREND prevalence.
6. both candidate directions have n>=100.

Passing does not establish a trading edge and does not open Holdout.

## Integrity checks
Fit:
- source state/transition SHA/reference recorded
- transition events chronological
- fit stops before first 2021 event
- raw H1 fit gate ends before 2021
- scalar/sequence scalers fit on library only
- logistic fit on library only
- training memory frozen and hashed before evaluation

Evaluation:
- frozen memory SHA unchanged
- full canonical manifest matches State Engine v0.2
- no training event at/after 2021
- no evaluation event before 2021
- no unresolved/opposite labels
- every sequence is causal and excludes onset/post-onset bars
- no Validation/Holdout read

## Next step
If memory hybrid shows useful out-of-time classification:
- inspect failure/success families without changing this model,
- preregister one richer Transition model adding Kronos and/or additional event structure,
- test whether predicted TREND_CONFIRMED cases preserve the strong onset-direction behavior observed in v0.3.

If memory fails:
- do not tune K/radius on this evaluation;
- improve state/event representation in a new protocol.

No Holdout opens automatically.
