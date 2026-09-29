# GTG Strategy Lab

A separate research project: does GTG Navigator v0.4.7 carry a real, repeatable edge on XAUUSD?
- The protocol is frozen in `TRADE_CONTRACT.md` (v0.2.1 FROZEN, T_freeze_v0.2.1 = 2026-09-29T14:58:45Z; see `FREEZE_RECORD.md`).
- The production indicator is not modified (`BASELINE_LOCK.md`).

| Folder / file | Contents |
|---|---|
| `baseline/` | Frozen copy of the production release (blob `0c7cbe3`) — do not modify |
| `gtg-engine/` | **Full copy of the indicator** (`indicators/gtg-navigator` at `0a77819`: Pine, reference, validation, artifacts). The lab reads only from it and never touches the indicator in use. Byte-identical, checked by `gtg-engine.manifest` + test GC1–GC3 |
| `data/` | Dukascopy data layer (Python stdlib): bi5 decoding, M1 BID/ASK, sanitation, UTC aggregation, sha256 manifest, raw forward capture |
| `engine/` | GTG Measurement Engine (JS): an exact copy of the Zone Engine + `[MEASURE]` records, sensors 3–7, consumer layer 13/17, runner; `pine-cmp.mjs` + generated `pinecmp/` variants with Pine float comparisons (F-007), which the runner uses; and the Pine "GTG Engine" copy (export only) |
| `parity/` | Parity Gate tools, TradingView capture steps (`PARITY_RUNBOOK.md`) and the committed captures replayed by CI (`captures/`, PG8) |
| `FAILURE_LOG.md` | Anti-Loop log (§30) |

```bash
node --test indicators/gtg-strategy-lab/engine/*.test.mjs indicators/gtg-strategy-lab/parity/*.test.mjs
(cd indicators/gtg-strategy-lab/data && python3 -m unittest -v test_data test_tick_audit)
node indicators/gtg-strategy-lab/engine/pinecmp/build.mjs   # after editing a source listed in build.mjs (PCMP3 checks)
```

## Status (execution order §31)

| Step | Status |
|---|---|
| 1 Freeze + Integrity Gate | ✅ v0.2 `e4ceb8e`, v0.2.1 `e5eefac` |
| 2 Raw forward capture | ✅ Code (`data/capture_forward.py`, sealed; hashes only). ⏳ The daily run on the desktop is not scheduled yet (F-001: the container cannot reach the feed) |
| 3 Data layer | ✅ Code + 33 Python tests (fetch/throttling, quiet acquisition, history, forward, Tick Audit). ⏳ Official M1 acquisition running on the desktop, newest first; throughput far below plan (F-008 → plan B to GPT) |
| 4 Measurement Engine | ✅ JS + Pine copy + Pine float semantics (F-007); 41 Node tests |
| 5 **Parity Gate** | ✅ **PASS, full MTF** 2026-09-29 on OANDA:XAUUSD: M1, M5, M15, H1, H4 replay with 0 mismatches (EMA seed `sma`), route HTF + anchors computed by JS from the feed's own HTF bars (feed mode, F-009); copy = frozen on every cell. Evidence: `parity/captures/` (PG8, PG9). Production integrity re-checked afterwards: PASS |
| 6–10 | Allowed from here on the official M1 data once acquired (no event study on partial data without GPT's approval) |
