# GTGLab2 — Decision Register

## D-001 — Canonical project name
**Date:** 2026-10-04
**Decision:** This research track is named **GTGLab2**.
**Status:** Active.

## D-002 — Core architecture
**Decision:** Use `State → Transition → Strategy`, not direct next-price prediction.
**Status:** Active.

## D-003 — Two execution tracks
**Decision:** Keep distinct Swing and Scalper execution logic.
**Status:** Active.

## D-004 — Forward microstructure before edge claims
**Decision:** Collect real forward microstructure before testing incremental trading value.
**Reason:** Avoid historical feature mining and outcome leakage.
**Status:** Active.

## D-005 — Readiness gate
**Decision:** First microstructure edge-analysis phase requires both:
- 30 elapsed calendar days,
- 10,000 valid snapshots.
**Status:** Active.

## D-006 — Canonical forward price
**Decision:** JForex/IHistory is canonical for Pristine Forward XAU/USD M1 BID/ASK. Public datafeed is not canonical.
**Status:** Active.

## D-007 — Fusion evidence
**Decision:** Fusion Grade requires at least two distinct source families with fresh executed-trade evidence. Reachability alone is insufficient.
**Status:** Active.

## D-008 — Permanent evidence trail
**Date:** 2026-10-04
**Decision:** Every meaningful GTGLab2 action must be recorded in the canonical guide and append-only event ledger.
**Status:** Active.

## D-009 — Bidirectional execution is mandatory
**Decision:** All executable logic must support symmetric Long and Short paths.
**Status:** Active.

## D-010 — Break is not Acceptance
**Decision:** A boundary cross alone cannot authorize trend continuation. Rejection and acceptance are separate observable states.
**Status:** Active.

## D-011 — Staging is risk architecture, not proof of edge
**Decision:** Five-tranche construction may only add when the hypothesis remains valid; no addition after invalidation and no Martingale.
**Status:** Active.

## D-012 — Acceptance/Retest is the surviving price-only research direction
**Decision:** Preserve Acceptance → Retest → Continuation as a future hypothesis, but do not claim confirmation from the current development history.
**Reason:** C1 was slightly positive across both directions/time blocks, but C2 and median robustness failed.
**Status:** Research-only; not promoted.

## D-013 — No Final Holdout opening on current evidence
**Decision:** Keep the Historical Holdout sealed.
**Reason:** Neither integrated candidate passed the registered robustness requirements.
**Status:** Active.

## D-014 — Liquid remains Paper-only for GTGLab2
**Decision:** The connected Co-Invest wallet is kept in Paper Mode for project workflows until a future release gate explicitly permits otherwise.
**Status:** Active.

## D-015 — Quiver paid data is currently unavailable
**Decision:** Treat Quiver as connected-but-blocked until an active subscription exists; do not fabricate substitute Quiver data.
**Status:** Active.

## D-016 — First forward microstructure hypothesis is frozen before outcomes
**Decision:** The first eligible forward incremental test will use the frozen Acceptance -> Retest baseline and an outcome-free directional microstructure vote gate.
**Status:** Active but locked until the 30-day AND 10,000-snapshot readiness gate passes.


## D-017 — No further threshold tuning on the same development history
**Decision:** Do not retune Sweep/Acceptance v0.1 thresholds or cost assumptions on the same historical development interval after observing its results.
**Reason:** Further adaptive search would convert the surviving Acceptance/Retest lead into historical overfitting.
**Status:** Active.

## D-018 — Canonical Pristine Forward store is repo .lab-data
**Decision:** The canonical forward validation store is `.lab-data`, containing only JForex/IHistory exports that pass export↔cache byte parity. Legacy forward records in `C:\Users\alk\gtg-lab-data-jforex` are evidence only and excluded from forward validation.
**Status:** Active.

## D-019 — Forward price collection fails closed
**Decision:** If an expected JForex/IHistory export is missing, GTGLab2 records a blocker and does not substitute public datafeed bytes.
**Status:** Active.

## D-2026-10-04 � Two-stage execution order
- Stage 1: run and validate GTGLab2 on historical XAUUSD data from 2018 through 2026 first.
- Stage 2: only after Stage 1 is completed and its strategy contract is frozen, run that frozen strategy on live/forward data.
- Forward collectors continue operating during Stage 1 only to preserve blind future data; no outcome-linked live evaluation or trading is permitted before Stage 1 closes.
- Historical Final Holdout remains sealed until its registered final gate; Stage 1 uses only permitted historical development/validation partitions.


## D-020 � Stage 1 dual-track architecture
**Decision:** Stage 1 has two parallel tracks: (A) immutable Clean Historical Track for reproducible Train/Validation/Holdout evaluation, and (B) Development Track on the existing working data/code path. Validation outcomes may inform development, but a modified candidate cannot reuse the same Validation as fresh confirmation. Historical Holdout remains sealed until the final candidate gate.
**Status:** Active.

