# Selective Swing v0.3 — preregistered disjoint Train replication

Registered 2026-10-03 before loading/scoring the v0.3 replication anchors.

## Motivation
Stability v0.2 (2021-09-29 <= anchor < 2024-03-20) produced one explicitly post-hoc observation: on Swing anchors where the existing Kronos-mini and existing 12-bar drift directions agreed, the selective subset had positive mean C1 and slightly positive C2. That observation is NOT evidence. v0.3 tests only that fixed rule on a disjoint earlier Train period.

## Data boundary
- Canonical local JForex BID/ASK M1 only.
- Raw source read: 2018-10-01 <= date < 2021-07-31.
- Evaluation anchors: 2019-01-01 <= anchor < 2021-07-31.
- This evaluation interval is disjoint from Stability v0.2 and from Pilot-002/Wave-Memory development probes.
- Validation and Historical Holdout remain closed.
- SHA256 every source file used.

## Track and target
- Swing only: H1.
- Context: 96 closed H1 bars for Kronos.
- Horizon: h=4 H1 bars.
- ATR: same simple rolling 14-bar true range used by library-comparison v0.1/v0.2.
- 240 deterministic evenly spaced eligible anchors, selected from timestamps/availability only.
- Future h-bar window must be contiguous and selected outcome windows must not overlap.

## Frozen component predictions
- drift = (BidClose[t] - BidClose[t-12]) * h/12 / ATR[t].
- Kronos = same pinned Kronos-mini + Kronos-Tokenizer-2k configuration used in Pilot-002 and Stability v0.2:
  CPU, 2 threads, W=96 OHLC, 3 samples, T=1, top_p=0.9, seed=20261003+anchor index.
- No fine tuning. Kronos remains PRETRAINED_CONTAMINATION_UNKNOWN.

## Primary rule
Trade only when:
1. sign(drift) != 0,
2. sign(kronos) != 0,
3. sign(drift) == sign(kronos).

Trade direction is that common sign. Otherwise abstain.

No magnitude threshold, volatility filter, session filter, DC filter, or cost threshold is allowed in v0.3.

## References on identical anchors
Publish flat, always-trade drift, always-trade Kronos, and selective agreement. References are descriptive; the selective rule is the single primary replication hypothesis.

## Execution and costs
Exactly reuse registered arithmetic:
- hypothetical entry at open t+1,
- fixed exit at close t+h,
- C0 gross,
- C1 real BID/ASK spread + 0.5*spread slippage on entry AND exit,
- C2 doubles spread and slippage,
- commission=0 benchmark assumption.

## Metrics
For every row publish n, active trades, coverage, direction accuracy, win rate, MAE where meaningful, C0/C1/C2 mean per opportunity and per active trade.
Also publish calendar-quarter diagnostics for the selective rule.

## Replication screen
The post-hoc observation is considered replicated inside Train only if all are true:
- selective active trades >= 60,
- selective C1 mean per trade > 0,
- selective C2 mean per trade >= 0,
- at least half of calendar quarters having >=5 selective trades have positive C1 mean/trade.

This is a practical replication screen, not a claim of statistical significance or live profitability.

## Safety checks
- raw date gate,
- complete aggregation,
- exactly 240 anchors,
- same-seed Kronos repeat on first anchor,
- no Validation/Holdout read,
- deterministic agreement rule,
- side-aware execution arithmetic inherited from tested compare.py.

No parameter changes after reading v0.3 outcomes. Failure of this screen ends this rule; success still requires a later formal validation step before Holdout.
