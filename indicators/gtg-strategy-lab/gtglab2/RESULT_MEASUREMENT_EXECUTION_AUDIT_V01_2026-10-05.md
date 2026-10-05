# RESULT — Measurement & Execution Audit v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0047

Protocol commit:
- 492ad7a — research: preregister measurement execution audit v0.1

Implementation commit:
- bd6b2b6 — research: implement measurement execution audit v0.1

Reference checkout:
- b9f645b6781021b923430710afd9881d25a9d009

Pristine Forward OOS:
- NOT READ

## Executive result

The independent review's main measurement concerns were confirmed.

The previous Integrated Decision Architecture result:

- 1,991 trades
- +108.114R
- PF 1.136
- reported signal-ordered DD -24.690R

was materially inflated by non-executable long entry pricing and contained accounting / representation defects.

The most important attribution test kept the OLD integrated live signal set and changed the price-side contract only:

### Old live signal set, repriced with historical quoted spread

- 1,944 executable trades
- +5.513R
- mean +0.00284R/trade
- PF 1.0069
- exit-ordered realized DD -37.670R

47 old live signals became invalid when long entry was moved from BID open to ASK open:
- Scalper: 46
- Swing: 1

Therefore the prior +108R should not be treated as executable historical edge.

After correcting the data/measurement contracts and refitting only where required by the frozen recipe, the corrected architecture produced:

### Corrected combined live

- 1,673 trades
- +46.036R
- mean +0.02752R/trade
- PF 1.06365
- win rate 56.31%
- exit-ordered realized DD -26.595R
- M5 mark-to-market portfolio DD -27.443R
- maximum concurrent trades: 2

This is a positive historical research result, but much weaker than the original headline result.

## Engine separation

### Scalper — corrected

Shadow:
- 1,458 trades
- -51.999R
- PF 0.8589

After frozen Health:
- 781 trades
- -23.432R
- mean -0.03000R
- PF 0.8802
- M5 MTM DD -30.472R
- win rate 74.26%
- average entry RR 0.309

Broad segments:
- 2018-2022: -20.028R, PF 0.825
- 2023-2024: -4.673R, PF 0.892
- 2025-2026: +1.268R, PF 1.033

Decision:
The current Scalper architecture does NOT survive executable-price correction.
Its high win rate is not enough to offset its weak post-entry reward geometry and spread.

Important classification result:
Control Transfer still ranks labels:
- Train AUC 0.635
- Validation AUC 0.625
- diagnostic AUC 0.668

This reinforces the project's earlier lesson:
classification quality is not execution edge.

### Swing — corrected

Shadow:
- 1,177 trades
- +79.654R
- PF 1.114

After frozen Health:
- 892 trades
- +69.468R
- mean +0.07788R
- PF 1.1317
- M5 MTM DD -25.404R
- win rate 40.58%
- average entry RR 1.778

Broad segments:
- 2018-2022: +33.976R, PF 1.116
- 2023-2024: +22.508R, PF 1.161
- 2025-2026: +12.984R, PF 1.138

Decision:
Swing remains the only engine with a meaningful positive historical result after the measurement correction.

Wave model discrimination remains weak:
- Train AUC 0.580
- Validation AUC 0.537
- diagnostic AUC 0.513

So the positive Swing result should not be interpreted as proof that the Wave score predicts individual trades well.

## Corrected combined yearly results

2018 partial:
- 149 trades
- +4.811R
- PF 1.061

2019:
- 153 trades
- -6.543R
- PF 0.905

2020:
- 226 trades
- +3.012R
- PF 1.033

2021:
- 234 trades
- -0.209R
- PF 0.997

2022:
- 168 trades
- +12.878R
- PF 1.144

2023:
- 182 trades
- -0.444R
- PF 0.995

2024:
- 236 trades
- +18.279R
- PF 1.190

2025:
- 196 trades
- +24.251R
- PF 1.332

2026 through September:
- 129 trades
- -9.999R
- PF 0.831

2026 remains materially negative after correction.

The 2026 problem did NOT disappear as a measurement artifact.

However the corrected 2026 loss is smaller than the old reported -16.505R because the corrected model/event/Health path is different.

## Corrected broad chronological segments

2018-2022:
- 930 trades
- +13.949R
- PF 1.034

2023-2024:
- 418 trades
- +17.835R
- PF 1.097

2025-2026:
- 325 trades
- +14.252R
- PF 1.108

All three broad segments remain positive, but the first segment is weak and the annual distribution is materially less stable than previously reported.

Do not treat these as independent OOS blocks:
the historical corpus has been repeatedly consumed by research.

## Defect attribution

| Stage | Trades | Total R | Mean R | PF | DD definition | DD |
|---|---:|---:|---:|---:|---|---:|
| Old reported Integrated | 1,991 | +108.114 | +0.05430 | 1.136 | signal-ordered final trades | -24.690 |
| Same old live signals + quoted spread | 1,944 | +5.513 | +0.00284 | 1.0069 | exit-order realized | -37.670 |
| Corrected architecture before Health | 2,635 | +27.654 | +0.01050 | 1.0259 | exit-order realized | -34.672 |
| Corrected architecture after Health | 1,673 | +46.036 | +0.02752 | 1.0637 | M5 MTM portfolio | -27.443 |

Interpretation:

1. Executable price side / spread is the dominant confirmed distortion in the old headline result.
2. Correcting true-H1 features, decision-time event streams, label boundaries, and Control Transfer normalization recovers some historical expectancy.
3. Frozen Health improves corrected combined PnL because it removes a net-losing subset, especially from the weak Scalper engine.
4. The recovery from +5.513R to the corrected architecture is a bundled effect of several measurement/model corrections. v0.1 does NOT claim an exact R contribution for each of D03/D05/D06/D07 separately.

