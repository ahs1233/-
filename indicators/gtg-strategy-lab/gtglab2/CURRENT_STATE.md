# GTGLab2 — Current State

Baseline captured at project naming on 2026-10-04.

## Git

- Branch: `research/gtglab2`
- Baseline inherited HEAD at creation: `c13a3c2`
- Prior forward-audit hardening commits include:
  - `9fb2ce4` — rename pristine forward runner as seal audit
  - `e91056d` — complete forward collection audit hardening
  - `04a11ac` — close forward collection integrity gaps

## Microstructure Forward

At naming checkpoint:
- captures: **128**
- Fusion Grade: **122**
- Single-source Grade: **6**
- Bitfinex available: 128
- Binance available: 124
- Kraken available: 124
- ready executed-trade family counts:
  - Bitfinex: 48
  - Binance: 124
  - Kraken: 124
- integrity/quality audit: **PASS**

Collection task:
- `GTG Microstructure Forward Capture`
- enabled
- one-minute schedule
- append-only raw snapshots
- SHA256 integrity
- overlap protection
- stale-lock recovery
- bounded direct PanWatch timeout

## Pristine Forward Price

Canonical source:
- Dukascopy XAU/USD
- authenticated JForex API / IHistory
- M1 BID + ASK retained separately

Sealed coverage at baseline:
- 2026-09-30
- 2026-10-01
- 2026-10-02

Audit:
- status: **PASS**
- issues: 0
- decoded market data: false

Daily verification task:
- `GTG Pristine Forward Seal Audit`
- enabled

Important limitation:
- seal/audit is automated.
- standalone JForex exporter is not claimed as fully autonomous because SDK credentials are not configured as environment variables.

## Research readiness

The registered gate remains:
- >= 30 elapsed calendar days
- >= 10,000 valid append-only snapshots

Both are required.

This is a collection-readiness gate, not a claim that 10,000 minute rows are 10,000 independent statistical samples.

## Current research status

- State Engine: established baseline.
- Transition problem: identified as central timing problem.
- Price-only sequence approaches: insufficient edge so far.
- Chronos-2 zero-shot gate: failed incremental edge test.
- Microstructure: collection stage only.
- Microstructure-to-future-price edge analysis: **LOCKED**.
- Historical Holdout: **LOCKED**.
- Pristine OOS decoding: **LOCKED**.


## Ultra Plan execution

Active plan:
- `ULTRA_PLAN_V01.md`

Phase 1 foundation implemented on GitHub:
- bidirectional LONG/SHORT contracts,
- timeframe role contract: D1/H4/H1/M15/M5/M1,
- inherited session bucket compatibility,
- raw EMA geometry for 9/21/50/200/1000,
- synthetic symmetry and prefix-invariance/no-future-leakage tests.

Independent verification:
- 9/9 foundation tests PASS in a separate Python environment.

Device-local verification:
- PENDING because Remote Desktop Commander is currently reporting the device online but timing out on commands.
- This is an operational verification gap only; it does not unlock any research data.

Research locks remain unchanged:
- Historical Holdout LOCKED.
- Pristine OOS LOCKED.
- Microstructure outcome linkage LOCKED.
