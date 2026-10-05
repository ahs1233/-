# RESULT — Swing Loss-Path Audit v0.1

Date: 2026-10-05
Experiment ID: GTGLAB2-0052

Protocol:
- 7b9d29b — preregister Swing Loss-Path Audit v0.1

Implementation:
- 121f9fd — initial implementation
- ef4974b — bootstrap performance-only refactor
- c981c42 — add timing summaries required by protocol
- 534bada — correct exit-time label from observed to elapsed-clock minutes

Base:
- 18e4865

Pristine Forward OOS:
- NOT READ

## Executive verdict

**Primary mechanism classification: HORIZON_INVALIDATION_CANDIDATE.**

This means:

> Under the frozen definitions, a material and segment-persistent share of corrected Swing losses later recovered substantially within the trade's original 864-M5 opportunity horizon after the policy had already exited.

It does NOT mean:
- the stop should simply be widened,
- the original stopped trade should be retrospectively called a winner,
- holding through the stop would have been profitable,
- or the market cause of the failure has been identified.

The result identifies a mechanical research direction:
**the current invalidation/exit event may occur materially earlier than the full opportunity horizon for a large subset of stopped ideas.**

---

# 1. Reconciliation

Corrected Swing Shadow before Health:

- trades: **1,177**
- pre-exit path available: **1,177 / 1,177**
- original 864-M5 horizon complete: **1,176 / 1,177**
- losses: **699**
- target exits: **465**
- total corrected Shadow R: **+79.654R**

This exactly matches the Measurement & Execution Audit Shadow result.

For clarity:

Experiment 1 reported:
- Shadow: 1,177 trades, **+79.654R**
- after frozen Health: 892 trades, **+69.468R**

Experiment 5 intentionally uses Shadow before Health to study the underlying trade path.

---

# 2. Where losses are booked

Exit classes:

- STOP: **695**
- STOP_GAP: 1
- AMBIGUOUS_STOP_FIRST: 1
- TARGET: 462
- TARGET_GAP: 3
- TIMEOUT: 15

Of 699 losing trades:

- 697 are stop / stop-gap / ambiguous-stop-first exits
- only 2 are negative timeouts

Thus almost all historical losses are mechanically realized through the hard-stop branch.

This is descriptive accounting, not evidence that the stop is wrong.

---

# 3. How far losing trades progress before failing

Frozen losing-trade archetypes:

| Archetype | n | Share of losses |
|---|---:|---:|
| NO_START: MFE < +0.5R | **405** | **57.94%** |
| STARTED_THEN_FADED: +0.5R to <+1R | **176** | **25.18%** |
| STRONG_PROGRESS_FAILED: >=+1R | **118** | **16.88%** |

Bootstrap, 2,000 five-entry-day blocks:

NO_START:
- point: 57.94%
- 95% CI: **[54.52%, 61.66%]**

STRONG_PROGRESS_FAILED:
- point: 16.88%
- 95% CI: **[14.25%, 19.49%]**

The preregistered Entry Initiation criterion required:
- >=60% full-history NO_START
- >=50% in every broad segment

Full-history is **57.94%**, so it FAILS.

Even though the CI includes 60%, the protocol uses the frozen point-estimate rule, not a post-result relaxation.

The Profit Retention criterion required:
- >=30% strong-progress failures full-history
- >=25% in every segment

Observed:
**16.88%**

So it clearly FAILS.

---

# 4. Progress before the first material adverse move

Primary material-adverse threshold:
-0.50R.

Among losing trades, excluding 10 M1-order ambiguities:

progress before first -0.5R:

- median: **+0.239R**
- P25: +0.051R
- P75: +0.567R
- P90: +1.011R

This says the typical loser does not produce much favorable movement before encountering its first meaningful adverse excursion.

But this alone was not strong enough under the frozen mechanism rule to classify the system as an Entry Initiation failure.

---

# 5. Threshold ordering

Among 699 losses:

### +/-0.5R

- ONLY_MINUS: **405 = 57.94%**
- PLUS_FIRST: 207 = 29.61%
- MINUS_FIRST: 86 = 12.30%
- SAME_M1_AMBIGUOUS: 1

Thus the 405 NO_START trades are exactly the trades that hit -0.5R without ever reaching +0.5R first.

### +/-1.0R

- ONLY_MINUS: **579 = 82.83%**
- PLUS_FIRST: 114 = 16.31%
- SAME_M1_AMBIGUOUS: 3
- NEITHER: 2
- ONLY_PLUS: 1

