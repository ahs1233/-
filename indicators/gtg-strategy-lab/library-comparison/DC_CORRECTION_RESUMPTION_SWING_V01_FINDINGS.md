# GTG DC Correction -> Resumption Swing v0.1 — Findings

Date: 2026-10-03
Scope: Train-development diagnostic.
Validation/Historical Holdout remained closed.

## Rule
After frozen Trend confirmation:
- fine H1 DC threshold 0.0025 must confirm a correction against the Trend,
- macro H1 DC threshold 0.005 must remain aligned with the Trend,
- fine DC must then newly confirm resumption back with the Trend,
- enter at the next open.

No retest-window timing or post-hoc 2-3 bar rule was used.

## Coverage
Library 2018-2020:
- confirmed trends: 234
- entries: 38
- coverage: 16.24%

Evaluation 2021-2024:
- confirmed trends: 280
- entries: 54
- coverage: 19.29%
- up entries: 30
- down entries: 24

Evaluation median timing:
- correction confirmation delay: ~5 bars
- correction duration: ~4-5 bars
- total resolution -> resumption delay: ~11-12 bars

## Evaluation economics

### h=4
- mature n=53
- direction accuracy 64.15%
- C0 +0.453 ATR/trade
- C1 +0.294
- C2 +0.135
- C1 win rate 60.38%

Both directions were positive:
- up n=29: C1 +0.316, C2 +0.148
- down n=24: C1 +0.268, C2 +0.120

This is the strongest short-horizon structural entry result observed so far in the 2021-2024 development slice.

### h=12
- n=47
- C0 +0.139
- C1 -0.031
- C2 -0.202
- C1 win 51.06%

### h=24
- n=39
- C0 -0.835
- C1 -0.999
- C2 -1.163

The continuation decays/reverses at longer horizons.

## Registered cross-horizon screen
FAIL:
- sample/side counts: PASS
- h12 C1 positive: FAIL
- h24 C1 positive: FAIL
- long-horizon C2 nonnegative: FAIL
- year requirement: PASS

No horizon may be promoted from this same run.

## Historical stability warning
The same exact rule was poor in the older library:

Library h4:
- n=36
- C1 -0.465
- C2 -0.674

By year h4:
- 2018 n=8: C1 -1.153
- 2019 n=9: C1 -1.217
- 2020 n=19: C1 +0.180
- 2021 n=16: C1 +0.688
- 2022 n=24: C1 +0.250
- 2023 n=11: C1 -0.277
- 2024 partial n=2: C1 +0.820

Therefore the positive evaluation h4 result is regime-dependent / temporally unstable and is not a general historical edge.

## Descriptive geometry clue
Short correction durations looked better in the evaluation, but those bins are post-hoc and may not be promoted.

This motivates a new parameter-light structural rule based on leg geometry instead of time bins:
- prior impulse amplitude
- correction amplitude
- correction / impulse depth ratio
- impulse speed
- correction speed
- whether resumption remains beyond the original broken boundary

The next experiment must freeze those structural conditions before outcomes.

## Decision
- Preserve State Engine v0.2 and TRANSITION routing.
- Preserve DC correction/resumption as a useful structural event detector.
- Do not freeze h4 as an edge.
- Do not adopt a 1 / 2-3 bar duration filter from this sample.
- Proceed to DC Leg Geometry Swing v0.1.
- Historical Holdout remains closed.
