# GTG Structural Range Box Scalper v0.1

Registered 2026-10-03 before outcomes.

## Purpose
Replace the rolling prior-24-bar channel with a causal structural box built from confirmed Directional Change pivots inside the current frozen RANGE episode. State Engine v0.2 remains the routing authority. RANGE may scalp; TRANSITION/TREND means no new scalper trade and causal exit of any open trade.

## Evidence status
Train-development diagnostic only. Validation and Historical Holdout remain closed.

## Frozen inputs
State Engine v0.2 state file SHA256: cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772
State content SHA256: c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e
Canonical manifest SHA256: 30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

Reuse compare.dc_states exactly with threshold 0.0025. A pivot becomes usable only on its confirmation bar; never backdate pivot availability.

## Structural box lifecycle
When state != RANGE: clear structural-box pivot memory.
When state = RANGE: process only a newly confirmed 0.0025 DC event at the current H1 close.
Fresh DC +1 contributes its pivot_price as a confirmed LOW.
Fresh DC -1 contributes its pivot_price as a confirmed HIGH.
Hard gap >3h clears memory before the new bar.

## Box maturity
Require at least 2 confirmed LOW pivots and 2 confirmed HIGH pivots within the same uninterrupted RANGE episode. Use the latest 2 of each.
Lower = median(latest 2 lows). Upper = median(latest 2 highs).
Require upper > lower, current close inside [lower, upper], and finite positive ATR. No fitted dispersion tolerance.

## Entry
Use same simple quartile/rejection logic as Range Scalper v0.1, but on the structural box.
Long: state=RANGE, mature box, close position <=0.25, BidClose>BidOpen.
Short: state=RANGE, mature box, close position >=0.75, BidClose<BidOpen.
Enter next H1 open, require gap >0 and <=3h, same reporting split, one active trade only.
Freeze lower/upper/midpoint/width/ATR_ref and the four pivot confirmation timestamps/prices defining the box.

## Exit priority
At each held bar close:
1. midpoint target: long close>=midpoint, short close<=midpoint.
2. frozen structural-boundary invalidation: long close<lower, short close>upper.
3. State handoff: State Engine state != RANGE.
Execute next H1 open. No intrabar fills.
Reasons: TARGET, BOUNDARY_INVALIDATION, STATE_EXIT, TARGET_AND_STATE_EXIT, BOUNDARY_AND_STATE_EXIT.

## Gaps and splits
No hard-gap bridging. Gap >3h while flat resets structural-box memory. Gap >3h while in trade censors trade with no PnL and scanning resumes after gap with empty memory. No split crossing.

## Costs
Reuse compare.costs exactly with open-to-open execution and C0/C1/C2. ATR denominator is ATR_ref from signal bar.

## Splits
Library: timestamp < 2021-01-01.
Evaluation: 2021-01-01 <= timestamp < 2024-03-20T00:00:00Z.
No fitting or outcome-based threshold selection.

## Metrics
Per split: RANGE bars, mature-box bars, mature-box coverage, flat candidate signals, completed/censored trades, long/short, exit reasons, C0/C1/C2 mean/trade, C1 win rate, duration, MFE/MAE, by direction and calendar year n>=20.
Descriptive box diagnostics only: box width/ATR, age of oldest/newest defining confirmation, low-pivot dispersion/ATR, high-pivot dispersion/ATR. No diagnostic subgroup may be promoted.

## Registered stability screen
All must hold:
1. library completed trades >=100
2. evaluation completed trades >=100
3. evaluation long >=40
4. evaluation short >=40
5. mature-box RANGE coverage >=0.20 in both splits
6. library C1 >0
7. evaluation C1 >0
8. library C2 >=0
9. evaluation C2 >=0
10. library C1 win >0.50
11. evaluation C1 win >0.50
12. at least two of 2021/2022/2023 positive C1 with n>=20
13. no full evaluation year >60% of completed trades
14. evaluation C1 > Range Scalper v0.1 (-0.1811011019)
Passing remains development evidence only.

## Integrity
Protocol committed before run. State hashes and canonical manifest unchanged. DC threshold exactly 0.0025. Pivot usable only when confirmed_at equals current bar. Pivot memory resets outside RANGE and across hard gap. Require 2 highs + 2 lows. Box uses only confirmed pivots in current RANGE episode. Box frozen per trade. Entry next open. One active trade. Exit next open after close signal. No hard-gap bridging. No split crossing. No outcome-derived threshold. Validation read=false. Historical Holdout read=false.

## Decision
If pass: freeze Structural Range Box as RANGE execution candidate and require a new temporal/forward validation before Holdout.
If fail: do not tune DC threshold, pivot count, quartiles or midpoint on this sample. Conclude simple manual mean reversion inside the current RANGE definition is not robust enough; next step becomes joint state+strategy learning rather than more manual Range rules.

## Implementation clarification before outcomes
A newly confirmed DC pivot is eligible for the current RANGE episode only when both:
- confirmed_at equals the current H1 bar index, and
- pivot_at is at or after the current uninterrupted RANGE episode start index.

This prevents a pivot whose extreme occurred in the preceding TREND/TRANSITION episode from being imported into the new RANGE box. This clarification was fixed before the Structural Range Box runner was executed.
