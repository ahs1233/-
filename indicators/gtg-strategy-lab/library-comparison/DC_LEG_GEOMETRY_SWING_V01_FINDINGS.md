# GTG DC Leg Geometry Swing v0.1 — Findings

Date: 2026-10-03
Scope: Train-development structural filter diagnostic.
Validation/Historical Holdout remained closed.

## Filter
Starting from frozen DC correction/resumption entries, retain only signals where:
1. prior Trend impulse amplitude > correction amplitude,
2. correction speed < prior impulse speed,
3. resumption close remains beyond the original broken Range boundary.

No learned threshold, delay bin, Fibonacci band, or outcome field entered the filter.

## Coverage
Library:
- source entries 38
- retained 16 (42.1%)

Evaluation:
- source entries 54
- retained 29 (53.7%)

All source signals had valid confirmed-pivot geometry.

## h4 economics

Library filtered:
- n=16
- direction accuracy 18.75%
- C0 -0.555
- C1 -0.766
- C2 -0.977

Evaluation filtered:
- n=29
- direction accuracy 51.72%
- C0 +0.196
- C1 +0.028
- C2 -0.140
- C1 win 48.28%

The filter materially worsened the strong unfiltered 2021-2024 h4 result:
- unfiltered C1 +0.294
- filtered C1 +0.028

## Evaluation directions h4
Up:
- n=20
- C1 -0.041
- C2 -0.219

Down:
- n=9
- C1 +0.181
- C2 +0.034

No symmetric improvement.

## Evaluation years h4
- 2021 n=8: C1 +0.469
- 2022 n=13: C1 +0.050
- 2023 n=6: C1 -0.873
- 2024 partial n=2

The same instability remains.

## Longer horizons
Evaluation filtered:
- h12 C1 -0.107, C2 -0.280
- h24 C1 -0.960, C2 -1.134

## Registered stability screen
FAIL:
- library C1 positive: FAIL
- library C2 nonnegative: FAIL
- evaluation C2 nonnegative: FAIL
- evaluation C1 win >50%: FAIL
- filtered evaluation C1 better than unfiltered DC: FAIL

## Decision
The simple natural geometry rule does not generalize and should not be tuned on this sample.

Swing research status:
- State/Transition routing remains useful.
- Immediate breakout entry fails.
- Logistic transition classification is useful but does not solve entry timing.
- generic boundary retest fails.
- Trend-lifecycle holding fails.
- DC correction/resumption identifies a promising short continuation event in some regimes, but is historically unstable.
- simple impulse/correction geometry does not stabilize it.

There are too few independent DC-resumption observations (38 library / 54 evaluation) to justify a richer learned leg-quality model without severe overfit risk.

Therefore:
- preserve all Swing findings,
- do not open Historical Holdout,
- defer stronger Swing confirmation to new independent/pristine data or a substantially larger causal event population,
- continue the planned Range Scalper branch using the frozen State Engine.
