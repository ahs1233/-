# RESULT — Swing / Scalper Bottom Detectors v0.1

Date: 2026-10-04

## Targets

Swing:
- GOOD if candidate low +4 ATR is reached before candidate low -1 ATR within 72H.
- FALSE if -1 ATR is reached first.

Scalper:
- GOOD if candidate low +1.5 ATR is reached before candidate low -0.75 ATR within 12H.
- FALSE if -0.75 ATR is reached first.

All ATR values are frozen at candidate time.
Only causal features are used.

## Swing Detector

Resolved population:
- 6,328
- GOOD: 2,102
- FALSE: 4,226
- baseline GOOD rate: 33.22%

Logistic model:
- selected C = 0.1

ROC-AUC:
- Train 2018-2022: 0.6356
- Validation 2023-2024: 0.5909
- Pseudo-test 2025-2026: 0.5937

Frozen validation thresholds on pseudo-test:

50%-coverage threshold:
- coverage 48.46%
- precision 39.24%
- baseline 33.19%
- lift 1.18x

25%-coverage threshold:
- coverage 24.35%
- precision 43.15%
- lift 1.30x

Highest-confidence validation threshold:
- validation precision 59.21% at 5.05% coverage
- pseudo-test precision 60.00% at 2.92% coverage
- pseudo-test lift 1.81x

Interpretation:
The detector can isolate a small population of much higher-quality large bottoms, but large-swing prediction remains materially harder than fast-bounce prediction.

Dominant features:
- lower_wick_atr
- EMA50 slope / distance context
- close_location
- 20H / 50H drift
- candle body
- position in recent range

## Scalper Detector

Resolved population:
- 6,067
- GOOD: 3,670
- FALSE: 2,397
- baseline GOOD rate: 60.49%

Logistic model:
- selected C = 0.1

ROC-AUC:
- Train: 0.7201
- Validation: 0.7111
- Pseudo-test: 0.7138

Frozen validation thresholds on pseudo-test:

~50%-coverage threshold:
- pseudo-test coverage 46.31%
- precision 76.49%
- baseline 59.80%
- lift 1.28x

~25%-coverage threshold:
- pseudo-test coverage 24.29%
- precision 84.83%
- lift 1.42x

The preregistered >=60% "high-confidence" target is not informative for Scalper because its unconditional baseline itself is already about 60%. The 25%-coverage operating point is the meaningful high-confidence setting.

Dominant features:
1. lower_wick_atr
2. close_location
3. EMA50 distance / slope context
4. drift20
5. body_atr
6. pos72
7. drift50

## Main conclusion

The same physical bottom signature predicts both paths:
- meaningful rejection wick
- recovery close away from the low
- slowing downside momentum

But the tasks differ sharply:

Scalper:
- high discriminative power
- broad useful coverage
- top quarter precision ~85%

Swing:
- weaker discrimination
- useful mainly as a high-selectivity filter
- highest-confidence population can reach ~60% large-swing success but is sparse

This supports keeping two separate engines rather than forcing one detector to serve both horizons.

## Status
Both detectors pass the research usefulness gate.
Neither is yet a trading strategy.
Next step: causal next-open execution harness using frozen validation thresholds.
Pristine Forward OOS remains unread.
