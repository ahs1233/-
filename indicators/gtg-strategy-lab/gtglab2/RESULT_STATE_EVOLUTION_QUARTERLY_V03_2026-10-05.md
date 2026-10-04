# RESULT — Quarterly Adaptive State Evolution v0.3

Date: 2026-10-05

## Design
Quarterly causal retraining using only the previous 4 completed quarters.
Same State Evolution features, same Logistic C=1, same 60th-percentile training threshold, same triggers/states, same FIXED management.

Pristine Forward OOS remained unread.

# Scalper

Aggregate 2021Q1-2026Q3:
- 1,085 trades
- +20.765R
- mean +0.01914R
- PF 1.072
- DD -24.139R
- win 72.53%

2026:
Q1:
- +0.155R
- PF 1.010
- AUC 0.562

Q2:
- -5.951R
- PF 0.603
- AUC 0.618

Q3:
- +2.868R
- PF 1.311
- AUC 0.611

Interpretation:
Quarterly adaptation can react after Q2 and recover Scalper in Q3, but it does not prevent the Q2 loss.

# Swing

Aggregate 2021Q1-2026Q3:
- 914 trades
- -22.307R
- mean -0.02441R
- PF 0.961
- DD -57.344R
- win 37.86%

2026:
Q1:
- 26 trades
- -6.869R
- PF 0.618
- AUC 0.429

Q2:
- 46 trades
- -10.500R
- PF 0.672
- AUC 0.561

Q3:
- 38 trades
- -11.190R
- PF 0.588
- AUC 0.459

Critical result:
Q3 model had already seen Q2 2026 in its four-quarter training window.
It still selected a losing subset and produced AUC below random.

Therefore faster retraining alone does not solve Swing.

## Conclusion
The Swing problem is no longer primarily:
- stale model
- annual cadence
- quarterly cadence

It is now:
the predictive feature set cannot reliably identify when the Swing engine's relationship has broken.

A separate management / regime-health layer is required.

Next:
- keep a shadow execution stream
- measure recent realized strategy health causally
- reduce or stop live risk when recent performance breaks
- continue shadow tracking so the engine can recover without manual intervention

Pristine Forward OOS remained unread.
