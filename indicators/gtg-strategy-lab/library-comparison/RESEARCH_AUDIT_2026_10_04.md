# GTG Strategy Lab — Research/Operations Audit — 2026-10-04

## Overall verdict

The core research direction remains valid, but the initial forward-collection implementation had several operational and evidence-quality weaknesses. They were corrected before any microstructure-to-trading-outcome alignment.

Historical Holdout remained locked.
Pristine Price OOS remained undecoded.
No trading outcome was used to make these corrections.

## Findings and fixes

### A1 — Collector could overrun the one-minute schedule
Observed one run of ~76 seconds. Because Task Scheduler uses IgnoreNew, an overrun can drop the next scheduled minute.

Fix:
- direct PanWatch call now has a bounded timeout,
- forced refresh on every minute was removed,
- runtime duration is logged.

### A2 — Forced refresh was unnecessarily expensive
The direct collector always called PanWatch with force=True.

Fix:
- force is now opt-in from CLI,
- scheduled collection uses normal cached/persistent-tape behavior.

### A3 — Crash could leave a permanent collector lock
A killed process could leave the lock directory and block every future run.

Fix:
- run-level lock added,
- fresh overlap is rejected,
- stale lock is recovered after the bounded failure window,
- unit tests cover both cases.

### A4 — Fusion grading could overstate evidence
Earlier grading could count reachable sources or multiple venues without proving two distinct fresh executed-trade source families.

Fix:
A source is ready only with:
- ready status,
- executed-trade timestamp,
- age <= 900 seconds,
- trade_count > 0.

Fusion Grade now requires >=2 distinct ready source families.

### A5 — Availability was confused with ready executed-trade evidence
Bitfinex may be reachable while its executed-trade evidence is not fresh enough for the fusion-grade rule.

Fix:
The audit now reports both:
- source availability,
- ready source-family coverage.

At the audited live checkpoint:
- 121 captures,
- 115 Fusion Grade,
- 6 Single-source Grade,
- Bitfinex available 121/121 but ready evidence 41/121,
- Binance ready 117/121,
- Kraken ready 117/121.

### A6 — Forward price path briefly used an obsolete public-datafeed capture route
TRADE_CONTRACT v0.2.3 requires JForex/IHistory as canonical price source.

Fix:
- public-datafeed forward capture is not used as canonical,
- JForex/IHistory exporter is implemented and compile-verified against installed JForex API 4.8.13,
- sealed forward raw files require byte-for-byte parity with the JForex local cache.

### A7 — Forward seal could appear successful with zero exports
A sealer-only task is not a price exporter.

Fix:
- strict expected-settled-day check added,
- missing expected JForex export returns a non-zero blocked state,
- audit rejects noncanonical origin, missing cache verification, orphan files, and post-freeze derived M1.

Current sealed price coverage:
- 2026-09-30
- 2026-10-01
- 2026-10-02

All current days pass export↔cache SHA256 parity and seal audit.

### A8 — Export automation is not fully autonomous
JForex SDK standalone automation needs an authenticated session. No JFOREX/DUKASCOPY username/password environment variables are configured.

Fix:
- no autonomous exporter claim is made,
- a separate daily Windows task, GTG Pristine Forward Seal Audit, verifies that the expected export exists and fails visibly if it does not,
- exporter and seal/audit responsibilities are explicitly separated.

## Verification

Python collection/quality/seal test suite:
- 33/33 PASS

Live microstructure collector:
- Task enabled
- Last Result = 0

Pristine Forward seal:
- audit PASS
- decoded market data = false

## Research interpretation

10,000 minute snapshots are not 10,000 independent observations. Later edge analysis must use time blocks / episodes and must not treat minute rows as IID samples.

The next edge-analysis phase remains locked until the registered corpus gate is reached.
