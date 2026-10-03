# GTG Microstructure Forward Collection v0.2

Registered 2026-10-04 before first v0.2 snapshot.

## Purpose
Extend the forward-only microstructure dataset from v0.1 to a true multi-source gold fusion while preserving append-only storage and outcome lock.

## PanWatch identity
Repository: ahs1233/PanWatch
Branch: feat/ahmed-toolbox-xau
Commit: 0aafd08

Pinned blobs:
- src/platform/marketdata/gold_binance.py
  e4964e43c1c1c8bf8b8a64df3e53cc047d2fd8d8
- src/modules/xau/xaut_order_flow.py
  a4cda68e299c133b28cdd5322675063ef64dbb6a
- src/modules/xau/gold_market_fusion.py
  93c00f3b8fd032e4dd06f5dade34ce03eb762a12
- src/modules/xau/gold_market_fusion_runtime.py
  5db633eecd13d6462a4f96027859b9349c22faf7
- src/modules/xau/gold_tape_store.py
  74be14dcae08dc0c2eda7ea8c59fd98e7a8026f3
- src/modules/xau/api.py
  687b39bce3c38dfa2147161746310e95007997af

## Sources
Preferred live independent source families:
1. Binance XAUUSDT perpetual
2. Bitfinex XAUTUSD
3. OKX XAU/XAUT when network access is available

Current network limitation:
- OKX may remain unavailable due to network/DNS routing.
- This does not invalidate captures if Binance and Bitfinex are healthy.

## Evidence policy
All venues remain proxy centralized gold markets.
No result may be described as global OTC XAUUSD order flow.
Cross-venue raw volume is never summed as global volume.

## Storage/integrity
Same append-only contract as v0.1:
- canonical JSON
- SHA256
- byte count
- source-health
- PanWatch commit
- collector version
- exact source blob identities
- no overwrite
- duplicate same-day payload may be skipped

## Research lock
Collection and quality audit only.
Do not align microstructure with GTG outcomes until a separate analysis protocol is registered and the eligibility gate is met.

Eligibility remains:
- at least 30 calendar days since first valid capture
- at least 10,000 valid snapshots with source-health metadata

Historical Holdout remains locked.
Pristine price Forward OOS remains sealed.
