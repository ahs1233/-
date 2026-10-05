# PROTOCOL — Swing Loss-Path Audit v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0052

## Objective

Describe how corrected Swing trades fail under the existing frozen policy.

Primary question:

> When a corrected Swing trade loses or fails to reach target, did the favorable move fail to start, start and then fade, or occur only after the policy had already exited?

This is a path-description audit.

It is NOT:
- a new trading model,
- a management optimization,
- a stop/target optimization,
- a regime classifier,
- a Productive/Destructive Expansion model,
- a counterfactual PnL backtest,
- or a causal explanation of why 2026 behaved differently.

No entry, stop, target, timeout, Permission, State, Wave, Health, or execution rule may be changed.

Pristine Forward OOS remains unread.

---

## 1. Frozen source

Base commit:
18e4865

Corrected Swing source:
runs/measurement-execution-audit-v01/swing_corrected_shadow_trades.csv

Expected corrected Swing Shadow count:
1,177 trades before Health.

Execution contract:
- long entry = Ask at next executable M5 open
- long path / exit side = Bid
- stop = anchor_low - 1.0 * anchor ATR
- target = anchor_low + 4.0 * anchor ATR
- timeout = 864 observed M5 bars
- same-bar stop/target ordering follows the corrected M1 resolution contract from Experiment 1
- original trade PnL is NEVER rewritten by Experiment 5

All path diagnostics use the fixed initial risk:
risk_px = entry Ask - stop.

---

## 2. Population

PRIMARY:
all corrected Swing Shadow trades before Health, all available years.

Do not filter by:
- profitability,
- year,
- Expansion,
- State,
- Session,
- Permission score,
- Health,
- or any path result.

Use all trades for descriptive tables.

Mechanism classification uses losing trades:
pnl_r < 0.

Targets and profitable non-target trades remain in the audit and are reported separately.

---

## 3. Time semantics

The original horizon is defined exactly as the strategy defines it:

864 observed M5 bars from the entry bar index.

It is NOT 72 calendar hours.

For each trade:

entry_idx = M5 row at entry_t.

horizon_end_idx = entry_idx + 864.

If horizon_end_idx is beyond available historical data:
- mark post-horizon diagnostics censored;
- retain the trade for all pre-exit diagnostics;
- exclude it only from metrics requiring the complete original horizon.

Post-exit path analysis runs from the actual corrected exit until the original horizon end.

It does NOT extend the strategy or alter the historical PnL.

---

## 4. Price-side contract

Entry reference:
Ask entry price from corrected trade artifact.

Path:
Bid M1 OHLC wherever available.

MFE:
(max Bid high - Ask entry) / initial risk.

MAE:
(min Bid low - Ask entry) / initial risk.

Positive values are favorable for the long.
Negative values are adverse.

M5 completed Bid closes are used for reclaim/anchor close-loss diagnostics.

No mid-price path metrics are used.

---

## 5. Pre-exit path metrics

Measure from entry_t through actual exit_available_t.

### 5.1 Excursions

- pre_exit_mfe_r
- pre_exit_mae_r
- pre_exit_path_asymmetry = MFE - abs(MAE)

Record:
- timestamp of MFE
- timestamp of MAE
- observed minutes from entry to MFE
- observed minutes from entry to MAE
- whether MFE occurred before MAE
- whether both extrema occur in the same M1 bar

### 5.2 Fixed touch thresholds

Record first touch and time for:

Favorable:
+0.5R
+1.0R
+2.0R

Adverse:
-0.5R
-1.0R

For +0.5R vs -0.5R:
- PLUS_FIRST
- MINUS_FIRST
- SAME_M1_AMBIGUOUS
- ONLY_PLUS
- ONLY_MINUS
- NEITHER

For +1R vs -1R:
same categories.

Same-M1 ambiguity is never broken by assumption.

### 5.3 Progress before first material adverse move

Primary "material adverse move" threshold is frozen at:

-0.50R.

Define:

progress_before_first_minus_0_5r =
maximum favorable R reached before the first M1 bar that touches -0.50R.

If -0.50R is never touched before exit:
use the entire pre-exit path.

