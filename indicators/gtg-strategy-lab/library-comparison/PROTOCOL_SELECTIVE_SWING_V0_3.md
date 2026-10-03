# Selective Swing replication v0.3 — Train-only, preregistered

Registered 2026-10-03 before scoring the replication anchors.
This phase tests one post-hoc observation from Stability v0.2 on a disjoint historical Train evaluation window. It does not open Validation or Historical Holdout.

## Motivation and status
Stability v0.2 observed post-hoc that Swing anchors where Kronos and 12-bar drift agreed had positive C1/C2 mean per trade. Because that rule was discovered after viewing v0.2, it is NOT evidence. This protocol turns it into a fixed hypothesis before replication.

## Data boundary
- Canonical JForex BID/ASK M1 only.
- Source/warm-up: 2018-03-01 <= raw date < 2021-07-31.
- Evaluation anchors: 2020-01-01 <= anchor < 2021-07-31.
- No raw file dated 2021-07-31 or later may be opened.
- This evaluation window is disjoint from Stability v0.2 anchors (which begin 2021-09-29) and Wave Memory v0.1 anchors (which begin 2023-01-01).
- Evidence label remains TRAIN_REPLICATION_ONLY, not clean external OOS, because research design was developed using other Train periods.

## Track and target
- Swing only.
- H1 bars.
- Horizon h=4 bars (4 hours), unchanged.
- ATR: simple rolling 14-bar true range, unchanged.
- Target: (BidClose[t+h]-BidClose[t]) / ATR[t].
- Entry/cost arithmetic: exactly the same C0/C1/C2 functions used in v0.1/v0.2.

## Cohort
- 160 deterministic evenly spaced eligible anchors selected by timestamp/availability only.
- Outcome windows must be contiguous and non-overlapping.
- No return, model score or future label is used to select anchors.

## Frozen predictors
1. drift: last-12-bar drift extrapolated h/12.
2. Kronos-mini: same pinned source/model revisions, OHLC context=96, 3 samples, T=1, top_p=0.9, seed policy unchanged.
3. Wave Memory: same six-leg signature, features, robust scaling method, phase alignment, K=7 and DTW radius=2.
   - Scaling is fitted only from events confirmed before 2020-01-01.
   - For every query, wave candidates and their labels must mature strictly before the query.

## Registered rules
Primary H1 — agree2:
- Trade only when sign(Kronos) == sign(drift) != 0.
- Direction is that common sign.
- Otherwise abstain.
- No magnitude threshold.

Secondary H2 — agree3:
- Trade only when sign(Kronos) == sign(drift) == sign(Wave Memory) != 0.
- Otherwise abstain.
- No magnitude or distance threshold.

Baselines on the exact same anchors: drift always-trade, Kronos always-trade, Wave always-trade, flat.

## Primary replication criterion
H1 is considered replicated for further research only if all are true:
- at least 40 active trades,
- C1 mean per trade > 0,
- C2 mean per trade > 0,
- directional accuracy > 50%,
- at least half of calendar quarters containing >=5 H1 trades have positive C1 mean per trade.

H2 is descriptive/secondary and cannot rescue a failed H1.

## Integrity checks
- raw date gate PASS,
- complete H1 aggregation,
- 160 anchors exactly,
- DC/wave prefix causality PASS,
- wave memory labels mature before query,
- robust scaling sees only pre-evaluation events,
- Kronos same-seed repeat on first anchor PASS,
- no Validation/Holdout read.

No parameter tuning after seeing this replication. A failure sends the project to symbolic/cost-aware feature research rather than threshold optimization.
