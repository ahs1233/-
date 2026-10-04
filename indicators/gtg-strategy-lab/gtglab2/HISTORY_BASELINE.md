# GTGLab2 — Historical Baseline

GTGLab2 inherits the validated lessons of the earlier GTGLab research track.

## 1. Data foundation
- Clean/frozen M1 BID/ASK foundation established.
- Core data tests passed.
- Historical Holdout and later Pristine OOS kept protected.

## 2. Market-state framing
The research converged on:
- RANGE
- TRANSITION
- TREND_UP
- TREND_DOWN

Main lesson:
**The hard problem is not merely direction; it is state transition and entry timing.**

## 3. State Engine
Historical H1 analysis produced a usable regime model and hundreds of range-exit episodes, including both fake and true breaks.

## 4. Transition classification
A logistic classifier distinguished fake vs true breaks reasonably well, but good classification did not automatically become profitable execution.

## 5. Execution tests
Early breakout, delayed confirmation, directional-change geometry, range guards, sequence models, symbolic candidates, and Chronos-style forecasting were tested.

Repeated lesson:
**prediction/classification quality must be judged by incremental execution economics after costs and by temporal stability.**

## 6. Shift to microstructure
Price-only OHLC/H1 information was insufficient for precise execution timing.

The research therefore moved to forward collection of:
- executed-flow delta,
- order-book imbalance,
- footprint-like evidence,
- volume profile,
- cross-venue agreement.

## 7. Research-hardening lesson
Forward evidence must be collected before linking it to outcomes.

This led to:
- append-only snapshots,
- SHA256 integrity,
- source-health metadata,
- strict Fusion grading,
- readiness gates,
- canonical JForex/IHistory forward-price sealing.

## 8. GTGLab2 starting point
GTGLab2 begins after the infrastructure audit of 2026-10-04, with the collection system running and the first microstructure edge-analysis phase still locked.
