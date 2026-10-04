# GTGLab2 â€” Experiment Register

This register inherits closed GTGLab experiments and will hold all GTGLab2 experiments.

## E-001 â€” Transition logistic classifier
- Task: fake break vs true trend after range exit.
- Approx. accuracy: 78.0%.
- Balanced accuracy: 74.3%.
- Result: classification useful, execution economics not sufficient.
- Verdict: **classification signal â‰  proven trading edge**.

## E-002 â€” Early breakout execution / logistic filter
- Early breakout C1: about -0.337 ATR/trade.
- Logistic filter C1: about -0.361.
- Delayed confirmation improved economics but timing remained weak.
- Verdict: **FAIL as execution solution**.

## E-003 â€” Directional Change leg geometry
- Goal: refine Swing entry timing.
- Result: weakened signal.
- Verdict: **CLOSED**.

## E-004 â€” Range scalper Pre-Transition Guard
- Guard C1: about -0.206.
- No-Guard C1: about -0.181.
- Verdict: **FAIL**.

## E-005 â€” Raw Sequence Utility
- 48 H1-candle sequence.
- correlation: ~0.010.
- directional accuracy: ~55.6%.
- C1: ~-0.316 ATR/trade.
- Verdict: **FAIL**.

## E-006 â€” DC Correction â†’ Resumption H4
- Validation C1: ~-0.054.
- C2: ~-0.199.
- Verdict: **FAIL**.

## E-007 â€” Chronos-2 DC Gate v0.1
- zero-shot context: 256 H1
- horizon: 4
- 109 signals â†’ 62 trades
- Chronos C1: +0.0049
- baseline C1: +0.1013
- temporal instability observed
- Verdict: **FAIL incremental edge**.

## E-008 â€” Microstructure Forward
- Features available include flow, delta, footprint, order-book imbalance, volume profile, and market agreement.
- Status: **COLLECTING ONLY**.
- Outcome linkage: **NOT YET PERMITTED**.
- First edge-analysis experiment: pending readiness gate.

## Sweep / Acceptance v0.1 — 2026-10-04
- Development only; locks preserved.
- Boundary breaks: 1,134; acceptance: 774; rejection: 360.
- BASE C1 single overall: -0.0516 R/trade.
- BASE C1 acceptance single: +0.0210 R/trade.
- BASE C1 rejection single: -0.1249 R/trade.
- BASE C1 acceptance staged: -0.0291 R/trade.
- Verdict: overall FAIL; rejection-fade branch rejected; acceptance continuation retained as a new-version research lead; current staging rule rejected.


## E-009 â€” Doctrine Reference v0.1
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

## E-010 â€” Sweep / Acceptance v0.1
- Observable boundary breaks: 1,134.
- Acceptance: 774; Rejection: 360.
- Acceptance with executable retest: 323.
- BASE executable non-overlapping episodes: 611.
- Overall BASE C1 Single: **-0.0516R**.
- Overall BASE C1 Staged: **-0.0515R**.
- Rejection Single C1: **-0.1249R** â†’ FAIL.
- Acceptance+Retest Single C1: **+0.0210R**.
- Acceptance branch was positive in Early/Late and Long/Short at C1.
- Acceptance Single C2: **-0.0254R**; median C1 strongly negative.
- Verdict: **OVERALL FAIL**.
- Sub-verdict: **Acceptance+Retest is PROMISING BUT NOT ROBUST**.
- Promotion: not eligible for Final Holdout or production/paper candidate status.

## E-011 â€” Forward Microstructure Acceptance Gate v0.1
- Status: **PREREGISTERED / LOCKED**.
- Baseline: frozen Acceptance -> Retest -> Continuation branch.
- Question: does contemporaneous forward microstructure add incremental timing value?
- Minimum evidence: >=2 ready source families; direction votes reduced to -1/0/+1 with no fitted magnitude threshold.
- Treatment: ALIGNED -> TAKE; OPPOSED -> SKIP; MIXED/INSUFFICIENT -> baseline unchanged.
- Outcome linkage: **FORBIDDEN** until both 30 days and 10,000 valid snapshots are reached.
- Historical Holdout: remains sealed.

