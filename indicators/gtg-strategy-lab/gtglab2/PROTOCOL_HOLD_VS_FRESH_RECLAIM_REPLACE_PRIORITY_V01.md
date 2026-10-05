# PROTOCOL — Hold vs Fresh-Reclaim Replace Priority v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0054

## Objective

Test one narrow priority hypothesis:

> When the Swing engine is already holding one position and the first genuinely fresh, fully eligible HIGH_RECLAIM appears, does closing the current position and replacing it with the new signal add portfolio value after conversion cost, under the SAME one-position capital budget and WITHOUT extending the original occupancy-cycle horizon?

This experiment changes priority, not concurrency.

Maximum positions remains:
1

It does NOT test:
- pyramiding > 1
- additive re-entry
- averaging down
- wider stops
- a second risk budget
- Productive/Destructive Expansion
- or annual-regime prediction.

Pristine Forward OOS remains unread.

---

# 1. Base and frozen source

Base commit:
c4c95b8

Corrected event / permission source:
runs/measurement-execution-audit-v01/swing_permission_full_event_stream.csv

Corrected reference Shadow:
runs/measurement-execution-audit-v01/swing_corrected_shadow_trades.csv

Frozen Swing:
- HIGH_RECLAIM
- State eligibility {0,4,5}
- existing Wave Permission
- Ask entry / Bid path and exit
- stop = anchor_low - 1 ATR
- target = anchor_low + 4 ATR
- original timeout = 864 observed M5 bars
- same M1 ambiguity resolver
- commission and financing excluded, as in the corrected Experiment 1 contract
- historical quoted spread included through Ask entry / Bid exit

No model or threshold is refit.

---

# 2. Policies must be simulated independently from the SAME full event stream

Do NOT derive REPLACE from the historical list of 450 blocked events.

Run two chronological engines independently:

## HOLD

When flat:
- take the next fully eligible event.

When occupied:
- ignore later events until current trade exits under its original stop / target / 864-M5 timeout.

This reconstructed HOLD must reproduce the corrected reference BEFORE any REPLACE result is accepted.

Required reconciliation:
- same reference trade count: 1,177
- identical executed signal_t sequence
- same total corrected R within floating tolerance
- same yearly trade counts
- same max concurrency = 1

Failure => Experiment invalid; do not evaluate REPLACE.

## REPLACE

When flat:
- same rule as HOLD; enter the next fully eligible event.

When occupied and the occupancy cycle has NOT switched:
- inspect chronological fresh eligible events.
- the first event satisfying the frozen fresh + State + Permission + geometry + risk-budget rules causes a conversion at its normal next-M5 entry open:
  1. close current position at Bid open,
  2. open the new position at Ask open.

When occupied after a switch:
- ignore every later event until the replacement exits.
- no second switch in the same occupancy cycle.

After the cycle ends, the next fully eligible event may start a new cycle.

Thus REPLACE may alter later occupancy and must be simulated causally from the stream, not patched onto historical HOLD trades.

---

# 3. Causal occupancy-cycle identity

A cycle begins when a flat policy opens a normal first position.

cycle_id =
"CYCLE_" + first_position_signal_t

Cycle state travels with the live position:
- cycle_id
- cycle_start_t
- cycle_horizon_end_idx / t
- switched = false/true
- fixed cash budget = 1.0 portfolio R

If a replacement occurs:
- the replacement inherits the SAME cycle_id,
- switched becomes true,
- the cycle continues until replacement exit.

The cycle ends when its currently held position exits.

Its end is determined only by the candidate policy's live position.
It never depends on a future exit time from the HOLD policy.

A new cycle can start only after the previous cycle has actually ended.

No switch chain is allowed.

---

# 4. Fresh-event definition

A replacement candidate is fresh only if its complete HIGH_RECLAIM episode begins after the CURRENT cycle's first position was opened.

Frozen condition:

fresh_event.episode_start_idx >= cycle_start_entry_idx

and:

fresh_event.signal_idx > current_position_signal_idx

and its normal candidate entry time occurs while the current position is still open.

This prevents:
- reuse of a setup already forming before the cycle began,
- same-signal recycling,
- stale delayed entry.

After the single switch, freshness is no longer evaluated because further switches are prohibited.

---

