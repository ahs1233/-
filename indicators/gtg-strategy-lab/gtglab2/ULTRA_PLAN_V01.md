# GTGLab2 — Ultra Execution Plan V0.1

Status: ACTIVE
Registered: 2026-10-04
Branch: `research/gtglab2`

## Mission

Build a bidirectional XAU trading research system that reads the market before it trades it.

Core flow:

`HTF Context → Session Narrative → Market State → Liquidity Map → MA Geometry → Setup → Entry Construction → Validation/Invalidation → Continue / Exit / Flip`

Executable modes:
- Range Long
- Range Short
- Trend Long
- Trend Short

There is no permanent bullish or bearish bias.

## Research laws

1. Historical Holdout stays locked until the final registered gate.
2. Pristine Forward OOS stays undecoded until its registered gate.
3. Microstructure is collected forward and cannot be tuned to known future outcomes before unlock.
4. Failed hypotheses remain documented.
5. Scaling uses one fixed total risk budget; no martingale escalation.
6. No tranche can be added after the working hypothesis is invalidated.
7. Thresholds are frozen before outcome-linked evaluation.
8. Results are reported by direction, regime, session, and chronological block.
9. Win rate is not the objective; net expectancy and drawdown are.
10. No new model is added unless it solves a named blocker and beats a simpler baseline.

# Phase 0 — Governance

Status: COMPLETE / CONTINUOUS.

Canonical branch, worklog, decisions, experiments, blockers and append-only event ledger are active.

# Phase 1 — Architecture contracts

Status: IN EXECUTION.

Timeframe roles:
- D1: macro context
- H4: structural context
- H1: operational state
- M15: setup
- M5: setup
- M1: trigger only

Rule: a lower timeframe cannot silently redefine higher-timeframe context.

Required states/actions:
- RANGE / TRANSITION / TREND_UP / TREND_DOWN
- LONG / SHORT / FLAT
- PROBE / ADD / HOLD / REDUCE / EXIT / FLIP_WAIT

Gate:
- typed contracts,
- LONG/SHORT symmetry tests,
- causal inputs only,
- no future labels.

# Phase 2 — Causal context layer

## Session Narrative
Measure what each session inherited and changed:
- open/high/low/close
- session range
- prior session high/low
- sweep/reclaim/failure
- displacement
- inherited state
- London reaction to Asia
- New York reaction to London
- continuation / reversal / balance

## Multi-timeframe context
For each decision timestamp:
- D1 context
- H4 context
- H1 state
- M15 structure
- M5 structure
- M1 trigger

Outputs:
- aligned
- corrective
- conflicting
- transitional

## Moving-average geometry
Initial EMA family:
- 9
- 21
- 50
- 200
- 1000

Measure:
- price-to-EMA distance
- slope
- ordering
- pairwise spread
- compression/expansion
- reclaim/loss
- persistence above/below

No default rule such as "cross = buy".

## Liquidity map
Causal levels:
- previous session high/low
- current session high/low to decision time
- previous day high/low
- range boundaries
- structural swing highs/lows
- breakout/retest boundaries

# Phase 3 — Bidirectional Entry / Inventory Engine

Entry is a managed sequence, not one magical point.

Range Long:
- probe near lower range/liquidity area
- add only while RANGE hypothesis remains valid
- false downside break may improve average entry
- true downside acceptance invalidates LONG

Range Short:
- exact mirror

Trend Long / Trend Short:
- prefer correction/retest/resumption locations compatible with HTF context

Inventory discipline:
- total planned risk fixed before tranche 1
- tranche count and sizing preregistered
- no adding after invalidation
- average price and total exposure explicit
- single-entry vs scaled-entry comparison uses equal total risk

# Phase 4 — Invalidation / Flip Engine

Central question:

`Is the excursion outside a known boundary a liquidity sweep, or genuine acceptance into a new state?`

Sweep/rejection evidence:
- temporary break
- failure to continue
- reclaim
- rejection structure
- loss of directional persistence
- later microstructure confirmation after unlock

Acceptance/true-break evidence:
- persistence outside
- failed reclaim
- follow-through
- failed retest
- directional structure continuation
- later persistent microstructure agreement

Actions:
- CONTINUE
- ADD
- HOLD
- REDUCE
- EXIT
- FLIP_WAIT

FLIP_WAIT means:
1. kill the invalidated hypothesis,
2. wait for a better entry in the new direction,
3. rebuild under the same risk discipline.

# Phase 5 — Microstructure integration

Status: COLLECTION RUNNING / OUTCOME ANALYSIS LOCKED.

First role:
confirm/reject/time an already-defined setup.

Unlock gate:
- >=30 elapsed calendar days
- >=10,000 valid snapshots
- integrity/quality PASS

# Phase 6 — Execution simulator

