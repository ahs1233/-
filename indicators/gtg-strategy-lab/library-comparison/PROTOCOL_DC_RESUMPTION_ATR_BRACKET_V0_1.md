# GTG DC Resumption ATR Bracket v0.1 — exploratory prospective-candidate development

Registered 2026-10-03 AFTER formal Validation of fixed-H4 DC Resumption failed, and BEFORE this bracket execution is evaluated.

## Evidence status
Development only on already-open historical data through the end of Validation.
This is NOT a second Validation claim.

Pristine Forward OOS remains SEALED and must not be decoded.
Historical Holdout remains LOCKED.

## Motivation
The frozen DC Correction -> Resumption H4 signal preserved directional information in Validation:
- direction accuracy 65%
- C0 +0.0908 ATR/trade
- C1 -0.0542
- C2 -0.1991
- mean MFE 1.167 ATR

The failure mode was not random direction alone; fixed H4-close often gave back intrahorizon excursion.

This experiment changes ONLY execution/exit capture.
It does not change the DC signal or State Engine.

## Base signal
Exactly the existing DC Correction -> Resumption signal:
- frozen State Engine v0.2
- confirmed TREND_UP/TREND_DOWN
- fine DC threshold 0.0025
- macro DC threshold 0.0050
- first correction against trend while macro remains aligned
- first fine-DC resumption with trend
- entry on next H1 open
- no direction/date/delay/geometry filters

Use all already-open signal records:
- Train-development DC resumption signals
- opened formal Validation DC resumption signals

No Forward OOS signal or price may be decoded.

## Fixed ATR bracket
ATR reference = frozen H1 ATR at resumption signal close.

Exactly:
- TP distance = +1.0 ATR in trade direction
- SL distance = -1.0 ATR in trade direction
- max timeout = original H4 window: 4 complete trading H1 bars after signal

No parameter search.
No alternate ATR multiples.
No trailing stop.
No break-even rule.
No partial exit.

## M1 causal trigger and execution
Use canonical historical M1 BID/ASK only for already-open history.

Entry:
- next H1 open after resumption signal
- same entry quote convention as existing compare.costs contract

Barrier monitoring:
- LONG uses BID high/low to detect exit-side TP/SL touch
- SHORT uses ASK high/low to detect exit-side TP/SL touch

At each complete M1 bar:
- LONG TP trigger if BID high >= TP level
- LONG SL trigger if BID low <= SL level
- SHORT TP trigger if ASK low <= TP level
- SHORT SL trigger if ASK high >= SL level

If TP and SL both trigger in the same M1 bar:
- classify as AMBIGUOUS_BOTH
- resolve conservatively as SL trigger

Execution after barrier trigger:
- exit at next available M1 open
- require next-minute timestamp gap exactly 60 seconds
- use next M1 BID/ASK open as exit quotes
- if next minute missing, censor the trade rather than bridge

Timeout:
- if no barrier trigger before H4 timeout,
- exit using the frozen H4 timeout close quotes exactly as the old H4 contract.

No trade may cross a hard H1 gap >3h.
No trade may cross Historical Holdout start.
No Forward OOS data may be read.

## Costs
Reuse compare.costs exactly:
- C0
- C1 benchmark friction
- C2 doubled friction

For barrier exits, next-M1-open BID/ASK are passed as the exit quote pair.
For timeout, H4 close BID/ASK are used as before.

## Development windows
Report separately:
1. 2018-2020 library
2. 2021-2024 Train evaluation region
3. Formal Validation: 2024-03-20 after embargo through 2025-03-25 before embargo
4. Combined opened history only as descriptive

No window may be silently dropped.

## Metrics
- signals
- eligible trades
- censored gaps/missing next minute
- TP count
- SL count
- AMBIGUOUS_BOTH count
- TIMEOUT count
- direction counts
- C0/C1/C2 mean per trade
- C1 win rate
- C1 total
- median/mean holding minutes
- by window
- by direction
- by calendar year when n>=5

## Prospective-candidate screen
This is a DEVELOPMENT screen only.

To qualify for freezing for future Pristine OOS, ALL must hold:
1. total eligible trades >=80
2. each of LONG and SHORT >=20
3. C1 mean/trade >0 in combined opened history
4. C2 mean/trade >=0 in combined opened history
5. C1 win rate >0.50
6. 2018-2020 C1 >=0
7. 2021-2024 Train-eval-region C1 >=0
8. Formal Validation-period C1 >=0
9. at least 4 calendar years with n>=5 have non-negative C1
10. no single calendar year contributes >35% of all eligible trades

Passing does NOT open Forward OOS automatically.
If passed, a separate Pristine opening protocol must be committed before decoding any forward data.

## Integrity
- protocol committed before bracket result
- base DC signal unchanged
- ATR multiplier exactly 1.0/1.0
- no subgroup filter
- no barrier parameter search
- ambiguous same-minute touch => SL
- barrier trigger => next M1 open execution
- missing next minute => censor
- Forward OOS decoded=false
- Historical Holdout read=false

## Decision
FAIL:
- do not tune TP/SL multiples on opened history;
- do not freeze as prospective candidate.

PASS:
- freeze exact candidate identity/code hashes;
- register a separate future Pristine OOS opening rule;
- only then may sealed forward raw data eventually be decoded.