# 5. Eligible replacement event

At the candidate event's normal next-M5 entry time, require:

1. State in {0,4,5}
2. Permission ON
3. new HIGH_RECLAIM is fresh under Section 4
4. executable geometry:
   - new stop < next Ask open < new target
5. current policy position is still open at that instant
6. cycle.switched == false
7. candidate entry occurs BEFORE the cycle's original horizon end
8. remaining cycle risk budget > 0

The first event passing ALL conditions is the only allowed switch.

Events failing any condition are logged.
No rule may be loosened after results.

---

# 6. Conversion execution

At the eligible candidate's next-M5 open:

Old position:
- exit immediately at current Bid open.

New position:
- enter immediately at current Ask open.

Therefore conversion cost includes the real quoted spread through:
- old-position Bid liquidation,
- new-position Ask entry.

No synthetic mid-price conversion.

No additional commission/financing/slippage is invented because those are outside the corrected baseline execution contract.

Report:
- old position mark-to-market R at conversion,
- current Bid/Ask spread,
- new entry spread,
- total switch count,
- gross turnover caused by switches.

---

# 7. Original-cycle horizon

Each cycle receives its horizon when the FIRST position opens:

cycle_horizon_end_idx =
cycle_start_entry_idx + 864 observed M5 bars

The replacement does NOT receive a fresh 864 bars.

Replacement exits at the earliest of:

1. its new stop,
2. its new target,
3. cycle_horizon_end_idx.

If forced out by cycle horizon:
- exit at Bid open of the horizon-end M5 row.

Thus Experiment 7 isolates priority from additional time.

---

# 8. Fixed cash-risk budget

Portfolio risk unit:

1 portfolio R = the same fixed cash amount B for every NEW occupancy cycle in BOTH policies.

A normal first position is sized so its initial stop loss is nominally:

1.00R

The cycle budget never exceeds:

1.00R

It does NOT refresh at replacement.

## At switch time

Let:

old_realized_cycle_R =
realized PnL of the current first leg at Bid conversion price,
expressed in the cycle's fixed cash R.

Loss already consumed:

loss_spent_R =
max(0, -old_realized_cycle_R)

Remaining budget:

remaining_budget_R =
max(0, 1.00 - loss_spent_R)

If old_realized_cycle_R > 0:
remaining budget remains 1.00R.
Profit does NOT increase the risk budget.

If remaining_budget_R <= 0:
- replacement is rejected,
- current position is NOT closed for replacement,
- policy continues holding it.

## Replacement sizing

Replacement position's own raw stop risk is normalized to 1 trade-R.

Its position risk weight is:

replacement_risk_weight =
remaining_budget_R

Thus, absent a stop gap, the sum of:
- realized first-leg loss
- replacement stop loss

cannot consume more than the original 1.00R cycle budget.

Gap-through-stop may exceed nominal budget and is reported as realized tail risk, exactly as gap risk exists in the reference.

No martingale.
No budget refill after loss.
No extra capital.

---

# 9. One switch decision per cycle

The first candidate that passes all replacement requirements causes the switch.

After the switch:
- cycle.switched = true
- all later events are ignored until the replacement exits.

A failed event:
- State fail
- Permission fail
- stale episode
- invalid geometry
- no remaining risk
- after cycle horizon

does NOT set switched=true.

The next chronological event may still qualify while the original position remains open.

---

# 10. Event / decision accounting

Report raw event counts AND approximately independent decisions.

For each policy / cycle:

- all state-eligible HIGH_RECLAIM events seen while occupied
- fresh events
- Permission ON fresh events
- executable fresh events
- events rejected stale
- Permission rejects
- geometry rejects
- horizon rejects
- no-risk-budget rejects
- events after switched=true
- actual switch decisions

Primary independent decision count:

number of occupancy cycles in which a switch executes.

Do NOT describe raw event count as independent opportunities.

Also report:
- events per switched cycle
- events per non-switched occupied cycle
- number of cycles with multiple eligible pre-switch events

---

# 11. Position / cycle accounting

For every HOLD and REPLACE cycle report:

