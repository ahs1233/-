# PROTOCOL — Overlap-Population Contrast v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0051

## Objective

Estimate the corrected Swing period difference only inside the region of pre-entry covariate overlap, without pretending that the estimate represents all 2026 opportunities.

Frozen question:

> Among corrected Swing opportunities that have comparable representation in 2025 and Jan-Sep 2026, does an economically meaningful difference in net R remain after balancing the same pre-entry Geometry + Composition variables used in Experiment 2?

This is a diagnostic period contrast.

It is NOT:
- a causal effect of calendar year,
- a trading rule,
- a new Permission model,
- a Productive / Destructive Expansion model,
- or an estimate for all 2026 opportunities.

The estimand is the Average Treatment Effect in the Overlap population (ATO), where "treatment" is only the diagnostic period label 2026.

Pristine Forward OOS remains unread.

---

# 1. Frozen source

Base commit:
8c637d0

Relevant completed research:
- Experiment 1 Measurement & Execution Audit
- Experiment 2 Swing Opportunity Composition vs Conditional Path v0.1
- Experiment 3 Common-Support Failure Audit v0.1
- maximum-cardinality verification on the exact Experiment 3 compatibility networks

Key prior facts carried forward:

1. Experiment 2 primary Full matching:
   - 18 greedy pairs / 105 target trades
   - insufficient support and failed balance
   - final classification INCONCLUSIVE

2. Experiment 3:
   - primary support failure classified DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE
   - support-loss attribution explains comparison failure, NOT PnL loss

3. Maximum-cardinality verification:
   - Primary Full: greedy 18 vs maximum 20
   - Supporting-event Full: greedy 128 vs maximum 134
   - therefore final Full-support failure is mostly sparse admissible overlap, not greedy allocator inefficiency

4. Expansion Level's small contribution to support loss does NOT imply it is economically irrelevant to PnL.

5. 2025 being descriptively closer to 2026 than 2023-2024 is consistent with, but does not prove, a gradual market transition.

---

# 2. Primary and supporting samples

## 2.1 PRIMARY

Corrected Swing Shadow trades BEFORE Health.

Primary contrast:
- donor/control period: full calendar 2025
- target/treated period: 2026-01-01 through 2026-09-30

Expected counts:
- 2025 n = 122
- Jan-Sep 2026 n = 105

Outcome:
- corrected spread-inclusive pnl_r under the fixed Swing execution contract from Experiment 1

Health is excluded from the primary estimand.

## 2.2 MANDATORY CALENDAR-BALANCED SENSITIVITY

- donor: Jan-Sep 2025
- target: Jan-Sep 2026

Expected counts:
- 2025 Jan-Sep n = 97
- 2026 Jan-Sep n = 105

Same model recipe, same covariates, same diagnostics, same economic margin.

## 2.3 SUPPORTING EVENT SAMPLE

Execution-valid, outcome-resolved corrected Swing state-eligible events BEFORE:
- Wave Permission
- overlap prevention
- Health

Primary event contrast:
- full 2025 vs Jan-Sep 2026

Calendar-balanced event sensitivity:
- Jan-Sep 2025 vs Jan-Sep 2026

These are overlapping hypothetical event outcomes.
They are NOT portfolio PnL.

The supporting event sample cannot override a failed PRIMARY quality gate.

---

# 3. Covariates — frozen, no additions

Use exactly the same pre-entry Geometry + Composition information as Experiment 2.

Continuous:
1. entry_distance_anchor_atr
2. entry_spread_r
3. bars_from_anchor
4. signed_coherence_24h
5. expansion_level
6. expansion_persistence

Categorical:
7. state_id in {0,4,5}
8. session_bucket_utc in {S0,S1,S2,S3}

Do NOT add:
- state_distance
- novelty flag
- path variables
- outcomes
- month/year as a predictor
- interactions
- splines
- new indicators

The 2026 indicator is the dependent label of the propensity model only.

It is NOT a trading feature.

---

# 4. Frozen preprocessing

Continuous model inputs are standardized using the already-frozen Experiment 2 TRAIN (2018-2022) median and IQR values from:

runs/swing-opportunity-path-diagnostic-v01/train_matching_scales.json

No 2025/2026-derived scaling.

Categorical encoding:
- State reference = 0
- State indicators = 4, 5
- Session reference = S0
- Session indicators = S1, S2, S3

Fixed model design columns:

- z_entry_distance_anchor_atr
- z_entry_spread_r
- z_bars_from_anchor
- z_signed_coherence_24h
- z_expansion_level
- z_expansion_persistence
- state_4
- state_5
- session_S1
- session_S2
- session_S3

Plus intercept.

Rows missing any required pre-entry covariate are excluded before propensity fitting and reconciled explicitly.

No imputation is introduced in Experiment 4.

---

# 5. Propensity model — ONE frozen model

Model:
unpenalized binary logistic regression with intercept and main effects only.

Implementation target:
sklearn LogisticRegression(
    penalty=None,
    solver="lbfgs",
    fit_intercept=True,
    max_iter=2000,
    tol=1e-10,
    class_weight=None
)

