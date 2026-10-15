# Gates of TEST_PREREGISTRATION.md v1.1 — record

No Part 1 or Part 2 number has been computed. Only bars, times and indicator states were read.

## Gate 1 — Pine compiles and runs (PASS, 2026-10-15)

- **Compiler** (`../tv/pine_check.mjs`, TradingView's own translator, as Guest; nothing saved):
  B, C, `handoff/lastgtg_logic_tests.pine` and A each compiled with 0 errors, 0 warnings. The
  files sent were the git blobs of `88841b7` (sha256 after CRLF → LF: B `42659f7a…`, C `8c05c958…`,
  test `968f701c…`, A `320e33eb…`, equal to the repo).
- **Runtime** on TradingView Desktop over CDP (127.0.0.1:9222 only), OANDA:XAUUSD, runbook
  procedure (`gtg-strategy-lab/gtg-engine/validation/TRADINGVIEW_EXECUTION_RUNBOOK.md`, E-23/E-24/E-28):
  - layout `r1MCAX09` backed up (`Documents\tv_layout_r1MCAX09_backup_20261015.json`, sha256
    `98bcaf76…`), autosave off before any change;
  - each script loaded into the unsaved Untitled editor and added to the chart; never saved;
  - logic test: table "PASS — 19 pure lamp cases";
  - B and C each on M1, M15, H1 and H4: study status loaded, no error, panel drawn
    (`gate1/runtime_B.json`, `gate1/runtime_C.json`; the open-bar tag "لحظي" shows as specified);
  - restore: the editor's untitled draft put back (the lab measure copy it held), page reloaded
    without saving, the three saved studies back on M1 with no changes, autosave on again.

## Gate 3 — engine started engineWindow back = continuous run (PASS, 2026-10-15)

`../js/gate3.mjs` at `d29e7d5` on the desktop feeds (export_history.py, 2019-06-02 → 2026-09-30),
period 2021-10-01 → 2025-01-01, sensors from W + 2000 bars back, HTF/anchor bars opening at or
before the bar. Every sampled bar checked for A, B and C on lamp, reason, heading, route,
accepted flag and episode start. Log: `gate3/progress.log`; per timeframe: `gate3/gate3_<tf>.json`.

| TF | W | sampled bars | A differing (starts) | B differing (starts) | C differing (starts) |
|---|---|---|---|---|---|
| M5 | 1600 | 195 | 0 (0/129) | 0 (0/87) | 0 (0/79) |
| M15 | 2113 | 194 | 0 (0/133) | 0 (0/92) | 0 (0/85) |
| H1 | 3137 | 197 | 0 (0/135) | 0 (0/100) | 0 (0/90) |
| H4 | 5441 | 162 | 0 (0/92) | 0 (0/56) | 0 (0/52) |

No difference, so there is no cause to explain. M1 is not checked yet (its feed starts
2024-11-01; it needs the M1 export that Part 1 needs anyway).

## Gate 2 — see `../README.md` (13/13, 147,456 cases). Gate 4 — not run yet.
