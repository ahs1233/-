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
