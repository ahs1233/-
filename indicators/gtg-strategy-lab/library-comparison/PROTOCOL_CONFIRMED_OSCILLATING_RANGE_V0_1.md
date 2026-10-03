# GTG Confirmed Oscillating Range v0.1 — episode-native channel scalper

Registered 2026-10-03 before any execution outcome is computed.

## Purpose
Replace the crude rolling prior24 channel with a causal episode-native Range box that must prove real two-sided oscillation before Scalper is enabled.

Architecture:

State Engine says RANGE
-> build an episode-native box from the first six continuous RANGE bars
-> require a completed outer-quartile-to-opposite-outer-quartile traverse
-> only then set OSCILLATING_RANGE_CONFIRMED = true
-> allow edge-rejection Scalper signals
-> TRANSITION or box invalidation -> Scalper OFF

This is a market-representation change, not a threshold optimization of Range Scalper v0.1/v0.2.

## Evidence status
Train-development diagnostic.
The State Engine and earlier Range experiments have already used this historical region.
Validation and Historical Holdout remain closed.

## Frozen source
State Engine v0.2 unchanged:
- state_sequence.csv.gz SHA256:
  cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772
- state content SHA256:
  c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e
- canonical manifest SHA256:
  30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

No State Engine rule is changed.

## Time splits
Library:
- timestamp < 2021-01-01

Evaluation:
- 2021-01-01 <= timestamp < 2024-03-20T00:00:00Z

No position may cross a split boundary.
Feature warm-up may come only from earlier bars in the same source.

## Continuous RANGE episode
A RANGE episode is a sequence of observed H1 bars where:
- frozen State Engine state = RANGE
- adjacent timestamp gap >0 and <=3 hours

Episode resets immediately on:
- state != RANGE
- missing state
- gap >3 hours

## Box construction
Use the first exactly six continuous RANGE bars of each episode.

Why six:
- six trading H1 bars is already the frozen minimum RANGE age used by the State/Transition research library;
- it is not selected from Range-Scalper outcomes.

At the close of the sixth RANGE bar:
- box_lower = minimum BID low across the six bars
- box_upper = maximum BID high across the six bars
- require finite upper > lower
- box_midpoint = (upper + lower)/2
- box_width = upper-lower
- box becomes FROZEN for the remainder of this RANGE episode

The box is never rolled, widened, narrowed, or refit.

## Box invalidation
After box freeze, if any complete H1 close is:
- below box_lower, or
- above box_upper

then the box is INVALIDATED for that RANGE episode.

Once invalidated:
- no new Scalper trades may be opened in that episode
- any active trade exits causally at next open after the invalidating close
- do not build a second box until a new RANGE episode begins after state leaves RANGE or a hard gap resets the episode

This is not a fitted stop buffer.

## Oscillation confirmation
The frozen box has four natural zones:
- lower outer quartile: position <=0.25
- upper outer quartile: position >=0.75
- middle region: otherwise

position = (BidClose-box_lower)/box_width.

After box freeze, track outer-zone visits causally.

A full oscillation traverse is confirmed when:
- price first closes in one outer quartile,
- later, while box remains valid and state remains RANGE, price closes in the opposite outer quartile.

Either order is valid:
- LOWER -> UPPER
- UPPER -> LOWER

No minimum number of bars is imposed beyond chronology.
No distance threshold beyond inherited quartiles.

At the close completing the first full traverse:
- oscillation_confirmed = true

The completion bar itself is NOT eligible for entry.
Signals may begin from the next observed complete H1 bar.

Once confirmed, status remains true until episode reset or box invalidation.

## Entry
Only when:
- state = RANGE
- valid frozen box exists
- oscillation_confirmed = true
- current bar is strictly after confirmation bar
- close remains inside frozen box

Long:
- position <=0.25
- BidClose > BidOpen

Short:
- position >=0.75
- BidClose < BidOpen

If neither: no trade.
If both: fail closed.

Execution:
- enter open(t+1)
- require t+1 exists in same split
- gap t -> t+1 >0 and <=3h
- one active trade only

## Exit priority
While position is open, evaluate each complete bar causally.

1. MIDPOINT TARGET
Long:
- BidClose >= box_midpoint
Short:
- BidClose <= box_midpoint

2. BOX INVALIDATION
Long or short:
- BidClose < box_lower or BidClose > box_upper

3. STATE HANDOFF
- frozen State Engine state != RANGE

If target and state handoff happen on same bar:
- TARGET_AND_STATE_EXIT

If box invalidation and state handoff happen on same bar:
- BOX_AND_STATE_EXIT

Target and box invalidation cannot both be true for a valid box.

Execution of any exit:
- open(k+1)
- require causal <=3h gap
- otherwise censor at hard gap
- no intrabar fills

## Costs
Use compare.costs exactly:
- BID/ASK next-open entry
- BID/ASK next-open exit
- ATR denominator = ATR at signal bar
- C0
- C1 benchmark friction
- C2 doubled friction

No leverage, sizing, commission override, trailing stop, compounding, or overlapping positions.

## Sequencing
Within each split:
- scan chronologically
- only one position active
- ignore all new signals while active
- after causal exit, resume from execution bar
- box state persists if still valid and state still RANGE

## Metrics
Per split:
- total RANGE episodes
- episodes reaching 6-bar box freeze
- invalidated-before-confirmation episodes
- confirmed oscillating episodes
- confirmation rate
- median bars from episode start to confirmation
- confirmed episode duration
- flat eligible edge signals
- completed trades
- censored counts
- long/short counts
- C0/C1/C2 mean per trade
- C1 win rate
- directional accuracy
- mean/median holding bars
- MFE/MAE
- target / box invalidation / state exit reason counts
- by calendar year when n>=20
- by direction

Descriptive only:
- economics of trades by confirmation direction (LOWER->UPPER vs UPPER->LOWER)
- do not promote subgroup from this run.

## Frozen comparators
Range Scalper v0.1 evaluation:
- C1 = -0.1811011018983893
- C2 = -0.36828699164122547
- C1 win = 0.4032846715328467

Range Scalper v0.2 evaluation:
- C1 = -0.18335671786112934
- C2 = -0.3699642211725527

The new representation must not modify comparator results.

## Registered stability screen
All must hold:

Structure:
1. library confirmed oscillating episodes >=50
2. evaluation confirmed oscillating episodes >=50
3. evaluation completed trades >=100
4. evaluation long >=40
5. evaluation short >=40

Economics:
6. library C1 >0
7. evaluation C1 >0
8. library C2 >=0
9. evaluation C2 >=0
10. library C1 win >0.50
11. evaluation C1 win >0.50
12. evaluation C1 > Range Scalper v0.1 C1
13. at least two of 2021/2022/2023 positive C1 with n>=20
14. no single full evaluation year >60% of trades

Passing remains development evidence only.

## Integrity
- protocol committed before execution
- frozen state hashes unchanged
- episode resets causal
- exactly first six RANGE bars define box
- box never rolls/refits
- first full traverse required before entry
- confirmation bar not tradable
- entry next open
- one active trade
- target/invalidation/state exit use close only
- exit next open
- no hard-gap bridge
- no split crossing
- no Validation read
- no Historical Holdout read

## Decision
If it passes:
- freeze Confirmed Oscillating Range as candidate Range execution layer
- integrate with TRANSITION -> Scalper OFF
- require a separate temporal/forward gate before Holdout.

If it fails:
- preserve result
- do not tune six bars/quartiles/midpoint on the same sample
- next Range research should move to explicit support/resistance level identity and repeated-touch geometry rather than another threshold tweak.

No Holdout opens automatically.
