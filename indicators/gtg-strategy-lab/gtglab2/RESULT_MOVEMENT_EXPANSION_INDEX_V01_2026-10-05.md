# RESULT — Movement Expansion Index v0.1

Date: 2026-10-05

Protocol commit:
- f83f7f526d2cf8a9c12d74395a96c4cae9f6e75f

## Objective
Test the hypothesis that gold's movement freedom expanded gradually through 2025 and reached a much more persistent extreme regime in 2026.

The index uses no year identity.

Inputs are causal price/movement features already frozen in GTGLab2:
- H1 ATR as percent of price
- 24H range as percent of price
- 72H range as percent of price
- local volatility ratio
- 7-day smoothed movement level
- 30-day expansion velocity
- 30-day expansion acceleration
- 30-day volatility-of-volatility proxy

All normalization and state thresholds are derived from 2018-2022 only.

Pristine Forward OOS remained unread.

## Train-only thresholds

Expansion Index thresholds:
- NORMAL <= -0.076295
- EARLY_EXPANSION <= 0.574329
- EXPANDING <= 1.371909
- HIGH_EXPANSION <= 2.867113
- EXTREME > 2.867113

COOLDOWN:
- current expansion is falling,
- current raw state is no higher than EXPANDING,
- and a HIGH/EXTREME state occurred during the previous 30 days.

Train context observations:
- 3,384

## Yearly Expansion Index

| Year | Mean index | Normal | High | Extreme | Cooldown |
|---|---:|---:|---:|---:|---:|
| 2018* | -0.785 | 93.9% | 0.0% | 0.0% | 0.0% |
| 2019 | -0.105 | 51.9% | 7.1% | 3.9% | 11.6% |
| 2020 | +0.977 | 13.7% | 17.8% | 17.8% | 26.9% |
| 2021 | +0.220 | 21.1% | 8.2% | 0.0% | 22.7% |
| 2022 | +0.308 | 28.9% | 13.9% | 4.5% | 17.4% |
| 2023 | +0.073 | 40.7% | 10.1% | 0.3% | 9.6% |
| 2024 | +0.310 | 30.7% | 13.5% | 6.6% | 17.2% |
| 2025 | +0.668 | 29.3% | 14.8% | 14.3% | 20.1% |
| 2026** | +1.470 | 1.1% | 35.8% | 18.8% | 31.2% |

High + Extreme:
- 2024: 20.1%
- 2025: 29.1%
- 2026: 54.6%

High + Extreme + Cooldown:
- 2024: 37.3%
- 2025: 49.2%
- 2026: 85.8%

This is the strongest confirmation of the user's hypothesis:
the important change is not just a larger one-off spike. The expanded movement regime becomes progressively more persistent.

## 2025 progression

2025 does NOT move monotonically upward every month.
Instead, expansion arrives in increasingly strong pulses:

- January: NORMAL, index -0.68
- February: EXPANDING, +1.19
- March: COOLDOWN, +0.24
- April: EXTREME, +3.24
- May: HIGH_EXPANSION, +1.84
- June: COOLDOWN, -0.79
- July: NORMAL, -0.55
- August: NORMAL, -0.32
- September: near NORMAL, -0.02, but 23.3% of contexts High/Extreme
- October: EXTREME, +4.08
- November: HIGH_EXPANSION, +2.07
- December: COOLDOWN, -0.26

Interpretation:
2025 is the transition year. Expansion appears, cools, then reappears more violently.

## 2026 progression

- January: HIGH_EXPANSION, +2.14
- February: EXTREME, +4.26
- March: COOLDOWN, +1.00
- April: HIGH_EXPANSION, +1.51
- May: COOLDOWN, -0.45
- June: EXTREME-dominant, +2.34
- July: COOLDOWN but still elevated, +1.55
- August: EXPANDING, +0.76
- September: HIGH_EXPANSION, +2.05

Interpretation:
2026 is no longer a sequence of isolated expansion bursts.
The elevated movement regime becomes the default condition, with short cooldown intervals.

Only ~1% of 2026 context observations are NORMAL.

