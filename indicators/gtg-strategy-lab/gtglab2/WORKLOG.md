# GTGLab2 — Worklog

Chronological, append-only in spirit. Corrections should be added as new entries rather than silently rewriting history.

## 2026-10-04 — GTGLab2 initialized

**Action**
- Renamed the current research track to GTGLab2.
- Created Git branch `research/gtglab2`.
- Created canonical documentation directory `indicators/gtg-strategy-lab/gtglab2/`.

**Inherited verified state**
- Microstructure quality audit PASS.
- 128 forward microstructure captures.
- 122 Fusion Grade, 6 Single-source Grade.
- JForex Pristine Forward seal PASS for 2026-09-30 through 2026-10-02.
- Historical Holdout locked.
- Pristine OOS undecoded.

**Documentation system created**
- README
- current-state ledger
- historical baseline
- worklog
- decision register
- experiment register
- research protocol
- artifact index
- machine-readable EVENTS.jsonl
- event-recording helper

**Reason**
The project had accumulated many experiments, protocols, and operational fixes. A single canonical evidence trail is required so future work can be audited and reused rather than reconstructed from chat history.

## 2026-10-04T00:18:51.145074Z — GTGLAB2-0002 — documentation_checkpoint

**Action:** GTGLab2 canonical evidence trail created, validated, committed, and pushed.

**Reason:** Create a durable project guide so future decisions, experiments, failures, fixes, and verification can be reconstructed from the repository.

**Result:** Canonical guide is live on research/gtglab2.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/`

**Verification:**
- record_event.py py_compile PASS
- EVENTS.jsonl parsed successfully
- Git push research/gtglab2 PASS

**Commit:** `896e71a`

## 2026-10-04T00:22:53.749619Z — GTGLAB2-0003 — blocker_review

**Action:** Prioritized the blockers preventing GTGLab2 from proving a defensible trading result.

**Reason:** Convert vague project friction into explicit research and operational blockers with closure conditions.

**Result:** BLOCKERS.md created with critical path from clean collection to validated executable edge.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/BLOCKERS.md`

**Verification:**
- Blockers derived from recorded experiment failures, current collection state, and research protocol


## 2026-10-04T09:33:08.687593Z — GTGLAB2-0004 — ultra_plan_frozen

**Action:** Frozen GTGLab2 Ultra Plan and Phase 1 architecture; Liquid connector switched to paper mode; foundation tests pass 9/9.

**Reason:** User requested full execution of the GTGLab2 Ultra Plan with evidence preservation.

**Result:** ULTRA_PLAN_V01 registered; typed bidirectional contracts and causal MA/session foundation present; 9/9 foundation tests PASS; Liquid paper mode enabled.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/ULTRA_PLAN_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/engine/contracts.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/context_features.py`

**Verification:**
- 9/9 Phase 1 foundation tests PASS
- Liquid paper trading enabled in connected Co-Invest connector


## 2026-10-04T09:43:31.859072Z — GTGLAB2-0005 — phase2_core_implemented

**Action:** Implemented causal session, liquidity, MTF, fixed-risk inventory, invalidation, and bid/ask execution layers; preregistered doctrine reference v0.1.

**Reason:** Execute GTGLab2 Ultra Plan phases 2-8 without opening protected outcome sources.

**Result:** 17/17 GTGLab2 phase tests PASS; doctrine reference protocol frozen before first run; reference experiment started on development-only history.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/engine/session_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/liquidity.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/mtf_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/inventory.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/invalidation.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/execution.py`
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_DOCTRINE_REFERENCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/doctrine_reference_v01.py`

**Verification:**
- 17/17 unit tests PASS
- Historical Holdout not read
- Pristine Forward OOS not decoded


## 2026-10-04T09:50:36.203124Z — GTGLAB2-0006 — phase2_core_complete

**Action:** Implemented causal session, MTF, liquidity, inventory, invalidation, and BID/ASK execution primitives.

**Reason:** Execute GTGLab2 Ultra Plan phases 2-4 before outcome-linked testing.

**Result:** Phase 1 tests 9/9 PASS; Phase 2 core tests 8/8 PASS; fixed-risk/no-add-after-invalidation invariants verified.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/engine/session_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/mtf_context.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/liquidity.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/inventory.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/invalidation.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/execution.py`

**Verification:**
- 17/17 cumulative GTGLab2 engine tests PASS


## 2026-10-04T09:58:41.327947Z — GTGLAB2-0007 — experiment_complete

**Action:** Sweep/Acceptance v0.1 development screen completed.

**Reason:** Test whether post-break rejection and acceptance create distinct executable paths and whether staged entry improves single entry.

**Result:** 1134 boundary breaks; 774 acceptance, 360 rejection. BASE C1 single overall -0.0516R; acceptance-only +0.0210R; rejection -0.1249R. Current staged acceptance -0.0291R. No Holdout/OOS/microstructure outcomes read.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/runs/sweep-acceptance-v01-001/summary.json`

**Verification:**
- Historical Holdout read=false
- Pristine Forward OOS decoded=false
- Microstructure outcomes read=false


## 2026-10-04T10:01:39.304296Z — GTGLAB2-0008 — ultra_plan_execution_checkpoint

**Action:** Executed all currently eligible GTGLab2 Ultra Plan phases; two historical development candidates evaluated; downstream protected gates enforced.

**Reason:** User requested full execution with results while preserving the GTGLab2 evidence trail.

**Result:** GTGLab2 24/24 tests PASS; data 106/106 PASS; Doctrine Reference v0.1 FAIL; Sweep/Acceptance v0.1 overall FAIL with Acceptance+Retest promising but not robust; JForex forward audit PASS; microstructure 217/10000 and 0.516/30 days; Liquid Paper enabled; Quiver paid datasets blocked by no active subscription.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/EXECUTION_STATUS_2026-10-04.md`
- `indicators/gtg-strategy-lab/gtglab2/RESULT_DOCTRINE_REFERENCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/RESULT_SWEEP_ACCEPTANCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/CURRENT_STATE.md`

**Verification:**
- 24/24 GTGLab2 phase tests PASS
- 106/106 data tests PASS
- Canonical .lab-data forward seal audit PASS
- Historical Holdout not read
- Pristine Forward outcomes not decoded
- Microstructure outcome linkage remains locked


## 2026-10-04T10:03:55.917032Z — GTGLAB2-0009 — jforex_freshness_blocker

**Action:** Canonical sealed JForex days pass integrity, but the now-settled 2026-10-03 authenticated export is missing.

**Reason:** Post-settle Phase 0 freshness verification.

