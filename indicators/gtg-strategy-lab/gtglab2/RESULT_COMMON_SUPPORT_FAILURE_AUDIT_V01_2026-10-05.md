# RESULT — Common-Support Failure Audit v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0050

Protocol commit:
- ccd9951 — research: preregister common-support failure audit v0.1

Implementation:
- f718d16 — research: implement common-support failure audit v0.1
- c4dd13f — research: fix support audit session column

Base:
- 8b50a67 — completed Experiment 2

Pristine Forward OOS:
- NOT READ

## Executive verdict

**Primary classification: DISTRIBUTED MULTIDIMENSIONAL COLLAPSE.**

Experiment 3 was deliberately outcome-blind. It did not load or use PnL, labels, MAE/MFE, exit outcomes, Health outcomes, or any post-entry path variable.

The central result is:

> Common support did not collapse because of one dominant variable. It eroded across several pre-entry dimensions, especially Session, Signed Coherence, State, and Expansion Persistence. Expansion Level by itself was a small contributor to support loss in the 2025-vs-2026 primary comparison.

This explains why Experiment 2 could not obtain enough balanced comparable observations. It does **not** explain why 2026 lost money.

---

# 1. Experiment 2 reconciliation

All required matching counts were reproduced exactly before accepting the new audit.

- Primary 2025 donor n = 122 — PASS
- Primary Jan-Sep 2026 target n = 105 — PASS
- Primary Geometry greedy pairs = 82 — PASS
- Primary Full greedy pairs = 18 — PASS
- Seasonal Geometry = 60 — PASS
- Seasonal Full = 12 — PASS
- 2023-2024 Geometry = 85 — PASS
- 2023-2024 Full = 2 — PASS

Thus Experiment 3 starts from the same support geometry that produced Experiment 2.

---

# 2. Outcome-blind verification

Columns loaded from corrected event source:

- signal_t
- signal_idx
- anchor_idx
- state_id
- anchor_low
- anchor_high
- atr_h1

Shadow membership source:
- signal_t
- entry_t

Permission source:
- signal_t
- permission_on

Forbidden outcome columns loaded:
- none

Verified:
- pnl_used = false
- labels_used = false
- post_entry_path_used = false

---

# 3. Canonical primary support curve

Primary comparison:
full 2025 vs Jan-Sep 2026.

Target:
105 corrected Swing Shadow opportunities in 2026.

Donor:
122 corrected Swing Shadow opportunities in 2025.

| Stage | Active constraints | Feasible 2026 targets | Feasibility coverage | Greedy 1:1 pairs | Greedy coverage |
|---|---|---:|---:|---:|---:|
| G | Geometry | 102 | 97.14% | 82 | 78.10% |
| G+S | +State | 98 | 93.33% | 75 | 71.43% |
| G+S+J | +Session | 75 | 71.43% | 51 | 48.57% |
| G+S+J+C | +Signed Coherence | 43 | 40.95% | 31 | 29.52% |
| G+S+J+C+E | +Expansion Level | 39 | 37.14% | 28 | 26.67% |
| G+S+J+C+E+P | +Expansion Persistence | 30 | 28.57% | 18 | 17.14% |

The collapse from 82 to 18 greedy pairs has two distinct mechanisms:

1. **Feasibility loss**:
   many 2026 targets eventually have no 2025 donor satisfying all frozen pre-entry constraints.

2. **Donor competition / allocation loss**:
   even when multiple targets have feasible donors, 1:1 no-replacement allocation causes additional loss.

At Geometry alone:
- 102 / 105 targets had at least one compatible donor;
- only 82 could be allocated unique donors;
- allocation loss = 20 targets = 19.05 percentage points.

At Full:
- only 30 / 105 targets had any compatible donor;
- 18 received unique donors;
- allocation loss = 12 targets = 11.43 percentage points.

Therefore the final collapse is primarily a loss of feasible comparability, with donor competition as a secondary mechanism.

---

# 4. Canonical sequential attrition

Fixed order:
Geometry → State → Session → Coherence → Expansion Level → Persistence.

## Feasibility loss at each addition

State:
-4 targets
-3.81 percentage points

Session:
-23 targets
-21.90 pp

