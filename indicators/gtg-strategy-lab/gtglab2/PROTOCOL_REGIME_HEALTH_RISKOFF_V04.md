# PROTOCOL — Regime Health Risk-Off v0.4

Date: 2026-10-05

## Objective
Add explicit management after State Understanding.

The prior studies show:
- prediction helps Scalper
- Swing can enter a regime where predictive relationships collapse
- annual and quarterly retraining do not reliably protect Swing

Therefore add a separate live health layer that can stop real risk while the strategy continues to run in shadow mode.

## Shadow engine
Use the already-preregistered Quarterly Adaptive State Evolution v0.3 trade stream exactly as produced.

The shadow engine continues to generate and close its own hypothetical trades whether live risk is ON or OFF.

The live layer never changes the shadow engine or its signals.

## Health window
Before each new shadow trade entry:
- collect the most recent 20 SHADOW trades that have already CLOSED before the new entry
- no open/future trade outcome is used

Warmup:
- if fewer than 20 completed shadow trades exist, live risk remains ON

## Risk-off rule
Live risk is OFF for the new trade if EITHER:
1. trailing 20 shadow trades total R <= -5R
OR
2. trailing 20 shadow-trade profit factor <= 0.80

Otherwise live risk is ON.

No tuning.
No alternative thresholds.
No year feature.

## Automatic recovery
Even while live risk is OFF:
- shadow trades continue
- their outcomes enter the rolling 20-trade health window
- live trading resumes automatically as soon as both risk-off conditions are no longer true

Therefore there is no permanent lockout and no manual intervention.

## Execution
The live result is simply the subset of shadow trades whose entry occurs while health is ON.

Because the shadow stream itself is non-overlapping and continuous, skipping a live trade does not alter the shadow schedule.

## Report
For Scalper and Swing:
- baseline shadow metrics
- live risk-managed metrics
- number and fraction of trades skipped
- skipped trade PnL
- annual results
- 2026 quarter results
- first risk-off date in 2026
- duration / count of risk-off decisions

## Success
Management is useful if:
- materially reduces max drawdown
- materially reduces 2026 Swing loss
- does not destroy aggregate expectancy across prior years

This is a management experiment, not an entry promotion.

Pristine Forward OOS remains unread.
