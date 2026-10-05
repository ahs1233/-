# RESULT — One-Shot Fresh-Reclaim Re-entry v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0053

Protocol:
- 11b5d0d — preregister One-Shot Fresh-Reclaim Re-entry v0.1
- 6cc91d6 — pre-result clarification for displaced first-attempt ledger

Supplemental outcome-blind precheck:
- a0b05c1 — audit fresh-reclaim baseline capture
- this precheck evaluated capture/support only and did not evaluate second-attempt PnL

Implementation:
- 41f16dd — implement one-shot fresh-reclaim reentry v0.1
- 0158a53 — pre-result fix to event-identity verification dtype handling

Base:
- 0d71256 — completed Experiment 5

Pristine Forward OOS:
- NOT READ

# Executive verdict

**Final preregistered classification: INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE.**

More importantly, the operational result is stronger and simpler:

> Under the frozen Swing engine rules, there were exactly **zero** genuinely incremental executable second attempts.

The candidate policy is therefore byte-for-policy equivalent in realized trades and performance to the corrected reference:

- Reference trades: 1,177
- Candidate trades: 1,177
- Incremental re-entries: **0**
- Displaced reference trades: **0**
- Reference total: +79.654R
- Candidate total: +79.654R
- Risk-match lambda: 1.000
- Candidate MTM DD: -30.622R
- Reference MTM DD: -30.622R

Experiment 6 did not reach the question "is the second attempt profitable?"

It found that, without changing another engine contract, there is no additional second attempt to test.

---

# 1. Event regeneration reconciliation

The existing HIGH_RECLAIM detector was regenerated only to recover episode_start_idx.

Results:

- raw HIGH_RECLAIM events: **5,187**
- state-eligible {0,4,5}: **5,107**
- corrected Experiment 1 permission-stream events: **5,107**
- signal_t / signal_idx / anchor_idx / state_id identity: **MATCH**

Thus fresh-episode analysis is aligned with the corrected reference event stream.

No Wave model was refit and no Permission threshold was changed.

---

# 2. Stopped ideas

Corrected Swing Shadow before Health:

- reference trades: 1,177
- stopped first attempts: **697**
- stopped ideas with complete original horizon: 697

Each reference stopped trade received one fixed idea_id.

All 697 ideas reconcile to a terminal state.

No idea silently disappeared.

Terminal states:

| Status | Ideas | Share of 697 |
|---|---:|---:|
| REFERENCE_ALREADY_CAPTURES | **513** | **73.60%** |
| FRESH_EVENTS_REJECTED_PERMISSION | 103 | 14.78% |
| FRESH_EVENTS_BLOCKED_OPEN_TRADE | 68 | 9.76% |
| HORIZON_EXPIRED | 9 | 1.29% |
| NO_FRESH_SETUP | 3 | 0.43% |
| FRESH_EVENTS_REJECTED_GEOMETRY | 1 | 0.14% |
| INCREMENTAL_REENTRY_EXECUTED | **0** | **0%** |

There were no censored stopped-idea horizons and no first attempts displaced by re-entry, because no re-entry was ever executed.

---

# 3. Fresh-event screening

Across the stopped ideas, the assigned event-screen ledger contains:

- Permission rejects: **1,024**
- State rejects: 24
- Geometry rejects: **3**
- exact reference captures: **513**
- fully valid but blocked by an already-open trade: **450**
- executed incremental second attempts: **0**

Under the preregistered fully-valid definition:

fully valid fresh events =
REFERENCE_ALREADY_CAPTURES
+
BLOCKED_OPEN_TRADE
+
INCREMENTAL_REENTRY_EXECUTED

= 513 + 450 + 0
= **963**

Among those:

- exact reference-captured: 513 = **53.27%**
- valid but blocked by open trade: 450 = **46.73%**
- incremental and executable while flat: **0%**

This is why the specific 80% REFERENCE_ALREADY_CAPTURES classification threshold was not met.

The protocol therefore falls to:

**INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE**

because incremental second attempts = 0 < 30.

---

# 4. Why zero incremental attempts?