## Event-stream reconciliation

### Scalper
- state-eligible decision events: 4,731
- scored events: 4,731
- Train boundary-valid labels: 2,558
- Validation boundary-valid labels: 1,076
- diagnostic valid labels: 865
- unlabeled / execution-invalid: 232
- selected by Control Transfer: 1,842
- overlap skipped: 156
- invalid next ASK open: 228
- corrected shadow trades: 1,458
- Health-live trades: 781

Historical old scored stream had only 4,559 events.

Therefore future-dependent label/execution filtering had removed part of the decision-time event stream.

### Swing
- state-eligible decision events: 5,107
- scored events: 5,107
- Train boundary-valid labels: 2,857
- Validation boundary-valid labels: 1,232
- diagnostic valid labels: 1,010
- unlabeled / execution-invalid: 8
- Wave permission events: 2,320
- overlap skipped: 1,137
- invalid next ASK open: 6
- corrected shadow trades: 1,177
- Health-live trades: 892

## Verified implementation defects

Confirmed on reference SHA b9f645b:

1. Long execution used BID open instead of executable ASK open.
2. Combined DD was based on final trade PnL sorted by signal time.
3. Wave structural H1 logic sampled every 12th M5 row instead of aggregating true H1 high/low.
4. 24H/72H etc. frequently represented observation counts rather than wall-clock duration.
5. Permission streams were derived from rows filtered by future label/execution availability.
6. Split assignment used signal year without requiring label completion before the split boundary.
7. Control Transfer contained raw-price features.
8. max_adverse_anchor_atr was structurally degenerate.

Empirical check:
- max absolute value of old max_adverse_anchor_atr over eligible Scalper events = 0.0.

## Same-bar ambiguity

M5 bars touching both stop and target encountered during the audit:
- 13

Resolved by chronological underlying M1:
- 9

Still ambiguous within the same M1 bar / missing resolution:
- 4

Frozen conservative rule for unresolved cases:
- STOP first.

This defect exists, but its observed frequency is small relative to the pricing-side defect.

## Split / stream invariants

Post-run checks:

- Train boundary violations, Scalper: 0
- Validation boundary violations, Scalper: 0
- Train boundary violations, Swing: 0
- Validation boundary violations, Swing: 0

All decision events scored:
- Scalper: 4,731 / 4,731
- Swing: 5,107 / 5,107

Portfolio reconciliation:
- sum of corrected combined live PnL = +46.035621R
- final realized portfolio PnL = +46.035621R

Invalid risk rows:
- 0

ASK-entry below BID-entry violations:
- 0

## Cost sensitivity

Primary corrected result already includes the historical quoted spread through ASK-entry / BID-exit.

It does NOT include broker-specific commission, financing, tax, or actual slippage.

Frozen additional slippage sensitivity:

### Combined
Quoted spread only:
- +46.036R
- PF 1.0637

Additional 0.25 × contemporaneous spread adverse at each side:
- +4.909R
- PF 1.0066

Additional 0.50 × spread each side:
- -36.217R
- PF 0.9524

Additional 1.00 × spread each side:
- -118.470R
- PF 0.8519

Break-even additional cost:
- about +0.0275R per trade beyond quoted spread.

### Swing
Quoted spread only:
- +69.468R
- PF 1.1317

+0.25 × spread each side:
- +47.821R
- PF 1.0885

+0.50 × spread each side:
- +26.175R
- PF 1.0473

+1.00 × spread each side:
- -17.119R
- PF 0.9705

Break-even additional cost:
- about 0.0779R per trade beyond quoted spread.

### Scalper
Already negative with quoted spread.
No positive cost cushion exists in the current corrected architecture.

## Portfolio accounting

Corrected combined M5 mark-to-market:
- final realized: +46.036R
- M5-close max drawdown: -27.443R
- maximum concurrent trades: 2
- maximum nominal initial risk under the historical 1R-per-engine convention: 2R

Important limitation:
This is M5-close MTM, not tick-level or M1 intrabar portfolio drawdown.
Intrabar drawdown may be worse.

The old -24.690R signal-ordered DD is no longer used as the primary portfolio-risk metric.

## Main scientific conclusion

The Measurement & Execution Audit changes the research interpretation materially.

### What survives
- Swing retains a positive historical expectancy under quoted-spread execution.
- The 2025 strength remains visible.
- The 2026 Swing failure remains visible.
- The need to understand opportunity geometry / conditional path remains justified.

### What does not survive
- The original +108R headline as executable evidence.
- Current Scalper edge.
- The claim that the old reported drawdown represented portfolio risk.
- treating the old decision-event stream as fully causal.

### What is now the simplest explanation to test
Before Productive / Destructive Expansion modeling, test whether the remaining 2026 Swing deficit is explained by:

1. entry geometry consumption;
2. opportunity-composition change;
3. conditional path change within matched opportunities.

The corrected result strengthens the case for focusing on Swing first.

## Decision

Experiment 1 status:
PASS AS MEASUREMENT AUDIT.

Not because PnL improved, but because:
- the known defects were reproduced;
- executable price sides were incorporated;
- decision events were separated from future labels;
- outcome boundaries were corrected;
- true H1 structural features were used;
- M1 resolved M5 ordering where possible;
- portfolio accounting was made chronological and mark-to-market.

Trading / promotion decision:
NO-GO.

Scalper:
NO-GO in current form.

Swing:
RETAIN FOR RESEARCH, NOT PROMOTE.

Next experiment:
Experiment 2 — Opportunity Composition vs Conditional Path Change.

Do not build Productive / Destructive Expansion classifier yet.

Pristine Forward OOS remained unread.

*2018 begins 2018-03-01.
**2026 ends 2026-09-30.
