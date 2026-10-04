# PROTOCOL — State Evolution Engine v0.1

Date: 2026-10-05

## Objective
Extend Market State Engine from a static state-at-entry snapshot to causal state evolution:
- Is selling pressure accelerating or decelerating?
- Is directional efficiency strengthening or weakening?
- Is the market in a multi-day directional regime or a local selloff inside neutral structure?
- Is the M5 transition occurring after genuine recovery from the anchor low?
- Is the state itself stable or rapidly changing?

Architecture:
H1 higher-order regime -> M15 state evolution -> M5 transition -> fixed execution.

## Frozen prior components
Do not change:
- Scalper trigger: HIGHER_LOW_BREAK
- Scalper states: 0, 5
- Swing trigger: HIGH_RECLAIM
- Swing states: 0, 4, 5
- Management: FIXED
- Risk geometry and timeouts from prior experiments

No entry-rule switching.

## Causal evolution features

### Momentum evolution
- change in M5 15m drift versus 15m earlier
- change in M5 60m drift versus 60m earlier
- change in M5 60m efficiency versus 60m earlier
- change in M15 1H drift versus 1H earlier
- change in M15 5H drift versus 1H earlier
- change in M15 1H efficiency versus 1H earlier
- change in H1 5H drift versus 1H earlier
- change in H1 5H efficiency versus 1H earlier

### Higher-order regime
All measured at signal M5 close using completed history only:
- 24H return / known H1 ATR
- 72H return / known H1 ATR
- 120H return / known H1 ATR
- 24H directional efficiency
- 72H directional efficiency
- position inside 120H range
- 24H range / H1 ATR
- 72H range / H1 ATR
- 1H volatility / 24H volatility
- fraction of negative M5 closes over prior 12H

### State evolution
Using the already-fit 6-state price map:
- number of state changes in previous 1H
- number of state changes in previous 3H
- whether current state differs from state 1H ago

### Transition episode
Known at signal close:
- bars from latest anchor low
- recovery from anchor low / H1 ATR
- anchor candle range / H1 ATR
- recovery path efficiency from anchor to signal
- fraction of bullish M5 closes from anchor to signal
- fraction of higher lows from anchor to signal

No future information enters features.

## Label for learning
For each eligible event independently:
- execute the original FIXED geometry from next M5 open
- label positive if fixed-policy pnl R > 0
- future outcome is a training label only, never a feature

## Model
One interpretable Logistic Regression per engine.
- StandardScaler
- median imputation
- C = 1.0 fixed
- max_iter = 3000

No hyperparameter search.

Train:
- 2018-2022

Threshold:
- fixed at the 60th percentile of TRAIN probabilities
- therefore keeps the strongest ~40% of Train events
- validation outcomes do not choose the threshold

Validation:
- 2023-2024

Consumed diagnostic:
- 2025-2026
- never treated as fresh OOS

## Execution evaluation
After scoring all eligible events:
- only events >= frozen threshold are allowed
- then re-run the real overlapping FIXED execution scheduler
- skipped rejected events free the engine to consider later signals

Report:
- AUC
- trade metrics
- year-by-year results
- score distribution by year
- strongest positive/negative logistic coefficients

## Success criteria
State Evolution is useful only if:
1. Validation AUC > 0.55
2. Validation PF > 1 and mean R > 0
3. Validation result is better than the prior static-state baseline on mean R or PF
4. consumed 2025-2026 is reported unchanged, with no retuning

No production promotion from this study alone.

Pristine Forward OOS remains unread.
