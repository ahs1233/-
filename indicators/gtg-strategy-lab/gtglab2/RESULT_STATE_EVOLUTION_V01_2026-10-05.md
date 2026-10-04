# RESULT — State Evolution Engine v0.1

Date: 2026-10-05

## Objective
Test whether reading how market state evolves before entry is more useful than a static state-at-entry label.

Architecture:
H1 higher-order regime -> M15 evolution -> M5 transition -> FIXED management.

Frozen prior components were unchanged:
- Scalper trigger: HIGHER_LOW_BREAK
- Scalper states: 0, 5
- Swing trigger: HIGH_RECLAIM
- Swing states: 0, 4, 5
- Management: FIXED

Train: 2018-2022
Validation: 2023-2024
2025-2026: consumed diagnostic only
Pristine Forward OOS remained unread.

## Scalper

Model discrimination:
- Train AUC: 0.651
- Validation AUC: 0.619
- Consumed 2025-2026 AUC: 0.666
- Frozen threshold: 0.653844 (60th percentile of Train scores)

Execution after State Evolution gate:

Train:
- 925 trades
- +32.920R
- mean +0.03559R
- PF 1.145
- max DD -8.492R
- win 74.38%

Validation:
- 376 trades
- +0.594R
- mean +0.00158R
- PF 1.006
- max DD -7.439R
- win 72.87%

Consumed 2025-2026:
- 300 trades
- +9.789R
- mean +0.03263R
- PF 1.136
- max DD -13.544R
- win 75.67%

Year-by-year:
- 2018: -1.253R, PF 0.970
- 2019: +5.390R, PF 1.117
- 2020: +8.267R, PF 1.184
- 2021: +22.219R, PF 1.487
- 2022: -1.704R, PF 0.966
- 2023: +2.795R, PF 1.058
- 2024: -2.201R, PF 0.958
- 2025: +10.506R, PF 1.337
- 2026: -0.717R, PF 0.983

Compared with prior static-state baseline:
- Static Validation: +12.872R, PF 1.051, mean +0.01795R
- Evolution Validation: +0.594R, PF 1.006, mean +0.00158R

Therefore the preregistered usefulness criterion is NOT met: although AUC is meaningful and consumed 2025-2026 improved materially, Validation execution is worse than the static-state baseline.

Important diagnostic:
State Evolution nearly neutralized the prior 2026 Scalper loss:
- Static 2026: -10.066R, PF 0.907
- Evolution 2026: -0.717R, PF 0.983

But this is consumed history and cannot be used to promote or retune the model.

Strongest Scalper evolution signals:
Positive:
- recovery from anchor low / ATR
- improvement in M5 60-minute drift
- more bars elapsed from anchor before valid recovery
- higher position inside the 120H range

Negative:
- excessive M15 1H acceleration
- larger fraction of negative M5 closes over prior 12H
- stronger recent 24H return in this bottom-entry context

Interpretation:
The Scalper benefits when the low has genuinely begun to recover and M5 momentum is improving, but its validation edge remains too thin.

Decision: RETAIN FOR RESEARCH, NOT PROMOTE.

## Swing

Model discrimination:
- Train AUC: 0.612
- Validation AUC: 0.554
- Consumed 2025-2026 AUC: 0.533
- Frozen threshold: 0.354710

Execution:

Train:
- 800 trades
- +40.925R
- mean +0.05116R
- PF 1.091
- max DD -32.773R
- win 43.75%

Validation:
- 330 trades
- +22.396R
- mean +0.06787R
- PF 1.120
- max DD -21.954R
- win 43.64%

Consumed 2025-2026:
- 267 trades
- -28.541R
- mean -0.10690R
- PF 0.832
- max DD -34.297R
- win 36.33%

Year-by-year:
- 2018: +19.009R, PF 1.312
- 2019: +19.125R, PF 1.233
- 2020: +18.820R, PF 1.251
- 2021: -17.762R, PF 0.854
- 2022: +1.733R, PF 1.016
- 2023: -1.380R, PF 0.987
- 2024: +23.777R, PF 1.283
- 2025: -1.138R, PF 0.986
- 2026: -27.403R, PF 0.686

Compared with prior static-state baseline:
- Static Validation: +38.504R, PF 1.1203, mean +0.07405R
- Evolution Validation: +22.396R, PF 1.1201, mean +0.06787R

The evolution model does not improve Validation and fails badly on consumed 2025-2026.

Strongest Swing signals:
Positive:
- higher position inside the 120H range
- stronger recovery from anchor
- higher 24H directional efficiency
- larger anchor candle relative to ATR
- improving M5 60-minute drift

Negative:
- very strong 120H return in the current bottom-buying context
- frequent state changes over 3H
- high 72H directional efficiency
- worsening H1 5H drift

Interpretation:
The current linear evolution model can detect some useful structure, but it still cannot reliably distinguish a genuine swing bottom from a temporary recovery inside a larger regime.

The 2026 failure is especially important:
- mean model score in 2026 did not collapse
- 41.1% of Swing events still passed the frozen threshold
- actual positive-label rate fell to 26.7%

So the problem is not simply "lower score in bad years." The mapping from observed pre-entry evolution to future Swing outcome itself changed.

Decision: FAIL. Do not promote.

## Main conclusion

State Evolution is a real improvement in the conceptual architecture, but v0.1 is not sufficient as a universal gate.

For Scalper:
- evolution features contain meaningful signal;
- they dramatically reduced 2026 damage in consumed history;
- but Validation execution became almost flat and worse than the static-state baseline.

For Swing:
- static and short-horizon evolution features remain insufficient;
- the system still cannot recognize the higher-order regime shift that makes an otherwise valid-looking bottom fail.

The evidence now points to a deeper distinction:

1. Local recovery quality matters strongly for Scalper.
2. Swing requires understanding the larger wave/regime and whether control has truly transferred, not only local acceleration/deceleration.
3. A single linear model for all regimes is likely too simple.
4. Management should react to realized trade behavior only after entry context is correct.

Next research should separate:
- local execution intelligence for Scalper;
- higher-order wave/regime intelligence for Swing.

Do not retune on 2025-2026.
Pristine Forward OOS remains unread.
