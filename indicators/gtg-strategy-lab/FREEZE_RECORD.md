# GTG Strategy Lab — FREEZE_RECORD

## Current freeze — v0.2.3

| Field | Value |
|---|---|
| Contract | `TRADE_CONTRACT.md` — v0.2.3 FROZEN (Data Source Amendment, GPT decision on Claude message 51) |
| Freeze commit SHA | `c47b71997d0b4e87d48f653184bbcff641db1259` |
| **T_freeze_v0.2.3 (UTC)** | **2026-09-30T13:40:49Z** (committer timestamp) |
| Contract blob | `b1899f94faa67daa3c5807940d62b4a81c6770cc` |
| Production HEAD / Pine blob | `0a77819…` / `0c7cbe3…` (unchanged) |
| Canonical prices | Dukascopy JForex / IHistory M1 BID + ASK, 2018-03-01 → T_freeze_v0.2.3 (public datafeed bi5 = audit only) |

Pristine OOS = data with timestamp **> 2026-09-30T13:40:49Z** only (§22). The records below are kept for history.

Integrity Gate v0.2.3 — PASS:
- production unchanged (`git diff 0a77819 HEAD -- indicators/gtg-navigator` empty); Pine blob `0c7cbe3`;
- the freeze commit holds only the contract;
- the diff v0.2.2 → v0.2.3 touches only the header, §2.1 (source sentence), §2.2 (primary source, one-source window, no hybrid, audit role of the public bi5, finalization rule, documented 2013/2015 divergence), the tick sentence of §2.2, §22 (T_freeze reference), §31 step 3 wording and the change log; events, H1–H5, E1–E4, thresholds, CEM, horizons, δ_econ, split, costs and decision rules are byte-identical;
- no GTG event outcome, edge statistic or Historical Holdout value was computed before the freeze (the engineering smoke test and the source-parity tools report PASS/FAIL or agreement ratios only).

## Previous freeze — v0.2.2

| Field | Value |
|---|---|
| Contract | `TRADE_CONTRACT.md` — v0.2.2 FROZEN (calendar / feed-semantics amendment, messages 19–20) |
| Freeze commit SHA | `08757a278aa8c6fe788bce9ad81f222e01168e8c` |
| **T_freeze_v0.2.2 (UTC)** | **2026-09-29T20:47:26Z** (committer timestamp) |
| Contract blob | `ed67f4f7e4416993aedb6a3f3f5899f49727981e` |
| Production HEAD / Pine blob | `0a77819…` / `0c7cbe3…` (unchanged) |
| Calendar source | OANDA:XAUUSD symbolInfo on TradingView, sha256 `da510d1ee12c6c15e5578021feb9e3fffaf2487948819a4eff66fa7fe9e80a0f` |

Pristine OOS = data with timestamp **> 2026-09-29T20:47:26Z** only (§22). The v0.2.1 and v0.2 records below are kept for history.

Integrity Gate v0.2.2 — PASS:
- production unchanged (`git diff 0a77819 HEAD -- indicators/gtg-navigator` empty); Pine blob `0c7cbe3`;
- the freeze commit holds only the contract;
- the diff v0.2.1 → v0.2.2 touches only §2.1 (description sentence), §2.2 (calendar), §14 P2 (PDH/PDL day), §18 (block-length day), §22 (T_freeze reference), the header and the change log; hypotheses, events, thresholds, CEM, horizons, δ_econ, costs and decision rules are byte-identical;
- no GTG event outcome, edge statistic or Historical Holdout value was computed before the freeze (none exists in the repository);
- calendar implementation (`data/tv_calendar.py`, commit `c213fb5`, before the freeze) passes `data/test_calendar.py` against TradingView's own bars.

## Previous freeze — v0.2.1

| Field | Value |
|---|---|
| Contract | `TRADE_CONTRACT.md` — v0.2.1 FROZEN (data-acquisition amendment, messages 13–14) |
| Freeze commit SHA | `e5eefacfdf54625ac3b968b5e24460822d3f8758` |
| **T_freeze_v0.2.1 (UTC)** | **2026-09-29T14:58:45Z** |
| Contract blob | `7f1e09b9aa72ee49603230efffbab541179946f0` |
| Production HEAD / Pine blob | `0a77819…` / `0c7cbe3…` (unchanged) |

Pristine OOS = data with timestamp **> 2026-09-29T14:58:45Z** only (§22). The v0.2 record below is kept for history.

Integrity Gate v0.2.1 — PASS: production unchanged (`git diff 0a77819 HEAD -- indicators/gtg-navigator` empty); Pine blob `0c7cbe3`; the freeze commit holds only the contract and the failure log; BID/ASK convention stated (§2.1, §8); H5 without H4 regime; D in all matching; H3/H4 without episode age, with level/zone age; no "OOS" wording on pre-freeze history.

## Previous freeze — v0.2

| Field | Value |
|---|---|
| Contract | `indicators/gtg-strategy-lab/TRADE_CONTRACT.md` — v0.2 FROZEN |
| Freeze commit SHA | `e4ceb8e1adbd49885c49ab032f676a1f71c2f418` |
| **T_freeze (UTC)** | **2026-09-29T13:31:51Z** (committer timestamp of the freeze commit) |
| Branch | `claude/gtg-strategy-lab-edge-f0h5ra` (built on `lab/gtg-strategy-lab-v0.1` @ `cef3160`) |
| Contract blob | `735312ca2321adeeba23f69dfcb42b8c26910fd4` |
| Production HEAD | `0a77819d7a4bf29fe64a07b2233109707a10ca8b` |
| Production Pine blob | `0c7cbe366668fba20c9bc128448f908ce9314041` (the source and the frozen copy are identical) |
| Baseline tests | 116/116 PASS (re-run before the freeze) |

Any XAUUSD data with timestamp **> 2026-09-29T13:31:51Z** is the only data that may enter Pristine OOS (§22), provided the contract is not modified.

## Integrity Gate (after the freeze) — PASS

| Check | Result |
|---|---|
| Production Navigator unchanged (`git diff 0a77819 HEAD -- indicators/gtg-navigator` is empty) | PASS |
| Pine blob identical (source + frozen copy = `0c7cbe3…`) | PASS |
| No measurement code in the freeze commit (3 files: contract, log, baseline lock) | PASS |
| The contract states the BID/ASK convention explicitly (§2.1, §8) | PASS |
| H5 does not match on H4 regime (§11.5) | PASS |
| D present in matching for H1–H5 (§11, §12.1) | PASS |
| H3/H4 do not use episode age (§11.3, §11.4) | PASS |
| H3/H4 keep level/zone age as a pre-event covariate | PASS |
| No "OOS" wording on history before T_freeze (the name is Historical Holdout) | PASS |
