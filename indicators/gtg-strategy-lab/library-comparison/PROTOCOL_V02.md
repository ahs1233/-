# Library comparison v0.2 — Train-wide stability expansion

Registered before the v0.2 expanded run is executed. This is separate from v0.1 Pilot-002 and from the frozen GTG TRADE_CONTRACT v0.2.3.

- Purpose: test whether the integration behavior seen in the small Jan-Mar 2022 pilot is stable across the broader Train period. This is not a strategy selection step and does not open Validation or Historical Holdout.
- Evaluation window: 2021-09-29 00:00:00 UTC <= anchor < 2024-03-20 00:00:00 UTC. The last partial Train day is intentionally excluded so no raw daily file containing post-Train bars is read.
- Source warm-up / analogue memory may read only 2021-07-31 onward. No file dated 2024-03-20 or later is opened by this run.
- Tracks remain unchanged: scalp M5, h=3 bars (15 minutes); swing H1, h=4 bars (4 hours). Context W=96 closed bars. ATR remains simple rolling 14-bar true range for this library-comparison branch.
- 240 deterministic, evenly spaced eligible anchors per track. Anchors are selected from timestamps/availability only, never from returns. Future horizon must be contiguous. Selected anchors must not have overlapping outcome horizons.
- Rolling analogue bank: trailing 60 calendar days before each anchor. A candidate is eligible only if its complete W-bar pattern and its h-bar label are fully known before the query context begins. Same confirmed DC direction is required.
- DC thresholds remain 0.001 scalp / 0.005 swing. Confirmation state is causal and never backdated.
- STUMPY MASS: query versus the strictly past rolling corpus; top 20 independent candidates at least W bars apart. STUMPY-only prediction = median label of first 5.
- tslearn DTW: rerank the same 20 candidates using individually z-normalized log-close, Sakoe-Chiba radius 4. Prediction = median label of best 5. Fewer than 5 valid independent neighbors => abstain/zero.
- Kronos configuration is unchanged from v0.1: Kronos-mini + Kronos-Tokenizer-2k, CPU, 2 threads, W=96 OHLC context, 3 samples, T=1, top_p=0.9, deterministic seed 20261003+anchor index. Record exact source/model revisions.
- Baselines unchanged: flat, last-12-bar drift extrapolated h/12, causal confirmed DC direction times h/12.
- Outcome and execution arithmetic unchanged from v0.1: prediction target = (BidClose[t+h]-BidClose[t])/ATR[t]; hypothetical entry at open t+1; fixed horizon; C0/C1/C2 use real BID/ASK and the registered slippage assumptions.
- Publish all six candidates on both tracks: flat, drift, dc_direction, dc_mass, dc_mass_dtw, kronos_mini. No model is dropped because of Pilot-002.
- Publish overall metrics and calendar-quarter breakdowns for every candidate. Quarter rows are descriptive stability diagnostics; no quarter may be selected as the claimed result.
- Required checks: source date gate; complete aggregation; DC prefix causality; rolling-bank label bound; no bank/query-context overlap; same-seed Kronos repeat on first anchor of each track; exact count of 240 anchors unless the registered non-overlap/availability rules make that impossible.
- Evidence labels: analogue/baselines = TRAIN_DEVELOPMENT_ONLY. Kronos = PRETRAINED_CONTAMINATION_UNKNOWN.
- No tuning from v0.2 outcomes. No Validation/Holdout reads. No profitability or edge claim from this run alone.
