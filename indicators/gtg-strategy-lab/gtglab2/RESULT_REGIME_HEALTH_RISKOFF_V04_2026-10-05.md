# RESULT — Regime Health Risk-Off v0.4

Date: 2026-10-05

## Objective
Add a separate management layer after prediction:
- keep the underlying strategy running in shadow mode
- stop live risk when recent realized strategy health breaks
- recover automatically when shadow performance recovers

Frozen health rule:
- trailing 20 CLOSED shadow trades
- risk-off if trailing total R <= -5R OR trailing PF <= 0.80
- fewer than 20 closed trades => risk-on
- no tuning, no year feature

Shadow engine:
Quarterly Adaptive State Evolution v0.3.

Pristine Forward OOS remained unread.

# Scalper

Shadow:
- 1,085 trades
- +20.765R
- PF 1.072
- DD -24.139R

Live with health layer:
- 770 trades
- +14.847R
- PF 1.073
- DD -23.367R

Skipped:
- 315 trades
- 29.0% of shadow stream
- skipped shadow PnL: +5.918R

Interpretation:
Health layer did not materially improve aggregate Scalper expectancy.
It skipped both good and bad trades.

2026:
Shadow:
- Q1 +0.155R
- Q2 -5.951R
- Q3 +2.868R

Live:
- Q1 +1.302R
- Q2 -3.865R
- Q3 +1.358R

2026 full:
- 88 live trades
- -1.206R
- PF 0.950

First 2026 risk-off:
2026-03-19 12:55 UTC

Decision:
For Scalper, classification/payoff remains the priority.
The health brake is useful as protection but not as an expectancy enhancer.

# Swing

Shadow:
- 914 trades
- -22.307R
- PF 0.961
- DD -57.344R

Live with health layer:
- 571 trades
- -9.736R
- PF 0.973
- DD -52.063R

Skipped:
- 343 trades
- 37.5% of shadow stream
- skipped shadow PnL: -12.570R

This means the management layer correctly avoided a net losing subset.

## 2026 Swing

Shadow 2026:
- 110 trades
- -28.559R
- PF 0.630

Live 2026:
- 24 trades
- -6.822R
- PF 0.599
- DD -8.763R

Loss reduction:
- +21.738R avoided versus shadow
- live trade count reduced by ~78%

First risk-off:
2026-03-17 10:55 UTC

Quarter detail:

Q1:
Shadow:
- 26 trades
- -6.869R
- PF 0.618

Live:
- 20 trades
- -2.822R
- PF 0.783

Q2:
Shadow:
- 46 trades
- -10.500R
- PF 0.672

Live:
- 4 trades
- -4.000R
- all four stopped

Q3:
Shadow:
- 38 trades
- -11.190R
- PF 0.588

Live:
- 0 trades

This is the key management result:
the live health layer recognized persistent strategy deterioration and completely stopped Q3 exposure while shadow monitoring continued.

## Historical limitation

The health layer does NOT make the Swing engine robust overall.

Live aggregate remains:
- -9.736R
- PF 0.973

The largest problem remains earlier weak regimes such as 2021 and 2023.

Therefore the health layer is useful for capital protection, but it cannot turn a structurally weak prediction engine into a profitable one.

## Main conclusion

The user framing is confirmed empirically:

1. Rules / entry triggers alone are insufficient.
2. Static state reading helps but misses relationship changes.
3. State evolution helps Scalper materially.
4. Faster retraining still cannot solve Swing.
5. Management / regime health can materially reduce damage when the engine becomes wrong.

Correct architecture is now:

Market Context
-> State Evolution
-> Entry Trigger
-> Shadow Health
-> Live Risk ON/OFF
-> Trade Management

For Swing, the next research problem is not another threshold.
It is to identify a stronger causal representation of when a multi-hour reversal has genuine buyer control, while retaining the health layer as a safety mechanism.

Pristine Forward OOS remained unread.
