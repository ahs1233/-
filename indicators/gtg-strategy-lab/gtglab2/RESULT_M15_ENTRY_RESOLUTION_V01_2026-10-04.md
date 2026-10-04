# RESULT — M15 Entry Resolution Study v0.1

Date: 2026-10-04

## Data
Clean JForex M1 archive aggregated to exact UTC M15 bars.
- M15 bars: 201,591
- Fresh-low candidates: 27,500
- Period: 2018-03-01 through 2026-09-30
- Pristine Forward OOS: NOT READ

## Scalper M15 Detector
Target:
+1.5 M15 ATR before -0.75 ATR within 4H.

Model quality:
- Train AUC: 0.6974
- Validation AUC: 0.7030
- Pseudo-test 2025-2026 AUC: 0.7012

This is stable and useful classification.

Frozen top-25% validation threshold:
0.6550974591

### Executable next-M15-open — filtered
Pseudo-test 2025-2026:
- 997 trades
- Win rate: 77.83%
- Total: -21.7704R
- Mean: -0.02184R
- PF: 0.9030
- Max DD: -28.6954R
- Average actual entry R:R: 0.2757

### All-candidate baseline
Pseudo-test:
- 2,474 trades
- Win rate: 55.58%
- Total: +25.2790R
- Mean: +0.01022R
- PF: 1.0230
- Max DD: -36.5425R
- Average entry R:R: 0.9520

Interpretation:
The detector greatly improves hit rate but selects already-confirmed bounces whose remaining reward is too small.

## Swing-entry M15 Detector
Target:
+3 M15 ATR before -1 ATR within 8H.

Model quality:
- Train AUC: 0.6365
- Validation AUC: 0.6288
- Pseudo-test AUC: 0.6210

Frozen top-25% validation threshold:
0.5755328144

### Executable next-M15-open — filtered
Pseudo-test 2025-2026:
- 1,019 trades
- Win rate: 55.25%
- Total: -9.5048R
- Mean: -0.00933R
- PF: 0.9789
- Max DD: -44.6834R
- Average actual entry R:R: 0.8748

### All-candidate baseline
Pseudo-test:
- 1,903 trades
- Win rate: 42.35%
- Total: +85.8277R
- Mean: +0.04510R
- PF: 1.0787
- Max DD: -44.0883R
- Average entry R:R: 1.7373

## Main conclusion

Changing from H1 to M15 improves temporal resolution and preserves detector quality, especially for Scalper.

However, next-bar market entry remains the wrong execution method.

The detector is rewarded for seeing:
- rejection wick,
- recovery close,
- slowing downside.

Those same features mean price has already bounced before the signal is available.

Therefore the correct architecture is now:

H1 = movement/context map
M15 = bottom-quality detection
M15 retest / low-zone limit = execution

Do not enter at next M15 market open merely because the score is high.

The next execution study should place a short-lived limit order on M15 after a high-quality signal and cancel if price runs away without retesting.
