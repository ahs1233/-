# GTG Joint State + Strategy Utility v0.1 — Findings

Date: 2026-10-03
Scope: temporally separated Train-development experiment.
Validation and Historical Holdout remained closed.

## Architecture
The frozen State Engine remained the symbolic authority.

Allowed actions:
- RANGE: RANGE_LONG / RANGE_SHORT / FLAT
- TRANSITION: FLAT only
- TREND_UP: TREND_LONG / FLAT
- TREND_DOWN: TREND_SHORT / FLAT

Four fixed HistGradientBoosting utility models were fit only on pre-2021 mature action outcomes, frozen, committed, then evaluated on 2021-01-01 through 2024-03-20.

Training counts:
- RANGE_LONG: 8,183
- RANGE_SHORT: 8,183
- TREND_LONG: 2,974
- TREND_SHORT: 2,068

Frozen model SHA256:
- 4084536a3827a31c1c4c1e8fe577feece2e8874a4db7b06ee2f15a5e4be28c54

## Integrity
PASS:
- pre-2021 fit only
- frozen model committed before evaluation open
- evaluation-open marker committed before outcomes
- frozen model/training hashes unchanged
- State Engine file/content hashes unchanged
- canonical manifest unchanged
- exact feature order frozen
- symbolic action constraints enforced
- TRANSITION forced FLAT
- one active trade
- no hard-gap bridge
- Validation read=false
- Historical Holdout read=false
- joint utility + learning unit tests: 13/13 PASS before the official run

## Model generalization
Evaluation action candidates: 25,901.

Aggregate:
- prediction vs realized C1 Pearson correlation: -0.0123
- C1-positive sign accuracy: 54.92%

Registered requirements:
- correlation >0.10: FAIL
- sign accuracy >0.55: FAIL

Action-specific correlations:
- RANGE_LONG: -0.0237
- RANGE_SHORT: -0.0334
- TREND_LONG: -0.0339
- TREND_SHORT: +0.0345

The utility estimates did not generalize from the pre-2021 fit period to 2021-2024.

Critically, actions predicted positive still had negative realized mean C1:
- RANGE_LONG predicted-positive realized C1: -0.189
- RANGE_SHORT: -0.269
- TREND_LONG: -0.187
- TREND_SHORT: -0.081

## Learned policy
Decision opportunities: 10,373
Flat decisions: 8,394
Completed trades: 1,721
- long: 853
- short: 868
- RANGE entries: 1,265
- TREND entries: 456

Economics:
- C0: +0.0267 ATR/trade
- C1: -0.1610
- C2: -0.3488
- C1 win rate: 43.70%
- C1 total: -277.13 ATR
- C1 per decision opportunity: -0.0267

By branch:
RANGE:
- n=1,265
- C1 -0.1394
- C2 -0.3316

TREND:
- n=456
- C1 -0.2210
- C2 -0.3964

Both branches are negative after benchmark friction.

## Year stability
Learned policy C1/trade:
- 2021: -0.0202
- 2022: -0.0860
- 2023: -0.3567
- 2024 partial: -0.2416

No full evaluation year is positive.

## Baseline comparison
Frozen TREND_ALWAYS baseline:
- n=713
- C1 -0.2292
- C2 -0.4035
- C1 per decision opportunity -0.0130

The learned policy improves mean C1 per trade relative to TREND_ALWAYS:
- -0.161 vs -0.229

But because it trades more often, its opportunity-normalized loss is worse:
- learned -0.0267 per decision opportunity
- TREND_ALWAYS -0.0130

So the learned model changes trade selection but does not create positive utility.

## Registered screen
FAIL.

Passed:
- training/evaluation sample counts
- total sequential trades
- Range/Trend branch sample counts
- long/short sample counts
- policy mean C1/trade better than TREND_ALWAYS

Failed:
- utility correlation
- positive-sign accuracy
- overall C1
- overall C2
- win rate
- Range branch C1
- Trend branch C1
- year stability

## Interpretation
Hand-crafted point-in-time features plus tree-based utility regression do not carry stable enough information to forecast 4-H1 action utility across regimes.

This is consistent with earlier findings:
- State classification is useful structurally,
- but static state snapshots are insufficient for robust entry selection.

The remaining plausible representation is temporal context itself:
- the path into the current state,
- recent sequence of normalized OHLC movement,
- spread/volatility evolution,
- recent state transitions,
- not just the latest engineered feature vector.

## Decision
Reject Joint State + Strategy Utility v0.1 as a tradable policy.

Do not tune:
- tree depth
- positive-utility threshold
- 4-bar horizon
- state subgroups
- year/direction filters

on the same evaluation.

Next experiment may use a fixed raw-sequence representation while preserving the symbolic action constraints.

Any such sequence experiment remains exploratory Train-development because 2021-2024 has already been repeatedly observed.

Validation and Historical Holdout remain closed.
