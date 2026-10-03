# Multi-Scale DC + Symbolic Regression v0.1 — Findings

Date: 2026-10-03  
Scope: Train-only research. Validation and Historical Holdout remained closed.

## Integrity
- Official run: `multiscale-symbolic-v01-003`.
- Discovery/Selection protocol was preregistered before accepted scoring.
- An earlier run detected a split-boundary target leak and was discarded before acceptance.
- Final safety suite: 8/8 PASS.
- PySR runtime was recorded before market-data loading: PySR 2.6.0, Julia 1.13.1, SymbolicRegression.jl 2.5.1.
- Selected equations were frozen and committed before Replication was opened.
- Frozen equation SHA256: `94fa7df26271f53eb4a23a3499b05cd108f315670ba6c64f47a8cddd6271cc85`.
- Replication source manifest matched the independently re-read Kronos source manifest exactly.
- Kronos source/model/tokenizer revisions were pinned to the same revisions used in the earlier library pilot.
- Exact same 240 replication anchors per track were used for all comparators.

## Selected symbolic equations

### Scalp
`drift12 * (-dc0p5_age + drift12) / 337.33627`

Selection MAE: 0.8058 ATR.

### Swing
`0.03221754`

Selection MAE: 1.0161 ATR.

The Swing selector choosing a constant is itself informative: under the registered feature/search space, Selection did not prefer a multi-scale wave equation over a constant predictor.

## Internal replication — 240 anchors per track

### Scalp
| Model | Direction accuracy | C0/trade | C1/trade | C2/trade |
|---|---:|---:|---:|---:|
| DC direction | 50.0% | -0.025 | -0.719 | -1.413 |
| 12-bar drift | 49.8% | +0.009 | -0.691 | -1.390 |
| Symbolic always-trade | 52.7% | -0.050 | -0.739 | -1.429 |
| Symbolic cost-selective | no trades | — | — | — |
| Kronos-mini | 51.3% | -0.007 | -0.696 | -1.384 |

Scalp remains dominated by execution costs. The registered symbolic selective rule abstained on every anchor because predicted magnitude never cleared the causal cost proxy.

### Swing
| Model | Direction accuracy | C0/trade | C1/trade | C2/trade |
|---|---:|---:|---:|---:|
| DC direction | 50.2% | -0.074 | -0.237 | -0.400 |
| 12-bar drift | 50.2% | +0.050 | -0.112 | -0.275 |
| Symbolic always-trade | 54.8% | +0.041 | -0.125 | -0.290 |
| Symbolic cost-selective | no trades | — | — | — |
| Kronos-mini | 56.1% | +0.206 | +0.044 | -0.119 |

The primary registered symbolic screen failed on both tracks.

## Kronos persistence check
The positive Swing C1 result in this earlier replication is not stable evidence.

On the already-preregistered later Stability v0.2 window (2021-09-29 to 2024-03-20 exclusive), the same Kronos-mini configuration produced:
- Direction accuracy: 50.4%.
- C0 mean/opportunity: +0.108 ATR.
- C1 mean/opportunity: -0.070 ATR.
- C2 mean/opportunity: negative.

Within the earlier 2020-2021 replication, only 2 of 5 calendar quarters had positive Swing C1 and the aggregate result was strongly helped by 2020Q4. The later independent Train window did not preserve the positive C1.

## Conclusion
1. Single-threshold Wave Memory did not establish an edge.
2. Fixed-bar STUMPY/DTW did not replicate its small-pilot Swing result.
3. Multi-scale DC features plus unconstrained symbolic regression did not produce a robust executable rule.
4. Raw Kronos showed a period-specific Swing signal, but it did not persist economically in the later Stability window.
5. The current evidence does not justify opening Validation or Historical Holdout.
6. Do not tune the existing equations, thresholds, DTW radius, or Kronos sampling parameters against these outcomes.

## Next research direction
The next phase should change the information representation rather than optimize the failed predictors. A useful candidate is a causal regime/state layer built from multi-scale DC structure, volatility, spread/cost state and trend/mean-reversion context, followed by within-regime evaluation of simple predictors. Any regime rule must be defined without using future returns and must be preregistered before scoring.
