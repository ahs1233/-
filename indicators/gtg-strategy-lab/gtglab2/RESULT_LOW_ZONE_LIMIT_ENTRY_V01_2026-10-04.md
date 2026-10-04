# RESULT — Low-Zone Limit Entry v0.1

Date: 2026-10-04

## Purpose
Fix the next-open entry timing problem by waiting for a retest near the detected bottom instead of chasing the recovery candle.

Detector models and thresholds were frozen.
Grid selection used only 2018-2024.
2025-2026 was read only after entry configuration selection as a temporal diagnostic.
Pristine Forward OOS remained unread.

## Selected Swing configuration
Frozen from 2018-2024 grid:
- Swing score >= 0.5669356193705579
- Buy limit = candidate low + 1.0 ATR
- order expiry = 3 H1 bars
- stop = candidate low -1.0 ATR
- target = candidate low +4.0 ATR
- trade timeout = 72H

Selection data 2018-2024:
- fills: 690
- total +31.9520R
- mean +0.0463R/trade
- PF 1.0771
- max DD -23.5700R

### Temporal diagnostic 2025-2026
- 167 fills
- win rate 33.53%
- total **-23.6262R**
- mean **-0.1415R/trade**
- PF **0.7895**
- max DD **-30.7628R**
- average entry R:R 1.6083

By year:
2025:
- 77 fills
- +6.1366R
- PF 1.1360
- win rate 41.56%

2026 through Sep:
- 90 fills
- **-29.7628R**
- PF **0.5564**
- win rate 26.67%

Decision:
Reject this Swing limit-entry configuration. It improved entry price versus next-open market execution but did not survive the 2026 regime.

## Selected Scalper configuration
Frozen from 2018-2024 grid:
- Scalper score >= 0.6786512019247182
- Buy limit = candidate low +0.10 ATR
- order expiry = 3 H1 bars
- stop = candidate low -0.75 ATR
- target = candidate low +1.5 ATR
- trade timeout = 12H

Selection data 2018-2024:
- fills: 186
- total +13.6121R
- mean +0.0732R/trade
- PF 1.1226
- max DD -15.0436R

### Temporal diagnostic 2025-2026
- 53 fills
- win rate 30.19%
- total **-11.4090R**
- mean **-0.2153R/trade**
- PF **0.6916**
- max DD **-15.9972R**
- average entry R:R 1.7202

By year:
2025:
- 24 fills
- -2.8235R
- PF 0.8235
- win rate 33.33%

2026 through Sep:
- 29 fills
- **-8.5855R**
- PF **0.5912**
- win rate 27.59%

Decision:
Reject this Scalper limit-entry configuration.

## Main conclusion
Waiting for a low-zone retest restored acceptable reward/risk, but the temporal robustness problem remained.

The failure is no longer simply "entry too late".
The deeper issue is that a candidate bottom can look structurally similar across years while its probability of continuing upward changes materially.

2026 is the clearest stress case:
- Swing limit failed sharply.
- Scalper limit failed sharply.

Therefore:
- Bottom Detector remains useful as a descriptive probability score.
- Neither next-open market entry nor the tested low-zone limit entry is robust enough to promote.
- Do not tune more limit offsets on 2025-2026; that would overfit the consumed period.

The next research step should return to the price path itself:
identify what distinguished the successful 2025 bottom sequences from the failed 2026 sequences using only pre-entry path structure, then test that distinction on earlier years before any new execution rule.

Pristine Forward OOS remains blind.
