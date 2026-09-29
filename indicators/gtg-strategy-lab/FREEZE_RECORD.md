# GTG Strategy Lab — FREEZE_RECORD

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