## 2026-10-04 — Open Historical Batch Evaluation
- Source: clean JForex/Python historical corpus; Holdout sealed.
- Acceptance+Context SINGLE C2: n=271, mean +0.05696R, total +15.44R, PF 1.058.
- Train: -0.05276R/trade; Validation: +0.69062R/trade.
- STAGED: -0.00772R/trade overall.
- Rejection SINGLE: -0.13709R/trade; STAGED: -0.06494R/trade.
- Conclusion: Acceptance path survives as research direction but is not stable across years; Rejection remains rejected.


## 2026-10-04 — Pine v0.2 exact-logic Validation emulation
- Tested the exact supplied Pine v0.2 logic on clean JForex BID OHLC across the full Validation window.
- 40 trades: 31 LONG / 9 SHORT; 16 wins / 24 losses.
- Win rate 40%; total +33.246R; mean +0.831R; PF 2.3425.
- This is Pine-logic emulation, not the separate Python strategy implementation.
- Historical Holdout remained sealed.


## 2026-10-04 — Pine v0.2 extended historical test
- User requested exact Pine v0.2 from 2025-01-01 through 2026-10-01; clean snapshot ended at 2026-09-30T13:40:49Z.
- Full available interval: 57 trades, +8.1775R, PF 1.1998, max DD -19.2154R.
- Previously sealed Holdout subset: 51 trades, +2.9682R, PF 1.0751.
- Historical Holdout is now opened/consumed. Pristine Forward OOS remains blind.


## 2026-10-04 — Pine v0.2 all-trade path analysis
- Analyzed all 57 extended-test trades with MFE/MAE and structural breakdowns.
- LONG +13.30R / PF 1.71; SHORT -5.12R / PF 0.77.
- Strong MTF |3| +19.77R / PF 2.18; weak MTF |1| -11.59R / PF 0.52.
- 16/16 winners were 24H timeout exits; 41/41 losers were 2-closes-inside exits.
- 11 losing trades had first reached +1R or more; 5 had reached +2R or more.
- Maximum losing streak = 13 trades; top-two-winner concentration makes overall edge fragile.


## 2026-10-04 — Pine v0.3 Strict MTF
- Final candidate this round: exact v0.2 exits + MTF score +3/-3 only.
- 28 trades, +19.7697R, PF 2.1842, max DD -5.2546R.
- 2025: +11.7236R, PF 2.8584. 2026 through Sep 30: +8.0461R, PF 1.7747.
- Two dynamic-risk overlays were tested and rejected as inferior.


## 2026-10-04 — Pine v0.3 Strict MTF on 2023-2025
- Unchanged v0.3 Strict MTF applied from 2023-01-01 through 2025-12-31.
- Overall: 64 trades, +25.7705R, PF 1.4741, max DD -25.2919R.
- 2023: -17.7928R, PF 0.3304, max DD -22.6162R.
- 2024: +31.8398R, PF 2.4825.
- 2025: +11.7236R, PF 2.8584.
- 2023 failed in both LONG and SHORT; next research target is causal regime discrimination, not side filtering alone.


## 2026-10-04 — Pine v0.4 causal regime filter
- Frozen rule: MTF +3/-3, directional EMA50/200 gap >=1.5 ATR, ATR14 >= rolling median ATR14(120H).
- Exact 2023-2025: 28 trades, +33.3225R, PF 3.0585, max DD -5.805R.
- 2023 improved from -17.7928R to +6.1663R.
- Secondary 2026: +9.6390R on 4 trades.
- Earlier 2018-2022: +5.4883R overall, but 2018/2019 still fail; regime engine is improved, not complete.


