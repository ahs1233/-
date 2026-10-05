# PROTOCOL — One-Shot Fresh-Reclaim Re-entry v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0053

## Objective

Test one narrow mechanical hypothesis produced by Experiment 5:

> After a corrected Swing trade is stopped, can one genuinely fresh, independently confirmed HIGH_RECLAIM inside the remaining original idea horizon create a new executable opportunity that the corrected reference does not already capture, and add value after cost, displacement, and risk-budget control?

Experiment 5 only nominated this hypothesis.
It did NOT prove that cancelling the idea after the first stop is wrong.

Pristine Forward OOS remains unread.

---

# 1. Base and frozen reference

Base commit:
0d71256

Corrected Swing reference:
runs/measurement-execution-audit-v01/swing_corrected_shadow_trades.csv

Corrected event/permission stream:
runs/measurement-execution-audit-v01/swing_permission_full_event_stream.csv

Reference population:
Swing Shadow BEFORE Health.

Expected reference:
- 1,177 trades
- +79.654R before Health

Health is excluded from Experiment 6.
Reason:
Experiment 5 diagnosed the underlying Shadow trade path before Health, and the re-entry hypothesis is a trade/idea-memory mechanism, not a Health hypothesis.

No:
- new State model
- new Wave model
- new Permission threshold
- new stop/target
- new Expansion rule
- new year rule

---

# 2. First-attempt idea eligibility

A first attempt becomes an eligible stopped idea only if the corrected reference trade exits as:

- STOP
- STOP_GAP
- M1_AMBIGUOUS_STOP_FIRST

Each eligible first attempt receives:

idea_id = "IDEA_" + first_attempt_signal_t

The first attempt remains historically unchanged.

No idea is created from:
- TARGET
- TARGET_GAP
- TIMEOUT
- positive non-target exits

All stopped ideas are included.
No selection based on later recovery is allowed.

---

# 3. Original idea horizon

For each first attempt:

original_horizon_end_idx = first_attempt_entry_idx + 864 observed M5 bars

The idea horizon ends at that existing M5 index.

The second attempt NEVER resets the 864-bar clock.

If the original horizon is not complete at dataset end:
- the idea is censored for second-attempt policy evaluation.

The second attempt must enter before original_horizon_end_idx.

---

# 4. Fresh setup definition

A post-stop setup is fresh only if the full new HIGH_RECLAIM episode begins AFTER the first attempt's exit became available.

The deterministic existing HIGH_RECLAIM detector is regenerated only to recover:
- episode_start_idx
- anchor_idx
- signal_idx

No detector logic is changed.

Freshness requirement:

episode_start_idx >= first M5 row whose open time is >= first_attempt_exit_available_t

Thus:
- no reuse of an anchor formed before the stop
- no reuse of a trigger already forming while the first trade was alive
- no retroactive trigger

The candidate entry remains:
next M5 Ask open after the fresh signal.

---

# 5. Candidate screening — frozen order

For every fresh post-stop HIGH_RECLAIM event, in chronological order:

1. IDEA HORIZON
   - fresh signal and next-bar entry must occur before original horizon end

2. STATE
   - same corrected Swing state eligibility as reference: {0,4,5}

3. PERMISSION
   - permission_on must be true in the corrected full event stream at the signal

4. EXECUTABLE GEOMETRY
   - new stop = new anchor_low - 1.0 * new anchor ATR
   - new target = new anchor_low + 4.0 * new anchor ATR
   - entry = next M5 Ask open
   - require stop < Ask entry < target

5. REFERENCE DUPLICATION
   - if the exact signal_t is already an executed corrected reference Shadow trade, it is classified:
     REFERENCE_ALREADY_CAPTURES
   - it is NOT added as a second trade and creates no incremental benefit

6. OPEN-TRADE BLOCK
   - the candidate policy remains pyramiding=0
   - a re-entry cannot interrupt an already-open candidate-policy trade
   - if blocked, log it and continue searching for a later fresh valid event inside the same idea horizon

