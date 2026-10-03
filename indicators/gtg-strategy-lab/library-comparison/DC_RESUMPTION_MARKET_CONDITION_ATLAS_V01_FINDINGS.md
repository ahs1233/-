# GTG DC Resumption Market-Condition Atlas v0.1 — Findings

Date: 2026-10-03
Status: exploratory diagnosis only.
Historical Holdout remained locked.
Pristine Forward OOS remained sealed/undecoded.

## Design
The 109 already-open DC Resumption + 1ATR bracket trades were clustered using only causal signal-time market-condition features.

Fixed before results:
- KMeans
- k=4
- n_init=50
- random_state=20261003
- no outcome field in clustering features
- no cluster selected for trading

Features included aligned drift, efficiency, spread/ATR, ATR regime, prior-range width/position, breakout magnitude, DC alignment counts, and correction/resumption timing.

## Global structure
Silhouette score: 0.1636

This indicates only weak-to-moderate geometric separation in the chosen condition space.

Decision:
NO_STABLE_CONDITION_STRUCTURE

No cluster satisfied the preregistered stability rule.

## Cluster 0
n=12
Overall C1: +0.010

Rejected:
- sample n<15
- period signs also unstable

Period C1:
- 2018-2020: +0.209
- 2021-2024: -0.394
- Validation: +0.837, n=1

## Cluster 1
n=32
Overall C1: +0.134

Rejected:
C1 sign not stable.

Period C1:
- 2018-2020: -0.211
- 2021-2024: +0.157
- Validation: +0.524

## Cluster 2
n=32
Overall C1: +0.093

Rejected:
C1 sign not stable.

Period C1:
- 2018-2020: -0.125
- 2021-2024: +0.187
- Validation: +0.160

## Cluster 3
n=33
Overall C1: +0.111

Rejected:
C1 sign not stable.

Period C1:
- 2018-2020: +0.053
- 2021-2024: +0.222
- Validation: -0.022

## Interpretation
The failure of the ATR-bracket candidate cannot be reduced to one stable, easily isolated market-condition cluster under this representation.

The dominant pattern remains temporal regime instability:
- conditions that look favorable in later history are often unfavorable in early history,
- and the cluster that is positive in early history loses sign in Validation.

Therefore selecting a cluster now would be post-hoc filtering, not robust regime discovery.

## Decision
Do not:
- turn any cluster into a trade filter,
- choose clusters 1/2 because later periods are positive,
- choose cluster 3 because early history is positive,
- change k and rerun until a stable cluster appears,
- open Pristine Forward OOS.

This closes the current DC Resumption optimization branch.

Next defensible research must come from a genuinely different source of information or a separately motivated external model/market representation, frozen before Forward OOS is decoded.
