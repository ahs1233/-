# PROTOCOL — Swing Opportunity Composition vs Conditional Path v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0049

## Purpose

Experiment 2 is an information-gain diagnostic, not a strategy optimization experiment.

Primary question:

> Inside the corrected Swing engine, do outcomes and post-entry paths of opportunities that are similar in information available BEFORE entry differ materially across historical periods after controlling for trade geometry and opportunity composition?

This experiment MUST be able to reject the current structural-change / Expansion hypothesis.

No Productive / Destructive Expansion classifier is built in this experiment.

Pristine Forward OOS remains unread.

---

# 1. Frozen source

Research branch:
research/gtglab2-measurement-audit-v01

Measurement audit reference:
- protocol: 492ad7a
- implementation: bd6b2b6
- final audit: 76b6845

Corrected primary artifacts:
- runs/measurement-execution-audit-v01/swing_corrected_shadow_trades.csv
- runs/measurement-execution-audit-v01/swing_corrected_events.csv
- runs/measurement-execution-audit-v01/swing_permission_full_event_stream.csv

Execution contract remains:
- Long entry at executable ASK.
- Exit / stop / target on BID.
- Historical quoted spread included.
- No invented broker commission or financing.
- Frozen Swing stop = anchor low - 1 H1 ATR.
- Frozen Swing target = anchor low + 4 H1 ATR.
- Frozen timeout = 864 completed M5 observations.
- Trigger remains HIGH_RECLAIM.
- Eligible State set remains {0,4,5}.
- Wave Permission remains frozen from Experiment 1.
- Health is NOT part of the primary sample.

No entry rule, threshold, State set, Wave rule, stop, target, timeout, or Health parameter may be changed.

---

# 2. Two populations

## 2.1 PRIMARY POLICY SAMPLE

Corrected Swing SHADOW trades BEFORE Health.

Purpose:
explain why the CURRENT corrected policy performs differently across periods.

Properties:
- after frozen Wave Permission;
- after frozen overlap prevention;
- executable under corrected Ask-entry / Bid-exit contract;
- each trade has a realized independent policy outcome;
- this sample is the primary inferential population.

No Health filtering is applied in the primary analysis.

Health results are reported only as a separate downstream exposure overlay after the causal diagnostic is complete.

## 2.2 SUPPORTING MARKET-EVENT SAMPLE

ALL corrected Swing state-eligible decision-time events BEFORE:
- Wave Permission,
- overlap prevention,
- Health.

Purpose:
separate:
A. whether the market opportunity population changed;
from
B. whether the policy changed what it selected.

All events remain in the composition analysis regardless of later label availability.

For outcome/path analysis in this supporting sample:
- only execution-valid, outcome-resolved events are used;
- overlapping events are allowed;
- their outcomes are independent hypothetical event outcomes;
- they MUST NOT be summed or described as portfolio PnL.

Report separately:
- all decision-time event counts;
- executable/resolved subset;
- invalid next-ASK-open events;
- censored events.

---

# 3. Time contrasts

## Primary contrast

Full calendar 2025
vs
2026-01-01 through 2026-09-30.

2026 is incomplete and must always be labeled Jan-Sep 2026.

## Calendar-balanced sensitivity

2025-01-01 through 2025-09-30
vs
2026-01-01 through 2026-09-30.

This sensitivity is mandatory.

## Consumed historical references

Report, but do not use to retune:
- 2023
- 2024
- pooled 2023-2024

A supplementary matched comparison of pooled 2023-2024 vs Jan-Sep 2026 is allowed under the SAME frozen matching recipe.

2020 is NOT a predefined productive regime.
It may be described only after correction and only within matched contexts.
Annual 2020 PnL alone is not evidence of Productive Expansion.

---

# 4. Pre-entry variables

Matching variables MUST be known no later than entry_t.

Post-entry path variables are prohibited from matching.

The variable set is deliberately small.

## 4.1 Entry Geometry variables

Primary geometry variables:

1. entry_distance_anchor_atr
   = (ASK_entry - anchor_low) / H1_ATR_at_anchor

2. entry_spread_r
   = (ASK_entry - BID_entry) / initial_risk_price

3. bars_from_anchor
   = signal_idx - anchor_idx

Report but DO NOT simultaneously match on redundant deterministic geometry:
- entry_rr
- stop_distance_atr
- target_distance_atr

These are reported because they are economically interpretable, but entry_distance_anchor_atr is the representative geometry variable.

## 4.2 Opportunity Composition variables

4. state_id
   - exact frozen State {0,4,5}

5. session_bucket_utc
   fixed before results:
   - S0: 00:00-05:59 UTC
   - S1: 06:00-11:59 UTC
   - S2: 12:00-17:59 UTC
   - S3: 18:00-23:59 UTC

