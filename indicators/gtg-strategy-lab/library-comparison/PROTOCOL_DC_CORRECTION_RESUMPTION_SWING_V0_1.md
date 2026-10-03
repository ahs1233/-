# GTG DC Correction -> Resumption Swing v0.1 — structural entry diagnostic

Registered 2026-10-03 before any correction/resumption-conditioned execution outcome is computed.

## Evidence status
Exploratory Train-only development diagnostic.
The State Engine, handoff, retest, and lifecycle experiments have already been observed on this same development region.
This experiment is not independent validation.
Validation and Historical Holdout remain closed.

## Purpose
Test a wave-structural Swing entry rule after Trend confirmation:

RANGE
-> TRANSITION
-> confirmed TREND_UP / TREND_DOWN
-> wait for a causal fine-scale correction against the Trend
-> require the macro DC direction to remain aligned with the Trend
-> wait for causal fine-scale resumption back with the Trend
-> enter only after resumption confirmation

This is intended to distinguish:
- entering after an exhausted impulse,
from
- entering after a completed correction and renewed continuation.

## Frozen sources
State Engine v0.2:
- frozen H1 state_sequence
- canonical raw manifest

Confirmed Handoff v0.3:
- primary confirmed TREND_UP / TREND_DOWN episodes
- frozen resolution_time
- frozen resolved_direction

No State/Transition rule is modified.

## Directional Change contract
Reuse compare.dc_states exactly.

H1 close-only causal DC:
- fine threshold = 0.0025
- macro threshold = 0.0050

These are the existing 0.5x and 1.0x Swing DC scales already used in Multi-Scale DC research.
No threshold is fit from Retest/Lifecycle outcomes.

A DC change is considered newly confirmed on bar j only when:
- states[j].confirmed_at == j

No pivot is backdated as a signal.

## Eligible episode
- frozen primary RANGE -> TRANSITION episode
- frozen resolution = TREND_UP or TREND_DOWN
- report library/evaluation separately when applicable
- primary decision cohort = evaluation split

At resolution bar r:
- d = +1 for TREND_UP, -1 for TREND_DOWN
- State Engine state[r] must equal the resolved Trend state
- macro DC direction at r must already equal d; otherwise no entry with reason MACRO_NOT_ALIGNED_AT_RESOLUTION
- search begins strictly after r

## Phase 1 — correction confirmation
Find the first later complete H1 bar c, while frozen State Engine remains the same Trend, such that:
1. fine DC has a new confirmation at c
2. fine DC direction at c = -d
3. macro DC direction at c = d

This is the first confirmed fine-scale correction inside an intact macro DC trend.

If before c:
- frozen State Engine leaves the original Trend, or
- a hard market gap >3h occurs, or
- macro DC newly confirms direction -d,
then the setup ends with no entry.

## Phase 2 — resumption confirmation
After c, find the first later complete H1 bar s, while frozen State Engine remains the same Trend, such that:
1. fine DC has a new confirmation at s
2. fine DC direction at s = d
3. macro DC direction at s = d

If before s:
- State Engine leaves the original Trend,
- hard gap >3h occurs,
- macro DC confirms direction -d,
then cancel the setup.

First valid resumption wins.
No later resumption may replace it.

## Entry
At the valid resumption signal bar s:
- entry = open(s+1)
- direction = d
- require gap s -> s+1 >0 and <=3h
- ATR denominator = ATR[s]

No entry at the signal close itself.

## Outcome horizons
Report all, with none promoted after the run:
- h = 4 trading H1 bars
- h = 12
- h = 24

Exit:
- close(s+h)

Every adjacent gap from s through s+h must be >0 and <=3h.
Endpoint remains before 2024-03-20T00:00:00Z.

No stop, target, trailing, leverage, sizing, compounding, or re-entry.

## Costs
Reuse compare.costs exactly:
- C0
- C1 benchmark friction
- C2 doubled friction

## No-entry outcomes
Persist one:
- DC_RESUMPTION_ENTRY
- MACRO_NOT_ALIGNED_AT_RESOLUTION
- NO_FINE_CORRECTION_BEFORE_TREND_END
- MACRO_REVERSAL_BEFORE_CORRECTION
- NO_RESUMPTION_BEFORE_TREND_END
- MACRO_REVERSAL_DURING_CORRECTION
- HARD_GAP
- DATA_END

## Metrics
For evaluation:
- confirmed Trend episodes
- entries
- coverage
- no-entry reason counts
- correction confirmation delay from resolution
- correction duration: c -> s
- total resolution -> resumption delay
- up/down entry counts

For each h in {4,12,24}:
- mature trades
- directional accuracy
- C0/C1/C2 mean/trade
- C1 win rate
- signed displacement / ATR
- MFE / MAE
- returned-inside-source-range fraction

Also descriptive:
- by direction
- by year when n>=10
- correction-duration bins 1, 2-3, 4+ bars, descriptive only
- total-delay bins 2-3, 4-6, 7+ bars, descriptive only

No subgroup may be promoted from this run.

## Cross-horizon registered diagnostic screen
All must hold:
1. evaluation entries >=40
2. up entries >=15 and down entries >=15
3. h12 mature trades >=30
4. h24 mature trades >=25
5. h12 C1 mean/trade >0
6. h24 C1 mean/trade >0
7. at least one of h12/h24 C2 mean/trade >=0
8. h12 or h24 C1 win rate >0.50
9. at least two of 2021, 2022, 2023 have positive h12 C1 with n>=10

Passing is development evidence only.

## Integrity
- frozen handoff hash unchanged
- frozen State content hash unchanged
- canonical raw manifest unchanged
- DC prefix invariance for sampled episodes
- search begins after resolution
- correction confirmation is fine DC flip against d
- macro remains d at correction
- resumption is fresh fine DC flip back to d
- macro remains d at resumption
- first valid correction/resumption only
- entry after resumption close
- no hard-gap bridging
- no future information selects the signal
- no outcome-based threshold change
- Validation read=false
- Historical Holdout read=false

## Decision
If this rule passes:
- freeze it as the first structural Swing-entry candidate,
- next build exit/risk logic separately,
- require a new temporal gate before any Holdout decision.

If it fails:
- do not tune DC thresholds or delay bins on this sample,
- move from simple state transitions to explicit DC leg geometry
  (correction depth, impulse/correction ratio, speed, leg age) in a new preregistered model.

No Holdout opens automatically.