Signed Coherence:
-32 targets
-30.48 pp

Expansion Level:
-4 targets
-3.81 pp

Expansion Persistence:
-9 targets
-8.57 pp

In this fixed order, the largest drops occur at:
1. Signed Coherence
2. Session
3. Persistence

But this ordering is path-dependent, so it is not treated as independent attribution.

---

# 5. Order-robust support attribution

All 5! = 120 permutations of the five Composition dimensions were evaluated.

Shapley-style mean marginal **feasibility** loss:

| Dimension | Coverage loss | Share of total Geometry→Full feasibility loss |
|---|---:|---:|
| Session | 26.05 pp | **37.99%** |
| Signed Coherence | 15.73 pp | **22.94%** |
| State | 14.62 pp | **21.32%** |
| Expansion Persistence | 9.86 pp | **14.38%** |
| Expansion Level | 2.32 pp | **3.38%** |

Top two:
Session + Coherence = **60.93%**.

Four dimensions individually account for at least 10%:
- Session
- Coherence
- State
- Persistence

This satisfies the preregistered definition of:

**DISTRIBUTED MULTIDIMENSIONAL COLLAPSE**

and fails the CONCENTRATED BOTTLENECK criterion because the top two do not reach 70%.

## Greedy allocation attribution

For the Geometry→Full loss in actual 1:1 no-replacement pairs:

- Expansion Persistence: **39.95%**
- Session: 19.24%
- Coherence: 17.29%
- State: 16.77%
- Expansion Level: 6.74%

This differs from feasibility attribution because Persistence strongly affects competition for the limited donors that remain.

It does not change the primary classification.

---

# 6. Leave-one-constraint-out

Starting from FULL support:

Full feasibility:
30 / 105 = 28.57%.

Remove one constraint at a time:

| Removed constraint | Feasible targets | Coverage | Coverage restored |
|---|---:|---:|---:|
| Session | 67 | 63.81% | **+35.24 pp** |
| Coherence | 52 | 49.52% | **+20.95 pp** |
| State | 49 | 46.67% | +18.10 pp |
| Persistence | 39 | 37.14% | +8.57 pp |
| Expansion Level | 32 | 30.48% | +1.90 pp |

Session is the strongest single bottleneck diagnostic.

However removing Session does not prove Session is the independent cause of support failure:
its effect interacts with State, Coherence, Persistence, Geometry, and donor allocation.

Because the order-robust top-two share is below 70%, the preregistered classification remains distributed rather than concentrated.

---

# 7. Important Expansion finding

The audit separates **Expansion Level** from **Expansion Persistence**.

For 2025 vs 2026 Swing Shadow:

### Expansion Level
2025:
- mean 0.677
- median 0.767

2026:
- mean 0.912
- median 0.933

Empirical overlap coefficient:
**0.532**

Expansion Level is visibly higher in 2026, but its order-robust contribution to primary feasibility collapse is only:
**3.38%**.

### Expansion Persistence
2025:
- mean 0.459
- median 0.396

2026:
- mean 0.956
- median 0.983

Empirical overlap coefficient:
**0.274**

Persistence contributes materially more than Expansion Level:
**14.38%** of order-robust primary feasibility loss.

This is an important distinction:

> The support problem is not simply that 2026 had a higher instantaneous Expansion Level. The duration / occupancy of expansion is more structurally different, but still does not dominate the primary 2025-vs-2026 support collapse by itself.

---

# 8. Gradual-transition diagnostic

The historical reference makes the persistence shift much stronger.

2023-2024 vs 2026:

Expansion Persistence:
- 2023-24 median = 0.158
- 2026 median = 0.983
- overlap coefficient = **0.0346**
- **92.38%** of 2026 observations lie outside the 2023-24 donor min/max for persistence.

Expansion Level:
- 2023-24 median = 0.397
- 2026 median = 0.933
- overlap coefficient = **0.202**

Against 2025:

Persistence overlap rises from 0.0346 to **0.274**.
Expansion-level overlap rises from 0.202 to **0.532**.

This is descriptively consistent with the previously observed gradual transition:
2025 already moved partway toward the 2026 expansion environment.

This is a statement about pre-entry descriptor distributions only.

