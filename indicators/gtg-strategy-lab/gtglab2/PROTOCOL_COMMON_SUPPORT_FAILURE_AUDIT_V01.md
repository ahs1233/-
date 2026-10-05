# PROTOCOL — Common-Support Failure Audit v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0050

## Objective

Explain why common support in Experiment 2 collapsed from:

- Geometry matched: 82 / 105 Jan-Sep 2026 target Swing Shadow trades
to
- Geometry + Composition matched: 18 / 105

without using PnL or post-entry outcomes and without relaxing any Experiment 2 matching rule.

Primary question:

> Which preregistered pre-entry composition dimension, or interaction among dimensions, removes comparable historical support after Geometry has already been imposed?

This is a descriptive / distributional audit.

It is NOT:
- a profitability test,
- a new matching estimator,
- a strategy optimization,
- a Productive / Destructive Expansion model,
- or a rerun of Experiment 2 with looser conditions.

Pristine Forward OOS remains unread.

---

## 1. Frozen source

Base commit:
8b50a67 — completed Experiment 2.

Primary artifacts:
- runs/swing-opportunity-path-diagnostic-v01/summary.json
- runs/swing-opportunity-path-diagnostic-v01/train_matching_scales.json
- runs/measurement-execution-audit-v01/swing_corrected_shadow_trades.csv
- runs/measurement-execution-audit-v01/swing_corrected_events.csv
- runs/swing-opportunity-path-diagnostic-v01/preentry_composition.csv
- runs/swing-opportunity-path-diagnostic-v01/supporting_event_composition.csv

Experiment 2 matching scales/calipers are frozen and reused verbatim.

No threshold, caliper, variable definition, State definition, Session definition, Expansion definition, or period boundary may be changed.

---

## 2. Outcome-blind requirement

Experiment 3 must not use:
- pnl_r,
- win/loss labels,
- MAE/MFE,
- stop/target/timeout outcome,
- Health result,
- any post-entry path variable.

The implementation must drop / ignore these columns before support calculations.

The output may reference Experiment 2's published support counts only for reconciliation.

No outcome table is produced.

---

## 3. Populations

### 3.1 PRIMARY

Corrected Swing Shadow pre-entry opportunities used by Experiment 2.

Primary contrast:
- donor: full calendar 2025
- target: Jan-Sep 2026

Reconciliation targets from Experiment 2:
- donor n = 122
- target n = 105
- Geometry greedy matched = 82
- Full greedy matched = 18

### 3.2 MANDATORY SENSITIVITY

Calendar-balanced:
- donor: Jan-Sep 2025
- target: Jan-Sep 2026

Expected Experiment 2 reconciliation:
- donor n = 97
- target n = 105
- Geometry matched = 60
- Full matched = 12

### 3.3 HISTORICAL REFERENCE

- donor: pooled 2023-2024
- target: Jan-Sep 2026

Expected:
- donor n = 289
- target n = 105
- Geometry matched = 85
- Full matched = 2

### 3.4 SUPPORTING MARKET-EVENT SAMPLE

All execution-valid corrected Swing state-eligible decision events before Wave Permission / overlap prevention.

Purpose:
test whether support collapse is mainly a small-policy-sample phenomenon or is also visible in the larger opportunity population.

Overlapping events are permitted because no PnL is used.

Report separately from the PRIMARY sample.

---

## 4. Frozen constraints from Experiment 2

### Geometry base G

1. entry_distance_anchor_atr:
   absolute difference <= 0.50 * TRAIN IQR

TRAIN IQR:
0.4691033713615721

2. entry_spread_r:
   absolute difference <= 0.50 * TRAIN IQR

TRAIN IQR:
0.03016173381728117

3. bars_from_anchor:
   absolute difference <= 2 completed M5 bars

Geometry uses the same deterministic 1:1 nearest-neighbor, without replacement, target processed by signal_t, donor tie-break by earliest signal_t / row_id.

### Composition dimensions

S = State
- exact state_id

J = Session
- exact session_bucket_utc

C = Signed Coherence
- absolute signed_coherence_24h difference <= 0.50 * TRAIN IQR
- TRAIN IQR = 0.337584234614603

E = Expansion Level
- absolute expansion_level percentile difference <= 0.20

P = Expansion Persistence
- absolute expansion_persistence difference <= 0.20

No state_distance / novelty constraint is added to the primary support definition.

---

## 5. Canonical sequential audit

Apply constraints cumulatively in this exact fixed order:

G
G + S
G + S + J
G + S + J + C
G + S + J + C + E
G + S + J + C + E + P

For every stage report BOTH:

### A. Feasibility support — before donor allocation

For each target:
does at least one donor satisfy all current constraints?

Report:
- target total
- feasible target count
- feasible target coverage
- donor count with at least one compatible target
- total compatible donor-target edges
- edge density
- candidates per target:
  - zero fraction
  - median
  - P10
  - P90
  - max

This distinguishes absence of comparable donors from competition for the same donors.

### B. Frozen greedy 1:1 support

Using the exact Experiment 2 matching order / no-replacement rule:

Report:
- matched pairs
- target coverage
- donor coverage
- unique target count
- unique donor count
- unmatched target count
- allocation loss:
  feasible targets - greedy matched targets

Do not alter tie-breaks or allow donor reuse.

---

## 6. Attrition attribution in the canonical order

At every stage after G report:

- absolute feasible-target loss from the previous stage
- percentage-point target coverage loss
- absolute greedy-pair loss
- percentage-point greedy target-coverage loss
- identities of targets first losing all feasible donors at that stage
- State / Session distribution of those lost targets