## 2026-10-04 — v0.5 Buy Low / Sell Higher development
- v0.5 initial broad version: 393 trades, +18.53R, PF 1.066; RANGE_LOW rejected and stop too tight.
- v0.5.1 strict v0.4-regime version: only 2 trades; rejected as unusably sparse.
- v0.5.2 robustness grid: 486 preregistered combinations with causal R/R correction and split 2018-2023 vs 2024-2026.
- Frozen v0.5.2: position48<=0.45, EMA gap>=1 ATR, stop cushion 0.75 ATR, target 60% of 48H range, min planned RR 1.25.
- Final: 139 trades, +35.4243R, PF 1.4883, max DD -9.6099R.
- Pristine Forward OOS remains untouched.


## 2026-10-04 — GTGLab2 v0.5.2 Buy Low / Sell High
- Robustness grid: 486 combinations, 354 passed split-stability gates.
- Frozen candidate: position48 <=0.40, EMA50/200 gap >=1 ATR, stop cushion 0.75 ATR, target at 60% of frozen 48H range, minimum planned R:R 1.25.
- Exact Pine-logic emulation 2018-2026: 131 trades, +34.9694R, PF 1.5141, max DD -7.6570R, win rate 41.98%.
- 2018-2023: +22.7937R, PF 1.4468. 2024-2026: +12.1757R, PF 1.7163.
- v0.5.2 is a distinct pullback/rejection engine, not a replacement for v0.4 momentum-regime engine.


## 2026-10-04 — Bottom Atlas v0.1
- Mapped 1/2/4 ATR directional price swings across clean historical H1.
- 6,426 fresh-low bottom candidates; GOOD48 2,588 vs FALSE48 3,714.
- Baseline resolved GOOD rate 41.07%.
- Lower wick >=0.5 ATR: 50.46% GOOD; close in upper half: 50.93%; both + 5H drift >= -1.5 ATR: 58.67%.
- Major 2-ATR swing bottoms: 1,361; median prior decline 3.07 ATR; median next rise 5.14 ATR; median rise duration 7H; median confirmation delay 1H.
- Absolute cheapness alone was not useful: false lows were often closer to the absolute recent low than true bottoms.
- No trading rule promoted. Next target is a causal Bottom Detector with separated Swing and Scalper research.


## 2026-10-04 — Bottom Detector v0.1
- Logistic Bottom Score passed the research gate: AUC 0.623 validation / 0.611 pseudo-test.
- High-confidence threshold frozen on 2023-2024 delivered 59.5% GOOD rate on 2025-2026 vs 40.15% baseline.
- Dominant causal signals: lower-wick rejection, close recovery, downside deceleration; EMA context secondary.
- Promote detector only for Swing/Scalper research, not direct trading.


## 2026-10-04 — Swing / Scalper Detectors v0.1
- Swing target +4ATR before -1ATR within 72H: pseudo-test AUC 0.594; high-confidence precision 60% vs 33.2% baseline, low coverage.
- Scalper target +1.5ATR before -0.75ATR within 12H: pseudo-test AUC 0.714; top-quarter precision 84.8% vs 59.8% baseline.
- Keep Swing and Scalper as separate engines. Next step is next-open executable harness with frozen thresholds.


## 2026-10-04 — Detector Execution Bridge v0.1
- Next-open market entry rejected for both engines.
- Swing primary pseudo-test: -19.79R, PF 0.839; classification win rate improved but actual entry R:R collapsed to 1.28.
- Scalper primary pseudo-test: -8.90R, PF 0.800 despite 77.5% wins; average entry R:R only 0.27.
- Root cause: confirmation candle already captures much of bounce. Next step: time-limited low-zone limit entry; do not chase.


## 2026-10-04 — Low-Zone Limit Entry v0.1
- Entry grid selected only on 2018-2024, then frozen.
- Swing selected: low+1ATR limit, 3H expiry. 2025-2026: 167 fills, -23.626R, PF 0.789; 2025 +6.137R but 2026 -29.763R.
- Scalper selected: low+0.10ATR limit, 3H expiry. 2025-2026: 53 fills, -11.409R, PF 0.692.
- Reject both limit-entry bridges. Do not retune on consumed 2025-2026.

