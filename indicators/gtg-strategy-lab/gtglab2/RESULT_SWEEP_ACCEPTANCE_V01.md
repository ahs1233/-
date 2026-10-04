# RESULT — Sweep / Acceptance Execution v0.1

Date: 2026-10-04  
Protocol: `PROTOCOL_SWEEP_ACCEPTANCE_V01.md`  
Run: `runs/sweep-acceptance-v01-001/`  
Scope: development-only historical JForex + causal State Engine boundary events.

## Integrity
- Historical Holdout read: **NO**
- Pristine Forward OOS decoded: **NO**
- Microstructure outcomes read: **NO**
- Future transition-library labels used for formation: **NO**

## Event discovery
- observable boundary breaks: **1,134**
- Acceptance: **774**
- Rejection: **360**
- Acceptance with retest: **323**
- Acceptance without retest: **451**
- transition without boundary cross: **355**
- ambiguous two-sided breaks ignored: **5**

Non-overlapping executable episodes:
- BASE: **611**
- CONTEXT: **431**

## BASE / C1
### Single
- n: 611
- mean: **-0.0516R**
- total: -31.51R
- win rate: 36.01%

### Staged
- n: 611
- mean: **-0.0515R**
- avg risk used: 0.621R
- mean per used R: **-0.3828**
- win rate: 31.91%

Paired staged-minus-single at C1:
- mean: +0.00012R
- median: +0.08194R
- staged beats single: 53.19%

This is not enough to establish staged-entry edge because risk-normalized economics remain poor.

## Branch diagnosis

### Rejection / failed-break fade
Single C1:
- n 304
- mean **-0.1249R**

Verdict: **FAIL**.

### Acceptance + retest continuation
Single C1:
- n 307
- mean **+0.0210R**
- Early: +0.0110R
- Late: +0.0298R
- Long: +0.0275R
- Short: +0.0143R

This is the strongest price-only branch found in this execution cycle.

However:
- median C1: **-0.6868R**
- C0 mean: +0.0675R
- C1 mean: +0.0210R
- C2 mean: **-0.0254R**

Therefore the positive C1 mean is tail-dependent and does not survive the conservative C2 cost scenario.

### Context-filtered version
Context Single C1 overall: -0.0221R.
The frozen MTF filter did not create robust incremental value.

## Verdict
**OVERALL FAIL.**

Sub-verdict:
**Acceptance + Retest / Single Entry = PROMISING, NOT ROBUST.**

It is not eligible for Final Holdout or production/paper promotion as a proven candidate. It may be carried forward only as a new, explicitly preregistered research hypothesis requiring independent evidence; its current historical performance must not be treated as confirmation.
