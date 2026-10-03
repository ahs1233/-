# Regime Atlas v0.1 — causal unsupervised market-state map

Registered 2026-10-03 before any regime fitting or future-return scoring.

## Purpose
Build a causal, interpretable state map for XAUUSD Swing/H1 after fixed-bar similarity, single-threshold Wave Memory, Multi-Scale symbolic regression, and raw Kronos failed to establish a persistent executable edge.

This phase is descriptive research, not a trading strategy. It asks:
- Are there stable market states in the causal multi-scale wave/volatility/cost representation?
- Do those states persist and transition in structured ways?
- Do future 1h/4h/12h displacement distributions differ materially by state?

No state is selected for trading in v0.1.

## Why H1 only
Scalp/M5 was consistently dominated by execution costs across prior registered experiments. This phase therefore studies H1 market structure only. That decision is fixed before regime fitting.

## Data boundary
Canonical local JForex BID/ASK M1 store only.
Absolute raw gate:
- 2018-03-01 <= raw date < 2024-03-20.
No file dated 2024-03-20 or later may be opened.
Validation and Historical Holdout remain closed.

Unsupervised regime-fit period:
- 2018-03-01 <= H1 bar < 2021-01-01.

Frozen-atlas evaluation period:
- 2021-01-01 <= anchor < 2024-03-20.

The fit stage may use only causal features, never future returns or C0/C1/C2.

## Causal H1 feature representation
Reuse the registered Multi-Scale DC implementation and its confirmation-time semantics.

Directional Change thresholds:
- 0.0025
- 0.005
- 0.01
- 0.02

Base 18 features from Multi-Scale Symbolic v0.1:
- for each threshold: direction, log age since confirmation, signed ATR-normalized last confirmed leg amplitude, log retrace ratio (16)
- drift12
- spread_atr

Add five causal context features:
19. drift48 = (BidClose[t] - BidClose[t-48]) / ATR[t]
20. atr_week_ratio = ATR[t] / median(ATR[t-167:t])
21. atr_day_week_ratio = median(ATR[t-23:t]) / median(ATR[t-167:t])
22. efficiency12 = abs(C[t]-C[t-12]) / sum(abs(diff(C[t-12:t])))
23. efficiency48 = abs(C[t]-C[t-48]) / sum(abs(diff(C[t-48:t])))

Undefined warm-up values are excluded. No future-return-derived or PnL-derived feature is allowed.

## Scaling
Fit sklearn RobustScaler on regime-fit features only.
Persist center_ and scale_ as JSON.
Evaluation features are transformed with frozen parameters only.

## Number of regimes
Candidate k values: 4, 5, 6, 7, 8.

For each k:
- sklearn KMeans
- random_state = 20261003
- n_init = 20
- max_iter = 500
- fit on all eligible regime-fit feature rows
- silhouette_score on one deterministic sample of at most 5000 fit rows, sampled once with RNG seed 20261003 and reused for every k

Choose highest silhouette score.
Tie rule: lower k.
Future returns, direction accuracy and costs may not influence k selection.

Persist:
- sklearn version
- selected k
- all silhouette scores
- scaler parameters
- cluster centers
- fit feature contract
before future-return evaluation.

## Frozen state assignment
For every eligible H1 bar in evaluation:
- compute the same causal 23 features
- transform with frozen scaler
- assign nearest frozen KMeans center by Euclidean distance

No centroid updates during evaluation.

## State structure outputs
On all contiguous H1 evaluation bars:
- occupancy per state
- one-step transition matrix
- probability of remaining in the same state
- run-length distribution per state
- per-state median raw feature profile

State IDs remain R0..R(k-1). Do not rename states using future returns.

## Future-distribution evaluation
Use deterministic non-overlapping evaluation anchors:
- first eligible evaluation bar, then next anchor only after the previous 12h outcome window has matured
- max horizon = 12 H1 bars
- every outcome path must be contiguous and end before 2024-03-20

For each state and horizon h in {1,4,12}:
target_h = (BidClose[t+h] - BidClose[t]) / ATR[t]

Report:
- n
- mean
- median
- standard deviation
- positive fraction
- 10th/25th/75th/90th percentiles
- mean lift vs unconditional evaluation mean

## Dependence-aware uncertainty
Use calendar-week block bootstrap on evaluation anchors:
- 500 bootstrap replicates
- seed 20261003
- resample whole ISO weeks with replacement
- for every state/horizon compute 95% percentile CI for mean lift vs unconditional
- if a bootstrap sample has fewer than 20 observations for a state/horizon, omit that replicate for that cell
- report valid bootstrap replicate count

This interval is exploratory, not a formal multiple-comparison-adjusted significance test.

## Descriptive screen
A state/horizon may be marked "distributionally interesting" only if:
- n >= 100,
- absolute mean lift >= 0.10 ATR,
- bootstrap 95% CI for mean lift excludes 0,
- result is not used to create or backtest a trading rule in this phase.

No ranking of states by profit is produced.

## Safety checks
Before future-distribution scoring:
- raw date gate PASS
- complete H1 aggregation PASS
- all four DC scales prefix-causal PASS
- 23-feature prefix invariance PASS
- no future return columns available to scaler/KMeans fit code path
- deterministic silhouette sample reused for all k
- frozen scaler/centers written before evaluation outcomes are computed
- selected k independent of outcomes
- evaluation target maturity and 12h non-overlap PASS
- no Validation/Holdout read

Any change to features, k range, scaling, cluster algorithm, horizons, bootstrap, or screen after reading evaluation outcomes requires a new protocol version.
