# GTG Microstructure Forward Collection v0.3

Registered 2026-10-04 before first v0.3 snapshot.

## Change from v0.2
Add Kraken PAXG/USD as a third independent centralized gold proxy source.

PanWatch:
- branch: feat/ahmed-toolbox-xau
- commit: 4847225

Pinned blobs:
- gold_binance.py e4964e43c1c1c8bf8b8a64df3e53cc047d2fd8d8
- gold_kraken.py a1d8b27ea637513c703d0bd1648221fadc56407c
- gold_market_fusion.py c69157ce7d64861cd9d61536c39186c7c016b970
- gold_market_fusion_runtime.py b1c0af0dcc6379da45f47b3200055daf852490d7
- gold_tape_store.py 74be14dcae08dc0c2eda7ea8c59fd98e7a8026f3
- xaut_order_flow.py a4cda68e299c133b28cdd5322675063ef64dbb6a
- api.py 687b39bce3c38dfa2147161746310e95007997af

Independent source families:
1. Binance XAUUSDT perpetual
2. Kraken PAXG/USD
3. Bitfinex XAUT/USD
4. OKX XAU/XAUT when network access permits

A capture may be fusion-grade when at least two independent source families have ready, non-stale executed-trade evidence, even if optional sources are unavailable and top-level fusion status is degraded.

No venue is global OTC XAUUSD order flow.
No cross-venue raw-volume sum is allowed.

Storage remains append-only canonical JSON + SHA256 + byte count + source health + commit/blob identity.

Research lock remains unchanged:
- collection/quality audit only
- no trading-outcome alignment
- Historical Holdout locked
- Pristine price Forward OOS sealed

Research eligibility remains:
- >=30 calendar days since first valid capture
- >=10,000 valid snapshots with source-health metadata
