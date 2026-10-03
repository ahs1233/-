# GTG Microstructure Forward Readiness Gate v0.1

Registered 2026-10-04 while forward collection is still in its initial phase and before any trading-outcome alignment.

## Purpose

Provide a deterministic answer to one question:

> Is the forward microstructure corpus eligible to enter the first edge-analysis phase?

This gate does not create, tune, rank, or test trading signals.

## Eligibility — unchanged from Forward Collection v0.3

Both conditions are mandatory:

1. At least 30 elapsed days from the first valid forward capture.
2. At least 10,000 valid append-only snapshots with source-health metadata.

Neither condition can substitute for the other.

## Hard locks

The readiness process MUST NOT:

- read Historical Holdout,
- decode Pristine Price OOS,
- read or align trading outcomes,
- optimize thresholds against PnL or future price,
- reinterpret a venue as global OTC XAUUSD order flow,
- sum raw volume across heterogeneous venues.

## Operational diagnostics — advisory only

The monitor may report, without changing eligibility:

- integrity status,
- valid snapshot count,
- elapsed collection time,
- Fusion Grade ratio,
- per-source availability coverage,
- median collection interval,
- gaps >90 seconds,
- gaps >300 seconds,
- recent 60-interval cadence.

These diagnostics are collection-quality evidence only. They are not trading features and do not unlock research early.

## Current implementation

- `data/microstructure_forward_readiness.py`
- `data/test_microstructure_forward_readiness.py`
- live report: `library-comparison/MICROSTRUCTURE_FORWARD_READINESS_V01.json`

The first edge-analysis protocol must be registered separately after this gate becomes eligible.
