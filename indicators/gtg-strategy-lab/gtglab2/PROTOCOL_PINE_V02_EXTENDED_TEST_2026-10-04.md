# PROTOCOL — Pine v0.2 Exact Logic Extended Historical Test

Date fixed before outcome read: 2026-10-04

## User-requested window
2025-01-01T00:00:00Z through 2026-10-01T00:00:00Z.

## Available clean-data limit
The immutable clean snapshot GTGLAB2-HIST-CLEAN-V1 ends at T_FREEZE = 2026-09-30T13:40:49Z.
Therefore the run must stop at the latest complete H1 bar available before T_FREEZE. No data after T_FREEZE may be invented or sourced from the blind forward OOS.

## Strategy under test
Exact logic of the user-supplied Pine strategy:
GTGLab2 Swing Acceptance-Retest v0.2 Parity.

Fixed components:
- H1 State Engine v0.2 semantics as implemented in the Pine code.
- Directional Change thresholds 0.25%, 0.50%, 1.00%, 2.00%.
- Prior-24H RANGE boundary transition.
- One-sided boundary break only.
- ACCEPTANCE within break bar + 3 bars.
- RETEST within acceptance + 6 bars.
- H1/H4/D1 EMA50 slope context.
- SINGLE entry only.
- Entry at next complete H1 open.
- Exit on opposite trend state, two closes back through accepted boundary, or 24 H1 bars.
- Synthetic risk sizing: 1R = $100 using signal-bar SMA-TR(14).

## Feed
Clean JForex historical BID OHLC. This is a logic emulation of Pine, not OANDA TradingView fill parity.

## Corpus handling
Warm-up/state history begins from the immutable clean snapshot origin.
Snapshot analysis exclusions are respected.
The requested test interval is read after all logic is fixed.

## Scientific status
This run intentionally opens the previously sealed Historical Holdout because the user explicitly requested a 2025-01-01 to 2026-10-01 test.
After this run, that interval can no longer be treated as unseen final historical holdout for this candidate.

Pristine Forward OOS remains untouched.
