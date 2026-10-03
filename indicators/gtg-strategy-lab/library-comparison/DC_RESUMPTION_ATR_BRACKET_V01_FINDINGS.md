# GTG DC Resumption ATR Bracket v0.1 — Findings

Date: 2026-10-03
Evidence status: opened-history DEVELOPMENT only.
Historical Holdout remained locked.
Pristine Forward OOS remained sealed and undecoded.

## Candidate
Base signal unchanged:
- DC Correction -> Resumption
- fine DC 0.0025
- macro DC 0.0050
- frozen State Engine
- no subgroup filtering

Execution change only:
- LONG reference = executable ASK at entry
- SHORT reference = executable BID at entry
- TP = 1.0 ATR
- SL = 1.0 ATR
- timeout = H4
- barrier touch monitored on executable exit side
- same-minute TP+SL => conservative SL
- barrier execution = next M1 open
- missing next minute => censor

Unit tests: 6/6 PASS.

## Sample
Signals: 113
Eligible trades: 109
Censored: 4, all H1 hard-gap cases

Directions:
- Long: 69
- Short: 40

Exit reasons:
- TP: 48
- SL: 31
- Timeout: 30

## Combined opened history
- C0: +0.2745 ATR/trade
- C1: +0.1013
- C2: -0.0720
- C1 win rate: 57.80%
- C1 total: +11.04 ATR
- median holding: 88 minutes
- mean holding: 125 minutes

This is materially better than the fixed-H4-close implementation, but it still fails doubled-friction robustness.

## By opened period

### 2018-2020 library
n=36
- C0 +0.1837
- C1 -0.0243
- C2 -0.2323
- C1 win 47.22%

FAIL after normal friction.

### 2021-2024 Train evaluation region
n=53
- C0 +0.2926
- C1 +0.1312
- C2 -0.0303
- C1 win 60.38%

Positive at C1, slightly negative at C2.

### Formal Validation period 2024-2025
n=20
- C0 +0.3901
- C1 +0.2482
- C2 +0.1063
- C1 win 70.0%

This is a strong descriptive improvement relative to the original fixed-H4 Validation result:
- original fixed-H4 C1: -0.0542
- ATR-bracket C1: +0.2482

However this bracket was designed after seeing the fixed-H4 Validation failure, so this is NOT a second independent Validation result.

## Direction
Long:
- n=69
- C1 +0.1046
- C2 -0.0760

Short:
- n=40
- C1 +0.0956
- C2 -0.0649

Both directions are positive at C1 and negative at C2.

## Calendar-year C1
- 2018: -0.1907
- 2019: -0.1147
- 2020: +0.0885
- 2021: +0.1458
- 2022: +0.2917
- 2023: -0.2344
- 2024: +0.2337
- 2025 partial: +0.2376

The result is not uniformly stable across regimes.

## Registered prospective-candidate screen
PASS:
- total >=80
- long >=20
- short >=20
- combined C1 >0
- C1 win >50%
- 2021-2024 C1 >=0
- opened Validation-period C1 >=0
- >=4 years non-negative C1
- no year >35% of trades

FAIL:
- combined C2 >=0
- 2018-2020 C1 >=0

FINAL DEVELOPMENT VERDICT: FAIL

## Interpretation
The experiment supports a narrower conclusion:

The DC Resumption signal appears to contain exploitable excursion information, and fixed H4-close was a poor way to capture that excursion. A simple symmetric 1ATR bracket converted the already-open 2024-2025 Validation-period sample from negative C1 to positive C1/C2.

But the rule is not sufficiently regime-stable:
- early-history C1 remains negative,
- doubled-friction combined history remains negative,
- 2018, 2019 and 2023 are losing years.

Therefore the candidate is not eligible for Pristine Forward OOS opening under the preregistered screen.

## Decision
Do not:
- tune TP/SL multiples,
- choose only later years,
- remove 2018/2019/2023,
- filter long/short,
- open Pristine Forward OOS for this candidate.

Keep Forward OOS sealed.

Next research should change representation or market-condition definition rather than optimize this bracket.
