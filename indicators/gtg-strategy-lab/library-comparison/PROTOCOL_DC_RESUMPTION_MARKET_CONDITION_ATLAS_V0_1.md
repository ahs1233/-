# GTG DC Resumption Market-Condition Atlas v0.1

Registered 2026-10-03 before atlas clustering/results.

## Status
Exploratory diagnosis only.
This experiment MUST NOT create a trading filter or prospective candidate from the same opened history.

Historical Holdout remains locked.
Pristine Forward OOS remains sealed/undecoded.

## Purpose
Explain why the same frozen DC Correction -> Resumption + 1ATR bracket behaves differently across historical regimes.

No signal, bracket, direction, or execution rule is changed.

## Source sample
Use only the 109 eligible trades from:
- runs/dc-resumption-atr-bracket-v01-001/trades.jsonl

Join each trade signal_time to the already-open:
- extended_state_sequence.csv.gz

No Forward OOS data may be read.

## Causal condition vector at signal close
All fields are available at or before signal close.

Numeric features:
1. aligned_drift12 = direction * drift12
2. aligned_drift24 = direction * drift24
3. aligned_drift48 = direction * drift48
4. efficiency24
5. efficiency48
6. spread_atr
7. atr_week_ratio
8. prior24_width_atr
9. aligned_position = direction * (position24 - 0.5)
10. aligned_breakout = breakout_up_atr for long, breakout_down_atr for short
11. aligned_dc_count = dc_up_count for long, dc_down_count for short
12. opposing_dc_count
13. total_delay_bars
14. correction_delay_bars
15. correction_duration_bars

No C0/C1/C2, exit reason, MFE/MAE, holding time, or future outcome enters clustering.

## Scaling
RobustScaler over the full opened-history condition vectors.

This is exploratory diagnosis, not a train/eval model.

## Clustering
Fixed:
- KMeans
- k = 4 exactly
- n_init = 50
- random_state = 20261003

No k selection.
No cluster merging/splitting after outcomes.

Cluster IDs are canonicalized by ascending centroid atr_week_ratio, then ascending centroid efficiency24, so labels are deterministic.

## Diagnostics
For each cluster:
- n
- long/short counts
- centroid in original feature units
- period composition
- year composition
- C0/C1/C2 mean/trade
- C1 win rate
- TP/SL/TIMEOUT counts

Global:
- silhouette score
- feature medians by cluster
- cluster distribution by period
- C1 distribution by cluster and period

## Hypothesis-generation rule
A cluster may be called a candidate market-condition hypothesis only if:
- n >= 15 overall
- appears in at least 2 of the 3 opened periods
- descriptive C1 sign is the same in every period where n>=5

Even if this occurs:
- DO NOT trade/filter that cluster on the same opened history.
- DO NOT open Forward OOS.
- Only record the condition description for a future preregistered candidate.

## Integrity
- k fixed at 4
- no outcome field in clustering features
- no Forward OOS read
- no Historical Holdout read
- no trade filter emitted

## Decision
This experiment ends with one of:
- NO_STABLE_CONDITION_STRUCTURE
- CONDITION_HYPOTHESES_FOUND

Neither outcome authorizes live trading or Forward OOS opening.