Label:
T = 1 for Jan-Sep 2026
T = 0 for donor period

No:
- hyperparameter search
- regularization search
- cross-validation model selection
- alternate classifiers
- interaction terms
- post-result model replacement

If the fixed model fails to converge, the affected comparison is INCONCLUSIVE.
Do not switch solvers/models to rescue it.

Predicted probability:
e(X) = P(T=1 | X)

No propensity trimming is applied.

Numerical probabilities may be clipped only to [1e-12, 1-1e-12] for safe arithmetic; clipping must be logged.

---

# 6. Overlap weights

For 2026 target observations:
w_i = 1 - e(X_i)

For donor-period observations:
w_i = e(X_i)

Weighted means are normalized separately within each period.

Primary estimand:

Delta_OW
=
weighted_mean(R_2026)
-
weighted_mean(R_2025)

This is the period difference for the empirical overlap population induced by the frozen propensity model.

It is NOT the average difference for all 2026 opportunities.

---

# 7. Represented-vs-unrepresented 2026 diagnostics

Overlap weighting does not create support where none exists.

For the 2026 target sample report:

- raw n
- complete-case n
- overlap-weight ESS
- ESS / raw-n ratio
- mean overlap weight
- median overlap weight
- P10 / P25 / P75 / P90 weight
- fraction with e(X) >= 0.90
- fraction with e(X) >= 0.95
- fraction with overlap weight <= 0.10
- fraction with overlap weight <= 0.05
- normalized overlap-weight mass carried by observations with e(X) >= 0.90
- normalized overlap-weight mass carried by observations with e(X) >= 0.95

Interpretation:
- e >= .90 / .95 marks opportunities strongly characteristic of 2026 under the diagnostic model and weakly represented in the donor period.
- These thresholds are descriptive support diagnostics only.
- No row is trimmed because of them.

The report must explicitly state that low-weight 2026 opportunities are underrepresented in the ATO result.

---

# 8. Balance diagnostics and gate

Balance is assessed AFTER overlap weighting.

For every fixed model design column report:
- raw donor mean
- raw target mean
- weighted donor mean
- weighted target mean
- raw standardized mean difference
- weighted standardized mean difference

SMD denominator:
pooled unweighted pre-weighting standard deviation from the two period samples.

Binary indicator columns use the same formula.

Primary balance gate:

PASS if:
- max absolute weighted SMD <= 0.10 across ALL fixed design columns

FAIL if:
- any absolute weighted SMD > 0.10

Also report weighted empirical-CDF maximum gap for the six continuous covariates as a secondary distribution diagnostic.

A good propensity-score overlap plot does NOT substitute for actual covariate balance.

If balance FAILS:
primary Experiment 4 conclusion = INCONCLUSIVE.

---

# 9. Effective sample size gate

For each period:

ESS = (sum w)^2 / sum(w^2)

Primary ESS gate requires BOTH groups to satisfy:

- ESS >= 50
AND
- ESS / raw complete-case n >= 0.40

If either group fails:
classification = INCONCLUSIVE.

For supporting events the same thresholds apply.

ESS is reported separately for every contrast.

---

# 10. Temporal weight concentration

For each period, aggregate normalized overlap weight by calendar month.

Report:
- month weight share
- maximum single-month weight share
- monthly weight Herfindahl index (HHI)

Primary concentration gate:

PASS if maximum single-month weight share <= 0.25 in BOTH periods.

If >0.25 in either period:
classification = INCONCLUSIVE due to temporal concentration.

This gate prevents a nominally large ESS from being driven by a narrow calendar pocket.

Mandatory robustness:
leave one calendar month out at a time and refit the propensity model from scratch.
Report the resulting Delta_OW point estimate.

This leave-one-month-out analysis is robustness only; it does not replace the primary bootstrap CI.

---

# 11. Primary outcome

Primary outcome:
corrected spread-inclusive pnl_r per Swing Shadow trade.

No Health.

No portfolio aggregation.

No management changes.

No new cost model.

Use the corrected execution contract already frozen by Experiment 1.

Primary point estimate:
Delta_OW = 2026 weighted mean R - donor weighted mean R

Economic margin remains frozen:

delta_econ = 0.05R per trade

It MUST NOT change after results.

---

# 12. Dependence-aware uncertainty

Moving-block bootstrap:

- 5 observed trading days per block
- 2,000 replications
- donor and target periods resampled separately
- propensity model REFIT inside every bootstrap replication
- overlap weights recomputed inside every replication
- Delta_OW recomputed inside every replication
- percentile 95% interval

Fixed preprocessing scales/categories remain unchanged.

Report:
- requested replications
- successful model fits
- failed fits
- successful fraction
- bootstrap CI
- bootstrap mean
- P10/P50/P90 of group ESS
- fraction of bootstrap replications satisfying the ESS gate
- fraction satisfying the balance gate

Bootstrap stability gate:
- >=90% of requested replications must return a valid fitted estimate

If <90%:
classification = INCONCLUSIVE.

