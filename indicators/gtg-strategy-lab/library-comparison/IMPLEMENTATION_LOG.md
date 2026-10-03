# Implementation log

## Environment failure E1 — 2026-10-03
- Python 3.12 dedicated uv venv; latest CPU torch 2.14.1 failed importing shm.dll.
- Read-only PE dependency diagnosis identified missing VCRUNTIME140_THREADS.dll, required by torch_cpu.dll. Existing VCRUNTIME140 and VCRUNTIME140_1 load successfully.
- Same cause also affects tslearn because it imports its optional PyTorch backend when torch is installed. Pilot-001 stopped before producing forecasts; source loaded 88,046 M1 bars and selected 24 anchors/track.
- Chosen fix: pin CPU torch 2.5.1 (satisfies upstream torch>=2), avoiding a machine-wide Visual C++ runtime update. No arbitrary DLL download, no system runtime changes.
- Pilot-001 retained as failed-run evidence. No thresholds or data dates changed.

## Resolution R1 — 2026-10-03
- Bootstrapped pip inside the dedicated `.venv-research` only; no machine-wide runtime changes.
- Reinstalled `torch==2.5.1+cpu` from the official PyTorch CPU index. `torch`, tensor ops, and `tslearn==0.9.0` import successfully.
- Safety suite: 7/7 PASS.

## Pilot-002 — successful Train-only integration run
- Source: 88,046 M1 BID/ASK bars, Jan-Mar 2022 only; Validation/Holdout not read.
- Cohorts: 24 scalp anchors + 24 swing anchors; 4 incomplete aggregates dropped per track.
- Causality checks PASS on scalp and swing; Kronos same-seed repeat PASS on both tracks.
- Kronos revisions recorded: Tokenizer `26966d0035065a0cae0ebad7af8ece35bc1fb51c`; mini `f4e68697d9d5aed55cef5c96aabc3376bcad9f81`.
- Scalp: `dc_mass` and `kronos_mini` each 66.7% directional accuracy, but C1 remained negative (-0.287 and -0.300 ATR/opportunity respectively).
- Swing: `dc_mass` and `dc_mass_dtw` each 62.5% directional accuracy and +0.167 ATR/opportunity at C1; +0.031 ATR/opportunity at C2. `kronos_mini` was negative at C1 (-0.157).
- Interpretation remains exploratory: n=24/track, inside Train; no edge claim and no Holdout opening.

## Stability v0.2 — Train-wide result
- Registered in PROTOCOL_V02.md before execution; source gate 2021-07-31 <= raw day < 2024-03-20, with 240 deterministic anchors/track from 2021-09-29 onward.
- Source: 934,372 M1 bars. Scalp: 186,628 complete M5 aggregates; swing: 15,349 complete H1 aggregates.
- All six runtime safety checks PASS: prefix causality, 60-day rolling-bank bound, and Kronos same-seed repeat for both tracks.
- Scalp remained economically unusable under C1 across all active models. dc_mass_dtw C1 = -0.705 ATR/opportunity; Kronos-mini C1 = -0.599.
- Swing pilot optimism did not replicate: dc_mass C1 = -0.227 ATR/opportunity and dc_mass_dtw C1 = -0.230 over n=240.
- The simple 12-bar drift comparator was the only active swing row with positive mean C1 in this run: +0.080 ATR/opportunity, while C2 was -0.099. This is Train-development evidence only, not an edge claim.
- Conclusion: the 24-anchor pilot result was unstable. Fixed-bar analogue matching is not promoted. Continue with the separately preregistered causal Wave Memory representation.

## Event Library v0.2 — superseded partial run
- A separate event-library implementation was preregistered and safety-tested 8/8 PASS.
- Its first execution processed 1,882 source days and reached 20 scalp anchors before exiting nonzero without a captured traceback.
- Because Stability v0.2 and the more direct Wave Memory path were already running and cover the intended research question more cleanly, no parameter change or restart was made from this partial output. Partial files are retained locally as failed-run evidence and are not treated as scored results.

