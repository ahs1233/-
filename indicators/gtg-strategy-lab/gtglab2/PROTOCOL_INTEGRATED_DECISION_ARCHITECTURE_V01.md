# PROTOCOL — Integrated Decision Architecture v0.1

Date: 2026-10-05

## Objective
Apply the evidence-backed GTGLab2 hierarchy over the full historical period without retuning 2025-2026.

Architecture:

Higher-order permission
-> static market-state eligibility
-> local transition/control transfer
-> execution
-> shadow health
-> live risk ON/OFF

## Data discipline
Historical period:
- 2018-03-01 through 2026-09-30

Train information used for frozen score thresholds:
- 2018-2022 only

Validation:
- 2023-2024

Consumed diagnostic:
- 2025-2026

Pristine Forward OOS remains unread.

## Scalper stack
1. Static eligible states: 0 and 5.
2. Trigger: HIGHER_LOW_BREAK.
3. Control Transfer model: Wave Regime + Control Transfer v0.1.
4. Frozen score threshold: 0.6476279441988548.
5. Execution geometry unchanged:
   - stop = anchor low -0.75 H1 ATR
   - target = anchor low +1.5 H1 ATR
   - timeout = 12H.
6. Regime-health brake:
   - previous 20 CLOSED shadow trades only;
   - risk OFF when trailing total R <= -5R OR PF <= 0.80;
   - fewer than 20 closed trades => risk ON.

No additional Scalper filter is introduced.

## Swing stack
1. Static eligible states: 0, 4 and 5.
2. Trigger: HIGH_RECLAIM.
3. Higher-order Wave score from Wave Regime + Control Transfer v0.1.
4. Convert the Wave score from a per-trade predictor into persistent permission.

### Frozen hysteresis
Using TRAIN score distribution only:
- OFF -> ON when the mean score of the latest 3 eligible Swing events >= 0.3638891877385444 (Train Q60).
- ON -> OFF when the mean score of the latest 3 eligible Swing events <= 0.3452352635993130 (Train median).
- between the two thresholds: retain prior permission state.
- fewer than 3 eligible events: permission OFF.

This is a slow permission layer; it does not rank the individual trade once permission is ON.

5. Execution geometry unchanged:
   - stop = anchor low -1.0 H1 ATR
   - target = anchor low +4.0 H1 ATR
   - timeout = 72H.

6. Regime-health brake:
   - previous 20 CLOSED permitted shadow trades only;
   - risk OFF when trailing total R <= -5R OR PF <= 0.80;
   - fewer than 20 closed trades => risk ON.

## Causality
At each decision:
- only current/past price-derived score is available;
- rolling permission uses current and previous causal Wave scores;
- health uses only trades that CLOSED before the next entry;
- no future outcome enters either permission or health.

## Reporting
For each engine report:
- eligible events
- wave/control-transfer selected events
- shadow trades after overlap
- live trades after health brake
- skipped trades and their shadow PnL
- yearly 2018-2026:
  trades, total R, mean R, PF, win rate, max drawdown
- full-period aggregate
- 2025 and 2026 explicitly
- compare against the immediately preceding relevant architecture.

No parameter changes after results are seen.