- cycle_id
- first signal
- first entry / exit
- switched?
- switch signal / time
- first-leg realized R at switch
- remaining risk budget
- replacement risk weight
- replacement entry / exit
- replacement raw R
- replacement scaled R
- final cycle R
- cycle holding M5 bars
- original cycle horizon
- exit class
- conversion spread / turnover fields

For switched cycles additionally:

- fraction cycle result > corresponding HOLD cycle result where a causal same-cycle comparison is available descriptively
- fraction both first leg and replacement lose
- replacement target / stop / horizon-exit shares

These are secondary.
Portfolio policy result remains primary.

---

# 12. Primary portfolio endpoint

Primary:

Delta_portfolio_R =
REPLACE total net portfolio R
-
HOLD total net portfolio R

Both are measured in the same fixed cash portfolio-R units.

Report:
- total R
- PF
- mean R per completed cycle
- M5 mark-to-market drawdown
- maximum concurrent trades
- maximum concurrent initial risk
- risk-weighted holding M5 bars
- gross nominal risk deployed
- turnover / switch count
- yearly results
- broad segment results

Maximum concurrent position count must remain:
1

Maximum concurrent nominal cycle budget must remain:
<=1.0R, except realized gap tail.

---

# 13. Gross-risk-matched HOLD comparator

Even with the same maximum one-position budget, REPLACE may turn risk capital over more often.

Define gross nominal deployed risk:

HOLD:
sum of first-position nominal risk weights.

REPLACE:
sum of:
- first-position risk weights
- replacement risk weights

Define:

lambda_gross =
REPLACE gross nominal risk deployed
/
HOLD gross nominal risk deployed

GROSS_RISK_MATCHED_HOLD:
scale HOLD trade weights uniformly by lambda_gross.

Report:

Delta_vs_gross_risk_matched_hold =
REPLACE total R
-
gross-risk-matched HOLD total R

This is a descriptive turnover-risk comparator.

It is NOT the primary executable reference because it may imply >1R concurrent scaled risk.

Primary fair reference remains unscaled HOLD with the same 1R maximum live capital budget.

---

# 14. Risk efficiency

Define:

efficiency =
total net R / gross nominal deployed risk

Report HOLD and REPLACE.

A profit increase produced only by greater gross risk turnover is not sufficient for promotion.

---

# 15. MTM portfolio accounting

Build full M5 mark-to-market equity independently for HOLD and REPLACE.

For current long positions:
unrealized R uses Bid close vs actual Ask entry,
scaled by position risk weight.

At conversion:
- old position realizes at Bid open,
- replacement opens at Ask open,
- no simultaneous double position.

Report:
- MTM maximum drawdown
- realized equity
- unrealized equity
- open-position count
- live nominal risk

No signal-order drawdown is accepted as primary DD.

---

# 16. Broad chronological reporting

Segments:

2018-2022
2023-2024
2025-2026

Also individual years.

2025-2026 remains consumed diagnostic history.

No year-specific rule or acceptance threshold.

---

# 17. Minimum independent-decision gate

A priority-value conclusion requires:

- >=50 switched occupancy cycles total
AND
- >=10 switched cycles in EACH broad segment

If not:

final classification =
INCONCLUSIVE

Practical policy remains HOLD.

Do not reduce this gate after results.

---

# 18. Descriptive uncertainty

Create realized daily policy-R series:

REPLACE daily realized R
minus
HOLD daily realized R

Run:

2,000 moving-block bootstrap replications

with:
- 5 observed trading days per block
- frozen seed
- percentile 95% interval

This describes uncertainty around the realized historical policy difference.

Also report concentration:
- top 5 switched cycles' contribution to total policy delta
- top 10 switched cycles' contribution
- best / worst single switch-cycle delta

If positive improvement is concentrated in very few cycles, retain that limitation.

---

# 19. Frozen decision rule

Exactly one final class:

## A. REPLACE_PRIORITY_CANDIDATE

Requires ALL:

1. minimum independent-decision gate PASS
2. REPLACE total R > HOLD total R
3. Delta_vs_gross_risk_matched_hold > 0
4. REPLACE efficiency - HOLD efficiency >= +0.01R per gross nominal 1R
5. REPLACE MTM DD magnitude <= 1.10 * HOLD MTM DD magnitude
6. broad-segment REPLACE-minus-HOLD total R:
   - non-negative in at least 2 of 3 segments
   - no segment worse than -5.0R