The result is not because fresh setups do not exist.

They exist in large numbers.

The result is because the frozen engine has only two situations for a fully valid fresh confirmation:

## A. The corrected reference already trades that exact signal

513 stopped ideas eventually reached such a fresh event.

The "memory" layer would duplicate a trade already in the reference.

The experiment therefore correctly adds nothing.

## B. The fresh valid signal is not a reference trade because the engine is already in another position

450 assigned fully-valid fresh events were blocked by pyramiding=0 / open-trade occupancy.

Because Experiment 6 froze:

- pyramiding=0
- no interruption of open trades
- normal reference priority
- no delayed entry on a stale trigger

those events cannot become second attempts without changing a different system contract.

Therefore no additional executable re-entry exists under the frozen hypothesis.

---

# 5. Important distinction from the outcome-blind precheck

The intermediate outcome-blind precheck a0b05c1 found:

- stopped ideas: 697
- ideas with any Permission+executable fresh event: 584
- ideas with any new non-baseline fresh event: 460
- unique Permission+executable fresh events in idea windows: 1,394
- already captured by baseline: 659
- new non-baseline events: 735

That precheck did NOT model:

- one-event-to-one-idea assignment
- chronological open-position occupancy
- normal-trade priority
- candidate pyramiding=0

Therefore "735 non-baseline events" did not mean "735 executable new trades."

Experiment 6 resolves the distinction.

After chronological policy simulation and unique idea/event assignment:

- 513 fully-valid assigned events are exact reference captures
- 450 fully-valid assigned events occur while the candidate/reference policy is already in a trade
- 0 can enter as a new second attempt

The two analyses are therefore consistent.

---

# 6. Open-trade blocking is not a small corner case

Blocked fresh-valid events:

**450**

They involve **215 unique stopped ideas**.

Some of those ideas later receive an exact reference-captured fresh signal, so only 68 ideas terminate with FRESH_EVENTS_BLOCKED_OPEN_TRADE.

By broad segment, terminal idea status FRESH_EVENTS_BLOCKED_OPEN_TRADE:

- 2018-2022: 41
- 2023-2024: 13
- 2025-2026: 14

REFERENCE_ALREADY_CAPTURES:

- 2018-2022: 284
- 2023-2024: 131
- 2025-2026: 98

So the zero-incremental result is not produced only by 2026.

---

# 7. Portfolio result

Because zero new second attempts execute:

## Corrected Reference

- trades: 1,177
- total nominal risk: 1,177R
- total: **+79.6536R**
- R / nominal risk: +0.06768
- PF: 1.11417
- win rate: 40.53%
- realized exit-order DD: -30.096R
- M5 MTM DD: **-30.6218R**
- risk-weighted holding: 174,155 M5 bars
- max concurrent trades: 1
- max concurrent initial risk: 1.0R

## Re-entry Candidate

Exactly identical:

- trades: 1,177
- incremental attempts: 0
- nominal risk: 1,177R
- total: **+79.6536R**
- PF: 1.11417
- M5 MTM DD: -30.6218R
- holding exposure: 174,155 M5 bars

## Risk-matched reference

Because candidate nominal risk did not increase:

lambda_risk = **1.000**

It is also exactly identical.

Bootstrap candidate minus risk-matched reference:

- point delta: 0.000R
- 2,000 block replications
- CI: [0.000R, 0.000R]

This zero is mechanical identity, not statistical evidence of economic equivalence between hypothetical re-entry strategies.

No second attempt was executed.

---

# 8. No displaced normal trades

Displaced reference trades:

**0**

This follows from the zero-reentry result.

Therefore:

- no normal winner was sacrificed
- no normal loser was removed
- no future stopped idea was altered
- no candidate-policy sequence diverged from reference

The candidate portfolio stayed identical from the first trade to the last.

---

# 9. What Experiment 5 meant after Experiment 6

Experiment 5 found that after 697 eligible losing exits:

- 57.39% later reached +1R from original-entry coordinates
- 42.75% later reached the original target
within the original idea horizon.

Experiment 6 now adds a critical qualification:

