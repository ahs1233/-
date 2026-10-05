# PROTOCOL — Movement Expansion Index v0.1

Date: 2026-10-05

## Objective
Model the gradual change in gold's "freedom of movement" that began during 2025 and intensified into 2026, without using year identity as a feature.

This layer sits above the current Integrated Decision Architecture v0.1.

Architecture:

Movement Expansion State
-> existing Regime Permission / Static State
-> Control Transfer / Entry
-> existing Regime Health
-> expansion-aware risk

## Source events
Use the already frozen causal event-feature streams from State Evolution v0.1:
- Scalper eligible events
- Swing eligible events

Create one chronological context stream by taking the union of event timestamps and deduplicating timestamps.

Only features known at each event close are used.

## Core movement features
At each context event:

1. H1 ATR as percent of price:
   atr_pct = 100 * atr_h1 / anchor_low

2. 24H range as percent of price:
   range24_pct = atr_pct * range_24h_atr

3. 72H range as percent of price:
   range72_pct = atr_pct * range_72h_atr

4. Local volatility ratio:
   vol_ratio = vol_ratio_1h_24h

## Smoothed level
Use causal trailing windows only:
- median atr_pct over prior 7 calendar days including current event
- median range24_pct over prior 7 days
- median range72_pct over prior 7 days
- volatility-of-volatility proxy = standard deviation of log(vol_ratio) over prior 30 days

## Expansion velocity
For atr_pct, range24_pct, range72_pct:
- current trailing-30-day median
- previous 30-day median from [t-60d, t-30d)
- velocity component = log(current_30d / previous_30d)

velocity_raw = mean of available three velocity components

## Expansion acceleration
acceleration_raw =
current velocity_raw
minus velocity_raw approximately 30 days earlier.

## Train-only normalization
Use only context observations dated 2018-03-01 through 2022-12-31.

For each level feature, velocity_raw, and acceleration_raw:
- center = Train median
- scale = Train IQR / 1.349
- if scale is zero, use Train MAD * 1.4826
- robust z scores are clipped to [-5, +5]

level_z = mean robust-z of:
- log(7d median atr_pct)
- log(7d median range24_pct)
- log(7d median range72_pct)
- log(1 + 30d volatility-of-volatility proxy)

Expansion Index =
level_z
+ 0.50 * z(velocity_raw)
+ 0.25 * z(acceleration_raw)

No 2023-2026 observation is used to choose normalization or state thresholds.

## State thresholds
From the TRAIN Expansion Index distribution only:

NORMAL:
- index <= Train Q50

EARLY_EXPANSION:
- Q50 < index <= Q70

EXPANDING:
- Q70 < index <= Q85

HIGH_EXPANSION:
- Q85 < index <= Q95

EXTREME:
- index > Q95

COOLDOWN override:
- current raw state is NORMAL / EARLY / EXPANDING,
- velocity_raw < 0,
- and at least one HIGH_EXPANSION or EXTREME context was observed during the previous 30 days.

## Existing architecture
Do not change:
- eligible static states
- entry triggers
- Control Transfer threshold
- Wave Permission thresholds
- stops / targets / timeouts
- trailing-20 Regime Health brake

## Frozen expansion-aware risk map

### Scalper
NORMAL: 1.00R risk
EARLY_EXPANSION: 1.00R
EXPANDING: 0.90R
HIGH_EXPANSION: 0.75R
EXTREME: 0.50R
COOLDOWN: 0.75R

### Swing
NORMAL: 1.00R risk
EARLY_EXPANSION: 1.00R
EXPANDING: 0.75R
HIGH_EXPANSION: 0.50R
EXTREME: 0.00R (no live Swing risk on the first-reclaim architecture)
COOLDOWN: 0.50R

This map is fixed before viewing expansion-aware PnL.

## Trade mapping
For each already-live Integrated Architecture trade:
- assign the latest Expansion context at or before signal_t;
- multiply pnl_r by the frozen expansion risk multiplier.

No outcome is used to choose the state or multiplier.

## Evaluation
Report:
1. Train-only thresholds.
2. State distribution year by year.
3. Monthly Expansion Index / state progression for 2024-2026.
4. Baseline Integrated Architecture vs Expansion-aware:
   - trades with nonzero risk
   - effective risk-weighted trade count
   - total weighted R
   - PF
   - max drawdown
   - annual results
5. Scalper and Swing separately.
6. 2025 and 2026 explicitly.
7. Whether the index starts rising during 2025 before 2026.

## Research discipline
- No parameter changes after results.
- 2025-2026 remain consumed diagnostic history.
- Pristine Forward OOS remains unread.