The earliest event that passes all required conditions and is not reference-duplicated becomes the one allowed incremental second attempt.

No idea may receive more than one incremental second attempt.

---

# 6. One event may belong to only one idea

Because stopped idea horizons can overlap, a fresh event may be eligible for more than one stopped idea.

Frozen assignment:

- assign the event only to the eligible stopped idea with the most recent first-attempt exit_available_t
- tie-break by larger first_attempt_signal_t

Once assigned as:
- REFERENCE_ALREADY_CAPTURES
or
- EXECUTED_SECOND_ATTEMPT

the event cannot be linked to any other idea.

Rejected events:
- Permission fail
- geometry fail
- open-trade block

do not consume the idea and do not consume the event globally.

This prevents one market event from manufacturing multiple re-entry opportunities.

---

# 7. Current-reference capture audit

Before interpreting incremental re-entry, report:

- stopped ideas total
- ideas with >=1 fresh HIGH_RECLAIM
- fresh events screened
- Permission rejects
- geometry rejects
- horizon rejects
- reference-already-captured events
- open-trade blocks
- unique incremental second attempts executed

The first scientific question is:

> Does the existing corrected reference already trade most fresh valid confirmations?

If yes, idea-memory adds little new opportunity.

---

# 8. Second-attempt execution contract

The second attempt uses the same corrected long execution contract:

Entry:
- next executable M5 Ask open

Path / exit side:
- Bid

Stop:
new_anchor_low - 1.0 * new_anchor_ATR

Target:
new_anchor_low + 4.0 * new_anchor_ATR

Same-bar stop/target:
- use the same M1 resolver and stop-first ambiguity contract from Experiment 1

Timeout:
- NOT a new 864 bars
- forced exit at the original idea horizon end if stop/target has not occurred first

The forced horizon exit uses Bid open at the horizon-end M5 row, consistent with the corrected timeout-side convention.

No management change is introduced.

---

# 9. Risk contract

Base monetary risk unit:
1.0R = the corrected first-attempt initial risk budget.

First attempt:
- risk weight = 1.00R

Incremental second attempt:
- risk weight = 0.50R

Maximum nominal idea budget:
- 1.50R

No:
- martingale
- risk increase after loss
- averaging down
- third attempt

Idea-level result:

idea_pnl_R =
first_attempt_pnl_R * 1.00
+
second_attempt_pnl_R * 0.50

when a second attempt occurs.

A double loss therefore costs approximately -1.50R, subject only to real gap execution.

---

# 10. Candidate portfolio simulation

The candidate policy is simulated chronologically with pyramiding=0.

Normal reference trades:
- retain 1.0R risk weight

Incremental re-entry:
- 0.5R risk weight

If an incremental second attempt is open when a later normal reference trade would enter:
- that normal reference trade is SKIPPED
- record it as DISPLACED_BY_REENTRY
- its PnL is not counted
- because it was not executed, it does not create its own stopped idea in the candidate policy

Normal reference trades receive priority when their entry timestamp is exactly equal to an incremental re-entry entry timestamp.

This makes re-entry additive only when the candidate policy is flat.

---

# 11. Reference duplication and displacement

Report separately:

1. REFERENCE_ALREADY_CAPTURES
   - same fresh signal is already a reference Shadow trade
   - zero incremental trade

2. DISPLACED_BY_REENTRY
   - a later normal reference trade is skipped only because a previously added second attempt remains open

3. INCREMENTAL_REENTRY
   - genuinely additional fresh confirmation executed while candidate policy was flat

This prevents double counting.

---

# 12. Primary policy metrics

Compare:

A. CORRECTED_REFERENCE
- 1,177 Shadow trades
- 1.0R each

B. REENTRY_CANDIDATE
- executed normal reference trades at 1.0R
- incremental second attempts at 0.5R
- displaced normal trades removed