If +favorable extreme and -0.50R first occur inside the same M1 bar:
mark ordering ambiguous and exclude that observation from ordering-dependent summaries only.

Secondary descriptive threshold:
-1.0R.

Do not choose a threshold after seeing results.

---

## 6. Local transition-failure metrics

The frozen Swing trigger is HIGH_RECLAIM.

Reclaim level:
anchor_high from the triggering anchor bar.

Anchor floor:
anchor_low.

After entry record:

### Reclaim loss

reclaim_close_loss:
first completed M5 Bid close < anchor_high.

Also:
- time to first reclaim close loss
- number of completed M5 closes below anchor_high before exit
- fraction of completed pre-exit M5 closes below anchor_high

### Anchor recross

anchor_touch_recross:
first Bid M1 low <= anchor_low.

anchor_close_break:
first completed M5 Bid close < anchor_low.

Record times for both.

These are descriptive path failures.
They are not automatically Permission rules.

---

## 7. Exit accounting

Normalize corrected exit_kind into:

TARGET
STOP
TIMEOUT
TARGET_GAP
STOP_GAP
AMBIGUOUS_STOP_FIRST
OTHER

Report by exit class:

- n
- share of all trades
- total R
- mean R
- median R
- pre-exit MFE median / P25 / P75
- pre-exit MAE median / P25 / P75
- reclaim-loss rate
- anchor-recross rate
- median time to exit

This identifies where losses accumulate under the current policy.

---

## 8. Frozen failure archetypes

For trades with pnl_r < 0 only:

### NO_START
pre_exit_mfe_r < +0.50R

Interpretation:
the favorable move never achieved even +0.5R before the losing exit.

### STARTED_THEN_FADED
+0.50R <= pre_exit_mfe_r < +1.00R

Interpretation:
some favorable movement began but never reached +1R before the losing exit.

### STRONG_PROGRESS_FAILED
pre_exit_mfe_r >= +1.00R

Interpretation:
the trade had at least +1R favorable excursion before eventually losing.

These classes are mutually exclusive.

They are descriptive.
They do not imply a management change.

---

## 9. Post-exit diagnostic path

For all non-target exits, continue observing the same frozen trade geometry until the ORIGINAL 864-M5 horizon end.

Do NOT alter original pnl_r.

Record after the actual exit:

- post_exit_mfe_r relative to original Ask entry / initial risk
- post_exit_mae_r
- later_recovered_entry: Bid high >= original Ask entry
- later_reached_plus_0_5r
- later_reached_plus_1_0r
- later_reached_plus_2_0r
- later_reached_original_target
- time from exit to each later level when reached

For STOP exits:
a later target hit remains a diagnostic fact only.

It is NOT converted into a hypothetical winner and is NOT evidence by itself that the stop should be widened.

For TIMEOUT exits:
later movement is also diagnostic only.

---

## 10. Year / segment reporting

Report every metric for:

### Full history

all corrected Swing Shadow trades.

### Frozen chronological segments

2018-2022
2023-2024
2025-2026

### Individual years

2018 through 2026 where available.

2025 and 2026 are descriptive diagnostic years only.
No threshold or archetype is chosen from their results.

No matching between years is attempted.

---

## 11. Primary mechanism candidates

The audit ends with exactly one of:

ENTRY_INITIATION_CANDIDATE
PROFIT_RETENTION_CANDIDATE
HORIZON_INVALIDATION_CANDIDATE
MIXED_OR_NO_STABLE_PATTERN

The classification is based on losing trades and frozen criteria.

### A. ENTRY_INITIATION_CANDIDATE

Passes only if:

1. NO_START share among losses >= 60% full-history;
AND
2. NO_START share >= 50% in EACH of:
   - 2018-2022
   - 2023-2024
   - 2025-2026

Interpretation:
most losing trades fail before producing even +0.5R progress.

### B. PROFIT_RETENTION_CANDIDATE

Passes only if:

1. STRONG_PROGRESS_FAILED share among losses >= 30% full-history;
AND
2. share >= 25% in EACH frozen segment.

