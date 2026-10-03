# GTG State + Transition Engine v0.3 — Confirmed Handoff Findings

Date: 2026-10-03  
Scope: Train-only audit using the frozen v0.2 State Engine. Validation/Historical Holdout remained closed.

## Integrity
- v0.2 state sequence SHA unchanged.
- canonical raw-file manifest matched v0.2 exactly.
- inherited feature-prefix causality PASS.
- inherited max TRANSITION age <=4 PASS.
- market continuity rule <=3h unchanged.
- 5/5 v0.3 implementation tests PASS before the official audit.
- all 8 registered v0.3 sanity gates PASS.

## Evaluation episode flow
Primary RANGE -> TRANSITION episodes:
- 456

Resolution:
- RANGE resumed: 174
- TREND_UP: 148
- TREND_DOWN: 132
- unresolved gap: 2

Therefore:
- RANGE resumed fraction: 38.16%
- confirmed trend fraction: 61.40%
- confirmed trend events: 280
- mature 24-bar confirmed events: 213
- mature direction balance: 115 up / 98 down
- median resolution delay: 1 bar
- mean resolution delay: 1.47 bars

## Key comparison: transition onset vs confirmed-resolution entry

### If we wait until resolution and then follow the confirmed trend
Evaluation post-resolution:

- 1 bar:
  - n=278
  - direction accuracy 51.08%
  - mean signed displacement -0.005 ATR

- 4 bars:
  - n=268
  - direction accuracy 48.51%
  - mean signed displacement +0.102 ATR
  - median signed displacement -0.032 ATR

- 12 bars:
  - n=231
  - direction accuracy 48.48%
  - mean signed displacement +0.193 ATR
  - median -0.065 ATR

- 24 bars:
  - n=213
  - direction accuracy 53.99%
  - mean signed displacement +0.221 ATR
  - median +0.276 ATR

Waiting for confirmation therefore does not create a strong short-horizon continuation edge. The FSM confirmation often arrives after a material part of the directional move has already occurred.

### What the same eventually-confirmed episodes looked like from TRANSITION onset
This is NOT tradable information by itself because the subset is selected by its later resolution. It answers a different question: if we could identify confirmed transitions early, would onset contain useful directional information?

Evaluation onset among episodes that later confirmed a trend:

- 1 bar:
  - n=280
  - direction accuracy 60.0%
  - mean signed displacement +0.314 ATR

- 4 bars:
  - n=273
  - direction accuracy 56.78%
  - mean signed displacement +0.477 ATR

- 12 bars:
  - n=234
  - direction accuracy 54.27%
  - mean signed displacement +0.555 ATR

- 24 bars:
  - n=213
  - direction accuracy 57.75%
  - mean signed displacement +0.636 ATR
  - median +0.578 ATR

The library period shows the same qualitative pattern: episodes that later confirm a trend already contain directional movement near onset, while post-resolution continuation is much weaker.

## Interpretation
The State Engine should not use confirmation as a delayed market-entry signal.

A better architecture is:

RANGE
-> TRANSITION ONSET = stop Scalper / uncertainty begins
-> predict whether this transition will:
   A) resume RANGE, or
   B) confirm the onset direction as TREND
-> if high-confidence TREND, the useful information is near onset rather than after confirmation
-> if RANGE, resume Scalper logic

In the frozen v0.2 data there were no primary episodes resolving to the opposite trend direction. Trend resolutions were always in the onset candidate direction:
- library: 234 TREND_SAME, 139 RANGE, 1 unresolved
- evaluation: 280 TREND_SAME, 174 RANGE, 2 unresolved

So the next learning problem is naturally binary at transition onset:
- TREND_CONFIRMED
- RANGE_RESUMED

If TREND_CONFIRMED, the absolute Swing direction is already given by the causal onset candidate direction.

## Decision
- Keep State Engine v0.2 as the current causal market-state authority.
- Do not use v0.3 resolution time as the Swing entry rule.
- Build Transition Memory at onset to estimate P(TREND_CONFIRMED) vs P(RANGE_RESUMED).
- Historical similarity should compare the current range/transition episode with pre-2021 episodes.
- Kronos may later enter as one expert feature, not as the state authority.
- Validation/Holdout stay closed.