6. signed_coherence_24h
   using COMPLETED H1 bars only:
   (log close_now - log close_24H1_bars_ago)
   /
   sum(abs(H1 log returns)) over prior 24 completed H1 bars

Range approximately [-1,+1].
This captures directional coherence, not unsigned efficiency.

7. expansion_level
   measured on regular completed H1 time, NOT event occupancy:
   current H1 ATR / current price,
   converted to empirical percentile against 2018-2022 TRAIN completed-H1 distribution.

8. expansion_persistence
   fraction of the previous 120 completed H1 bars for which expansion_level >= TRAIN Q75.

This is causal persistence:
only past/current completed H1 bars are used.
Final episode length is prohibited.

## 4.3 Support / novelty diagnostic

9. state_distance
   standardized Euclidean distance to the assigned frozen KMeans centroid in the frozen State feature space.

This is reported and used for a SUPPORT diagnostic.

It is NOT a matching variable in the primary recipe to avoid over-conditioning.

Define TRAIN novelty threshold:
- Q95 of centroid distance on 2018-2022 Train.

Report:
- fraction above Train Q95 by period;
- matched-result sensitivity excluding above-Q95 observations.

Do not force observations outside training support into a new State label.

---

# 5. Train-derived scales and calipers

All scaling / caliper constants are derived from 2018-2022 only.

Continuous variables are standardized by:
(value - TRAIN median) / TRAIN IQR.

If TRAIN IQR is zero, the variable is removed from distance calculation and the issue is logged.

## Geometry-only matching calipers

Exact:
- none beyond valid Swing policy membership.

Calipers:
- |entry_distance_anchor_atr difference| <= 0.50 TRAIN IQR
- |entry_spread_r difference| <= 0.50 TRAIN IQR
- |bars_from_anchor difference| <= 2 completed M5 bars

Distance:
L1 distance across the standardized geometry variables.

## Full Geometry + Composition matching

Exact:
- state_id
- session_bucket_utc

Calipers:
- geometry calipers above
- |signed_coherence_24h difference| <= 0.50 TRAIN IQR
- |expansion_level percentile difference| <= 0.20
- |expansion_persistence difference| <= 0.20

Distance:
L1 distance across standardized:
- entry_distance_anchor_atr
- entry_spread_r
- bars_from_anchor
- signed_coherence_24h
- expansion_level
- expansion_persistence

Target group:
Jan-Sep 2026.

Donor group:
2025 for the primary contrast.

Matching:
- deterministic 1:1 nearest neighbor WITHOUT replacement;
- tie-break by smallest distance, then earliest donor signal_t.

Run the same frozen recipe for:
- Jan-Sep 2025 donors vs Jan-Sep 2026 target;
- pooled 2023-2024 donors vs Jan-Sep 2026 target.

No caliper changes are allowed after seeing match coverage.

---

# 6. Common support and match-quality gates

The experiment must report:
- target opportunities;
- matched target opportunities;
- donor opportunities used;
- unmatched target fraction;
- unmatched donor fraction;
- support loss by State and session;
- distribution of match distances.

## Common-support classification

ADEQUATE:
- >= 70% of Jan-Sep 2026 target trades matched;
- >= 50 matched 2026 target trades.

LIMITED:
- 50% to <70% target coverage OR <50 matched targets.

INSUFFICIENT:
- <50% target coverage.

INSUFFICIENT support prevents a substantive conditional-path conclusion.

## Balance requirement

For every matched continuous variable report standardized mean difference (SMD).

GOOD BALANCE:
- absolute SMD <= 0.10 for every primary matching variable.

MARGINAL:
- max absolute SMD >0.10 and <=0.15.

FAILED BALANCE:
- any absolute SMD >0.15.

Exact variables must be exactly balanced by construction.

A matched PnL estimate with FAILED BALANCE cannot be used to claim a residual path effect.

Also report:
- variance ratio for each continuous variable;
- empirical CDF maximum gap as a secondary balance diagnostic.

Do not accept matching merely because pair count is large.

---

# 7. Sequential decomposition

The primary analysis is sequential.

## Stage A — RAW GAP

Difference in mean spread-inclusive pnl_r:

Delta_raw
= mean(R_2026) - mean(R_2025).

Report full 2025 and calendar-balanced Jan-Sep 2025 separately.

## Stage B — GEOMETRY-MATCHED GAP

Match only Entry Geometry variables.

Delta_geometry.

Interpretation:
how much of the raw gap remains when entry geometry is comparable.

## Stage C — GEOMETRY + COMPOSITION MATCHED GAP

Match full pre-entry variable set.

Delta_fullmatch.

Interpretation:
how much outcome difference remains among opportunities that are similar before entry.