## Stability v0.2 — 2026-10-03
- Preregistered protocol commit: `4f0a922`; runner commit: `05b7238`.
- Successful run `stability-v02-001`: 934,372 M1 bars, 240 anchors/track, all six causal/repeatability checks PASS.
- Scalp: every active candidate was C1-negative in all 11 quarter diagnostics; Kronos direction accuracy 58.82% but C1 -0.599 ATR/opportunity because average cost drag was ~0.728 ATR.
- Swing: drift C1 +0.080 ATR overall but positive in only 5/11 quarters and C2 -0.099; MASS/DTW did not replicate the small Pilot-002 positive result.
- Post-hoc only: Kronos+drift direction agreement on Swing had n=118, C1 +0.196 and C2 +0.020 ATR/trade; this is explicitly NOT evidence and must be replicated on fresh disjoint anchors before use.

## Wave-memory-001 — interrupted low-level run
- Protocol: PROTOCOL_WAVE_MEMORY_V0_1.md registered before scoring; 11/11 safety tests passed before run.
- Full Train-only source loading completed and scalp cohort was materialized (33,767 confirmed events; 96 registered anchors).
- Process produced 7/96 scalp anchors (35 model rows) then exited with code 1 without a Python traceback and without a Windows Application Error event. No summary was produced; this partial run is retained only as failure evidence and is not interpreted economically.
- Resource-only implementation change for rerun: compute the exact same tslearn cdist_dtw distances in deterministic candidate chunks, then concatenate. No threshold, feature, anchor, K, radius, cost rule, model revision, or prediction rule changed.

## Stability v0.2 — completed Train-wide replication
- Scope: 240 deterministic anchors/track, 2021-09-29 <= anchor < 2024-03-20; Validation/Holdout not read.
- All registered checks PASS: prefix causality, rolling-bank bound, Kronos same-seed repeat on both tracks.
- Scalp: all active methods remained negative at C1. Kronos had the highest directional accuracy (58.8%) but C1 = -0.599 ATR/opportunity; dc_mass_dtw C1 = -0.705.
- Swing: the small pilot's positive STUMPY/DTW result did not replicate. dc_mass C1 = -0.227; dc_mass_dtw C1 = -0.230. Simple drift was +0.080 at C1 but -0.099 at C2; only 5/11 descriptive quarters were C1-positive.
- Interpretation: fixed 96-bar shape similarity is not established as a robust edge. This motivates testing the preregistered event-level wave representation rather than tuning the bar matcher.

## Architecture correction — event KNN branch stopped
- event-v02-001 (NearestNeighbors + DTW) was stopped before completion because the user's reference architecture prioritizes Directional Change + STUMPY/tslearn and Kronos comparison; KNN was not adopted as the primary path.
- No result from event-v02-001 is used for model selection.

## Wave Memory v0.1
- Four dedicated safety tests PASS: confirmation timing, prefix-event invariance, signature causality, phase alignment/maturity.
- wave-memory-001 was stopped before accepted scoring after detecting a comparator/protocol mismatch. The protocol was corrected before the official run.
- Duplicate invocations were not reused or overwritten. wave-memory-003 is the official run because its recorded protocol/code SHA256 match the current preregistered files.

## Wave Memory v0.1 — completed run 003
- Authoritative completed run: `wave-memory-003`; patched code SHA256 `8b133a247dba1b094149bcdf634b1f245d0ff020c55be5fa6eecfe72265cf5ea`.
- 96 deterministic anchors per track; all six runtime checks PASS; Validation/Holdout not read.
- Scalp event_wave_dtw: direction accuracy 47.92%, C0 +0.055, C1 -0.716, C2 -1.486 ATR/opportunity.
- Swing event_wave_dtw: coverage 98.96%, direction accuracy 53.68%, C0 -0.022, C1 -0.202, C2 -0.382 ATR/opportunity.
- Conclusion: wave representation did not produce an always-trade edge. Research moves to preregistered selective/abstention rules on fresh disjoint Train anchors.


