# GTGLab2 — External Tool Registry

Registered: 2026-10-04

This registry defines the role of external platforms before the Ultra Plan is frozen.

## T-001 — Quiver Quantitative

**Role:** Alternative/Macro Intelligence Layer

**Use cases**
- alternative-data context,
- institutional activity,
- insider activity,
- government/political exposures,
- Quiver newsfeed,
- dark-pool / off-exchange signals where relevant,
- macro/risk-regime enrichment,
- cross-asset context around gold-related equities and broader risk sentiment.

**Integration paths**
- Quiver API,
- Quiver MCP server,
- web dashboards for manual validation.

**GTGLab2 constraints**
- Quiver is NOT the canonical XAU/USD price source.
- Quiver is NOT treated as direct OTC gold order flow.
- Quiver signals must be time-stamped and evaluated for incremental value.
- Alternative-data features must not be allowed to leak delayed filings into earlier timestamps.
- Any feature used in trading research must preserve publication/disclosure time, not event time alone.

**Status**
- Approved for GTGLab2 architecture.
- MCP authentication: VERIFIED on 2026-10-04.
- Free dataset discovery: VERIFIED.
- Paid dataset access: BLOCKED because the connected Quiver account has no active subscription.
- No Quiver signal has been used in an outcome-aligned experiment.

---

## T-002 — Liquid (liquid.trade)

**Role:** Execution / Market Access / Venue Observation Layer

**Use cases**
- observe a separate Gold perpetual market,
- compare quoted behavior against canonical XAU/USD,
- later-stage paper/manual execution experiments,
- execution UX benchmarking,
- venue-specific funding/liquidation/market behavior if exposed,
- TradingView-assisted execution workflows,
- AI-assisted trading interface evaluation.

**Current platform properties relevant to GTGLab2**
- supports long and short exposure,
- supports Gold and other commodity perpetual markets,
- supports leveraged trading,
- exposes market/news/trading interface,
- advertises ChatGPT/Claude integration through Co-Invest,
- advertises a TradingView extension for trade execution.

**GTGLab2 constraints**
- Liquid Gold is NOT canonical XAU/USD.
- Liquid venue prices must be treated as a separate proxy/venue.
- Do not merge Liquid volume/order-flow with OTC or other venues without provenance.
- Do not use live leveraged execution for research validation before paper/forward gates are passed.
- Any future execution integration requires explicit confirmation and risk controls.

**Status**
- Approved for GTGLab2 architecture.
- Co-Invest MCP connection: VERIFIED on 2026-10-04.
- GOLD market/positioning read: VERIFIED.
- Paper Mode: ENABLED for the connected MCP wallet.
- No GTGLab2 live order has been placed.
- Strategy execution remains blocked until an economic candidate passes its registered gates.

---

## Tool hierarchy

### Canonical market truth
1. JForex/IHistory XAU/USD BID/ASK for canonical price outcome.

### Microstructure / venue evidence
2. PanWatch source families.
3. Liquid Gold venue, only if a reliable machine-readable interface becomes available.

### Alternative / macro intelligence
4. Quiver Quantitative.
5. Other future macro/news/positioning sources only after registration.

### Execution
6. GTGLab2 deterministic paper executor first.
7. Liquid or another supported venue only after the research candidate passes forward validation.

## Principle

External tools may enrich GTGLab2, but they do not replace the State → Transition → Strategy architecture.

Every external source must answer one of four questions:
- Context: what environment are we in?
- Structure: where is price/liquidity?
- Trigger: is the current move being accepted or rejected?
- Execution: how do we enter/exit with controlled risk?

If a tool cannot add measurable incremental value to one of these layers, it remains optional and must not add complexity to the core system.
