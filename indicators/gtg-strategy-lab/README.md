# GTG Strategy Lab

A separate research project: does GTG Navigator v0.4.7 carry a real, repeatable edge on XAUUSD?
- The protocol is frozen in `TRADE_CONTRACT.md` (v0.2 FROZEN, T_freeze = 2026-09-29T13:31:51Z; see `FREEZE_RECORD.md`).
- The production indicator is not modified (`BASELINE_LOCK.md`).

| Folder / file | Contents |
|---|---|
| `baseline/` | Frozen copy of the production release (blob `0c7cbe3`) — do not modify |
| `data/` | Dukascopy data layer (Python stdlib): bi5 decoding, M1 BID/ASK, sanitation, UTC aggregation, sha256 manifest, raw forward capture |
| `engine/` | GTG Measurement Engine (JS): an exact copy of the Zone Engine + `[MEASURE]` records, sensors 3–7, consumer layer 13/17, runner; and the Pine "GTG Engine" copy (export only) |
| `parity/` | Parity Gate tools + TradingView capture steps (`PARITY_RUNBOOK.md`) |
| `FAILURE_LOG.md` | Anti-Loop log (§30) |

```bash
node --test indicators/gtg-strategy-lab/engine/*.test.mjs indicators/gtg-strategy-lab/parity/*.test.mjs
(cd indicators/gtg-strategy-lab/data && python3 -m unittest -v test_data)
```

## Status (execution order §31)

| Step | Status |
|---|---|
| 1 Freeze + Integrity Gate | ✅ `e4ceb8e` |
| 2 Raw forward capture | ✅ Code + daily workflow. ⛔ Actual download blocked: `datafeed.dukascopy.com` denied by the environment's network policy (FAILURE_LOG F-001). The scheduled workflow runs only from the default branch |
| 3 Data layer | ✅ Code + 18 tests on synthetic bi5 files. ⛔ Waiting on network access |
| 4 Measurement Engine | ✅ JS + Pine copy; 31 tests (equivalence with the reference on every bar, constants re-read from the frozen Pine) |
| 5 **Parity Gate** | ⏸ **Stopped here**: needs a TradingView capture (M5 + M1) per `parity/PARITY_RUNBOOK.md` |
| 6–10 | Not started (forbidden before the Parity Gate passes) |
