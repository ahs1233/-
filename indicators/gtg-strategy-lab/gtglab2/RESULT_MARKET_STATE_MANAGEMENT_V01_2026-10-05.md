# RESULT — Market State Engine + Management v0.1

Date: 2026-10-05

## Objective
Move GTGLab2 from one-rule-fits-all logic to:
Market State Reader -> Situation Filter -> Entry Trigger -> Trade Management.

The entry triggers were frozen from the prior preregistered transition study:
- Scalper: HIGHER_LOW_BREAK
- Swing: HIGH_RECLAIM

No entry-rule switching was allowed.

2025-2026 is already consumed historical data and is reported only as diagnostic.
Pristine Forward OOS remained unread.

## State Engine
The engine learned 6 unsupervised price states on 2018-2022 only using causal H1/M15/M5 structure.

No trade outcome, year label, macro input, or future bar was used to create states.

### State 0 — Strong Downtrend / Deep Low
Typical center:
- H1 5H drift: -2.11 ATR
- H1 efficiency: 0.76
- H1 24H position: 0.13
- decline from 24H high: 4.90 ATR
- M15 5H drift: -2.04 ATR

Meaning:
Price is genuinely low, but sellers still control a directional move.

### State 1 — Balanced Range / Weak Micro Pressure
- H1 nearly flat
- H1 24H position around middle
- low directional efficiency
- mild short-term downside

### State 2 — Strong Uptrend / High Zone
- H1 5H drift: +2.15 ATR
- H1 24H position: 0.90
- strong directional efficiency
- essentially not a bottom-buying environment

### State 3 — Fast Micro Rebound inside Neutral H1
- H1 broadly flat
- M15 and M5 strongly positive
- rebound is already underway

### State 4 — Range Recovery / Local Bounce
- H1 broadly neutral
- M15 broadly neutral
- M5 closes strongly after local weakness
- low trend efficiency

### State 5 — Local Selloff inside Broader Neutral Structure
- H1 broadly neutral
- M15/M5 show sharp short-term selling
- not the same as a full H1 downtrend

## Scalper

Accepted states from Train + Validation only:
- State 0
- State 5

State 0:
- Train: 1,093 trades, +19.639R, PF 1.052
- Validation: 426 trades, +1.094R, PF 1.007
- Consumed 2025-2026: 367 trades, -6.161R, PF 0.953

State 5:
- Train: 561 trades, +9.414R, PF 1.049
- Validation: 264 trades, +8.052R, PF 1.091
- Consumed 2025-2026: 202 trades, -0.579R, PF 0.992

Selected management: FIXED

Gated FIXED:
- Train: 1,716 trades, +36.173R, PF 1.061
- Validation: 717 trades, +12.872R, PF 1.051
- Consumed 2025-2026: 592 trades, -11.680R, PF 0.946

2025: -1.614R, PF 0.985
2026: -10.066R, PF 0.907

Management diagnostics:
- PROTECT_HALF did not solve expectancy.
- HALF_OUT_PROTECT reduced some loss but still failed consumed history.
- Early defensive management is not the core Scalper problem.

Decision:
Scalper remains NOT PROMOTED.

## Swing

Accepted states from Train + Validation only:
- State 0
- State 4
- State 5

State 0 — Strong Downtrend:
- Train: 731 trades, +1.222R, PF 1.003
- Validation: 290 trades, +3.383R, PF 1.018
- Consumed 2025-2026: 254 trades, -12.438R, PF 0.926

State 4 — Range Recovery:
- Train: 182 trades, +23.231R, PF 1.232
- Validation: 73 trades, +16.451R, PF 1.411
- Consumed 2025-2026: 69 trades, +9.220R, PF 1.220

State 5 — Local Selloff / Neutral Higher Context:
- Train: 322 trades, +0.115R, PF 1.001
- Validation: 153 trades, +16.886R, PF 1.184
- Consumed 2025-2026: 123 trades, +1.459R, PF 1.019

Selected management: FIXED

Gated FIXED:
- Train: 1,237 trades, +22.568R, PF 1.029
- Validation: 520 trades, +38.504R, PF 1.120
- Consumed 2025-2026: 447 trades, -2.760R, PF 0.990

Year diagnostic:
- 2025: +39.167R, PF 1.284
- 2026: -41.927R, PF 0.722

Management candidates:
- FIXED: selected
- PROTECT_HALF: failed Train
- HALF_OUT_PROTECT: technically passed Train/Validation but was weaker than FIXED by preregistered ranking

## Main discovery

The same M5 transition does NOT have the same meaning in every market state.

The major diagnostic is State 0:
a strong, efficient H1 downtrend can produce a valid-looking M5 rejection/reclaim while the larger sell wave is still active.

That state was only marginally positive in Train/Validation:
- Swing PF 1.003 / 1.018

and later became clearly harmful:
- consumed 2025-2026 PF 0.926

By contrast, State 4 was materially stronger across all historical segments:
- Train PF 1.232
- Validation PF 1.411
- consumed 2025-2026 PF 1.220

State 5 was also much more stable than State 0.

This explains an important part of the 2025 vs 2026 instability:
the problem is not only the M5 entry trigger.
It is whether the low occurs inside:
- a still-active larger sell wave, or
- a neutral/range structure where short-term selling is exhausting.

## Management conclusion
Simple defensive management did not rescue bad context.
Moving stop to breakeven early can cut winners as well as losers.

Therefore management must come AFTER correct situation reading.
It cannot compensate for entering the wrong market state.

## Decision
Market State Engine is RETAINED as architecture.
No production Execution Candidate is promoted yet.

Do NOT cherry-pick State 4 alone after viewing consumed 2025-2026.

Next research direction:
improve state robustness using only 2018-2024 information so the engine can distinguish:
1. active directional sell wave,
2. exhausted sell wave,
3. neutral/range low,
4. early reversal,
before M5 execution.

Pristine Forward OOS remains unread.
