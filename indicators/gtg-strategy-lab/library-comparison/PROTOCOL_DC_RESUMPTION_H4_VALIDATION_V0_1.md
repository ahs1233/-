# GTG DC Correction -> Resumption H4 — Validation Gate v0.1

Registered 2026-10-03 BEFORE any Validation price/outcome is read by this library-comparison research branch.

## Evidence status
This is the first formal Validation dry run for the library-comparison research.

The candidate was SELECTED FROM TRAIN after observing Train-development experiments.
Therefore Validation is an out-of-time protocol dry run, not a pristine OOS claim.

Historical Holdout remains locked.
Pristine OOS remains untouched.

## Authoritative historical split
Frozen source: TRADE_CONTRACT.md §20 + events/split.mjs + FREEZE_RECORD.md v0.2.3.

- firstValidTime = 2021-09-08T17:00:00.000Z
- Train boundary b1 = 2024-03-20T15:20:24.500Z
- Validation/Holdout boundary b2 = 2025-03-25T05:04:34.300Z
- T_freeze = 2026-09-30T13:40:49.000Z
- boundary embargo = 4 hours on each side

Usable Validation scoring window:
- start inclusive = b1 + 4h = 2024-03-20T19:20:24.500Z
- end exclusive = b2 - 4h = 2025-03-25T01:04:34.300Z

Bars in either embargo are not scored.
Feature/state warm-up may read causal past.
No price timestamp >= b2 may be read.

## Train-selected candidate
Exactly one rule is carried into Validation:

DC Correction -> Resumption Swing, H4 only.

Selection rationale recorded before Validation:
- among executable Train-development candidates, this was the only structural rule with positive C1 and C2 at the short H4 horizon in the later Train slice and with both directions positive;
- older Train history was negative, so Validation is specifically intended to test temporal generalization;
- H12/H24 failed and are NOT carried into Validation;
- no geometry/delay/direction/year subgroup is carried forward.

This candidate selection is not itself confirmatory evidence.

## Frozen State Engine
Reuse State + Transition Engine v0.2 byte-for-rule:
- same causal H1 aggregation
- same features
- same thresholds
- same RANGE/TRANSITION/TREND_UP/TREND_DOWN FSM
- same <=3h trading continuity
- no state refit
- no threshold change

Before any Validation trade outcome is computed:
1. run the frozen State Engine causally from historical warm-up through b2;
2. compare every overlapping Train state/feature row through the frozen Train source with State Engine v0.2;
3. require exact state equality and exact numerical feature prefix equality (NaN-equal);
4. if prefix parity fails, STOP before Validation outcomes.

## Validation transition cohort
From the extended frozen FSM:
- source transition must start from RANGE;
- primary=true (source RANGE age >=6);
- FSM resolution must be TREND_UP or TREND_DOWN;
- resolution_time must lie in the usable Validation scoring window;
- resolved direction d = +1 for TREND_UP, -1 for TREND_DOWN.

A transition whose resolution is in embargo/outside Validation is not scored.

## Frozen Directional Change entry rule
Exactly as DC Correction -> Resumption Swing v0.1:

H1 close-only causal DC:
- fine threshold = 0.0025
- macro threshold = 0.0050

At frozen Trend resolution bar r:
- macro direction must equal d or no entry;
- search starts strictly after r.

Correction c:
- first later bar while frozen State remains same Trend,
- fine DC newly confirms at c,
- fine direction = -d,
- macro direction remains d.

Cancel before c if:
- frozen State leaves Trend,
- hard gap >3h,
- macro newly confirms -d.

Resumption s:
- first later bar after c while same Trend,
- fine DC newly confirms at s,
- fine direction = d,
- macro direction remains d.

Cancel before s under the same state/gap/macro-reversal conditions.

First valid correction and first valid resumption only.
No later replacement.

## Entry / H4 exit
Signal = resumption close s.
Entry = open(s+1), requiring gap >0 and <=3h.

Validation horizon is FIXED:
- h = 4 complete H1 trading bars from signal s.

Exit = close(s+4), using the same BID/ASK side-aware cost contract as the Train experiment.

ATR denominator = ATR[s].

No stop, target, trailing, leverage, sizing, compounding, or re-entry.

Eligibility:
- signal s must lie in usable Validation;
- entry and exit must lie before Validation scoring end b2-4h;
- every adjacent observed H1 gap from s through s+4 is >0 and <=3h;
- no trade may cross into the end embargo;
- no Holdout price may be read.

## Costs
Reuse compare.costs exactly:
- C0
- C1 benchmark friction
- C2 doubled friction

## Validation outputs
Report:
- primary RANGE->Transition episodes
- confirmed Trend resolutions in usable Validation
- eligible DC-resumption entries
- coverage
- no-entry reason counts
- mature H4 trades
- up/down trade counts
- direction accuracy
- C0/C1/C2 mean per trade
- C1 win rate
- mean signed displacement / ATR
- MFE / MAE
- correction delay, correction duration, total delay
- by direction when n>=3
- by half-period only as descriptive, never as a selector

No parameter or subgroup may be modified after this Validation run.

## Registered verdict
The Validation verdict has three possibilities.

### INCONCLUSIVE
Return INCONCLUSIVE without promoting/rejecting economic edge if any:
1. mature H4 trades < 10
2. up trades < 3
3. down trades < 3

### PASS
If sample adequacy above holds, ALL must pass:
1. C0 mean/trade > 0
2. C1 mean/trade > 0
3. C2 mean/trade >= 0
4. C1 win rate > 0.50
5. up-direction C1 mean/trade >= 0 when up n>=3
6. down-direction C1 mean/trade >= 0 when down n>=3

### FAIL
If sample adequacy holds and any PASS condition fails.

No p-value claim is made here; this candidate was selected after exploratory Train research and sample size may be small.

## After Validation
- FAIL: candidate is closed; Historical Holdout remains locked.
- INCONCLUSIVE: candidate remains unresolved; Historical Holdout remains locked.
- PASS: do NOT auto-open Historical Holdout.
  First preregister a final Holdout protocol, sample/power caveat, exact candidate identity, and one-shot opening procedure in a separate commit.

## Integrity
- this protocol committed before any Validation read
- exact split generated by frozen makeSplit()
- State Engine prefix parity required before outcomes
- fine DC exactly 0.0025
- macro DC exactly 0.0050
- H4 exactly 4 trading H1 bars
- no H12/H24
- no subgroup filters
- no Validation tuning
- end-embargo respected
- no timestamp >= b2 read
- Historical Holdout read=false
- Pristine OOS read=false

## Prefix-parity serialization addendum — registered before any Validation outcome
The first Validation runner attempt stopped at the prefix gate before DC signals or trade outcomes were computed.

Observed reason:
- frozen Train state_sequence is reloaded from CSV text,
- extended state features are live float64 calculations,
- state labels and discrete structure matched,
- continuous float differences were only IEEE/CSV round-trip noise:
  max absolute difference = 3.552713678800501e-15,
  max relative difference = 6.89194446e-13.

Therefore the prefix gate is clarified as:
- timestamps: exact
- state labels: exact
- boolean cores/breakouts: exact
- DC directions/counts and range_votes: exact
- continuous float features: NaN-equal and absolute tolerance <= 1e-12, rtol=0

The 1e-12 tolerance is fixed now, before any Validation signal/outcome is computed.
Any larger continuous mismatch or any discrete/state mismatch remains a hard STOP.
