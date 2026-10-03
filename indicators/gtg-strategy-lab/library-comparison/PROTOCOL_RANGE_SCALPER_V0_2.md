# GTG Range Scalper v0.2 — frozen-boundary protective exit

Registered 2026-10-03 before any v0.2 execution outcome is computed.

## Evidence status
Exploratory Train-development diagnostic.
v0.1 showed that midpoint-target trades were strongly positive while trades held until the coarse RANGE state ended were strongly negative.
v0.2 changes only the failure exit logic; entry zones, target, State source, costs, and splits remain unchanged.

Validation and Historical Holdout remain closed.

## Frozen source
State Engine v0.2 unchanged:
- state_sequence SHA256:
  cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772
- state content:
  c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e
- canonical manifest:
  30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

v0.1 summary comparator SHA256:
- 63e972c35a7d7a98e7ba4f0c1750d9f5bb439a93257f39c6b3409c42a8e6f8f5

## Entries
Identical v0.1 logic:
- State[t] = RANGE
- freeze prior24 upper/lower/midpoint at t
- close inside channel
- long: position <=0.25 and bullish candle
- short: position >=0.75 and bearish candle
- enter open(t+1)
- one active trade
- same split and <=3h continuity rules

No entry threshold changes.

## Exit priority
At each complete held bar k, using the frozen channel:

### Midpoint target
Long:
- Close[k] >= midpoint

Short:
- Close[k] <= midpoint

### Frozen-boundary invalidation
Long:
- Close[k] < frozen lower

Short:
- Close[k] > frozen upper

This means the mean-reversion thesis is invalid once price closes outside the source channel against the trade.

### State handoff fallback
- State[k] != RANGE

All conditions are observed only at close(k).
Execution remains open(k+1).

Reasons:
- TARGET
- BOUNDARY_INVALIDATION
- STATE_EXIT
- TARGET_AND_STATE_EXIT
- BOUNDARY_AND_STATE_EXIT

Target and adverse boundary invalidation are mutually exclusive for a valid channel.

If boundary invalidation and State exit occur on the same bar:
- reason = BOUNDARY_AND_STATE_EXIT

If target and State exit occur on the same bar:
- reason = TARGET_AND_STATE_EXIT

## Gaps / sequencing / costs
Identical to v0.1:
- no hard-gap bridge
- censored gap contributes no PnL, then independent scanning resumes after gap
- split boundary not crossed
- open-to-open execution
- compare.costs C0/C1/C2
- ATR at entry signal
- no stop buffer
- no intrabar fill
- no leverage/sizing/compounding

## Metrics
Same v0.1 metrics plus:
- boundary invalidation count/fraction
- C1/C2 of boundary invalidations
- reduction in average loss versus v0.1 STATE_EXIT
- v0.2 overall delta C1/C2 versus frozen v0.1 per split

By direction and year remain descriptive.

## Registered stability screen
All:
1. library completed trades >=100
2. evaluation completed trades >=100
3. evaluation long >=40
4. evaluation short >=40
5. library C1 >0
6. evaluation C1 >0
7. library C2 >=0
8. evaluation C2 >=0
9. library C1 win >0.50
10. evaluation C1 win >0.50
11. at least two of 2021,2022,2023 positive C1 with n>=20
12. no full evaluation year >60% of completed trades
13. library C1 > frozen v0.1 library C1 (-0.2263991021)
14. evaluation C1 > frozen v0.1 evaluation C1 (-0.1811011019)

Passing remains development evidence only.

## Integrity
- state hashes unchanged
- comparator hash unchanged
- entry logic byte-equivalent in behavior to v0.1
- channel frozen at signal
- boundary invalidation uses no fitted buffer
- target/boundary/state signals use close only
- exit next open
- no outcome-dependent threshold changes
- Validation read=false
- Historical Holdout read=false

## Decision
If v0.2 passes:
- freeze as the Range-Scalper baseline.

If economics improve but remain negative:
- the next question is not where to place a wider/narrower stop.
- build a pre-break Transition Warning layer that decides when Scalper should stop taking new Range entries before a breakdown.

If it fails to improve:
- revisit RANGE representation rather than tune exit distance.

No Holdout opens automatically.
