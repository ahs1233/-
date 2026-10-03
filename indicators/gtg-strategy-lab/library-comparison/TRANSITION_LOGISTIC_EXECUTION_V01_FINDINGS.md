# Transition Logistic Gate Execution Audit v0.1 — Findings

Date: 2026-10-03
Evidence status: exploratory Train-only post-selection audit.
Validation and Historical Holdout remained closed.

## Frozen gate
- Cohort: exact 454 resolved evaluation transitions from Transition Memory v0.1.
- Logistic model/scaler frozen before evaluation.
- Threshold remained exactly p_trend >=0.50.
- No refit or threshold tuning.
- Side-aware C0/C1/C2 arithmetic reused from compare.py.

The gate retained:
- 252 / 280 true trend transitions = 90.0%
and avoided:
- 102 / 174 RANGE resumptions = 58.6%.

## Early onset execution
Trading every transition onset was negative after C1 at every horizon.

ALL_ONSET C1/trade:
- 1 bar: -0.3155 ATR
- 4 bars: -0.3370
- 12 bars: -0.2324
- 24 bars: -0.2717

LOGISTIC_GATE reduced total damage/opportunity because it traded fewer false breaks, but did not create a positive per-trade edge.

LOGISTIC_GATE C1/trade:
- 1 bar: -0.2694 ATR
- 4 bars: -0.3612
- 12 bars: -0.2144
- 24 bars: -0.2630

LOGISTIC_GATE improvement in C1/opportunity versus trading every onset:
- 1 bar: +0.1233 ATR/opportunity
- 4 bars: +0.0797
- 12 bars: +0.0785
- 24 bars: +0.0782

Interpretation:
The classifier is useful as a false-break filter / stand-down aid, but p>=0.50 is not sufficient as an early Swing-entry trigger.

## Waiting for deterministic TREND confirmation
FSM_CONFIRMED C1/trade:
- 1 bar: -0.1811 ATR
- 4 bars: -0.0760
- 12 bars: +0.0094
- 24 bars: +0.0451

C2/trade:
- 1 bar: -0.3554
- 4 bars: -0.2522
- 12 bars: -0.1715
- 24 bars: -0.1282

Waiting for confirmation substantially improved execution quality and turned aggregate C1 slightly positive at 12/24 trading bars, but remained negative under C2.

## Time stability warning
The aggregate positive confirmed-trend C1 is not stable across years.

FSM_CONFIRMED, 12 bars:
- 2021: +0.4099 C1, +0.2232 C2, n=68
- 2022: +0.3574 C1, +0.1724 C2, n=81
- 2023: -0.5723 C1, -0.7450 C2, n=72
- 2024 partial: -1.3439 C1, n=10

FSM_CONFIRMED, 24 bars:
- 2021: +0.6839 C1, +0.5073 C2, n=63
- 2022: +0.1213 C1, -0.0562 C2, n=72
- 2023: -0.6524 C1, -0.8192 C2, n=68
- 2024 partial: +0.2160 C1, n=10

The fixed 12h/24h holding horizon therefore must not be selected as a trading rule from this sample.

## Decision
1. Keep State Engine v0.2 as market-state authority.
2. TRANSITION still means Scalper stand-down.
3. Logistic p_trend is useful context for distinguishing false breaks, but not an early-entry authorization by itself.
4. Swing entry should remain tied to confirmed TREND state.
5. Do not select a fixed 12/24-bar exit from these results.
6. Next step: build a causal Trend Lifecycle Swing Engine:
   - enter after TREND confirmation,
   - remain with the trend while the same TREND state persists,
   - exit when the state ends,
   - evaluate without optimizing a holding horizon.
7. Kronos can later be tested inside TRANSITION or trend management, but it should not replace state authority.
8. Validation/Holdout remain closed.
