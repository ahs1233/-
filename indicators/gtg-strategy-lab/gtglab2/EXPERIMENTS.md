# GTGLab2 — Experiment Register

This register inherits closed GTGLab experiments and will hold all GTGLab2 experiments.

## E-001 — Transition logistic classifier
- Task: fake break vs true trend after range exit.
- Approx. accuracy: 78.0%.
- Balanced accuracy: 74.3%.
- Result: classification useful, execution economics not sufficient.
- Verdict: **classification signal ≠ proven trading edge**.

## E-002 — Early breakout execution / logistic filter
- Early breakout C1: about -0.337 ATR/trade.
- Logistic filter C1: about -0.361.
- Delayed confirmation improved economics but timing remained weak.
- Verdict: **FAIL as execution solution**.

## E-003 — Directional Change leg geometry
- Goal: refine Swing entry timing.
- Result: weakened signal.
- Verdict: **CLOSED**.

## E-004 — Range scalper Pre-Transition Guard
- Guard C1: about -0.206.
- No-Guard C1: about -0.181.
- Verdict: **FAIL**.

## E-005 — Raw Sequence Utility
- 48 H1-candle sequence.
- correlation: ~0.010.
- directional accuracy: ~55.6%.
- C1: ~-0.316 ATR/trade.
- Verdict: **FAIL**.

## E-006 — DC Correction → Resumption H4
- Validation C1: ~-0.054.
- C2: ~-0.199.
- Verdict: **FAIL**.

## E-007 — Chronos-2 DC Gate v0.1
- zero-shot context: 256 H1
- horizon: 4
- 109 signals → 62 trades
- Chronos C1: +0.0049
- baseline C1: +0.1013
- temporal instability observed
- Verdict: **FAIL incremental edge**.

## E-008 — Microstructure Forward
- Features available include flow, delta, footprint, order-book imbalance, volume profile, and market agreement.
- Status: **COLLECTING ONLY**.
- Outcome linkage: **NOT YET PERMITTED**.
- First edge-analysis experiment: pending readiness gate.

## Sweep / Acceptance v0.1 � 2026-10-04
- Development only; locks preserved.
- Boundary breaks: 1,134; acceptance: 774; rejection: 360.
- BASE C1 single overall: -0.0516 R/trade.
- BASE C1 acceptance single: +0.0210 R/trade.
- BASE C1 rejection single: -0.1249 R/trade.
- BASE C1 acceptance staged: -0.0291 R/trade.
- Verdict: overall FAIL; rejection-fade branch rejected; acceptance continuation retained as a new-version research lead; current staging rule rejected.


## E-009 — Doctrine Reference v0.1
- Scope: development-only JForex + State Engine v0.2.
- Compared single full entry with fixed-risk five-tranche construction.
- BASE C1 Single: **-0.1891R**.
- BASE C1 Staged: **-0.1491R** nominal.
- Staged average risk used: **0.647R**.
- Staged mean per used risk: **-0.4707R**.
- Both Long/Short and Early/Late were negative.
- Frozen context filter did not improve economics.
- Verdict: **FAIL**.
- Lesson: staged exposure control is useful risk machinery, but it is not an entry edge by itself.

## E-010 — Sweep / Acceptance v0.1
- Observable boundary breaks: 1,134.
- Acceptance: 774; Rejection: 360.
- Acceptance with executable retest: 323.
- BASE executable non-overlapping episodes: 611.
- Overall BASE C1 Single: **-0.0516R**.
- Overall BASE C1 Staged: **-0.0515R**.
- Rejection Single C1: **-0.1249R** → FAIL.
- Acceptance+Retest Single C1: **+0.0210R**.
- Acceptance branch was positive in Early/Late and Long/Short at C1.
- Acceptance Single C2: **-0.0254R**; median C1 strongly negative.
- Verdict: **OVERALL FAIL**.
- Sub-verdict: **Acceptance+Retest is PROMISING BUT NOT ROBUST**.
- Promotion: not eligible for Final Holdout or production/paper candidate status.