## Wave Memory v0.1 — official run wave-memory-003
- Exact protocol/code SHA256 matched the preregistered files: protocol 91b36f1f59d556f67c0a09cd9d53d165a07e3b432ad9cbbecca6dab924e41369; code 8b133a247dba1b094149bcdf634b1f245d0ff020c55be5fa6eecfe72265cf5ea.
- Safety suite after completion: 5/5 PASS. Runtime checks PASS on both tracks: prefix-event causality, memory-label maturity, and Kronos same-seed repeat.
- Scope: canonical JForex BID/ASK only, 2018-03 through 2024-03 Train-safe read; development anchors 2023-01 through 2024-03; Validation/Holdout not read.
- Scalp: 33,767 confirmed DC events; event_wave_dtw direction accuracy 47.9%, C0 +0.055 ATR/opportunity but C1 -0.716 and C2 -1.486. No executable edge.
- Swing: 1,668 confirmed DC events; event_wave_dtw direction accuracy 53.7%, C0 -0.022 ATR/opportunity, C1 -0.202, C2 -0.382. It improved direction classification relative to several baselines but did not produce a positive net expectancy.
- Kronos remained negative after C1 on both tracks in this cohort and remains PRETRAINED_CONTAMINATION_UNKNOWN.
- Interpretation: event-level wave representation contains some directional information on Swing, but direct nearest-wave sign trading is not established. Do not retune DC thresholds/K/radius from these outcomes. Next registered phase is symbolic rule extraction from causal wave-state features with an internal Train-only discovery/replication split.


## Selective Swing v0.3 — disjoint Train replication
- Official run: selective-v03-002. Protocol/code hashes matched the preregistered files; all six integrity checks PASS.
- Primary agree2 rule: 59/160 active, 59.32% directional accuracy, but C0 -0.015, C1 -0.193 and C2 -0.370 ATR/trade. Only 1/6 eligible quarters was C1-positive. Registered criterion FAIL.
- Secondary agree3: 29 active, 62.07% directional accuracy, C1 -0.335 and C2 -0.510 ATR/trade.
- Conclusion: predictor consensus can raise direction accuracy without creating tradable magnitude. Do not add more voting thresholds. Next phase targets cost-aware expected displacement with symbolic regression on a disjoint Train-only split.

## Selective Swing v0.3 — disjoint Train replication
- Preregistered before scoring on disjoint anchors: 2019-01-01 <= anchor < 2021-07-31; 240 H1 anchors; Validation/Holdout not read.
- Runtime checks PASS: exact anchor count, Kronos same-seed repeat, deterministic agreement rule.
- Primary selective rule (Kronos sign == 12-bar drift sign) activated 91/240 opportunities (37.9% coverage).
- Replication failed the registered screen: C1 = -0.101 ATR/trade; C2 = -0.287 ATR/trade; only 5/11 eligible quarters had positive C1/trade.
- The prior post-hoc positive observation from Stability v0.2 is rejected and will not be threshold-tuned.
- Next phase: preregistered PySR symbolic regression on causal wave-state features. Historical Holdout remains closed.

## Multi-Scale Symbolic v0.1 — failed run 001 and integrity fix
- `multiscale-symbolic-v01-001` is invalid and excluded from all evidence. During discovery/selection execution, a safety assertion detected that the final Discovery anchor's h-bar outcome could mature at/inside the Selection boundary.
- The partially selected Scalp equation from run 001 is discarded and must not be reused.
- Implementation fix: `greedy_interval_anchors` now requires `t[i+h] < interval_end`, so every target matures strictly inside its registered split.
- Added explicit boundary-maturity regression test. Multi-scale symbolic safety suite now passes 8/8.
- Protocol, features, thresholds, operators, iteration count, objective, and registered date splits are unchanged; this is a fail-closed temporal-integrity correction before any accepted run.

## Multi-Scale Symbolic v0.1 — run 002 superseded for environment-record compliance
- Run `multiscale-symbolic-v01-002` completed clean Discovery/Selection and froze equations before Replication, but its run-local `environment.json` omitted PySR/Julia/SymbolicRegression version fields even though those versions had been verified in the terminal before fitting.
- To satisfy the preregistered evidence contract literally, run 002 is not promoted as the official run and Replication was not opened from it.
- No search parameter or data boundary was changed. Runner now records PySR, juliacall/juliapkg, Julia, and SymbolicRegression.jl versions into `environment.json` before loading market data.