**Result:** Existing .lab-data seals 2026-09-30..2026-10-02 audit PASS; sealer status BLOCKED_MISSING_JFOREX_EXPORT for 2026-10-03; no public-datafeed substitution made.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_AUDIT_CANONICAL_LATEST.json`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_CANONICAL_LATEST.json`

**Verification:**
- JForex Desktop process running
- 2026-10-03 absent from export and cache
- SDK credential environment variables absent
- protected price outcomes not decoded


## 2026-10-04T10:06:55.458138Z — GTGLAB2-0010 — eligible_ultra_plan_complete

**Action:** Completed every GTGLab2 Ultra Plan phase currently permitted by registered research gates.

**Reason:** User requested full execution and results without bypassing Holdout, Pristine OOS, or forward microstructure readiness locks.

**Result:** 28/28 GTGLab2 engine tests PASS; 106/106 data tests PASS; Doctrine Reference v0.1 FAIL; Sweep/Acceptance v0.1 overall FAIL with Acceptance+Retest promising but not C2 robust; forward microstructure treatment v0.1 preregistered before outcomes; 221 valid snapshots and 30d/10k gate still locked; Liquid Paper enabled; Quiver paid data blocked; canonical JForex seals audit PASS for 2026-09-30..10-02 but authenticated 2026-10-03 export is missing and collection fails closed.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/EXECUTION_STATUS_2026-10-04.md`
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_FORWARD_MICROSTRUCTURE_ACCEPTANCE_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/MICROSTRUCTURE_READINESS_LATEST.json`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_AUDIT_LATEST.json`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_STATUS_LATEST.json`

**Verification:**
- 28/28 GTGLab2 engine tests PASS
- 106/106 core data regression tests PASS
- Historical Holdout read=false
- Pristine Forward outcomes decoded=false
- Microstructure outcome linkage remains locked
- Liquid paper mode enabled


## 2026-10-04T10:18:00.847075Z — GTGLAB2-0011 — parallel_branch_reconciled

**Action:** Reconciled the parallel GTGLab2 foundation branch with the executed research/results branch without force-push.

**Reason:** The remote branch advanced independently with additional setup-policy, metrics, context and execution tests while local work added experiments, risk/shadow infrastructure and forward protocols.

**Result:** Unified engine preserves both APIs and modules; 51/51 engine tests PASS; 106/106 data tests PASS after Windows-path-only test portability fix; Sweep/Acceptance v0.1 rerun results match the recorded run exactly.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/engine/execution.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/inventory.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/mtf_context.py`
- `indicators/gtg-strategy-lab/gtglab2/EXECUTION_STATUS_2026-10-04.md`

**Verification:**
- 51/51 unified engine tests PASS
- 106/106 data regression tests PASS
- Sweep/Acceptance discovery, episodes, pairing and result objects exactly equal after merge
- No force push used
- Historical Holdout remained sealed

## 2026-10-04T10:22:56.892127Z — GTGLAB2-0012 — unified_branch_verified

**Action:** Unified GTGLab2 branch synchronized locally and remotely after parallel-track reconciliation.

**Reason:** Close the execution checkpoint with a reproducible branch head and final device-local regression results.

**Result:** Merge commit 6ff6774 contains both histories; GitHub push succeeded fast-forward; main worktree fast-forwarded to the same head; 51/51 engine and 106/106 data tests PASS.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/EVENTS.jsonl`
- `indicators/gtg-strategy-lab/gtglab2/WORKLOG.md`

**Verification:**
- GitHub research/gtglab2 included 6ff6774
- main device worktree HEAD=6ff6774 before this checkpoint commit
- 51/51 engine tests PASS on main worktree
- 106/106 data tests PASS on main worktree
- Historical Holdout remained sealed
- Pristine Forward OOS remained undecoded

**Commit:** `6ff6774`

## 2026-10-04T10:26:44.849880Z — GTGLAB2-0013 — forward_gatekeeper_installed

**Action:** Installed executable fail-closed forward research gatekeeper and candidate registry after reconciling parallel GTGLab2 branches.

**Reason:** Prevent outcome linkage, Holdout access, or production promotion from being unlocked by narrative/manual decisions before registered gates are satisfied.

**Result:** Unified engine 51/51 PASS; gatekeeper 4/4 PASS; data regression 106/106 PASS. Real gate returns BLOCK with 235 valid snapshots, 30d and 10k gates unmet, and JForex 2026-10-03 freshness missing.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/CANDIDATE_REGISTRY.json`
- `indicators/gtg-strategy-lab/gtglab2/tools/forward_gatekeeper.py`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_GATE_STATUS_LATEST.json`

**Verification:**
- 51/51 unified engine tests PASS
- 4/4 forward gatekeeper tests PASS
- 106/106 data regression tests PASS
- Real gate action=BLOCK
- Historical Holdout remains disallowed


## 2026-10-04T10:31:18.052479Z — GTGLAB2-0014 — scheduled_gate_audit_enabled

**Action:** Enabled and verified a 3-hour GTGLab2 metadata-only research gate audit task.

**Reason:** Keep forward readiness and canonical JForex freshness continuously checked without decoding outcomes or manually bypassing gates.

**Result:** Task GTGLab2 Research Gate Audit created; Task Scheduler LastResult=0; cadence 3h; IgnoreNew; battery allowed; 15m execution limit; latest logged cycle micro=0 audit=0 seal=3 gate=3.

**Files:**
- `scripts/gtglab2_gate_audit.ps1`
- `indicators/gtg-strategy-lab/gtglab2/FORWARD_SEAL_STATUS_LATEST.json`

**Verification:**
- Scheduled task execution LastResult=0
- Gate remains fail-closed while registered conditions are unmet


## 2026-10-04T10:33:03.764902Z — GTGLAB2-0015 — jforex_ui_automation_boundary

**Action:** Confirmed JForex desktop exporter cannot be safely auto-started through Windows UI Automation from this session.

**Reason:** Attempt to close the 2026-10-03 canonical forward freshness blocker without blind interaction or public-datafeed substitution.

