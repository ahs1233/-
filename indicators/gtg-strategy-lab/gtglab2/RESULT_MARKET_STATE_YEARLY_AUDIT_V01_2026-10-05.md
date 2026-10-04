# RESULT — Market State Engine Year-by-Year Audit v0.1

Date: 2026-10-05
Period: 2018-03-01 through 2026-09-30

Frozen system:
- Scalper entry: HIGHER_LOW_BREAK
- Scalper accepted states: 0, 5
- Scalper management: FIXED
- Swing entry: HIGH_RECLAIM
- Swing accepted states: 0, 4, 5
- Swing management: FIXED

No parameters were changed for this audit.
Pristine Forward OOS remained unread.

## Scalper yearly

| Year | Trades | Total R | Mean R | PF | Win rate | Max DD R | Avg entry RR |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2018* | 323 | -4.332 | -0.0134 | 0.967 | 59.13% | -18.769 | 0.709 |
| 2019 | 311 | -1.359 | -0.0044 | 0.988 | 63.02% | -14.378 | 0.631 |
| 2020 | 307 | +34.056 | +0.1109 | 1.414 | 72.31% | -4.722 | 0.573 |
| 2021 | 376 | +26.716 | +0.0711 | 1.249 | 70.21% | -11.713 | 0.575 |
| 2022 | 399 | -18.908 | -0.0474 | 0.885 | 56.89% | -25.029 | 0.714 |
| 2023 | 373 | +3.328 | +0.0089 | 1.025 | 62.73% | -18.472 | 0.663 |
| 2024 | 344 | +9.544 | +0.0277 | 1.081 | 64.83% | -13.712 | 0.632 |
| 2025 | 303 | -1.614 | -0.0053 | 0.985 | 64.36% | -14.070 | 0.632 |
| 2026** | 289 | -10.066 | -0.0348 | 0.907 | 62.63% | -22.229 | 0.618 |

Full period:
- 3,025 trades
- +37.364R
- PF 1.035
- 4 positive years / 5 negative years

Scalper conclusion:
The full-period result is positive only because 2020 and 2021 contribute strongly.
The edge is not stable year by year.

## Swing yearly

| Year | Trades | Total R | Mean R | PF | Win rate | Max DD R | Avg entry RR |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2018* | 236 | +6.628 | +0.0281 | 1.044 | 35.17% | -20.079 | 2.078 |
| 2019 | 224 | +39.105 | +0.1746 | 1.301 | 41.96% | -19.599 | 1.949 |
| 2020 | 212 | +13.888 | +0.0655 | 1.110 | 40.09% | -12.206 | 1.808 |
| 2021 | 280 | -25.677 | -0.0917 | 0.857 | 36.07% | -43.186 | 1.741 |
| 2022 | 285 | -11.376 | -0.0399 | 0.939 | 34.39% | -42.325 | 2.004 |
| 2023 | 276 | +3.720 | +0.0135 | 1.021 | 36.59% | -21.941 | 1.927 |
| 2024 | 244 | +34.784 | +0.1426 | 1.240 | 40.57% | -13.036 | 1.952 |
| 2025 | 234 | +39.167 | +0.1674 | 1.284 | 41.03% | -13.761 | 1.921 |
| 2026** | 213 | -41.927 | -0.1968 | 0.722 | 29.58% | -50.404 | 1.951 |

Full period:
- 2,204 trades
- +58.312R
- PF 1.042
- 6 positive years / 3 negative years

Swing conclusion:
The full-period total is positive, but yearly stability is poor.
The system has strong good years and severe bad years.

## Swing state contribution by year

### 2021
- State 0: -21.173R, PF 0.804
- State 4: +0.368R, PF 1.013
- State 5: -4.873R, PF 0.887

### 2022
- State 0: -5.983R, PF 0.947
- State 4: -0.682R, PF 0.970
- State 5: -4.711R, PF 0.908

### 2025
- State 0: +15.900R, PF 1.214
- State 4: +18.078R, PF 2.004
- State 5: +5.189R, PF 1.114

### 2026
- State 0: -29.339R, PF 0.694
- State 4: -8.858R, PF 0.631
- State 5: -3.730R, PF 0.880

## Main finding

The key problem is broader than one bad state.

In 2025 all three accepted Swing states were positive.
In 2026 all three became negative.

Therefore the current state representation is not yet deep enough to recognize a higher-order regime change.

The engine can distinguish:
- strong downtrend,
- range recovery,
- local selloff in neutral context,

but it still misses something that changes the behavior of ALL of them together.

This supports the user's framing:
market reading cannot stop at a static state label.
The engine needs to understand:
- how the state is evolving,
- whether volatility/impulse structure is changing,
- whether buyers actually gain control after rejection,
- and whether the trade is behaving as expected after entry.

## Decision
- Do not promote current Market State Engine.
- Do not optimize against 2026.
- Keep year-by-year audit as a robustness gate.
- Next state version should model state transition and trade-path behavior, not just state-at-entry.

*2018 begins 2018-03-01.
**2026 ends 2026-09-30.
Pristine Forward OOS remained unread.
