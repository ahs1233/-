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


## 2026-10-04 — M15 Entry Resolution v0.1
- Built 201,591 exact M15 bars from clean M1 and 27,500 fresh-low candidates.
- Scalper detector pseudo-test AUC 0.701; filtered next-M15-open execution -21.77R PF 0.903 because avg remaining R:R only 0.276.
- Swing-entry detector pseudo-test AUC 0.621; filtered next-M15-open -9.50R PF 0.979; avg R:R 0.875.
- Conclusion: M15 is the correct entry-resolution timeframe, but market-chasing after confirmation remains wrong. Next execution must be M15 low-zone retest/limit.


## 2026-10-05 — Low-Zone Limit Entry v0.1
- Grid selected on 2018-2024, then frozen on 2025-2026.
- Swing selected limit +1.0 ATR / 3H: 2025-2026 167 trades, -23.626R, PF 0.789, DD -30.763R.
- Scalper selected limit +0.10 ATR / 3H: 53 trades, -11.409R, PF 0.692, DD -15.997R.
- Deep retest improved theoretical R:R but selected failing bottoms. Most strong Scalper signals moved away without retest.
- Decision: stop H1 entry-offset tuning; move execution research to M5/M15 while H1 defines context/candidate bottom.



## 2026-10-05 â€” Linked H1/M15/M5 Entry Resolution v0.1
- Built 607,272 exact M5 bars and causally linked them to completed M15/H1 context.
- Scalper filtered pseudo-test: 491 trades, -18.654R, PF 0.918, avg entry R:R 0.839.
- Swing filtered pseudo-test: 339 trades, -3.289R, PF 0.986, avg entry R:R 2.390.
- M5 materially improved remaining R:R versus M15, especially Swing, but 2025/2026 stability failed.
- Decision: keep H1/M15/M5 architecture; do not promote execution candidate yet. Remaining problem is identifying the true transition micro-low, not simply lowering the timeframe.


## 2026-10-05 â€” M5 Transition State Machine v0.1
- Preregistered three causal price-transition rules: MID_RECLAIM, HIGH_RECLAIM, HIGHER_LOW_BREAK.
- Scalper selected HIGHER_LOW_BREAK on 2018-2024; frozen 2025-2026 failed: 663 trades, -17.771R, PF 0.927.
- Swing selected HIGH_RECLAIM on 2018-2024; frozen 2025-2026 nearly flat overall but unstable: 450 trades, -1.371R, PF 0.995; 2025 +38.252R vs 2026 -39.624R.
- HIGHER_LOW_BREAK Swing was positive on pseudo-test (+9.973R, PF 1.034) but was not the preregistered winner and is diagnostic only; switching would be cherry-picking.
- Decision: no promotion. Transition family is promising for Swing, but causal stability problem remains.

## 2026-10-05 â€” M5 Transition State Machine v0.1
- Preregistered three causal price-transition rules: MID_RECLAIM, HIGH_RECLAIM, HIGHER_LOW_BREAK.
- Scalper selected HIGHER_LOW_BREAK on 2018-2024; frozen 2025-2026 failed: 663 trades, -17.771R, PF 0.927.
- Swing selected HIGH_RECLAIM on 2018-2024; frozen 2025-2026 nearly flat overall but unstable: 450 trades, -1.371R, PF 0.995; 2025 +38.252R vs 2026 -39.624R.
- HIGHER_LOW_BREAK Swing was positive on pseudo-test (+9.973R, PF 1.034) but was not the preregistered winner and is diagnostic only; switching would be cherry-picking.
- Decision: no promotion. Transition family is promising for Swing, but causal stability problem remains.


## 2026-10-05 â€” Market State Engine + Management v0.1
- Built a 6-state unsupervised H1/M15/M5 market-state reader from price-only causal features, trained on 2018-2022.
- Frozen prior entry triggers were retained: Scalper HIGHER_LOW_BREAK; Swing HIGH_RECLAIM.
- Scalper accepted states 0 and 5 but remained negative on consumed 2025-2026: gated FIXED -11.680R, PF 0.946.
- Swing accepted states 0, 4 and 5. Gated FIXED was +22.568R PF 1.029 Train, +38.504R PF 1.120 Validation, but -2.760R PF 0.990 on consumed 2025-2026.
- Critical diagnosis: Swing State 0 (strong H1 downtrend) later failed (-12.438R PF 0.926), while State 4 (range recovery) remained positive (+9.220R PF 1.220) and State 5 remained mildly positive.
- FIXED management beat preregistered early-protection alternatives. Management cannot rescue a bad market state.
- Decision: retain State Reader architecture; no execution promotion; do not cherry-pick State 4 after consumed-history inspection.


