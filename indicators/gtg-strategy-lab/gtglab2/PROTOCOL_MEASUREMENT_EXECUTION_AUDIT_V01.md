# PROTOCOL — Measurement & Execution Audit v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0047

## Reference
Clean audit worktree:
C:\Users\alk\gtg-lab-audit

Audit branch:
research/gtglab2-measurement-audit-v01

Reference HEAD at protocol creation:
b9f645b6781021b923430710afd9881d25a9d009

Primary historical architecture reference:
3c21eee — Integrated Decision Architecture v0.1

Pristine Forward OOS:
MUST remain unread.

## Objective
Determine whether the currently reported GTGLab2 historical edge and the 2026 failure survive correction of measurement, execution, event-stream, and accounting defects.

This is NOT a strategy optimization experiment.

No trigger, state set, stop/target multiplier, Health threshold, model family, or post-result parameter may be changed to improve PnL.

The audit succeeds when each result is traceable and measured correctly, even if the historical edge disappears.

## Verified defects / contract problems before implementation

### D01 — Executable side / spread
Historical simulation functions use bid OHLC (bo/bh/bl/bc) for long entry and exit.
The source M1 schema contains both bid and ask:
bo,bh,bl,bc,ao,ah,al,ac.

Correction:
- long market entry at next eligible bar ASK open;
- stop/target/timeout liquidation evaluated on BID;
- spread is therefore included naturally;
- no invented commission or financing;
- additional slippage is reported only as a frozen sensitivity analysis.

### D02 — Combined drawdown ordering
Integrated combined metrics sort final trade PnL by signal_t even when Swing and Scalper can overlap.

Correction:
report separately:
1. realized equity ordered by exit_t;
2. M5 mark-to-market portfolio equity using open positions;
3. concurrent open-trade count / 1R risk exposure.

The old signal-ordered DD remains reference-only and is not called portfolio DD.

### D03 — Pseudo-H1 inside Wave
wave_regime_control_transfer_v01.py uses every 12th M5 row as an hourly observation and uses that M5 high/low/close.

Correction:
construct true completed H1 bars and align them causally to the M5 decision time.
Structural H1 features must use completed H1 OHLC.

### D04 — Observation-count time semantics
Several 24H/72H/120H/240H constructs are actually counts of completed trading observations.

Frozen audit decision:
use MARKET / TRADING OBSERVATION TIME, not wall-clock time, to preserve the original research semantics:
- 24 H1 means 24 completed H1 bars;
- 72 H1 means 72 completed H1 bars;
- 144 M5 timeout means 144 completed M5 bars;
- 864 M5 timeout means 864 completed M5 bars.

Reports must stop calling these wall-clock hours without qualification.

### D05 — Event stream depends on future label availability
Wave/Control fit_and_run filters feature rows to finite independent_pnl_r before saving/scoring, then Integrated permission consumes the resulting stream.

Correction:
separate:
A. decision-time event stream;
B. execution-time order validity;
C. label availability for model fitting/evaluation.

All decision-time eligible events receive scores.
Unlabeled/censored events remain in permission history.
Model training/evaluation uses only causally resolved labels.

### D06 — Split-boundary outcome leakage
Historical splits are assigned from signal year while labels can resolve after the split boundary.

Correction:
- Train labels: signal before 2023-01-01 AND label_outcome_t < 2023-01-01.
- Validation labels: signal in 2023-2024 AND label_outcome_t < 2025-01-01.
- 2025-2026 diagnostic labels: signal >= 2025-01-01 and outcome resolved within available historical data.
- unresolved/censored rows can still be scored but not used as labels.

### D07 — Control Transfer raw-price features
half_return_improvement and half_downside_improvement are raw price distances.

Correction:
divide by the known H1 ATR at the event.
Rename corrected features with _atr suffix.

max_adverse_anchor_atr is structurally degenerate after lower-low anchor reset.
Correction:
remove this feature from the corrected model recipe and record its empirical variance in the defect report.
No replacement feature is introduced in v0.1.

### D08 — Same M5 bar stop/target ambiguity
Existing simulation assigns STOP when both stop and target appear inside the same M5 bar.

Correction:
when an M5 bar touches both barriers, inspect the underlying M1 bid bars in chronological order.
- if one barrier is reached in an earlier M1 bar, use that barrier;
- if both are first touched in the same M1 bar, classify M1_AMBIGUOUS and use STOP-first conservatively;
- count and report all resolved/unresolved ambiguities.

### D09 — Timeout price side
For a long trade, timeout liquidation must use BID open/close according to the frozen timeout contract.

Frozen audit contract:
retain existing timeout timing semantics:
after the configured number of completed M5 observations, exit at the next available M5 BID open.
Do not optimize the timeout.

### D10 — Health timing
Keep existing Health rule unchanged:
- previous 20 CLOSED shadow trades before current entry;
- risk OFF if total R <= -5R OR PF <= 0.80;
- fewer than 20 closed shadow trades => risk ON.

Recompute Health from corrected spread-inclusive shadow outcomes.
Health is evaluated per engine.

## Frozen strategy architecture

### Static state model
Keep the existing Market State implementation and state sets:
Scalper states {0,5}
Swing states {0,4,5}

