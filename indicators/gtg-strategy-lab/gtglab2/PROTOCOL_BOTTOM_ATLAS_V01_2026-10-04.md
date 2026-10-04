# PROTOCOL — GTGLab2 Bottom Atlas v0.1

Date: 2026-10-04

## Purpose
Return GTGLab2 to the original objective:
understand repeated gold movement first, then derive entries.

No strategy optimization in this study.
No macro data.
No calendar-year rules.
No new Pine entry rule is allowed until the atlas is measured.

## Data
- Clean historical JForex H1 gold data.
- 2018-03-01 through clean-data T_FREEZE 2026-09-30T13:40:49Z.
- Pristine Forward OOS remains unread.

## Part A — Price swing map
Construct objective alternating price swings using directional-change confirmation at:
- 1 ATR
- 2 ATR
- 4 ATR

ATR = trailing SMA true-range 14 H1 bars.
A pivot low is labeled retrospectively only after price rises by the threshold from the running low.
A pivot high is labeled retrospectively only after price falls by the threshold from the running high.

For every completed low -> high -> low sequence record:
- low time/price
- prior high time/price
- prior decline size in ATR
- prior decline duration
- next high time/price
- subsequent rise size in ATR
- rise duration
- following decline size/duration

This is descriptive labeling, not a tradable signal.

## Part B — Bottom candidates
A candidate bottom is any H1 bar whose low is below the prior 12H low.

At the candidate bar, use only information already known:
- last 5/20/50-bar drift normalized by ATR
- 5/20/50-bar efficiency
- position inside prior 24H / 72H range
- ATR relative to trailing 120H median
- candle close-location and wick/body structure
- distance to EMA50 / EMA200 in ATR
- EMA50 / EMA200 slopes
- prior decline magnitude from trailing 24H / 72H highs

Future labels are used only to say what happened afterward:
- MFE and MAE after 6H / 12H / 24H / 48H
- first hit +1 ATR / +2 ATR / +3 ATR
- first hit -1 ATR below candidate
- GOOD_24H = +2 ATR occurs before -1 ATR within next 24H
- GOOD_48H = +3 ATR occurs before -1 ATR within next 48H
- FALSE_LOW = -1 ATR occurs first

## Part C — Swing vs Scalper map
Swing bottoms:
- completed 2-ATR pivot lows whose next rise is >= 4 ATR.

Scalper bottoms:
- completed 1-ATR pivot lows whose next rise is between 1 and 3 ATR and which remain inside a bounded 48H range.

Measure both separately.

## Output
- full pivot tables at 1/2/4 ATR
- bottom-candidate table with causal features and future labels
- yearly counts and outcome distributions
- feature differences between good and false bottoms
- concise conclusions about what a real bottom looked like before it rose

No trading rule will be promoted from this run.