7. 95% bootstrap CI lower bound for daily REPLACE-minus-HOLD > 0

If all pass:
REPLACE_PRIORITY_CANDIDATE

This is still only a historical candidate, not production authorization.

## B. KEEP_HOLD_PRIORITY

If minimum decision gate passes AND either:

- REPLACE total R <= HOLD total R
OR
- Delta_vs_gross_risk_matched_hold <= 0
OR
- REPLACE efficiency <= HOLD efficiency

Then:
KEEP_HOLD_PRIORITY

Interpretation:
the replacement policy does not historically outperform after the relevant risk accounting.

This does NOT prove replacement can never work.

## C. INCONCLUSIVE

If:

- minimum decision gate fails
OR
- REPLACE shows positive raw and gross-risk-adjusted point improvement with positive efficiency delta, but one or more of:
  - bootstrap CI includes 0
  - DD gate fails
  - segment gate fails

Then:
INCONCLUSIVE

Practical default remains HOLD, without claiming replacement has been disproved.

No criterion may be changed after results.

---

# 20. Required verification before result acceptance

HOLD reconstruction from the same full event stream must match corrected reference:

- 1,177 trades
- identical signal_t sequence
- same total R within floating tolerance
- same yearly counts
- same max concurrency 1

REPLACE must verify:

- same event stream input
- no more than one live position
- no more than one switch per cycle
- replacement horizon never exceeds cycle original horizon
- remaining risk budget never exceeds 1R
- positive first-leg PnL does not increase risk budget above 1R
- no switch if remaining budget <=0
- post-switch events cannot trigger another switch

Any invariant violation invalidates the run.

---

# 21. What is prohibited

- no pyramiding >1
- no additive second position
- no extra 864 bars for replacement
- no budget refill after loss
- no risk increase after profit
- no repeated switching
- no features added
- no new Permission model
- no stop/target tuning
- no 2025/2026 rules
- no Productive/Destructive model
- no matching / overlap-weighting comparison
- no selecting only the historical 450 blocked events
- no opening Pristine OOS

---

# 22. Required artifacts

PROTOCOL_HOLD_VS_FRESH_RECLAIM_REPLACE_PRIORITY_V01.md

After protocol commit:

tools/hold_vs_fresh_reclaim_replace_priority_v01.py

runs/hold-vs-fresh-reclaim-replace-priority-v01/
- event_reconciliation.csv
- hold_trades.csv
- replace_trades.csv
- hold_cycles.csv
- replace_cycles.csv
- switch_decisions.csv
- event_screen_ledger.csv
- cycle_delta_summary.csv
- yearly_policy_summary.csv
- segment_policy_summary.csv
- portfolio_mtm_hold.csv
- portfolio_mtm_replace.csv
- bootstrap_summary.json
- summary.json

RESULT_HOLD_VS_FRESH_RECLAIM_REPLACE_PRIORITY_V01_2026-10-05.md

Logs:
- EVENTS.jsonl
- EXPERIMENTS.md
- WORKLOG.md

---

# 23. Definition of done

Experiment 7 completes only when:

1. protocol is committed before PnL comparison;
2. HOLD is reconstructed independently from event stream and reproduces corrected reference;
3. REPLACE is independently simulated from the same stream;
4. occupancy cycles are causal;
5. max one switch per cycle;
6. replacement horizon is capped by initial cycle horizon;
7. cycle cash-risk budget remains 1R and does not refresh;
8. Ask/Bid conversion cost is included;
9. no more than one live position;
10. raw events are separated from independent switch cycles;
11. full portfolio MTM metrics are calculated;
12. gross-risk-matched HOLD is reported;
13. 2,000 block-bootstrap replications complete;
14. broad segments and years are reported;
15. exactly one of:
    - REPLACE_PRIORITY_CANDIDATE
    - KEEP_HOLD_PRIORITY
    - INCONCLUSIVE
    is assigned;
16. Productive/Destructive Expansion remains deferred;
17. Pristine Forward OOS remains unread.

The sole question is:

> Does replacing the current Swing position with the first fresh eligible HIGH_RECLAIM earn enough incremental value to justify its conversion cost and priority change inside the time and cash-risk budget already allocated to that occupancy cycle?
