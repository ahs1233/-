# RESULT — GTGLab2 v0.5.2 Buy Low / Sell Higher

Date: 2026-10-04

## Final causal rules
- LONG only.
- EMA50 > EMA200.
- EMA200 not falling versus 24 H1 bars ago.
- EMA50/EMA200 separation >= 1 ATR14.
- Price at signal close must be within the lower 45% of the frozen prior-48H range.
- Signal must break below the previous 12H low and reclaim it on a bullish close above the previous close.
- Planned reward/risk is decided using signal close only.
- Entry is next H1 open.
- Structural stop = signal low - 0.75 ATR14.
- Sell-higher target = 60% level of frozen prior-48H range.
- Minimum planned reward/risk = 1.25.
- Failure = two closes below frozen 48H low.
- Timeout = 48 H1 bars.

## Full historical development diagnostic
2018-03-01 through 2026-09-30 T_FREEZE.

- Trades: 139
- Winners: 58
- Losers: 81
- Win rate: 41.73%
- Net: +35.4243R
- Mean: +0.2549R/trade
- Median: -0.6425R
- Profit Factor: 1.4883
- Max drawdown: -9.6099R
- Average planned R/R: 2.094

## By year
- 2018: 12 trades, +4.6029R, PF 1.7661, DD -3.0079R
- 2019: 18 trades, +11.4125R, PF 2.4243, DD -2.9824R
- 2020: 11 trades, -0.6185R, PF 0.9161, DD -5.2909R
- 2021: 18 trades, +4.2277R, PF 1.4173, DD -3.9989R
- 2022: 17 trades, +12.1166R, PF 2.5841, DD -2.9844R
- 2023: 20 trades, -8.2555R, PF 0.4441, DD -9.6099R
- 2024: 20 trades, +5.2492R, PF 1.6161, DD -3.4072R
- 2025: 15 trades, +11.9565R, PF 4.4434, DD -1.9392R
- 2026 through T_FREEZE: 8 trades, -5.2670R, PF 0.1939, DD -6.5335R

## Exit structure
- TARGET: 52 trades, +95.8541R
- TARGET_GAP: 1 trade, +2.5583R
- 48H_TIMEOUT: 6 trades, +9.4001R
- STOP: 64 trades, -63.9751R
- FAILURE_2_CLOSES: 16 trades, -8.4132R

## Development split used for robust selection
2018-03 through 2023:
- 96 trades
- +23.4855R
- mean +0.2446R
- PF 1.4348
- max DD -9.6099R

2024 through 2026-09:
- 43 trades
- +11.9387R
- mean +0.2776R
- PF 1.6444
- max DD -6.5335R

## Interpretation
The direct Buy Low / Sell Higher concept works better than the original broad v0.5 attempt:
- It is causal.
- It produces a useful trade count.
- It is profitable in both the early-development and later internal-validation segments.
- The edge remains regime-dependent: 2023 and 2026 are negative.
- This is not a final production strategy and is not true OOS evidence.

The remaining task is not to add more indicators blindly. It is to understand why the same low-price rejection pattern fails specifically in 2023 and 2026 while working in 2018-2019, 2021-2022, and 2024-2025.

Pristine Forward OOS remains untouched.
