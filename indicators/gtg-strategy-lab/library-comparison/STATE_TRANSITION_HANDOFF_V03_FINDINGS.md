# GTG Confirmed Handoff v0.3 — Findings

Date: 2026-10-03
Scope: H1 XAUUSD Train-only confirmed handoff audit.
Validation and Historical Holdout remained closed.

## Integrity
All registered sanity gates PASS.
- frozen v0.2 state sequence hash unchanged
- canonical raw manifest matches v0.2
- feature prefix causality inherited PASS
- max transition age <=4 bars
- both directions represented
- no evaluation year >60%
- Validation read=false
- Holdout read=false

## Evaluation sample
- primary RANGE->TRANSITION episodes: 456
- RANGE resumed: 174 (38.2%)
- confirmed trends: 280 (61.4%)
- mature 24-bar confirmed trends: 213
  - up: 115
  - down: 98
- median resolution delay: 1 trading bar
- mean resolution delay: 1.47 bars

## Important comparison

### First breakout / onset — all primary episodes
This is not a robust directional entry:
- 4 bars: mean signed displacement -0.150 ATR
- 12 bars: -0.041 ATR
- 24 bars: -0.092 ATR
- 24-bar positive fraction: 48.4%

### Onset restricted to episodes that later became confirmed trends
These episodes were structurally different:
- 1 bar direction accuracy: 60.0%, mean +0.314 ATR
- 4 bars: 56.8%, mean +0.477 ATR
- 12 bars: 54.3%, mean +0.555 ATR
- 24 bars: 57.7%, mean +0.636 ATR

This is retrospective conditioning and cannot be used as an entry rule because future resolution is not known at onset.

### Entry measured from the confirmed resolution bar
This is the causal handoff test:
- 1 bar: 51.1%, mean -0.005 ATR
- 4 bars: 48.5%, mean +0.102 ATR
- 12 bars: 48.5%, mean +0.193 ATR
- 24 bars: 54.0%, mean +0.221 ATR

At 24 bars:
- n=213
- direction accuracy=53.99%
- mean signed displacement=+0.221 ATR
- median=+0.276 ATR
- mean MFE=2.963 ATR
- mean MAE=2.829 ATR
- final close still beyond original range boundary=66.2%
- returned inside original range at some point=59.6%

## Interpretation
The FSM is useful as a controller:
- RANGE: scalper context
- TRANSITION: stand down / uncertainty
- resolution back to RANGE: fake-break / range resumed
- resolution to TREND_UP/TREND_DOWN: candidate swing regime

However, the confirmed state alone is not yet a strong short-horizon entry trigger. The 4-bar resolved-direction accuracy is only 48.5%.

The 24-bar post-resolution distribution is mildly favorable (+0.221 ATR mean, 54.0% directional accuracy) but still too weak and noisy to promote directly into a trading rule, especially before execution costs.

## Decision
Accept State Engine v0.2 as the market-state authority for the next research phase.
Do not use first breakout as Swing entry.
Do not use confirmed resolution alone as an automatic Swing entry.

Next phase:
Build Transition Memory / Resolution Model to estimate:
- P(RANGE resumes)
- P(TREND_UP)
- P(TREND_DOWN)

Use only information available during TRANSITION:
- source range geometry/age
- DC multi-scale structure
- drift/efficiency
- volatility/spread/session
- historical episode similarity
- Kronos as an expert input, not as market-state authority

The objective is to identify which transitions are likely to resolve into a persistent trend early enough to improve the Swing handoff.
