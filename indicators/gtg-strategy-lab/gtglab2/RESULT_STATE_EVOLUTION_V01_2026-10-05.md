# RESULT — State Evolution Engine v0.1

Date: 2026-10-05

## Objective
Test whether reading how market state evolves before entry is more useful than a static state-at-entry label.

Frozen components:
- Scalper: HIGHER_LOW_BREAK, states 0/5, FIXED management
- Swing: HIGH_RECLAIM, states 0/4/5, FIXED management

Train: 2018-2022
Validation: 2023-2024
2025-2026: consumed diagnostic only
Pristine Forward OOS remained unread.

## Scalper
AUC:
- Train 0.651
- Validation 0.619
- Consumed 2025-2026 0.666
- Threshold 0.653844 from Train 60th percentile

Execution:
Train: 925 trades, +32.920R, mean +0.03559R, PF 1.145, DD -8.492R, win 74.38%
Validation: 376 trades, +0.594R, mean +0.00158R, PF 1.006, DD -7.439R, win 72.87%
Consumed 2025-2026: 300 trades, +9.789R, mean +0.03263R, PF 1.136, DD -13.544R, win 75.67%

Yearly:
2018 -1.253R PF 0.970
2019 +5.390R PF 1.117
2020 +8.267R PF 1.184
2021 +22.219R PF 1.487
2022 -1.704R PF 0.966
2023 +2.795R PF 1.058
2024 -2.201R PF 0.958
2025 +10.506R PF 1.337
2026 -0.717R PF 0.983

Static baseline Validation was +12.872R PF 1.051, mean +0.01795R.
Evolution Validation was only +0.594R PF 1.006, mean +0.00158R.

Therefore the preregistered improvement criterion failed even though the consumed 2026 loss was nearly neutralized.

Strongest positive features:
- recovery from anchor low / ATR
- M5 60-minute drift acceleration
- bars from anchor
- position inside 120H range

Strongest negative features:
- M15 1H acceleration
- fraction of negative M5 closes over 12H
- recent 24H return in this bottom-entry context

Decision: retain for research, do not promote.

## Swing
AUC:
- Train 0.612
- Validation 0.554
- Consumed 2025-2026 0.533
- Threshold 0.354710

Execution:
Train: 800 trades, +40.925R, mean +0.05116R, PF 1.091, DD -32.773R, win 43.75%
Validation: 330 trades, +22.396R, mean +0.06787R, PF 1.120, DD -21.954R, win 43.64%
Consumed 2025-2026: 267 trades, -28.541R, mean -0.10690R, PF 0.832, DD -34.297R, win 36.33%

Yearly:
2018 +19.009R PF 1.312
2019 +19.125R PF 1.233
2020 +18.820R PF 1.251
2021 -17.762R PF 0.854
2022 +1.733R PF 1.016
2023 -1.380R PF 0.987
2024 +23.777R PF 1.283
2025 -1.138R PF 0.986
2026 -27.403R PF 0.686

Static baseline Validation was +38.504R PF 1.1203, mean +0.07405R.
Evolution Validation was +22.396R PF 1.1201, mean +0.06787R.

The evolution model did not improve Validation and failed badly on consumed history.

Important diagnostic:
In 2026 the mean Swing score did not collapse and 41.1% of events still passed the frozen threshold, while the actual positive-outcome rate fell to 26.7%.

Therefore the mapping from pre-entry evolution to Swing outcome changed; this is a higher-order regime problem, not merely a weak local signal problem.

Strongest Swing features:
Positive:
- position inside 120H range
- recovery from anchor
- 24H directional efficiency
- anchor range / ATR
- M5 60-minute drift acceleration

Negative:
- strong 120H return in this bottom-entry context
- frequent state changes over 3H
- high 72H directional efficiency
- worsening H1 5H drift

## Conclusion
State Evolution is conceptually correct, but v0.1 is not a universal gate.

Scalper:
local recovery quality contains useful information and materially reduced later damage, but Validation edge became too thin.

Swing:
local and medium-horizon evolution remain insufficient. Swing needs a separate higher-order wave/regime model that understands whether control has truly transferred.

Do not retune on 2025-2026.
Pristine Forward OOS remains unread.
