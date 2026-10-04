# GTG Microstructure Forward Collection v0.3.1 - Operational Integrity Patch

Registered 2026-10-04 **before the first v0.3.1 capture**.

## Scope

This is an operational collection/quality patch only.

It does **not**:
- add or remove a market source,
- change any microstructure feature formula,
- change State Engine logic,
- read or align trading outcomes,
- open Historical Holdout,
- decode Pristine Price OOS,
- change the research eligibility thresholds.

PanWatch market-source blobs remain the same as v0.3.

## Fixes registered before use

### 1. Direct capture no longer forces refresh unconditionally

The direct collector previously called PanWatch with `force=True` regardless of the CLI flag.

v0.3.1:
- respects the explicit `--force` flag,
- scheduled collection does not use `--force`,
- normal one-shot REST acquisition still fetches fresh data because every scheduled run is a new process.

### 2. Bounded direct-capture runtime

The direct PanWatch call is wrapped in a hard async timeout.

Scheduled setting:
- direct timeout: 45 seconds,
- schedule cadence: 1 minute,
- task-level execution limit remains an external safety bound.

A hung source must not silently consume multiple minute slots.

### 3. Whole-run concurrency lock

A `.run.lock` covers the complete fetch + append operation.

Purpose:
- prevent a manual capture and Scheduled Task capture from using the same PanWatch tape SQLite concurrently,
- preserve the existing append-only storage lock separately.

### 4. Fusion Grade definition corrected

Fusion Grade now requires:
- at least two **distinct ready source families**,
- each ready source must have actual executed-trade evidence,
- latest executed trade age <= 900 seconds.

A source marked available but lacking a valid latest executed trade cannot qualify as ready evidence.

Two ready venues from the same source family cannot create Fusion Grade merely because another stale family exists.

### 5. Availability and readiness are separated

Quality audit reports both:
- source API/feed availability,
- ready executed-trade source-family coverage.

Availability is not treated as equivalent to usable microstructure evidence.

## Research locks

Unchanged:
- Historical Holdout: locked.
- Pristine Price OOS: sealed/undecoded.
- Trading outcomes: unread.
- No microstructure threshold is promoted into a trading rule.

## Eligibility

Unchanged from v0.3:
- >= 30 elapsed calendar days from the first valid capture, and
- >= 10,000 valid append-only snapshots with source-health metadata.

Both are required.

## Version boundary

Snapshots before this patch retain their original collector version.

Snapshots after this patch are recorded as:
`microstructure-forward-v0.3.1`

The audit may analyze both versions for collection quality because market-source semantics are unchanged; version must remain visible per capture.