Must model:
- BID/ASK
- spread
- slippage
- latency
- tranche fills
- invalidation exits
- partial/full exits
- LONG/SHORT costs
- max exposure
- turnover

Metrics:
- net expectancy
- profit factor
- drawdown
- MAE/MFE
- average-entry improvement
- invalidation loss
- time to invalidation
- post-flip performance
- exposure time

# Phase 7 — Preregister integrated hypotheses

H1: fixed-risk scaled entry improves execution quality versus same-risk single entry.
H2: session context improves sweep-vs-acceptance discrimination over State Engine alone.
H3: MTF alignment improves selection over H1-only context.
H4: MA geometry adds incremental timing value beyond structural state/liquidity.
H5: after corpus unlock, microstructure adds incremental value beyond full price/session/MTF baseline.

# Phase 8 — Episode / time-block evaluation

Do not treat one-minute rows as IID.

Use:
- transition episodes
- range-edge episodes
- session episodes
- purged chronological blocks
- walk-forward blocks
- block/bootstrap uncertainty

Mandatory breakdowns:
- LONG vs SHORT
- RANGE vs TREND
- session context
- chronological block
- volatility bucket
- source availability

# Phase 9 — Forward shadow execution

Frozen candidate only. No optimization.

# Phase 10 — Final Holdout

One-shot overfit detector. No repair using Holdout results.

# Phase 11 — Promotion

Only after all gates.

# Immediate execution order

## Sprint A — active now
A1. Typed bidirectional contracts.
A2. Synthetic LONG/SHORT symmetry tests.
A3. Session bucket parity with inherited State Engine.
A4. Raw EMA geometry extractor.
A5. No-future prefix invariance test.

## Sprint B
B1. Causal Session Narrative features.
B2. Multi-timeframe context adapter.
B3. Causal liquidity map.
B4. No-lookahead tests.

## Sprint C
C1. Inventory/tranche state machine.
C2. Range Long/Short symmetry.
C3. Trend Long/Short symmetry.
C4. EXIT and FLIP_WAIT.
C5. Fixed-risk invariant tests.

## Sprint D
D1. BID/ASK execution simulator.
D2. Cost/slippage scenarios.
D3. Episode metrics.
D4. Single-entry vs scaled-entry interface.

## Sprint E
E1. Freeze first integrated protocol.
E2. Continue forward collection.
E3. Run only unlocked tests.
E4. Wait for registered microstructure gate before outcome linkage.

# Definition of success

GTGLab2 succeeds only when a frozen bidirectional policy:
1. reads context causally,
2. enters under controlled risk,
3. detects invalidation quickly,
4. changes side without attachment,
5. remains positive after realistic costs,
6. is stable across time/regimes,
7. adds value over simpler baselines,
8. survives forward shadow and final Holdout.


## Implementation checkpoint — 2026-10-04

Sprint A:
- A1 Typed bidirectional contracts: IMPLEMENTED.
- A2 Synthetic LONG/SHORT symmetry tests: IMPLEMENTED; independent PASS.
- A3 Session bucket parity foundation: IMPLEMENTED.
- A4 Raw EMA geometry extractor: IMPLEMENTED.
- A5 Prefix invariance / no-future-leakage test: IMPLEMENTED; independent PASS.

Independent foundation test result: 9/9 PASS.

Device-local parity rerun: PENDING due Remote Desktop command timeout.

Next executable sprint: B — causal Session Narrative, multi-timeframe adapter, liquidity map, and no-lookahead tests.


## Implementation checkpoint — Sprint B/C/D

Sprint B — causal context:
- Session Narrative: IMPLEMENTED.
- MTF completed-bar adapter: IMPLEMENTED.
- Causal rolling liquidity map: IMPLEMENTED.
- Causality/no-lookahead tests: 7/7 independent PASS.

Sprint C — inventory and bidirectional policy:
- Fixed-risk tranche state machine: IMPLEMENTED.
- Range Long/Short mapping: IMPLEMENTED.
- Trend Long/Short mapping: IMPLEMENTED.
- EXIT then FLIP_WAIT invariant: IMPLEMENTED.
- Inventory tests: 7/7 independent PASS.

Sprint D — execution:
- Explicit BID/ASK entry/exit: IMPLEMENTED.
- Symmetric slippage model: IMPLEMENTED.
- Same-total-size scaled vs single interface: IMPLEMENTED.
- Episode metrics: IMPLEMENTED.
- Execution tests: 9/9 independent PASS.

Combined regression for Phase 1–4:
- 32/32 tests PASS in independent Python execution.
- Historical Holdout remained locked.
- Pristine OOS remained undecoded.
- Microstructure outcome linkage remained locked.

Remaining operational verification:
- rerun the same suite on the authorized desktop environment after Remote Desktop command responsiveness returns.
