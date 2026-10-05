# RESULT — Swing Opportunity Composition vs Conditional Path v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0049

Protocol commit:
- 5ad2a38 — preregister Swing Opportunity Composition vs Conditional Path v0.1

Implementation commits:
- 3885e4c — initial implementation
- ebd5fed — technical shadow-merge fix before any matching result
- 7d5cea0 — vectorized matching without protocol change
- 041c621 — Numba acceleration of the same frozen greedy matching

Pristine Forward OOS:
- NOT READ

## Executive verdict

**Primary classification: INCONCLUSIVE.**

The experiment did NOT establish that the corrected 2026 Swing weakness is primarily caused by:
- Entry Geometry,
- Opportunity Composition,
- or a residual Conditional Path change.

The reason is methodological, not semantic:

> We did not obtain enough well-balanced matched comparisons under the preregistered design to estimate the conditional performance difference with confidence.

The primary 2025-vs-Jan-Sep-2026 full matching stage retained only:
- 18 of 105 target 2026 Shadow trades = 17.14%
- 18 of 122 donor 2025 Shadow trades = 14.75%

and matching balance FAILED.

Therefore the full-matched PnL difference and the post-entry path differences are not allowed to support a decisive conditional-path conclusion.

This experiment establishes a limit of the available comparison under the frozen matching design. It does NOT justify a Productive / Destructive Expansion model.

---

# 1. Primary result table

Primary population:
corrected Swing Shadow trades BEFORE Health.

| Stage | 2025 donor / 2026 target | Coverage / balance | Mean R difference: 2026 - 2025 | 95% block-bootstrap interval |
|---|---:|---|---:|---:|
| Raw | 122 / 105 | not matched | **-0.2609R** | [-0.5610, -0.0038] |
| Geometry matched | 82 pairs | target 78.10%; donor 67.21%; support ADEQUATE; **balance FAILED** | **-0.4295R** | [-0.7613, -0.0580] |
| Geometry + Composition | 18 pairs | target 17.14%; donor 14.75%; **support INSUFFICIENT; balance FAILED** | -0.8324R | [-1.7203, +0.3064] |

Interpretation:

- The RAW difference is negative, but its interval spans effects from materially negative to near zero. Under the preregistered +/-0.05R economic margin, this is **INCONCLUSIVE**, not proof that the gap disappeared and not proof of a material conditional deterioration.
- Geometry matching retained a substantial fraction of 2026, and its interval was materially negative. However **balance failed badly**, primarily on entry_spread_r, and only 54.6% of bootstrap replications achieved adequate support. Therefore the geometry-matched difference cannot be used as a decisive causal/conditional estimate.
- Full Geometry+Composition matching collapsed to 18 pairs and balance also failed. The bootstrap achieved adequate support in 0% of replications. The resulting R estimate is therefore not inferentially usable.

## Critical distinction

Coverage and balance are separate gates.

The Geometry stage had 78.1% 2026 coverage but FAILED balance:
- entry_distance_anchor_atr SMD = -0.043
- bars_from_anchor SMD = -0.060
- **entry_spread_r SMD = -1.022**

Thus a high pair count did not create a valid balanced comparison.

---

# 2. Calendar-balanced sensitivity

Comparison:
Jan-Sep 2025 vs Jan-Sep 2026.

| Stage | 2025 donor / 2026 target | Coverage / balance | Mean R difference | 95% interval |
|---|---:|---|---:|---:|
| Raw | 97 / 105 | not matched | -0.2053R | [-0.5372, +0.0721] |
| Geometry matched | 60 pairs | target 57.14%; donor 61.86%; LIMITED; **balance FAILED** | -0.3904R | [-0.7394, +0.0648] |
| Geometry + Composition | 12 pairs | target 11.43%; donor 12.37%; **INSUFFICIENT; FAILED** | -0.6108R | [-1.8773, +0.9898] |

This sensitivity confirms the same conclusion:
**INCONCLUSIVE**.

