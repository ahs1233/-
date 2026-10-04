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
