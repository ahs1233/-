# GTGLab2 — Ultra Execution Plan V0.1

Status: ACTIVE
Registered: 2026-10-04
Branch: `research/gtglab2`

## Mission

Build a bidirectional XAU trading research system that does not search for a magical single entry.

The system must:
1. understand the higher-timeframe context,
2. understand what each trading session inherited and changed,
3. map liquidity and observable crowd expectations,
4. read moving-average geometry as context rather than a standalone signal,
5. identify RANGE / TRANSITION / TREND_UP / TREND_DOWN,
6. construct LONG or SHORT inventory in controlled tranches,
7. detect invalidation quickly,
8. exit or flip when the market proves the working hypothesis wrong,
9. prove positive execution expectancy after realistic costs,
10. survive forward and holdout validation before promotion.

Core flow:

`HTF Context → Session Narrative → State → Liquidity → MA Geometry → Setup → Entry Construction → Validation/Invalidation → Continue/Exit/Flip`

The architecture is symmetric:
- Range Long
- Range Short
- Trend Long
- Trend Short

No permanent directional bias is allowed.

---

# Non-negotiable research rules

1. Historical Holdout remains locked until the final registered gate.
2. Pristine Forward OOS remains undecoded until the registered corpus gate.
3. Microstructure is collected forward and cannot be tuned against future outcomes before unlock.
4. Failed hypotheses remain in the record.
5. Entry scaling uses a fixed total risk budget; no martingale escalation.
6. A position may be added only while the working state hypothesis remains valid.
7. Parameters are frozen before outcome-linked evaluation.
8. Every result must be reported both overall and by direction, session, regime, and time block.
9. Win rate is not the target metric. Expectancy after costs and drawdown matter.
10. No new model is added unless it answers a specific blocker and beats a registered baseline.

---

# PHASE 0 — Governance and evidence trail

Status: COMPLETE / CONTINUOUS.

Deliverables:
- GTGLab2 canonical branch.
- permanent worklog.
- decisions register.
- experiment register.
- blocker register.
- append-only event ledger.

Gate:
- every meaningful action is reconstructable from Git + GTGLab2 logs.

---

# PHASE 1 — Freeze the system architecture, not the trading thresholds

Status: IN EXECUTION.

Goal:
Create deterministic contracts for information flow without deciding profitability thresholds.

Modules:
1. State Contract
2. Timeframe Contract
3. Session Context Contract
4. Liquidity Context Contract
5. MA Geometry Contract
6. Entry/Inventory Contract
7. Validation/Invalidation Contract
8. Execution/Cost Contract

Required architecture:

### Higher timeframe context
- D1: macro structural location
- H4: structural trend/range context
- H1: operational market state

### Setup timeframes
- M15 / M5: setup, sweep, rejection, retest, correction/resumption

### Trigger timeframe
- M1: execution timing only; never allowed to override the higher-timeframe context by itself.

Gate:
- all modules have explicit inputs/outputs,
- LONG/SHORT symmetry tests pass,
- no future data dependency,
- no outcome labels are required.

---

# PHASE 2 — Causal context feature layer

Status: NEXT.

Goal:
Convert trader reading into raw measurable evidence before any prediction model.

## 2A — Session Narrative Engine

For every operational session record:
- open/high/low/close,
- session range,
- previous session high/low,
- whether previous high/low was swept,
- reclaim/failure state,
- close location within session range,
- displacement from previous session,
- inherited direction/state,
- London reaction to Asia,
- New York reaction to London,
- continuation / reversal / balance descriptors.

Important:
"Market-maker linkage" is represented by observable session-to-session state transfer, not assumed hidden coordination.

## 2B — Multi-Timeframe Context Engine

For each decision timestamp:
- D1 context,
- H4 context,
- H1 state,
- M15 setup structure,
- M5 setup structure,
- M1 trigger structure.

Output must distinguish:
- alignment,
- correction against higher timeframe,
- conflict,
- transition.

No lower timeframe may silently redefine the higher-timeframe trend.

## 2C — Moving Average Geometry Engine

