# GTGLab2 — Sweep / Acceptance Execution v0.1

Status: PREREGISTERED BEFORE FIRST RUN
Registered: 2026-10-04
Reason for new version: Doctrine Reference v0.1 showed that blind range-edge probes were structurally weak. This version changes the event definition rather than tuning v0.1 thresholds.

## Research question

Can observable post-break behavior separate two executable paths?

1. Sweep + Reclaim → fade the failed break.
2. Acceptance + Retest → trade continuation in the break direction.

No future transition labels are used to form a trade.

## Data

Same canonical development-only JForex H1 and State Engine v0.2 sequence.
No Historical Holdout.
No Pristine Forward outcome decode.
No microstructure outcomes.

## Event discovery

At H1 bar i:
- previous state must be RANGE,
- current state must be TRANSITION,
- use the frozen prior24 boundary present at i,
- breakout direction is observable from bar extremes:
  - UP if high > frozen upper and low does not also cross frozen lower,
  - DOWN if low < frozen lower and high does not also cross frozen upper,
  - ambiguous two-sided bars are ignored.

## Resolution window

Observe at most the next 4 H1 closes.

### REJECTION
UP break:
- first close back at/below frozen upper before acceptance is confirmed.
Trade direction: SHORT.

DOWN break:
- first close back at/above frozen lower before acceptance is confirmed.
Trade direction: LONG.

### ACCEPTANCE
UP:
- two consecutive H1 closes above frozen upper before rejection.
DOWN:
- two consecutive H1 closes below frozen lower before rejection.

After acceptance, wait up to 6 H1 bars for retest-hold:
UP:
- low touches/crosses frozen upper and close remains above it.
Trade: LONG.
DOWN:
- high touches/crosses frozen lower and close remains below it.
Trade: SHORT.

If no retest-hold, no trade.

## Entry

Signal is evaluated only at bar close.
Fill occurs at the next H1 open using BID/ASK.

SINGLE:
- risk weight 1.0.

STAGED:
- T1 risk weight 0.20 at first executable signal.
- up to 4 additional 0.20 tranches.
- at most one tranche per later H1 bar.
- no tranche after invalidation.

Rejection-add evidence:
- another boundary retest that closes back inside,
- or EMA9 reclaim/continuation in trade direction.

Acceptance-add evidence:
- another successful boundary retest-hold,
- EMA9/EMA21 continuation,
- directional continuation bar.

## Exit

### Rejection fade
Target:
- frozen range midpoint.

Invalidation:
- state becomes trend in original break direction, OR
- two consecutive closes again outside frozen boundary in original break direction.

Timeout:
- 12 H1 bars after T1.

### Acceptance continuation
Invalidation:
- state becomes opposite trend, OR
- two consecutive closes back inside the frozen range.

Timeout:
- 24 H1 bars after T1.

All exits fill at next H1 open.

## MTF context variant

BASE:
- no extra filter.

CONTEXT:
- Rejection fade must not have all H1/H4/D1 EMA50 slopes pointing in original break direction.
- Acceptance continuation requires at least 2 of H1/H4/D1 EMA50 slopes aligned with continuation.

This is encoded as the pre-existing causal MTF sign score:
- rejection SHORT after UP break: score <= +1
- rejection LONG after DOWN break: score >= -1
- acceptance LONG: score >= +1
- acceptance SHORT: score <= -1

## Costs

Native BID/ASK spread plus:
- C0 0 bps
- C1 0.5 bps
- C2 1.0 bps slippage on each fill/exit.

## Reports

By:
- rejection vs acceptance,
- long vs short,
- early vs late,
- base vs context,
- single vs staged.

Also report:
- number of detected break events,
- rejected/accepted/unresolved counts,
- acceptance-without-retest count,
- normalized PnL,
- used risk,
- paired staged-single difference.

## Integrity

This is a development screen, not independent confirmation.
No parameter changes are allowed within this version after first results are observed.
