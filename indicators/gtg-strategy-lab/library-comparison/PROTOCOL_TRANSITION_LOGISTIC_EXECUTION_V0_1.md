# GTG Transition Logistic Gate Execution Audit v0.1

Registered 2026-10-03 before joining frozen Logistic predictions to execution outcomes.

## Evidence status
This is an exploratory Train-only execution audit, not an independent validation.
The Logistic model was selected for follow-up after its frozen 2021-2024 classification result was observed.
Therefore no result from this audit may be called new out-of-sample evidence.

Validation and Historical Holdout remain closed.

## Frozen inputs
Transition Memory:
- run: runs/transition-memory-v01-001
- Logistic coefficients/scaler frozen before evaluation
- threshold fixed at p_trend >= 0.50
- evaluation predictions already frozen

State Engine:
- run: runs/state-transition-v02-001
- event labels/resolution times frozen
- market continuity rule <=3h unchanged

No model refit, threshold tuning, event selection tuning, or horizon selection.

## Cohort
Use exactly the 454 resolved primary RANGE -> TRANSITION evaluation events from Transition Memory v0.1:
- onset >=2021-01-01
- onset <2024-03-20
- frozen outcome label RANGE_RESUMED or TREND_CONFIRMED
- unresolved events excluded exactly as in Transition Memory v0.1

## Three execution policies

### A. ALL_ONSET
At every cohort TRANSITION onset:
- direction = frozen onset candidate_direction
- decision time = onset close
- enter at next observed complete H1 bar open
- trade every event

### B. LOGISTIC_GATE
At TRANSITION onset:
- if frozen p_logistic >=0.50:
  - direction = frozen onset candidate_direction
  - enter at next observed complete H1 bar open
- otherwise no trade

No probability threshold other than 0.50 may be evaluated in v0.1.

### C. FSM_CONFIRMED
Use only events whose frozen resolution is TREND_UP/TREND_DOWN:
- direction = +1 for TREND_UP, -1 for TREND_DOWN
- decision time = frozen resolution_time
- enter at next observed complete H1 bar open

RANGE resolutions are no-trade.
This represents waiting for deterministic confirmation.

## Horizons
Report every fixed horizon:
- 1
- 4
- 12
- 24
complete H1 trading bars after the decision bar.

For horizon h:
- entry = open of decision bar +1
- exit = close of decision bar +h
- h=1 therefore enters at next bar open and exits at that same bar close

Require:
- entry and exit exist,
- every adjacent gap from decision through exit is >0 and <=3h,
- exit before 2024-03-20T00:00:00Z.

No weekend/large-gap bridging.

## Execution arithmetic
Reuse compare.py costs() exactly.

At decision bar t use ATR[t].

For direction d:
- entry BID/ASK open at t+1
- exit BID/ASK close at t+h

Report:
- C0
- C1
- C2

C1/C2 include the same side-aware spread/friction benchmark used throughout library-comparison.

## Metrics
For each policy x horizon:
- opportunities
- active trades
- coverage
- direction accuracy based on decision-close to exit-close displacement
- C0/C1/C2 mean per trade
- C0/C1/C2 mean per opportunity
- C0/C1/C2 positive-trade fraction
- median C1/trade
- total C1 contribution in ATR units

Also report by calendar year for LOGISTIC_GATE when >=10 active trades.

## Diagnostic comparisons
Report, without ranking/tuning:
- LOGISTIC_GATE minus ALL_ONSET C1/trade and C1/opportunity
- FSM_CONFIRMED minus ALL_ONSET
- LOGISTIC_GATE vs FSM_CONFIRMED active coverage
- fraction of actual RANGE resumptions traded by LOGISTIC_GATE
- fraction of actual TREND confirmations traded by LOGISTIC_GATE

## Integrity
- frozen Logistic predictions hash recorded
- frozen Transition Memory SHA unchanged
- frozen State Engine state SHA unchanged
- raw manifest matches State Engine v0.2
- exact 454-event cohort
- threshold remains 0.50
- no post-onset data enters LOGISTIC_GATE decision
- FSM policy uses only frozen causal resolution time
- no Validation/Holdout read

## Decision use
This audit may answer whether the current early Logistic gate is mechanically useful enough to carry into the integrated simulator.

It does NOT authorize:
- threshold tuning on 2021-2024,
- live trading,
- opening Holdout,
- claiming an independent trading edge.

After this audit:
- if early gating clearly reduces false-break damage while retaining trend opportunity, integrate it into the Neuro-Symbolic router as the current Transition expert;
- otherwise keep TRANSITION as stand-down until a fresh representation/model is tested.
