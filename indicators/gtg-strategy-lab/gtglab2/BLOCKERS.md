# GTGLab2 — Blockers Register

Registered 2026-10-04.

Purpose: identify what currently prevents GTGLab2 from producing a defensible, repeatable trading result.

## Priority 0 — No proven executable edge yet

**Status:** OPEN — critical.

Historical experiments repeatedly showed that classification or directional information can look useful while execution economics remain weak or negative.

Examples already recorded:
- transition classifier: useful classification, not enough economic edge,
- early breakout / logistic filter: negative C1,
- range guard: negative C1,
- raw sequence utility: negative C1,
- DC resumption: negative validation economics,
- Chronos-2: no incremental edge over baseline.

**Why this blocks results**
A trading system is not successful because it predicts direction. It needs positive incremental expectancy after costs, with stability across time/regimes.

**Close when**
At least one registered candidate shows positive and stable out-of-sample execution economics after realistic costs and survives the registered validation process.

---

## Priority 1 — Entry timing / transition resolution is still the central unsolved problem

**Status:** OPEN — critical.

The State Engine can classify broad regimes, but the research has not yet solved reliably:
- when a range is truly ending,
- when a breakout is a trap,
- when a trend has enough confirmation to enter without giving away the move,
- where correction becomes resumption,
- when a range scalp should stop.

**Why this blocks results**
Correct direction entered at the wrong moment can still lose money.

**Close when**
A registered timing rule or model adds positive incremental execution value over the same State Engine baseline.

---

## Priority 2 — Forward microstructure evidence is not mature enough yet

**Status:** OPEN by protocol — critical.

The microstructure hypothesis is intentionally locked from outcome testing until:
- >=30 elapsed calendar days,
- >=10,000 valid forward snapshots.

At GTGLab2 initialization the corpus had only 128 captures.

**Why this blocks results**
Testing now would encourage feature selection against a tiny, highly correlated sample and create false confidence.

**Close when**
The readiness gate is reached and the corpus is frozen for the first preregistered edge test.

---

## Priority 3 — Minute snapshots are highly dependent; the effective sample size is much smaller than the row count

**Status:** OPEN — high.

10,000 one-minute snapshots are not 10,000 independent market situations.

Many consecutive snapshots belong to the same:
- session,
- trend,
- range,
- news event,
- transition episode.

**Why this blocks results**
A model can appear statistically strong by repeatedly observing the same event.

**Close when**
Evaluation is episode/time-block based, with purged walk-forward splits and regime/session coverage rather than IID row-level assumptions.

---

## Priority 4 — Microstructure sources are proxies, not the global OTC XAU/USD order book

**Status:** OPEN — high.

Current evidence includes instruments such as:
- Binance XAU perpetual proxy,
- Kraken PAXG/USD,
- Bitfinex XAUT,
- other venues when reachable.

These do not equal the decentralized OTC spot-gold market.

**Why this blocks results**
Order flow may be informative, but its relationship to canonical XAU/USD must be demonstrated rather than assumed.

**Close when**
Forward testing proves that proxy microstructure adds stable incremental value to canonical JForex XAU/USD outcomes across multiple regimes.

---

## Priority 5 — Source redundancy and evidence quality are uneven

**Status:** OPEN — medium/high.

At initialization:
- Bitfinex availability: 128/128,
- Bitfinex ready executed-trade evidence: 48/128,
- Binance ready family evidence: 124/128,
- Kraken ready family evidence: 124/128,
- OKX connectivity was unavailable from the current route.

Fusion Grade is strict now, but source diversity is still narrower than ideal.

**Why this blocks results**
A result dominated by two related/repeating proxy sources may not generalize.

**Close when**
Coverage is stable enough to perform source ablations and the edge survives removal of any single venue/family.

---

## Priority 6 — Execution realism is not yet the final decision layer

**Status:** OPEN — high.

Any eventual signal still needs to survive:
- BID/ASK spread,
- slippage,
- latency,
- entry delay,
- stop/exit mechanics,
- market-session differences,
- turnover,
- realistic order execution.

**Why this blocks results**
A predictive edge can disappear after implementation costs.

**Close when**
The same registered candidate remains positive under conservative C1/C2 execution assumptions and later forward/paper execution.

---

## Priority 7 — Swing and Scalper action policies frozen as executable contracts

**Status:** CLOSED — 2026-10-04.

`PROTOCOL_EXECUTION_CONTRACTS_V10.md` and `engine/action_contracts.py` now freeze:
- bidirectional Long/Short symmetry,
- Swing v1 = Acceptance → Retest → Continuation,
- Scalper v1 = Rejection / Range Fade reference contract,
- next-H1-open fills,
- five maximum tranches at 0.20R each,
- no additions after invalidation,
- Swing timeout = 24 H1 bars,
- Scalper timeout = 12 H1 bars,
- inherited MTF conflict rules,
- deterministic invalidation semantics.

These values were inherited from the preregistered Sweep/Acceptance v0.1 protocol rather than selected after observing new outcomes.

Verification:
- execution-contract tests PASS,
- contracts are registered in `CANDIDATE_REGISTRY.json`,
- neither contract is production/paper eligible merely because the action policy is frozen.

Scalper v1 remains a reproducibility/reference contract because the current rejection/fade development evidence is negative.

---

## Priority 8 — JForex export is not fully autonomous from a fresh machine/session

