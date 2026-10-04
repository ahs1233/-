# GTGLab2 — Deterministic Swing / Scalper Execution Contracts v1.0

Status: FROZEN EXECUTION CONTRACT
Registered: 2026-10-04

Purpose: close the ambiguity between research signal generation and executable action.
This document does not claim profitability. It freezes how a valid setup is translated into Long/Short action before future evidence is evaluated.

## Provenance
Numeric execution values are inherited from the already preregistered Sweep/Acceptance v0.1 protocol:
- 5 equal tranches,
- 0.20R per tranche,
- one tranche maximum per later H1 bar,
- next-H1-open fills,
- Scalper/Rejection timeout = 12 H1 bars,
- Swing/Acceptance timeout = 24 H1 bars,
- MTF score rules inherited unchanged.

No new performance threshold was selected after seeing development results.

## Common rules
- Long and Short are symmetric.
- Total planned risk = 1.0R maximum per idea.
- Maximum tranches = 5.
- Each tranche = 0.20R.
- Never add after invalidation.
- Entry/exit decisions are made at bar close; fills occur at next H1 open.
- TRANSITION does not permit a discretionary directional trade by itself.
- Flip requires prior invalidation, opposite acceptance, and a later executable setup. No instant revenge flip.
- Historical Holdout remains inaccessible under this contract.

## Swing v1 — Acceptance → Retest → Continuation
Use case:
- prior structure originated from RANGE,
- a boundary break becomes ACCEPTANCE,
- a retest holds outside the frozen boundary,
- trade follows the accepted break.

Direction:
- accepted upper break → LONG,
- accepted lower break → SHORT.

MTF conflict rule:
- LONG requires inherited H1/H4/D1 EMA50 sign score >= +1,
- SHORT requires inherited score <= -1.

Entry:
- T1 at next H1 open after valid acceptance + retest-hold.
- T2-T5: at most one per later H1 bar.
- Add only while hypothesis remains valid and one of the already registered continuation evidences occurs:
  - successful boundary retest-hold,
  - EMA9/EMA21 continuation,
  - directional continuation bar.
- Additions may never exceed 1.0R total.

Invalidation:
- state becomes opposite trend, OR
- two consecutive H1 closes return inside the frozen range.

Exit:
- invalidation → EXIT at next H1 open.
- timeout → EXIT after 24 H1 bars from T1 at next H1 open.
- other target/exit layers may not be introduced into v1 after outcome observation.

Status:
- execution contract FROZEN.
- the underlying Acceptance/Retest hypothesis remains forward-research only; not production eligible.

## Scalper v1 — Rejection / Range Fade
Use case:
- prior structure is RANGE,
- one boundary is swept,
- break resolves as REJECTION,
- trade fades back toward the frozen range midpoint.

Direction:
- rejected upper break → SHORT,
- rejected lower break → LONG.

MTF conflict rule:
- SHORT after upper rejection requires score <= +1,
- LONG after lower rejection requires score >= -1.

Entry:
- T1 at next H1 open after valid rejection.
- T2-T5: at most one per later H1 bar.
- Add only while the range-fade hypothesis remains valid and already registered evidence appears:
  - another boundary retest closing back inside,
  - EMA9 reclaim/continuation in fade direction.
- Never add after invalidation.

Target:
- frozen range midpoint.

Invalidation:
- state becomes trend in the original break direction, OR
- two consecutive closes again outside the frozen boundary in original break direction.

Exit:
- midpoint target, invalidation, or 12-H1-bar timeout.
- executable fill at next H1 open.

Status:
- deterministic contract FROZEN as a reference policy.
- current development evidence for Rejection/Fade is negative, so Scalper v1 is NOT an eligible promotion candidate until a separately preregistered independent treatment exists.

## Risk / promotion
These execution contracts define action semantics only.
They do not unlock:
- Historical Holdout,
- forward outcome linkage,
- paper strategy execution,
- production.

Candidate Registry and Forward Gatekeeper remain authoritative for promotion.
