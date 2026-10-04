# RESULT — Pine v0.2 Extended Historical Test — 2025-01-01 to T_FREEZE

Requested window: 2025-01-01T00:00:00Z -> 2026-10-01T00:00:00Z
Actual clean-data limit: 2026-09-30T13:40:49Z
Latest complete H1 bar start: 2026-09-30T12:00:00Z

Strategy: exact user-supplied GTGLab2 Swing Acceptance-Retest v0.2 Parity logic.
Feed: clean JForex historical BID OHLC.
Synthetic sizing: 1R = $100.
Pristine Forward OOS: NOT READ.

## Full requested available interval
- Trades: 57
- LONG: 29
- SHORT: 28
- Winners: 16
- Losers: 41
- Win rate: 28.07%
- Total: +8.1775R
- Mean: +0.1435R/trade
- Median: -0.4577R
- Profit factor: 1.1998
- Max drawdown: -19.2154R
- Synthetic net at 1R=$100: +$817.75

### 2025
- Trades: 34
- Winners: 8
- Losers: 26
- Total: +0.7394R
- Mean: +0.0217R/trade
- PF: 1.0309
- Max DD: -19.2154R

### 2026 through 2026-09-30 13:40:49Z
- Trades: 23
- Winners: 8
- Losers: 15
- Total: +7.4381R
- Mean: +0.3234R/trade
- PF: 1.4369
- Max DD: -6.7855R

## Previously sealed Historical Holdout only
Cutoff: 2025-03-25T05:04:34.300Z

- Trades: 51
- LONG: 24
- SHORT: 27
- Winners: 13
- Losers: 38
- Win rate: 25.49%
- Total: +2.9682R
- Mean: +0.0582R/trade
- Median: -0.7205R
- Profit factor: 1.0751
- Max drawdown: -19.2154R
- First signal: 2025-03-27T07:00:00Z
- Last signal: 2026-09-23T15:00:00Z

## Interpretation
The code remained slightly profitable over the extended interval, but its edge weakened sharply versus the earlier Validation result.
The extended holdout result is only marginally positive (PF ~1.08) with a large drawdown and a low win rate.
Therefore Pine v0.2 is not robust enough to promote as a final strategy without further development.

## Scientific consequence
The Historical Holdout has now been opened by explicit user request. It must not be treated as unseen final historical evidence for future tuning of this candidate.
Pristine Forward OOS remains blind and untouched.