The result is not rescued by aligning the calendar months.

---

# 3. Historical consumed reference

Comparison:
2023-2024 vs Jan-Sep 2026.

| Stage | 2023-24 donor / 2026 target | Coverage / balance | Mean R difference | 95% interval |
|---|---:|---|---:|---:|
| Raw | 289 / 105 | not matched | -0.1862R | [-0.4732, +0.0912] |
| Geometry matched | 85 pairs | target 80.95%; donor 29.41%; ADEQUATE; **balance FAILED** | -0.3349R | [-0.6530, +0.1481] |
| Geometry + Composition | 2 pairs | target 1.90%; donor 0.69%; **INSUFFICIENT; FAILED** | not interpretable | not interpretable |

The apparent 0.0R estimate in the two-pair full-match output is explicitly NOT treated as practical equivalence because:
- only two pairs were available;
- support was insufficient;
- balance failed catastrophically.

The protocol's support/balance gates override the numeric point estimate.

---

# 4. Where common support was lost

## Primary Swing Shadow sample

### Full 2025 -> Jan-Sep 2026
- donor 2025: 122
- target 2026: 105
- Geometry pairs: 82
  - 2026 coverage: 78.10%
  - 2025 coverage: 67.21%
- Full Geometry+Composition pairs: 18
  - 2026 coverage: 17.14%
  - 2025 coverage: 14.75%

### Jan-Sep 2025 -> Jan-Sep 2026
- donor 2025: 97
- target 2026: 105
- Geometry pairs: 60
  - target coverage: 57.14%
  - donor coverage: 61.86%
- Full pairs: 12
  - target coverage: 11.43%
  - donor coverage: 12.37%

### 2023-2024 -> Jan-Sep 2026
- donor: 289
- target: 105
- Geometry pairs: 85
  - target coverage: 80.95%
  - donor coverage: 29.41%
- Full pairs: 2
  - target coverage: 1.90%
  - donor coverage: 0.69%

## Pair uniqueness / weights

Frozen matching was:
- deterministic 1:1 nearest neighbor;
- WITHOUT replacement;
- unit weight per pair.

Verified:
- primary Geometry: 82 rows, 82 unique targets, 82 unique donors, zero duplicates
- primary Full: 18 / 18 / 18, zero duplicates
- calendar-balanced Full: 12 / 12 / 12, zero duplicates
- historical Full: 2 / 2 / 2, zero duplicates

No donor reuse occurred.

---

# 5. Matching balance

## Primary Geometry

- entry_distance_anchor_atr: SMD -0.043
- bars_from_anchor: SMD -0.060
- entry_spread_r: **SMD -1.022**

The major imbalance was spread cost in R.

Descriptively:
- matched 2026 mean entry_spread_r = 0.02058
- matched 2025 donor mean = 0.02876

This does NOT prove that 2026 geometry was economically better. It only shows that the matched samples remained different on an important preregistered geometry variable.

## Primary Full matching

Even among only 18 pairs:
- entry_spread_r SMD = -1.024
- expansion_level SMD = -0.321
- expansion_persistence SMD = +0.464

Therefore the 18 full pairs were neither numerous enough nor balanced enough for a conditional-path inference.

---

# 6. Dependence-aware uncertainty

Primary moving-block bootstrap:
- block length: 5 observed trading days
- requested: 2,000 replications
- matching rerun inside each replication

## Raw
- 2,000 / 2,000 successful
- stable

## Geometry
- 2,000 / 2,000 successful
- only 1,092 / 2,000 = 54.6% achieved ADEQUATE support
- preregistered stability requirement: >=90%
- therefore **UNSTABLE**

## Full
- 2,000 / 2,000 successful
- 0 / 2,000 achieved ADEQUATE support
- median matched sample: 14
- P10: 9
- P90: 19
- therefore **UNSTABLE**

This is a direct reason for the INCONCLUSIVE classification.