Interpretation:
a substantial stable portion of losers first achieves >=+1R and then gives it back.

### C. HORIZON_INVALIDATION_CANDIDATE

Consider only losing STOP/TIMEOUT/non-target trades with a complete remaining original horizon.

Passes if EITHER:

1. >=30% later reach +1R after actual exit within the original horizon;
OR
2. >=15% later reach the original target after actual exit;

AND the qualifying direction is present in at least two of the three frozen segments within 10 percentage points of the full-history rate.

Interpretation:
the current invalidation/holding horizon may be misaligned with later recovery for a material subset.

This does NOT prescribe wider stops or longer holds.

### D. MIXED_OR_NO_STABLE_PATTERN

Assigned if:
- none of A/B/C passes;
OR
- more than one of A/B/C passes.

If more than one passes, do not choose the more attractive narrative.

The next step then is "no single mechanism justified."

---

## 12. Descriptive uncertainty

For the three primary candidate shares:

- NO_START among losses
- STRONG_PROGRESS_FAILED among losses
- late +1R recovery among eligible losing non-target exits
- late original-target recovery among eligible losing non-target exits

Use:
2,000 moving-block bootstrap replications.

Block:
5 observed trading days based on entry day.

Report percentile 95% intervals.

The mechanism pass/fail thresholds are based on the point estimates plus segment stability rules, not on p-values.

Bootstrap intervals describe uncertainty only.

---

## 13. Secondary distributions

Report:

progress_before_first_minus_0_5r:
- mean
- median
- P10/P25/P75/P90

time to:
- +0.5R
- +1R
- -0.5R
- -1R
- reclaim close loss
- anchor recross
- exit

MFE/MAE ordering shares.

These are descriptive.
They cannot create a new mechanism class outside Section 11.

---

## 14. What is prohibited

- no new trade entries
- no stop widening
- no target changes
- no timeout changes
- no break-even simulation
- no partial exits
- no trailing stops
- no path-dependent management backtest
- no year-specific rule
- no Expansion classifier
- no Productive/Destructive model
- no matched 2025/2026 comparison
- no overlap weighting
- no model fitting to path outcomes
- no converting post-exit recovery into counterfactual PnL
- no opening Pristine OOS

---

## 15. Required artifacts

PROTOCOL_SWING_LOSS_PATH_AUDIT_V01.md

After protocol commit:
tools/swing_loss_path_audit_v01.py

runs/swing-loss-path-audit-v01/
- sample_reconciliation.csv
- trade_path_features.csv
- exit_class_summary.csv
- loss_archetype_summary.csv
- yearly_path_summary.csv
- segment_path_summary.csv
- threshold_order_summary.csv
- post_exit_recovery_summary.csv
- progress_before_adverse_summary.csv
- bootstrap_summary.json
- summary.json

RESULT_SWING_LOSS_PATH_AUDIT_V01_2026-10-05.md

Logs:
- EVENTS.jsonl
- EXPERIMENTS.md
- WORKLOG.md

---

## 16. Definition of done

Experiment 5 is complete only when:

1. corrected Swing Shadow count reconciles;
2. all trades are included unless path data are objectively unavailable;
3. original corrected pnl_r is unchanged;
4. pre-exit MFE/MAE uses Bid path vs Ask entry and fixed initial risk;
5. original 864-M5 horizon semantics are preserved;
6. reclaim and anchor definitions are frozen before results;
7. post-exit recovery never changes historical pnl_r;
8. exit classes are reconciled;
9. all three frozen segments and all years are reported;
10. 2,000 block bootstraps complete for primary shares;
11. exactly one final mechanism classification from Section 11 is assigned;
12. if multiple candidate mechanisms pass, final class is MIXED_OR_NO_STABLE_PATTERN;
13. no management variant is tested;
14. no Productive/Destructive model is built;
15. Pristine Forward OOS remains unread.

After this audit:

- if exactly one mechanism candidate passes, the next experiment may test ONE corresponding mechanical hypothesis;
- otherwise, do not add a new layer merely because more diagnostics are available.

The goal is:

> locate where the corrected Swing trade path actually fails before naming the market environment that caused the failure.
