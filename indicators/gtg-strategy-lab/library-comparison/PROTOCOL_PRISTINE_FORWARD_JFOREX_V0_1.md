# GTG Pristine Forward Price — JForex/IHistory v0.1

Registered 2026-10-04 before any Microstructure Forward → trading-outcome alignment.

## Purpose

Preserve a canonical, sealed forward XAU/USD price record that can later be aligned with the independently collected Microstructure Forward corpus after the registered readiness gate becomes eligible.

This protocol does **not** unlock OOS analysis and does **not** decode forward prices during collection.

## Canonical source

TRADE_CONTRACT v0.2.3 remains controlling.

- Instrument: Dukascopy XAU/USD.
- Period: M1.
- Sides: BID + ASK separately.
- Source: authenticated JForex API / IHistory only.
- Filter: NO_FILTER.
- Export channel: JForex IHistory → exact local raw export.
- Public Dukascopy datafeed `.bi5` is **not** a canonical forward source and is audit/reference only.
- No JForex/public-feed hybrid is permitted.

## Freeze boundary

- T_freeze_v0.2.3: `2026-09-30T13:40:49Z`.
- The exporter may preserve the complete UTC freeze day as raw bytes.
- Any later OOS decoder must keep only observations strictly after T_freeze.
- During collection/sealing, the forward files remain undecoded.

## JForex collector

Implementation:

`data/jforex/GtgForwardExport.java`

Properties:

1. Read-only `IStrategy`; it contains no order submission.
2. Subscribes to XAU/USD only.
3. Exports BID and ASK M1 IHistory bars in the established 24-byte raw record layout.
4. Writes each side via `.part` then atomic rename.
5. Writes `FORWARD_COMPLETE.json` only after both sides finish.
6. Starts at the freeze day and catches up only through settled UTC days.
7. Uses a 3-hour finalization lag.
8. Remains active and checks once per minute; if the laptop/JForex is unavailable, the next active pass catches up missing settled days.
9. Existing completed days are never rewritten.

Current JForex API provenance:

- platform library: 4.8.18
- `jforex-api`: 4.8.13

## Sealer

Implementation:

`data/seal_jforex_forward.py`

The sealer is metadata/raw-byte only. It must not decode candle records.

For every JForex-complete day it:

- verifies BID and ASK files exist,
- verifies raw byte length is a multiple of the 24-byte record size,
- verifies row counts against `FORWARD_COMPLETE.json`,
- computes SHA256 for the exact exported bytes,
- atomically copies exact bytes under `.lab-data/raw/forward/YYYY/MM/DD/`,
- records provenance and hashes in `.lab-data/manifest.jsonl`,
- refuses any hash change for an already sealed day.

Hard flags remain:

- `historical_holdout_read = false`
- `pristine_price_oos_decoded = false`
- `trading_outcomes_read = false`

## Audit

`data/audit_forward_seal.py`

Audit is allowed to inspect manifest metadata, file existence, byte counts and SHA256 only. It must not decode market data.

## Automation

JForex `GtgForwardExport` remains active while the authenticated JForex session is running.

Windows task:

`GTG Pristine Forward Seal Capture`

runs daily at 06:45 local time and executes:

`scripts/capture_pristine_forward.ps1`

The Windows task seals/audits existing JForex exports. It does not use the public datafeed and does not authenticate to JForex.

## Initial live checkpoint

On 2026-10-04, before any forward-price decoding:

- JForex export completed: 2026-09-30, 2026-10-01, 2026-10-02.
- 3 days sealed.
- Forward seal audit: PASS.
- Issues: 0.
- `decoded_market_data = false`.

The freeze day is intentionally stored whole; future OOS decoding must enforce the exact T_freeze boundary.

## Research lock

No Microstructure Forward feature may be aligned with these price files until the separately registered Microstructure Forward Readiness Gate becomes `ELIGIBLE`.

The first edge-analysis protocol must be registered before decoding/alignment.
