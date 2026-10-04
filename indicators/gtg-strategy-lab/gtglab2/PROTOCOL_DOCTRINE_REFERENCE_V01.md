# GTGLab2 — Doctrine Reference Experiment v0.1

Status: PREREGISTERED BEFORE FIRST RUN
Registered: 2026-10-04

## Purpose

Run one deterministic development-only screen of the newly frozen doctrine.
This is not the Final Holdout and it is not a release claim.

Primary paired question:

**Given exactly the same opportunity and exit episode, does a fixed-risk staged entry improve economic outcome relative to a single full entry?**

Secondary descriptive question:

**Do causal MTF/session context filters improve the same frozen opportunities?**

## Data boundary

Canonical historical source:
- JForex XAU/USD
- H1 built from canonical M1
- BID signal prices
- ASK retained for execution

Scope:
- 2018-03-01 through 2024-03-20 exclusive
- inherited State Engine v0.2 sequence
- Historical Holdout: NOT READ
- Pristine Forward OOS: NOT READ
- forward microstructure outcomes: NOT READ

Time split for stability reporting only:
- early: before 2021-01-01
- late: 2021-01-01 onward

No fitting is performed on either block.

## Opportunity contracts

### Range Long
- state == RANGE
- position24 <= 0.20

### Range Short
Mirror:
- state == RANGE
- position24 >= 0.80

Frozen range:
- lower = prior24_lower at decision
- upper = prior24_upper at decision
- midpoint = (lower + upper)/2

Range exit signal, evaluated at H1 close:
- target: close reaches/crosses frozen midpoint in trade direction
- invalidation: opposite TREND state OR two consecutive closes beyond frozen opposite boundary
- timeout: 12 H1 bars

Execution occurs at next H1 open after the signal.

### Trend Long
- state == TREND_UP
- close <= EMA21
- close >= EMA50
- EMA21 > EMA50
- EMA50 slope > 0

### Trend Short
Exact mirror:
- state == TREND_DOWN
- close >= EMA21
- close <= EMA50
- EMA21 < EMA50
- EMA50 slope < 0

Trend exit signal:
- opposite TREND state, OR
- close crosses through EMA50 against the position
- timeout: 24 H1 bars

Execution occurs at next H1 open after the signal.

## Context-filter variant

A second, frozen opportunity set is reported.

Range:
- reject Long if the current session has accepted below the previous session low
- reject Short if accepted above the previous session high
- require MTF alignment score not maximally opposite:
  - Long >= -1
  - Short <= +1

Trend:
- Long requires MTF alignment score >= +1
- Short requires MTF alignment score <= -1

MTF score is the sign sum of causal EMA50 slope on:
- H1
- latest completed H4
- latest completed D1

No current incomplete H4/D1 bar may be used.

## Entry policies

### SINGLE
At the next H1 open:
- allocate normalized risk weight 1.00

### STAGED
Maximum 5 tranches, each risk weight 0.20.

T1:
- next H1 open.

Additional Range Long tranche:
one maximum per H1 bar when hypothesis remains valid and at least one occurs:
- sweep/reclaim of frozen lower boundary,
- reclaim above EMA9 from below,
- rejection of previous session low,
- positive continuation close above prior close and EMA9.

Range Short is the exact mirror.

Additional Trend Long tranche:
one maximum per H1 bar when hypothesis remains valid and at least one occurs:
- EMA21 intrabar test/reclaim,
- EMA9 reclaim from below,
- positive continuation (higher high and higher close).

Trend Short is exact mirror.

No tranche after an invalidation signal.

## Risk normalization

For a tranche with weight w:
units = w / ATR_at_fill_signal

Maximum sum of weights per idea = 1.00.

Thus SINGLE and STAGED have the same maximum normalized risk envelope.
If STAGED receives fewer than five confirmations, unused risk remains unused.

## Execution

Long entry = ASK open.
Long exit = BID open.
Short entry = BID open.
Short exit = ASK open.

Spread is therefore native to the canonical BID/ASK data.

Slippage scenarios:
- C0 = 0.0 bps
- C1 = 0.5 bps
- C2 = 1.0 bps

No commission is added in this reference screen.

## Metrics

Report overall and by:
- SINGLE vs STAGED
- RANGE vs TREND
- LONG vs SHORT
- early vs late block
- base vs context-filtered

Metrics:
- episode count
- normalized PnL R mean/median/total
- win rate
- max drawdown in R
- average staged tranches
- paired STAGED - SINGLE difference
- proportion of episodes where STAGED beats SINGLE
- exit-kind counts

## Interpretation

This is a falsification screen.

PASS is not declared merely because one aggregate mean is positive.
A result is structurally interesting only if:
- late block is not dependent on one direction,
- economics survive spread and C1/C2 slippage,
- staged improvement is not caused only by using less exposure,
- no protocol lock is violated.

No parameter will be changed after the first result inside v0.1.
