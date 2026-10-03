# Kronos Swing Stress v0.1 — Findings

## Status
Completed 2026-10-03. Train-only. Validation and Historical Holdout remained closed.

## Registered stress test
- 10 quarter cohorts: 2021Q4 through partial 2024Q1.
- 60 deterministic non-overlapping anchors per quarter.
- 600 total H1 Swing anchors.
- Horizon: 4 hours.
- Same pinned Kronos source/model/tokenizer revisions as the prior positive replication.
- Same side-aware C0/C1/C2 execution arithmetic.
- No fine-tuning and no threshold tuning.

## Primary result
The previously positive Kronos Swing result did **not** replicate on the longer later Train period.

Kronos-mini:
- n = 600
- direction accuracy = 51.0%
- Wilson 95% interval = 47.0% to 55.0%
- C0 mean/trade = +0.0485 ATR
- C1 mean/trade = -0.1288 ATR
- C2 mean/trade = -0.3061 ATR
- positive C1 quarters = 3 / 10
- primary robustness screen = FAIL
- C2 cost robustness = FAIL

Drift baseline:
- direction accuracy = 50.5%
- C0 mean/trade = +0.1578 ATR
- C1 mean/trade = -0.0195 ATR
- C2 mean/trade = -0.1967 ATR

Kronos therefore failed both the absolute C1 requirement and the registered requirement to beat drift at C1.

## Time stability
Kronos C1 by quarter:
- 2021Q4: -0.0089
- 2022Q1: +0.0176
- 2022Q2: +0.0795
- 2022Q3: +0.4588
- 2022Q4: -0.4076
- 2023Q1: -0.3039
- 2023Q2: -0.0445
- 2023Q3: -0.2937
- 2023Q4: -0.6803
- 2024Q1 partial: -0.1054

Best quarter:
- 2022Q3
- direction accuracy = 75.0%
- C1 = +0.4588 ATR/trade
- C2 = +0.2877 ATR/trade

Worst quarter:
- 2023Q4
- direction accuracy = 46.7%
- C1 = -0.6803 ATR/trade
- C2 = -0.8482 ATR/trade

The single best quarter contributed ~82.5% of all positive C1 contribution. This is strong concentration/regime dependence rather than stable performance.

Half-year C1:
- 2021H2: -0.0089
- 2022H1: +0.0486
- 2022H2: +0.0256
- 2023H1: -0.1742
- 2023H2: -0.4870
- 2024H1 partial: -0.1054

## Pre-registered regime diagnostics
These are descriptive only and must not be promoted directly into a trading filter from this same sample.

### Agreement with simple market state
When Kronos agreed with both 12-bar drift and base DC:
- n = 192
- direction accuracy = 53.1%
- C1 = +0.0868
- C2 = -0.0898

When it agreed with neither:
- n = 270
- direction accuracy = 47.8%
- C1 = -0.3168

This is the clearest descriptive regime contrast, but it is post-outcome evidence within this stress sample.

### Prediction magnitude
- 0.25 to <0.5 ATR: n=152, C1 = +0.0919
- <0.25 ATR: n=244, C1 = -0.0436
- 0.5 to <1 ATR: n=153, C1 = -0.2821
- >=1 ATR: n=51, C1 = -0.7346

Larger Kronos predictions were not more reliable; the largest predictions were materially worse.

### Prediction strength relative to current cost proxy
- strength <0.5: n=93, direction accuracy 60.2%, C1 = +0.0881
- 0.5 to <1: n=89, C1 = -0.0716
- 1 to <2: n=131, C1 = -0.1378
- >=2: n=287, C1 = -0.2128

The registered "stronger prediction vs cost" intuition did not hold monotonically.

### UTC session
- London: n=155, direction accuracy 54.8%, C1 = +0.1382
- Late: n=140, C1 = -0.1191
- New York: n=132, C1 = -0.2341
- Asia: n=173, C1 = -0.2957

London is a descriptive positive regime in this sample only.

### Spread regime
- spread/ATR 0.05 to 0.10: n=373, C1 = +0.0393
- spread/ATR >0.10: n=198, C1 = -0.4331

High relative spread is strongly hostile to this signal, as expected.

### Volatility regime
- high trailing-60d volatility: n=168, direction accuracy 56.0%, C1 = -0.0566
- low: n=235, C1 = -0.1393
- mid: n=197, C1 = -0.1779

High volatility improved direction accuracy but still did not make aggregate C1 positive.

## Interpretation
Kronos showed a real-looking positive episode in the earlier replication and in 2022Q3, but the later 600-anchor stress test rejects the hypothesis that the current Kronos configuration has a stable, general Swing edge after realistic C1 costs.

The signal appears regime-dependent. The descriptive regimes most worth a future independent test are:
1. agreement with both drift and DC,
2. London UTC session,
3. moderate prediction magnitude (0.25-0.5 ATR),
4. avoiding high spread/ATR.

However, none of these may be adopted from this sample. Any selective rule requires a new preregistered experiment on another untouched Train slice.

## Decision
- Do not open Validation/Holdout.
- Do not tune Kronos on this stress sample.
- Do not promote the earlier positive 240-anchor result as established edge.
- Current Kronos-mini configuration is rejected as a general always-trade Swing engine.
- If research continues with Kronos, only a separately preregistered regime-gating replication is defensible.