It does NOT show that Expansion caused the 2026 PnL deterioration.

---

# 9. Seasonal sensitivity

Jan-Sep 2025 vs Jan-Sep 2026 reproduces the same pattern.

Feasibility:
- Geometry: 95.24%
- +State: 90.48%
- +Session: 65.71%
- +Coherence: 34.29%
- +Expansion Level: 31.43%
- +Persistence: 22.86%

Greedy coverage:
- Geometry: 57.14%
- Full: 11.43%

Order-robust feasibility shares:
- Session: 36.60%
- Coherence: 25.86%
- Persistence: 17.41%
- State: 17.19%
- Expansion Level: 2.94%

Again:
- top two <70%;
- at least four dimensions >=10%.

The distributed-collapse conclusion is therefore not produced by October-December 2025.

---

# 10. 2023-2024 reference

2023-2024 vs Jan-Sep 2026:

Feasibility:
- Geometry: 98.10%
- Full: **4.76%**

Greedy:
- Geometry: 80.95%
- Full: **1.90%**

Order-robust feasibility shares:
- Expansion Persistence: **37.89%**
- Session: 28.71%
- Coherence: 14.68%
- State: 14.42%
- Expansion Level: 4.30%

Here Persistence becomes the largest individual contributor.

This reinforces the gradual-transition interpretation:
2025 is materially closer to 2026 than 2023-2024 is, especially in persistence.

But even here the support failure remains multidimensional.

---

# 11. Supporting pre-Permission event population

Outcome-blind supporting sample:
- all state-eligible pre-entry events: 5,107
- pre-entry executable: 5,099

2025 vs Jan-Sep 2026:
- donor = 526
- target = 484

## Feasibility

Geometry:
- 479 / 484 = **98.97%**

Full:
- 315 / 484 = **65.08%**

Thus the larger event population preserves substantially more Full feasibility than the policy-selected Shadow sample:
- Shadow Full feasibility: 28.57%
- Event Full feasibility: 65.08%

This indicates that **sample size and/or the policy-selection pipeline are contributors to the support problem**.

It does not prove which one.

## Greedy no-replacement allocation

Despite 65.08% Full feasibility:
- only 128 / 484 = **26.45%** received unique donors.

Allocation loss:
- 187 targets
- **38.64 percentage points**

Therefore the supporting event sample exhibits a strong donor-competition / allocation bottleneck.

Its feasibility loss remains distributed across dimensions:
- Session 30.57%
- Coherence 24.67%
- State 22.18%
- Persistence 18.83%
- Expansion Level 3.74%

The larger sample therefore reveals two things simultaneously:

1. Full feasible overlap is much better than in the policy-selected Shadow sample.
2. 1:1 no-replacement matching still discards many otherwise comparable targets because they compete for the same donors.

This supports the idea that pair matching may be statistically inefficient for a later estimator, but Experiment 3 does not replace it with weighting or overlap estimation.

---

# 12. State / Session composition

There are visible State × Session mix differences.

For example, in the primary Shadow sample:

State 0 / S0:
- 2025: 5.74%
- 2026: 14.29%

State 0 / S2:
- 2025: 21.31%
- 2026: 13.33%

State 5 / S1:
- 2025: 9.02%
- 2026: 1.90%

These composition shifts help explain why exact State + Session constraints reduce support.

They are not evidence that a particular session caused losses.

---

# 13. Scientific interpretation

Experiment 3 answers the question:

> Why could Experiment 2 not compare 2025 and 2026 cleanly?

Answer:

Because after Geometry, comparability erodes across multiple dimensions rather than at one single gate.

The dominant feasibility contributors in the primary 2025-vs-2026 comparison are:

1. Session
2. Signed Coherence
3. State
4. Expansion Persistence

Expansion Level is comparatively small as an incremental support constraint.

However, Expansion Persistence becomes much more dominant when 2026 is compared with 2023-2024.

Therefore the evidence is consistent with a gradually changing multidimensional opportunity distribution, with persistent expansion becoming increasingly unusual relative to earlier history.

But:

- this is not a profitability result;
- this is not causal attribution;
- this does not prove a new market regime;
- this does not justify a Productive / Destructive Expansion classifier by itself.

