# GTG Fast Confirmation Swing v0.1 — post-selection diagnostic

Registered 2026-10-03 before economic outcomes are aggregated for the one-bar confirmation subset.

## Evidence status
Exploratory Train-only post-selection diagnostic.
This rule is motivated by already-observed transition timing:
- most true Trends resolve in the first transition bar,
- unresolved-after-one-bar episodes are mostly later RANGE resumptions.

Therefore results are not independent validation.
Validation and Historical Holdout remain closed.

## Frozen inputs
Use:
- State Engine v0.2 frozen transition labels
- Confirmed Handoff v0.3 frozen resolution_delay_bars and resolved_direction
- Confirmed Handoff Execution v0.1 frozen side-aware execution records

No state rule, resolution rule, horizon, cost model, or direction is changed.

## Rule
For every primary evaluation RANGE -> TRANSITION episode:

At TRANSITION onset:
- Scalper OFF.
- Wait exactly one complete H1 transition bar.

If frozen causal FSM resolution_delay_bars == 1 and resolution is TREND_UP/TREND_DOWN:
- allow Swing candidate in resolved direction.
- entry remains the already-registered confirmed-handoff entry:
  open of the bar after the resolution bar.

If resolution delay is 2 or 3:
- no trade in this fast-confirmation policy, even if a Trend is later confirmed.

If RANGE resumes or episode is unresolved:
- no Swing trade.

This is a timing filter only.

## Horizons
Reuse frozen confirmed-handoff execution horizons:
- 4
- 12
- 24 trading H1 bars after resolution decision.

No horizon selection or retuning.

## Costs
Reuse frozen C0/C1/C2 values from Confirmed Handoff Execution v0.1.
No recomputation or cost-model change.

## Metrics
For each horizon:
- eligible fast-confirmed trades
- fraction of all confirmed-trend trades retained
- up/down counts
- direction accuracy
- C0/C1/C2 mean per trade
- C1 win rate
- mean signed displacement
- mean MFE/MAE
- by-year C1/C2 where n>=10

Comparison:
- FAST_CONFIRMATION vs ALL_CONFIRMED on same horizon
- delta C1/trade
- delta C2/trade

## Registered diagnostic screen at h=4
All:
1. active trades >=100
2. C0 >0
3. C1 >0
4. C2 >=0
5. C1 win rate >0.50
6. both directions >=40
7. at least two of 2021,2022,2023 have positive C1 with n>=10

This screen is diagnostic only.

## Integrity
- confirmed-handoff execution records SHA fixed
- only resolution_delay_bars==1 selected
- no outcome field used to select events
- no threshold fitting
- no Validation/Holdout read

## Decision
If fast confirmation improves economics but still fails C1/C2:
- deterministic first-bar confirmation is still insufficient;
- proceed to a Trend Lifecycle / entry-timing layer.

If C1/C2 both positive and year stability is acceptable:
- freeze as a Swing candidate for a future independent temporal gate.

No Holdout opens automatically.
