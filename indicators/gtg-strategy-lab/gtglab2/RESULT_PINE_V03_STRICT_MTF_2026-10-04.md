# RESULT — Pine v0.3 Strict MTF — 2025-01-01 to 2026-09-30

Final development candidate for this round:
- Exact v0.2 Acceptance/Retest and exits.
- Context tightened to MTF score +3 for LONG / -3 for SHORT only.
- Experimental dynamic risk overlay remains OFF by default in the Pine file.

## Full available interval
- Trades: 28
- LONG: 19
- SHORT: 9
- Winners: 9
- Losers: 19
- Win rate: 32.14%
- Total: +19.7697R
- Mean: +0.7061R/trade
- Profit factor: 2.1842
- Max drawdown: -5.2546R
- Synthetic net at 1R=$100: +$1,976.97

## By year
2025:
- 14 trades
- +11.7236R
- PF 2.8584
- Max DD -5.2546R

2026 through 2026-09-30:
- 14 trades
- +8.0461R
- PF 1.7747
- Max DD -4.6468R

## Comparison versus v0.2
v0.2:
- 57 trades
- +8.1775R
- PF 1.1998
- Max DD -19.2154R

v0.3 Strict MTF:
- 28 trades
- +19.7697R
- PF 2.1842
- Max DD -5.2546R

## Risk-overlay experiments
Two dynamic-risk variants were tested and rejected for this round:
- 1R early stop / early BE-lock-trail: +6.4048R, PF 1.3771, DD -7R.
- 2R catastrophe stop / delayed BE-lock-trail: +8.7251R, PF 1.5036, DD -9.5537R.
Both underperformed simply keeping the original v0.2 exits with the strict MTF filter.

## Decision
Keep v0.3 Strict MTF as the best development candidate from this round.
Do not use the new dynamic risk overlay by default.
Historical 2025-2026 data is development data now, not clean OOS.
