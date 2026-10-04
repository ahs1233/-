# RESULT — Integrated Decision Architecture v0.1

Date: 2026-10-05
Historical period: 2018-03-01 through 2026-09-30

## Frozen architecture

### Scalper
Static states 0/5
-> HIGHER_LOW_BREAK
-> Control Transfer score >= 0.6476279441988548
-> original FIXED execution
-> trailing-20 shadow health brake
-> live risk ON/OFF

### Swing
Static states 0/4/5
-> persistent Wave Permission
-> HIGH_RECLAIM
-> original FIXED execution
-> trailing-20 shadow health brake
-> live risk ON/OFF

Swing Wave Permission hysteresis:
- rolling mean of latest 3 eligible Wave scores
- OFF -> ON at Train Q60 = 0.3638891877385444
- ON -> OFF at Train median = 0.3452352635993130
- between thresholds, retain prior permission state
- fewer than 3 events => OFF

Health brake:
- previous 20 CLOSED shadow trades only
- risk OFF if trailing total R <= -5R OR PF <= 0.80
- fewer than 20 closed trades => risk ON

No parameter was changed after results were seen.
Pristine Forward OOS remained unread.

# Scalper

Eligible events:
- 4,559

Control Transfer selected:
- 1,839

Shadow after execution:
- 1,653 trades
- +25.328R
- mean +0.01532R
- PF 1.060
- max DD -23.587R
- win rate 73.74%

Live after health brake:
- 1,134 trades
- +22.503R
- mean +0.01984R
- PF 1.079
- max DD -14.189R
- win rate 74.25%

Health skipped:
- 519 trades
- 31.4% of shadow stream
- skipped shadow PnL +2.826R

Interpretation:
Health improved risk quality and drawdown but skipped a net-positive subset.

## Scalper live yearly
- 2018*: 99 trades, -2.505R, PF 0.918
- 2019: 121 trades, -1.279R, PF 0.963
- 2020: 170 trades, +8.547R, PF 1.228
- 2021: 201 trades, +21.934R, PF 1.633
- 2022: 76 trades, -9.732R, PF 0.636
- 2023: 111 trades, +2.769R, PF 1.109
- 2024: 124 trades, -1.024R, PF 0.970
- 2025: 138 trades, +7.286R, PF 1.228
- 2026**: 94 trades, -3.494R, PF 0.875

Segment audit:
- 2018-2022: +16.966R, PF 1.103
- 2023-2024: +1.745R, PF 1.029
- 2025-2026: +3.792R, PF 1.063

Decision:
Scalper remains modestly positive in all three large segments, but annual consistency is still weak.

# Swing

Eligible events:
- 5,100

Wave Permission ON:
- 2,138 events
- 41.9% of eligible events
- 642 permission transitions

Shadow after permission + execution:
- 1,132 trades
- +107.909R
- mean +0.09533R
- PF 1.158
- max DD -36.512R
- win rate 39.49%

Live after health brake:
- 857 trades
- +85.611R
- mean +0.09990R
- PF 1.167
- max DD -32.633R
- win rate 40.02%

Health skipped:
- 275 trades
- 24.3% of shadow stream
- skipped shadow PnL +22.298R

Interpretation:
The persistent Wave Permission was the main source of improvement.
Health reduced risk in bad periods but sacrificed substantial positive expectancy overall.

## Swing live yearly
- 2018*: 86 trades, -0.174R, PF 0.997
- 2019: 107 trades, +20.968R, PF 1.349
- 2020: 100 trades, +29.763R, PF 1.584
- 2021: 68 trades, -18.986R, PF 0.620
- 2022: 123 trades, +14.796R, PF 1.196
- 2023: 128 trades, +7.367R, PF 1.096
- 2024: 117 trades, +18.000R, PF 1.265
- 2025: 89 trades, +26.888R, PF 1.559
- 2026**: 39 trades, -13.012R, PF 0.535

Segment audit:
- 2018-2022: +46.367R, PF 1.159
- 2023-2024: +25.367R, PF 1.175
- 2025-2026: +13.876R, PF 1.182

Important:
Even though 2026 is negative, the full 2025-2026 segment remains positive because 2025 is strong.
2026 remains the unresolved structural weakness.

# Combined architecture

Assumption:
- 1R independent risk unit per executed engine trade
- concurrent Scalper/Swing trades are allowed

Full period:
- 1,991 live trades
- +108.114R
- mean +0.05430R
- PF 1.136
- max DD -24.690R
- win rate 59.52%

## Combined yearly
- 2018*: -2.679R, PF 0.969
- 2019: +19.689R, PF 1.208
- 2020: +38.310R, PF 1.433
- 2021: +2.948R, PF 1.035
- 2022: +5.064R, PF 1.050
- 2023: +10.136R, PF 1.099
- 2024: +16.976R, PF 1.166
- 2025: +34.174R, PF 1.427
- 2026**: -16.505R, PF 0.705

Positive years:
- 7 of 9

Negative years:
- 2018 partial
- 2026 partial

## Combined segment audit
2018-2022:
- 1,151 trades
- +63.333R
- mean +0.05502R
- PF 1.139
- max DD -24.690R
- win 59.60%

2023-2024:
- 480 trades
- +27.112R
- mean +0.05648R
- PF 1.133
- max DD -14.145R
- win 57.29%

2025-2026:
- 360 trades
- +17.668R
- mean +0.04908R
- PF 1.130
- max DD -22.647R
- win 62.22%

This is the most important robustness result:
all three broad chronological segments are positive with very similar PF and mean R.

# Comparison with prior Static Architecture

Prior Static combined:
- 5,229 trades
- +95.677R
- mean +0.01830R
- PF 1.039
- max DD -68.284R
- win rate 52.65%

Integrated architecture:
- 1,991 trades
- +108.114R
- mean +0.05430R
- PF 1.136
- max DD -24.690R
- win rate 59.52%

Changes:
- total R: +13.0%
- PF: +9.3%
- max drawdown magnitude: -63.8%
- trade count: -61.9%
- 2026 loss: -51.993R -> -16.505R, a 68.3% reduction
- 2022: -30.284R -> +5.064R

## Main conclusion

The hierarchy adds real historical value versus the static-state architecture.

The strongest improvement is NOT a higher raw win rate alone.
It is selectivity and damage control:
- far fewer trades
- substantially higher R per trade
- materially better PF
- dramatically smaller drawdown
- broad chronological segments remain positive

The architecture now behaves more like:
understand -> permit -> confirm control -> execute -> monitor health
rather than:
signal -> trade.

However, this is NOT final proof of robustness:
- 2025-2026 has been consumed by prior research
- the components were developed on this historical corpus
- 2026 remains materially negative
- Pristine Forward OOS is still sealed

Decision:
RETAIN Integrated Decision Architecture v0.1 as the strongest GTGLab2 architecture so far.
DO NOT promote to final production acceptance until a genuinely untouched forward/OOS test is authorized.

*2018 begins 2018-03-01.
**2026 ends 2026-09-30.
