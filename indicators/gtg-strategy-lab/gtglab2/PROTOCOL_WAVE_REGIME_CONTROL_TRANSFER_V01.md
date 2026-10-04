# PROTOCOL — Wave Regime + Control Transfer v0.1

Date: 2026-10-05

## Objective
Split the next GTGLab2 step into two specialized readers.

### Swing
Build a Higher-Order Wave / Regime reader that asks:
- Is the larger sell wave still active?
- Is downside structure exhausting?
- Has recovery started to reclaim meaningful parts of the prior wave?
- Is price making persistent lower lows or forming a base?

### Scalper
Build a local Control Transfer reader that asks:
- After the anchor low, are buyers actually taking control?
- Are higher lows accumulating?
- Are bullish bodies/returns dominating?
- Are closes reclaiming prior highs?
- Is downside pressure contracting?

No new entry trigger is invented.

## Frozen prior components
Scalper:
- trigger HIGHER_LOW_BREAK
- static states 0,5
- FIXED execution geometry

Swing:
- trigger HIGH_RECLAIM
- static states 0,4,5
- FIXED execution geometry

Pristine Forward OOS remains unread.

## Train / validation discipline
Train: 2018-2022
Validation: 2023-2024
2025-2026: consumed diagnostic only

No feature or threshold may use year identity.
No tuning on 2025-2026.
No hyperparameter search.

## Swing Wave features
Calculated causally at signal close from completed data only:
- returns over 24H / 72H / 120H / 240H normalized by known H1 ATR
- directional efficiency over 24H / 72H / 120H
- position in 72H / 120H / 240H range
- drawdown from rolling 72H / 120H / 240H high in ATR
- distance above rolling 72H / 120H / 240H low in ATR
- count of new 24H lows during previous 24H / 72H
- fraction of negative H1 closes over 24H / 72H
- lower-low fraction of H1 lows over 24H / 72H
- higher-high fraction of H1 highs over 24H / 72H
- recent 24H range versus prior 24H range
- recent 24H realized volatility versus prior 24H
- recovery from most recent 72H low / ATR
- bars since most recent 72H low
- recovery / preceding 24H decline magnitude
- last 6H return compared with previous 6H return
- last 12H return compared with previous 12H return

Model:
- Logistic Regression C=1.0
- threshold = 60th percentile of TRAIN probabilities

## Scalper Control Transfer features
At the M5 signal close, only from anchor low through signal:
- bars since anchor
- recovery from anchor / H1 ATR
- signal close location in anchor-to-signal range
- fraction of bullish M5 closes
- fraction of higher lows
- fraction of higher highs
- fraction of closes above previous high
- positive-return sum / absolute-return sum
- bullish body sum / total body sum
- last 3-bar return / ATR
- last 6-bar return / ATR
- first-half vs second-half return after anchor
- first-half vs second-half downside range
- M5 range contraction from first half to second half
- maximum adverse extension after anchor / ATR
- reclaim above anchor midpoint / range
- M15 1H drift and its change
- M5 60m drift and its change

Model:
- Logistic Regression C=1.0
- threshold = 60th percentile of TRAIN probabilities

## Label
Independent original FIXED trade outcome:
- positive if pnl R > 0
- outcome is training label only and never a feature

## Execution
Score all frozen eligible events.
Allow only scores >= frozen Train threshold.
Re-run overlapping FIXED scheduler on selected events.
Skipped events free later events to be considered.

## Evaluation
Report:
- Train / Validation / consumed AUC
- Train / Validation / consumed execution
- annual 2018-2026 execution
- top coefficients
- comparison with previous static-state and State Evolution baselines

## Promotion criterion
Research improvement only if:
- Validation AUC > 0.55
- Validation PF > 1
- Validation mean R > 0
- improves previous relevant baseline in Validation PF or mean R
- annual behavior is materially less brittle

No production promotion from this experiment alone.
