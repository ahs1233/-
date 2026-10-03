# Library comparison v0.1 — exploratory Train-only pilot
Registered before pilot prices are loaded or scored. Authorized 2026-10-03. Separate from frozen v0.2.3 event study; no H1–H5 confirmatory claims.
- Parent 59f5d4569a8bb03726445c52330331fa9692917d. Frozen indicator, previous protocol and original worktree untouched.
- Canonical JForex local store only: 2022-01-01 <= date < 2022-04-01. Strictly within Train (end 2024-03-20T15:20:24.500Z). No Validation, Holdout or forward prices read.
- Reuse store.read_day, bars.aggregate and calendar. SHA256 input files before parsing. Require complete M1 membership per aggregate; no filling. Duplicate/unsorted/nonpositive prices and crossed open/close spreads fail.
- Jan-Feb fixed analogue bank. March development probe INSIDE Train, not OOS.
- Tracks: scalp M5/h=3 (15m), swing H1/h=4 (4h); context 96 closed bars. ATR = simple rolling 14-bar true range, not Navigator ATR.
- 24 deterministic evenly spaced March anchors per track, eligible by timestamp/availability, never returns. Future horizon must be contiguous; outcome windows cannot overlap. Context can span closures.
- Predict (BidClose[t+h]-BidClose[t])/ATR[t] at close t. Hypothetical trade at open t+1, fixed-horizon exit, no stops or targets.
- Baselines: flat (zero/no trade), last-12-bar drift extrapolated h/12, confirmed DC direction times h/12.
- DC: causal close-only detector, threshold 0.001 scalp / 0.005 swing; distinct extreme and confirmation times. Initial state unknown. Original small adapter; no copied unlicensed code.
- STUMPY MASS over log-close shapes; only Jan-Feb candidates whose labels are complete. Same confirmed DC direction. Select top20 nonoverlapping windows (>=96 bars apart), rerank with tslearn DTW, Sakoe-Chiba radius4, individually z-normalized log-price. Median future displacement/ATR of best5. STUMPY-only top5 ablation also reported. Fewer than5 => abstain. Restricted lookup, not all-pairs full-history matrix profile.
- Kronos-mini + Kronos-Tokenizer-2k, CPU/2 threads, context96, 3 samples, T1/top_p0.9, seed20261003+anchor. OHLC only, omitted volume/amount. eval mode. Upstream commit 67b630e67f6a18c9e9be918d9b4337c960db1e9a; resolve and record model revisions before inference.
- Kronos PRETRAINED_CONTAMINATION_UNKNOWN: pretraining may overlap pilot dates. Historical diagnostics only, not clean OOS evidence.
- Metrics: MAE ATR, active coverage, directional accuracy, C0/C1/C2 net ATR/opportunity and /trade, win rate. All candidates published. No annualized metrics/edge claims.
- C1: real BID/ASK spread plus 0.5*spread slippage on entry AND exit; commission0 benchmark assumption. C2 doubles spread and slippage. Not live-account costs.
- Fail closed on missing dependency/model; no fake fallback. Persist forecasts/status. No tuning based on these outcomes.
- Tests: prefix-causal DC, confirmation timing, bank-label bounds, Train date guard, side-aware cost arithmetic, complete aggregation and same-seed model repeat. Save input hashes, environment, model revisions, timings.
- Pilot acceptance = reproducible integrations and real-data outputs. Profitability is not assumed.
