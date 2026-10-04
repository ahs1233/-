# GTG Pristine Forward Price Seal v0.2 - Integrity Hardening

Registered 2026-10-04 before any forward-price decoding, Microstructure-to-price alignment, or trading-outcome read.

## Scope

This patch hardens collection integrity only. It does not change the canonical market source, freeze boundary, research eligibility, or any trading logic.

## Canonical source remains unchanged

- Dukascopy XAU/USD.
- JForex API / IHistory is canonical.
- M1 BID and ASK are preserved separately.
- Public Dukascopy datafeed files remain audit/reference only and cannot enter the canonical forward corpus.

## New mandatory same-source verification

Every sealed forward day must have byte-parity verification against the JForex local cache from the same authenticated JForex source.

For BID and ASK independently:

1. JForex IHistory export bytes are hashed with SHA256.
2. The corresponding JForex local-cache bytes are hashed with SHA256.
3. Byte count and SHA256 must match exactly.
4. A `forward_m1_verify` manifest record is appended.
5. Any mismatch blocks sealing/audit.

This is a provenance/integrity check only. It does not decode OHLC values.

## Audit v0.2

`data/audit_forward_seal.py` now fails on:

- a non-canonical forward origin,
- a missing cache-verification record,
- an export/cache SHA mismatch,
- orphan raw forward files,
- orphan `.part` files,
- orphan verification records,
- derived canonical M1 files created before the research unlock,
- any non-forward data-layer manifest record after the freeze day.

Allowed post-freeze data-layer kinds are only:

- `forward_m1`
- `forward_m1_verify`

## Locks

Unchanged and explicit:

- Historical Holdout remains locked.
- Pristine Price OOS remains sealed and undecoded.
- Trading outcomes remain unread.
- No Microstructure feature is aligned with future price.
- No trading threshold is selected.

## Initial live verification

The currently sealed days 2026-09-30, 2026-10-01, and 2026-10-02 each have JForex export/cache byte parity for BID and ASK.

Live audit status at registration: PASS, issues = 0, decoded_market_data = false.
