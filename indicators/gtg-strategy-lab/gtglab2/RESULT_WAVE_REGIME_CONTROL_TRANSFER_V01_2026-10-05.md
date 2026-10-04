# RESULT — Wave Regime + Control Transfer v0.1

Date: 2026-10-05

## Objective
Test two specialized readers instead of one common state model:

- Scalper: local Control Transfer after the anchor low.
- Swing: Higher-Order Wave / Regime structure over 1–10 days.

Frozen prior entry triggers, states, risk geometry, and FIXED management were unchanged.

Train: 2018-2022
Validation: 2023-2024
2025-2026: consumed diagnostic only
Pristine Forward OOS remained unread.

# Scalper — Control Transfer

Model:
- Logistic Regression C=1.0
- Train threshold = 60th percentile
- frozen threshold: 0.647628

AUC:
- Train: 0.640
- Validation: 0.629
- Consumed 2025-2026: 0.653

Execution:
Train:
- 937 trades
- +21.195R
- mean +0.02262R
- PF 1.091
- max DD -19.641R
- win rate 73.96%

Validation:
- 364 trades
- +3.495R
- mean +0.00960R
- PF 1.038
- max DD -8.047R
- win rate 74.45%

Consumed 2025-2026:
- 352 trades
- +0.638R
- mean +0.00181R
- PF 1.007
- max DD -23.112R
- win rate 72.44%

Year-by-year:
- 2018: -3.338R, PF 0.922
- 2019: +5.182R, PF 1.112
- 2020: +10.349R, PF 1.238
- 2021: +25.252R, PF 1.652
- 2022: -16.251R, PF 0.738
- 2023: +3.589R, PF 1.082
- 2024: -0.093R, PF 0.998
- 2025: +11.858R, PF 1.303
- 2026: -11.220R, PF 0.803

Comparison:
- Static-state Validation: +12.872R, PF 1.051
- State Evolution Validation: +0.594R, PF 1.006
- Control Transfer Validation: +3.495R, PF 1.038

Therefore Control Transfer improves over State Evolution v0.1 in Validation, but does not beat the simpler static-state baseline.

Strongest positive control-transfer features:
- recovery from anchor low / ATR
- more bars since anchor before trigger
- last 3-bar return / ATR
- positive-return share
- current M5 60m drift
- fraction of closes above previous M5 high

Interpretation:
A good local recovery is not merely many bullish candles. What matters more is:
1. meaningful distance recovered from the low,
2. enough time for the low to survive,
3. recent acceleration,
4. actual reclaim behavior.

However 2022 and 2026 remain poor. Control transfer alone is insufficient.

Decision:
RETAIN concept, DO NOT PROMOTE.

# Swing — Higher-Order Wave / Regime

Model:
- Logistic Regression C=1.0
- Train threshold = 60th percentile
- frozen threshold: 0.363889

AUC:
- Train: 0.589
- Validation: 0.509
- Consumed 2025-2026: 0.516

This is the most important statistical result:
the higher-order wave feature set is almost unable to rank individual good versus bad Swing events out of sample.

Execution:
Train:
- 645 trades
- +66.406R
- mean +0.10295R
- PF 1.176
- max DD -26.078R

Validation:
- 262 trades
- +5.696R
- mean +0.02174R
- PF 1.035
- max DD -23.483R

Consumed 2025-2026:
- 210 trades
- -0.123R
- mean -0.00059R
- PF 0.999
- max DD -16.914R

Year-by-year:
- 2018: -2.610R, PF 0.962
- 2019: +32.942R, PF 1.530
- 2020: +18.295R, PF 1.332
- 2021: -1.983R, PF 0.979
- 2022: +19.762R, PF 1.202
- 2023: -15.521R, PF 0.838
- 2024: +21.217R, PF 1.307
- 2025: +11.364R, PF 1.189
- 2026: -11.487R, PF 0.846

Comparison with earlier Swing:
Static-state:
- Validation +38.504R, PF 1.120
- 2026 -41.927R, PF 0.722

State Evolution:
- Validation +22.396R, PF 1.120
- 2026 -27.403R, PF 0.686

Wave Regime:
- Validation +5.696R, PF 1.035
- 2026 -11.487R, PF 0.846

So the Wave filter reduces later downside damage materially, but sacrifices too much historical edge and has near-random Validation AUC.

Because 2025-2026 is consumed history, the improved 2026 number cannot justify tuning or promotion.

## Key diagnosis

The failed assumption was:
"Use a 1–10 day wave description to score each individual Swing entry."

The evidence says the higher-order regime is not best represented as another per-entry Logistic gate.

A regime is slower-moving than an entry signal.
It should answer:
- Are long Swing buys generally allowed now?
- Is the larger wave still in persistent sell mode?
- Is the environment transitioning?
- How much risk should Swing receive?

Then M15/M5 should decide the individual entry.

That is different from asking the regime model to predict each trade outcome.

## What the coefficients suggest, cautiously
Some wave variables carry information in Train, including:
- distance above the 72H low,
- 120H return,
- 240H range position,
- lower-low persistence,
- negative H1 fraction.

But their mapping to individual trade outcome is not stable enough out of sample.

## Conclusion

### Scalper architecture
Keep:
H1/M15 context -> M5 Control Transfer -> execution.

But do not replace the static baseline with Control Transfer alone.
The likely next step is an ensemble/hierarchical decision where static state determines eligibility and Control Transfer measures local confidence.

### Swing architecture
Change the role of the higher-order layer.

Do NOT use:
Wave Regime -> predict each trade.

Use:
Wave Regime -> define trading permission / risk regime
then
H1 state -> M15 transition -> M5 execution.

The regime layer should operate on larger time blocks (hours/days), with persistence/hysteresis, not event-by-event scoring.

No production promotion.
No 2025-2026 retuning.
Pristine Forward OOS remained unread.