## Important control: 2020

The index also detects the 2020 volatility expansion:
- mean index +0.977
- High + Extreme = 35.6%

Therefore the index is not simply recognizing "2026" or a high gold price.
It detects movement-regime expansion elsewhere in history.

However 2020 still traded well under earlier GTGLab2 logic.

This means:
Expansion alone does NOT explain profitability or failure.

The deeper distinction is:
- magnitude of expansion,
- persistence of expansion,
- and interaction with the current market/transition state.

2026 is more persistent than 2020:
- 2020 High/Extreme/Cooldown: ~62.5%
- 2026 High/Extreme/Cooldown: ~85.8%

## Expansion-aware risk test

The risk map was frozen in the protocol before results.

### Scalper

Baseline Integrated Architecture:
- 1,134 trades
- +22.503R
- PF 1.079
- Max DD -14.189R

Expansion-aware:
- 1,134 nonzero-risk trades
- effective risk exposure 983.05R
- +18.524R
- PF 1.075
- Max DD -13.455R

2026:
- baseline -3.494R
- expansion-aware -2.794R
- baseline DD -8.705R
- expansion-aware DD -6.365R

Conclusion:
Expansion-aware sizing provides modest protection for Scalper, but does not improve overall expectancy.

### Swing

Baseline Integrated Architecture:
- 857 trades
- +85.611R
- PF 1.167
- Max DD -32.633R

Expansion-aware:
- 801 nonzero-risk trades
- effective risk exposure 635.0R
- +68.547R
- PF 1.180
- Max DD -23.169R

2025:
- baseline +26.888R
- expansion-aware +9.354R

2026:
- baseline -13.012R
- expansion-aware -5.315R
- baseline DD -17.309R
- expansion-aware DD -7.597R

Conclusion:
For Swing, expansion-aware risk materially improves capital protection and PF, but the frozen mapping is conservative and sacrifices substantial upside in strong expansion years.

### Combined

Baseline Integrated Architecture:
- 1,991 trades
- +108.114R
- PF 1.136
- Max DD -24.690R

Expansion-aware:
- 1,935 nonzero-risk trades
- effective risk exposure 1,618.05R
- +87.071R
- PF 1.139
- Max DD -24.690R

2026:
- baseline -16.505R
- expansion-aware -8.109R

Loss reduction:
- ~50.9%

2025:
- baseline +34.174R
- expansion-aware +15.593R

The current frozen risk map therefore buys substantial protection at the cost of substantial profit.

## Annual expansion-aware combined results

- 2018*: -2.679R, PF 0.969
- 2019: +18.624R, PF 1.238
- 2020: +26.165R, PF 1.416
- 2021: +6.249R, PF 1.088
- 2022: +6.382R, PF 1.081
- 2023: +4.774R, PF 1.053
- 2024: +20.072R, PF 1.264
- 2025: +15.593R, PF 1.294
- 2026**: -8.109R, PF 0.734

## Main findings

1. The user's gradual-expansion hypothesis is quantitatively supported.
2. 2025 is a transition year with repeated expansion pulses.
3. 2026 is qualitatively different because expansion becomes persistent.
4. Movement expansion is not unique to 2026; 2020 is a valid historical expansion episode.
5. Therefore a simple "high volatility = stop trading" rule would be wrong.
6. The useful concept is Expansion Persistence + State Interaction.
7. ATR normalization alone is insufficient because movement distribution, tail width, and volatility-of-volatility change.
8. The current risk map protects Swing strongly but is too blunt to maximize expectancy.

## Decision

RETAIN Movement Expansion Index v0.1 as a new top-level context layer.

Do NOT promote the frozen risk map as final sizing logic.

Next research should distinguish:
- productive expansion,
- destructive expansion,
- persistent explosive regime,
- cooldown/recovery,

and condition Swing confirmation requirements on Expansion Persistence rather than simply cutting risk by instantaneous state.

No 2025-2026 retuning was performed.
Pristine Forward OOS remained unread.

*2018 begins 2018-03-01.
**2026 ends 2026-09-30.
