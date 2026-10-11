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

## v0.2.3 canonical dataset (JForex IHistory)

| Item | Value |
|---|---|
| Channel | JForex API/IHistory (Demo session) → `jforex/GtgFullExport.java` → local export (datafeed record/path layout) → `import_local.py export` → store with manifest (origin `jforex-ihistory-export`, sha256, platform/API version, export time) |
| Span | 2018-03-01 → 2026-09-30 13:39 UTC (last bar before T_freeze_v0.2.3); 3,136 UTC days, 2,672 trading days |
| Bars | 3,042,196 BID M1 after §2.2 sanitation; ASK coverage 100% (every BID bar has a live ASK) |
| Integrity | G1–G5 PASS (0 duplicate / out-of-order / inconsistent bars); D5 missing weekdays = 12 market closures (Good Friday ×8, 2020-12-25, 2021-01-01, 2021-12-24); D2 gaps 8; D4 spikes 481 (diagnostics) |
| firstValidTime | 2021-09-08T17:00Z (binding: H4, 5,441 bars) ≤ research start 2021-09-29 |
| Last-minute finalization | after a fresh fetch of 2026-09-15…28, only 2026-09-22 BID 23:59 settled; **BID 23:59 of 2026-09-23, 09-24, 09-27, 09-28 stay empty in JForex** (public has them). Not back-filled (§2.2). A final settlement re-export decides; if still empty they are missing data. 09-27/09-28 are excluded days (§20) |

## Status (execution order §31)

| Step | Status |
|---|---|
| 1 Freeze + Integrity Gate | ✅ v0.2 `e4ceb8e`, v0.2.1 `e5eefac`, v0.2.2 `08757a2` (calendar) |
| 2 Raw forward capture | ✅ Code (`data/capture_forward.py`, sealed; hashes only). ⏳ The daily run on the desktop is not scheduled yet (F-001: the container cannot reach the feed) |
| 3 Data layer | ✅ v0.2.3 canonical dataset (JForex IHistory, 2018-03-01 → T_freeze_v0.2.3): 3,136 days exported in 3 min 18 s, imported in 5 min 43 s; **Data Integrity PASS**; **firstValidTime 2021-09-08T17:00Z** (covers the research window). Public bi5 store (Path A, stopped at 2025-08-31) kept as audit corpus |
| 4 Measurement Engine | ✅ JS + Pine copy + Pine float semantics (F-007); 41 Node tests |
| 5 **Parity Gate** | ✅ **PASS, full MTF** 2026-09-29 on OANDA:XAUUSD: M1, M5, M15, H1, H4 replay with 0 mismatches (EMA seed `sma`), route HTF + anchors computed by JS from the feed's own HTF bars (feed mode, F-009); copy = frozen on every cell. Evidence: `parity/captures/` (PG8, PG9). Production integrity re-checked afterwards: PASS |
| 6 Event Engine | ✅ code + definition tests (EV1–EV7); Causality Gate PASS on synthetic data; **Real Causality Gate PASS** on the v0.2.3 dataset: 8 windows of 18 months stepping 12 (RAM), CG1/CG2/CG3 + non-vacuity PASS in every window (`events/causality_windows.mjs`) |
| 7–8 CEM / statistics / power | ✅ code + tests (ST1–ST7); power gate at full contract scale ≈ 8 min |
| 9–10 | Not started: data integrity on the real dataset, Power Gate on Train, then Validation. No edge computed |
