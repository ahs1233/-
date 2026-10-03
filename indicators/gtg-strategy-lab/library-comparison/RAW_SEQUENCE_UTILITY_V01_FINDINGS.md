# GTG Raw Sequence Utility v0.1 — Findings

Date: 2026-10-03
Scope: exploratory Train-development using already-observed 2021-2024 research region.
Validation and Historical Holdout remained closed.

## Design
A fixed 1D CNN saw exactly 48 causal H1 bars ending at each decision:
- normalized Bid OHLC relative to decision close / ATR
- spread/ATR
- ATR ratio
- frozen State Engine one-hot sequence

The symbolic action constraints were unchanged:
- RANGE: long / short / flat
- TRANSITION: flat only
- TREND_UP: long / flat
- TREND_DOWN: short / flat

Target and execution contract were unchanged from Joint State + Strategy Utility v0.1:
- 4-H1 utility
- C1 target
- next-open entry
- early state-handoff exit
- one active trade
- no hard-gap bridge

## Integrity
PASS:
- 48-bar causal window
- source hashes unchanged
- model frozen before evaluation
- symbolic constraints unchanged
- threshold predicted C1 > 0 unchanged
- one active trade
- Validation read=false
- Historical Holdout read=false
- unit tests 5/5 PASS

## Model diagnostics
Eligible evaluation candidates: 12,948

Aggregate:
- Pearson correlation predicted vs realized C1: +0.0103
- C1-positive sign accuracy: 55.57%
- predicted-positive fraction: 12.57%
- realized C1 among predicted-positive candidates: -0.249 ATR
- realized win rate among predicted-positive candidates: 44.53%

The required correlation >0.10 failed badly.

By action correlation:
- RANGE_LONG: -0.0104
- RANGE_SHORT: +0.0591
- TREND_LONG: +0.0196
- TREND_SHORT: -0.0341

No action branch shows a robust utility relationship.

## Sequence policy
Completed trades: 326
- long: 104
- short: 222
- RANGE entries: 180
- TREND entries: 146

Economics:
- C0: -0.159 ATR/trade
- C1: -0.316
- C2: -0.473
- C1 win rate: 41.72%
- C1 total: -103.02 ATR
- C1 per decision opportunity: -0.00607

By branch:
RANGE:
- n=180
- C1 -0.247
- C2 -0.404

TREND:
- n=146
- C1 -0.401
- C2 -0.558

Both branches are clearly negative.

## Year stability
C1/trade:
- 2021: -0.141
- 2022: -0.402
- 2023: -0.222
- 2024 partial: n=27

No full year is positive.

## Comparison with static Joint Utility
Static policy:
- C1/trade -0.161
- C1/opportunity -0.0267

Raw Sequence:
- C1/trade -0.316 (worse)
- C1/opportunity -0.00607 (less negative because it trades much less)

The temporal model became more selective but selected trades poorly.

## Registered screen
FAIL.

Passed:
- evaluation candidate count
- sign accuracy >0.55
- trade/sample counts
- long/short and RANGE/TREND coverage
- opportunity-normalized loss better than static policy

Failed:
- utility correlation
- C0/C1/C2 economics
- win rate
- trade-level result vs static policy
- year stability

## Conclusion
The 48-H1 raw temporal path, under this fixed CNN architecture, does not recover a robust action-utility edge.

This reinforces the broader result:
- State Engine is structurally useful,
- but neither hand-crafted snapshots nor this simple raw-sequence representation reliably forecast short-horizon tradable utility after costs.

Do not tune:
- window length
- CNN depth
- epochs
- threshold
- action subgroups
- year filters

on the reused 2021-2024 evaluation.

## Decision
Stop extracting additional confirmatory claims from the same Train evaluation region.

The next defensible step is not another in-sample model variant. It is one of:
1. acquire genuinely new/pristine forward data and freeze the current candidate architecture before it arrives;
2. define a new untouched historical region if one can be proven unused;
3. continue exploratory research, but label it explicitly as hypothesis generation only.

Historical Holdout remains closed.