Do not call:
Delta_raw - Delta_geometry
or
Delta_geometry - Delta_fullmatch
a formal causal decomposition.

They are descriptive attribution diagnostics under the frozen matching design.

---

# 8. Primary outcome and economic margin

Primary outcome:
spread-inclusive pnl_r per corrected Swing Shadow trade.

No Health.
No portfolio aggregation.

Primary estimate:
Delta_fullmatch
= mean matched R_2026 - mean matched donor R.

## Predeclared economically meaningful margin

delta_econ = 0.05R per trade.

Rationale:
- corrected Swing mean is approximately +0.078R/trade;
- 0.05R is large enough to alter the economic interpretation;
- it exceeds the approximate mean effect of the frozen +0.25-spread-per-side stress on corrected Swing.

This margin is frozen before Experiment 2 results.

Interpretation of the 95% dependence-aware interval for Delta_fullmatch:

MATERIAL 2026 DETERIORATION:
upper CI < -0.05R.

PRACTICAL EQUIVALENCE:
entire CI is contained within [-0.05R, +0.05R].

STATISTICALLY DIFFERENT BUT ECONOMICALLY SMALL:
CI excludes 0 but remains inside an economically small region relative to +/-0.05R.

INCONCLUSIVE:
CI spans values below -0.05R and above +0.05R,
or support/balance gates fail.

Do NOT interpret "CI includes zero" as proof that the difference disappeared.

No p-value is the primary decision criterion.

---

# 9. Dependence-aware uncertainty

Trades and events are temporally dependent.

Primary uncertainty procedure:

Moving-block bootstrap with:
- block length = 5 completed trading days;
- 2,000 bootstrap replications;
- matching is rerun inside every bootstrap replication using the SAME frozen calipers and recipe;
- percentile 95% interval reported.

Trading day is defined from the observed historical market calendar, not filled weekends.

For the supporting all-event sample:
use the same 5-trading-day block bootstrap.
Overlapping events remain allowed but are resampled in time blocks, not as IID rows.

Report:
- bootstrap successful replication count;
- failed matching replications;
- effective matched sample distribution.

If fewer than 90% of replications produce an adequate matched estimate, classify uncertainty as unstable and the conclusion as INCONCLUSIVE.

---

# 10. Post-entry path outcomes

Path variables are outcomes, NEVER matching inputs.

Use the historical M1 BID path from entry until corrected exit/timeout wherever available.

## Required path measures

1. mae_r
   minimum adverse excursion in R from ASK entry using BID path.

2. mfe_r
   maximum favorable excursion in R.

3. time_to_plus_0_5r
4. time_to_minus_0_5r
5. time_to_plus_1_0r
6. time_to_minus_1_0r

Record both:
- completed trading minutes / observations;
- event reached yes/no.

7. first_half_r_direction
   which threshold is reached first:
   +0.5R
   or
   -0.5R
   or neither.

8. reclaim_intrabar_recross
   whether BID trades back to or below anchor_high after entry before exit.

9. reclaim_close_loss
   whether a completed M5 BID close falls below anchor_high after entry before exit.

10. time_to_reclaim_close_loss

11. anchor_recross
   whether BID trades at or below anchor_low after entry before exit.

12. time_to_anchor_recross

13. stop / target / timeout incidence.

14. time_to_exit.

15. path_asymmetry
   predeclared descriptive measure:
   mfe_r - abs(mae_r).

The path analysis is secondary explanatory evidence.

Do not select whichever path metric looks strongest after the fact as the primary result.

---

# 11. Opportunity-composition reporting

Before matching, report period distributions for:

- state_id
- session_bucket_utc
- entry_distance_anchor_atr
- entry_rr
- entry_spread_r
- bars_from_anchor
- signed_coherence_24h
- expansion_level
- expansion_persistence
- state_distance / novelty
- corrected quoted spread in price and R

Report for:
- 2023
- 2024
- full 2025
- Jan-Sep 2025
- Jan-Sep 2026

Also report monthly Swing Shadow trade count and total R.

This is necessary to detect whether a small number of months / waves dominate 2026.

---

# 12. Supporting all-event analysis

For the full pre-Permission event population:

A. Compare PRE-ENTRY covariate distributions by period.

B. Report:
- total state-eligible decision events;
- permission-selected fraction;
- executable fraction;
- overlap-suppressed fraction where reconstructable;
- censored / invalid-next-Ask-open fraction.

C. For execution-valid resolved events:
apply the SAME geometry-only and full matching recipe.

These outcomes are EVENT-level hypothetical outcomes and are NOT portfolio returns.

Purpose:
determine whether:
1. the underlying market opportunity population changed;
2. Wave Permission changed selection mix;
3. the same matched event type changed outcome.

---

