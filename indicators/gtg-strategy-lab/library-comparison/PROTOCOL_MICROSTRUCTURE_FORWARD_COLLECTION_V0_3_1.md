# GTG Microstructure Forward Collection v0.3.1 — operational hardening amendment

Registered 2026-10-04 after the initial v0.3 collection began, but before any microstructure-to-trading-outcome alignment and while Historical Holdout and Pristine Price OOS remained sealed.

## Scope

This amendment changes collection reliability and quality grading only.

It does NOT:
- change any market feature formula,
- change State Engine or Transition logic,
- read trading outcomes,
- decode Pristine Price OOS,
- read Historical Holdout,
- authorize edge analysis.

All existing raw v0.3 snapshots remain append-only evidence. Quality grades may be recomputed from their already-recorded metadata and raw payloads.

## Operational corrections

1. Direct PanWatch collection no longer forces `force=True` on every minute.
2. Direct PanWatch collection has a hard bounded timeout.
3. The scheduled runner records elapsed runtime.
4. A run-level lock prevents overlapping collectors.
5. A stale lock older than the bounded failure window may be recovered automatically.
6. Existing raw snapshot storage remains atomic JSON + SHA256 + byte count.

## Quality-grade correction

A venue is ready evidence only when:
- venue status is `ready`,
- an executed-trade timestamp exists,
- latest executed trade age is <= 900 seconds at capture time,
- executed-trade count is > 0.

`fusion_grade` requires at least TWO DISTINCT ready source families.

Multiple venues belonging to one family do not create independent fusion evidence.

The audit reports separately:
- source health / availability,
- ready executed-trade source-family coverage.

This prevents a source that is reachable but lacks fresh executed-trade evidence from being overstated as independent fusion evidence.

## Research lock

Eligibility remains a collection gate, not a statistical sample-size claim:
- >=30 elapsed calendar days,
- >=10,000 valid append-only snapshots with source-health metadata.

Minute snapshots are temporally dependent. The later edge-analysis protocol must use time blocks / episodes rather than treating rows as IID observations.

Historical Holdout: LOCKED.
Pristine Price OOS decoding: LOCKED.
Trading outcomes read by this pipeline: FALSE.

## Lock crash recovery

The collector uses a whole-run `.run.lock` and the append path retains its separate storage lock.

A lock now records owner PID/time metadata. A fresh lock rejects overlap. A lock older than the bounded recovery window may be removed as stale so a killed Windows task cannot permanently stop future collection.

This is safe relative to the operational bounds because normal direct capture is bounded to 45 seconds and the scheduler retains an external execution limit.

Regression tests pin both behaviors:
- fresh overlapping lock is rejected,
- stale abandoned lock is recovered.