---

# 7. Supporting all-event population

Supporting population:
all 5,107 state-eligible Swing decision events BEFORE Permission / overlap prevention.

Reconciliation:
- all state-eligible events: 5,107
- Permission ON: 2,320
- execution-valid resolved: 5,099
- invalid/censored: 8
- Permission + valid: 2,314
- Shadow executed after overlap prevention: 1,177
- Permission-valid but overlap/suppression prevented Shadow execution: 1,137

This sample is diagnostic only.
Its overlapping outcomes are NOT portfolio PnL.

## 2025 vs Jan-Sep 2026 supporting events

Resolved event donors / targets:
- 2025: 526
- 2026: 484

Raw:
- delta = -0.3967R
- 95% interval [-0.6982, -0.1414]

Geometry:
- 340 pairs
- target coverage 70.25%
- donor coverage 64.64%
- support ADEQUATE
- **balance FAILED**
- delta -0.3952R
- interval [-0.7194, -0.1433]

Full:
- 128 pairs
- target coverage 26.45%
- donor coverage 24.33%
- **support INSUFFICIENT**
- **balance FAILED**
- delta -0.5727R
- interval [-1.0795, -0.1087]

The larger event sample shows a descriptive deterioration in 2026, but it does NOT overturn the primary INCONCLUSIVE result because the preregistered matched comparison still fails support/balance.

It suggests that the issue is not created only by Wave Permission / overlap filtering, but this is a supporting diagnostic statement, not a causal conclusion.

---

# 8. Path diagnostics

Path analysis was preregistered, but because the full primary match had only 18 inadequately balanced pairs, these findings are SECONDARY / NON-DECISIVE.

On the 18 full-matched pairs, 2026 minus 2025:

- MAE: -0.299R
  - CI [-0.626, +0.074]
- MFE: **-0.313R**
  - CI [-0.703, -0.197]
- path asymmetry: **-0.612R**
  - CI [-1.237, -0.202]
- reached +1R: -27.8 percentage points
  - CI [-50.0pp, -5.9pp]
- reached -1R: +27.8 percentage points
  - CI [+5.9pp, +55.6pp]
- anchor recross: +27.8 percentage points
  - CI [-5.9pp, +55.6pp]
- reclaim close loss: +5.6 percentage points
  - wide interval crossing zero

These diagnostics are directionally consistent with worse post-entry paths in the tiny matched subset.

However:

> They cannot establish CONDITIONAL PATH because the primary full matched sample failed both common-support and balance gates.

The experiment therefore does NOT authorize a new path-regime model from these numbers.

---

# 9. Monthly concentration

Corrected Swing Shadow:

## 2025
- Jan: -4.44R
- Feb: +5.80R
- Mar: +4.89R
- Apr: +2.31R
- May: +1.80R
- Jun: -2.71R
- Jul: -0.38R
- Aug: +0.99R
- Sep: +3.96R
- Oct: +6.26R
- Nov: +2.85R
- Dec: +0.82R

Total:
+22.14R.

## Jan-Sep 2026
- Jan: +1.06R
- Feb: -0.30R
- Mar: -0.99R
- Apr: -3.33R
- May: -4.48R
- Jun: -2.47R
- Jul: -4.33R
- Aug: +2.72R
- Sep: +3.79R

Total:
-8.34R.

The weakness is concentrated mainly in Apr-Jul 2026, but it is not a single isolated losing month.

Leave-one-month-out diagnostics retained negative point estimates, but every full-match run remained:
- support INSUFFICIENT
- balance FAILED

Therefore month robustness cannot rescue inferential validity.

---

# 10. Novelty sensitivity

Excluding observations above the TRAIN Q95 state-distance threshold:

- 2025 donor n = 92
- 2026 target n = 86
- full matched pairs = 11
- target coverage = 12.79%
- support INSUFFICIENT
- balance FAILED
- point delta = -0.629R