# 13. Health analysis

Health is excluded from primary matching and outcome estimation.

After the Shadow conclusions are frozen, report separately:

- which matched / unmatched Shadow trades Health would have blocked;
- 2025 and Jan-Sep 2026 live-exposure fraction;
- whether Health disproportionately blocks specific geometry / State / Expansion strata;
- PnL difference due to exposure removal.

Do not allow Health to redefine the primary opportunity-quality conclusion.

---

# 14. Experiment-level decision tree

The experiment must finish with exactly one primary classification.

## 1. GEOMETRY EXPLAINS MOST OF GAP

Requirements:
- raw gap is materially adverse;
- geometry matching reduces absolute gap by >= 70%;
- full composition matching does not restore a material residual deterioration;
- support and balance gates pass.

Action:
focus next research on entry / permission geometry.
Do NOT build Productive/Destructive Expansion model.

## 2. OPPORTUNITY COMPOSITION EXPLAINS MOST OF GAP

Requirements:
- geometry matching leaves material adverse gap;
- full composition matching reduces the remaining adverse gap by >= 70%;
- support and balance pass;
- no material residual conditional-path deterioration remains.

Action:
focus on Context / Permission representation.

## 3. CONDITIONAL PATH GAP REMAINS

Requirements:
- ADEQUATE support;
- GOOD or MARGINAL balance, not FAILED;
- matched Delta_fullmatch remains materially adverse under the predeclared 0.05R rule;
- path outcomes show a coherent deterioration consistent with the R result;
- result is not dependent on one month only.

Action:
a new path/regime representation is justified for research.

This does NOT prove Expansion is the cause.
Expansion competes with other path-regime explanations.

## 4. INCONCLUSIVE

Triggered by any of:
- insufficient support;
- failed balance;
- unstable bootstrap;
- interval too wide to distinguish +/-0.05R;
- conflicting primary/calendar-balanced results without a clear support explanation.

Action:
do not add model complexity.

---

# 15. Concentration / robustness checks

Mandatory, without retuning:

- leave-one-month-out 2025/2026 matched estimate;
- State-stratified matched estimate where sample allows;
- calendar-balanced Jan-Sep sensitivity;
- exclude Train-novelty >Q95 sensitivity;
- quoted-spread primary contract unchanged.

Do not introduce new slippage scenarios in this experiment.
Experiment 1 already measured cost sensitivity.

A conclusion that disappears when one month is removed must be labeled concentrated, not robust.

---

# 16. What this experiment MUST NOT do

- No Productive / Destructive classifier.
- No new entry trigger.
- No new State clustering.
- No change to Wave Permission.
- No Health tuning.
- No stop/target/timeout tuning.
- No 2025/2026 threshold tuning.
- No matching on MAE, MFE, exit kind, PnL, reclaim failure, or any post-entry information.
- No labeling 2020 productive by annual result.
- No summing overlapping supporting-event PnL as portfolio PnL.
- No treating failure to reject zero as equivalence.
- No opening Pristine Forward OOS.

---

# 17. Required artifacts

PROTOCOL_SWING_OPPORTUNITY_PATH_DIAGNOSTIC_V01.md

After execution only:
tools/swing_opportunity_path_diagnostic_v01.py

runs/swing-opportunity-path-diagnostic-v01/
- sample_reconciliation.csv
- preentry_composition.csv
- train_matching_scales.json
- primary_geometry_matches.csv
- primary_full_matches.csv
- calendar_balanced_matches.csv
- historical_reference_matches.csv
- support_balance.csv
- path_outcomes.csv
- monthly_concentration.csv
- bootstrap_summary.json
- health_overlay_diagnostic.csv
- supporting_event_analysis.csv
- summary.json

RESULT_SWING_OPPORTUNITY_PATH_DIAGNOSTIC_V01_2026-10-05.md

Logs:
- EVENTS.jsonl
- EXPERIMENTS.md
- WORKLOG.md

---

# 18. Definition of done

Experiment 2 is complete only when:

1. primary and supporting populations reconcile exactly;
2. all matching inputs are verified pre-entry;
3. Train-derived scales/calipers are frozen and logged;
4. common support and balance are reported;
5. raw, geometry-matched, and fully matched gaps are all reported;
6. dependence-aware uncertainty is reported;
7. path metrics are measured after matching, never used to match;
8. monthly concentration is quantified;
9. Health is separated from Shadow inference;
10. one of the four experiment-level classifications is assigned;
11. no 2025/2026 tuning occurred;
12. Pristine Forward OOS remained unread.

The goal is not to improve PnL.

The goal is to determine whether corrected Swing weakness is primarily:
- geometry,
- opportunity composition,
- a residual conditional-path change,
- or unresolved due to insufficient evidence.
