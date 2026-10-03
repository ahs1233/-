# GTG Transition Logistic Shadow v0.1 — Findings

Date: 2026-10-03
Scope: post-selection execution diagnostic inside the already-opened 2021-2024 development window.
Historical Holdout remained closed.

## Frozen inputs
Verified unchanged:
- Transition Memory frozen model
- Transition Memory evaluation predictions
- Transition Memory summary
- State Engine v0.2 transition library
- H1 source manifest

Threshold remained exactly p_logistic >= 0.50.
No refit and no threshold tuning.

## h=4 comparison

### Trade every Transition
- opportunities/trades: 445 / 445
- actual Trend precision: 61.35%
- C0: -0.151 ATR/trade
- C1: -0.337
- C2: -0.524
- C1 win rate: 39.8%

### Logistic gate
- opportunities: 445
- active trades: 317
- coverage: 71.24%
- actual Trend precision: 77.60%
- C0: -0.182 ATR/trade
- C1: -0.361
- C2: -0.541
- C1 win rate: 39.1%

The classifier removed many fake transitions, but the remaining false positives were so costly that execution economics did not improve.

### Oracle Trend subset — impossible at onset, upper bound only
- active trades: 273
- precision: 100%
- C0: +0.477
- C1: +0.295
- C2: +0.113

This demonstrates that the real Trend subset contains usable early movement, but transition classification must be much more selective than the current Logistic gate.

## h=12
Logistic:
- active 272
- precision 77.57%
- C0 -0.029
- C1 -0.214
- C2 -0.400

Oracle Trend subset:
- C1 +0.373
- C2 +0.190

## h=24
Logistic:
- active 248
- precision 77.42%
- C0 -0.087
- C1 -0.263
- C2 -0.439

Oracle Trend subset:
- C1 +0.459
- C2 +0.282

## Why 78% classification precision is still not enough
Among active Logistic h=4 trades:

Actual TREND_CONFIRMED:
- n=246
- C1 +0.134 ATR/trade
- C2 -0.045
- mean signed displacement +0.313

Actual RANGE_RESUMED / false break:
- n=71
- C1 -2.075 ATR/trade
- C2 -2.256
- mean signed displacement -1.893

Because a false break is far more expensive than an average true-trend winner, the approximate break-even precision under this exact mix is ~93.95%.

Therefore this is a highly asymmetric classification problem:
false TREND permission is much more harmful than false RANGE stand-down.

## Probability threshold diagnosis
Fixed descriptive bins did not show a monotonic economic improvement:
- 0.50-0.60: C1 -0.214
- 0.60-0.70: C1 -0.323
- 0.70-0.80: C1 -0.542
- 0.80-0.90: C1 -0.462
- >=0.90: C1 -0.159

Simply raising the Logistic threshold is not a defensible rescue.

## What Logistic did remove at h=4
From 445 eligible events:
- avoided: 128
- avoided RANGE_RESUMED: 101
- avoided TREND_CONFIRMED: 27
- false-trend trades remaining: 71

The classifier is genuinely informative, but not selective enough for immediate Swing permission at Transition onset.

## Direction stability
Up candidates:
- active 164
- precision 77.44%
- C1 -0.277

Down candidates:
- active 153
- precision 77.78%
- C1 -0.452

Both sides fail after execution costs.

## Registered screen
FAILED:
- active >=150: PASS
- Trend precision >=0.70: PASS
- C0 >0: FAIL
- C1 >0: FAIL
- C1 better than trade-all: FAIL
- C2 >=0: FAIL
- both directions >=50: PASS

## Structural implication
Do not trade directly at Transition onset based only on the current Logistic probability.

The next layer should exploit the first transition bar itself.

Evaluation State Engine timing:
- 302 / 454 resolved episodes finish in 1 bar
- 89 finish in 2 bars
- 63 finish in 3 bars

For actual Trend resolutions:
- delay 1: 245 / 280 = 87.5%
- delay 2: 14
- delay 3: 21

For RANGE resumptions:
- delay 1: 57
- delay 2: 75
- delay 3: 42

Among episodes still unresolved after the first transition bar:
- total = 152
- later Trend = 35
- later RANGE = 117
- only ~23% later become Trend

This suggests a simple architecture:
RANGE
-> TRANSITION: Scalper OFF
-> wait one H1 transition bar
-> if causal FSM confirms TREND: Swing candidate
-> if still unresolved: remain flat / treat as high fake-break risk
-> if RANGE resumes: Scalper may later resume

## Decision
- Logistic remains useful as a transition research feature, not an execution gate.
- Do not tune its threshold on this evaluation.
- Do not promote DTW memory.
- Next: fast-confirmation Swing audit using the frozen FSM's first-bar resolution, with entry only after the causal confirmation bar.
- Historical Holdout remains closed.
