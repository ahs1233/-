# GTG State + Transition Engine v0.2 — confirmed handoff protocol

Registered 2026-10-03 before v0.2 historical outcomes are computed.

## What changes from v0.1
v0.1 is frozen evidence and is not rewritten.

v0.2 keeps every structural threshold from v0.1 unchanged and changes only:
1. market continuity semantics,
2. the primary outcome anchor from TRANSITION onset to TRANSITION resolution.

Reason established by v0.1:
- XAUUSD has normal daily maintenance gaps of 2-3 timestamp hours.
- exact-one-hour continuity fragmented state runs and produced zero mature 24h paths.
- TRANSITION onset is better interpreted as "stop range execution / wait" than as an immediate directional swing signal.

No v0.1 outcome is used to tune state thresholds.

## States
Unchanged:
- RANGE
- TRANSITION
- TREND_UP
- TREND_DOWN

Operational meaning:
- RANGE: future Scalper engine may operate.
- TRANSITION: Range/Scalper engine stands down; no automatic Swing direction.
- TREND_UP: candidate Swing-long regime.
- TREND_DOWN: candidate Swing-short regime.

## Data gate
Canonical JForex BID/ASK M1 -> complete H1 bars.

2018-03-01 <= raw timestamp < 2024-03-20T00:00:00Z.

Validation and Historical Holdout remain closed.

Descriptive split:
- library: before 2021-01-01
- evaluation: 2021-01-01 through raw gate

## Structural features and thresholds
IDENTICAL to v0.1:
- DC thresholds 0.0025 / 0.005 / 0.010 / 0.020
- drift12 / drift24 / drift48
- efficiency24 / efficiency48
- spread/ATR
- ATR/week ratio
- prior 24 complete trading-H1 channel
- breakout excursion

RANGE core:
- efficiency24 <=0.35
- efficiency48 <=0.35
- abs(drift24) <=1.50 ATR
- abs(drift48) <=3.00 ATR
At least 3 of 4.

TREND_UP:
- dc_up_count >=3
- drift24 >=+1.00 ATR
- efficiency24 >=0.35

TREND_DOWN symmetric.

Breakout:
- >=0.10 ATR beyond the prior-24-bar channel boundary.

FSM transition/confirmation logic remains identical to v0.1.

## Market-aware continuity
A sequence of complete H1 bars is considered operationally continuous when every adjacent timestamp gap is <=3 hours.

Rationale fixed before v0.2 scoring:
- observed regular XAU maintenance produces 2h gaps,
- some session/DST closures produce 3h gaps,
- weekend closures are around 50h and therefore remain hard resets.

Rules:
- gap <=3h: state memory, range age and transition confirmation continue.
- gap >3h: reset transient FSM memory and split run statistics.
- outcome paths reject any gap >3h.
- horizons are counted in subsequent complete H1 trading bars, not wall-clock hours.

Thus "24-bar outcome" means the next 24 complete H1 trading bars without a >3h closure.

## Primary range-exit workflow

### Step A — TRANSITION onset
When RANGE enters TRANSITION:
- record the same causal event features as v0.1,
- freeze the range boundaries,
- record onset candidate direction and trigger,
- mark this timestamp as SCALPER_STAND_DOWN.

No Swing direction is authorized at Step A.

### Step B — resolution
The unchanged FSM resolves within max 4 complete H1 bars to one of:
- TREND_UP
- TREND_DOWN
- RANGE
- unresolved because of a >3h market closure/data end

Interpretation:
- TREND_UP -> SWING_LONG_CANDIDATE
- TREND_DOWN -> SWING_SHORT_CANDIDATE
- RANGE -> RANGE_RESUMED / fake-break family

Minimum source range age for primary episodes remains 6 complete H1 trading bars.

## Primary evaluation anchor
For episodes resolved to TREND_UP or TREND_DOWN:
- primary outcome anchor = resolution bar
- primary direction = resolved trend direction
- use ATR at resolution

For episodes resolved RANGE:
- no directional Swing outcome is assigned.
- they count as range resumptions.

## Post-resolution outcomes
For confirmed trend resolutions and horizons of next:
- 1 complete H1 trading bar
- 4 bars
- 12 bars
- 24 bars

Require:
- enough future bars,
- every adjacent timestamp gap in path <=3h,
- outcome remains before 2024-03-20.

Record:
- signed displacement ATR in resolved trend direction
- MFE ATR
- MAE ATR
- directional correctness = sign(future displacement) equals resolved trend
- whether final close remains beyond frozen range boundary
- whether price returned inside frozen range at any point

## Onset comparison
Retain onset outcomes using the same market-aware trading-bar horizons only as a secondary comparator.

Purpose:
quantify whether waiting for confirmation improves directional persistence versus trading the first attempted break.

This comparison is descriptive, not a trading rule.

## Core reports
Separately for library and evaluation:

State structure:
- occupancy
- run length
- transition matrix

Range exits:
- total primary episodes
- onset trigger direction balance
- resolution counts
- resolution delay distribution
- fraction returning to RANGE
- fraction resolving into trend

Confirmed-trend handoff:
- n by resolved direction
- directional accuracy after resolution at 1/4/12/24 bars
- signed displacement mean/median
- MFE/MAE
- final-close-beyond-range fraction
- return-inside-range fraction

Compare:
- onset candidate direction vs post-onset outcomes
- confirmed resolution direction vs post-resolution outcomes

## Registered v0.2 sanity gates
All are descriptive integrity/utility gates, not trading-profit gates:

1. state feature prefix invariance PASS.
2. max TRANSITION age <=4 bars.
3. evaluation has >=100 primary RANGE->TRANSITION episodes.
4. evaluation has >=100 confirmed TREND resolutions with mature 24-bar outcomes.
5. confirmed resolutions include both TREND_UP and TREND_DOWN.
6. no single evaluation calendar year contributes >60% of mature confirmed-trend 24-bar outcomes.
7. RANGE median efficiency24 < both trend-state medians.
8. TREND_UP median drift24 >0 and TREND_DOWN median drift24 <0.
9. resolved-trend 4-bar direction accuracy is reported but has no required pass threshold in v0.2.

No state threshold may be modified from the result of these gates.

## Integrity
- protocol committed before v0.2 outcomes
- raw manifest hashes
- no Validation/Holdout
- state assignment contains no future outcome
- frozen state sequence before outcomes
- frozen range boundaries during transition
- market gap rule <=3h fixed before scoring
- future path uses only post-anchor data
- no profitability threshold or execution cost filter selected in v0.2

## Next step
If v0.2 shows that confirmed resolution has meaningfully more stable directional persistence than onset:
- freeze State Engine v0.2,
- construct the Transition Memory dataset,
- use STUMPY/DTW and later ML to estimate:
  P(RANGE resumes),
  P(TREND_UP resolves),
  P(TREND_DOWN resolves)
from TRANSITION-onset features,
- use Kronos only as one feature/expert inside TRANSITION.

If confirmed resolution itself is unstable, revise the structural representation in a new protocol rather than opening Holdout.
