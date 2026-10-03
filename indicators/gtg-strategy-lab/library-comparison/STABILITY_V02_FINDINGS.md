# Train-wide stability v0.2 — findings

Run: `runs/stability-v02-001`
Protocol: `PROTOCOL_V02.md`
Scope: Train development only, 2021-09-29 through 2024-03-20 exclusive. Validation/Holdout were not read.

## Integrity
- 934,372 validated M1 BID/ASK bars loaded from Train-safe raw days.
- 240 deterministic anchors per track.
- Scalp: 186,628 complete M5 aggregates; 317 incomplete buckets dropped.
- Swing: 15,349 complete H1 aggregates; 238 incomplete buckets dropped.
- Prefix causality, rolling-bank bound, and Kronos same-seed repeat: PASS on both tracks.

## Overall
| Track | Model | Direction accuracy | C0 ATR/opportunity | C1 ATR/opportunity | C2 ATR/opportunity |
|---|---|---:|---:|---:|---:|
| Scalp | dc_direction | 41.18% | -0.165 | -0.901 | -1.637 |
| Scalp | dc_mass | 51.05% | -0.003 | -0.730 | -1.457 |
| Scalp | dc_mass_dtw | 52.10% | +0.022 | -0.705 | -1.432 |
| Scalp | drift | 47.90% | -0.011 | -0.739 | -1.468 |
| Scalp | kronos_mini | 58.82% | +0.129 | -0.599 | -1.327 |
| Swing | dc_direction | 52.08% | +0.166 | -0.011 | -0.187 |
| Swing | dc_mass | 47.48% | -0.051 | -0.227 | -0.403 |
| Swing | dc_mass_dtw | 47.06% | -0.053 | -0.230 | -0.406 |
| Swing | drift | 53.75% | +0.258 | +0.080 | -0.099 |
| Swing | kronos_mini | 50.42% | +0.108 | -0.070 | -0.248 |

Flat is zero by definition and is omitted from this table.

## Stability
- Every active scalp candidate had negative C1 in every one of 11 calendar-quarter diagnostics.
- Swing drift had positive C1 in 5/11 quarters; median quarterly C1 was -0.025 ATR.
- Swing MASS and MASS+DTW were positive at C1 in only 2/11 quarters. The positive Pilot-002 result did not persist on the expanded sample.
- Kronos had the highest scalp directional accuracy among the tested rows, but the average C1 cost drag was about 0.728 ATR/opportunity, overwhelming its +0.129 C0.
- Swing cost drag was about 0.178 ATR/opportunity.

## Exploratory post-hoc observation
This observation was made after seeing v0.2 and is NOT evidence:
- On Swing anchors where Kronos and drift directions agreed: n=118, direction accuracy 54.24%, C1 +0.196 ATR/trade, C2 +0.020 ATR/trade.
- C1 was positive in 6/10 quarters with at least one agreeing trade.
- This becomes a new hypothesis only if tested on a fresh, disjoint replication set under a preregistered v0.3 protocol.

## Interpretation
The current evidence rejects an always-trade implementation for the scalp horizon under the registered cost assumptions. Directional accuracy alone is not sufficient; cost-aware abstention/selection is structurally required for any future scalp design.
For Swing, the broad always-trade candidates are not stable enough to claim an edge. The only next step justified by these data is a fresh replication of a specific selective rule, not further tuning on these same anchors.