## E-011 — Forward Microstructure Acceptance Gate v0.1
- Status: **PREREGISTERED / LOCKED**.
- Baseline: frozen Acceptance -> Retest -> Continuation branch.
- Question: does contemporaneous forward microstructure add incremental timing value?
- Minimum evidence: >=2 ready source families; direction votes reduced to -1/0/+1 with no fitted magnitude threshold.
- Treatment: ALIGNED -> TAKE; OPPOSED -> SKIP; MIXED/INSUFFICIENT -> baseline unchanged.
- Outcome linkage: **FORBIDDEN** until both 30 days and 10,000 valid snapshots are reached.
- Historical Holdout: remains sealed.

## 2026-10-04 � Open Historical Batch Evaluation
- Source: clean JForex/Python historical corpus; Holdout sealed.
- Acceptance+Context SINGLE C2: n=271, mean +0.05696R, total +15.44R, PF 1.058.
- Train: -0.05276R/trade; Validation: +0.69062R/trade.
- STAGED: -0.00772R/trade overall.
- Rejection SINGLE: -0.13709R/trade; STAGED: -0.06494R/trade.
- Conclusion: Acceptance path survives as research direction but is not stable across years; Rejection remains rejected.


## 2026-10-04 � Pine v0.2 exact-logic Validation emulation
- Tested the exact supplied Pine v0.2 logic on clean JForex BID OHLC across the full Validation window.
- 40 trades: 31 LONG / 9 SHORT; 16 wins / 24 losses.
- Win rate 40%; total +33.246R; mean +0.831R; PF 2.3425.
- This is Pine-logic emulation, not the separate Python strategy implementation.
- Historical Holdout remained sealed.


## 2026-10-04 � Pine v0.2 extended historical test
- User requested exact Pine v0.2 from 2025-01-01 through 2026-10-01; clean snapshot ended at 2026-09-30T13:40:49Z.
- Full available interval: 57 trades, +8.1775R, PF 1.1998, max DD -19.2154R.
- Previously sealed Holdout subset: 51 trades, +2.9682R, PF 1.0751.
- Historical Holdout is now opened/consumed. Pristine Forward OOS remains blind.


## 2026-10-04 � Pine v0.2 all-trade path analysis
- Analyzed all 57 extended-test trades with MFE/MAE and structural breakdowns.
- LONG +13.30R / PF 1.71; SHORT -5.12R / PF 0.77.
- Strong MTF |3| +19.77R / PF 2.18; weak MTF |1| -11.59R / PF 0.52.
- 16/16 winners were 24H timeout exits; 41/41 losers were 2-closes-inside exits.
- 11 losing trades had first reached +1R or more; 5 had reached +2R or more.
- Maximum losing streak = 13 trades; top-two-winner concentration makes overall edge fragile.


## 2026-10-04 � Pine v0.3 Strict MTF
- Final candidate this round: exact v0.2 exits + MTF score +3/-3 only.
- 28 trades, +19.7697R, PF 2.1842, max DD -5.2546R.
- 2025: +11.7236R, PF 2.8584. 2026 through Sep 30: +8.0461R, PF 1.7747.
- Two dynamic-risk overlays were tested and rejected as inferior.


## 2026-10-04 � Pine v0.3 Strict MTF on 2023-2025
- Unchanged v0.3 Strict MTF applied from 2023-01-01 through 2025-12-31.
- Overall: 64 trades, +25.7705R, PF 1.4741, max DD -25.2919R.
- 2023: -17.7928R, PF 0.3304, max DD -22.6162R.
- 2024: +31.8398R, PF 2.4825.
- 2025: +11.7236R, PF 2.8584.
- 2023 failed in both LONG and SHORT; next research target is causal regime discrimination, not side filtering alone.

