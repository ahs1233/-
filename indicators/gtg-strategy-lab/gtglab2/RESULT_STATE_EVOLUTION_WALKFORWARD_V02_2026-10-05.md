# RESULT — Adaptive Walk-Forward State Evolution v0.2

Date: 2026-10-05

## Design
Annual causal retraining.
For each test year Y:
- train only on Y-3 through Y-1
- same State Evolution v0.1 features
- same Logistic Regression C=1
- threshold = 60th percentile of training probabilities
- same triggers, states, FIXED management and risk geometry
- no future leakage

Pristine Forward OOS remained unread.

# Scalper

Annual results:
- 2021: +21.971R, PF 1.494
- 2022: -13.536R, PF 0.723
- 2023: +11.855R, PF 1.293
- 2024: +0.692R, PF 1.013
- 2025: +12.529R, PF 1.290
- 2026: -0.906R, PF 0.981

Aggregate 2021-2026:
- 1,107 trades
- +32.605R
- mean +0.02945R
- PF 1.117
- DD -16.874R
- win 74.53%

2026:
- AUC 0.643
- selected-event positive rate 73.26%
- execution almost flat: -0.906R

Conclusion:
Adaptive learning preserves the Scalper classification edge, but low payoff geometry remains the limiting factor.

# Swing

Annual results:
- 2021: -19.418R, PF 0.846
- 2022: -4.667R, PF 0.956
- 2023: -9.564R, PF 0.903
- 2024: +13.420R, PF 1.149
- 2025: +12.295R, PF 1.146
- 2026: -27.905R, PF 0.700

Aggregate 2021-2026:
- 986 trades
- -35.838R
- mean -0.03635R
- PF 0.940
- DD -45.758R
- win 39.45%

2026:
- trained only on 2023-2025
- AUC 0.503
- selected-event positive rate 27.52%
- -27.905R, PF 0.700

Conclusion:
Annual retraining does NOT solve Swing.

## 2026 quarter diagnosis

Static Swing state engine:
- Q1: -5.329R, PF 0.828
- Q2: -29.804R, PF 0.566
- Q3: -6.793R, PF 0.867

State Evolution v0.1 Swing:
- Q1: -7.391R, PF 0.704
- Q2: -14.761R, PF 0.566
- Q3: -5.251R, PF 0.813

All eligible Swing events in 2026:
Q1:
- positive rate 38.38%
- mean independent R +0.0018

Q2:
- positive rate 17.59%
- mean independent R -0.5216

Q3:
- positive rate 31.36%
- mean independent R -0.0302

Critical finding:
The main 2026 break occurred rapidly in Q2 rather than as a smooth annual deterioration.

Therefore annual adaptation is too slow for the Swing regime shift.

## Decision
- Retain adaptive concept for Scalper.
- Reject annual cadence as solution for Swing.
- Next experiment: quarterly causal adaptation using the previous 4 completed quarters only.
- Do not change feature set, model, threshold rule, triggers, states or management.

Pristine Forward OOS remained unread.