**Status:** OPEN — operational.

Seal/audit is automated and fail-closed.
The JForex exporter itself depends on an authenticated JForex environment/session; standalone SDK credentials are not configured as environment variables.

**Why this blocks results**
A missed export day creates a canonical-price data gap even when microstructure collection continues.

**Close when**
Canonical forward export can recover automatically after restart/logoff, or an equivalent authenticated supported automation path is established and tested.

---

## Priority 9 — Research sprawl / feature hopping remains a methodological risk

**Status:** CONTROLLED but open.

GTGLab already tested many approaches:
- logistic transition,
- directional change,
- sequence models,
- range guards,
- symbolic methods,
- Chronos.

The danger is responding to every failure by adding another indicator/model.

**Why this blocks results**
Repeated adaptive searching against the same history creates overfitting even when each individual test looks reasonable.

**Close/control**
- preregister one hypothesis at a time,
- retain failed candidates,
- demand incremental value over baseline,
- limit multiple comparisons,
- do not move success criteria after seeing outcomes.

---

# Critical path

The shortest defensible path to a real result is:

1. Keep forward microstructure + canonical JForex collection clean.
2. Freeze deterministic Swing v1 and Scalper v1 execution contracts.
3. Reach the registered corpus gate.
4. Freeze the first microstructure hypothesis before outcome alignment.
5. Evaluate State Engine baseline vs State Engine + microstructure.
6. Use episode/time-block walk-forward evaluation.
7. Apply realistic costs/slippage.
8. Run source ablations and regime stability checks.
9. Only then promote a candidate to forward/paper execution.
10. Historical Holdout is opened only at the registered final gate.

# Main conclusion

The project is not primarily blocked by coding capability or lack of indicators.

The main blocker is **proving a stable timing/execution edge without overfitting**.

Infrastructure is now good enough to support that proof; the next gains must come from research discipline and higher-quality forward evidence, not from adding more models at random.

# 2026-10-04 execution update

## B-010 — Current price-only candidates failed promotion
**Status:** OPEN — critical.

Two frozen development screens were completed:
- Doctrine Reference v0.1: FAIL.
- Sweep / Acceptance v0.1: overall FAIL.

Acceptance+Retest showed the best remaining signal (+0.0210R at C1, positive across both directions and early/late blocks) but failed C2 and has a strongly negative median.

**Implication:** no price-only candidate is currently eligible for Final Holdout, forward strategy execution, or production.

## B-011 — Quiver paid data unavailable
**Status:** OPEN — external dependency.

The Quiver MCP connection authenticates and free dataset discovery works, but paid dataset calls report that the account has no active subscription.

**Close when:** the connected account has the subscription required for the preregistered Quiver layer, or the Quiver layer is formally removed from the candidate contract before testing.

## B-012 — Microstructure gate updated
**Status:** OPEN by protocol.

Latest recorded checkpoint:
- 237 valid snapshots,
- ~0.556 elapsed days,
- 9,763 snapshots still required,
- ~29.444 elapsed days still required,
- integrity PASS,
- Fusion Grade ratio ~95.36%.

No outcome analysis is permitted until both registered gates pass.

## B-013 — Canonical forward-store ambiguity resolved
**Status:** CLOSED.

The scheduled Pristine Forward pipeline uses repo `.lab-data`, not the legacy historical store.
`.lab-data` is JForex/IHistory, export/cache verified, and currently audits PASS.
Legacy public-datafeed forward records in `gtg-lab-data-jforex` remain preserved but excluded from forward validation.

## B-014 — JForex forward freshness gap
**Status:** CLOSED — 2026-10-04.

The user started `GtgForwardExport.jfx` from JForex Strategies.

Verified recovery:
- authenticated JForex/IHistory export for 2026-10-03 exists,
- BID rows = 1,440,
- ASK rows = 1,440,
- BID export/cache SHA256 parity PASS,
- ASK export/cache SHA256 parity PASS,
- canonical seal now includes 2026-10-03,
- `FORWARD_SEAL_STATUS_LATEST.json` = PASS,
- `FORWARD_SEAL_AUDIT_LATEST.json` = PASS,
- canonical forward days = 4 (2026-09-30 through 2026-10-03),
- Forward Gate now reports `canonical_forward_fresh=true`.

A lifecycle bug was also fixed: already-sealed days with an append-only parity verification record no longer become invalid merely because JForex later evicts their local cache files. A new day still requires first-time export/cache parity before sealing.

The separate Priority 8 cold-start autonomy blocker remains open; B-014 only covers the concrete 2026-10-03 freshness gap.

## B-015 — Scheduled collector scripts hidden by sparse-checkout
**Status:** CLOSED — 2026-10-04.

Symptom:
- `GTG Microstructure Forward Capture` continued triggering but returned `0xFFFD0000`,
- readiness remained stuck at 235 snapshots,
- the task action pointed to `scripts/capture_microstructure_forward.ps1`, which was tracked by Git but absent from the sparse working tree.

Recovery:
- restored `capture_microstructure_forward.ps1` and `seal_pristine_forward.ps1` from HEAD,
- added `scripts` to the repository sparse-checkout set,
- manually reran the microstructure task and received LastResult `0`,
- snapshot count advanced from 235 to 237,
- manually reran `GTG Pristine Forward Seal Audit` and received LastResult `0`.

The collector and seal scripts are now materialized persistently in this working tree.