# PROTOCOL — GTGLab2 v0.5 Buy Low / Sell High

Date: 2026-10-04

Goal:
Test a simpler long-only structural idea:
buy after a low-price rejection, sell later at a higher structural price.

No macro inputs.
No calendar-year filter.
No Acceptance/Retest breakout chasing.

## Timeframe
H1.

## Market permission
Do not buy in a clear bearish structure.

Bull structure:
- EMA50 > EMA200
- EMA200 is not falling versus 24 H1 bars ago

Range structure:
- abs(EMA50 - EMA200) <= 1.5 ATR14
- efficiency48 <= 0.35

Trade is allowed when Bull OR Range is true.

## Cheap-price definition
Use the frozen prior 48H range:
- prior48Low = lowest low of previous 48 H1 bars
- prior48High = highest high of previous 48 H1 bars
- position48 = (close - prior48Low) / (prior48High - prior48Low)

Bull pullback:
- position48 <= 0.40

Range low:
- position48 <= 0.25

## Reversal confirmation
Signal bar must:
- make a low below the previous 12H low,
- close back above that previous 12H low,
- close above its open,
- close above previous close.

This is a failed-break / rejection signal: price tests lower, fails to remain there, and recovers.

## Entry
- LONG only.
- Enter next H1 open.
- One position at a time.

## Risk
- Structural stop = signal low - 0.25 * ATR14(signal).
- Quantity sized so stop distance equals synthetic 1R = $100.
- If next bar opens below the stop, fill at next-bar open (gap-aware).

## Sell-higher target
Freeze the prior 48H range at signal time.
Target = prior48Low + 0.75 * (prior48High - prior48Low).

Only enter if target is above entry and expected reward/risk >= 1.5.

## Other exits
- Stop if structural stop is hit.
- Failure exit: two consecutive closes below frozen prior48Low.
- Timeout: 48 H1 bars.
- Target, failure, timeout use causal next/intrabar semantics.

## Evaluation
Run unchanged on clean JForex historical H1 from 2018-03-01 through T_FREEZE 2026-09-30.
Primary diagnostics:
- by year
- bull vs range setup
- target/stop/failure/timeout exits
- net R, PF, max drawdown, win rate, average R
- reward/risk distribution

Pristine Forward OOS remains untouched.

# ADDENDUM — v0.5.1 Trend Pullback

After the preregistered v0.5 run:
- RANGE_LOW was rejected: -15.77R, PF 0.86.
- 272/393 trades hit the structural stop; the 0.25 ATR cushion was too tight for this reversal style.

v0.5.1 frozen changes before rerun:
- LONG only.
- Remove RANGE_LOW completely.
- Require the existing v0.4 bullish regime:
  - MTF score = +3
  - (EMA50 - EMA200) / ATR14 >= 1.5
  - ATR14 >= rolling median ATR14 over 120 H1 bars
- Cheap price remains position48 <= 0.40.
- Reversal remains: break below previous 12H low, reclaim it, bullish close, close > previous close.
- Structural stop = signal low - 0.50 ATR14.
- Target remains 75% of frozen prior-48H range.
- Planned reward/risk must be >= 1.5.
- Timeout remains 48 H1.

# ADDENDUM — v0.5.2 Robustness Grid

v0.5.1 was rejected before promotion because it generated only 2 trades across 2018-2026.

To avoid arbitrary one-off tuning, v0.5.2 will use a small preregistered robustness grid around the same long-only trend-pullback hypothesis.

Fixed logic:
- LONG only.
- Bull structure: EMA50 > EMA200 and EMA200 >= EMA200[24].
- Failed-break rejection: low < prior 12H low, close back above it, bullish close, close > previous close.
- Frozen 48H structural target.
- One trade at a time.
- 48H timeout.

Grid:
- position48 max: 0.35, 0.40, 0.45
- minimum EMA50/EMA200 gap in ATR: 0.0, 0.5, 1.0
- minimum ATR14 / medianATR120: 0.0, 0.90, 1.00
- stop cushion below signal low: 0.25, 0.50, 0.75 ATR
- target percentile of frozen 48H range: 0.60, 0.70, 0.75
- minimum planned reward/risk: 1.25, 1.50

Selection discipline:
- Development segment: 2018-03-01 through 2023-12-31.
- Internal pseudo-validation: 2024-01-01 through 2026-09-30.
- Candidate must have >=20 trades in each segment.
- Candidate must be profitable in both segments.
- Candidate must have PF >1 in both segments.
- Prefer higher worst-segment mean R, then lower worst-segment drawdown, rather than maximum total profit.
- This is development selection, not true OOS. Pristine Forward OOS remains untouched.

# CAUSALITY CORRECTION BEFORE v0.5.2 FREEZE

During Pine translation, a look-ahead issue was found in the development simulator:
the planned reward/risk admission test used the next H1 open, which is not known at signal close.

Correction before final candidate freeze:
- Stop and target remain frozen from the signal bar.
- Planned reward/risk is computed from signal close, not next open.
- Position quantity is computed from signal-close-to-stop distance.
- The actual fill remains next H1 open.
- Any entry gap therefore changes realized R naturally.
- The robustness grid must be rerun after this correction.
- Previous grid ranking is discarded and must not be used for v0.5.2 selection.

# v0.5.2 FINAL DEVELOPMENT FREEZE

After causal correction and rerunning all 486 preregistered grid combinations, 374 candidates met the minimum robustness gates.

Selection rule was applied as preregistered: maximize the weaker segment mean R first, then prefer lower worst-segment drawdown.

Selected v0.5.2:
- position48 <= 0.45
- EMA50/EMA200 directional gap >= 1.0 ATR
- no additional ATR-regime minimum
- stop cushion = 0.75 ATR below signal low
- target = 60% of frozen prior-48H range
- minimum planned reward/risk = 1.25
- planned R/R and sizing use signal close only
- actual fill = next H1 open
- LONG only, bull structure only
- failed-break rejection confirmation
- 48H timeout

Grid evidence:
Development 2018-03 through 2023:
- 96 trades
- +23.4855R
- mean +0.2446R
- PF 1.4348
- max DD -9.6099R

Internal pseudo-validation 2024 through 2026-09:
- 43 trades
- +11.9387R
- mean +0.2776R
- PF 1.6444
- max DD -6.5335R

This is a development freeze, not true OOS evidence.
