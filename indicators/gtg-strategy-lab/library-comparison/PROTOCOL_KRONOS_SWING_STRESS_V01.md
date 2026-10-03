# Kronos Swing Stress v0.1 — preregistered Train-only robustness test

Registered 2026-10-03 before reading or scoring the stress-period outcomes.

## Purpose
Stress-test the previously observed Kronos-mini Swing signal on a later, longer, strictly Train-only period and characterize when the signal works or fails without tuning Kronos or promoting post-hoc filters.

The prior completed replication used 2020-07-01 <= anchors < 2021-07-31 and found Kronos-mini Swing:
- direction accuracy ~56.1%
- C0 +0.206 ATR/trade
- C1 +0.044 ATR/trade
- C2 -0.119 ATR/trade

That result motivates this stress test but does not alter the rules below.

## Isolation
- Frozen GTG Navigator and TRADE_CONTRACT untouched.
- Validation and Historical Holdout remain closed.
- No model fine-tuning.
- No threshold tuning from stress outcomes.
- Kronos source and model/tokenizer revisions remain pinned exactly to the prior run:
  - source: 67b630e67f6a18c9e9be918d9b4337c960db1e9a
  - NeoQuasar/Kronos-Tokenizer-2k: 26966d0035065a0cae0ebad7af8ece35bc1fb51c
  - NeoQuasar/Kronos-mini: f4e68697d9d5aed55cef5c96aabc3376bcad9f81

## Data boundary
Canonical local JForex BID/ASK M1 store only.

Warm-up/raw read window:
- 2021-09-01 <= raw timestamp < 2024-03-20T00:00:00Z.

Scored anchor window:
- 2021-10-01 <= anchor < 2024-03-20T00:00:00Z.

This ends before the known Train cutoff at 2024-03-20T15:20:24.500Z.
No raw row at or after 2024-03-20T00:00:00Z may be opened.
SHA256 every raw daily file used.

## Track
Swing only:
- complete H1 bars
- context W=96 bars, identical to prior Kronos comparator
- prediction horizon h=4 H1 bars
- target = (BidClose[t+4] - BidClose[t]) / ATR[t]
- ATR = same simple rolling 14-bar true range used by library-comparison
- hypothetical entry = open t+1
- exit = close t+4
- C0/C1/C2 arithmetic identical to prior side-aware benchmark

## Cohort construction
Ten calendar-quarter cohorts:
- 2021Q4
- 2022Q1
- 2022Q2
- 2022Q3
- 2022Q4
- 2023Q1
- 2023Q2
- 2023Q3
- 2023Q4
- 2024Q1 partial, ending strictly before 2024-03-20T00:00:00Z

For each cohort:
- derive eligible anchors by timestamp/availability only
- require W=96 causal context bars
- require a contiguous h=4 future path
- target must mature inside the same registered quarter/window
- candidate target windows may not overlap
- select exactly 60 deterministic evenly spaced eligible anchors if available

Expected total = 600 anchors.
Every comparator uses identical anchors.

## Comparators
1. flat
2. 12-bar drift
3. causal base Directional Change direction, threshold 0.005
4. pinned Kronos-mini

Kronos status remains PRETRAINED_CONTAMINATION_UNKNOWN.

## Primary robustness screen
Kronos is considered to have replicated a useful Train-only signal only if all are true:
- exactly 600 scored anchors
- overall C0 mean/trade > 0
- overall C1 mean/trade > 0
- at least 6 of 10 quarter cohorts have positive C1 mean/trade
- overall directional accuracy > 0.52
- Kronos overall C1 mean/trade > drift overall C1 mean/trade

Cost robustness is reported separately:
- C2 >= 0 => cost-robust at doubled benchmark
- C2 < 0 => cost-fragile; not production-ready even if primary screen passes

No criterion may be changed after outcomes are read.

## Predefined diagnostic regimes — descriptive only
These bins are fixed before stress outcomes. They may explain behavior but may NOT be promoted into a trading filter from this same stress sample.

At every anchor compute using t-or-earlier information only:

### A. Prediction strength vs current cost proxy
cost_proxy = 2 * (AskClose[t] - BidClose[t]) / ATR[t]
strength_ratio = abs(Kronos prediction ATR) / cost_proxy
Bins:
- <0.5
- 0.5 to <1
- 1 to <2
- >=2

### B. Absolute prediction magnitude
- <0.25 ATR
- 0.25 to <0.5
- 0.5 to <1
- >=1

### C. Agreement
Compare sign(Kronos) with:
- sign(12-bar drift)
- base DC direction
Bins:
- agrees with neither
- agrees with exactly one
- agrees with both

### D. Causal volatility regime
At each anchor, compute current ATR/close and its percentile rank versus the previous 60 calendar days of completed H1 bars only.
Bins:
- low: <=33rd percentile
- mid: >33rd and <67th
- high: >=67th percentile

### E. Current spread regime
spread_atr = (AskClose[t] - BidClose[t]) / ATR[t]
Use fixed absolute bins:
- <=0.05
- >0.05 to <=0.10
- >0.10

### F. UTC session
By anchor hour UTC:
- Asia: 00:00-06:59
- London: 07:00-12:59
- New York: 13:00-20:59
- Late: 21:00-23:59

For every diagnostic bin publish:
- n
- direction accuracy
- C0/C1/C2 mean/trade
- C1 win rate

No minimum-n bin is interpreted if n < 30.

## Stability diagnostics
Publish:
- quarter-by-quarter C0/C1/C2 and direction accuracy
- half-year aggregates
- cumulative C1 contribution by quarter
- best and worst quarter
- share of total positive C1 contributed by the single best quarter
- Wilson 95% interval for direction accuracy overall
- mean prediction ATR and mean absolute prediction ATR

These are descriptive uncertainty/stability diagnostics, not proof of live profitability.

## Integrity checks
Before accepting results:
- raw date gate PASS
- source manifest hashes recorded
- complete H1 aggregation
- exactly 60 anchors per registered quarter
- exactly 600 total anchors
- no overlapping target windows within a cohort
- target matures inside its own cohort
- identical frozen anchors for all comparators
- pinned source/model/tokenizer revisions PASS
- same-seed repeat on first anchor of every quarter PASS
- DC prefix causality on first anchor of every quarter PASS
- regime features use only t-or-earlier data
- Validation read = false
- Holdout read = false

## Decision after this run
- If primary screen fails: do not tune Kronos on these stress outcomes. Record failure and reconsider representation/model family.
- If primary screen passes but C2 fails: mark Kronos as cost-fragile; only a new preregistered selective-cost experiment may test a filter.
- If primary screen and C2 pass: Kronos becomes a candidate for one further independent Train gate before any Holdout decision.

No Holdout opens automatically.
