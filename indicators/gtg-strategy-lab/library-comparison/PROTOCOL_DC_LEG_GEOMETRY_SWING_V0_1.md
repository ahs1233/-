# GTG DC Leg Geometry Swing v0.1 — structural quality filter

Registered 2026-10-03 before any geometry-filtered execution outcome is computed.

## Evidence status
Exploratory Train-only post-selection diagnostic.
It follows DC Correction -> Resumption Swing v0.1, whose 2021-2024 h4 result was positive but historically unstable.
This experiment is specifically designed to test whether simple leg geometry removes weak/late corrections without using the post-hoc delay bins.

Validation and Historical Holdout remain closed.

## Frozen source
Use frozen DC Correction -> Resumption Swing v0.1 artifacts:

- signals.jsonl SHA256:
  3c8fc33e85e317ae45e91e01458d6074a2cc8b6764c95e4edf98b80103f8a736
- records.jsonl SHA256:
  d2d11157e64481667d4212b241a0c95c96fa0630e19bfd6b04689ec81725a13f
- summary.json SHA256:
  bb17fbecfb3a8cb08287c91a4bbc484992287a465a4fa82abda3cffb4082dc60

Confirmed Handoff v0.3 records SHA256 (for the original frozen range boundaries only):
- 45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd

State Engine canonical H1 manifest SHA256:
- 30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a

Only source signals with status = DC_RESUMPTION_ENTRY are eligible.
No source signal timestamp or direction may be changed.

## DC reconstruction
Reuse compare.dc_states exactly on canonical H1 BID close:
- fine threshold = 0.0025

For every source resumption signal s:
- c = frozen correction_idx
- s = frozen signal_idx
- d = frozen resolved Trend direction

Find the immediately preceding fine-DC confirmation p before c.
It must have direction d.
If absent or structurally inconsistent, fail closed.

## Leg geometry

### Prior Trend impulse
Previous confirmation p identifies the start pivot of the prior Trend leg.
Correction confirmation c identifies the Trend extreme where the correction began.

Let:
- impulse_start_price = fine[p].pivot_price
- impulse_end_price = fine[c].pivot_price
- impulse_start_idx = fine[p].pivot_at
- impulse_end_idx = fine[c].pivot_at

Directional impulse amplitude:
- impulse_amp = d * (impulse_end_price - impulse_start_price)

Impulse duration:
- impulse_bars = impulse_end_idx - impulse_start_idx

Impulse speed:
- impulse_speed = impulse_amp / impulse_bars

Require impulse_amp > 0 and impulse_bars > 0.

### Correction leg
Resumption confirmation s identifies the correction extreme.

Let:
- correction_end_price = fine[s].pivot_price
- correction_end_idx = fine[s].pivot_at

Directional correction amplitude:
- correction_amp = d * (impulse_end_price - correction_end_price)

For both long and short, this is positive when the correction moved against the Trend.

Correction duration:
- correction_bars = correction_end_idx - impulse_end_idx

Correction speed:
- correction_speed = correction_amp / correction_bars

Require correction_amp > 0 and correction_bars > 0.

### Derived diagnostics
Persist:
- depth_ratio = correction_amp / impulse_amp
- speed_ratio = correction_speed / impulse_speed
- impulse_amp_atr = impulse_amp / ATR[s]
- correction_amp_atr = correction_amp / ATR[s]
- signal_distance_from_boundary_atr

These are diagnostics; the filter below uses only natural unit boundaries.

## Frozen geometry filter
A source DC-resumption signal is tradable only if ALL hold:

1. prior impulse is larger than the correction:
   - impulse_amp > correction_amp
   - equivalently depth_ratio < 1

2. correction is slower/weaker per bar than the prior impulse:
   - correction_speed < impulse_speed
   - equivalently speed_ratio < 1

3. resumption close is still beyond the original broken source-range boundary:
   - TREND_UP: Close[s] > frozen_upper
   - TREND_DOWN: Close[s] < frozen_lower

No Fibonacci band, delay window, percentile, quantile, learned threshold, or year-specific rule is used.

## Policies
A. ALL_DC_RESUMPTIONS
- every frozen DC_RESUMPTION_ENTRY from source v0.1

B. LEG_GEOMETRY_FILTER
- only source signals satisfying all three frozen structural conditions

The entry timestamp remains exactly the source entry:
- open(s+1)

No later signal replacement.

## Outcomes
Reuse source execution outcomes when exact event/signal/horizon join exists:
- h = 4, 12, 24

No price outcome is recomputed to decide the filter.

Metrics:
- entries
- retained fraction
- up/down counts
- geometry distributions
- C0/C1/C2 mean/trade
- C1 win rate
- directional accuracy
- by year when n>=5

Report library and evaluation separately.

## Registered stability screen — h4
Because this experiment is explicitly motivated by the source rule's short-horizon continuation and its historical instability, the screen is cross-period and deliberately strict.

All must hold:
1. library filtered h4 n >= 10
2. evaluation filtered h4 n >= 15
3. evaluation up >=5 and down >=5
4. library h4 C1 >0
5. evaluation h4 C1 >0
6. library h4 C2 >=0
7. evaluation h4 C2 >=0
8. evaluation h4 C1 win rate >0.50
9. at least two of 2021, 2022, 2023 have positive h4 C1 with n>=5
10. evaluation filtered h4 C1 > evaluation ALL_DC_RESUMPTIONS h4 C1

This screen is development evidence only.

## Integrity
- source hashes unchanged
- canonical manifest unchanged
- exact source signal/event join
- no source signal timing changed
- immediately preceding fine confirmation used
- geometry uses pivot information already confirmed by s
- no backdated execution
- no delay-bin selection
- no outcome field enters filter
- Validation read=false
- Historical Holdout read=false

## Decision
If the geometry filter passes:
- freeze it as a candidate short-continuation Swing entry,
- require a new independent temporal gate before any Holdout decision.

If it fails:
- do not tune depth/speed ratios on this sample;
- move to a learned causal leg-quality model only if enough independent development observations exist,
  otherwise preserve the structural result and defer confirmation to future/pristine data.

No Holdout opens automatically.