Report:

- trade count
- normal trade count
- second-attempt count
- total nominal risk units
- total net R
- mean R per nominal risk unit
- Profit Factor
- win rate
- M5 mark-to-market max drawdown
- realized exit-order drawdown
- maximum concurrent trades
- total risk-weighted holding M5 bars
- calendar span
- yearly results
- broad-segment results

---

# 13. Risk-budget-matched reference

A re-entry policy is not allowed to appear superior merely because it allocates more nominal risk.

Define:

lambda_risk =
candidate_total_nominal_risk_units
/
reference_total_nominal_risk_units

RISK_MATCHED_REFERENCE:
scale every corrected reference trade risk weight uniformly by lambda_risk.

Therefore:

- total nominal risk units exactly match candidate
- reference trade timing and selection remain unchanged
- total R, MTM path, and drawdown scale linearly by lambda_risk

This is the ONE frozen risk-budget comparator.

Do not introduce alternative matched-risk controls after results.

Also report risk-weighted holding-bar exposure descriptively.
It is not a second comparator.

---

# 14. Idea-level metrics

For all stopped first-attempt ideas:

- n stopped ideas
- n with fresh setup
- n reference-already-captured
- n incremental second attempts
- first-attempt R
- second-attempt weighted R
- combined idea R
- fraction with both attempts losing
- fraction second attempt positive
- fraction second attempt target / stop / forced-horizon exit
- second-attempt entry RR
- remaining horizon bars at second entry
- time from first stop to fresh signal
- time from first stop to second entry

Do not report second-attempt PnL alone as the main result.

---

# 15. Segment discipline

Report separately:

2018-2022
2023-2024
2025-2026

Also individual years.

2025-2026 remains consumed diagnostic history.

No:
- threshold changes
- risk changes
- re-entry definition changes
based on year results.

---

# 16. Minimum information gate

For an incremental value conclusion, require:

- at least 30 unique incremental second attempts total
AND
- at least 5 incremental second attempts in EACH broad segment

If not:

classification =
INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE

unless the specific redundancy criterion in Section 17 applies.

---

# 17. Reference-redundancy criterion

Define:

fully_valid_fresh_events =
fresh events that pass State + Permission + executable geometry while inside an idea horizon, before considering reference duplication.

If:
- >=80% of fully_valid_fresh_events are exact signals already executed by the corrected reference
AND
- incremental second attempts <30

classification =
REFERENCE_ALREADY_CAPTURES

This directly answers the user's key concern that the engine may already trade the fresh reclaim independently.

---

# 18. Value-candidate acceptance criteria

Only evaluated if the minimum information gate passes.

Define risk efficiency:

efficiency =
total_net_R / total_nominal_risk_units

A REENTRY_VALUE_CANDIDATE requires ALL:

1. candidate_total_R > risk_matched_reference_total_R

2. candidate_efficiency - reference_efficiency >= +0.01R per nominal 1R allocated

3. incremental second-attempt weighted total R > 0

4. candidate M5 MTM drawdown magnitude <= 1.10 * risk-matched-reference drawdown magnitude

5. broad-segment candidate-minus-risk-matched-reference total R:
   - non-negative in at least 2 of 3 segments
   - no segment worse than -5.0R

6. double-loss rate among ideas receiving a second attempt <= 60%

If all pass:
REENTRY_VALUE_CANDIDATE

If sample gate passes but any value criterion fails:
NO_VALUE_AFTER_RISK_CONTROL

No criterion may be changed after results.

---

# 19. Descriptive uncertainty

Run 2,000 moving-block bootstrap replications on realized daily policy R differences:

candidate daily realized R
minus
risk-matched reference daily realized R

Block:
5 observed trading days.

Report:
- mean total-difference distribution
- 95% percentile interval
- share >0

This is descriptive uncertainty.

It does NOT override the frozen acceptance criteria in Section 18.