Again, only a minority of losing trades had already produced >=+1R progress.

This is why Profit Retention was not selected as the primary candidate.

---

# 6. Local structural failure

Across all 1,177 trades:

- reclaim close loss rate: **86.83%**
- anchor recross rate: **76.21%**

Among losses:

- reclaim close loss occurred in **698 / 699**
- anchor touch recross occurred in **699 / 699**

Timing among losses:

reclaim close loss:
- median **3 completed M5 bars**
- roughly 15 observed market minutes at the median

anchor touch recross:
- median **66 observed M1 minutes**

These facts show that the local HIGH_RECLAIM transition frequently loses its reclaimed structure quickly on trades that eventually stop.

However these metrics are partly mechanically linked to the stop geometry:
a trade that stops below anchor_low necessarily traverses the anchor region.

Therefore reclaim/anchor failure is treated as a sequence description, not an independent predictor.

---

# 7. Pre-exit timing

Among losses:

MFE time:
- median **76 observed M1 minutes**
- P25 14
- P75 281
- P90 712

MAE time:
- median **276 observed M1 minutes**
- P25 116
- P75 769
- P90 1,430

First +0.5R, when achieved:
- median 110 observed minutes

First +1R, when achieved:
- median 249 observed minutes

First -0.5R:
- median 87 observed minutes

First -1R:
- median 276 observed minutes

The typical losing trade therefore experiences its limited favorable excursion relatively early, then continues into larger adverse movement.

This still does not imply that holding through the loss is justified.

---

# 8. The central post-exit result

Eligible losing non-target exits with complete remaining original horizon:

**697**

After the actual corrected exit, but before the ORIGINAL 864-M5 horizon ended:

- recovered original entry price: **538 / 697 = 77.19%**
- later reached +0.5R: **480 / 697 = 68.87%**
- later reached +1R: **400 / 697 = 57.39%**
- later reached +2R: **264 / 697 = 37.88%**
- later reached original target: **298 / 697 = 42.75%**

Median post-exit MFE:
**+1.293R**

These are not hypothetical PnL conversions.
The original loss remains a loss.

They show only that many stopped ideas later experienced substantial favorable movement before the original opportunity horizon expired.

---

# 9. Post-exit timing

For losing trades that later reach each level:

Recovery to original entry:
- n=538
- median **379 observed M1 minutes after exit**

Later +0.5R:
- n=480
- median **843 observed minutes**

Later +1R:
- n=400
- median **1,284 observed minutes**

Later original target:
- n=298
- median **1,622 observed minutes**

P25 / P75:

later +1R:
- P25 515 min
- P75 2,167 min

later target:
- P25 1,044 min
- P75 2,660 min

So the later favorable move is generally not an immediate stop-out noise reversal.
It often occurs materially later within the still-open original 864-M5 opportunity horizon.

That distinction is why the next research direction should concern **invalidation / second-chance logic**, not simply a few-tick stop adjustment.

---

# 10. Broad-segment stability

## 2018-2022

Losses: 394
Post-exit eligible: 392

Later +1R:
**53.83%**

Later original target:
**38.78%**

## 2023-2024

Losses: 168
Eligible: 168

Later +1R:
**55.95%**

Later target:
**42.86%**

## 2025-2026

Losses: 137
Eligible: 137

Later +1R:
**69.34%**

Later target:
**54.01%**

This satisfies the preregistered Horizon/Invalidation stability rule:
the full-history rate is material, and at least two broad segments are within 10 percentage points of the full-history rate.

It is not confined to 2026.

---

# 11. Year-level heterogeneity

Late target recovery is not uniform by year.

Examples:

- 2018: 42.86%
- 2019: 46.77%
- 2020: **21.62%**
- 2021: 36.08%
- 2022: 46.88%
- 2023: 43.96%
- 2024: 41.56%
- 2025: **66.18%**
- 2026: **42.03%**

Late +1R:

- 2020: 37.84%
- 2025: 79.41%
- 2026: 59.42%

Therefore Horizon/Invalidation is a candidate mechanism, not a universal law.

2025 in particular shows exceptionally high later recovery.
2026 still shows a material rate, but it is lower than 2025.

This prevents the audit from being turned into a simple "2026 needs wider stops" story.

---

# 12. 2025 versus 2026 descriptively

No matching, weighting, or causal comparison is attempted here.

2025:
- 122 trades
- +22.14R
- 68 losses
- NO_START among losses: 55.88%
- strong-progress failure: 16.18%
- late +1R after loss: 79.41%
- late target after loss: 66.18%

