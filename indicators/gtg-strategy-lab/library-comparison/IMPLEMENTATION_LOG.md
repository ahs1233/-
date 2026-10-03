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
