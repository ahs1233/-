# Wave-memory comparison v0.1 — registered before scoring

Authorized 2026-10-03. This extends the library-comparison pilot without touching frozen Navigator or the frozen v0.2.3 event study.

## Question
Does an event-level representation of XAUUSD movement (Directional Change waves) carry more useful information about the next move than simple rules, fixed-bar shape lookup, or pretrained Kronos?

## Data boundary
- Canonical JForex BID/ASK store only.
- Source start: 2018-03-01 (first complete month available in the local store).
- Train cutoff: strictly before 2024-03-20T15:20:24.500Z.
- Development probe: 2023-01-01 <= anchor < 2024-03-01, still inside Train.
- Historical wave memory for every anchor is past-only. No Validation/Holdout/forward data is read.
- All source files used are SHA256 recorded before scoring.

## Two tracks
- scalp: M5, DC threshold 0.001, horizon 3 bars (15m)
- swing: H1, DC threshold 0.005, horizon 4 bars (4h)
These thresholds/horizons are inherited unchanged from pilot-002. They are NOT retuned from outcomes.

## Causal DC event representation
A pivot/extreme is not usable at its extreme timestamp. A wave becomes available only at its confirmation timestamp.
Each confirmed leg stores:
- direction
- amplitude_pct = signed (pivot_end/pivot_start - 1)
- duration_bars between confirmed pivot extremes
- confirmation_lag_bars between extreme and confirmation
- speed = signed amplitude_pct / duration_bars
- atr_amplitude = signed price amplitude / ATR at confirmation
- previous-leg retrace_ratio where defined

No feature is retroactively mutated from the next wave. For similarity at anchor t, only events with confirmation_time <= t may enter the signature.

## Signature and memory
- Signature length: last 6 confirmed legs.
- Each leg is represented by [signed amplitude_pct, log1p(duration), log1p(confirmation_lag), signed speed, signed atr_amplitude, retrace_ratio].
- Robust scaling parameters are computed from historical memory available before the development period, never from future anchors.
- Candidate sequences must end strictly before the anchor and their forecast labels must mature before the anchor.
- Phase alignment is mandatory: if the query is A bars after its latest DC confirmation, a historical candidate is evaluated A bars after its own latest confirmation, and no newer confirmation may have occurred before that historical candidate anchor.
- Candidate sequences may not overlap the query or each other.
- Primary event-memory matcher: tslearn multivariate DTW with Sakoe-Chiba radius 2.
- Keep the nearest 7 independent sequences; forecast = median future displacement / ATR.
- Abstain if fewer than 7 mature independent candidates exist.

## Comparators on identical anchors
1. flat
2. last-12-bar drift
3. causal DC direction
4. event_wave_dtw
5. Kronos-mini (same pinned source/model revisions as pilot-002)

Pilot-002 fixed-bar STUMPY/MASS + DTW remains prior integration evidence and is not rerun in this phase. This phase isolates the question of whether the wave representation itself adds information. Kronos remains PRETRAINED_CONTAMINATION_UNKNOWN and is diagnostic only.

## Cohort
- 96 deterministic evenly spaced eligible anchors per track from the development probe.
- Outcome windows may not overlap.
- Anchors are selected by timestamp/availability only, never by return.

## Execution/costs/metrics
Reuse pilot-002 arithmetic exactly:
- prediction target: (BidClose[t+h]-BidClose[t]) / ATR[t]
- hypothetical entry: open t+1; fixed horizon exit
- C0 gross, C1 real BID/ASK spread + 0.5*spread slippage entry and exit, C2 doubled
- report MAE ATR, active coverage, directional accuracy, C0/C1/C2 mean/opportunity and C1/trade, win rate
No annualized return, Sharpe, or profitability claim from this development probe.

## Acceptance
- prefix-causal tests pass
- no event is visible before confirmation
- all memory labels mature before query time
- no Validation/Holdout read
- deterministic same-seed Kronos repeat on a smoke anchor
- produce complete reports for both tracks

No tuning based on these 96 anchors. Any parameter change requires a new registered protocol.