Initial raw MA family:
- EMA 9
- EMA 21
- EMA 50
- EMA 200
- EMA 1000

Measure raw geometry, not "cross = buy":
- price-to-EMA distances,
- EMA slopes,
- ordering,
- pairwise spreads,
- compression/expansion,
- slope acceleration,
- reclaim/loss events,
- persistence above/below.

Thresholds remain unfitted until preregistered experiments.

## 2D — Liquidity Map

Causal candidate levels:
- previous session high/low,
- current session high/low to decision time,
- previous day high/low,
- range boundaries,
- recent structural swing highs/lows,
- breakout/retest boundaries,
- psychological round levels only if defined deterministically.

Output:
- nearest upside liquidity,
- nearest downside liquidity,
- distance in ATR,
- level age,
- number/type of level coincidences.

Gate:
- feature computation is causal,
- synthetic no-lookahead tests pass,
- feature values can be reproduced from the same input bytes.

---

# PHASE 3 — Bidirectional Entry and Inventory Engine

Status: DESIGN AFTER PHASE 2.

Goal:
Replace the "single perfect entry" assumption with controlled inventory construction.

States/actions:

### Range Long
- probe near lower range/liquidity area,
- optional additional tranches if hypothesis remains valid,
- false downside break may improve entry,
- true downside acceptance invalidates LONG.

### Range Short
Mirror of Range Long at upper boundary.

### Trend Long
- do not chase arbitrary price,
- prefer correction/retest/resumption locations compatible with HTF context.

### Trend Short
Mirror of Trend Long.

Inventory model:
- total planned risk fixed before first tranche,
- N tranches configurable and preregistered,
- tranche schedule deterministic,
- no tranche after invalidation,
- average entry and total exposure tracked explicitly.

Gate:
- identical total risk is used when comparing single-entry vs scaled-entry policies,
- LONG and SHORT paths have mirrored tests,
- no martingale behavior possible by construction.

---

# PHASE 4 — Invalidation and Flip Engine

Status: DESIGN AFTER ENTRY CONTRACT.

This is a core research problem.

The engine must distinguish:

### Sweep / Rejection
- temporary trade beyond a known liquidity boundary,
- failure to sustain outside,
- reclaim,
- rejection / loss of momentum,
- optional microstructure confirmation after unlock.

### Acceptance / True Break
- persistence outside,
- failed reclaim,
- structural follow-through,
- retest failure,
- aligned lower highs/lower lows or higher highs/higher lows,
- optional microstructure persistence after unlock.

Actions:
- CONTINUE
- ADD
- HOLD
- REDUCE
- EXIT
- FLIP_WAIT

Important:
A flip is not "close long and immediately market short".
It means:
1. kill the invalidated hypothesis,
2. wait for a high-quality entry in the new direction,
3. construct the new position under the same risk discipline.

Gate:
- maximum invalidation delay is measurable,
- no adding after invalidation,
- flip logic is deterministic before outcome evaluation.

---

# PHASE 5 — Microstructure integration

Status: COLLECTION RUNNING / ANALYSIS LOCKED.

Forward evidence:
- Binance XAU perpetual proxy
- Kraken PAXG/USD
- Bitfinex XAUT/USD
- other valid families when available

Features planned before unlock:
- executed-flow direction/delta,
- footprint imbalance,
- book imbalance,
- liquidity concentration,
- source agreement/dispersion,
- evidence freshness,
- source-family availability.

Research question:

`Does microstructure improve entry/invalidation timing over the same price/session/MTF baseline?`

It is initially a confirmer/rejector/timer.
It may not invent direction by itself in the first registered test.

Unlock gate:
- >=30 elapsed calendar days,
- >=10,000 valid snapshots,
- integrity/quality PASS.

Both mandatory.

---

# PHASE 6 — Execution simulator

Status: BUILD BEFORE FIRST EDGE TEST.

Must model:
- BID/ASK,
- spread,
- slippage scenarios,
- latency / one-bar or timestamp delay,
- tranche fills,
- stop/invalidation exits,
- partial/full exits,
- long and short costs,
- maximum exposure,
- turnover.

