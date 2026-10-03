# GTG DC Correction -> Resumption H4 Validation v0.1 — Findings

Date: 2026-10-03
Evidence status: FORMAL VALIDATION DRY RUN of a Train-selected candidate.
Historical Holdout and Pristine OOS remained closed.

## Frozen candidate
Exactly one Train-selected rule was carried into Validation:
- DC Correction -> Resumption Swing
- H4 only
- fine DC = 0.0025
- macro DC = 0.0050
- frozen State Engine v0.2
- no subgroup filters
- no parameter tuning

## Validation window
Usable Validation scoring window:
- start: 2024-03-20T19:20:24.500Z
- end:   2025-03-25T01:04:34.300Z

Historical Holdout begins:
- 2025-03-25T05:04:34.300Z

No timestamp at/after Holdout start was read.

## Prefix integrity
PASS:
- 34,816 overlapping Train H1 rows compared
- exact state/discrete parity
- continuous feature max absolute float difference:
  3.552713678800501e-15
- registered tolerance: 1e-12
- prefix parity: PASS

## Validation cohort
- confirmed primary Trend episodes: 82
- eligible DC-resumption signals: 21
- mature H4 trades: 20

No-entry / cancellation reasons:
- macro reversal during correction: 21
- no resumption before Trend end: 11
- hard gap: 9
- macro reversal before correction: 10
- no fine correction before Trend end: 10

## Overall Validation economics
n = 20

- directional accuracy: 65.0%
- C0 mean/trade: +0.0908 ATR
- C1 mean/trade: -0.0542 ATR
- C2 mean/trade: -0.1991 ATR
- C1 win rate: 65.0%
- mean signed displacement: +0.0911 ATR
- mean MFE: 1.167 ATR
- mean MAE: 1.051 ATR
- median total delay: 11 H1 bars

## Direction split
UP:
- n=16
- C1 -0.0606
- C2 -0.2125
- C1 win 68.75%

DOWN:
- n=4
- C1 -0.0283
- C2 -0.1454
- C1 win 50.0%

Both directions failed the registered non-negative C1 requirement.

## Time split — descriptive only
First half:
- n=9
- C1 -0.3588
- C2 -0.4875

Second half:
- n=11
- C1 +0.1951
- C2 +0.0368

This divergence is descriptive only and may not be used to select a subgroup after Validation.

## Registered verdict
Sample adequacy:
- mature H4 >=10: PASS
- up >=3: PASS
- down >=3: PASS

Economic screens:
- C0 >0: PASS
- C1 >0: FAIL
- C2 >=0: FAIL
- C1 win >50%: PASS
- UP C1 >=0: FAIL
- DOWN C1 >=0: FAIL

FINAL VERDICT: FAIL

## Decision
Close DC Correction -> Resumption H4 as a validated candidate.

Do not:
- retune DC thresholds,
- select only the second half,
- select only one direction,
- change the H4 horizon,
- open Historical Holdout for this candidate.

Historical Holdout remains locked.
Pristine OOS remains untouched.

The strongest conclusion is:
the pattern retained directional information in Validation, but its displacement was too small to survive realistic execution friction.