## 2026-10-05 â€” Market State Engine yearly audit v0.1
- Audited the frozen Market State Engine year by year from 2018-03-01 through 2026-09-30 without changing parameters.
- Scalper: +37.364R full period, PF 1.035, but only 4/9 positive years. 2020/2021 carry much of the edge.
- Swing: +58.312R full period, PF 1.042, 6/9 positive years, but severe negative years in 2021, 2022 and 2026.
- Critical finding: in 2025 all accepted Swing states (0/4/5) were positive; in 2026 all three were negative. The failure is therefore broader than State 0 alone.
- Decision: static state-at-entry is insufficient; next research must model state transition/evolution and post-entry behavior.


## 2026-10-05 â€” State Evolution Engine v0.1
- Added causal state-evolution features across M5, M15 and 24H-120H context.
- Fixed Logistic Regression, no hyperparameter search, threshold fixed from Train distribution.
- Scalper improved materially: consumed 2025-2026 became +9.789R PF 1.136; 2026 improved from -10.066R static-state result to -0.717R.
- Swing validation passed (+22.396R PF 1.120) but consumed 2025-2026 failed (-28.541R PF 0.832), especially 2026 (-27.403R PF 0.686).
- Diagnostic: Swing mean score did not fall in 2026 even though positive-label rate fell sharply. 2026 showed a more persistent multi-day downside context (120H return +1.49 ATR in 2025 vs -3.53 ATR in 2026 selected events).
- OOD test did not support simple out-of-range failure; this is concept drift / relationship shift.
- Decision: retain evolution features; Scalper bottleneck moves to payoff geometry; Swing needs adaptive walk-forward learning.


## 2026-10-05 â€” State Evolution Engine v0.1
- Added causal evolution features across H1/M15/M5 plus higher-order 24H/72H/120H regime descriptors and transition-path features.
- Scalper AUC: Train .651, Validation .619, consumed 2025-26 .666. Evolution-gated consumed result improved to +9.789R PF 1.136, and 2026 improved from static -10.066R PF .907 to -0.717R PF .983. However Validation fell to +0.594R PF 1.006 versus static +12.872R PF 1.051, so the preregistered improvement criterion failed.
- Swing AUC: Train .612, Validation .554, consumed .533. Validation remained positive (+22.396R PF 1.120) but did not beat static baseline; consumed 2025-26 failed at -28.541R PF .832.
- 2026 Swing passed many model gates despite a low actual positive-outcome rate, indicating a higher-order regime mapping shift rather than merely weak local signals.
- Decision: retain evolution architecture; Scalper evolution is promising research, Swing evolution v0.1 fails; no promotion.

## 2026-10-05 â€” State Evolution Engine v0.1
- Added causal evolution features across H1/M15/M5 plus 24H/72H/120H regime descriptors and anchor-to-signal recovery features.
- Scalper AUC: Train .651, Validation .619, consumed 2025-26 .666. Evolution-gated consumed result improved to +9.789R PF 1.136, with 2026 at -0.717R PF .983; however Validation fell to +0.594R PF 1.006 versus static +12.872R PF 1.051, so the preregistered improvement criterion failed.
- Swing AUC: Train .612, Validation .554, consumed .533. Validation remained positive (+22.396R PF 1.120) but did not beat static baseline; consumed 2025-26 failed at -28.541R PF .832.
- 2026 Swing still passed many model gates despite a low actual positive-outcome rate, indicating a higher-order regime mapping shift rather than merely weak local signals.
- Decision: retain evolution architecture; Scalper evolution is promising research, Swing evolution v0.1 fails; no promotion.


