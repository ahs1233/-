# PROTOCOL — Market State Engine + Management v0.1

Date: 2026-10-05

## Objective
Replace one-rule-fits-all execution with:
State Reader -> Situation Filter -> Entry Trigger -> Trade Management.

This study does NOT invent a new entry trigger.
It conditions the already preregistered transition winners on causal market state, then tests simple state-aware management.

## Frozen entry triggers from prior preregistered study
- Scalper: HIGHER_LOW_BREAK
- Swing: HIGH_RECLAIM

No switching after later historical results.

## State Reader
Fit an unsupervised 6-state KMeans model on 2018-2022 only.

State features are causal price-only context at the M5 signal close:
- M5: close location, 15m drift, 60m drift, 60m efficiency
- M15: close location, 1H drift, 5H drift, 1H efficiency, 5H efficiency
- H1: close location, 5H drift, 5H efficiency, 24H position, decline from 24H high
- H1 ATR risk scale is used for normalization, not as a future feature

No labels, trade outcomes, year identifiers, macro data, or future bars are used to form states.

## State acceptance
For each engine separately, use FIXED management only.

A state is accepted only if BOTH:
Train 2018-2022:
- mean R > 0
- PF > 1
- minimum trades: Scalper 80 / Swing 50

Validation 2023-2024:
- mean R > 0
- PF > 1
- minimum trades: Scalper 30 / Swing 20

If no states pass, the state-gating path fails.

## Management candidates
Management is selected only after accepted states are frozen.

M0 FIXED:
- original stop and target until target/stop/timeout

M1 PROTECT_HALF:
- when price reaches 50% of the entry-to-target distance, move stop to breakeven from the NEXT M5 bar
- no same-bar retroactive protection

M2 HALF_OUT_PROTECT:
- when price reaches 50% of entry-to-target distance, realize 50% of position there
- remaining 50% stop moves to breakeven from NEXT M5 bar
- remaining 50% keeps original target
- no same-bar retroactive protection

Conservative ambiguity:
- if stop and target are touched in one bar, stop first
- before protection becomes active, original stop remains authoritative
- protection activates only on the next bar after threshold is observed

## Engine geometry
Scalper:
- stop = anchor low -0.75 H1 ATR
- target = anchor low +1.50 H1 ATR
- timeout = 12H

Swing:
- stop = anchor low -1.00 H1 ATR
- target = anchor low +4.00 H1 ATR
- timeout = 72H

## Management selection
Using accepted states only:
- management must have mean R >0 and PF >1 on Train and Validation
- rank by highest worst-split mean R
- tie-break by smaller worst drawdown
- if none pass, retain FIXED only as diagnostic and fail promotion

## Historical evaluation
2025-2026 is already consumed by prior experiments.
It may be reported only as a consumed historical diagnostic, never as fresh OOS.

Pristine Forward OOS remains unread.

## Promotion
No promotion unless:
- state gate passes Train + Validation
- selected management passes Train + Validation
- consumed 2025-2026 diagnostic does not show severe state instability
- Pristine Forward OOS remains untouched
