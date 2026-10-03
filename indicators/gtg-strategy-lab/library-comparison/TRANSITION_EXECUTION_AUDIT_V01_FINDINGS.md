# GTG Transition Execution Audit v0.1 — Findings

Date: 2026-10-03
Scope: post-selection Train-development execution diagnostics.
Validation/Historical Holdout remained closed.

## Components completed
1. Transition Logistic Shadow v0.1:
   - frozen Logistic classifier from Transition Memory v0.1
   - p_logistic >= 0.50 gate
   - entry at first bar after Transition onset

2. Confirmed Handoff Execution v0.1:
   - frozen State Engine v0.2 / Handoff v0.3
   - enter only after TRANSITION resolves to TREND_UP/TREND_DOWN
   - entry at first bar after confirmation

Both use the same canonical JForex BID/ASK H1 source and compare.costs C0/C1/C2 arithmetic.

## Integrity
PASS:
- frozen input hashes unchanged
- exact event joins
- candidate/resolved direction contracts
- source manifest unchanged
- entry occurs after the causal decision bar
- <=3h trading continuity unchanged
- no threshold tuning
- Validation read=false
- Historical Holdout read=false

## 4-hour comparison

### A. ALL_TRANSITIONS — trade every attempted exit immediately
- active: 445
- direction accuracy: 46.29%
- C0/trade: -0.151 ATR
- C1/trade: -0.337 ATR
- C2/trade: -0.524 ATR
- C1 win rate: 39.78%

Clearly negative.

### B. LOGISTIC_GATE at Transition onset
- active: 317
- coverage: 71.24%
- true-trend precision: 77.60%
- avoided 128 events:
  - 101 RANGE-resumed
  - 27 true trends
- direction accuracy: 46.37%
- C0/trade: -0.182 ATR
- C1/trade: -0.361 ATR
- C2/trade: -0.541 ATR
- C1 win rate: 39.12%

The classifier is useful for state resolution but does NOT create a profitable immediate-entry rule.
It removed many false breaks, yet the remaining onset entries were still badly timed.

Registered h4 screen: FAIL.

### C. CONFIRMED_HANDOFF — wait for deterministic TREND confirmation
- active: 268
- direction accuracy: 48.51%
- C0/trade: +0.100 ATR
- C1/trade: -0.076 ATR
- C2/trade: -0.252 ATR
- C1 win rate: 43.28%

This is much better than A/B:
- raw directional expectancy turns positive before friction,
- C1 loss is much smaller,
but realistic C1 is still negative at 4 hours.

Registered h4 screen: FAIL.

### D. ORACLE_TREND_SUBSET at onset — impossible upper bound
- active: 273
- direction accuracy: 56.78%
- C0/trade: +0.477 ATR
- C1/trade: +0.295 ATR
- C2/trade: +0.113 ATR

This uses the future-known resolution label and is not executable.
It demonstrates that there is substantial economic value in identifying the true trend cases early enough.

## Confirmed Handoff by horizon

### 4 bars
- n=268
- C0 +0.100
- C1 -0.076
- C2 -0.252
- C1 win 43.28%

### 12 bars
- n=231
- direction accuracy 48.48%
- C0 +0.190
- C1 +0.009
- C2 -0.172
- C1 win 44.59%

### 24 bars
- n=213
- direction accuracy 53.99%
- C0 +0.218
- C1 +0.045
- C2 -0.128
- C1 win 51.64%

Interpretation:
- waiting for confirmation materially improves the economics,
- the confirmed move needs more than 4 hours to express itself,
- at 12/24 trading bars it barely clears C1,
- it remains cost-fragile under C2.

No best-horizon selection is allowed from this audit.

## Direction asymmetry — descriptive only

Confirmed handoff at 24 bars:

UP:
- n=115
- direction accuracy 57.39%
- C1 +0.303 ATR/trade
- C2 +0.130 ATR/trade

DOWN:
- n=98
- direction accuracy 50.00%
- C1 -0.257 ATR/trade
- C2 -0.431 ATR/trade

This is a large asymmetry, but it is post-hoc and occurs during a historical period with substantial gold appreciation.
It must NOT be converted directly into a long-only rule from this same sample.

## Time instability

Confirmed handoff C1/trade:

4 bars:
- 2021: -0.190
- 2022: +0.054
- 2023: -0.113
- 2024 partial: -0.029

12 bars:
- 2021: +0.410
- 2022: +0.357
- 2023: -0.572
- 2024 partial: -1.344

24 bars:
- 2021: +0.684
- 2022: +0.121
- 2023: -0.652
- 2024 partial: +0.216 (n=10)

The confirmed handoff is not temporally stable enough to call a general edge.

## Main conclusion

The architecture should remain:

RANGE
-> TRANSITION
-> stop Scalper
-> Transition classifier/memory estimates whether exit is real
-> deterministic confirmation controls state routing
-> separate Swing Entry Timing layer decides whether/when to enter

What failed:
- every breakout as Swing entry
- Logistic p>=0.50 as immediate Swing entry
- deterministic confirmation as a complete 4h Swing entry rule

What survived:
- State Engine is useful for routing
- Logistic is useful for identifying likely real vs false transitions
- true trend episodes contain substantial early economic value
- confirmed trend has small positive C1 expectancy only at longer 12/24-bar horizons, but is cost-fragile and unstable

## Next research requirement

Do NOT tune the current evaluation.

The next causal feature should be a Swing Entry Timing layer that answers:
- after a likely/confirmed trend, are we entering after an exhaustion impulse or after a usable pullback/retest?
- can we distinguish continuation setup from late entry?

Candidate causal inputs:
- distance from frozen range boundary / ATR
- impulse size from Transition onset to current bar
- pullback depth after breakout
- retrace ratio
- bars since breakout
- current DC leg age/amplitude/speed
- whether price retested the frozen boundary
- spread/ATR
- volatility state

This must be preregistered in a new experiment.
No Historical Holdout opens automatically.
