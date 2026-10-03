# GTG Chronos-2 DC Gate v0.1 — preregistered external-model candidate

Registered 2026-10-03 before any Chronos-2 forecast is computed on GTG historical signals.

## Status
Exploratory development on already-open history only.
Historical Holdout remains locked.
Pristine Forward OOS remains sealed/undecoded.

## External model identity
Provider:
- Amazon Science Chronos-2

Package:
- chronos-forecasting == 2.3.2

Model:
- amazon/chronos-2

Pinned Hugging Face revision:
- 254b5357164a84326913b0695216f690752ac55d

License:
- Apache-2.0

No fine-tuning.
No LoRA.
No prompt/model adaptation.
No covariate fitting on GTG data.

## Purpose
Use an independently pretrained time-series foundation model as a zero-shot directional gate for the already-defined DC Correction -> Resumption signal.

This is intentionally different from:
- GTG hand-crafted features
- GTG CNN
- GTG Logistic
- GTG historical-memory models

## Base trading candidate
Base signal:
- DC Correction -> Resumption
- fine DC 0.0025
- macro DC 0.0050
- frozen State Engine
- no subgroup filters

Execution:
- unchanged 1ATR TP / 1ATR SL / H4 timeout bracket from DC Resumption ATR Bracket v0.1
- ambiguous same-M1 TP+SL => SL
- barrier execution = next M1 open

Chronos-2 changes ONLY whether a base signal is allowed.

## Chronos input
At each resumption signal close:
- target = canonical H1 BID close only
- last 256 observed complete H1 trading bars ending at the signal bar
- no timestamps/covariates supplied to the model
- observed trading bars are treated as an equally spaced trading-bar sequence
- no GTG state/DC/ATR feature is passed into Chronos

If fewer than 256 prior complete H1 bars are available:
- signal is ineligible.

No normalization outside Chronos internal preprocessing.

## Forecast
- prediction_length = 4
- quantiles = 0.1, 0.5, 0.9
- use median q=0.5 forecast at step +4
- current reference = signal-bar BID close

## Fixed zero-shot gate
For LONG base signal:
- ALLOW iff median forecast step +4 > current BID close

For SHORT base signal:
- ALLOW iff median forecast step +4 < current BID close

Exactly equal:
- REJECT / FLAT

No magnitude threshold.
No ATR threshold.
No quantile-width threshold.
No confidence calibration.
No threshold tuning.

## Historical development reporting
Apply gate to the same already-open signal population used by ATR Bracket v0.1.

Report separately:
- 2018-2020 library
- 2021-2024 Train evaluation region
- opened 2024-2025 Validation period
- combined opened history

Do not decode Pristine Forward OOS.

## Metrics
Forecast diagnostics:
- eligible signals
- allowed/rejected
- direction-agreement rate
- q10/q50/q90 forecast displacement in ATR units, descriptive only

Guarded bracket:
- completed trades
- long/short
- C0/C1/C2 mean/trade
- C1 win rate
- C1 total
- by period
- by year
- compare with unguarded 1ATR bracket

## Prospective-candidate screen
All must hold:
1. eligible guarded trades >=40
2. long >=10
3. short >=10
4. combined C1 >0
5. combined C2 >=0
6. C1 win rate >0.50
7. 2018-2020 C1 >=0
8. 2021-2024 C1 >=0
9. opened Validation-period C1 >=0
10. guarded combined C1 > unguarded +0.1012914197
11. guarded combined C2 > unguarded -0.0719509275
12. at least 4 calendar years with n>=3 have non-negative C1
13. no one year >40% of guarded trades

Passing is still exploratory because opened history has been reused.

## Integrity
- package version fixed before result
- HF model revision fixed before result
- zero-shot only
- no GTG fine-tuning
- input close-only
- context exactly 256 observed H1 bars
- horizon exactly 4
- direction-sign gate only
- base bracket unchanged
- Historical Holdout read=false
- Pristine Forward OOS decoded=false

## Decision
FAIL:
- do not tune forecast horizon, context length, quantiles, or magnitude thresholds on opened history.
- do not open Forward OOS.

PASS:
- freeze model cache identity, code hash, package version, checkpoint revision, and rule.
- register a separate Pristine OOS opening protocol before decoding any forward data.
