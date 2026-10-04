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