---

# 20. Required rejection ledger

Every stopped idea must end in exactly one high-level status:

- NO_FRESH_SETUP
- HORIZON_EXPIRED
- REFERENCE_ALREADY_CAPTURES
- INCREMENTAL_REENTRY_EXECUTED
- FRESH_EVENTS_REJECTED_PERMISSION
- FRESH_EVENTS_REJECTED_GEOMETRY
- FRESH_EVENTS_BLOCKED_OPEN_TRADE
- CENSORED_HORIZON

If multiple rejected events occurred before final status:
retain detailed counts in the event screening ledger.

No stopped idea may silently disappear.

---

# 21. What Experiment 6 can establish

Potentially:

1. The corrected reference already captures the fresh confirmations:
   REFERENCE_ALREADY_CAPTURES

2. There are too few genuinely new opportunities:
   INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE

3. New one-shot re-entry opportunities exist but do not add value after risk control:
   NO_VALUE_AFTER_RISK_CONTROL

4. One-shot fresh-confirmation re-entry earns a further research slot:
   REENTRY_VALUE_CANDIDATE

None of these proves live edge.

---

# 22. What Experiment 6 cannot establish

It cannot establish:

- that wider stops are better
- that every stopped idea remains valid
- that late +1R from first-entry coordinates equals second-entry profit
- that 2026 caused the effect
- that Expansion caused the effect
- that Productive/Destructive regimes are solved
- that a third attempt should be allowed

---

# 23. Prohibited actions

- no stop widening
- no target changes
- no timeout reset
- no automatic re-entry at price recovery
- no re-entry without a new HIGH_RECLAIM episode
- no old-anchor reuse
- no Permission relaxation
- no state relaxation
- no second-attempt risk >0.5R
- no third attempt
- no year-specific rule
- no post-result parameter changes
- no Productive/Destructive model
- no OOS opening

---

# 24. Required artifacts

PROTOCOL_ONE_SHOT_FRESH_RECLAIM_REENTRY_V01.md

After protocol commit:
tools/one_shot_fresh_reclaim_reentry_v01.py

runs/one-shot-fresh-reclaim-reentry-v01/
- sample_reconciliation.csv
- stopped_ideas.csv
- fresh_event_screening.csv
- second_attempts.csv
- displaced_reference_trades.csv
- candidate_policy_trades.csv
- idea_level_results.csv
- yearly_policy_summary.csv
- segment_policy_summary.csv
- portfolio_summary.csv
- bootstrap_summary.json
- summary.json

RESULT_ONE_SHOT_FRESH_RECLAIM_REENTRY_V01_2026-10-05.md

Logs:
- EVENTS.jsonl
- EXPERIMENTS.md
- WORKLOG.md

---

# 25. Definition of done

Experiment 6 is complete only when:

1. corrected 1,177-trade reference reconciles;
2. deterministic HIGH_RECLAIM event regeneration reconciles to corrected event stream;
3. every stopped first attempt receives a unique idea_id;
4. no fresh event is linked to multiple ideas;
5. full new episode starts after stop availability;
6. same Permission/state/Ask geometry contract is enforced;
7. reference-duplicate signals are not counted as additional trades;
8. second attempt never resets the original 864-M5 horizon;
9. second attempt risk is exactly 0.5R;
10. max idea budget is 1.5R;
11. candidate pyramiding remains zero;
12. displaced normal trades are explicitly recorded;
13. idea-level and portfolio-level results reconcile;
14. risk-matched reference uses the one frozen lambda_risk comparator;
15. M5 MTM drawdown and risk exposure are reported;
16. all stopped ideas reconcile to a terminal status;
17. exactly one final classification is assigned;
18. Pristine Forward OOS remains unread.

The experiment succeeds scientifically even if the conclusion is:

> the corrected reference already captures the relevant fresh reclaim, or the incremental memory rule has no value after risk control.