No re-selection of states.

### Transition triggers
Scalper: HIGHER_LOW_BREAK
Swing: HIGH_RECLAIM

No trigger switching.

### Execution geometry
Scalper:
stop = anchor low - 0.75 * H1 ATR
target = anchor low + 1.5 * H1 ATR
timeout = 144 completed M5 observations

Swing:
stop = anchor low - 1.0 * H1 ATR
target = anchor low + 4.0 * H1 ATR
timeout = 864 completed M5 observations

Anchor/target/stop remain defined from BID-price structural data.
Long entry uses ASK.

### Model recipes
Control Transfer:
- Logistic Regression
- StandardScaler
- median imputation
- C=1.0
- Train threshold = 60th percentile of TRAIN scores

Wave:
- Logistic Regression
- StandardScaler
- median imputation
- C=1.0
- Train threshold = 60th percentile of TRAIN scores

Wave Permission:
- rolling mean of latest 3 eligible scored Swing events from the FULL decision-time stream
- Q50/Q60 hysteresis recalculated from corrected TRAIN scores by the same recipe
- fewer than 3 eligible events => OFF

No hyperparameter search.

## Data construction

Source:
C:\Users\alk\gtg-lab-data-historical-clean-v1\m1

Required columns:
t, bo,bh,bl,bc, ao,ah,al,ac

Aggregation:
- Bid OHLC and Ask OHLC are both aggregated.
- A bar is retained only when the original completeness rule passes (count == requested minutes).
- No new gap-filling is introduced.

Causal context:
H1 and M15 features become available only after their bars close.

## Cost contract

Primary corrected result:
actual historical quoted spread through Ask-entry / Bid-exit.

Not included because no broker-specific contract is frozen:
- commission;
- swap / financing;
- taxes;
- market-impact.

Required cost sensitivity, frozen before result:
apply an additional adverse slippage at BOTH entry and exit equal to:
- 0.00 × contemporaneous quoted spread
- 0.25 × spread
- 0.50 × spread
- 1.00 × spread

Report break-even additional cost per trade in:
- R;
- price units;
where computable.

Do not call any scenario an actual broker cost unless sourced.

## Portfolio accounting

Each executed trade risks 1R independently, preserving the historical research convention.

Required series:
1. realized_equity_r by chronological exit;
2. mtm_equity_r on M5 timestamps:
   realized closed PnL
   + unrealized PnL of every open trade using current BID close;
3. concurrent_open_trades;
4. concurrent_initial_risk = number of open 1R trades.

Portfolio max drawdown is calculated from MTM equity, not signal-ordered final trade results.

Report per-engine DD separately and combined portfolio DD.

## Defect attribution

The audit must create a table comparing the reference Integrated v0.1 against corrected stages.

At minimum:
A. Reference reported result.
B. Same trade logic with Ask-entry/Bid-exit spread only.
C. Corrected event stream + corrected features + true H1.
D. Corrected Health.
E. Corrected combined portfolio accounting.
F. Slippage sensitivities.

For each step report:
- trade count delta;
- total R delta;
- mean R delta;
- PF delta;
- 2025 delta;
- 2026 delta;
- DD delta where metric is comparable;
- explicit cause.

Do not aggregate incomparable DD definitions.

## Acceptance / interpretation

There is NO minimum PnL required for success.

The audit passes if:
1. every decision-time event is independent of future label availability;
2. corrected MTF features use completed true bars;
3. long execution uses executable price sides;
4. M1 resolves M5 barrier ordering wherever data allows;
5. split-boundary labels do not cross evaluation boundaries;
6. outputs reconcile exactly from logged trades;
7. portfolio DD uses chronological MTM accounting;
8. both engines are reported separately;
9. all exclusions/censored events are counted;
10. no 2025-2026 retuning is performed.

Research interpretation after the run:
- If edge largely survives: proceed to opportunity-geometry diagnosis.
- If Scalper disappears but Swing survives: retain Swing, reconsider Scalper.
- If both shrink materially: treat prior edge magnitude as measurement-inflated.
- If 2026 gap collapses after corrections: do NOT build a Destructive Expansion model.
- If 2026 gap remains after corrections: proceed to Experiment 2 (composition vs conditional path).

## Required artifacts

PROTOCOL_MEASUREMENT_EXECUTION_AUDIT_V01.md
tools/measurement_execution_audit_v01.py
runs/measurement-execution-audit-v01/
  defect_register.json
  event_reconciliation.csv
  scalper_corrected_events.csv
  swing_corrected_events.csv
  scalper_corrected_shadow_trades.csv
  swing_corrected_shadow_trades.csv
  scalper_corrected_live_trades.csv
  swing_corrected_live_trades.csv
  combined_corrected_live_trades.csv
  portfolio_mtm.csv
  cost_sensitivity.csv
  attribution.csv
  summary.json
RESULT_MEASUREMENT_EXECUTION_AUDIT_V01_2026-10-05.md

Logs:
EVENTS.jsonl
EXPERIMENTS.md
WORKLOG.md

## Git discipline
Exact staging only.
Do not touch unrelated working trees.
Audit work is isolated in the clean worktree/branch.
Pristine Forward OOS remains unread.
