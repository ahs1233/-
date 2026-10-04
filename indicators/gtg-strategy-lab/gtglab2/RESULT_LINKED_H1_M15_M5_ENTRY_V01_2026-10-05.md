# RESULT — Linked H1/M15/M5 Entry Resolution v0.1

Date: 2026-10-05

## Purpose
Add M5 as the execution layer while keeping H1 as context/risk scale and M15 as completed short-term context.

Pristine Forward OOS remained unread.

## Data
- Exact M5 bars: 607,272
- Exact M15 bars: 201,591
- Exact H1 bars: 49,699
- Linked causal candidates: 17,195

Candidate requires a fresh M5 low inside a fresh 12H H1 low zone.
All M15/H1 context is from bars already closed at the M5 signal close.

## Frozen research split
- Train: 2018-2022
- Validation: 2023-2024
- Pseudo-test: 2025-2026 report only
- No year feature
- No Pristine Forward OOS read

## Scalper
Target:
+1.5 H1 ATR before -0.75 H1 ATR within 12H.

Model:
- Train AUC 0.6107
- Validation AUC 0.5946
- Pseudo-test AUC 0.5775
- Frozen validation top-25% threshold: 0.5465613560

Filtered next-M5-open pseudo-test 2025-2026:
- 491 trades
- win rate 53.56%
- total -18.6541R
- mean -0.0380R
- PF 0.9182
- max DD -38.1997R
- average entry R:R 0.8393

Year stability:
- 2025: +6.4554R, PF 1.0557
- 2026: -25.1095R, PF 0.7763

Baseline all linked candidates:
- 848 trades
- -46.9160R
- PF 0.9041
- average entry R:R 1.3435

Decision: FAIL / no promotion.

## Swing
Target:
+4 H1 ATR before -1 H1 ATR within 72H.

Model:
- Train AUC 0.5675
- Validation AUC 0.5280
- Pseudo-test AUC 0.5276
- Frozen validation top-25% threshold: 0.5236338094

Filtered next-M5-open pseudo-test 2025-2026:
- 339 trades
- win rate 30.38%
- total -3.2890R
- mean -0.00970R
- PF 0.9862
- max DD -46.4810R
- average entry R:R 2.3899

Year stability:
- 2025: +32.9731R, PF 1.2812
- 2026: -36.2621R, PF 0.6989

Baseline all linked candidates:
- 539 trades
- +4.1211R
- PF 1.0103
- max DD -59.7353R
- average entry R:R 3.0579

The baseline is not promotable: expectancy is marginal and completely unstable across 2025 vs 2026.

## Comparison with M15 filtered execution
Scalper:
- M15 avg entry R:R 0.2757 -> linked M5 0.8393
- M15 PF 0.9030 -> linked M5 0.9182
- M15 total -21.77R -> linked M5 -18.65R

Swing:
- M15 avg entry R:R 0.8748 -> linked M5 2.3899
- M15 PF 0.9789 -> linked M5 0.9862
- M15 total -9.50R -> linked M5 -3.29R

## Main conclusion
M5 materially improves entry timing and preserves much more reward, especially for Swing.

However, simply moving to M5 does not solve the whole problem.
The remaining bottleneck is not entry price; it is selecting the correct micro-low among many fresh lows while the reversal is still forming.

Architecture retained:
- H1 = movement/context and risk scale
- M15 = short-term structure/context
- M5 = execution/trigger layer

Do not add a large filter stack.
The next study should focus on the causal transition sequence on M5/M15:
selling pressure weakens -> low is rejected -> price reclaims -> continuation,
rather than waiting for a fully confirmed bounce or blindly buying every fresh low.

Pristine Forward OOS remained unread.
