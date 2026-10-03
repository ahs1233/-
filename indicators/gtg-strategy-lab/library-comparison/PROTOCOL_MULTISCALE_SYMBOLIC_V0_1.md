# Multi-Scale DC + Symbolic Regression v0.1 — preregistered Train-only experiment

Registered 2026-10-03 before feature extraction, PySR fitting, or scoring for this phase.

## Purpose
Test whether a causal multi-scale Directional Change state for XAUUSD contains a compact, interpretable relationship with the next normalized price displacement. This phase changes the state representation after fixed-bar STUMPY/DTW and single-threshold Wave Memory failed to establish an economic edge. It does not tune those failed matchers.

## Isolation
- Frozen Navigator / GTG TRADE_CONTRACT remain untouched.
- Canonical local JForex BID/ASK M1 store only.
- Validation and Historical Holdout remain closed.
- This experiment is independent of Selective Swing v0.3. Its rule/results may not change this protocol after registration.

## Data boundary and internal splits
Absolute raw read gate:
- 2018-03-01 <= raw date < 2021-07-31.

Feature warm-up:
- 2018-03-01 <= t < 2019-01-01.

Symbolic discovery fit:
- 2019-01-01 <= anchor < 2020-04-01.

Equation selection:
- 2020-04-01 <= anchor < 2020-07-01.

Locked internal replication:
- 2020-07-01 <= anchor < 2021-07-31.

No source date at or after 2021-07-31 may be opened. SHA256 every raw daily file used.

## Tracks and targets
Scalp:
- M5 complete bars only.
- horizon h=3 bars (15 minutes).
- base DC threshold = 0.001.

Swing:
- H1 complete bars only.
- horizon h=4 bars (4 hours).
- base DC threshold = 0.005.

ATR:
- simple rolling 14-bar true range, identical to the library-comparison branch.

Target for both tracks:
y[t] = (BidClose[t+h] - BidClose[t]) / ATR[t].

The future h-bar path must be contiguous. No stop/target simulation in this phase.

## Multi-scale Directional Change state
Use four fixed threshold multipliers relative to the inherited base threshold:
- 0.5x
- 1.0x
- 2.0x
- 4.0x

Therefore:
- Scalp thresholds: 0.0005, 0.001, 0.002, 0.004.
- Swing thresholds: 0.0025, 0.005, 0.01, 0.02.

DC is close-only and causal. A pivot/extreme is not available at its extreme time; state changes only on the confirmation bar. Prefix invariance is mandatory.

At every anchor and every threshold scale, use only the most recently confirmed state/event available at t.

Four features per scale (16 total):
1. dir: current confirmed DC direction in {-1,0,+1}.
2. age: log1p(number of bars since latest confirmation).
3. amp_atr: signed ATR-normalized amplitude of the last completed confirmed leg.
4. retrace: log1p(abs(last leg amplitude / preceding leg amplitude)); use 0 when undefined.

Two causal bar/execution context features:
17. drift12 = (BidClose[t] - BidClose[t-12]) / ATR[t].
18. spread_atr = (AskClose[t] - BidClose[t]) / ATR[t].

No session, news, volume, zone, order-flow, or future-derived feature is allowed in v0.1.

## Anchor construction
Discovery-fit and selection:
- deterministic stride = h+1 complete bars to avoid overlapping target horizons.
- starting offset is the first eligible bar in the registered interval.
- selection depends only on timestamp/availability, never on returns.

Replication:
- exactly 240 deterministic evenly spaced eligible anchors per track when availability permits.
- selected outcome horizons must not overlap.
- the same replication anchors are used by every comparator.

## PySR environment and search
Use dedicated isolated environment .venv-pysr.
- PySR version fixed to 2.6.0 for this experiment.
- Record Python, PySR, juliacall, Julia and SymbolicRegression.jl versions/revisions before fitting.
- First-import dependency/bootstrap activity is environment setup only and may not read market data.

Fit a separate symbolic regressor for Scalp and Swing on discovery-fit anchors only.

Fixed operator/search configuration:
- binary operators: +, -, *, /
- unary operators: abs
- max expression size: 15
- max depth: 8
- niterations: 120
- random_state: 20261003
- deterministic serial execution; no parallel stochastic search
- default squared-error training loss unless PySR 2.6.0 rejects this exact configuration, in which case fail closed and record the environment error; do not substitute another loss after reading outcomes.

No feature selection based on target statistics is allowed before PySR.

## Equation selection without economic tuning
After PySR finishes on discovery-fit:
- take its generated equation table only.
- discard equations with complexity > 15.
- evaluate every remaining equation on the registered Selection interval.
- choose the equation with lowest Selection MAE.
- ties: lower complexity, then stable table order.
- do NOT use C0/C1/C2, win rate, direction accuracy, or Replication outcomes to select the equation.
- persist the exact selected expression, coefficients, feature names, PySR table and hashes before opening/scoring Replication anchors.

The selected expression is then frozen for Replication.

## Replication comparators on identical anchors
1. flat.
2. last-12-bar drift sign/value.
3. base-threshold causal DC direction.
4. selected symbolic equation, always-trade sign.
5. selected symbolic equation with cost-aware abstention.
6. Kronos-mini with the same pinned model/tokenizer revisions and inference configuration used previously; PRETRAINED_CONTAMINATION_UNKNOWN.

No single-threshold Wave-DTW is rerun here; its completed v0.1 result remains prior evidence.

## Cost-aware abstention
The symbolic selective rule is fixed before Replication:
- pred = frozen symbolic equation output in ATR units.
- current_cost_proxy = 2 * (AskClose[t] - BidClose[t]) / ATR[t].
- trade only when sign(pred) != 0 and abs(pred) > current_cost_proxy.
- otherwise abstain.
- trade direction = sign(pred).

The 2x spread proxy approximates the previously registered C1 round-trip spread/slippage structure under equal entry/exit spreads. It is not tuned from outcomes.

## Realized execution metrics
Reuse the existing side-aware benchmark arithmetic exactly:
- hypothetical entry at open t+1,
- exit at close t+h,
- C0 = gross,
- C1 = real BID/ASK spread plus 0.5*spread slippage on entry and exit,
- C2 = doubled spread/slippage benchmark,
- commission = 0 benchmark assumption.

Publish for every comparator:
- n, active, coverage,
- MAE ATR where meaningful,
- directional accuracy,
- win rate,
- C0/C1/C2 mean per opportunity,
- C0/C1/C2 mean per active trade,
- calendar-quarter C1 diagnostics.

## Primary replication screen
The cost-aware symbolic rule is considered promising inside Train only if all hold:
- active trades >= 60,
- mean C0 per active trade > 0,
- mean C1 per active trade > 0,
- mean C2 per active trade >= 0,
- at least half of calendar quarters with >=5 active trades have positive mean C1/trade.

This is not a live-profitability or statistical-significance claim. Passing does not open Historical Holdout automatically.

## Safety tests required before fitting/scoring
- raw date gate,
- complete aggregation,
- DC prefix causality at all four scales,
- confirmation not backdated,
- multi-scale feature prefix invariance,
- target maturity and non-overlap,
- discovery/selection/replication date separation,
- no target-derived feature selection,
- equation selected without economic metrics,
- selected expression frozen before Replication,
- current cost proxy uses only t information,
- same-seed Kronos repeat on first replication anchor,
- side-aware C0/C1/C2 arithmetic.

No parameter/operator/threshold/feature changes are allowed after reading Selection or Replication outcomes. Any change requires a new protocol version.
