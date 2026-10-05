# RESULT — Overlap-Population Contrast v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0051

Protocol:
- fc00c3d — preregister overlap-population contrast v0.1

Implementation:
- 33978be — implement overlap-population contrast v0.1
- f7ec325 — fix supporting-event outcome column before any result
- 1ffd813 — streamline bootstrap computation without changing model, seed, blocks, weights, or gates

Base:
- 8c637d0

Pristine Forward OOS:
- NOT READ

## Executive verdict

**Primary classification: INCONCLUSIVE.**

The frozen overlap-weighted estimate for corrected Swing Shadow is strongly negative:

- weighted donor 2025 mean: **+0.3975R**
- weighted Jan-Sep 2026 mean: **-0.1572R**
- Delta_OW = **-0.5547R per trade**
- 95% 5-trading-day block-bootstrap CI: **[-1.1074R, -0.1350R]**

The interval is entirely below the preregistered -0.05R economic margin.

However the primary quality gates fail:

- donor ESS = **30.61 / 122 = 25.1%**
- target ESS = **49.31 / 105 = 47.0%**
- required: ESS >=50 AND ESS/raw >=40% in both periods
- donor maximum month weight share = **33.65%**
- required maximum <=25%

Therefore the experiment is not allowed to declare RESIDUAL_OVERLAP_DETERIORATION.

The defensible conclusion is:

> The measurable overlap subset shows a large negative 2026 period contrast, but that overlap subset is too small and temporally concentrated to support the preregistered decisive inference.

This result represents an overlap population only. It does NOT represent all 2026 Swing opportunities.

---

# 1. Primary sample

Corrected Swing Shadow before Health.

- 2025: 122 trades
- Jan-Sep 2026: 105 trades
- no complete-case exclusions
- no Health filtering

One frozen propensity model:
- unpenalized logistic regression
- main effects only
- same Geometry + Composition variables as Experiment 2
- no model search
- no outcome used in propensity fitting

Model convergence:
- converged = true
- iterations = 76
- convergence warnings = 0
- probability clipping = 0
- period-classification AUC = **0.9524**

High AUC here is not a trading-quality metric. It indicates that the pre-entry covariates separate the two historical periods strongly.

---

# 2. Primary overlap-weighted estimate

| Metric | 2025 donor | Jan-Sep 2026 target |
|---|---:|---:|
| Raw n | 122 | 105 |
| Weighted mean R | +0.3975R | -0.1572R |
| ESS | 30.61 | 49.31 |
| ESS / raw n | 25.1% | 47.0% |
| Max month weight share | 33.65% | 24.10% |

Difference:

**2026 - 2025 = -0.5547R**

Bootstrap:
- requested: 2,000
- successful: 2,000
- failed: 0
- 95% CI: **[-1.1074, -0.1350]**
- bootstrap mean: -0.6191R

If the quality gates had passed, this interval would satisfy the economic rule for residual deterioration.

They did not.

---

# 3. Balance

Mean balance after overlap weighting is numerically excellent.

Maximum absolute weighted SMD:
**4.89e-7**

All eleven fixed design columns are far below the 0.10 gate.

Examples:

- entry distance weighted SMD ≈ -2.2e-7
- entry spread/R ≈ -3.0e-7
- signed coherence ≈ -4.8e-8
- expansion level ≈ +1.2e-7
- expansion persistence ≈ +2.1e-7
- State / Session indicators also effectively zero

This near-exact mean balance is consistent with the use of an unpenalized logistic main-effects overlap-weighting construction.

However mean balance does NOT imply full distributional equivalence.

Weighted ECDF gaps remain non-trivial:

- entry_distance_anchor_atr: 0.225
- entry_spread_r: 0.207
- signed_coherence_24h: 0.096
- expansion_level: 0.234
- expansion_persistence: **0.290**

Thus overlap weighting aligns included covariate means while meaningful distribution-shape differences remain.

The preregistered balance gate is based on weighted SMD and therefore formally passes, but this distributional limitation is retained in interpretation.

---

# 4. How much of 2026 is represented?

For Primary Jan-Sep 2026:

- mean propensity e(X): 0.824
- median e(X): **0.890**
- median overlap weight: **0.110**

Low-overlap target opportunities:

- e >= 0.90: **47.62%**
- e >= 0.95: **37.14%**

Equivalently:
- overlap weight <=0.10: 47.62%
- overlap weight <=0.05: 37.14%

Yet these observations carry only:

- **9.86%** of normalized target overlap-weight mass for e>=0.90
- **5.71%** for e>=0.95

This is the central representativeness result.

Almost half of 2026 opportunities are strongly characteristic of 2026 under the frozen diagnostic model and are heavily downweighted in the overlap estimand.

Therefore:

> The negative Delta_OW mainly describes the subset of 2026 that still resembles historically represented 2025 opportunities. It says little about a large low-overlap portion of 2026.

---

# 5. Effective sample-size failure

Primary point estimate:

- donor ESS = 30.61
- target ESS = 49.31

Frozen gate:
- >=50 each
- >=40% of raw complete-case n each

Results:
- donor absolute ESS FAIL
- donor ESS ratio 25.1% FAIL
- target absolute ESS 49.31 FAIL narrowly
- target ESS ratio 47.0% PASS

Bootstrap stability reinforces the problem.

Across 2,000 replications:

Donor ESS:
- P10 17.63
- median 26.95
- P90 36.94

Target ESS:
- P10 28.38
- median 43.48
- P90 57.76

Only **0.1%** of bootstrap replications passed the frozen ESS gate.

Therefore the weak ESS is not a one-sample accident.

---

# 6. Temporal concentration failure

Primary normalized weight by month:

2025 donor maximum:
- **October 2025 = 33.65%**

2026 target maximum:
- July 2026 = 24.10%

Frozen maximum:
25%.

Therefore concentration gate:
**FAIL**, driven by 2025 donor weighting.

2025 donor weighted mass is concentrated mainly in:
- Oct: 33.65%
- May: 27.33%
- Nov: 17.53%
- Apr: 13.07%

Several other 2025 months receive almost no overlap weight.

This is another direct indication that the ATO contrast represents a narrow historical overlap pocket rather than the whole 2025 distribution.

---

# 7. Leave-one-month-out robustness

Primary leave-one-month-out Delta_OW remained negative in every run.

Range:
- most negative: **-0.800R**
- least negative: **-0.454R**

So the direction of the weighted contrast is not generated by one single month.

However every primary leave-one-month-out run still fails the ESS gate.

Therefore this robustness result does not upgrade the primary classification.

It supports only the statement that the negative overlap signal is not a one-month sign artifact.

---

# 8. Calendar-balanced sensitivity

Jan-Sep 2025 vs Jan-Sep 2026:

- donor n = 97
- target n = 105
- Delta_OW = **-0.6030R**
- CI = **[-2.1837, +0.1392]**
- period AUC = **0.9872**
- donor ESS = 14.46
- target ESS = 20.97
- donor max month share = 53.19%
- target max month share = 31.20%

2026 low-overlap fraction:
- e>=0.90: **81.90%**
- e>=0.95: **69.52%**

This sensitivity is substantially weaker than the full-2025 comparison.

It confirms that Jan-Sep 2025 and Jan-Sep 2026 have very little effective overlap under the frozen covariates.

Classification:
**INCONCLUSIVE**

---

# 9. Supporting pre-Permission event sample

Supporting execution-valid, outcome-resolved Swing events:

- 2025: 526
- Jan-Sep 2026: 484

Overlap-weighted result:

- donor weighted mean: +0.2386R
- target weighted mean: -0.2616R
- Delta_OW = **-0.5002R**
- CI = **[-0.9909, -0.0958]**

Balance:
- max weighted |SMD| = 1.74e-7
- PASS

ESS:
- donor = 149.42
- target = 291.24

Absolute ESS looks strong.

But ESS ratios:
- donor = **28.4%**
- target = 60.2%

Frozen gate requires >=40% in both.

Therefore ESS gate FAILS on donor representation.

Temporal concentration:
- donor max month share = **26.45%**
- target = 18.54%

Frozen max =25%.

Concentration gate also FAILS narrowly.

Classification:
**INCONCLUSIVE**

This is important because the larger event sample reproduces the same negative direction without the small Shadow sample, but still does not satisfy the preregistered representation gates.

---

# 10. Supporting event overlap representation

For 2026 event opportunities:

- e>=0.90: **32.44%**
- e>=0.95: **10.54%**

These are materially lower than the Shadow sample:
- Shadow e>=.90 = 47.62%
- Shadow e>=.95 = 37.14%

Thus the larger pre-Permission opportunity population has broader overlap than the policy-selected Shadow sample.

This is consistent with Experiment 3's finding that policy selection / smaller Shadow sample contributes to the information limit.

It does not prove a causal effect of Permission.