> Those late favorable paths do not automatically represent unexploited trades.

Why?

Because when we demand a fresh causal HIGH_RECLAIM with the same State, Permission and Ask geometry:

1. many fresh confirmations are already traded independently by the reference;
2. the remaining fully valid confirmations occur while another reference position is already open.

Thus:

late recovery after stop
!=
available second-entry opportunity.

This directly validates the user's methodological warning.

---

# 10. What would be required to manufacture a nonzero re-entry sample?

At least one frozen contract would have to change:

### Option 1 — allow concurrent positions

Change pyramiding=0.

That is no longer One-Shot Fresh-Reclaim under the existing engine.

It is a portfolio/concurrency hypothesis.

### Option 2 — give re-entry priority over an already-open normal reference trade

That requires closing, interrupting, or not taking another valid reference trade.

That is a trade-priority / opportunity-allocation hypothesis.

### Option 3 — delay entry until the currently open trade closes

The original HIGH_RECLAIM trigger would then be stale.

That is a delayed-entry hypothesis with new geometry.

### Option 4 — relax State / Permission / geometry

That changes the engine's eligibility model.

None is authorized by Experiment 6.

No such modification was tested.

---

# 11. Frozen classification

The preregistered classifications were:

- REFERENCE_ALREADY_CAPTURES
- INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE
- NO_VALUE_AFTER_RISK_CONTROL
- REENTRY_VALUE_CANDIDATE

REFERENCE_ALREADY_CAPTURES required:

- >=80% of fully-valid fresh events exact-reference-captured
- second attempts <30

Observed exact-reference share:

**53.27%**

So that formal class does not pass.

Minimum information gate required:

- >=30 second attempts total
- >=5 in every broad segment

Observed:

- total: **0**
- 2018-2022: 0
- 2023-2024: 0
- 2025-2026: 0

Therefore final class:

# INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE

This should be read operationally as:

> The one-shot fresh-reclaim memory rule produced no additional executable trade under the existing engine and portfolio constraints.

---

# 12. Scientific conclusion

Experiment 6 rejects the practical version of the hypothesis as currently defined.

It does NOT show that:

- late recovery is meaningless
- entry quality is solved
- stop placement is optimal
- re-entry can never work under another architecture

It shows:

> Simply adding "idea memory" after a stop while keeping the same confirmation, Permission, execution geometry, pyramiding=0, and normal-trade priority does not alter the strategy at all.

The current engine is already capable of taking a new fresh reclaim independently whenever it is flat and the event qualifies.

When it does not take a fresh valid event, the main reason under the full-valid branch is that it is already committed to another trade.

---

# 13. Research decision

Do NOT rescue Experiment 6 by:

- raising pyramiding
- giving re-entry priority
- delaying stale signals
- weakening Permission
- changing stop/target
- increasing second risk

Those are distinct hypotheses.

The predefined Fresh-Reclaim Re-entry hypothesis has now been tested once.

Result:

**No incremental executable opportunity under the existing architecture.**

Therefore:

- do not add an Idea Memory / Re-entry layer to the current Swing engine;
- do not use Experiment 5's late-recovery rates as justification for a second-risk layer;
- preserve the corrected Swing reference unchanged.

---

# 14. Current project status

- Scalper: PARKED
- Swing: RESEARCH ONLY
- Experiment 2: INCONCLUSIVE
- Experiment 3: DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE
- Experiment 4: INCONCLUSIVE
- Experiment 5: HORIZON_INVALIDATION_CANDIDATE
- Experiment 6: **INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE — 0 incremental trades**
- Fresh-Reclaim Re-entry layer: **DO NOT ADD**
- Productive / Destructive Expansion: DEFERRED
- cause of 2026 weakness: still UNRESOLVED
- Pristine Forward OOS: SEALED

The most important conclusion is negative but high-value:

> Experiment 5 identified late recovery; Experiment 6 showed that, under the current engine, late recovery does not translate into a new executable re-entry opportunity. The reference already captures qualifying flat-state reclaims, while the other valid signals conflict with positions already open.

No further re-entry tuning is justified from this result.