Primary metrics:
- net expectancy per trade/episode,
- profit factor,
- drawdown,
- MAE/MFE,
- average entry improvement vs single entry,
- invalidation loss,
- time-to-invalidation,
- post-flip performance,
- trade frequency,
- exposure time.

Gate:
- simulator parity tests pass on synthetic known cases.

---

# PHASE 7 — Preregister first integrated hypotheses

Status: LOCKED UNTIL COMPONENTS EXIST.

Candidates must be few and explicit.

H1:
Scaled fixed-risk entry improves expectancy or adverse excursion versus single-entry baseline under the same state and total risk.

H2:
Session-to-session context improves acceptance/rejection classification over State Engine alone.

H3:
MTF alignment improves trade selection over H1-only context.

H4:
MA geometry adds incremental timing value beyond structural state/liquidity.

H5 after corpus unlock:
Microstructure adds incremental entry/invalidation value beyond the full price/session/MTF baseline.

No threshold changes after seeing evaluation results.

---

# PHASE 8 — Time-block / episode evaluation

Status: LOCKED UNTIL PREREGISTRATION.

Evaluation unit is not every minute.

Use:
- transition episodes,
- range-edge episodes,
- session episodes,
- purged chronological blocks,
- walk-forward blocks,
- clustered/block-bootstrap uncertainty.

Reports:
- LONG vs SHORT,
- RANGE vs TREND,
- Asia/London/New York context,
- year/time block,
- volatility bucket,
- source-family availability.

Reject a candidate if profitability depends on one short period or one direction only.

---

# PHASE 9 — Forward shadow / paper execution

Status: FUTURE GATE.

No optimization here.

The frozen candidate receives live data and records:
- proposed state,
- setup,
- action,
- tranche,
- invalidation,
- hypothetical fill,
- realized forward outcome.

Gate:
- stable live behavior,
- no protocol drift,
- acceptable operational failure rate,
- positive/acceptable economics under frozen rules.

---

# PHASE 10 — Final Holdout gate

Status: SEALED.

Historical Holdout is opened only after:
- architecture frozen,
- candidate frozen,
- thresholds frozen,
- cost model frozen,
- acceptance metrics frozen.

One-shot purpose:
detect hidden overfitting.

No repair using Holdout results.

---

# PHASE 11 — Promotion

Only after all gates.

Possible outputs:
- research engine,
- live decision dashboard,
- TradingView-facing context/alerts,
- paper/live execution adapter only if separately approved and risk-controlled.

A failed final candidate returns to research with a new version and new evidence; the original Holdout result remains recorded.

---

# Immediate execution order

## Sprint A — now
A1. Create typed bidirectional contracts.
A2. Add synthetic symmetry tests.
A3. Add inherited session bucket parity with existing State Engine.
A4. Add raw EMA geometry extractor without trading thresholds.
A5. Register architecture files and tests.

## Sprint B
B1. Build causal session feature extraction.
B2. Build MTF resampling/context adapter using existing data foundation.
B3. Build causal liquidity map.
B4. Add no-lookahead tests.

## Sprint C
C1. Define inventory/tranche state machine.
C2. Implement Range Long/Short symmetry.
C3. Implement Trend Long/Short symmetry.
C4. Implement EXIT and FLIP_WAIT.
C5. Test fixed-risk invariant.

## Sprint D
D1. Build execution simulator.
D2. Add BID/ASK and cost scenarios.
D3. Add episode metrics.
D4. Baseline single-entry vs scaled-entry interface.

## Sprint E
E1. Freeze first integrated protocol.
E2. Continue forward collection.
E3. Run only unlocked non-forward tests.
E4. Wait for registered microstructure gate before outcome linkage.

---

# Definition of success

GTGLab2 is not successful when it produces a visually convincing signal.

It is successful when a frozen bidirectional policy:

1. identifies context causally,
2. enters with controlled risk,
3. detects invalidation quickly,
4. can change side without emotional attachment,
5. remains positive after realistic costs,
6. is stable across time/regimes,
7. adds value over simpler baselines,
8. survives forward shadow and final Holdout.