2026:
- 105 trades
- -8.34R
- 69 losses
- NO_START: **47.83%**
- started-then-faded: **33.33%**
- strong-progress failure: 18.84%
- late +1R: **59.42%**
- late target: **42.03%**
- reclaim-loss rate: 89.52%
- anchor-recross rate: 80.95%

A notable descriptive point:

2026 does NOT have a higher NO_START share than 2025.
Its loss mix contains more trades that first make some +0.5R to <+1R progress and then fail.

But Experiment 5 is not designed to prove a 2025-vs-2026 causal mechanism.

---

# 13. Bootstrap uncertainty

2,000 block replications completed.

NO_START:
- 57.94%
- 95% CI [54.52%, 61.66%]

STRONG_PROGRESS_FAILED:
- 16.88%
- CI [14.25%, 19.49%]

Late +1R:
- 57.39%
- CI **[52.74%, 61.85%]**

Late target:
- 42.75%
- CI **[38.22%, 47.25%]**

The later-recovery signal is therefore not a tiny-sample artifact under this descriptive block resampling.

It remains non-causal.

---

# 14. Frozen mechanism decision

### ENTRY_INITIATION_CANDIDATE

**FAIL**

Reason:
full-history NO_START = 57.94%, below frozen 60% threshold.

### PROFIT_RETENTION_CANDIDATE

**FAIL**

Reason:
strong-progress failures = 16.88%, far below frozen 30%.

### HORIZON_INVALIDATION_CANDIDATE

**PASS**

Reason:
- late +1R = 57.39% > 30%
- late original target = 42.75% > 15%
- broad-segment stability condition satisfied

Exactly one candidate passes.

Therefore the final classification is:

# HORIZON_INVALIDATION_CANDIDATE

---

# 15. What this means mechanically

The current Swing system often does this:

1. HIGH_RECLAIM triggers.
2. The local reclaim is lost relatively quickly.
3. Price returns through the anchor / reaches the hard stop.
4. The position correctly realizes the predefined loss.
5. Yet in a material fraction of cases, the market later rebuilds and produces a large favorable move before the original 864-M5 opportunity horizon expires.

The important distinction is:

**Trade invalidation and idea invalidation may not be the same event.**

The hard stop may still be necessary for capital protection.
The research question is whether the *idea* should be allowed a second independently confirmed attempt after the first position has been stopped.

---

# 16. What this does NOT justify

Do NOT conclude:

- widen the stop
- remove the stop
- hold through -1R
- turn stopped trades into winners
- extend every trade to 864 M5
- add averaging down
- martingale after stop
- use 2025/2026-specific rules

A later target after stop says nothing about the path risk required to survive continuously until that target.

That counterfactual was intentionally not simulated.

---

# 17. Single next mechanical hypothesis

Because exactly one mechanism candidate passed, the research constitution allows ONE next mechanical hypothesis.

Recommended hypothesis:

## Fresh-Reclaim Re-entry Hypothesis

> After a corrected Swing trade is stopped, the trade idea is not automatically re-entered. If, within the REMAINING original 864-M5 horizon, the market forms a fresh valid Swing transition and produces a new HIGH_RECLAIM, one separately risked second attempt may capture part of the observed late recovery without widening the original hard stop.

Key principles for the future experiment:

- first trade stop remains unchanged
- no holding through stop
- no averaging down
- maximum one second attempt
- second attempt requires a fresh causal transition; mere price recovery is insufficient
- risk is separately capped
- total idea-level risk must be compared with the one-shot baseline
- original opportunity horizon remains fixed
- test across all historical segments, not 2026 only
- no Productive/Destructive model required

This is the single mechanism justified by Experiment 5.

It is NOT yet proven profitable.

---

# 18. Research status

- Scalper: PARKED
- Swing: RESEARCH ONLY
- Experiment 2: INCONCLUSIVE
- Experiment 3: DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE
- Experiment 4: INCONCLUSIVE due limited effective overlap
- Experiment 5: **HORIZON_INVALIDATION_CANDIDATE**
- next allowed mechanical hypothesis: **Fresh-Reclaim Re-entry**
- Productive / Destructive Expansion: DEFERRED
- Pristine Forward OOS: SEALED

The project now has a narrower mechanical question than "what changed in 2026":

> Does one fresh, independently confirmed second attempt after a stop improve idea-level expectancy without increasing total risk beyond an acceptable fixed budget?

That question can be tested directly in the next experiment without reopening the annual-comparison problem.