---

# 11. Supporting-event leave-one-month-out

Full-2025 supporting-event Delta_OW remains negative in every leave-one-month-out run.

Range:
- -0.708R to -0.365R

Again this shows directional robustness of the overlap contrast.

But the frozen donor ESS-ratio and concentration gates remain the limiting issue.

The supporting sample therefore cannot upgrade the primary result.

---

# 12. Supporting calendar-balanced events

Jan-Sep 2025 vs Jan-Sep 2026:

- donor n = 431
- target n = 484
- Delta_OW = -0.3716R
- CI = [-1.1820, +0.1900]
- donor ESS = 84.32
- target ESS = 175.50
- donor ESS ratio = 19.6%
- target ESS ratio = 36.3%
- donor max month share = 49.36%
- target max month share = 21.17%

Classification:
**INCONCLUSIVE**

---

# 13. Bootstrap diagnostics

All four comparisons completed:
- 2,000 / 2,000 successful fits
- zero failed model fits

Balance stability:
- Primary: 99.9% bootstrap balance pass
- Seasonal Primary: 89.0%
- Event full-2025: 100%
- Event seasonal: 100%

ESS-gate pass fraction:
- Primary: **0.1%**
- Seasonal Primary: 0%
- Event full-2025: **1.6%**
- Event seasonal: 0%

Therefore model convergence and mean balance are not the problem.

The binding limitation is the effective amount and temporal breadth of common information.

---

# 14. Why the result remains INCONCLUSIVE despite a negative CI

This distinction is essential.

The interval:
[-1.107, -0.135]

is entirely below the economic margin.

But the protocol deliberately requires the estimate to pass representation-quality gates before interpreting that interval as a decisive overlap-population result.

It fails because:

1. donor ESS is only 30.6
2. target ESS is 49.3
3. donor weight is concentrated 33.7% in October 2025

Therefore we do NOT state:

"2026 is definitively worse by 0.55R after adjustment."

We state:

> Among the narrow subset given meaningful overlap weight, the estimated contrast is strongly negative. But the empirical overlap population is too small and concentrated for the preregistered decisive claim.

---

# 15. What Experiment 4 adds to Experiments 2 and 3

Experiment 2:
- pair matching could not obtain adequate balanced common support.

Experiment 3:
- support failure was multidimensional;
- maximum-cardinality verification showed final Full failure was not mainly greedy inefficiency.

Experiment 4:
- weighting can achieve excellent covariate mean balance without throwing away rows;
- but it does so by assigning near-zero weight to large parts of the historical samples;
- the resulting effective overlap population is still narrow.

This is a stronger diagnosis of the information limit.

The issue is no longer simply:
"pair matching was too strict."

It is:

> A large portion of 2026 occupies pre-entry covariate regions that receive little representation from 2025, so any estimate restricted to credible overlap necessarily relies on a much smaller effective population.

---

# 16. What Experiment 4 does NOT prove

It does NOT prove:

- that Expansion caused the negative contrast
- that Persistence caused it
- that Session caused it
- that 2026 as a whole is worse by -0.55R
- that all low-overlap 2026 opportunities are bad
- that the overlap propensity model should become a trading model
- that Productive / Destructive Expansion is now validated

The period classifier exists only to construct diagnostic overlap weights.

Its coefficients are not interpreted as market-causal coefficients.

---

# 17. Final classification

**INCONCLUSIVE**

Quality gates:

- convergence: PASS
- weighted mean balance: PASS
- bootstrap success: PASS
- ESS: **FAIL**
- temporal concentration: **FAIL**

Economic interval alone would indicate negative deterioration, but quality gates take precedence.

---

# 18. Research status

- Scalper: PARKED
- Swing: RESEARCH ONLY
- Experiment 2: INCONCLUSIVE
- Experiment 3: DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE
- Experiment 4: INCONCLUSIVE due insufficient effective overlap / temporal concentration
- negative overlap contrast: persistent descriptive signal, not yet decisive
- cause of 2026 weakness: still UNRESOLVED
- Productive / Destructive Expansion: DEFERRED
- Pristine Forward OOS: SEALED

The next research decision must account for a key fact:

> The historical data do not provide a broad, well-represented 2025 analogue for much of the 2026 Swing opportunity distribution.

Any future method that estimates outcomes for those low-overlap regions would necessarily introduce stronger modeling / extrapolation assumptions.

That must be treated as a new scientific commitment, not as a technical fix to Experiment 4.