Thus simply removing high-novelty states does not create a usable common-support comparison.

No causal interpretation is made.

---

# 11. Health overlay

Health is separate from the primary inference.

## 2025 full
- Shadow: 122 trades, +22.144R
- Health-live: 95 trades, +22.479R
- exposure: 77.9%
- blocked subset: -0.335R

## Jan-Sep 2026
- Shadow: 105 trades, -8.337R
- Health-live: 65 trades, -9.496R
- exposure: 61.9%
- blocked subset: **+1.158R**

Therefore in this period Health actually removed a net-positive subset and made realized live historical PnL worse.

This reinforces the rule that Health cannot be used to define the underlying opportunity-quality conclusion.

---

# 12. Accelerator equivalence verification

The original slower matching implementation produced the primary result files before performance acceleration.

Frozen pre-acceleration SHA256:

- primary_geometry_matches.csv
  316AEA216970E868D346832E3788E503DFA390CBA51516B172195A2B2BB477AC
- primary_full_matches.csv
  83C2EF41F83887846CFBE540B4DDC2F77D71A5144C923C1D7F24779541231683
- calendar_balanced_matches.csv
  86C3AF77153FFDB969D6CD4AD15606E13CDB83B997CA3A628734359D068BF1DB
- historical_reference_matches.csv
  55BF122F96DD263ABBB43B9C54A0EC1E8E5B5383678E62E4B0B07700653FFEE0
- stage_summary.csv
  B90CAA7E604AEDDAB719D9D9C30153AC150FFC2886490039A09F8481121C16B4

After vectorization / Numba acceleration, all five files reproduced the SAME SHA256 values exactly.

Therefore the accelerated implementation reproduced:
- the same pair identifiers,
- the same pair distances,
- the same exclusions,
- the same stage outputs.

Matching used unit weights and no replacement; duplicate donor/target counts were zero.

The acceleration changed computation only, not the matching result.

---

# 13. What this experiment DOES establish

1. The raw corrected Swing result is materially different between the periods at the point-estimate level.
2. The preregistered matching design cannot produce a sufficiently supported AND balanced full comparison.
3. Common-support collapse is especially severe when State/session/coherence/Expansion level/persistence are added to geometry.
4. The larger pre-Permission event sample also shows negative 2026 raw outcomes, but full matched support remains inadequate.
5. A tiny full-matched subset shows worse 2026 path behavior, but it cannot support a conditional-path conclusion.
6. The current data/design cannot determine whether Geometry, Composition, or Conditional Path is the dominant explanation.

---

# 14. What this experiment DOES NOT establish

It does NOT establish that:
- the 2026 environment was categorically "different" in a causal sense;
- Geometry is innocent;
- Composition caused the loss;
- Conditional Path caused the loss;
- Expansion caused the loss;
- Productive / Destructive Expansion is a validated representation.

Weak matching may reflect:
- genuine distributional separation,
- finite sample size,
- strict multidimensional calipers,
- or a combination.

The correct statement is:

> We did not find enough balanced comparable observations under the preregistered design to estimate the conditional performance difference confidently.

---

# 15. Final classification

**INCONCLUSIVE**

Triggered by:
- full common support <50%;
- failed matching balance;
- unstable bootstrap;
- uncertainty too wide for the preregistered +/-0.05R economic decision;
- same failure repeated in the calendar-balanced sensitivity.

The supporting event sample does not override this primary classification.

---

# 16. Research decision

- Scalper remains PARKED.
- Swing remains a RESEARCH candidate, not a proven edge.
- Cause of 2026 Swing weakness remains UNRESOLVED.
- Productive / Destructive Expansion model remains DEFERRED.
- Pristine Forward OOS remains SEALED.

Do NOT relax Experiment 2 calipers post hoc.

Do NOT rerun Experiment 2 with looser matching and call it the same experiment.

Any next experiment must be separately preregistered and motivated by this failure mode.

The next research step must be selected only after reviewing this complete report.

