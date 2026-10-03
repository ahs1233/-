# GTG Chronos-2 DC Gate v0.1 — Findings

Date: 2026-10-04
Status: zero-shot opened-history development.
Historical Holdout remained locked.
Pristine Forward OOS remained sealed and undecoded.

## External model
- Amazon Chronos-2
- chronos-forecasting 2.3.2
- model revision: 254b5357164a84326913b0695216f690752ac55d
- zero-shot only
- no fine-tuning
- CPU inference

## Frozen rule
Base trade:
- DC Correction -> Resumption
- 1ATR TP / 1ATR SL / H4 timeout
- no change to signal or bracket

Chronos input:
- last 256 observed H1 BID closes ending at signal bar
- prediction length = 4
- quantiles = 0.1 / 0.5 / 0.9

Gate:
- LONG allowed iff q50 step+4 > current BID close
- SHORT allowed iff q50 step+4 < current BID close
- no magnitude/confidence threshold

## Integrity
PASS:
- checkpoint revision fixed before result
- package version fixed
- context exactly 256 observed trading bars
- forecast horizon exactly 4
- sign-only gate
- no GTG fine-tuning
- base bracket unchanged
- all 109 base trades had eligible context
- Historical Holdout read=false
- Forward OOS decoded=false

## Gate behavior
Base trades: 109
Chronos-eligible: 109
Allowed: 62
Rejected: 47
Direction agreement rate: 56.88%

Forecast displacement relative to current close:
- q10 mean: -1.772 ATR
- q50 mean: -0.088 ATR
- q90 mean: +1.584 ATR

## Guarded economics
n=62
- long: 34
- short: 28
- C0: +0.1825 ATR/trade
- C1: +0.0049
- C2: -0.1727
- C1 win rate: 53.23%
- C1 total: +0.303 ATR

Base unguarded 1ATR bracket:
- C1: +0.1013
- C2: -0.0720

Chronos therefore materially worsened both C1 and C2.

## By period

### 2018-2020
n=20
- C1 -0.1925
- C2 -0.4119
- C1 win 40.0%

### 2021-2024
n=29
- C1 +0.0481
- C2 -0.1145
- C1 win 55.17%

### Opened Validation 2024-2025
n=13
- C1 +0.2120
- C2 +0.0655
- C1 win 69.23%

The same temporal instability remains: later history is positive, early history is materially negative.

## Direction
Long:
- n=34
- C1 +0.0305
- C2 -0.1615

Short:
- n=28
- C1 -0.0262
- C2 -0.1862

Chronos did not preserve a positive edge on the short branch.

## Year C1
- 2018: -0.0946
- 2019: -0.3795
- 2020: -0.1222
- 2021: +0.0480
- 2022: +0.1919
- 2023: -0.0426
- 2024: +0.0507
- 2025 partial: +0.4516

## Registered screen
PASS:
- guarded trades >=40
- long >=10
- short >=10
- combined C1 >0
- C1 win >50%
- 2021-2024 C1 >=0
- opened Validation C1 >=0
- >=4 years non-negative C1
- no year >40% of guarded trades

FAIL:
- combined C2 >=0
- 2018-2020 C1 >=0
- guarded C1 > unguarded C1
- guarded C2 > unguarded C2

FINAL VERDICT: FAIL

## Interpretation
Chronos-2 provides an independent pretrained forecasting representation, but its zero-shot direction sign does not improve the DC Resumption + 1ATR bracket.

The gate is somewhat aligned with profitable later-period trades but rejects too many useful trades and retains too many losing early-regime trades.

This result is stronger than simply saying the local engineered models failed: an external pretrained foundation model also does not resolve the regime-instability problem under the fixed sign-only rule.

## Decision
Do not:
- tune Chronos context length
- tune forecast horizon
- use q10/q90 confidence width
- add magnitude thresholds
- choose only long trades
- exclude 2018-2020 or 2023
- open Pristine Forward OOS for this candidate

Close Chronos-2 DC Gate v0.1 as a prospective candidate.

Historical Holdout remains locked.
Pristine Forward OOS remains sealed.
