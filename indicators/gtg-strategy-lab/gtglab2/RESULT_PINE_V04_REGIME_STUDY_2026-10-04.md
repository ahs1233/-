# RESULT — Pine v0.4 Regime Filter — Structural Regime Study

Date: 2026-10-04

## Regime hypothesis
v0.3 failed badly in 2023 but worked strongly in 2024-2025. Signal-time comparison showed that good periods were characterized by:
- stronger directional EMA50-vs-EMA200 separation,
- non-compressed ATR regime,
- stronger short-horizon directional impulse.

The frozen v0.4 rule uses only two causal, interpretable conditions:
1. MTF remains strict: +3 LONG / -3 SHORT.
2. Directional EMA50/EMA200 gap >= 1.5 ATR.
3. ATR14 >= rolling median ATR14 over 120 H1 bars.
Acceptance/Retest and v0.2 exits are unchanged.

## Exact integrated test — 2023 through 2025
v0.3 baseline:
- 64 trades
- +25.7705R
- PF 1.4741
- Max DD -25.2919R

v0.4 Regime:
- 28 trades
- 12 wins / 16 losses
- Win rate 42.86%
- +33.3225R
- Mean +1.1901R/trade
- PF 3.0585
- Max DD -5.8050R

### By year
2023:
- v0.3: -17.7928R, PF 0.3304, Max DD -22.6162R
- v0.4: +6.1663R, PF 3.3583, Max DD -1.4196R

2024:
- v0.4: 15 trades, +22.3313R, PF 2.9949, Max DD -5.8050R

2025:
- v0.4: 5 trades, +4.8249R, PF 3.0283, Max DD -1.3250R

## Secondary 2026 read
2026 through 2026-09-30:
- 4 trades
- +9.6390R
- PF 8.9311
- Max DD -0.9559R
Sample is very small and must not be overinterpreted.

## Earlier-history robustness — 2018 through 2022
Unchanged v0.4:
- 29 trades
- +5.4883R overall
- PF 1.1954
- Max DD -17.4546R

By year:
- 2018: -4.6827R, PF 0.3984
- 2019: -11.8615R, PF 0.0
- 2020: +8.7213R, PF 3.4744
- 2021: +1.1812R, PF 1.6244
- 2022: +12.1300R, PF 5.0006

## Full available 2018-2026 diagnostic
- 61 trades
- 23 wins / 38 losses
- Win rate 37.70%
- +48.4499R
- Mean +0.7943R/trade
- PF 2.0649
- Max DD -17.4546R

From 2020 onward:
- 48 trades
- +64.9940R
- Mean +1.3540R/trade
- PF 3.5142
- Max DD -5.8050R

## Interpretation
The v0.4 regime filter successfully solves the specific 2023 failure mode in the development sample and preserves profitability in 2024-2026.
However, it is not a universal regime solution: 2018-2019 remain poor.
Therefore v0.4 is a materially better candidate than v0.3, but the regime engine still needs a second layer capable of recognizing the 2018-2019 market structure.

Pristine Forward OOS remains unread.
