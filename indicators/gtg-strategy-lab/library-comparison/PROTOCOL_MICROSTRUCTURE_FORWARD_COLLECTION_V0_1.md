# GTG Microstructure Forward Collection v0.1

Registered 2026-10-04 before the first GTG microstructure snapshot is stored.

## Purpose
Create a durable forward-only microstructure dataset for GTG using PanWatch's existing gold fusion stack instead of adding more price-only models.

This dataset is independent research input. It does NOT open or decode the sealed GTG Pristine price OOS.

## PanWatch source identity
Repository:
- ahs1233/PanWatch
- branch: feat/ahmed-toolbox-xau

Pinned source blobs used to define the representation:
- src/modules/xau/xaut_order_flow.py
  SHA: a4cda68e299c133b28cdd5322675063ef64dbb6a
- src/modules/xau/gold_market_fusion.py
  SHA: a6caacb5032dd2143e1a16b1ca70e14f28660c7a
- src/modules/xau/gold_market_fusion_runtime.py
  SHA: 56f9291fe9fa1ecadf4a8553bb01679b10b9fe5a
- src/modules/xau/gold_tape_store.py
  SHA: 74be14dcae08dc0c2eda7ea8c59fd98e7a8026f3
- src/modules/xau/api.py
  SHA: 687b39bce3c38dfa2147161746310e95007997af

If any of these blobs change, the collector may continue storing raw JSON but the manifest MUST record the new source schema version before downstream research uses it.

## Data source
Preferred PanWatch surface:
- gold-fusion endpoint returning the current multi-venue gold microstructure fusion.

The collector accepts the exact endpoint URL as configuration.
No hard-coded production host is required.

Direct-import fallback is also allowed when the HTTP service is not running:
- import the pinned PanWatch branch locally;
- call `src.modules.xau.gold_market_fusion_runtime.get_gold_market_fusion(force=True)`;
- store the returned JSON without feature transformation;
- record `panwatch-direct://gold_market_fusion` as the endpoint identity and record the local PanWatch commit SHA.

HTTP and direct-import captures are the same raw fusion representation; the transport used must be explicit in the manifest.

Current PanWatch fusion may include:
- OKX XAU swap executed trade flow
- OKX XAUT spot executed trade flow
- Bitfinex XAUT executed trade flow
- venue-specific 5m/15m/30m/1h/4h/1d/1w flow where coverage permits
- footprint / delta
- raw-book imbalance
- volume profile / POC / VAH / VAL
- absorption candidates
- open interest where available
- venue basis to XAU reference
- normalized multi-venue fusion / market agreement
- source-health / quality metadata

These venues are proxy markets. They MUST NOT be described as global OTC XAUUSD order flow.

## Storage
Root is external to Git by default:
- C:\Users\alk\gtg-lab-data-microstructure

Append-only raw snapshots:
- raw/YYYY/MM/DD/<capture_utc>_<sha12>.json

Manifest:
- manifest.jsonl

Every manifest row stores:
- capture_received_utc
- observed_at when available
- raw relative path
- SHA256
- byte size
- endpoint identity
- HTTP status
- PanWatch source blob identities
- top-level fusion status
- source-health summary
- schema/collector version

Raw JSON is canonicalized with sorted keys and UTF-8 before hashing.

## Integrity
Collector MUST:
- never mutate an existing snapshot
- never rewrite an existing manifest row
- validate JSON
- fail on non-2xx HTTP
- store the exact returned JSON representation after canonical serialization
- create a new file only after SHA is known
- fsync raw file before manifest append
- use an exclusive lock so concurrent captures cannot corrupt manifest
- keep all historical captures indefinitely unless a separately registered archival policy changes that

Duplicate payload SHA on the same UTC day:
- allowed to be recognized and skipped
- must not create duplicate manifest rows

## Collection mode
The executable collector is ONE-SHOT by design.

Repeated execution may be scheduled externally later, but this protocol itself does not start a background daemon.

Recommended future cadence:
- 60 seconds while PanWatch gold-fusion is healthy

No claim of continuous coverage is allowed unless manifest timestamps prove it.

## Research lock
Until a separate analysis protocol is registered:
- no microstructure feature may be tested against future GTG outcomes
- no threshold may be selected
- no trading gate may be derived
- no Pristine price OOS may be decoded for alignment

The collection phase is data acquisition only.

## First research eligibility gate
Do not start confirmatory microstructure-model research until BOTH:
1. at least 30 calendar days since first valid capture, and
2. at least 10,000 valid fusion snapshots with source-health metadata.

Exploratory quality audits that do not use trading outcomes are allowed earlier.

## Future analysis concept
When eligible, the first candidate should test whether microstructure state at a frozen GTG event adds information beyond price-only state, using fields such as:
- aligned venue delta ratios
- book imbalance
- absorption state
- POC/value-area location
- open-interest change
- market agreement
- source quality/reliability

Any such model must be preregistered before outcome alignment.

## Separation from existing OOS
- Historical Holdout: remains locked
- Pristine price Forward OOS: remains sealed
- Microstructure Forward dataset: begins prospectively from its own first capture

Collecting microstructure snapshots does not authorize decoding either locked price dataset.