## 2026-10-05 â€” Adaptive Walk-Forward State Evolution v0.2
- Tested causal annual retraining with a rolling 3-year training window.
- Scalper aggregate 2021-2026: +32.605R, PF 1.117; 2026 nearly flat at -0.906R PF 0.981.
- Swing aggregate failed: -35.838R PF 0.940; 2026 remained -27.905R PF 0.700 with AUC ~0.503 despite training on 2023-2025.
- 2026 quarter diagnosis: Swing all-event positive rate was ~38.4% in Q1, collapsed to 17.6% in Q2, then partially recovered to 31.4% in Q3.
- Conclusion: Swing concept drift occurred faster than annual retraining. Next test = quarterly adaptation using previous 4 completed quarters.


## 2026-10-05 â€” Quarterly Adaptive State Evolution v0.3
- Retrained State Evolution every quarter using the previous 4 completed quarters only.
- Scalper remained positive overall (+20.765R PF 1.072) and recovered in Q3 2026 after a bad Q2.
- Swing still failed overall (-22.307R PF 0.961). 2026 Q1/Q2/Q3 were all negative.
- Most important: Q3 2026 trained on a window that already included the Q2 collapse, yet Q3 still lost -11.190R with AUC 0.459.
- Decision: faster prediction retraining alone is insufficient for Swing. Next layer must be explicit regime-health / risk-off management.


## 2026-10-05 â€” Regime Health Risk-Off v0.4
- Added an explicit management layer using the trailing 20 CLOSED shadow trades.
- Frozen rule: risk-off if trailing total <= -5R OR PF <= 0.80; shadow continues during risk-off.
- Scalper aggregate expectancy was largely unchanged; health layer is protective rather than additive.
- Swing 2026 improved dramatically: shadow -28.559R -> live -6.822R. First risk-off occurred 2026-03-17, Q2 exposure dropped to 4 trades, and Q3 live exposure dropped to zero.
- Across the whole Swing walk-forward stream, skipped trades were net -12.570R, confirming useful damage avoidance, but aggregate live result remained negative (-9.736R PF 0.973).
- Decision: retain regime-health management as a safety layer, but do not treat it as a substitute for stronger Swing state understanding.

## 2026-10-05 â€” Wave Regime + Control Transfer v0.1
- Split research into specialized readers: local M5/M15 Control Transfer for Scalper and 1-10 day Higher-Order Wave/Regime for Swing.
- Scalper Control Transfer AUC: Train .640, Validation .629, consumed .653. Validation +3.495R PF 1.038: better than State Evolution v0.1 but worse than the simpler static-state baseline. 2025 +11.858R, 2026 -11.220R.
- Swing Wave Regime AUC: Train .589, Validation .509, consumed .516. Validation +5.696R PF 1.035 and consumed 2025-26 approximately flat, but per-event discrimination is effectively near random out of sample.
- Key diagnosis: higher-order regime should not predict each individual Swing trade. It should operate as a persistent permission/risk layer over larger time blocks, while H1/M15/M5 handle individual entries.
- Decision: retain both concepts, change their roles; no production promotion and no 2025-2026 retuning.

## 2026-10-05 â€” Integrated Decision Architecture v0.1
- Combined the evidence-backed hierarchy: persistent Swing Wave Permission, frozen static state eligibility, M5 transition/control transfer, original execution geometry, and causal trailing-20 Regime Health risk-off.
- Combined live result 2018-03 through 2026-09: 1,991 trades, +108.114R, PF 1.136, max DD -24.690R, win 59.52%.
- Broad segments were all positive with similar PF: 2018-22 +63.333R PF 1.139; 2023-24 +27.112R PF 1.133; 2025-26 +17.668R PF 1.130.
- Compared with prior static architecture: total R +13.0%, PF improved 1.039 -> 1.136, drawdown magnitude reduced 63.8%, trade count reduced 61.9%, and 2026 loss improved from -51.993R to -16.505R.
- 2022 flipped from -30.284R to +5.064R. 2026 remains materially negative and unresolved.
- Decision: retain as strongest architecture so far; no final production promotion until untouched OOS is authorized.

