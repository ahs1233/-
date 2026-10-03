# GTG Trend Lifecycle Swing v0.1 — state-duration exit diagnostic

Registered 2026-10-03 before state-lifecycle trade outcomes are computed.

## Evidence status
Exploratory Train-only post-selection diagnostic.
The State Engine and confirmed handoff rules were developed and evaluated on the same Train research region.
This is not independent validation.
Validation and Historical Holdout remain closed.

## Purpose
Replace arbitrary fixed 4/12/24 holding horizons with the user's structural rule:

- enter only after TREND_UP / TREND_DOWN is causally confirmed,
- remain in the Swing while the same TREND state persists,
- exit when that trend state ends.

No fixed profit target or holding-period optimization.

## Frozen sources
State Engine v0.2:
- state_sequence.csv.gz
- transition_library.jsonl
- raw manifest

Confirmed Handoff v0.3:
- primary evaluation episodes
- frozen resolution_time
- frozen resolved_direction
- resolution_delay_bars

No state/transition rule is modified.

## Entry
Eligible episode:
- primary RANGE -> TRANSITION
- evaluation split
- frozen resolution TREND_UP or TREND_DOWN

At resolution bar r:
- direction +1 for TREND_UP, -1 for TREND_DOWN
- state[r] must equal the resolved TREND state
- entry at open(r+1)

Require:
- r+1 exists
- gap r -> r+1 >0 and <=3h

ATR denominator = ATR[r].

## Lifecycle exit
Starting after resolution:
- find the first later complete H1 bar k whose frozen state is not the same resolved TREND state.

The state at k is known only after bar k closes.
Therefore causal exit is:
- open(k+1)

Require:
- k+1 exists
- all adjacent gaps from r through k+1 are >0 and <=3h.

If a hard market gap >3h occurs before the trend-state exit:
- censor the trade; do not bridge the gap.

If data ends before a causal exit:
- censor the trade.

No max holding period.

## Execution arithmetic
Reuse compare.costs with open-to-open quotes:
- entry bid/ask = open(r+1)
- exit bid/ask = open(k+1)
- pass exit bid/ask open values into the cost function's exit quote slots
- ATR = ATR[r]

Report C0/C1/C2.

## Metrics
- eligible confirmed episodes
- active uncensored lifecycle trades
- censored hard-gap count
- censored data-end count
- direction accuracy from entry midpoint to exit midpoint
- C0/C1/C2 mean per trade
- C1 win rate
- duration in trading bars
- elapsed wall-clock hours
- MFE/MAE over the held interval
- exit-state distribution
- up/down subgroups
- calendar-year subgroups where n>=10

## Comparison
Descriptively compare lifecycle C1/C2 to frozen confirmed-handoff fixed horizons.
Do not select a fixed horizon based on this comparison.

## Registered screen
All:
1. active trades >=150
2. C0 >0
3. C1 >0
4. C2 >=0
5. C1 win rate >0.50
6. both directions >=50
7. at least two of 2021,2022,2023 positive C1 with n>=10
8. no single full year contributes >60% of trades

Diagnostic only.

## Integrity
- frozen state SHA unchanged
- exact confirmed episode source
- entry after resolution
- exit only after first state change is causally observable
- no hard-gap bridging
- no future information used for entry/exit decision
- no holding-period parameter
- no Validation/Holdout read

## Next decision
If lifecycle management is materially better and stable:
- use it as the baseline Swing Engine in the integrated Neuro-Symbolic router.

If it fails:
- State Engine still routes market mode, but a separate Swing entry/exit model is required.
- do not tune lifecycle duration because it has no duration parameter.
