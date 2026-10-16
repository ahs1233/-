# Path B — the Dukascopy feed through JForex (message 26)

Same source, same feed: only the way of obtaining the files changes. The research feed stays the
official Dukascopy XAU/USD M1 candles, BID and ASK (TRADE_CONTRACT §2.2).

## What is needed
| Field | Value |
|---|---|
| Instrument | XAU/USD (Dukascopy `XAUUSD`, price divisor 1000) |
| Period | 1 minute candles |
| Offer sides | **BID** and **ASK**, separately (BID = signal and volume; ASK = execution only) |
| Columns | time, open, high, low, close, volume (the candle's own volume, not recomputed) |
| Time zone | **GMT/UTC** only; bar time = start of the minute |
| Range | the **earliest available** XAU/USD history → 2026-09-29 (the day of T_freeze_v0.2.2). Nothing is shortened here: the Power Gate decides later how much is needed. Minutes after T_freeze are cut on import (Pristine OOS) |
| Filters | none: no "skip flats", no weekend filling, no interpolation |

## Preferred route: the local cache (byte-identical provenance)
JForex stores the Dukascopy files it downloads. If the cache holds
`XAUUSD/<yyyy>/<mm0>/<dd>/{BID,ASK}_candles_min_1.bi5` (the datafeed layout), they are imported by
`import_local.py cache` through the unchanged `build_day`, and `crosscheck` must show **identical
raw sha256** on the days already downloaded from the datafeed (2026-06-24 → 2026-09-28).

## Fallback: Historical Data Manager CSV export
Tools → Historical Data Manager → XAU/USD, 1 Min, BID (then ASK), GMT, CSV. Imported by
`import_local.py csv`. `crosscheck` must show identical bars on the overlapping days; the volume
ratio is reported (a unit difference is recorded, never rescaled silently).

## Checks after import (message 26 §11), in order
1. provenance: manifest `origin`, raw/CSV sha256 for every file
2. time zone and BID/ASK semantics confirmed on the overlap days (crosscheck PASS)
3. volume definition (ratio = 1 on the overlap, or the difference recorded)
4. `integrity.py` Data Integrity Gate (G1–G5 hard, D1–D5 diagnostics, gaps listed)
5. calendar aggregation (`export_feeds.py`, v0.2.2) and the warm-up boundary (`events/split.mjs firstValidTime`)
6. real Causality Gate rerun on the full data, then the Power Gate on Train only
No edge analysis follows the import directly.