**Result:** GtgForwardExport.jfx exists; JForex desktop is authenticated/running; Windows UI Automation exposed zero descendant controls; blind coordinate/keyboard automation was rejected; blocker remains open pending supported Strategies-panel start or authenticated SDK path.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/BLOCKERS.md`

**Verification:**
- No live order placed
- No protected forward outcome decoded
- No public-datafeed substitution used


## 2026-10-04T11:05:51.248124Z — GTGLAB2-0016 — ultra_plan_execution_checkpoint

**Action:** Frozen deterministic Swing/Scalper execution contracts, preregistered episode/purged evaluation, repaired JForex seal lifecycle and scheduled gate ordering, restored scheduled collector scripts under sparse checkout, and activated append-only Liquid forward-context capture.

**Reason:** Continue GTGLab2 Ultra Plan without opening protected outcomes; close all executable infrastructure gaps before the 30-day/10k forward gate.

**Result:** JForex seal/audit PASS through 2026-10-03; microstructure scheduled task recovered to LastResult=0 and collection resumed; canonical forward freshness PASS; engine 66/66 PASS; tools 7/7 PASS; data regression 107/107 PASS; forward gate remains BLOCK only for 30-day and 10,000-snapshot conditions.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_EXECUTION_CONTRACTS_V10.md`
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_EVALUATION_V10.md`
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_LIQUID_FORWARD_CONTEXT_V10.md`
- `indicators/gtg-strategy-lab/data/seal_jforex_forward.py`
- `scripts/gtglab2_gate_audit.ps1`

**Verification:**
- 66/66 engine tests PASS
- 7/7 GTGLab2 tools tests PASS
- 107/107 data regression tests PASS
- FORWARD_SEAL_STATUS=PASS through 2026-10-03
- FORWARD_SEAL_AUDIT=PASS 4/4 days
- Microstructure task LastResult=0 after sparse-checkout recovery
- Historical Holdout read=false; Pristine OOS decoded=false


## 2026-10-04T11:07:50.013577Z — GTGLAB2-0017 — evaluation_metrics_frozen

**Action:** Validated and froze source-family ablation helpers and episode-level execution metrics.

**Reason:** Complete the preregistered evaluation layer before future microstructure outcomes are unlocked.

**Result:** 72/72 unified engine tests PASS; source-family vote provenance, leave-one-source-out alignment, paired episode comparison, MAE/MFE/risk-use and invalidation-time metrics verified.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/engine/forward_microstructure_gate.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/metrics.py`
- `indicators/gtg-strategy-lab/gtglab2/engine/test_phase8_metrics_ablation.py`

**Verification:**
- 72/72 engine tests PASS


## 2026-10-04T12:18:17.001531Z — GTGLAB2-0018 — roadmap_decision

**Action:** GTGLab2 execution order changed to two explicit stages: historical 2018-2026 first, live/forward second.

**Reason:** User requested a simpler sequential project structure.

**Result:** Stage 1 historical research must complete before any live strategy run. Forward collection continues blind in parallel but is not evaluated or traded.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/DECISIONS.md`

**Verification:**
- Historical Holdout remains sealed
- Live strategy execution remains blocked until Stage 1 completion


## 2026-10-04T12:38:00.738052Z — GTGLAB2-0019 — historical_clean_validation_complete

**Action:** Created immutable JForex historical clean snapshot, reproduced Train exactly, and completed one preregistered Validation run while keeping Historical Holdout sealed.

**Reason:** Separate clean historical evaluation from the continuing development path as requested.

**Result:** 2672 files/hash PASS; Train strategy rows 6252 exactly equal to prior run; Validation prefix parity PASS; BASE C1 single -0.1473R; Acceptance+Context C1 single +0.7283R and C2 single +0.6906R (n=40); Rejection remains negative; Holdout read=false.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_HISTORICAL_CLEAN_STAGE1_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/historical-clean-stage1-v01/validation-v01/summary.json`

**Verification:**
- Historical Holdout read=false
- Pristine OOS decoded=false
- Train prefix parity PASS


## 2026-10-04T14:08:45.927660Z — GTGLAB2-0020 — historical_open_batch_evaluation

**Action:** Evaluated current GTGLab2 Acceptance/Retest and Rejection paths across the open JForex/Python historical corpus with C2 costs.

**Reason:** User requested full historical testing instead of TradingView Deep Backtesting subscription.

**Result:** Acceptance+Context SINGLE: n=271, +0.05696R/trade, +15.44R total, PF=1.058; Train negative, Validation strong. STAGED roughly flat/negative. Rejection path negative. Historical Holdout remains sealed.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_HISTORICAL_OPEN_BATCH_2026-10-04.md`

**Verification:**
- Historical Holdout read=false
- Pristine OOS decoded=false


## 2026-10-04T14:20:41.694807Z — GTGLAB2-0021 — pine_v02_exact_logic_validation

**Action:** Emulated exact user-supplied Pine v0.2 logic across full clean Validation window on JForex BID OHLC.

**Reason:** Clarified request: test this exact Pine code, not the broader Python strategy.

