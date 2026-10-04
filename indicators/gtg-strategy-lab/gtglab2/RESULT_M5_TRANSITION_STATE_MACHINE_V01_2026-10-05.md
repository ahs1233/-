# RESULT — M5 Transition State Machine v0.1

Date: 2026-10-05

## Purpose
Test whether the causal micro transition itself can identify a better XAUUSD bottom entry.

Pristine Forward OOS remained unread.

## Data
- M5 bars: 607,272
- M15 bars: 201,591
- H1 bars: 49,699
- MID_RECLAIM events: 7,250
- HIGH_RECLAIM events: 5,187
- HIGHER_LOW_BREAK events: 5,777

Selection used only 2018-2022 Train + 2023-2024 Validation.
2025-2026 was report-only.
No year feature.

## Scalper
Selected rule: HIGHER_LOW_BREAK

Train:
- 1,980 trades
- +14.379R
- mean +0.00726R
- PF 1.0210
- DD -34.447R
- win 64.09%
- avg entry R:R 0.619

Validation:
- 821 trades
- +18.485R
- mean +0.02252R
- PF 1.0667
- DD -18.699R
- win 65.04%
- avg entry R:R 0.628

Frozen 2025-2026:
- 663 trades
- -17.771R
- mean -0.02680R
- PF 0.9267
- DD -24.078R
- win 63.05%
- avg entry R:R 0.613

2025: -1.063R, PF 0.9912
2026: -16.708R, PF 0.8632

Decision: FAIL.

## Swing
Selected rule: HIGH_RECLAIM

Train:
- 1,245 trades
- +24.488R
- mean +0.01967R
- PF 1.0315
- DD -58.951R
- win 37.43%
- avg entry R:R 1.912

Validation:
- 523 trades
- +43.850R
- mean +0.08384R
- PF 1.1370
- DD -21.842R
- win 38.81%
- avg entry R:R 1.937

Frozen 2025-2026:
- 450 trades
- -1.371R
- mean -0.00305R
- PF 0.9953
- DD -50.404R
- win 35.78%
- avg entry R:R 1.932

2025: +38.252R, PF 1.2758
2026: -39.624R, PF 0.7373

Decision: FAIL promotion gate because yearly stability fails.

## Important diagnostic
HIGHER_LOW_BREAK was not the preregistered selected Swing winner, so it cannot replace HIGH_RECLAIM after pseudo-test results were seen.

Diagnostic only:
- 464 trades
- +9.973R
- mean +0.02149R
- PF 1.0339
- DD -41.635R
- win 36.64%
- avg entry R:R 1.943

This is promising evidence about the transition family, but switching now would be cherry-picking.

## Conclusion
The transition approach is better than blindly buying every fresh low.

For Swing, M5 transition logic preserves about 1.9R entry geometry and gets close to positive frozen expectancy.

But the preregistered winner was not stable across 2025 and 2026.

Do not promote an Execution Candidate yet.
Do not retune the three rules on consumed 2025-2026.
Next research should explain the structural difference between successful and failed transition episodes using causal pre-entry price behavior, not year labels.

Pristine Forward OOS remained unread.
