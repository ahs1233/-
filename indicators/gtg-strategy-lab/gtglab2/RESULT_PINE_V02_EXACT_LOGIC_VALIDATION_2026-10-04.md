# GTGLab2 Pine v0.2 Exact-Logic Emulation — Validation

Date: 2026-10-04
Scope: Exact logic of the user-supplied Pine v0.2, emulated on clean JForex BID OHLC.
Validation window: 2024-03-20T19:20:24.500Z -> 2025-03-25T01:04:34.300Z
Historical Holdout: NOT READ

## Result
- Trades: 40
- Long: 31
- Short: 9
- Winners: 16
- Losers: 24
- Win rate: 40.0%
- Total: +33.24598R
- Mean: +0.83115R/trade
- Median: -0.54552R
- Profit factor: 2.3425
- Synthetic net cash at 1R=$100: +$3,324.60

## Important interpretation
This evaluates the exact supplied Pine v0.2 logic, not the separate GTGLab2 Python strategy implementation.
The emulation uses clean JForex BID OHLC, so it is not expected to reproduce OANDA TradingView fills exactly.
The Pine code's H4/D1 completed-bar convention was emulated causally; no Historical Holdout was read.

The result also explains the prior TradingView observation: the full Validation period produces 40 trades under the supplied code logic. The 5 trades visible in TradingView were only from the limited loaded history near Jan-Mar 2025.
