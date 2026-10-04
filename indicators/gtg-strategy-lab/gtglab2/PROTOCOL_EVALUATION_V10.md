# GTGLab2 — Episode / Purged Evaluation Protocol v1.0

Status: FROZEN EVALUATION INFRASTRUCTURE
Registered: 2026-10-04

## Purpose
Define how future GTGLab2 candidates are evaluated before the forward corpus is unlocked.
This prevents IID row-count inflation, time leakage, and post-result split selection.

## Unit of evidence
Primary statistical unit = market episode, not snapshot row.

An episode has:
- start timestamp,
- end timestamp,
- side,
- session label,
- regime/state label,
- candidate ID.

Consecutive/overlapping episodes are clustered so effective sample size can be reported separately from raw rows/signals.

## Chronology
- Never random-shuffle market rows for primary evaluation.
- Train/development must precede test/evaluation in time.
- A test block is immutable once registered.

## Purge
Purge is derived from the execution contract rather than fitted:
- Swing v1 purge horizon = timeout 24 H1 bars + one-bar fill delay.
- Scalper v1 purge horizon = timeout 12 H1 bars + one-bar fill delay.

Any development/training episode whose information/holding window reaches into the purge zone before a test block is removed.

## Episode clustering
Episodes that overlap or touch are one dependency cluster.
Raw snapshot count and raw signal count must never be presented as independent sample size.

Report:
- raw snapshots,
- raw signals,
- episodes,
- dependency clusters,
- sessions,
- Long/Short coverage,
- regime coverage.

## Forward Microstructure first test
The first forward microstructure test has no fitted magnitude threshold.
The frozen Acceptance/Retest baseline is compared against the preregistered sign-vote treatment.

Required reporting:
- baseline vs treatment,
- C1 and C2,
- Long vs Short,
- session breakdown,
- time blocks,
- source availability,
- leave-one-source-family-out ablation,
- episode/dependency-cluster counts.

## Source ablation
For N ready source families, repeat treatment classification after removing each family one at a time.
A result that disappears when one source is removed fails source-robustness.

No source may be removed only because its ablation hurts results.

## Promotion
This evaluation infrastructure does not itself unlock any candidate.
Candidate Registry + Forward Gatekeeper remain authoritative.
