# GTGLab2 — Open Historical Batch Evaluation — 2026-10-04

Status: DEVELOPMENT / VALIDATION DIAGNOSTIC
Historical Holdout: SEALED
Pristine Forward OOS: NOT DECODED

## Scope
Batch evaluation on the currently open JForex/Python historical corpus for the existing GTGLab2 Sweep/Acceptance v0.1 logic, using:
- variant: CONTEXT
- conservative cost tier: C2
- policies: SINGLE and STAGED
- routes: ACCEPTANCE and REJECTION

The batch combines the clean Train result and the already-opened Validation result.
No Historical Holdout data is read.

## Acceptance -> Retest -> Context — SINGLE
Overall:
- n = 271
- mean = +0.05696R/trade
- total = +15.44R
- win rate = 30.26%
- profit factor = 1.058
- median = -0.765R
- max drawdown = -47.80R

Train:
- n = 231
- mean = -0.05276R
- total = -12.19R
- PF = 0.949

Validation:
- n = 40
- mean = +0.69062R
- total = +27.62R
- PF = 1.988

Yearly mean R:
- 2018: -0.219R (n=30)
- 2019: -0.347R (n=35)
- 2020: +0.459R (n=38)
- 2021: +0.432R (n=39)
- 2022: -0.287R (n=47)
- 2023: -0.618R (n=36)
- 2024: +0.785R (n=40)
- 2025 open-validation portion: +0.706R (n=6)

Direction:
- LONG: n=154, mean +0.063R, PF 1.064
- SHORT: n=117, mean +0.049R, PF 1.050

Interpretation:
The route has weakly positive aggregate expectancy across the open historical corpus, but is strongly regime/year dependent. 2024-2025 validation is strong, while 2018-2019 and 2022-2023 are negative. This is not yet a stable production edge.

## Acceptance -> Retest -> Context — STAGED
Overall:
- n = 271
- mean = -0.00772R
- total = -2.09R
- PF = 0.988

Train:
- n = 231
- mean = -0.07337R
- total = -16.95R

Validation:
- n = 40
- mean = +0.37138R
- total = +14.86R

Interpretation:
Current staging does not add robust edge and remains inferior to SINGLE.

## Rejection / Range Fade — SINGLE
Overall:
- n = 235
- mean = -0.13709R
- total = -32.22R
- win rate = 42.98%
- PF = 0.831

Train:
- n = 200
- mean = -0.08706R

Validation:
- n = 35
- mean = -0.42295R

Interpretation:
Rejection/Scalper remains rejected under the current rules.

## Rejection / Range Fade — STAGED
Overall:
- n = 235
- mean = -0.06494R
- total = -15.26R
- PF = 0.847

Interpretation:
Staging reduces damage but does not make the Rejection path profitable.

## Decision
1. Do not promote the current combined strategy.
2. Keep Acceptance/Retest + Context as the only surviving research direction.
3. The next development objective is regime selectivity: explain why 2020-2021 and 2024-2025 are positive while 2018-2019 and 2022-2023 are negative.
4. Do not relax filters merely to increase trade count.
5. Rebuild Scalper from a different hypothesis rather than tuning the rejected Rejection/Fade path.
6. Keep Historical Holdout sealed until a revised candidate is frozen.
