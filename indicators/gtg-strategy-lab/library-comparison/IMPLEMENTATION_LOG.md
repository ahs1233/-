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
