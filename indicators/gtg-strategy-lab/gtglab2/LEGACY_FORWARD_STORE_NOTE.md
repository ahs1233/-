# Legacy Forward Store Note

Date: 2026-10-04

Two stores must not be confused.

## Canonical Pristine Forward
Path used by the scheduled JForex seal/audit:
`C:\Users\alk\gtg-lab-library-comparison\.lab-data`

Properties:
- JForex API/IHistory origin
- uncompressed 24-byte records
- BID/ASK kept separately
- export/cache SHA256 parity
- audit PASS
- no outcome decode

## Legacy historical store
`C:\Users\alk\gtg-lab-data-jforex`

It contains historical canonical research data, but its three old `forward_m1` records dated 2026-09-30..2026-10-02 were recorded from public `datafeed.dukascopy.com` compressed files in earlier work.

Those legacy forward records:
- are retained as evidence,
- are not rewritten,
- are not canonical Pristine Forward,
- must not be used by future forward validation.

The scheduled task already points to the correct `.lab-data` store.
