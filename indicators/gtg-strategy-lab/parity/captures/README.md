# TradingView parity captures

Each dated folder holds the data-window exports of one Parity Gate run on TradingView Desktop
(see `../PARITY_RUNBOOK.md`), gzip-compressed, the replay reports and `SHA256SUMS` of the raw CSV.
`../captures.test.mjs` (PG8) replays them on every CI run.

## 2026-09-29 — OANDA:XAUUSD (syminfo.mintick 0.001), same chart, both studies recalculated together

| Cell | Rows | studyExtraBars | Copy | Replay (seed sma) | Copy vs frozen |
|---|---|---|---|---|---|
| M1 | 9,306 (993 of them computed before the chart's first loaded bar, F-006) | 2003 | unsaved temporary study, Pine blob `7cba55e` | **PASS**, 0 mismatches | **PASS**, 0 / 15,944 |
| M5 | 5,976 | 2001 | unsaved temporary study, Pine blob `27f9f0e` | **PASS**, 0 mismatches | **PASS**, 0 / 14,404 |

- Frozen study: `v5XkYX`, production script v26.0 = frozen blob `0c7cbe3`.
- `27f9f0e` and `7cba55e` differ only by export plots (`m_open/m_high/m_low/m_close`, F-006; PC1 checks
  that neither changes any computation). M5 has no pre-history rows, so the chart OHLC it was replayed on is
  complete.
- EMA seed: `first` fails on both cells, `sma` passes on both (decided by parity, `engine/pine-ta.mjs`).
- Before F-007 (Pine float comparison tolerance) the M1 replay had exactly one mismatch
  (`v_eventBits`, 2026-09-25T07:28Z); the reports here are after the fix.

## 2026-09-29-mtf — MTF parity (message 18): M15, H1, H4 cells + the feed's own HTF bars

Feed mode: JS computes every route-HTF value (`m_htf*`) and both anchors from TradingView's own
bars of those timeframes (`bars_<resolution>.json`: 5, 15, 60, 240, 1D, 1W; `t` = bar open), so
the HTF layer is compared, not injected. PG9 replays all five cells.

| Cell | Rows | Route HTF / A1 / A2 | HTF history start | Replay (seed sma) | m_htf* compared | Copy vs frozen |
|---|---|---|---|---|---|---|
| M1 | 9,306 | M15 / M5 / M15 | unique: 2026-08-31T22:00Z (F-009) | **PASS** 0 | 9,306 each | 0 / 15,944 |
| M5 | 5,976 | H1 / M15 / H1 | full history | **PASS** 0 | 5,976 each | 0 / 14,404 |
| M15 | 5,935 | H1 / H1 / H4 | full history | **PASS** 0 | 5,935 each | 0 / 16,472 |
| H1 | 10,311 | H4 / H4 / D | unique: 2025-01-01T22:00Z | **PASS** 0 | 9,549–10,308 | 0 / 20,572 |
| H4 | 5,792 | D / D / W | full history | **PASS** 0 | 5,792 each | 0 / 23,164 |

- M15/H1/H4 copies: Pine blob `7cba55e` (same as M1). Studies recalculated together (`studyExtraBars` 2005/2006/2007).
- TradingView's H4 and D bars for OANDA:XAUUSD open on the New York 17:00 session (21:00/22:00 UTC), not on UTC
  boundaries; parity uses the feed's own bars, so this does not affect the result (see the note to GPT, message 19).
