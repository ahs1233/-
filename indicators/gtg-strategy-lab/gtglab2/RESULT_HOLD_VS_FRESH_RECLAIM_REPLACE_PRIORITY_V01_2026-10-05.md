# RESULT — Hold vs Fresh-Reclaim Replace Priority v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0054

Protocol:
- fa4a842 — preregister hold-vs-replace priority v0.1

Implementation:
- 0487c5f — implement hold-vs-replace priority v0.1

Base:
- c4c95b8 — completed Experiment 6

Pristine Forward OOS:
- NOT READ

## Executive verdict

**Final classification: KEEP_HOLD_PRIORITY.**

The replacement policy did not outperform HOLD.

It was materially worse under:
- raw portfolio R,
- gross-risk-matched comparison,
- risk efficiency,
- MTM drawdown,
- broad historical segments,
- and the frozen 2,000-block bootstrap.

The result is not an insufficient-sample decision:

- switched occupancy cycles: **587**
- 2018-2022: 333
- 2023-2024: 141
- 2025-2026: 113

The minimum independent-decision gate passed comfortably.

The core result:

| Metric | HOLD | REPLACE |
|---|---:|---:|
| Completed cycles | 1,177 | 1,149 |
| Trade legs | 1,177 | 1,736 |
| Total R | **+79.654R** | **+34.379R** |
| PF | **1.114** | 1.049 |
| Mean R / cycle | +0.0677 | +0.0299 |
| Gross nominal risk deployed | 1,177R | 1,594.52R |
| R / gross risk | **0.06768** | **0.02156** |
| M5 MTM DD | **-30.622R** | **-37.745R** |
| Max concurrent positions | 1 | 1 |
| Max concurrent initial risk | 1.0R | 1.0R |

Raw portfolio difference:

**REPLACE - HOLD = -45.274R**

95% 5-trading-day block-bootstrap interval:

**[-81.157R, -10.216R]**

Therefore the historical priority change is not merely uncertain.
It is decisively inferior under the frozen experiment.

---

# 1. HOLD reconstruction passed

Experiment 7 did not compare REPLACE against a copied historical trade list.

HOLD was reconstructed independently from the same full event stream.

Required reconciliation:

- trade count: 1,177 — MATCH
- executed signal sequence — MATCH
- yearly trade counts — MATCH
- total R difference: 5.68e-14 — numerical zero
- max per-trade PnL difference: 5.68e-14 — numerical zero

Thus the event-driven simulator reproduces the corrected reference before REPLACE is evaluated.

---

# 2. Causal occupancy-cycle invariants

All frozen invariants passed:

- max one switch per cycle: PASS
- max one live position: PASS
- max live initial risk <=1.0R: PASS
- replacement horizon capped by original cycle horizon: PASS
- replacement risk weight never exceeds 1R: PASS
- positive first-leg PnL never increases replacement budget above 1R: PASS
- no switch chain: PASS

The alternative policy therefore did not gain value by:
- extra concurrency,
- extra time,
- or replenishing the risk budget.

---

# 3. What REPLACE actually did

Switch decisions:
**587**

Each switch:
1. closes the current position at Bid open;
2. opens the fresh eligible HIGH_RECLAIM at Ask open;
3. preserves the original occupancy-cycle horizon;
4. sizes the replacement from only the unconsumed 1R cycle loss budget.

Median state at conversion:

- first-leg realized mark: **-0.215R**
- replacement risk budget: **0.785R**

10th / 90th percentile replacement budget:
- P10: 0.463R
- P90: 1.000R

About **79.4%** of switches occurred while the first leg was already losing.

So the experiment usually did not replace a winning trade with a better trade.
It replaced a partially losing position with a new setup using the remaining risk budget.

---

# 4. Replacement outcomes

Among the 587 switched cycles:

- replacement leg positive: **35.95%**
- first leg loss AND replacement loss: **50.60%**
- replacement target-like exit rate: **35.26%**

Local same-initial-cycle comparison is descriptive only because replacement changes later occupancy.

Among cycles where a same-initial HOLD comparison exists:

- only **22.55%** have positive local delta
- median local delta = 0R
- summed local cycle delta = **-29.235R**

Worst 5 local switch-cycle deltas:
**-14.495R**

Worst 10:
**-26.171R**

Best 5:
+13.704R

Best 10:
+25.126R

So positive replacement examples exist, but the negative side dominates in aggregate.

---

# 5. Gross-risk turnover matters

REPLACE keeps maximum concurrent risk at 1R, but it turns the risk budget over more often.

Gross nominal risk:

- HOLD: 1,177R
- REPLACE: 1,594.524R

Gross-risk multiplier:

**lambda = 1.3547**

A HOLD stream scaled to the same total gross nominal risk would produce:

**+107.910R**

REPLACE produced:

**+34.379R**

Therefore:

**REPLACE - gross-risk-matched HOLD = -73.530R**

The candidate is not worse merely because it used too little capital.
It used substantially more gross risk turnover and produced much less return.

Risk efficiency:

- HOLD: +0.06768R / gross 1R
- REPLACE: +0.02156R / gross 1R

Difference:

**-0.04611R per gross risk unit**

This alone satisfies the frozen KEEP_HOLD condition.

---

# 6. Drawdown

M5 mark-to-market maximum drawdown:

HOLD:
**-30.622R**

REPLACE:
**-37.745R**

REPLACE drawdown magnitude is about 23.3% larger.

Frozen acceptance allowed no more than +10%.

Therefore the DD gate FAILS.

This deterioration occurred despite:
- one-position maximum,
- one-R cycle budget,
- and reduced replacement sizing after first-leg losses.