## 2026-10-05 — Movement Expansion Index v0.1
- Built a continuous year-agnostic Expansion Index from percent-normalized H1 ATR, 24H/72H movement range, volatility-of-volatility, 30-day expansion velocity, and acceleration.
- All normalization and state thresholds were frozen from 2018-2022 only.
- Mean Expansion Index: 2024 +0.310 -> 2025 +0.668 -> 2026 +1.470.
- High+Extreme context share: 2024 20.1% -> 2025 29.1% -> 2026 54.6%. High+Extreme+Cooldown reached 85.8% in 2026.
- 2025 was a transition year with repeated expansion pulses (Feb, Apr-May, Oct-Nov); 2026 became persistently elevated.
- Control check: the index also identified 2020 expansion, so it is not merely a year/high-price detector.
- Frozen expansion-aware risk reduced combined 2026 loss from -16.505R to -8.109R, but reduced full-period R from +108.114R to +87.071R. Swing 2026 improved from -13.012R to -5.315R with DD -17.309R -> -7.597R.
- Decision: retain Expansion Index as top-level context; reject the current blunt risk map as final sizing logic. Next focus is Expansion Persistence + State Interaction.

## 2026-10-05 — Measurement & Execution Audit v0.1
- Rebuilt GTGLab2 measurement on a clean worktree at reference b9f645b using historical Bid+Ask instead of bid-only long execution.
- Verified defects: bid-only long entry, signal-ordered combined DD, pseudo-H1 Wave sampling, future-label-filtered permission stream, split-boundary outcome leakage, raw Control Transfer distances, degenerate max_adverse_anchor_atr, and unresolved M5 both-bar ordering.
- Pure price-side attribution on the old live signal set: +108.114R reported -> +5.513R after ASK-entry/BID-exit quoted spread; 47 old signals became non-executable (46 Scalper, 1 Swing).
- Corrected architecture after required refit: Combined 1,673 trades +46.036R PF 1.064; M5 MTM DD -27.443R. Scalper -23.432R PF .880; Swing +69.468R PF 1.132.
- Corrected 2026 combined remains negative at -9.999R PF .831; 2025 remains +24.251R PF 1.332.
- Additional 0.25x quoted-spread adverse slippage per side reduces corrected combined to +4.909R PF 1.007; 0.50x makes it negative. Swing retains more cost cushion; Scalper has none.
- Decision: Audit PASS, trading promotion NO-GO. Scalper current form NO-GO; Swing retained for research. Next: opportunity composition vs conditional path change before any Productive/Destructive Expansion model.

## 2026-10-05 — Post Measurement Audit Research Decision
- Current Scalper architecture is parked after executable-price correction removed its expectancy.
- Swing remains the only engine worth continuing, but is research-only and not considered a proven edge.
- Prior use of 2020 as a proven "Productive Expansion" example is withdrawn; future 2020 comparisons must use corrected Swing and matched expansion contexts.
- Measurement attribution is treated as bundled where multiple fixes/refits changed together; no unsupported per-defect R attribution.
- Negative corrected 2026 keeps structural-change hypotheses open but does not prove them.
- Experiment 2 will start from corrected Swing SHADOW before Health and ask whether matched pre-entry opportunities differ in outcome/path after controlling Entry Geometry and Opportunity Composition.
- Conditional Path Change is an outcome, never a matching variable.
- Productive/Destructive Expansion modeling remains deferred until Experiment 2 shows a residual path effect.
- Pristine Forward OOS remains sealed.

## 2026-10-05 — Swing Opportunity Composition vs Conditional Path v0.1 preregistered
- Experiment 2 is frozen as an information-gain diagnostic, not a PnL optimization.
- Primary population: corrected Swing Shadow before Health, after frozen Permission and overlap prevention.
- Supporting population: all corrected Swing state-eligible events before Permission, overlap prevention, and Health; overlapping event outcomes are diagnostic only and never portfolio PnL.
- Primary contrast: full 2025 vs Jan-Sep 2026; mandatory calendar-balanced Jan-Sep 2025 vs Jan-Sep 2026 sensitivity; 2023-2024 are additional consumed historical references.
- Sequential design: raw gap -> geometry-matched gap -> geometry+composition-matched gap -> post-entry path residual.
- Matching uses pre-entry information only. Path outcomes (MAE/MFE, reclaim loss, anchor recross, time-to-barrier) are never matching inputs.
- Train-only scales/calipers; exact State/session in full matching; common-support and balance gates are mandatory.
- Economic materiality margin frozen at 0.05R/trade.
- Dependence-aware moving-block bootstrap: 5 trading days, 2,000 replications, rematching each replication.
- Final classification must be one of: GEOMETRY, COMPOSITION, CONDITIONAL PATH, INCONCLUSIVE.
- No Productive/Destructive classifier; Pristine OOS remains sealed.
