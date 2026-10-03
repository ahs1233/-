# Selective Swing v0.3 — findings

Run: `runs/selective-v03-002`
Protocol: `PROTOCOL_SELECTIVE_SWING_V0_3.md`
Scope: Train replication only. Validation/Holdout were not read.

## Integrity
- Current protocol SHA256: `3e08afdbb6dd6e5bed50adcc9ab603bcd61dbce7f81f854c137d974a7b4ba9df`.
- Current code SHA256: `a06ef4bd76a1baaecf91594656b187f97d9483f6ad7c5f367f982e0107e078b6`.
- Run environment hashes match the current preregistered protocol/code.
- 160 deterministic Swing anchors from 2020-01-01 through 2021-07-31.
- Six integrity checks PASS: raw date gate, anchor count, wave prefix causality, pre-evaluation scaler, Kronos repeatability, memory maturity.

## Primary H1 — Kronos + drift direction agreement
- Active trades: 59 / 160 (36.9% coverage).
- Direction accuracy: 59.32%.
- C1 win rate: 54.24%.
- C0 mean/trade: -0.015 ATR.
- C1 mean/trade: -0.193 ATR.
- C2 mean/trade: -0.370 ATR.
- Positive C1 quarters among quarters with >=5 trades: 1 / 6.
- Registered replication result: **FAIL**.

The rule improved directional classification but did not produce positive gross magnitude before costs, so execution friction is not the sole problem.

## Secondary H2 — Kronos + drift + Wave agreement
- Active trades: 29 / 160 (18.1% coverage).
- Direction accuracy: 62.07%.
- C1 mean/trade: -0.335 ATR.
- C2 mean/trade: -0.510 ATR.
- Higher directional accuracy did not translate into economic value.

## Interpretation
The project should stop adding voting/consensus filters on the same predictor family. The repeated result is that direction accuracy alone is an insufficient objective.

Next phase: symbolic regression / interpretable rule discovery must target expected displacement and cost-aware abstention. It must use a disjoint Train-only discovery/replication split and may not tune on v0.2, Wave Memory v0.1, or this v0.3 replication cohort.
