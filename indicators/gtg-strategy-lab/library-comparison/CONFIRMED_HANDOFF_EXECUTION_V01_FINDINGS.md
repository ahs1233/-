# GTG Confirmed Handoff Execution v0.1 — Findings

Date: 2026-10-03
Scope: post-selection Train-development diagnostic from frozen causal trend-confirmation bars.
Historical Holdout remained closed.

## Cohort
Evaluation confirmed trend episodes from State/Transition v0.2/v0.3:
- total confirmed episodes: 280
- h=4 mature: 268
- h=12 mature: 231
- h=24 mature: 213

Entry is strictly after the causal resolution bar:
- signal/confirmation at resolution close r
- entry at open(r+1)
- fixed exits at close(r+h)

## Main result

### 4 trading bars after confirmation
- directional accuracy: 48.51%
- C0: +0.100 ATR/trade
- C1: -0.076
- C2: -0.252
- C1 win rate: 43.28%

Waiting for deterministic confirmation improves materially over trading every Transition onset, but 4h execution remains negative after benchmark friction.

### 12 trading bars
- directional accuracy: 48.48%
- C0: +0.190
- C1: +0.009
- C2: -0.172
- C1 win rate: 44.59%

C1 is approximately flat/slightly positive, but C2 remains negative.

### 24 trading bars
- directional accuracy: 53.99%
- C0: +0.218
- C1: +0.045
- C2: -0.128
- C1 win rate: 51.64%

The longer horizon retains some post-confirmation drift, but remains cost-fragile.

## Comparison at h=4
Trade every Transition onset:
- C1 -0.337

Logistic onset gate:
- C1 -0.361

Confirmed handoff:
- C1 -0.076

Oracle real-Trend subset entered at onset:
- C1 +0.295
- C2 +0.113

Interpretation:
- Transition classification matters.
- Waiting for confirmation removes much of the fake-break damage.
- But entering immediately after confirmation gives up a large part of the early impulse.

## Direction asymmetry

### h=4
Confirmed up:
- n=142
- C1 -0.019
- C2 -0.196

Confirmed down:
- n=126
- C1 -0.141
- C2 -0.315

### h=12
Confirmed up:
- C1 +0.103
- C2 -0.077

Confirmed down:
- C1 -0.101
- C2 -0.283

### h=24
Confirmed up:
- n=115
- C1 +0.303
- C2 +0.130

Confirmed down:
- n=98
- C1 -0.257
- C2 -0.431

This asymmetry is descriptive and may reflect the large historical upward regime in gold. It must not be converted into a long-only rule from this sample.

## Confirmation-delay diagnosis
Most real trends confirm on the first Transition bar.

Evaluation resolutions:
- delay 1: 302 total episodes
- delay 2: 89
- delay 3: 63

Real Trend:
- delay 1: 245 / 280 = 87.5%
- delay 2: 14
- delay 3: 21

Range resumed:
- delay 1: 57
- delay 2: 75
- delay 3: 42

If still unresolved after the first Transition bar:
- 152 episodes remain
- 35 later become Trend
- 117 return to RANGE
- later-Trend rate only ~23%

## Economics by confirmation delay

### delay=1
h=4:
- n=236
- C1 -0.090
- C2 -0.265

h=12:
- n=204
- C1 -0.004
- C2 -0.186

h=24:
- n=187
- C1 +0.070
- C2 -0.104

### delay=2
Small sample.
h=4 C1 +0.029
h=12 C1 +0.190, C2 +0.034
h=24 C1 -0.260

### delay=3
Small sample.
h=4 C1 +0.024
h=12 C1 +0.050
h=24 C1 -0.041

No confirmation-delay subgroup is promoted into a rule from this sample.

## Registered h=4 screen
FAILED:
- active >=150: PASS
- C0 >0: PASS
- C1 >0: FAIL
- C2 >=0: FAIL
- C1 win rate >50%: FAIL
- both directions >=50: PASS

## Structural conclusion
The market-state routing is working:
- RANGE -> Scalper context
- TRANSITION -> Scalper OFF
- confirmed TREND -> Swing context

But TREND confirmation is not itself a complete Swing entry trigger.

The next layer must solve entry timing inside an already-confirmed trend:
- wait for correction/retest,
- avoid buying after the impulse peak,
- avoid selling after a downside exhaustion,
- enter only when the correction rejects the broken range boundary / trend structure.

## Decision
- Keep State Engine v0.2 frozen as routing authority.
- Keep deterministic confirmation as the permission to switch from Transition to Swing mode.
- Do not use immediate post-confirmation entry as final strategy.
- Next: preregister and test a causal Swing Retest Entry layer after confirmation.
- No threshold mining from the direction or delay subgroups.
- Historical Holdout remains closed.
