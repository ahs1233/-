# GTG Confirmed Oscillating Range v0.1 — Findings

Date: 2026-10-03
Scope: Train-development diagnostic using frozen State Engine v0.2.
Validation and Historical Holdout remained closed.

## Design
- RANGE episode defined by frozen State Engine and <=3h trading continuity.
- first exactly six RANGE bars freeze a box.
- box must prove a full outer-quartile-to-opposite-outer-quartile traverse.
- only after that confirmation may edge-rejection scalper signals occur.
- confirmation bar itself is not tradable.
- target = box midpoint.
- invalidation/state handoff exits causally next open.

## Integrity
PASS:
- state hashes unchanged
- source manifest unchanged
- first six RANGE bars define the box
- box never rolls
- full traverse required before entry
- confirmation bar not tradable
- one active trade
- causal next-open execution
- no hard-gap bridge
- no split crossing
- unit tests 6/6 PASS
- Validation read=false
- Historical Holdout read=false

## Library 2018-2020
- RANGE episodes: 822
- boxes frozen: 477
- confirmed oscillating episodes: 36
- confirmation rate vs boxes: 7.55%
- invalidated before confirmation: 262
- completed trades: 13
- long 5 / short 8
- C0: -0.116 ATR/trade
- C1: -0.310
- C2: -0.505
- C1 win rate: 46.15%

## Evaluation 2021-2024
- RANGE episodes: 916
- boxes frozen: 523
- confirmed oscillating episodes: 52
- confirmation rate vs boxes: 9.94%
- invalidated before confirmation: 328
- completed trades: 17
- long 8 / short 9
- C0: -0.366 ATR/trade
- C1: -0.568
- C2: -0.771
- C1 win rate: 29.41%
- target exits: 5
- box invalidations: 9
- state exits: 3

## Interpretation
Requiring a full six-bar-box oscillation before enabling the Scalper over-filters the RANGE branch:
- very few episodes prove the required traverse,
- trade count collapses,
- remaining trades are still economically negative.

So the failure is not just insufficient filtering of prior24 ranges. A box defined by the first six bars plus a full traverse is too rigid and not aligned with persistent support/resistance structure.

## Registered screen
FAIL.

Failed on:
- library confirmed episodes >=50
- evaluation trades >=100
- long/short sample sizes
- C1/C2 economics
- win rate
- year stability
- improvement over Range Scalper v0.1

## Decision
Reject Confirmed Oscillating Range v0.1.

Do not tune:
- six-bar initialization
- quartiles
- midpoint
- full-traverse requirement

on this sample.

Next range representation:
- explicit structural support/resistance identity from confirmed DC pivots,
- repeated-touch geometry,
- causal pivot availability only at confirmation time.

This is already preregistered as Structural Range Box Scalper v0.1.
