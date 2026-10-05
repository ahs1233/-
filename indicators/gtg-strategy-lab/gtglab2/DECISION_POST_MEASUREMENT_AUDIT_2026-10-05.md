# DECISION — Post Measurement Audit Research Direction

Date: 2026-10-05

## Status after Experiment 1

- Execution defect: CONFIRMED by Measurement & Execution Audit v0.1.
- Current Scalper architecture: PARK / NO-GO for further development at this stage.
- Swing: RETAIN FOR FURTHER RESEARCH ONLY; not a proven edge.
- Cause of 2026 Swing weakness: UNRESOLVED.
- Productive / Destructive Expansion model: DEFERRED until Experiment 2.
- Pristine Forward OOS: REMAINS SEALED.

## Interpretation discipline

Swing surviving the audit does not prove a deployable edge. Continued research is justified, but promotion is not.

Required before stronger claims:
- Swing-only yearly distribution,
- explicit 2025 and 2026 Swing trade counts,
- uncertainty intervals,
- concentration by months / episodes,
- execution-cost sensitivity.

Scalper remains parked even though ranking AUC is non-trivial because ranking quality did not translate into executable expectancy after quoted spread.

## 2020 correction

Withdraw the prior informal use of 2020 as a proven "Productive Expansion" example.

Any future 2020 comparison must use corrected Swing results inside matched expansion contexts. Annual PnL alone does not define a regime as productive.

## Attribution interpretation

The audit attribution path is bundled, not an independent causal decomposition of every defect.

The change from +108.11R to +5.51R demonstrates that executable pricing materially changes the old live signal set, but it jointly includes:
- ASK-entry instead of BID-entry,
- invalidation of 47 old signals,
- changed risk denominator where entry changes.

The later recovery after corrected refitting is also a bundle of measurement/model corrections. Do not assign separate R contributions to true-H1, event-stream repair, feature normalization, or split-boundary repair without a dedicated ablation.

No such ablation is required before Experiment 2 unless a later decision depends on it.

## 2026 interpretation

Corrected 2026 remaining negative keeps structural-change hypotheses open but does not prove them.

Open alternatives:
- opportunity composition changed,
- entry geometry deteriorated,
- a small number of loss waves dominated,
- matched opportunities behaved similarly but occurred at different frequencies,
- conditional post-entry path changed,
- Health changed exposure rather than underlying edge.

The near-flat corrected Scalper result in 2026 must not be interpreted as engine improvement without separating Health exposure effects.

## Experiment 2 research question

Inside the corrected Swing engine, do outcomes and post-entry paths of opportunities that are similar in PRE-ENTRY information differ materially across historical periods after controlling for trade geometry and opportunity composition?

Experiment 2 starts from corrected SWING SHADOW before Health.
Health is evaluated separately afterward.

## Experiment 2 decomposition

### 1. Entry Geometry
Pre-entry comparison variables:
- Entry RR,
- entry distance from anchor low / ATR,
- stop distance / ATR,
- quoted spread cost in R,
- recovery distance consumed before entry,
- bars from anchor / episode age.

### 2. Opportunity Composition
Pre-entry context only:
- frozen Market State,
- larger directional context,
- Expansion level,
- causal Expansion persistence if available,
- session / market-time bucket,
- episode age,
- support / novelty where available.

### 3. Conditional Path Change
This is the OUTCOME to explain, never a matching variable.

Measure:
- MAE before MFE,
- reclaim loss / recross timing,
- time to stop,
- time to target,
- time to partial progress,
- anchor recrossing,
- stop / target / timeout incidence,
- path asymmetry.

## Comparison periods

Do not reduce Experiment 2 to a 2025-vs-2026 story.

Use:
- 2018-2022 as training / measurement-design source where needed,
- 2023-2024 as additional consumed historical reference,
- 2025 and 2026 as diagnostic comparison periods.

2020 may be inspected only after correction and only within matched contexts.

## Matching / support discipline

Matching variables must be available before entry.

Report:
- common-support coverage,
- unmatched fraction,
- effective sample size,
- temporal clustering,
- uncertainty with block / episode-aware resampling.

If common support is poor, conclude INCONCLUSIVE rather than forcing extrapolation.

## Experiment 2 decision logic

1. GEOMETRY EXPLAINS MOST OF GAP
   -> focus on execution / permission geometry; do not build Productive/Destructive regime model.

2. COMPOSITION EXPLAINS MOST OF GAP
   -> focus on permission / context selection.

3. CONDITIONAL PATH GAP REMAINS AFTER MATCHING
   -> Productive / Destructive Expansion or another path-regime representation becomes justified.

4. INSUFFICIENT COMMON SUPPORT / HIGH UNCERTAINTY
   -> do not add model complexity.

## Promotion policy

No promotion decision from Experiment 2.
Pristine Forward OOS remains unopened.
Experiment 2 is an information-gain experiment, not a PnL optimization experiment.
