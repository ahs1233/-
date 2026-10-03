# GTG Confirmed Handoff Execution v0.1 — post-selection diagnostic

Registered 2026-10-03 before side-aware C0/C1/C2 execution outcomes are computed from the confirmed resolution bar.

## Status
This is a post-selection diagnostic. It is not independent validation and does not authorize Historical Holdout access.

## Frozen inputs
Confirmed Handoff v0.3:
- handoff_records.jsonl SHA256:
  45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd
- summary.json SHA256:
  bc0902d4c348baf6c01d63c72679d1cca0c94e046f8fe9ea0805eb3b4f42e22e

State Engine v0.2 source manifest SHA256:
- 30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

Transition Logistic Shadow v0.1 summary SHA256 for descriptive comparison only:
- 9a2220effc20c35548a25caf6e5c568dd4c79580b1a2a4b9806d6b03bb8a9207

No state rule, confirmation rule, classifier threshold, or transition label is changed.

## Cohort
Only frozen evaluation primary episodes from Confirmed Handoff v0.3 that resolved to:
- TREND_UP
- TREND_DOWN

Expected confirmed trend episodes:
- 280 before horizon censoring.

RANGE-resumed and unresolved episodes are not eligible because this policy explicitly waits for the deterministic FSM confirmation.

## Entry/exit
For each confirmed trend episode:
- resolution bar = r
- direction = resolved_direction
- entry = open(r+1)
- exits at close(r+h)
- horizons h = 4, 12, 24 complete H1 trading bars
- path continuity unchanged: every adjacent gap >0 and <=3h
- endpoint must remain before 2024-03-20T00:00:00Z
- ATR denominator = ATR[r]

No stop, target, leverage, sizing, compounding, re-entry, or discretionary filter.

## Costs
Reuse compare.costs exactly:
- C0 = side-aware BID/ASK execution with zero added slippage benchmark
- C1 = existing benchmark spread + 0.5*spread slippage on entry and exit
- C2 = doubled benchmark friction

## Metrics
For each horizon:
- eligible confirmed episodes
- active trades
- directional accuracy
- C0/C1/C2 mean per trade
- C1 win rate
- mean signed displacement/ATR
- mean MFE/ATR
- mean MAE/ATR
- returned-inside-source-range fraction
- up/down subgroup n and C1/C2
- year subgroup n and C1 where n>=10

## Descriptive comparison
At h=4 compare, without treating unlike cohorts as identical:
- ALL_TRANSITIONS onset from Transition Logistic Shadow v0.1
- LOGISTIC_GATE onset from Transition Logistic Shadow v0.1
- CONFIRMED_HANDOFF from this run
- ORACLE_TREND_SUBSET onset as impossible upper-bound reference

The confirmed policy starts later by construction; this comparison measures the cost/value of waiting for confirmation.

## Registered diagnostic screen for CONFIRMED_HANDOFF at h=4
All must hold to call the deterministic handoff economically interesting:
1. active trades >=150
2. C0 mean/trade >0
3. C1 mean/trade >0
4. C2 mean/trade >=0
5. C1 win rate >0.50
6. both up/down sides >=50 active trades

This screen is diagnostic only.

## Integrity
- frozen input hashes unchanged
- exact resolution timestamp exists in canonical H1
- direction matches frozen resolved_direction
- entry strictly after resolution
- no outcome modifies confirmation
- source manifest unchanged
- continuity <=3h
- Validation read=false
- Historical Holdout read=false

## Decision
If confirmed handoff is negative after C1:
- deterministic confirmation alone is not a complete Swing entry rule;
- keep State/Transition Engine as routing authority, but add a separate Swing-entry timing layer after or during transition.

If confirmed handoff is positive after C1 but not C2:
- mark cost-fragile and require a new independent temporal gate.

If C1/C2 both positive:
- freeze as a candidate and require independent temporal testing before any Holdout decision.
