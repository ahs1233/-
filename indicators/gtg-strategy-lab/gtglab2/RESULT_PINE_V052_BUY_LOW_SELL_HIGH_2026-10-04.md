# RESULT — GTGLab2 Buy Low / Sell High v0.5.2

Date: 2026-10-04

## Frozen logic
- LONG only.
- Bull structure: EMA50 > EMA200 and EMA200 >= EMA200[24].
- Directional strength: (EMA50 - EMA200) / ATR14 >= 1.0.
- Cheap zone: close in the lower 40% of the frozen prior-48H range.
- Reversal trigger: bar trades below previous 12H low, reclaims it, closes bullish, and closes above previous close.
- Structural stop: signal low - 0.75 ATR14.
- Sell-higher target: 60% of the frozen prior-48H range.
- Minimum planned signal-time reward/risk: 1.25.
- Failure exit: two closes below frozen prior-48H low.
- Timeout: 48 H1 bars.
- One position at a time.

## Exact Pine-logic historical emulation
Window: 2018-03-01 through clean-data T_FREEZE 2026-09-30T13:40:49Z.
Pristine Forward OOS: NOT READ.

Overall:
- Trades: 131
- Winners: 55
- Losers: 76
- Win rate: 41.98%
- Total: +34.9694R
- Mean: +0.2669R/trade
- Median: -0.6425R
- Profit Factor: 1.5141
- Max Drawdown: -7.6570R
- Synthetic net at 1R=$100: +$3,496.94
- Average signal-time planned R:R: 2.114

## By year
| Year | Trades | Win Rate | Total R | PF | Max DD R |
|---:|---:|---:|---:|---:|---:|
| 2018 | 12 | 50.0% | +4.6029 | 1.766 | -3.008 |
| 2019 | 17 | 47.1% | +9.5817 | 2.196 | -2.982 |
| 2020 | 11 | 27.3% | -0.6185 | 0.916 | -5.291 |
| 2021 | 17 | 35.3% | +2.3672 | 1.234 | -3.999 |
| 2022 | 17 | 52.9% | +12.1166 | 2.584 | -2.984 |
| 2023 | 17 | 29.4% | -5.2560 | 0.556 | -6.610 |
| 2024 | 20 | 40.0% | +5.2492 | 1.616 | -3.407 |
| 2025 | 14 | 64.3% | +10.6666 | 4.072 | -1.939 |
| 2026* | 6 | 16.7% | -3.7400 | 0.253 | -5.007 |

*2026 only through 2026-09-30.

## Development split robustness
2018-2023:
- 91 trades
- +22.7937R
- Mean +0.2505R
- PF 1.4468
- Max DD -7.6570R

2024-2026:
- 40 trades
- +12.1757R
- Mean +0.3044R
- PF 1.7163
- Max DD -5.0066R

Both segments are independently positive.

## Exit anatomy
- TARGET: 49 trades, +90.8729R
- TARGET_GAP: 1 trade, +2.5583R
- 48H_TIMEOUT: 6 trades, +9.4001R
- STOP: 60 trades, -59.9698R
- FAILURE_2_CLOSES: 15 trades, -7.8922R

This is a convex payoff profile: many controlled losses, fewer larger structural wins.

## Comparison with v0.4 Regime
v0.4:
- 61 trades
- +48.4499R
- PF 2.0649
- Max DD -17.4546R
- Strong after 2020, weak in 2018-2019.

v0.5.2 Buy Low:
- 131 trades
- +34.9694R
- PF 1.5141
- Max DD -7.6570R
- Strong in 2018-2019 and 2025, weak in 2020, 2023, and partial 2026.

Interpretation:
v0.5.2 is not superior to v0.4 in total edge, but it is a genuinely different structural engine.
It directly implements the user's desired behavior: buy a rejected low inside an established uptrend and sell into a higher part of the recent range.
Its drawdown is substantially lower than the full-history v0.4 diagnostic, and its trade count is materially higher.

The two engines fail in different years, which suggests they capture different market behaviors rather than one simply dominating the other.

## Scientific status
The 2018-2026 historical corpus is development evidence.
Pristine Forward OOS remains blind and untouched.
