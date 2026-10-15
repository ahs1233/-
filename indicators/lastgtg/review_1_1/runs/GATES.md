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

## Gate 2 — see `../README.md` (13/13, 147,456 cases).

## Gate 4 — Pine = JS on the same TradingView bars (2026-10-15)

**Method.** Export-only copies `../diag/lastgtg_{A,B,C}_diag.pine` (`../diag/manifest.json`, diffs
`../diag/<v>_to_diag.diff`, `../diag/diag.test.mjs`): the frozen file with its title renamed,
`calc_bars_count = 3000` in the declaration (a run setting, see run 1 below) and one block of
Data Window plots appended (bars, sensors, route-HTF values, the four slots, nearest-zone role and
distance, engine events + engineOn; for A a global copy of its lamp chain, because A computes the
lamp only inside `barstate.islast`). Nothing in the frozen code is touched. TradingView Desktop
over CDP, OANDA:XAUUSD, runbook E-24/E-28: layout backed up (sha256 `98bcaf76…`, unchanged all
day), autosave off, one copy per page load (`../tv/gate4_run.mjs`), page reloaded without saving,
layout restored at the end. Comparison `../js/gate4.mjs`: the JS port is fed the study's own bars
(every row it computed), the HTF / anchor bars of the same page load, the request.security
history starts recovered from the export (`securityStart`, unique solution required) and the
engine start = Pine's first engineOn row; every row is compared layer by layer (sensors →
engine events → slots / nearest zone → lamp, reason, heading, route, accepted, episode start),
prices within 1 mintick, scores within 1e-6, everything else exactly.

**Capture problems found and how each was settled (no rule, weight or tolerance changed):**
1. *Plot budget.* TradingView counts plots and alertconditions together (limit 64). The first B
   copy had 71 and was rejected (RE10140). The four slot codes now share one plot and engineOn is
   bit 128 of `m_events`; B and C are at 64, A at 53 (`diag.test.mjs` checks it).
2. *Study rows cut by the chart* (run 1, `gate4/capture_20261015_run1`). The chart keeps only the
   last ~3,032 study rows. On the first exported row Pine already had warm sensors (e.g. `atrEng`
   10.82 against 5.43 from one bar) and, on H1, live zones, so no replay could start where Pine
   started. The copies now declare `calc_bars_count = 3000`, so Pine computes on exactly the
   exported bars. With it, every chart-timeframe sensor matched on every row of all nine cells.
3. *Security history starts.* With `calc_bars_count`, Pine's HTF values are na until its own
   HTF history starts (M15: the first H1 bar opening after the first chart bar; H4: the first
   daily bar; H1: TradingView started the H4 history a week later, 2026-04-23 13:00). Each start is
   the unique HTF bar that reproduces `m_htfClose` and `m_htfMA200` on every row, na pattern
   included.
4. *Two versions of one bar* (run 2, `gate4/capture_20261015_run2`). TradingView served the H4
   bar of 2026-10-01 05:00 as O 4179.955 H 4193.090 V 138,276 in some page loads (it matches the
   M15 bars inside it) and as O 4188.035 H 4192.440 V 120,235 in others. Pine M15 A and B were
   computed on the first, the shared final dump held the second, so one A2 anchor zone edge
   differed (4193.090 against 4192.440) and A/B diverged on 2026-10-01 22:30 while C, computed on
   the second, matched exactly. Traced level by level (the JS A and C engines are identical there;
   the zone's anchor member differs). Each study is now replayed on the HTF / anchor bars dumped in
   its own page load (run 3).
