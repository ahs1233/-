# GTGLab2 — Liquid Forward Context Capture v1.0

Status: CAPTURE ENABLED / OUTCOME LINKAGE LOCKED
Registered: 2026-10-04

## Role
Liquid / Co-Invest is a separate venue/positioning context source.
It is not canonical XAU/USD and is not part of the primary microstructure test.

## Capture
Allowed:
- read-only GOLD market analysis,
- raw returned payload,
- source-created timestamp,
- ticker/positioning metadata,
- Paper-mode verification metadata,
- SHA256 / byte count / append-only manifest.

Forbidden:
- orders,
- live execution,
- historical backfill to known outcomes,
- aligning Liquid context to protected price outcomes before a separate registered gate.

## Provenance
Every stored snapshot must preserve:
- source = Liquid / Co-Invest MCP,
- canonical market symbol returned by Liquid,
- source_created_at,
- raw payload,
- SHA256,
- byte count,
- paper-mode verification state,
- research lock flags.

## Initial frozen fields
The archive preserves, without fitting thresholds:
- mark price,
- funding,
- open interest,
- 24h notional volume,
- Liquid-defined size-segment position counts,
- Liquid-defined size-segment notional,
- long notional and bias,
- value close to liquidation,
- raw smart-money/crowd summary.

No numeric threshold is selected here.

## Relationship to first forward test
The first registered forward test remains:
Acceptance/Retest baseline vs PanWatch microstructure sign-vote treatment.

Liquid is NOT added to that primary comparison.
A later Liquid hypothesis requires:
- its own readiness definition,
- its own preregistered treatment,
- no retrospective threshold search.

## Safety
Paper trading must remain enabled for connector-based account operations.
This capture process never calls an order tool.