The point-estimate quality gates are authoritative.
Bootstrap balance/ESS pass fractions are reported as stability diagnostics.

---

# 13. Final decision rule

The PRIMARY classification is evaluated in this order.

## Step 1 — Quality gates

If ANY fails:
- propensity model convergence
- balance gate
- ESS gate
- temporal concentration gate
- bootstrap >=90% success

then:

**INCONCLUSIVE**

No economic classification is allowed.

## Step 2 — Economic interval

If all quality gates pass:

### RESIDUAL_OVERLAP_DETERIORATION

if:
upper 95% CI < -0.05R

Interpretation:
2026 remains economically worse inside the measured overlap population.

This does NOT imply all 2026 opportunities are worse.

### OVERLAP_ECONOMIC_EQUIVALENCE

if:
entire 95% CI lies inside [-0.05R, +0.05R]

Interpretation:
within the measured overlap population, the period difference is economically small under the frozen margin.

This does NOT establish equivalence for low-overlap 2026 opportunities.

### INCONCLUSIVE

otherwise:
- interval includes economically meaningful negative and/or positive values
- or the estimate is too uncertain for either decision above

If the interval lies entirely above +0.05R, report the positive direction transparently but retain the preregistered primary class as INCONCLUSIVE with respect to the deterioration/equivalence question.

No p-value drives the decision.

---

# 14. Supporting-event interpretation

Repeat the same frozen overlap-weighting estimator for the supporting event sample.

Report separately:
- balance
- ESS
- overlap diagnostics
- weighted Delta R
- 95% block-bootstrap interval
- calendar-balanced sensitivity

The supporting sample is diagnostic.

It CANNOT upgrade a failed PRIMARY result.

If supporting events have materially stronger ESS/overlap than Shadow:
state that policy selection / smaller Shadow sample plausibly contributes to the primary information limit.

Do NOT call that causal.

---

# 15. What Experiment 4 can establish

Potentially:

1. A residual negative period difference exists among opportunities represented in both periods.
2. The overlap population is economically equivalent within +/-0.05R.
3. Available overlap is still too weak / imbalanced / concentrated / uncertain to answer.

It also quantifies how much of 2026 receives little overlap weight.

---

# 16. What Experiment 4 cannot establish

It cannot establish:

- the cause of any residual difference
- that Expansion caused losses
- that Session caused losses
- that Persistence caused losses
- the average effect for all 2026 opportunities
- profitability of a future trading rule
- a Productive / Destructive regime classifier
- a Permission rule
- a deployable edge

Period label is diagnostic only.

---

# 17. Prohibited actions

- No propensity-model search
- No alternate weighting estimator
- No trimming to improve balance
- No caliper matching
- No donor reuse comparison
- No new features
- No interactions
- No polynomial terms
- No post-entry variables
- No Health tuning
- No stop/target tuning
- No 2025/2026 threshold tuning
- No opening Pristine OOS
- No selecting a favorable subset after seeing PnL
- No interpreting support-attribution percentages as PnL attribution

---

# 18. Required artifacts

PROTOCOL_OVERLAP_POPULATION_CONTRAST_V01.md

After protocol commit:
tools/overlap_population_contrast_v01.py

runs/overlap-population-contrast-v01/
- sample_reconciliation.csv
- primary_weights.csv
- seasonal_weights.csv
- supporting_event_weights.csv
- balance_diagnostics.csv
- overlap_diagnostics.csv
- monthly_weight_concentration.csv
- leave_one_month_out.csv
- bootstrap_summary.json
- propensity_coefficients.csv
- comparison_summary.csv
- summary.json

RESULT_OVERLAP_POPULATION_CONTRAST_V01_2026-10-05.md

Logs:
- EVENTS.jsonl
- EXPERIMENTS.md
- WORKLOG.md

---

# 19. Definition of done

Experiment 4 is complete only when:

1. primary counts reconcile to 122 / 105;
2. calendar-balanced counts reconcile to 97 / 105;
3. same Geometry + Composition variables are used and no others;
4. only the one frozen unpenalized logistic propensity model is used;
5. outcomes are not used to fit weights;
6. overlap weights follow:
   - target 2026 = 1-e(X)
   - donor = e(X);
7. weighted balance is reported for every design column;
8. target/donor ESS are reported;
9. low-overlap 2026 fractions and weight mass are reported;
10. month-weight concentration is reported;
11. 2,000 five-trading-day block bootstraps refit the model each time;
12. calendar-balanced sensitivity is complete;
13. supporting-event analysis is separate;
14. one primary class is assigned:
    - RESIDUAL_OVERLAP_DETERIORATION
    - OVERLAP_ECONOMIC_EQUIVALENCE
    - INCONCLUSIVE
15. the report states explicitly which population the estimate represents;
16. Productive / Destructive Expansion remains deferred;
17. Pristine Forward OOS remains unread.

The goal is not to recover statistical significance.

The goal is to obtain the narrowest defensible estimate of the 2025-vs-2026 Swing difference where the two periods actually overlap.