These are ORDER-DEPENDENT descriptive losses.

They must not be called independent causal contributions.

---

## 7. Order-robust support-loss attribution

Because sequential attribution depends on order, calculate an outcome-blind order-robust diagnostic.

Composition set:
{S, J, C, E, P}

Evaluate all 5! = 120 permutations.

For every subset reached in each permutation:
- calculate feasible target coverage after G plus that subset;
- calculate frozen greedy matched target coverage after G plus that subset.

For each dimension:
compute its mean marginal coverage loss across all 120 permutations.

This is reported as:

**Shapley-style support-loss attribution**

for:
1. feasibility coverage;
2. greedy matched coverage.

It is descriptive support attribution, not economic causation.

The five contributions should reconcile numerically, up to floating precision, to:

Geometry coverage - Full coverage.

No PnL or outcome is used.

---

## 8. Leave-one-constraint-out diagnostic

Starting from FULL = G+S+J+C+E+P:

Recompute support after removing exactly one composition constraint at a time:

- FULL minus State
- FULL minus Session
- FULL minus Coherence
- FULL minus Expansion Level
- FULL minus Persistence

Report:
- feasible target coverage restored
- greedy target coverage restored
- matched pair count restored

This does NOT define a new trading/matching rule.

It is only a bottleneck diagnostic.

No result from this section may replace Experiment 2.

---

## 9. Univariate / categorical distribution diagnostics

Without outcomes, report period distributions for the five composition dimensions.

### State / Session
- counts and proportions
- joint State x Session table

### Signed coherence / Expansion Level / Persistence
For each period:
- mean
- median
- P10 / P25 / P75 / P90
- IQR
- fraction outside donor min/max
- empirical overlap coefficient using fixed TRAIN-derived bins

Bins must be fixed before reading period results:

- signed_coherence_24h:
  deciles of TRAIN 2018-2022 distribution
- expansion_level:
  [0,.10,.20,...,1.00]
- expansion_persistence:
  [0,.10,.20,...,1.00]

No adaptive binning from 2025/2026.

---

## 10. Classification

Experiment 3 ends with one PRIMARY support classification.

### A. CONCENTRATED BOTTLENECK

If the top 1 or top 2 composition dimensions account for >=70% of the total Shapley-style feasibility support loss from Geometry to Full,
AND the leave-one-out diagnostic for one of those dimensions restores >=20 percentage points of target feasibility coverage.

Interpretation:
one or two dimensions dominate common-support collapse.

### B. DISTRIBUTED MULTIDIMENSIONAL COLLAPSE

If:
- top 2 dimensions account for <70% of Shapley-style feasibility loss,
AND
- at least 3 dimensions each account for >=10% of total feasibility loss.

Interpretation:
support erodes across multiple composition dimensions rather than one dominant gate.

### C. DONOR COMPETITION / ALLOCATION BOTTLENECK

If:
- Full feasibility target coverage >=50%
but
- Full greedy target coverage <50%
and
- allocation loss >=20 percentage points.

Interpretation:
many 2026 targets have compatible donors, but too many compete for the same donors under 1:1 no-replacement allocation.

### D. MIXED / UNRESOLVED SUPPORT FAILURE

If none of A/B/C applies cleanly.

No profitability conclusion follows from any class.

---

## 11. Cross-sample interpretation

PRIMARY classification is authoritative.

Calendar-balanced, 2023-2024, and supporting-event samples are diagnostics.

Report whether the same top bottleneck dimensions recur.

If the larger supporting-event sample materially changes the support pattern, state that sample size / policy selection is a plausible contributor.

Do not claim that larger sample size proves or disproves market regime change.

---

## 12. What must NOT happen

- No PnL analysis.
- No new match threshold.
- No caliper relaxation.
- No donor reuse in the greedy metric.
- No weighting / propensity / overlap estimator.
- No representation learning.
- No Productive / Destructive model.
- No post-entry variables.
- No OOS opening.
- No selecting a different constraint order after seeing results.
- No treating Shapley-style support loss as causal economic importance.

---

## 13. Required artifacts

PROTOCOL_COMMON_SUPPORT_FAILURE_AUDIT_V01.md

After protocol commit:
tools/common_support_failure_audit_v01.py

runs/common-support-failure-audit-v01/
- sample_reconciliation.csv
- canonical_support_curve.csv
- canonical_attrition.csv
- target_loss_stage.csv
- shapley_support_attribution.csv
- leave_one_constraint_out.csv
- distribution_diagnostics.csv
- state_session_tables.csv
- supporting_event_support_curve.csv
- historical_support_curves.csv
- summary.json

RESULT_COMMON_SUPPORT_FAILURE_AUDIT_V01_2026-10-05.md

Logs:
- EVENTS.jsonl
- EXPERIMENTS.md
- WORKLOG.md

---

## 14. Definition of done

Experiment 3 is complete when:

1. no outcome variable was used;
2. primary 122 / 105 sample reconciles;
3. Geometry pair count reproduces 82;
4. Full pair count reproduces 18;
5. calendar-balanced and historical counts reproduce Experiment 2;
6. feasibility support and greedy support are separately reported;
7. canonical attrition is reported;
8. all 120 order permutations are evaluated;
9. Shapley-style losses reconcile to Geometry-to-Full support loss;
10. leave-one-constraint-out is reported;
11. larger supporting-event sample is reported separately;
12. one support classification A/B/C/D is assigned;
13. no matching threshold changed;
14. Productive / Destructive Expansion remains deferred;
15. Pristine Forward OOS remains unread.

The sole goal is:

> understand why comparable support disappeared before asking again why 2026 lost money.
