# GTG Range Scalper v0.1 — frozen-channel mean-reversion baseline

Registered 2026-10-03 before any Range-Scalper execution outcome is computed.

## Evidence status
Exploratory Train-development diagnostic.
State Engine v0.2 has already been developed on this historical region.
Validation and Historical Holdout remain closed.

## Purpose
Implement the other branch of the user's market-state architecture:

RANGE
-> Scalper ON
-> trade mean reversion from channel edge toward channel midpoint

TRANSITION / TREND
-> no new Range trade
-> if an existing Range trade is still open, exit causally after the RANGE state ends

This is a simple structural baseline, not a tuned production scalper.

## Frozen source
State Engine v0.2:

- state_sequence.csv.gz SHA256:
  cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772

- state content SHA256:
  c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e

- canonical input_manifest.json SHA256:
  30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

No State threshold or RANGE definition is modified.

## Time splits
Report separately:

Library:
- timestamp < 2021-01-01

Evaluation:
- 2021-01-01 <= timestamp < 2024-03-20T00:00:00Z

No trade may use an exit beyond its reporting split boundary.
Feature warm-up may come from earlier bars.

## Frozen Range channel at signal
At signal bar t, require frozen State Engine:
- state[t] = RANGE
- prior24_upper / prior24_lower finite
- upper > lower
- close[t] inside [lower, upper]

Freeze for the life of this trade:
- upper = prior24_upper[t]
- lower = prior24_lower[t]
- midpoint = (upper + lower) / 2
- width = upper - lower
- ATR_ref = ATR[t]

The channel does not roll after entry.

## Entry zones
Use natural quartiles of the frozen channel.

### Long candidate
At RANGE close t:
1. close position <= 0.25:
   - (close-lower)/width <=0.25
2. close >= lower and close <= upper
3. rejection candle points inward:
   - BidClose[t] > BidOpen[t]

### Short candidate
At RANGE close t:
1. close position >=0.75
2. close inside frozen channel
3. rejection candle points inward:
   - BidClose[t] < BidOpen[t]

If neither: no signal.
If both: fail closed.

No percentile, fitted boundary, volatility optimization, or ML is used.

## Entry
For a signal at close t:
- enter at open(t+1)
- long direction +1 / short -1
- require t+1 exists
- gap t -> t+1 >0 and <=3h
- entry must remain before the split boundary

Only one Range-Scalper trade may be active at a time.

## Exit logic
Starting from entry bar t+1, examine each complete H1 bar causally.

### Target exit signal
Long:
- first close[k] >= frozen midpoint

Short:
- first close[k] <= frozen midpoint

### State-handoff exit signal
If before target:
- first bar k with frozen State Engine state[k] != RANGE

This is the architectural handoff:
RANGE -> TRANSITION/TREND means the Range trade must stop.

### Causal execution
The chosen exit signal is known at close(k).
Exit:
- open(k+1)

If target and state exit occur on the same bar:
- reason = TARGET_AND_STATE_EXIT
- execution time is still open(k+1)

Require k+1 exists and gap k -> k+1 >0 and <=3h.

## Hard gaps / split end
If a gap >3h occurs while the position is open:
- censor as HARD_GAP
- do not bridge the closure
- for subsequent independent research episodes, reset flat at the first bar after the gap and resume scanning; the censored trade contributes no PnL

If split/data boundary arrives before a causal exit:
- censor as SPLIT_END / DATA_END

No synthetic weekend fill.

## Costs
Reuse compare.costs exactly using open-to-open quotes:
- entry quote = open(t+1)
- exit quote = open(k+1)
- ATR denominator = ATR_ref

Report:
- C0
- C1 benchmark friction
- C2 doubled friction

No commission beyond existing benchmark contract.

## No stop / no target fill assumption
v0.1 has:
- no hard stop
- no intrabar midpoint fill
- no trailing stop
- no leverage
- no sizing
- no compounding

Target is confirmed only by bar close crossing midpoint, then executed next open.

This intentionally tests the Range/Transition routing before optimizing micro-execution.

## Trade sequencing
Within each split:
- scan chronologically
- when flat, first valid signal enters
- while trade is active, ignore all new signals
- after causal exit, scanning resumes from the exit bar forward

No overlapping trades and no pyramiding.

## Metrics
Separately library/evaluation:
- RANGE bars
- raw edge-zone signals while flat
- entered trades
- completed trades
- censored counts
- long/short counts
- mean/median holding bars
- exit reason counts
- target-before-state-exit fraction
- C0/C1/C2 mean/trade
- C1 win rate
- directional accuracy from entry midpoint to exit midpoint
- MFE/MAE in ATR
- by direction
- by calendar year when n>=20

Additional state-transition diagnostics:
- fraction of trades whose RANGE state ended before midpoint target
- C1 of target exits vs state exits, descriptive only
- no subgroup may be promoted from this run

## Registered stability screen
All must hold:

1. library completed trades >=100
2. evaluation completed trades >=100
3. evaluation long trades >=40
4. evaluation short trades >=40
5. library C1 mean/trade >0
6. evaluation C1 mean/trade >0
7. library C2 mean/trade >=0
8. evaluation C2 mean/trade >=0
9. library C1 win rate >0.50
10. evaluation C1 win rate >0.50
11. at least two of 2021, 2022, 2023 have positive C1 with n>=20
12. no single evaluation full year contributes >60% of completed trades

Passing remains development evidence only.

## Integrity
- frozen state file SHA unchanged
- state content hash unchanged
- canonical manifest unchanged
- signal uses only RANGE state and t-or-earlier channel
- channel boundaries frozen at signal
- entry strictly after signal close
- only one active trade
- target/state exit determined only at close
- exit strictly after exit-signal close
- no hard-gap bridging
- split boundary not crossed
- no outcome-based threshold changes
- Validation read=false
- Historical Holdout read=false

## Decision
If v0.1 passes:
- freeze as Range-Scalper baseline,
- next test breakout/Transition handoff integration and tighter execution separately.

If it fails:
- do not tune quartiles or midpoint on this sample;
- inspect whether failure comes from entry rejection quality, slow midpoint reversion, or Transition exits,
- preregister the next Range representation rather than optimizing thresholds.

No Holdout opens automatically.