**Result:** 40 trades: 31 long, 9 short; 16 wins, 24 losses; win rate 40%; total +33.246R; mean +0.831R; PF 2.3425. Holdout not read.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V02_EXACT_LOGIC_VALIDATION_2026-10-04.md`

**Verification:**
- Historical Holdout read=false


## 2026-10-04T14:30:27.709806Z — GTGLAB2-0022 — pine_v02_extended_historical_test

**Action:** Applied exact supplied Pine v0.2 logic from 2025-01-01 through available clean-data T_FREEZE 2026-09-30T13:40:49Z.

**Reason:** User explicitly requested 2025-01-01 to 2026-10-01 testing.

**Result:** 57 trades overall, +8.1775R, PF 1.1998, max DD -19.2154R. Previously sealed Holdout subset: 51 trades, +2.9682R, PF 1.0751. Historical Holdout is now consumed/opened; Pristine Forward OOS remains blind.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V02_EXTENDED_2025_2026_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T14:46:23.596065Z — GTGLAB2-0023 — pine_v02_all_trades_analysis

**Action:** Analyzed all 57 Pine v0.2 extended-test trades, including path MFE/MAE, side, MTF strength, exit type, time clustering, streaks, and outlier concentration.

**Reason:** User requested analysis of all trades.

**Result:** Key findings: LONG +13.30R vs SHORT -5.12R; abs(MTF)=3 +19.77R vs abs(MTF)=1 -11.59R; all 16 winners exited at timeout and all 41 losses at 2-closes-inside; 11 losers first reached +1R or more; max loss streak 13; top 2 winners are necessary to keep overall net positive.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V02_ALL_TRADES_ANALYSIS_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T15:09:48.059541Z — GTGLAB2-0024 — pine_v03_strict_mtf_test

**Action:** Completed Pine v0.3 Strict MTF test on 2025-01-01 through clean-data T_FREEZE.

**Reason:** User asked to modify Pine code first, then apply it.

**Result:** v0.3 Strict MTF: 28 trades, +19.7697R, PF 2.1842, max DD -5.2546R. Two risk-overlay variants were tested and rejected as inferior.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V03_STRICT_MTF_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T15:17:37.418304Z — GTGLAB2-0025 — pine_v03_2023_2025_test

**Action:** Applied Pine v0.3 Strict MTF unchanged across full calendar years 2023-2025.

**Reason:** User requested v3 on 2023 to 2025 data.

**Result:** 64 trades, +25.7705R overall, PF 1.4741, max DD -25.2919R. 2023 failed badly (-17.7928R, PF 0.3304); 2024 +31.8398R PF 2.4825; 2025 +11.7236R PF 2.8584.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V03_2023_2025_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T15:33:14.873985Z — GTGLAB2-0026 — pine_v04_regime_study

**Action:** Built and tested causal v0.4 regime filter from 2023-vs-2024 structural differences.

**Reason:** User asked to identify why 2023 failed and build a real market-state filter.

**Result:** v0.4 requires strict MTF, directional EMA50/200 gap >=1.5 ATR, and ATR14 >= 120H ATR median. 2023-2025: 28 trades, +33.3225R, PF 3.0585, max DD -5.805R. 2023 improved from -17.79R to +6.17R. Earlier 2018-2019 remain weak.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V04_REGIME_STUDY_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T16:04:48.327221Z — GTGLAB2-0027 — pine_v052_buy_low_sell_higher

**Action:** Built causal long-only Buy Low / Sell Higher v0.5.2 and completed full historical development diagnostic.

**Reason:** User directed GTGLab to focus on buying low and selling higher rather than macro modeling.

**Result:** v0.5.2: 139 trades, +35.4243R, PF 1.4883, max DD -9.6099R. Early segment 2018-2023 +23.4855R PF 1.4348; later 2024-2026 +11.9387R PF 1.6444. Negative years remain 2020, 2023, 2026.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V052_BUY_LOW_SELL_HIGHER_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T16:07:14.816445Z — GTGLAB2-0028 — pine_v052_buy_low_sell_high_final

**Action:** Finalized and tested GTGLab2 Buy Low / Sell High v0.5.2 exact Pine-logic candidate.

**Reason:** User requested a strategy that buys rejected low prices and sells higher rather than chasing breakouts.

**Result:** 131 trades from 2018-03-01 through 2026-09-30; +34.9694R; PF 1.5141; max DD -7.6570R; win rate 41.98%. Development split positive on both 2018-2023 and 2024-2026.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_PINE_V052_BUY_LOW_SELL_HIGH_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T16:25:37.902342Z — GTGLAB2-0029 — bottom_atlas_v01

**Action:** Built the GTGLab2 historical Bottom Atlas and separated real swing bottoms, scalper bottoms, and false lows.

**Reason:** Returned project to core objective: understand repeated gold bottom-to-rise behavior before defining strategy rules.

**Result:** 6,426 bottom candidates; 2,588 GOOD 48H vs 3,714 FALSE. Strongest pre-bottom differences were lower-wick rejection, stronger close recovery, and short-term downside deceleration. 1,361 major 2-ATR swing bottoms and 566 scalper-bottom population identified.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_BOTTOM_ATLAS_V01_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T19:38:37.639757Z — GTGLAB2-0030 — bottom_detector_v01

**Action:** Completed causal Bottom Detector v0.1 on Bottom Atlas resolved candidates.

**Reason:** Continue GTGLab2 from raw bottom mapping to a causal bottom-quality score.

**Result:** Logistic AUC train 0.640, validation 0.623, pseudo-test 0.611. Frozen high-confidence threshold produced 59.5% GOOD rate on 2025-2026 vs 40.15% baseline.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_BOTTOM_DETECTOR_V01_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T19:43:25.026958Z — GTGLAB2-0031 — swing_scalper_detectors_v01

**Action:** Completed separate causal Swing and Scalper bottom detectors.

**Reason:** Continue GTGLab2 by separating large-swing bottoms from fast-bounce bottoms.

**Result:** Swing pseudo-test AUC 0.594; highest-confidence pseudo-test precision 60% vs 33.2% baseline but sparse. Scalper pseudo-test AUC 0.714; top-quarter precision 84.8% vs 59.8% baseline.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_SWING_SCALPER_DETECTORS_V01_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T19:48:32.168758Z — GTGLAB2-0032 — detector_execution_bridge_v01

**Action:** Tested causal next-open execution of frozen Swing/Scalper detector thresholds.

**Reason:** Check whether classification edge survives actual next-open trade mechanics.

**Result:** Next-open execution failed expectancy. Swing primary pseudo-test -19.79R PF 0.839 despite higher win rate; Scalper primary -8.90R PF 0.800 despite 77.5% wins. Root cause: rejection confirmation consumes much of reward before entry.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_DETECTOR_EXECUTION_BRIDGE_V01_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T20:04:54.379773Z — GTGLAB2-0033 — low_zone_limit_entry_v01

**Action:** Completed frozen low-zone limit entry test after detector timing failure.

**Reason:** Test whether waiting for a retest near the detected bottom restores executable expectancy.

**Result:** Grid selected on 2018-2024, then frozen. 2025-2026 failed: Swing 167 fills -23.626R PF 0.789; Scalper 53 fills -11.409R PF 0.692. Reject tested limit-entry bridge.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_LOW_ZONE_LIMIT_ENTRY_V01_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T20:37:02.061794Z — GTGLAB2-0034 — m15_entry_resolution_v01

**Action:** Tested GTGLab2 bottom detection and executable next-bar entry on exact M15 bars aggregated from clean M1.

**Reason:** User proposed changing execution timeframe from H1 to M15.

**Result:** M15 detector quality held: Scalper AUC 0.701 pseudo-test, Swing-entry AUC 0.621. But next-M15-open filtered execution remained negative because confirmation consumed reward: Scalper -21.77R PF 0.903, Swing-entry -9.50R PF 0.979 on 2025-2026.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_M15_ENTRY_RESOLUTION_V01_2026-10-04.md`

**Verification:**
- Pristine Forward OOS read=false


## 2026-10-04T21:28:39.082911Z — GTGLAB2-0035 — low_zone_limit_entry_v01

**Action:** Completed frozen low-zone limit-entry diagnostic on 2025-2026 after grid selection on 2018-2024.

**Reason:** Test whether waiting for a low-zone retest solves the late next-open entry problem.