---

# 14. What Experiment 3 changes

Before Experiment 3:

Experiment 2 said:
> We cannot estimate the conditional PnL gap because common support is insufficient.

After Experiment 3 we know more precisely:

> The insufficiency is not mainly one bad matching variable. The Shadow opportunity population loses comparability across several dimensions. The larger pre-Permission event population has much better feasible overlap, but 1:1 no-replacement donor competition then becomes severe.

This means simply loosening one threshold would not solve the scientific problem cleanly.

---

# 15. What Experiment 3 does NOT authorize

Do NOT:

- remove Session because it is inconvenient;
- remove Coherence because it kills support;
- widen Expansion/Persistence calipers;
- allow donor reuse and call it Experiment 2;
- train Productive / Destructive Expansion now;
- infer PnL importance from Shapley support shares;
- open Pristine OOS.

Any alternative estimator such as:
- overlap weighting,
- propensity weighting,
- entropy balancing,
- low-dimensional representation,
- partial pooling,
must be a separately preregistered experiment.

---

# 16. Final classification

**DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE**

Reason:

- top two feasibility contributors = Session + Coherence = 60.93%, below the 70% concentrated threshold;
- four dimensions each contribute >=10% of total feasibility loss:
  Session, Coherence, State, Persistence;
- Full primary feasibility is only 28.57%, so the primary sample does not meet the donor-allocation classification criterion.

The supporting event sample does show severe donor competition, but it is diagnostic and does not replace the authoritative primary classification.

---

# 17. Research status

- Scalper: PARKED.
- Swing: RESEARCH ONLY.
- Experiment 2: INCONCLUSIVE.
- Experiment 3: DISTRIBUTED MULTIDIMENSIONAL_COLLAPSE.
- Cause of 2026 negative Swing PnL: still UNRESOLVED.
- Productive / Destructive Expansion: DEFERRED.
- Pristine Forward OOS: SEALED.

The next experiment should be selected from this result, not by modifying Experiment 2 post hoc.



# 18. Post-close computational verification — maximum-cardinality matching

This is a limited graph-allocation verification requested after Experiment 3 was closed. It does not change any caliper, support edge, outcome, or primary classification.

On the exact same allowed donor-target bipartite networks, maximum-cardinality matching was compared with the frozen greedy 1:1 allocator.

| Contrast | Stage | Feasible targets | Greedy | Maximum cardinality | Greedy shortfall |
|---|---|---:|---:|---:|---:|
| Primary 2025 vs 2026 | Geometry | 102 | 82 | 91 | 9 |
| Primary 2025 vs 2026 | Full | 30 | 18 | **20** | **2** |
| Seasonal 2025JS vs 2026 | Geometry | 100 | 60 | 66 | 6 |
| Seasonal 2025JS vs 2026 | Full | 24 | 12 | **13** | **1** |
| 2023-24 vs 2026 | Geometry | 103 | 85 | 103 | 18 |
| 2023-24 vs 2026 | Full | 5 | 2 | **2** | **0** |
| Supporting events 2025 vs 2026 | Geometry | 479 | 340 | 412 | 72 |
| Supporting events 2025 vs 2026 | Full | 315 | 128 | **134** | **6** |

Interpretation:

- At Geometry-only stages, greedy allocation can materially understate the largest possible pair count.
- At the final Full network, however, the greedy shortfall is small:
  - Primary: +2 pairs possible at most (18 -> 20).
  - Seasonal: +1.
  - Historical: +0.
  - Supporting events: +6.
- Therefore the severe Full-support collapse is not primarily an artifact of greedy allocation.
- Maximum cardinality still leaves 85 / 105 primary 2026 targets unmatched under the frozen Full network.

This verification refines the earlier donor-competition wording:

> Donor competition exists, especially at Geometry-only stages, but final Full-support failure is dominated by network sparsity / lack of admissible comparable donors under the frozen multidimensional constraints. Greedy suboptimality explains only a small part of the final Full pair deficit.

Artifact:
- runs/common-support-failure-audit-v01/maximum_cardinality_verification.csv

This remains a support-graph statement only. It is not a PnL result and does not identify the cause of 2026 losses.
