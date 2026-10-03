# Wave Memory v0.1 — findings

Run: `runs/wave-memory-003`
Protocol: `PROTOCOL_WAVE_MEMORY_V0_1.md`
Execution amendment: `EXECUTION_AMENDMENT_WAVE_MEMORY_V0_1.md`
Scope: Train development only. Validation/Holdout were not read.

## Integrity
- Source begins at 2018-03-01; development anchors are 2023-01-01 through 2024-03-01.
- 96 deterministic anchors per track.
- Six runtime checks PASS: prefix-event causality, memory-label maturity and Kronos same-seed repeat on both tracks.
- Run code SHA256: `8b133a247dba1b094149bcdf634b1f245d0ff020c55be5fa6eecfe72265cf5ea`.
- The DTW execution patch was numerical-only: chunked and full-bank distances are tested equal to atol 1e-12.

## Overall
| Track | Model | Coverage | Direction accuracy | C0 ATR/opportunity | C1 ATR/opportunity | C2 ATR/opportunity |
|---|---|---:|---:|---:|---:|---:|
| Scalp | dc_direction | 100% | 45.83% | -0.170 | -0.956 | -1.742 |
| Scalp | drift | 100% | 55.21% | +0.103 | -0.682 | -1.466 |
| Scalp | event_wave_dtw | 100% | 47.92% | +0.055 | -0.716 | -1.486 |
| Scalp | kronos_mini | 100% | 46.88% | -0.071 | -0.847 | -1.623 |
| Swing | dc_direction | 100% | 50.00% | +0.017 | -0.169 | -0.354 |
| Swing | drift | 100% | 45.83% | -0.014 | -0.199 | -0.384 |
| Swing | event_wave_dtw | 98.96% | 53.68% | -0.022 | -0.202 | -0.382 |
| Swing | kronos_mini | 100% | 50.00% | -0.135 | -0.321 | -0.507 |

Flat is zero by definition and omitted.

## Interpretation
The event representation did not produce an always-trade economic edge under the registered fixed-horizon execution assumptions.

On scalp, the dominant problem is execution friction. Even positive gross C0 rows are overwhelmed by C1/C2. A future scalp design must default to abstention and trade only when expected move materially exceeds current spread/slippage cost.

On swing, Wave Memory has the highest directional accuracy among the tested rows in this run (53.68%), but the magnitude/timing is insufficient: gross C0 is slightly negative and C1 is clearly negative. Direction alone is not enough.

The next research stage should therefore test selective rules on fresh disjoint Train anchors, not tune these same 96 anchors. Priority hypotheses:
1. Swing: replicate the previously observed Kronos + drift direction-agreement filter on fresh anchors.
2. Swing: test a stricter consensus rule that requires Wave Memory to agree as a separately registered secondary hypothesis.
3. Scalp: replace always-trade evaluation with cost-aware abstention; no threshold may be chosen from these 96 outcomes.

No Validation/Holdout should be opened yet.