---

# 7. Broad historical segments

| Segment | HOLD | REPLACE | Delta |
|---|---:|---:|---:|
| 2018-2022 | +34.986R | +1.915R | **-33.070R** |
| 2023-2024 | +30.861R | +18.935R | **-11.926R** |
| 2025-2026 | +13.807R | +13.529R | **-0.278R** |

REPLACE is worse in all three broad segments.

Therefore the segment gate FAILS strongly.

This is not a result generated only by the consumed 2025-2026 diagnostic period.

---

# 8. Individual years

REPLACE minus HOLD:

- 2018: -16.912R
- 2019: +6.072R
- 2020: -6.997R
- 2021: -9.082R
- 2022: -6.151R
- 2023: -8.016R
- 2024: -3.910R
- 2025: -3.857R
- 2026 through Sep: **+3.579R**

Thus REPLACE helps historically in:
- 2019
- 2026

but loses value in seven of nine reported years.

The 2026 improvement is descriptive only.
It does not justify a 2026-specific priority rule.

---

# 9. 2026 result

2026:

HOLD:
- 105 cycles
- -8.337R

REPLACE:
- 98 cycles
- -4.759R

Delta:
**+3.579R**

This is noteworthy because replacement reduced the 2026 loss.

But the project rules prohibit selecting a policy because it helps the already-consumed failure year while damaging the broader history.

Across full history REPLACE loses:
-45.274R raw
and
-73.530R versus gross-risk-matched HOLD.

Therefore 2026 cannot override the full-history rejection.

---

# 10. Bootstrap uncertainty

2,000 moving-block bootstrap replications.

Daily realized:
REPLACE minus HOLD.

Point:
**-45.274R**

Bootstrap mean:
-43.671R

95% interval:
**[-81.157R, -10.216R]**

The entire interval is negative.

This is not the positive-but-wide-uncertainty case for which the protocol specified INCONCLUSIVE.

The historical replacement effect is consistently adverse under this resampling contract.

---

# 11. Event accounting

State-eligible HIGH_RECLAIM events:
5,107

Permission ON:
2,320

Executable geometry:
5,099

HOLD:
- selected Permission events: 2,320
- skipped due overlap: 1,137
- executed: 1,177

REPLACE:
- completed occupancy cycles: 1,149
- switched cycles: 587

During occupied cycles, ledger outcomes include:

- SWITCH_EXECUTED: 587
- Permission reject: 186
- post-switch events ignored by one-switch rule: 768

The raw event count is not interpreted as independent opportunities.

Independent replacement decisions are the:
**587 switched occupancy cycles.**

---

# 12. Why Experiment 6 and Experiment 7 differ

Experiment 6 asked:

> Can an extra second attempt be added while preserving normal HOLD priority and pyramiding=0?

Answer:
No.
The policy was equivalent to HOLD because fully valid new signals were either already captured later or arrived while another trade was open.

Experiment 7 changes the question:

> When such a fresh signal arrives while occupied, should it receive priority over the current position?

Answer:
Historically, **no** under the frozen replacement contract.

The current position's priority contains value that is destroyed by frequent switching.

---

# 13. Interpretation

The 450 blocked events from Experiment 6 were not 450 free missed trades.

Once the system is forced to choose:

**current position**
versus
**fresh HIGH_RECLAIM**

the newer signal is not generally superior.

The replacement policy:

- increases turnover,
- reduces total return,
- reduces return per unit of gross risk,
- worsens drawdown,
- loses in all three broad segments,
- and produces a fully negative bootstrap interval.

Therefore the open position should retain priority under the tested contract.

---

# 14. What this does NOT prove

It does NOT prove:

- every fresh signal during occupancy is inferior;
- no future priority model can ever add value;
- HOLD is globally optimal;
- 2026 cannot benefit from some separately justified regime-specific policy;
- the entry engine is perfect.

It proves only:

> The one frozen rule "replace the current position with the first fresh eligible HIGH_RECLAIM, once per causal occupancy cycle, without extra time or risk budget" does not add value historically.

No feature-selection exercise is authorized from the winners/losers of these 587 switches inside Experiment 7.

---

# 15. Frozen decision

Minimum independent-decision gate:
PASS

Raw superiority:
FAIL

Gross-risk-adjusted superiority:
FAIL

Efficiency:
FAIL

MTM DD gate:
FAIL

Segment gate:
FAIL

Bootstrap lower bound >0:
FAIL

Therefore:

# KEEP_HOLD_PRIORITY

Practical action:

- keep pyramiding=0
- keep current-position priority
- do not add switch logic
- close the Fresh-Reclaim priority branch of research under this contract

---

# 16. Research status

- Scalper: PARKED
- Swing: RESEARCH ONLY
- Experiment 2: INCONCLUSIVE
- Experiment 3: DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE
- Experiment 4: INCONCLUSIVE
- Experiment 5: HORIZON_INVALIDATION_CANDIDATE
- Experiment 6: policy-equivalent / zero incremental re-entry under frozen contracts
- Experiment 7: **KEEP_HOLD_PRIORITY**
- pyramiding remains 0
- current position retains priority
- Productive / Destructive Expansion remains DEFERRED
- Pristine Forward OOS remains SEALED

Experiments 5-7 together now refine the earlier late-recovery finding:

1. many stopped ideas later recover;
2. the existing engine already captures fresh flat-time opportunities;
3. fresh signals occurring during occupancy do not justify replacing the current position.

Therefore the late-recovery observation does not currently support an executable modification to the Swing policy.

That branch is closed unless a future, independently motivated mechanism emerges.
