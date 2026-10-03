# GTG DC Correction -> Resumption H4 — Validation Findings v0.1

Date: 2026-10-03
Verdict: **FAIL**

This is the first formal Validation dry run performed by the library-comparison research branch.

Historical Holdout was NOT opened.
Pristine OOS was NOT read.

## Candidate identity

Train-selected rule frozen before Validation:

RANGE
-> TRANSITION
-> confirmed TREND_UP / TREND_DOWN
-> fine DC 0.0025 confirms correction against Trend
-> macro DC 0.005 remains aligned with Trend
-> fine DC 0.0025 freshly confirms resumption with Trend
-> enter next H1 open
-> fixed H4 = 4 trading H1 bar outcome

No H12/H24, delay filter, geometry filter, direction filter, year filter, or threshold modification was carried into Validation.

## Frozen Validation boundaries

Authoritative TRADE_CONTRACT v0.2.3 split:

- first valid: 2021-09-08T17:00:00Z
- Train end: 2024-03-20T15:20:24.500Z
- usable Validation start after embargo: 2024-03-20T19:20:24.500Z
- usable Validation end before embargo: 2025-03-25T01:04:34.300Z
- Historical Holdout starts: 2025-03-25T05:04:34.300Z
- raw loader cap used: 2025-03-25T01:00:00Z

No Holdout timestamp was read.

## Prefix integrity gate

The first technical attempt stopped BEFORE DC signals or Validation trade outcomes because exact binary float comparison against the CSV-serialized Train state showed only CSV round-trip noise.

Observed maximum absolute float difference:
- 3.552713678800501e-15

A pre-outcome addendum was committed:
- state labels: exact
- timestamps: exact
- booleans: exact
- DC directions/counts/range_votes: exact
- continuous float features: rtol=0, atol=1e-12

The official run then passed:

- Train rows compared: 34,816
- state content SHA256 matched:
  c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e
- max continuous difference: 3.552713678800501e-15
- prefix parity: PASS

Therefore the Validation State Engine is the same frozen causal engine, extended forward rather than refit.

## Validation cohort

Confirmed primary Trend resolutions in usable Validation:
- 82

DC-resumption status:
- valid DC_RESUMPTION_ENTRY: 21
- MACRO_REVERSAL_DURING_CORRECTION: 21
- MACRO_REVERSAL_BEFORE_CORRECTION: 10
- NO_FINE_CORRECTION_BEFORE_TREND_END: 10
- NO_RESUMPTION_BEFORE_TREND_END: 11
- HARD_GAP: 9

Mature H4 trades before end embargo:
- 20

Direction:
- up: 16
- down: 4

Registered sample-adequacy conditions all PASS:
- total >=10
- up >=3
- down >=3

So the result is not classified INCONCLUSIVE.

## Validation economics

Overall n=20:

- direction accuracy: 65.0%
- C0: **+0.0908 ATR/trade**
- C1: **-0.0542 ATR/trade**
- C2: **-0.1991 ATR/trade**
- C1 win rate: 65.0%
- mean signed displacement: +0.0911 ATR
- mean MFE: 1.1670 ATR
- mean MAE: 1.0508 ATR

Timing:
- median correction delay: 7 bars
- median correction duration: 2.5 bars
- median total resolution -> resumption delay: 11 bars

## Direction

UP, n=16:
- accuracy 68.75%
- C0 +0.0913
- C1 **-0.0606**
- C2 -0.2125
- C1 win 68.75%

DOWN, n=4:
- accuracy 50.0%
- C0 +0.0888
- C1 **-0.0283**
- C2 -0.1454
- C1 win 50.0%

Both directions fail the registered non-negative C1 condition.

## Registered PASS screen

PASS:
- mature H4 >=10
- up >=3
- down >=3
- C0 >0
- C1 win rate >50%

FAIL:
- C1 >0
- C2 >=0
- up C1 >=0
- down C1 >=0

Therefore:

# Validation verdict = FAIL

## Descriptive half-period split — NOT a filter

First half:
- n=9
- C1 -0.3588
- C2 -0.4875

Second half:
- n=11
- C1 +0.1951
- C2 +0.0368

This split was not preregistered as a selector.
It MUST NOT be converted into a date/regime/filter rule from this Validation result.

## Interpretation

The Train-development result was:
- later Train H4 C1 +0.294
- C2 +0.135
- direction accuracy ~64%

Validation preserved similar directional accuracy (65%) but the economic edge disappeared after spread/slippage.

This is an important distinction:
- the structural pattern still often points in the right direction,
- but the average H4 displacement is too small relative to execution friction to qualify as a robust edge.

The candidate therefore does not justify Historical Holdout access.

## Decision

1. Close DC Correction -> Resumption H4 as a validated trading-edge candidate.
2. Do NOT open Historical Holdout.
3. Do NOT tune:
   - DC thresholds,
   - correction delays,
   - direction,
   - calendar period,
   - H4 holding horizon,
   - probability or cost filters
   from this Validation.
4. Do NOT promote the positive second-half subgroup.
5. Historical Holdout remains locked.
6. Future XAU strategy work requires genuinely new/pristine temporal data or a separately frozen research program; the already-observed Validation can no longer serve as an independent selector for a new candidate.

## Integrity

PASS:
- protocol committed before Validation read
- candidate freeze committed before Validation read
- explicit Validation-open commit
- pre-outcome parity amendment documented and committed
- Train state prefix parity PASS
- fine DC = 0.0025
- macro DC = 0.0050
- H4 = 4 trading H1 bars only
- end embargo respected
- no Holdout timestamp read
- Historical Holdout read=false
- Pristine OOS read=false
