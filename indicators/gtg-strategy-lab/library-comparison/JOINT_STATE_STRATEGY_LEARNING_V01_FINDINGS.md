# GTG Joint State + Strategy Learning v0.1 — Findings

Date: 2026-10-03
Scope: Train-development, temporally separated fit/evaluation.
Validation and Historical Holdout remained closed.

## Design
- State Engine v0.2 provides symbolic action constraints.
- RANGE permits LONG/SHORT/FLAT.
- TREND_UP permits LONG/FLAT.
- TREND_DOWN permits SHORT/FLAT.
- TRANSITION forces FLAT.
- fixed H4 action outcome contract.
- learned primary utility model plus Ridge diagnostic.
- fit before 2021, freeze, then evaluate 2021-2024.
- action threshold predicted C1 > 0.

## Fit
- training action samples: 21,765
- RANGE long: 8,183
- RANGE short: 8,183
- TREND_UP long: 3,190
- TREND_DOWN short: 2,209
- training target mean C1: -0.215 ATR

## Evaluation model quality
Primary model:
- n=26,264
- target mean C1 -0.181
- correlation -0.013
- sign accuracy 56.0%
- predicted-positive fraction 8.2%
- realized C1 among predicted-positive rows -0.167

Ridge diagnostic:
- correlation +0.018
- sign accuracy 57.1%
- predicted-positive realized C1 -0.075

No model learns stable positive utility.

## Learned sequential policy
- decisions: 15,159
- completed trades: 988
- long: 559
- short: 429

Overall:
- C0 +0.039 ATR/trade
- C1 -0.153
- C2 -0.345
- C1 win rate 42.8%
- C1 total -151.18 ATR
- C1 per opportunity -0.0100

By state:
- RANGE n=526, C1 -0.223
- TREND_UP n=284, C1 -0.096
- TREND_DOWN n=178, C1 -0.038

By year:
- 2021 C1 -0.065
- 2022 -0.260
- 2023 -0.139
- 2024 partial -0.138

## Symbolic always baseline
- n=3,742
- C1 -0.198 ATR/trade
- C2 -0.383
- C1 win 40.7%

The learned policy is less negative than the symbolic-always baseline, but remains economically invalid.

## Registered screen
FAIL.

Passed:
- action/sample counts
- sign-accuracy threshold
- trade counts
- long/short counts
- C0 positive
- learned policy improves over symbolic always

Failed:
- prediction correlation
- C1 profitability
- C2 profitability
- C1 win rate
- year stability

## Combined conclusion with Utility v0.1
Two different joint-learning formulations have now failed:

Joint State + Strategy Utility v0.1:
- C1 -0.161
- model correlation approximately zero

Joint State + Strategy Learning v0.1:
- C1 -0.153
- model correlation approximately zero

Therefore the current H1 causal state feature representation does not support a stable action-level trading edge on the opened Train-development slice.

## Decision
Close further optimization on the opened 2018-2024 Train-development region.

Do not:
- tune model family
- tune thresholds
- tune horizons
- add another hand-written Range rule
- promote descriptive subgroups
- open Validation/Historical Holdout automatically

Next step:
- identify the formally frozen Validation/Historical-Holdout boundaries,
- establish a forward/prospective gate that cannot influence the already-closed research decisions,
- keep State Engine as a research representation, not a live edge claim.
