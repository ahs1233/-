# GTG Transition Logistic Shadow v0.1 — post-selection execution audit

Registered 2026-10-03 before model-conditioned execution outcomes are computed.

## Status
This is a post-selection diagnostic, not an independent confirmatory test.

Why:
- Transition Memory v0.1 preregistered multiple fixed models.
- Logistic was strongest on the frozen 2021-2024 evaluation.
- Selecting Logistic for this next audit occurs after seeing those classification results.

Therefore:
- this audit may test whether the classification signal maps to execution economics,
- it may not establish a new independent edge,
- it may not authorize Historical Holdout access.

## Frozen inputs

Transition Memory v0.1:
- frozen_memory SHA256:
  0dc860e3291e3f288580aa7b52187f86d05108fc44d67061da0320a8db82e410
- evaluation_predictions SHA256:
  a4da81fef57742c86d3ee341eef8862e9bd9321bca69917798b830b7927e0e6c
- summary SHA256:
  87f2cd444d11a859d35d735d0a989be7660e78ddad86f87d0d49e6e2576dd528

State Engine v0.2 transition library SHA256:
- e134c33eac1109efa7c1e81ad7d71de238344ad0fb763e0e93c47b29d2b5a565

Logistic model:
- exact frozen coefficients/intercept from Transition Memory v0.1
- no refit
- no feature change
- no calibration change
- no probability threshold change

Gate:
- TRADE candidate iff p_logistic >= 0.50
- otherwise STAND_DOWN

Direction:
- use frozen causal onset candidate_direction from State Engine v0.2

## Cohort
Only Transition Memory v0.1 frozen evaluation rows:
- 2021-01-01 <= onset < 2024-03-20
- resolved primary events only
- 454 expected events
- unresolved events excluded exactly as in v0.1

No event may be added or removed based on future return or execution outcome.

## Price data
Canonical local JForex BID/ASK complete H1 bars.
Raw gate unchanged:
- timestamp < 2024-03-20T00:00:00Z

No Validation/Historical Holdout beyond this existing library-comparison window.

## Execution contract
For each eligible event at onset bar t:
- direction = candidate_direction
- enter at open(t+1)
- exit at close(t+h)
- horizons h = 4, 12, 24 complete H1 trading bars
- path must use the same <=3h operational continuity rule as State Engine v0.2
- if endpoint/path unavailable, censor that event for that horizon only
- ATR denominator = ATR[t]

Cost arithmetic:
- reuse compare.costs exactly
- C0: side-aware BID/ASK execution with zero extra slippage benchmark
- C1: existing benchmark spread + 0.5*spread slippage on entry and exit
- C2: doubled benchmark friction
- no stop, target, trailing logic, leverage, position sizing, compounding, or re-entry

## Policies

### A. ALL_TRANSITIONS
Trade every resolved primary Transition in its onset candidate direction.

Purpose:
- raw breakout/transition baseline.

### B. LOGISTIC_GATE
Trade only if frozen p_logistic >=0.50.

Purpose:
- test whether the frozen onset classifier removes enough false transitions to improve economics.

### C. ORACLE_TREND_SUBSET — descriptive upper bound only
Trade only events whose frozen FSM resolution later became TREND_CONFIRMED.

This is impossible to know at onset and may never be treated as an executable comparator.
It exists only to show the headroom between the classifier and perfect transition classification.

## Metrics
For each policy and each horizon:
- eligible opportunities
- active trades
- coverage
- actual TREND_CONFIRMED precision among active trades
- directional accuracy of final displacement
- C0/C1/C2 mean per trade
- C0/C1/C2 mean per original opportunity
- C1 win rate
- mean signed close displacement / ATR
- mean MFE / ATR
- mean MAE / ATR
- fraction returning inside the frozen source range before exit

For LOGISTIC_GATE also report:
- avoided events
- avoided RANGE_RESUMED count
- avoided TREND_CONFIRMED count
- false-trend trades
- class precision by candidate up/down
- yearly coverage and C1 mean/trade when n>=10

## Registered diagnostic screen
LOGISTIC_GATE is marked "economically interesting for further testing" only if all hold at h=4:

1. active trades >=150
2. actual TREND_CONFIRMED precision >=0.70
3. C0 mean/trade >0
4. C1 mean/trade >0
5. C1 mean/trade > ALL_TRANSITIONS C1 mean/trade
6. C2 mean/trade >=0
7. both up and down sides have >=50 active trades

The screen is deliberately demanding.
Passing is not independent validation because Logistic was selected after Transition Memory v0.1 evaluation.

For h=12 and h=24:
- report all metrics,
- no pass/fail threshold,
- do not choose the best horizon as a new primary result.

## Integrity
Before accepting:
- all four frozen input SHA256 values unchanged
- exact timestamp join between classifier predictions and transition events
- exact candidate direction match
- H1 raw manifest matches State Engine v0.2
- path continuity <=3h
- entry strictly after onset
- no actual resolution label used by LOGISTIC_GATE decision
- no threshold tuning
- Validation read=false
- Historical Holdout read=false

## Decision
If h=4 screen fails:
- do not tune probability threshold on this evaluation;
- retain Logistic only as a state-resolution research signal.

If h=4 screen passes:
- freeze the Logistic gate as a candidate;
- the next required step is a new independent temporal gate before any Holdout decision.

No Holdout opens automatically.
