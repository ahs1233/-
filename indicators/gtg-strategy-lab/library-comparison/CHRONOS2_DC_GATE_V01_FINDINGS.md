# GTG Chronos-2 DC Gate v0.1 — Findings

Date: 2026-10-04
Status: zero-shot external-model DEVELOPMENT on already-open history.
Historical Holdout remained locked.
Pristine Forward OOS remained sealed and undecoded.

## External model identity
- Model: amazon/chronos-2
- Revision: 254b5357164a84326913b0695216f690752ac55d
- Weights SHA256: ddcda3c7508bf2528087723e98a20707cc04b7f370ae275a9fd88078ddba4f42
- config SHA256: ef1143bfdc9c0376d9a056eefca46cb4b1ec3d0ffacd541ff56feb40fb708031
- chronos-forecasting: 2.3.2
- torch: 2.5.1+cpu
- zero-shot only; no GTG fine-tuning

The downloaded checkpoint matched the pinned official SHA256 exactly.

## Frozen gate
For each frozen DC Correction -> Resumption signal:
- Chronos input = last 256 complete observed H1 BID closes ending at signal close
- no GTG state/DC/ATR feature enters Chronos
- forecast horizon = 4
- quantiles = 0.1 / 0.5 / 0.9
- LONG allowed iff q50 at +4 > current close
- SHORT allowed iff q50 at +4 < current close
- no magnitude/confidence threshold
- base 1ATR TP / 1ATR SL / H4-timeout bracket unchanged

## Forecast population
- DC resumption signals forecast: 113
- signal censor: 0
- gate allowed: 64
- gate rejected: 49
- direction agreement rate: 56.64%

Base executable bracket trades: 109
- guarded completed trades: 62
- rejected base trades: 47
- missing forecast for base trade: 0

## Guarded economics — combined opened history
n=62
- long: 34
- short: 28
- C0: +0.1825 ATR/trade
- C1: +0.0049
- C2: -0.1727
- C1 win rate: 53.23%
- C1 total: +0.303 ATR

The zero-shot gate reduces trade count but does not preserve the unguarded bracket's C1 expectancy.

Unguarded 1ATR bracket:
- C1: +0.1013
- C2: -0.0720

Chronos-gated:
- C1: +0.0049
- C2: -0.1727

Both benchmark comparisons deteriorate.

## By opened period

### 2018-2020 Library
n=20
- C1: -0.1925
- C2: -0.4119
- C1 win: 40.0%

FAIL.

### 2021-2024 Train evaluation region
n=29
- C1: +0.0481
- C2: -0.1145
- C1 win: 55.17%

Weakly positive C1, negative C2.

### Opened Validation period 2024-2025
n=13
- C1: +0.2120
- C2: +0.0655
- C1 win: 69.23%

Positive, but this period is already-open development evidence for this post-Validation candidate and is not independent confirmation.

## Direction
LONG:
- n=34
- C1 +0.0305
- C2 -0.1615
- C1 win 58.82%

SHORT:
- n=28
- C1 -0.0262
- C2 -0.1862
- C1 win 46.43%

The gate does not solve the short-side weakness and does not create friction robustness on long trades either.

## Calendar-year C1
- 2018: -0.0946
- 2019: -0.3795
- 2020: -0.1222
- 2021: +0.0480
- 2022: +0.1919
- 2023: -0.0426
- 2024: +0.0507
- 2025 partial: +0.4516

Early-history instability remains.

## Registered screen
PASS:
- guarded trades >=40
- long >=10
- short >=10
- combined C1 >0
- C1 win >50%
- 2021-2024 C1 >=0
- opened Validation C1 >=0
- four calendar years with n>=3 non-negative C1
- no year >40% of guarded trades

FAIL:
- combined C2 >=0
- 2018-2020 C1 >=0
- guarded C1 > unguarded C1
- guarded C2 > unguarded C2

FINAL VERDICT: FAIL

## Interpretation
Chronos-2 adds an independent pretrained representation, but its simple zero-shot H4 median direction is not a useful gate for the frozen DC Resumption bracket.

It is directionally aligned with only 56.6% of signals and rejects enough profitable base trades that both C1 and C2 become worse than the unguarded bracket.

This is useful negative evidence:
- the failure is not only due to GTG hand-engineered features;
- a strong external foundation model's zero-shot price-direction forecast also does not resolve the historical regime instability.

## Decision
Do not tune on opened history:
- context length
- forecast horizon
- quantile choice
- displacement threshold
- confidence width
- long/short subsets

Do not open Pristine Forward OOS for Chronos-2 DC Gate v0.1.

Pristine Forward OOS stays sealed.
Historical Holdout stays locked.

The next research source should be materially different from price-only forecasting: market microstructure / flow / liquidity, or genuinely new forward data.