**Result:** Both frozen limit entries failed on 2025-2026. Swing: 167 trades, -23.626R, PF 0.789. Scalper: 53 trades, -11.409R, PF 0.692. Deep retests are adverse selection; temporal resolution is now the bottleneck.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_LOW_ZONE_LIMIT_ENTRY_V01_2026-10-05.md`

**Verification:**
- Pristine Forward OOS read=false



## 2026-10-04T21:44:35.1152745Z — GTGLAB2-0036 — linked_h1_m15_m5_entry_v01

**Action:** Added M5 as a causal execution layer linked to completed M15 and H1 context.

**Reason:** User requested linking the 5-minute timeframe after H1 next-open and deep-limit execution showed timing/adverse-selection failures.

**Result:** M5 substantially improved available entry R:R versus M15, but frozen 2025-2026 expectancy remained negative for filtered engines. Scalper: 491 trades, -18.654R, PF 0.918, avg R:R 0.839. Swing: 339 trades, -3.289R, PF 0.986, avg R:R 2.390. 2025 was positive while 2026 failed sharply, so no execution candidate is promoted.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_LINKED_H1_M15_M5_ENTRY_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/linked-h1-m15-m5-entry-v01/summary.json`

**Verification:**
- Pristine Forward OOS read=false
- No year feature
- M15/H1 context uses only bars closed by the M5 signal close

## 2026-10-04T21:53:57.2136827Z — GTGLAB2-0037 — m5_transition_state_machine_v01

**Action:** Tested three preregistered M5 causal transition state machines linked to H1/M15 context.

**Reason:** After M5 improved entry timing, test the actual reversal sequence instead of buying every fresh low or waiting for full confirmation.

**Result:** Scalper selected HIGHER_LOW_BREAK and failed frozen 2025-2026: -17.771R, PF 0.927. Swing selected HIGH_RECLAIM and finished nearly flat overall at -1.371R, PF 0.995, but was unstable: +38.252R in 2025 and -39.624R in 2026. Diagnostic-only HIGHER_LOW_BREAK Swing was +9.973R PF 1.034 on pseudo-test but cannot replace the preregistered winner after seeing results.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_M5_TRANSITION_STATE_MACHINE_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/m5-transition-state-machine-v01/summary.json`

**Verification:**
- Pristine Forward OOS read=false
- No year feature
- Rule selection used 2018-2024 only
- No post-pseudo-test winner switching


## 2026-10-04T22:02:33.4306459Z — GTGLAB2-0038 — market_state_management_v01

**Action:** Built and tested a causal 6-state H1/M15/M5 Market State Engine, then applied state gating and three preregistered trade-management policies to frozen transition entries.

**Reason:** User identified that markets require state reading, situation understanding, and management rather than fixed rules alone.

**Result:** State conditioning exposed the main instability. Swing State 0 (strong directional H1 sell wave) was only marginally positive in Train/Validation and later negative on consumed 2025-2026 (-12.438R, PF 0.926), while State 4 (range recovery) remained positive (+9.220R, PF 1.220) and State 5 was mildly positive. Overall frozen state gate remained near-flat/negative on consumed history, so no promotion. FIXED management ranked above early protection policies.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_MARKET_STATE_MANAGEMENT_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/market-state-management-v01/summary.json`

**Verification:**
- Pristine Forward OOS read=false
- State clustering fit on 2018-2022 only
- No future/outcome/year feature used in state creation
- 2025-2026 explicitly treated as consumed diagnostic history


## 2026-10-05 — GTGLAB2-0039 — market_state_yearly_audit_v01

**Action:** Audited the frozen Market State Engine + FIXED management separately for every calendar year in the full historical period.

**Result:** Scalper produced +37.364R overall but only 4 positive years out of 9. Swing produced +58.312R overall with 6 positive years, but 2021 (-25.677R), 2022 (-11.376R), and 2026 (-41.927R) failed. The most important diagnostic is that all accepted Swing states were positive in 2025 and all were negative in 2026, indicating a higher-order regime change not captured by the current static state representation.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_MARKET_STATE_YEARLY_AUDIT_V01_2026-10-05.md`

**Verification:**
- Frozen parameters unchanged
- Pristine Forward OOS read=false
- 2018 partial from March 1
- 2026 partial through September 30


## 2026-10-04T22:26:35.4003526Z — GTGLAB2-0040 — state_evolution_v01

**Action:** Built causal State Evolution features over M5/M15 and 24H-120H context, trained fixed logistic gates on 2018-2022, froze thresholds from Train distribution, validated 2023-2024, and reported consumed 2025-2026 without retuning.

**Result:** Scalper improved materially and nearly neutralized 2026 failure. Swing improved historical Train/Validation but still failed 2025-2026, especially 2026. Diagnostics show concept drift: model confidence did not fall while actual success rate did. 2026 had materially more persistent multi-day downside context, but not simple OOD extremes.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_STATE_EVOLUTION_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/state-evolution-v01/summary.json`

**Verification:**
- Pristine Forward OOS read=false
- No future/year feature in model
- Threshold fixed from Train probabilities only
- No hyperparameter search
- 2025-2026 consumed diagnostic only


## 2026-10-05 — GTGLAB2-0040 — state_evolution_v01

**Action:** Tested causal state evolution rather than static market-state labels using H1/M15/M5 acceleration, efficiency changes, 24H/72H/120H regime structure, state-transition frequency, and anchor-to-signal recovery behavior.

**Result:** Scalper showed meaningful discrimination (Validation AUC .619) and nearly neutralized the consumed 2026 loss, but its Validation execution was only +0.594R PF 1.006 and worse than the prior static baseline. Swing Validation AUC was only .554 and consumed 2025-2026 deteriorated to -28.541R PF .832. The Swing failure indicates that local state evolution is not enough to model the higher-order regime shift.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_STATE_EVOLUTION_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/state-evolution-v01/summary.json`

**Verification:**
- Threshold frozen from Train distribution only
- No hyperparameter search
- 2025-2026 diagnostic only
- Pristine Forward OOS read=false

## 2026-10-05 — GTGLAB2-0040 — state_evolution_v01

**Action:** Tested causal state evolution using H1/M15/M5 acceleration, efficiency changes, higher-order 24H/72H/120H regime structure, state-transition frequency, and anchor-to-signal recovery behavior.

**Result:** Scalper showed meaningful discrimination (Validation AUC .619) and nearly neutralized the consumed 2026 loss, but Validation execution was only +0.594R PF 1.006 and worse than the prior static baseline. Swing Validation AUC was .554 and consumed 2025-2026 deteriorated to -28.541R PF .832. The Swing failure indicates local state evolution is not enough to model the higher-order regime shift.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_STATE_EVOLUTION_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/state-evolution-v01/summary.json`

