# GTG Strategy Lab

A separate research project: does GTG Navigator v0.4.7 carry a real, repeatable edge on XAUUSD?
- The protocol is frozen in `TRADE_CONTRACT.md` (v0.2.2 FROZEN, T_freeze_v0.2.2 = 2026-09-29T20:47:26Z; see `FREEZE_RECORD.md`). Prices = Dukascopy; timeframe calendar = OANDA:XAUUSD on TradingView (§2.2).
- The production indicator is not modified (`BASELINE_LOCK.md`).

| Folder / file | Contents |
|---|---|
| `baseline/` | Frozen copy of the production release (blob `0c7cbe3`) — do not modify |
| `gtg-engine/` | **Full copy of the indicator** (`indicators/gtg-navigator` at `0a77819`: Pine, reference, validation, artifacts). The lab reads only from it and never touches the indicator in use. Byte-identical, checked by `gtg-engine.manifest` + test GC1–GC3 |
| `data/` | Dukascopy data layer (Python stdlib): bi5 decoding, M1 BID/ASK, sanitation, UTC aggregation, sha256 manifest, raw forward capture |
| `engine/` | GTG Measurement Engine (JS): an exact copy of the Zone Engine + `[MEASURE]` records, sensors 3–7, consumer layer 13/17, runner; `pine-cmp.mjs` + generated `pinecmp/` variants with Pine float comparisons (F-007), which the runner uses; and the Pine "GTG Engine" copy (export only) |
| `events/` | Event Engine: M5 panel (HTF at t−1), TC/H5, CE E1–E4, H3, FLIP-1/2, H4 comparator, P1/P1-rejected/P2, outcomes (C0/C1/C2), CEM covariates; Causality Gate tests (CG1–CG3) |
| `stats/` | CEM/ATT/support, day-block bootstrap, Holm + decision rule, block length, DE, δ_econ, power gate |
| `parity/` | Parity Gate tools, TradingView capture steps (`PARITY_RUNBOOK.md`) and the committed captures replayed by CI (`captures/`, PG8) |
| `FAILURE_LOG.md` | Anti-Loop log (§30) |

```bash
node --test indicators/gtg-strategy-lab/engine/*.test.mjs indicators/gtg-strategy-lab/parity/*.test.mjs
(cd indicators/gtg-strategy-lab/data && python3 -m unittest -v test_data test_tick_audit)
node indicators/gtg-strategy-lab/engine/pinecmp/build.mjs   # after editing a source listed in build.mjs (PCMP3 checks)
```

## Research window (GPT message 32)

- Research window: **2021-09-29 → 2026-09-29** (T_freeze). Train/Validation/Holdout are cut inside it.
- Pre-history is loaded only for warm-up and never enters a result. The binding need is H4: 5,441 closed H4 bars before 2021-09-29 reach back to **2018-04-09** on the contract calendar (M5 2021-09-21, M15 2021-08-29, H1 2021-03-30, D 2020-12-23). Days without bars (holiday closures ≈ 2 weeks over 3.5 years) push it earlier, so acquisition starts at **2018-03-01**; the real first valid bar is checked on the data (`firstValidTime`) before any split.
- If the Power Gate shows a hypothesis cannot be evaluated inside the window, work stops for discussion; the window is never extended automatically.

## Status (execution order §31)

| Step | Status |
|---|---|
| 1 Freeze + Integrity Gate | ✅ v0.2 `e4ceb8e`, v0.2.1 `e5eefac`, v0.2.2 `08757a2` (calendar) |
| 2 Raw forward capture | ✅ Code (`data/capture_forward.py`, sealed; hashes only). ⏳ The daily run on the desktop is not scheduled yet (F-001: the container cannot reach the feed) |
| 3 Data layer | ✅ Code + Python tests (fetch/throttling, quiet acquisition, history, forward, Tick Audit, Path B tools). Source: public Dukascopy bi5 (canonical; JForex rejected as primary, F-012). ⏳ Acquisition on the desktop, newest first, down to 2018-03-01 (research window + warm-up, below) |
| 4 Measurement Engine | ✅ JS + Pine copy + Pine float semantics (F-007); 41 Node tests |
| 5 **Parity Gate** | ✅ **PASS, full MTF** 2026-09-29 on OANDA:XAUUSD: M1, M5, M15, H1, H4 replay with 0 mismatches (EMA seed `sma`), route HTF + anchors computed by JS from the feed's own HTF bars (feed mode, F-009); copy = frozen on every cell. Evidence: `parity/captures/` (PG8, PG9). Production integrity re-checked afterwards: PASS |
| 6 Event Engine | ✅ code + definition tests (EV1–EV7) + **Causality Gate PASS** on synthetic data (future truncation, future perturbation, negative control). To re-run on real data before any analysis |
| 7–8 CEM / statistics / power | ✅ code + tests (ST1–ST7); power gate at full contract scale ≈ 8 min |
| 9–10 | Not started: data integrity on the real dataset, Power Gate on Train, then Validation. No edge computed |
