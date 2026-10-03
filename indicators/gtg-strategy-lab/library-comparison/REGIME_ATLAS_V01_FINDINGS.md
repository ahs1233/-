# Regime Atlas v0.1 — Findings

Date: 2026-10-03  
Scope: H1 Train-only descriptive research. Validation and Historical Holdout remained closed.

## Integrity
- Protocol preregistered before fit/evaluation.
- Fit period: 2018-03-01 through 2020-12-31.
- Frozen evaluation: 2021-01-01 through 2024-03-20 exclusive.
- 6/6 implementation safety tests PASS.
- Frozen atlas SHA256: `77907757195387913a993d5e13dff957cd9884a7ef942a93c78de68b2a9e6e7b`.
- K selection used only fit-period causal features and silhouette score; no future returns or PnL entered clustering.
- Evaluation used frozen scaler and centers without centroid updates.
- 18,749 H1 evaluation bars and 825 non-overlapping 12h anchors.

## Atlas selection
Silhouette scores:
- k=4: 0.09198
- k=5: 0.07658
- k=6: 0.08796
- k=7: 0.08201
- k=8: 0.08352

Selected k=4.

The silhouette level is low. The four-state partition is usable as a coarse state map, not evidence of sharply separated natural market classes.

## Structural interpretation
State names below are descriptive labels based only on causal feature medians; canonical IDs remain R0-R3.

### R0 — bullish trend / continuation
- Occupancy: 32.2%
- Stay probability: 90.4%
- Multi-scale DC direction: +1 on all four scales.
- Median drift12: +1.69 ATR.
- Median drift48: +3.42 ATR.
- Volatility ratio: 0.94.
- This is the clearest persistent positive-trend state.

### R1 — bearish trend / continuation
- Occupancy: 38.5%
- Stay probability: 91.9%
- Multi-scale DC direction: -1 on all four scales.
- Median drift12: -1.18 ATR.
- Median drift48: -2.24 ATR.
- Volatility ratio: 0.99.
- This is the mirror bearish-trend state.

### R2 — high-volatility bullish recovery / impulse
- Occupancy: 7.7%
- Stay probability: 86.7%.
- Multi-scale DC direction: +1 on all four scales.
- Median drift12: +0.20 ATR.
- Median drift48: +0.94 ATR.
- Volatility ratio: 1.55, by far the highest state.
- Structurally this is a rarer high-volatility positive/recovery state.

### R3 — low-efficiency bullish reset / recovery
- Occupancy: 21.6%
- Stay probability: 92.9%, highest of the four.
- Multi-scale DC direction: +1 on all four scales.
- Last completed legs are negative across all scales, including a very large 4x-scale median leg.
- Median drift12: +0.09 ATR.
- Median drift48: -0.10 ATR.
- Efficiency12: 0.24; efficiency48: 0.13.
- Structurally this resembles a synchronized bullish reset/recovery after prior downside, with little net trend at the observation point.

## Future-distribution result
No state/horizon passed the preregistered descriptive screen.

Closest observation:
- R3, 12h horizon
- n=173
- mean lift vs unconditional: +0.163 ATR
- bootstrap 95% CI: [-0.115, +0.419]
- CI crosses zero, so it is not marked distributionally interesting.

The atlas therefore does not support using a state alone as a directional trading rule.

## Transition structure
States are persistent:
- R0 stay probability 90.4%
- R1 91.9%
- R2 86.7%
- R3 92.9%

This makes the atlas potentially useful as context for model selection/gating even though state-alone future displacement was not robust.

## Next question
Test model-regime interaction, not state-alone prediction:
- assign the already frozen states to existing Swing prediction anchors,
- evaluate whether Kronos, drift, or DC performance changes consistently by state across two already-existing Train windows,
- preregister the interaction screen before joining predictions to states,
- do not open Validation/Holdout unless a regime-conditioned rule survives both windows without parameter tuning.