**Verification:**
- Threshold frozen from Train distribution only
- No hyperparameter search
- 2025-2026 diagnostic only
- Pristine Forward OOS read=false


## 2026-10-05 — GTGLAB2-0041 — state_evolution_walkforward_v02

**Action:** Tested annual adaptive walk-forward State Evolution with a rolling 3-year training window and frozen model/threshold architecture.

**Result:** Scalper remained meaningfully classifiable (+32.605R aggregate, PF 1.117), but Swing failed (-35.838R, PF 0.940). The 2026 Swing model trained only on 2023-2025 still had AUC ~0.503 and lost -27.905R. Quarter diagnostics show the major regime break occurred rapidly in Q2 2026.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_STATE_EVOLUTION_WALKFORWARD_V02_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/state-evolution-walkforward-v02/summary.json`

**Verification:**
- causal annual training only on prior years
- same features/model/threshold rule
- Pristine Forward OOS read=false


## 2026-10-05 — GTGLAB2-0042 — state_evolution_quarterly_v03

**Action:** Tested quarterly adaptive State Evolution using only the previous four completed quarters.

**Result:** Scalper adapted reasonably but still suffered Q2 2026 before recovering in Q3. Swing failed all three 2026 quarters. Q3 remained strongly negative even after training on Q2 2026, demonstrating that faster retraining alone is insufficient.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_STATE_EVOLUTION_QUARTERLY_V03_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/state-evolution-quarterly-v03/summary.json`

**Verification:**
- previous 4 completed quarters only
- no same-quarter fitting
- same frozen features/model/threshold rule
- Pristine Forward OOS read=false


## 2026-10-05 — GTGLAB2-0043 — regime_health_riskoff_v04

**Action:** Added a causal live risk-off layer driven by the most recent 20 closed shadow trades, while keeping the underlying quarterly adaptive engine running continuously in shadow mode.

**Result:** The layer materially protected Swing in 2026: -28.559R shadow became -6.822R live, with first risk-off on 2026-03-17 and zero live Swing trades in Q3. Across the full Swing period it avoided a net -12.570R of shadow losses, but the live aggregate remained negative, proving that management protects capital but cannot repair a weak prediction engine.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_REGIME_HEALTH_RISKOFF_V04_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/regime-health-riskoff-v04/summary.json`

**Verification:**
- trailing window uses only closed shadow trades
- no future outcomes at decision time
- fixed 20-trade / -5R / PF0.80 rule
- Pristine Forward OOS read=false

## 2026-10-05 — GTGLAB2-0044 — wave_regime_control_transfer_v01

**Action:** Split GTGLab2 state understanding into two specialized readers: a local Control Transfer model for Scalper and a Higher-Order Wave/Regime model for Swing.

**Result:** Scalper Control Transfer produced Validation AUC .629 and +3.495R PF 1.038, improving over State Evolution v0.1 but not over the simpler static-state baseline. Swing Wave/Regime produced Validation AUC .509, showing that a slow higher-order regime should not be used as another per-event trade predictor. Its consumed-history filtering reduced 2026 damage but cannot be used for tuning or promotion.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_WAVE_REGIME_CONTROL_TRANSFER_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/wave-regime-control-transfer-v01/summary.json`

**Verification:**
- Frozen entry triggers/states/management unchanged
- Train 2018-2022
- Validation 2023-2024
- 2025-2026 diagnostic only
- Pristine Forward OOS read=false

## 2026-10-05 — GTGLAB2-0045 — integrated_decision_architecture_v01

**Action:** Integrated the selected GTGLab2 layers into one causal decision architecture and applied it over the full historical period.

**Architecture:** Swing persistent Wave Permission with Train-only hysteresis; frozen static-state eligibility; M5 HIGH_RECLAIM/HIGHER_LOW_BREAK execution; Scalper Control Transfer gate; trailing-20 closed-shadow Regime Health brake.

