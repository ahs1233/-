# GTG Structural Range Box Scalper v0.1 — Findings

Date: 2026-10-03
Scope: Train-development diagnostic using frozen State Engine v0.2.
Validation and Historical Holdout remained closed.

## Design
- State Engine remains RANGE routing authority.
- Structural box built only from confirmed DC pivots at threshold 0.0025.
- Pivot is usable only at confirmation time; never backdated.
- Need latest 2 confirmed LOW pivots + latest 2 confirmed HIGH pivots inside same uninterrupted RANGE episode.
- lower/upper = median of latest two lows/highs.
- quartile rejection entries.
- midpoint target.
- frozen boundary invalidation or state handoff exits.
- next-open causal execution.

## Integrity
PASS:
- state hashes unchanged
- canonical manifest unchanged
- DC threshold exactly 0.0025
- pivot confirmation current-bar only
- pivot_at inside current RANGE episode
- two highs/two lows required
- box frozen per trade
- next-open entry/exit
- one active trade
- no hard-gap bridge
- no split crossing
- unit tests 5/5 PASS
- Validation read=false
- Historical Holdout read=false

## Library 2018-2020
- RANGE bars: 8,921
- RANGE episodes: 822
- confirmed LOW pivots: 359
- confirmed HIGH pivots: 362
- mature structural-box bars: 362
- mature-box coverage: 4.06%
- completed trades: 37
- long 20 / short 17
- C0: +0.122 ATR/trade
- C1: -0.0578
- C2: -0.2377
- C1 win: 45.95%

## Evaluation 2021-2024
- RANGE bars: 10,337
- RANGE episodes: 916
- confirmed LOW pivots: 399
- confirmed HIGH pivots: 385
- mature structural-box bars: 476
- mature-box coverage: 4.60%
- completed trades: 53
- long 31 / short 22
- C0: -0.0112 ATR/trade
- C1: -0.1861
- C2: -0.3611
- C1 win: 39.62%
- target exits: 21
- boundary invalidations: 32 including boundary+state

By direction:
- long C1 -0.1825
- short C1 -0.1912

## Box geometry
Evaluation median:
- width: 2.37 ATR
- low-pivot dispersion: 0.53 ATR
- high-pivot dispersion: 0.61 ATR
- oldest defining confirmation age: 20 bars
- newest defining confirmation age: 3 bars

## Registered screen
FAIL.

Failed on:
- sample sizes
- mature-box coverage >=20%
- C1/C2 economics
- win rate
- year stability
- improvement over Range Scalper v0.1

## Comparison of manual RANGE branches
Range Scalper v0.1:
- Evaluation C1 -0.1811

Range Scalper v0.2 boundary exit:
- Evaluation C1 -0.1834

Pre-Transition Guard:
- Evaluation guarded C1 -0.2061

Confirmed Oscillating Range:
- Evaluation C1 -0.5681, n=17

Structural Range Box:
- Evaluation C1 -0.1861, n=53

No manual RANGE representation tested so far produces a robust economic edge.

## Decision
Reject Structural Range Box Scalper v0.1 as a robust RANGE execution rule.

Do NOT tune:
- DC threshold
- number of pivots
- quartiles
- midpoint
- dispersion limits

on this evaluation.

The repeated failures indicate the next step should not be another hand-written Range rule. Move to Joint State + Strategy Learning:
- keep causal State Engine / TRANSITION routing as symbolic constraints,
- let a learned model estimate strategy/action utility from causal state features,
- evaluate a frozen policy out-of-time within Train-development,
- keep Validation/Historical Holdout closed.
