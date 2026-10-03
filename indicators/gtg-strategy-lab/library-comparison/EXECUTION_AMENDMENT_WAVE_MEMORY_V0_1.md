# Wave Memory v0.1 — execution amendment A1

Registered 2026-10-03 after wave-memory-001 exited nonzero at 7/96 scalp anchors and before the next scored rerun.

This amendment is operational only. It does not alter the preregistered statistical experiment.

## Failure evidence
- wave-memory-001 completed source loading and wrote 35 rows (7 complete scalp anchors x 5 models), then exited code 1.
- No Python traceback was captured and no summary was produced.
- The partial outcomes are not interpreted and are not used to tune any parameter.
- wave-memory-002 was started before the operational patch was loaded; it was explicitly terminated and is not a scored run.

## Exact-computation change
Replace one full-bank call to tslearn cdist_dtw with deterministic chunks of at most 2000 candidate signatures:
1. apply the identical cdist_dtw(query, chunk, global_constraint="sakoe_chiba", sakoe_chiba_radius=2),
2. preserve candidate order,
3. concatenate distances,
4. apply the unchanged stable argsort and unchanged independent-neighbor selection.

The resulting mathematical distances and ranking must be numerically identical to the original full-bank computation. A dedicated test compares chunked and unchunked outputs at rtol=0 and atol=1e-12.

## Frozen research parameters
Unchanged: source dates, development dates, M5/H1 tracks, DC thresholds, horizons, six-leg signature, all six features, robust scaling, phase alignment, candidate maturity rule, K=7, DTW radius=2, anchors=96/track, Kronos revisions/seed policy, execution-cost arithmetic, metrics, and abstention rule.

Any change to these requires a new protocol rather than this amendment.