**Result:** Combined live 1,991 trades, +108.114R, PF 1.136, max DD -24.690R. All three broad chronological segments remained positive around PF 1.13. Versus the prior static architecture, R increased 13%, drawdown magnitude fell 63.8%, and trade count fell 61.9%. 2026 loss was reduced 68.3% but remained -16.505R.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/RESULT_INTEGRATED_DECISION_ARCHITECTURE_V01_2026-10-05.md`
- `indicators/gtg-strategy-lab/gtglab2/runs/integrated-decision-architecture-v01/summary.json`

**Verification:**
- Wave hysteresis thresholds frozen from 2018-2022 Train scores only
- Health uses only trades closed before next entry
- No 2025-2026 retuning
- Pristine Forward OOS read=false

## 2026-10-05 — GTGLAB2-0046 — movement_expansion_index_v01

**Action:** Converted the user's 2025->2026 gradual gold expansion hypothesis into a causal Movement Expansion Index using percent-normalized movement scale, volatility-of-volatility, expansion velocity, and acceleration. Applied the frozen index above Integrated Decision Architecture v0.1.

**Result:** Expansion rose progressively from mean index +0.310 in 2024 to +0.668 in 2025 and +1.470 in 2026. High/Extreme share rose 20.1% -> 29.1% -> 54.6%, while 2026 spent 85.8% of contexts in High/Extreme/Cooldown. The frozen expansion-aware risk map cut 2026 combined loss roughly in half (-16.505R -> -8.109R), and Swing 2026 from -13.012R to -5.315R, but full-period R fell to +87.071R because the map was deliberately conservative.

**Files:**
- `indicators/gtg-strategy-lab/gtglab2/PROTOCOL_MOVEMENT_EXPANSION_INDEX_V01.md`
- `indicators/gtg-strategy-lab/gtglab2/RESULT_MOVEMENT_EXPANSION_INDEX_V01_2026-10-05.md`

**Verification:**
- no year identity feature
- train-only 2018-2022 normalization and thresholds
- frozen risk map before expansion-aware PnL
- 2025-2026 not retuned
- Pristine Forward OOS read=false

## 2026-10-05 — GTGLAB2-0047 — measurement_execution_audit_v01

**Reference:** clean worktree branch `research/gtglab2-measurement-audit-v01`, base `b9f645b`.

**Protocol:** `492ad7a`

**Implementation:** `bd6b2b6`

**Action:** Audited and corrected measurement/execution without changing frozen triggers, state sets, stop/target multipliers, or Health thresholds. Added true Bid/Ask aggregation, ASK long entry, BID exits, true completed H1 structural features, full decision-time event streams independent of label availability, outcome-time split boundaries, normalized Control Transfer raw distances, M1 same-bar ordering resolution, and chronological M5 mark-to-market portfolio accounting.

**Key result:** Old live signal set repriced for quoted spread fell from +108.114R to +5.513R. Corrected refit architecture produced +46.036R PF 1.064. Scalper became -23.432R PF .880; Swing remained +69.468R PF 1.132. 2026 remained negative at -9.999R.

**Verification:**
- 607,272 M5 / 201,591 M15 / 49,699 H1, same bar counts as reference
- All 4,731 Scalper and 5,107 Swing decision-time eligible events scored
- Train/Validation label boundary violations: 0
- combined trade PnL exactly reconciles to final realized portfolio PnL
- portfolio M5 MTM DD: -27.443R
- M5 both-bar cases: 13; 9 resolved by M1, 4 remained same-M1 ambiguous and used conservative STOP-first
- Pristine Forward OOS read=false

**Decision:** Measurement audit passed. Do not promote. Do not build Productive/Destructive Expansion classifier yet. Execute Experiment 2 next.

## 2026-10-05 — Research decision after GTGLAB2-0047

**Decision:** Scalper PARK. Swing RETAIN FOR RESEARCH. 2026 cause unresolved. Productive/Destructive Expansion deferred. Pristine OOS sealed.

**Experiment 2 framing:** use corrected Swing Shadow before Health. First control pre-entry Entry Geometry and Opportunity Composition. Only then test Conditional Path Change as the outcome. Include 2023-2024 as an additional consumed historical reference so the experiment is not reduced to a 2025-vs-2026 narrative.

## 2026-10-05 — GTGLAB2-0049 — swing_opportunity_path_diagnostic_v01 preregistration

**Protocol commit:** `5ad2a38`

**Scope frozen before results:** Corrected Swing only. Primary sample is Shadow before Health; supporting sample is all state-eligible decision events before Permission/overlap. Primary comparison is 2025 vs Jan-Sep 2026 with mandatory Jan-Sep 2025 sensitivity and 2023-2024 consumed references.

**Method:** Sequential raw -> geometry matching -> geometry+composition matching -> conditional post-entry path. Matching variables are pre-entry only. Common support, balance, 0.05R economic margin, and 5-trading-day block bootstrap are preregistered.

**No execution yet. No model added. Pristine OOS remains unread.**

## 2026-10-05 — GTGLAB2-0049 — Swing Opportunity Composition vs Conditional Path v0.1

**Protocol:** `5ad2a38`

**Implementation lineage:** `3885e4c` -> `ebd5fed` -> `7d5cea0` -> `041c621`.

**Primary result:** INCONCLUSIVE.

Primary 2025 vs Jan-Sep 2026 Swing Shadow:
- Raw: 122 vs 105, delta -0.2609R, CI [-0.5610,-0.0038].
- Geometry: 82 pairs, 78.1% target coverage, ADEQUATE support but FAILED balance (max |SMD| 1.022), delta -0.4295R.
- Geometry+Composition: 18 pairs, 17.1% target coverage, INSUFFICIENT support and FAILED balance, delta -0.8324R with wide CI crossing both economically material signs.

**Interpretation:** We did not find enough balanced comparable observations under the frozen design to estimate the conditional performance difference confidently. This does not distinguish genuine distributional change from finite sample size / strict multidimensional matching.

**Supporting diagnostics:** pre-Permission events also show negative 2026 raw outcomes; matched support/balance remains inadequate. Path metrics are directionally worse in the 18-pair subset but are non-decisive.

**Acceleration verification:** primary pair files and stage summary reproduced exact pre-acceleration SHA256 hashes. 1:1 no-replacement pairs have zero donor/target reuse.

**Decision:** Do not relax calipers post hoc. Do not build Productive/Destructive Expansion model yet. Swing remains research-only. Pristine Forward OOS read=false.

## 2026-10-05 — GTGLAB2-0050 — common_support_failure_audit_v01

**Protocol:** `ccd9951`

**Implementation:** `f718d16`, technical column-name fix `c4dd13f`.

**Base:** Experiment 2 final `8b50a67`.

**Method:** Outcome-blind support audit. Reused Experiment 2 geometry/composition constraints unchanged. Measured feasibility support before donor allocation and frozen greedy 1:1 no-replacement support. Audited canonical sequence G -> +State -> +Session -> +Coherence -> +Expansion Level -> +Persistence. Evaluated all 120 composition-constraint orders for Shapley-style support-loss attribution and ran leave-one-constraint-out diagnostics.

**Reconciliation:** primary 82 Geometry / 18 Full; seasonal 60 / 12; historical 85 / 2 — all exact.

**Primary result:** feasibility 97.1% at Geometry -> 28.6% Full; greedy 78.1% -> 17.1%. Classification = DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE.

**Primary feasibility shares:** Session 38.0%, Coherence 22.9%, State 21.3%, Persistence 14.4%, Expansion Level 3.4%.

**Supporting all-event sample:** Full feasibility 65.1%, greedy 26.4%, indicating large donor-allocation pressure in addition to multidimensional support erosion.

**Decision:** do not loosen Experiment 2 calipers post hoc; do not build Productive/Destructive model yet. Next method, if pursued, should be a new preregistered lower-dimensional / overlap-weighting representation designed outcome-blind. Pristine OOS read=false.

## 2026-10-05 — GTGLAB2-0050 — common_support_failure_audit_v01

**Protocol:** `ccd9951`

**Implementation:** `f718d16`, fix `c4dd13f`

**Base:** `8b50a67`

**Scope:** Outcome-blind support audit only. No PnL, labels, MAE/MFE, exit outcomes, Health outcomes, or post-entry path variables loaded or used.

**Reconciliation:** reproduced Experiment 2 exactly:
- primary 122 donor / 105 target
- Geometry 82 pairs
- Full 18 pairs
- seasonal 60 / 12
- historical 85 / 2

**Primary support curve:** feasibility 97.14% -> 93.33% -> 71.43% -> 40.95% -> 37.14% -> 28.57%; greedy coverage 78.10% -> 71.43% -> 48.57% -> 29.52% -> 26.67% -> 17.14%.

**Primary classification:** DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE.

**Order-robust feasibility attribution:** Session 37.99%, Coherence 22.94%, State 21.32%, Persistence 14.38%, Expansion Level 3.38%.

**Supporting events:** full feasibility 65.08% but greedy 26.45%, showing that larger sample improves feasible overlap while 1:1 donor competition remains severe.

**Decision:** Experiment 3 explains why Experiment 2 lacked support but does not identify the cause of 2026 PnL. Do not loosen Experiment 2. Do not build Productive/Destructive Expansion yet. Pristine OOS read=false.

## 2026-10-05 — GTGLAB2-0050 post-close verification — maximum-cardinality matching
- Computed maximum-cardinality bipartite matching on the exact frozen Geometry and Full compatibility networks; no edge/caliper changed.
- Primary Full: greedy 18 vs maximum 20.
- Seasonal Full: 12 vs 13.
- Historical Full: 2 vs 2.
- Supporting-event Full: 128 vs 134.
- Geometry-only greedy shortfall is larger, but Full-stage shortfall is small.
- Conclusion refinement: final Full-support collapse is dominated by sparse admissible overlap, not by greedy allocator inefficiency.
- No PnL/outcome used. Experiment 3 primary classification remains DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE.

## 2026-10-05 — GTGLAB2-0051 — overlap_population_contrast_v01

**Protocol:** `fc00c3d`

**Implementation:** `33978be`; technical event-column fix `f7ec325`; bootstrap performance-only refactor `1ffd813`.

**Base:** `8c637d0`.

**Primary:** corrected Swing Shadow before Health, 2025 full vs Jan-Sep 2026.

**Model:** one frozen unpenalized logistic main-effects propensity model using the same Experiment 2 Geometry+Composition covariates. No search, no interactions, no trimming.

**Primary result:** Delta_OW = -0.5547R; 95% block-bootstrap CI [-1.1074,-0.1350].

**Quality gates:** convergence PASS; weighted mean balance PASS; bootstrap success PASS; ESS FAIL; temporal concentration FAIL.

**Representation:** 47.62% of 2026 target trades have e>=.90 and 37.14% have e>=.95; these observations are heavily downweighted. Primary donor ESS 30.61, target ESS 49.31. Oct-2025 alone carries 33.65% of donor overlap weight.

**Supporting events:** Delta_OW -0.5002R, CI [-0.9909,-0.0958], but donor ESS ratio 28.4% and donor max month share 26.45% fail frozen gates.

**Decision:** INCONCLUSIVE. Negative overlap signal is persistent but the empirically supported overlap population is too narrow/concentrated for the preregistered decisive claim. Cause of 2026 weakness remains unresolved. Productive/Destructive remains deferred. OOS read=false.

## 2026-10-05 — GTGLAB2-0052 — swing_loss_path_audit_v01

**Protocol:** `7b9d29b`

**Implementation:** `121f9fd`; bootstrap performance refactor `ef4974b`; timing summary `c981c42`; exit-time label correction `534bada`.

**Base:** `18e4865`.

**Population:** 1,177 corrected Swing Shadow trades before Health. All 1,177 have pre-exit M1 Bid paths; 1,176 have complete original 864-M5 horizon.

**Reconciliation:** Shadow total +79.6536R, matching Experiment 1 before Health. (The +69.468R number is the post-Health stream.)

**Loss anatomy:** 699 losses. NO_START 57.94%; STARTED_THEN_FADED 25.18%; STRONG_PROGRESS_FAILED 16.88%.

**Post-exit diagnostic:** among 697 eligible losing non-target exits, 77.19% later recovered entry, 68.87% later reached +0.5R, 57.39% later reached +1R, 37.88% later reached +2R, and 42.75% later reached the original target before the original 864-M5 horizon ended.

**Timing:** losing-trade median reclaim close loss 3 M5 bars; anchor recross 66 observed M1 minutes; later +1R median 1,284 observed minutes after exit; later original target median 1,622 observed minutes.

**Frozen decision:** Entry Initiation FAIL; Profit Retention FAIL; Horizon/Invalidation PASS. Final class HORIZON_INVALIDATION_CANDIDATE.

**Interpretation:** trade stop and idea invalidation may be different events for a material subset. Do not widen/remove stops. The only next hypothesis allowed is a fresh-confirmation one-reentry design with separately capped idea-level risk.

**OOS:** unread.

## 2026-10-05 — GTGLAB2-0053 precheck — fresh-reclaim reference-capture audit
- Outcome-blind identity/capture precheck completed before Experiment 6 protocol.
- Baseline stopped Swing Shadow ideas: 697; all 697 have complete original 864-M5 horizon for this precheck.
- Fresh setup definition used only for identity check: regenerated state-eligible HIGH_RECLAIM with episode_start_t >= first exit, signal after exit, and entry before the original idea horizon end.
- Unique fresh events falling in at least one stopped-idea window: 2,627.
- Unique fresh events that are Permission ON and executable at next Ask under frozen geometry: 1,394.
- Of those, 659 (47.27%) are already executed by the corrected baseline Shadow stream; 735 are not.
- 584 stopped ideas have at least one permission+Ask-executable fresh event; 460 have at least one such event not captured by baseline.
- No second-attempt PnL/outcome was evaluated.
- Implication: duplicate suppression is mandatory, but a nontrivial set of genuinely new candidate events remains to test.

## 2026-10-05 — GTGLAB2-0053 — one_shot_fresh_reclaim_reentry_v01

**Protocol:** `11b5d0d`; pre-result ledger clarification `6cc91d6`.

**Supplemental outcome-blind precheck:** `a0b05c1`. It found non-baseline fresh events in idea windows but did not model chronological occupancy or PnL.

**Implementation:** `41f16dd`; pre-result event-identity dtype verification fix `0158a53`.

**Base:** `0d71256`.

**Reference:** 1,177 corrected Swing Shadow trades, +79.6536R.

**Event reconciliation:** 5,187 raw HIGH_RECLAIM; 5,107 state-eligible; exact match to corrected 5,107 permission-stream events.

**Stopped ideas:** 697, all reconciled to terminal status.

**Policy result:** 0 incremental second attempts, 0 displaced reference trades. 513 ideas were naturally recaptured by an exact reference signal. 450 fully-valid assigned non-reference fresh events occurred while a trade was already open, so pyramiding=0 prevented a new entry.

**Candidate = Reference:** 1,177 trades, +79.6536R, PF 1.11417, MTM DD -30.6218R, nominal risk 1,177R.

**Classification:** INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE because n_second=0. The protocol's formal REFERENCE_ALREADY_CAPTURES threshold was not met because exact reference capture was 53.27% of 963 fully-valid assigned fresh events; the remaining 46.73% were blocked by open positions rather than executable while flat.

**Decision:** Reject adding an Idea Memory / Fresh-Reclaim re-entry layer under the current architecture. Any nonzero sample would require a new hypothesis changing concurrency, priority, delayed-entry behavior, or eligibility. OOS unread.
