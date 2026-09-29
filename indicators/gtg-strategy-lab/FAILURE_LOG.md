# GTG Strategy Lab — FAILURE_LOG

The failure log for the Anti-Loop Protocol (`TRADE_CONTRACT.md` §30).

- An entry is added for every technical failure during implementation.
- A method that fails twice for the same root cause is marked `REJECTED_METHOD`. A third attempt on the same path is forbidden unless new evidence changes the root-cause model.
- An isolated syntax error or typo is not logged as a methodological failure.
- A negative research result is not a failure and is not logged here.

## Schema

| Field | Content |
|---|---|
| `ID` | `F-<nnn>` |
| `Date (UTC)` | Time of the failure |
| `Step` | Execution step (§31) |
| `Layer` | 1 Data · 2 Event definition · 3 Measurement/export · 4 Matching · 5 Statistics · 6 Implementation · 7 Environment |
| `Symptom` | What was observed |
| `Root cause hypothesis` | Suspected cause |
| `Evidence` | Evidence for or against the cause (output, test, file) |
| `Method` | The method used |
| `Result` | What happened |
| `Status` | `OPEN` · `FIXED (regression: <test>)` · `REJECTED_METHOD` · `BLOCKED` |
| `Attempt` | Attempt number of the same method for the same cause (1 or 2) |

## Rejected methods

| Method | Reason | Failure entries |
|---|---|---|
| `tradingview-mcp-jackson` `pine.newScript()` + `pine.save()` / `smartCompile()` to add a new script | `newScript` loads a blank template into the tab of the script already open in the editor (the production script) instead of creating a new script identity; the later save wrote over production (F-004). Never dispatch Ctrl+S / Pine Save from automation; never add a script without verifying the editor's script identity | F-004 |
| Full historical tick download from the Dukascopy endpoint under the current access pattern | Server-side throttling (429, then 503 on 11/12 paced requests); ≈144k requests needed. Declared by the contract v0.2.1 §2.2 (message 14). Reopen only if the access path changes fundamentally | F-002, F-003 |

## Log

### F-001 — Access to Dukascopy denied by the environment's network policy
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T13:27Z |
| Step | 2/3 (forward capture, data layer) |
| Layer | 7 Environment |
| Symptom | `curl https://datafeed.dukascopy.com/datafeed/XAUUSD/…` → `CONNECT tunnel failed, response 403`; `www/freeserv/jetta.dukascopy.com` also have no access |
| Root cause hypothesis | The session's egress proxy denies the host (organization policy), not a data or code error |
| Evidence | `$HTTPS_PROXY/__agentproxy/status` → `connect_rejected … gateway answered 403 to CONNECT (policy denial)` for `datafeed.dukascopy.com:443` |
| Method | Direct HTTPS request through the proxy |
| Result | No data downloaded |
| Status | `BLOCKED` in the cloud container. **Different path adopted (not a retry):** on the user's instruction (2026-09-29) the data work runs on the user's desktop (DESKTOP-208FC6J, via Desktop Commander), where `datafeed.dukascopy.com` is reachable (HTTP 200) |
| Attempt | 1 |

### F-002 — HTTP 429 Too Many Requests from Dukascopy on the first real download
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T14:2xZ |
| Step | 3 (data layer, real-data smoke test on the desktop, day 2026-07-15) |
| Layer | 1 Data (source access) |
| Symptom | `build_history.py` raised `urllib.error.HTTPError: HTTP Error 429: Too Many Requests` a few hourly files into the first day |
| Root cause hypothesis | Unpaced back-to-back requests with urllib's default User-Agent trigger Dukascopy's rate limiter. `fetch` treated 429 like any other non-404 status and raised immediately |
| Evidence | The same URL fetched once from PowerShell returned 200; the failure appeared only in the rapid sequence of 24 hourly requests |
| Method | Unpaced urllib requests, default User-Agent, no 429 handling |
| Result | That method is replaced (not repeated): explicit User-Agent, a minimum interval between requests, 429 → `Retry-After` or bounded exponential backoff (≤ 6), then `RateLimited`. Regression tests: `Fetch.test_429_*`, `test_persistent_429_*`, `test_404_is_no_file_and_500_raises` |
| Status | `FIXED (regression: test_data.Fetch)` — confirmed on real data: the desktop acquisition completes days through 429/503/resets (throughput: F-008) |
| Attempt | 1 |

### F-003 — HTTP 503 from Dukascopy even when paced; the tick-history volume is infeasible at this rate
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T14:3xZ |
| Step | 3 (real-data smoke test, after the F-002 fix) |
| Layer | 1 Data (source access) — with a methodological consequence (§2.2) |
| Symptom | With pacing and a User-Agent, `fetch` raised `HTTP 503 Service Unavailable`. A diagnostic probe (PowerShell, 12 hourly files, 1.5 s apart) got 503 on 11 of 12 requests; the one success took 11.9 s |
| Root cause hypothesis | Server-side throttling of this client address (probably a penalty left over from the first burst in F-002). 503 is Dukascopy's throttling answer as well as 429. It is not a code or data-format error |
| Evidence | The probe above; the same URL returned 200 earlier in the session; no `Retry-After` header is sent |
| Method | Throttling handled for 429 only |
| Result | 503 is now handled like 429: bounded backoff, then `RateLimited`. Regression: `Fetch.test_503_is_throttling_like_429`. **Not retried in bulk:** the throttle is still active. The full tick history (≈ 24 files × ~6,000 trading days ≈ 144k requests) is infeasible at the observed rate. That is a methodological choice (§2.2 tick priority vs M1 candles) and goes to GPT, not decided here |
| Status | `REJECTED_METHOD` for the full tick history (message 14, contract v0.2.1 §2.2: official M1 candles primary, 20-day Tick Audit). 503 handling: `FIXED (regression: Fetch.test_503_is_throttling_like_429)` |
| Attempt | 1 |

### F-004 — INCIDENT: the production Pine script was overwritten for ~30 s (restored)
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T15:08:41Z (v25 saved) → 15:09:12Z (v26 restored) |
| Step | 5 (Parity preparation on TradingView Desktop over CDP) |
| Layer | 6 Implementation (automation) + 7 Environment |
| Symptom | Adding the "GTG Engine m" measurement copy with `tradingview-mcp-jackson` (`newScript` → `setSource` → `save` → `smartCompile`) saved the copy as **version 25.0 of the production script** "GTG Navigator v0.4.7 — Structural Zone Engine" (`USER;389fcddfd2bf4911a03a59f24e32e371`), not as a new script |
| Root cause | `newScript()` put the blank template into the tab of the script that was already open in the editor (production), keeping its identity. The guard checked only the buffer content ("fresh blank script"), not the script identity; `smartCompile` found no "Add to chart" button and clicked "Pine Save" |
| Evidence | `listScripts()`: `USER;389fcdd…` title "GTG Engine v0.4.7 — measurement copy", version 25.0, modified 1790694521; editor header kept the production name |
| Fix (done) | The frozen production source was set back into the same script (editor blob verified = `0c7cbe366668fba20c9bc128448f908ce9314041` before saving) and saved: version **26.0**, title "GTG Navigator v0.4.7 — Structural Zone Engine". The chart study `v5XkYX` reports that script at version 26.0 with short title "GTG v0.4.7". The production source content is identical to the frozen release; the git repository was never affected |
| Prevention | REJECTED_METHOD (table above). Any later automation must: (1) record the production script version first and re-check it after every step; (2) verify the editor's script identity (header name / script id), not only its content; (3) never dispatch Ctrl+S or click Pine Save; (4) stop at the first unexpected state |
| Production Integrity Check (read-only, message 16) | **PASS**, 2026-09-29 ~15:3xZ: saved server source of `USER;389fcdd…` (fetched from pine-facade) = blob `0c7cbe366668fba20c9bc128448f908ce9314041`; title "GTG Navigator v0.4.7 — Structural Zone Engine", short title "GTG v0.4.7"; editor markers 0 errors at restore; chart study `v5XkYX` → that script at 26.0; all 67 user inputs (`in_0…in_66`) identical to the layout backup taken before the incident; no saved script carries the measurement title; alerts: `NOT_OBSERVABLE` (alert service not exposed to CDP, runbook E-G5) — no alert was created or touched |
| Recorded difference | The **server revision changed** (24.0 → 25.0 wrong → 26.0 recovery) while the **frozen source blob is identical** (`0c7cbe3`). Any later reference to "the production script" must name v26.0 as the current server revision of the same frozen source |
| Final check after the Parity Gate (2026-09-29 ~15:5xZ) | Same result: saved source blob `0c7cbe3`, v26.0, `modified` unchanged since the recovery, all 67 inputs identical; temporary studies removed; unsaved editor closed without saving (no dialog); chart back to 15; autosave back on, layout saved with no pending changes |
| Status | `RECOVERED / CONTAINED / VERIFIED` (message 18) — kept in the log; not "did not happen". Re-checked after the MTF parity session too: same blob, version, `modified`, 67/67 inputs |
| Attempt | 1 |

### F-005 — Measurement copy exceeded TradingView's plot limit (RE10140: 71 > 64)
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T15:2xZ |
| Step | 5 (Parity capture, temporary unsaved study) |
| Layer | 3 Measurement/export |
| Symptom | The temporary study `h2Ieae` failed with runtime error RE10140 "The script creates too many plots (71). The limit is 64" |
| Root cause | The static budget counted `plot()` calls (62 ≤ 64), but TradingView counts some plots more than once: the frozen release is already at 62 by TradingView's count, so +12 exports −3 removed = 71 |
| Evidence | Study status `{"type":3,"errorDescription":{"ctx":{"countPLots":71,"maxPlotsNumber":64,"code":"RE10140"}}}`; the frozen study `v5XkYX` on the same chart computes normally (5,975 bars) |
| Method | Plot-call counting as the budget rule (test PC3) |
| Result | Replaced: the copy removes 30 diagnostic `v_*` plots not used by the parity tool (each line replaced by a `[MEASURE]` comment; hashes, event bits, obstacle state, invariant counters, slot bounds, MAs and the 12 `m_*` exports kept). PC3 now enforces "the copy has no more plot() calls than the frozen release" (31 vs 52). No computation changed (PC1) |
| Status | `FIXED (regression: pine-copy.test.mjs PC1–PC3)` — confirmed on TradingView: the copy computes on M5 and M1 (captures 2026-09-29) |
| Attempt | 1 |

### F-006 — M1 replay missed the history TradingView computed before the chart's first bar
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T15:4xZ |
| Step | 5 (Parity, M1 cell) |
| Layer | 3 Measurement/export |
| Symptom | M1: copy vs frozen PASS (15,944 values, 0 mismatches) but replay FAIL: Pine had values at row 0 (e.g. MA50, and MA1000 from row 6) where JS had na |
| Root cause | The study was computed on 993 bars before the chart series' first loaded bar (2026-09-20 22:04 → 2026-09-21 14:36 UTC). TradingView stores those rows at shifted indices (−1000993…−1000001) in the study data; the extractor iterated only the chart series, whose OHLC does not include them. (M5 had no such pre-history: 5,976 = 5,976, replay PASS) |
| Evidence | `study.data().size() = 9303` vs `series.size() = 8310`; `valueAt(-1000993)` = bar 2026-09-20T22:04Z with 42 values |
| Method | Extraction over the chart series indices only |
| Result | Replaced: the copy also exports `m_open/m_high/m_low/m_close` (export only, PC2 = 16 exports) and the extractor reads every row the study computed on, from the study's own data, sorted by time. M5 and M1 are both re-run with this copy |
| Status | `FIXED (regression: parity/captures.test.mjs PG8 M1)` — M1 re-run with the export copy (`7cba55e`): 9,306 rows incl. the 993 pre-history rows |
| Attempt | 1 |

### F-007 — JavaScript compares floats exactly; Pine compares them with an absolute tolerance
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T15:3xZ |
| Step | 5 (Parity, M1 cell) |
| Layer | 3 Measurement/export |
| Symptom | M1 replay with EMA seed `sma`: exactly 1 mismatch in 3,986 engine rows — `v_eventBits` at 2026-09-25T07:28Z, Pine 5120 (headingDown + noChaseEvent), JS 1024 |
| Root cause | `nearestObstacleAtr = 0.30000000000016824` vs `noChaseAtr = 0.30`: JavaScript `<=` is false, Pine `<=` is true. Pine treats \|a − b\| < 1e-10 as equal in every float comparison |
| Evidence | Ruled out first: the SMA summation order and the slot bounds (bit-identical to Pine). Two unsaved probe studies on TradingView Desktop (never saved; production v26.0 checked before and after each): `1+1e-11<=1` true, `1+1e-10<=1` false, `0.1+0.2==0.3` true, `4000+5e-11<=4000` true, `4000+2e-10<=4000` false, `1e6+1e-6<=1e6` false, `1e-6+1e-12<=1e-6` true, `0+5e-11<=0` true → absolute tolerance 1e-10, not relative |
| Method | Exact JavaScript comparison operators in the port |
| Result | Replaced: `engine/pine-cmp.mjs` (eq/ne/lt/gt/le/ge with the measured tolerance; na stays false). The verbatim sources stay the reference (ZE2); `engine/pinecmp/build.mjs` derives Pine-comparison variants of the zone engine, sensors, consumer and obstacle latch (373 comparisons), and the measurement pipeline runs those. Built-ins (`ta.*`, percentrank) are not transformed. Re-run: M1 0 mismatches, M5 0 mismatches. On the M1 capture the variant differs from the exact pipeline on that one bar only |
| Status | `FIXED (regression: engine/pinecmp.test.mjs PCMP1–PCMP5, parity/captures.test.mjs PG8/PG9)` — **frozen by message 18: the tolerance is never widened for a later failure; any new mismatch is a logic/data bug until proven otherwise** |
| Attempt | 1 |

### F-008 — Official M1 acquisition is far slower than planned (source throttling)
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T15:17Z → ongoing |
| Step | 3 (quiet newest-first acquisition, message 16 option A) |
| Layer | 1 Data (source access) |
| Symptom | Desktop run (`build_history.py --from 2003-01-01 --newest-first --keep-raw`): about 7 days per 33 min, with a 600 s cool-down after connection resets (`WinError 10054`) and timeouts (`WinError 10060`) every few days |
| Root cause hypothesis | Dukascopy throttles this client (the same pattern as F-002/F-003; the GitHub runner probe saw 15–31 s per successful request). Not a code or data-format fault: every completed day decodes with full ASK coverage and the expected session bar counts (1,380 weekday, 1,260 Friday, 120 Sunday) |
| Evidence | `C:\Users\alk\gtg-lab-data-acq.log`; idempotent manifest |
| Method | Paced sequential requests (2 s), bounded backoff, 600 s cool-downs |
| Result | At this rate 2003→2026 (≈ 6,000 trading days) needs weeks, not the planned ≈ 3.5 days. The run continues (newest first, so the most recent years land first) |
| Status | `OPEN — plan B (bulk archive / alternative official path) goes to GPT; no retry of the same method at higher speed` |
| Attempt | 1 |

### F-009 — Feed-mode M1 replay: route-HTF EMA 200 differs because TradingView loads a short HTF history
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T16:1xZ |
| Step | 5 (MTF parity, message 18) |
| Layer | 3 Measurement/export |
| Symptom | With JS computing the route HTF from the feed's own M15 bars (feed mode), M1 replay had 6,085 rows with `m_htfMA200` off by up to 2.4e-4 (≈ 0.24 tick); every other field, including `m_routeScore`, matched |
| Root cause | `request.security` runs on an HTF history that starts where TradingView chose to load it (here M15 from 2026-08-31T22:00Z), not at the first bar of the feed; the SMA-seeded EMA 200 carries that start for hundreds of HTF bars. A platform fact, not indicator logic |
| Evidence | Searching every HTF start in the 4,000 bars before the chart: exactly one start reproduces `m_htfMA200` on all 9,306 rows (max |Δ| 2.7e-11); the next best fails 1,136 rows. Same on H1 (H4 route, start 2025-01-01T22:00Z = the H4 bar holding the chart's first bar; next best fails 3,067). M5, M15, H4 converge on the full history |
| Method | Feed mode with the full HTF history |
| Result | `inferHtfStart` (parity/compare.mjs) recovers the start as the **unique** exact solution and reports it (`htfStart.basis` = unique / full-history); no tolerance changed. Research runs on the full Dukascopy history, where the EMA is converged; warm-up rows are excluded as before |
| Status | `FIXED (regression: parity/captures.test.mjs PG9)` |
| Attempt | 1 |

### F-010 — Power simulation draft centred on the Train estimate instead of the null
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T21:3xZ |
| Step | 8 (statistics infrastructure: power gate, §17) |
| Layer | 5 Statistics |
| Symptom | Test ST6 (synthetic null data): the claim rate at Δ = 0 was not small |
| Root cause | The first draft of `powerGate` simulated around the Train sample's own ATT, so a chance (or real) Train effect entered the power and the MDE |
| Evidence | ST6 before the fix; the same data with a large injected Train effect gave a different MDE |
| Method | Outer block resamples of Train without imposing the null |
| Result | Replaced before commit: each simulated estimate is centred on the full-Train ATT (the null is imposed), then Δ is injected. The power uses only the variance and dependence of Train, never the sign or size of its effect. Regression: ST6 asserts identical MDEs with and without a large Train effect, and a low null claim rate |
| Status | `FIXED (regression: stats/stats.test.mjs ST6)` |
| Attempt | 1 |

### F-011 — H3 zone width divided by ATR_eng at t instead of t−1
| Field | Value |
|---|---|
| Date (UTC) | 2026-09-29T22:xxZ |
| Step | 7 (covariate builder, message 24 §10) |
| Layer | 2 Event definition / covariates |
| Symptom | Reviewing the covariate timing before writing test CV1: `widthAtPrev` took the zone bounds from t−1 but divided by `atrEng` of bar t |
| Root cause | The panel's t−1 view did not carry ATR_eng, so the extractor reached for the current bar's value; §7 requires every matching covariate at t−1 |
| Evidence | CV1 (poison bar t, require identical covariates) fails on H3 row fields when the old line is restored; passes with the fix |
| Method | Width normalised by the current bar's ATR_eng |
| Result | The panel's `prev` now carries ATR_eng; width = (hi − lo) at t−1 / ATR_eng at t−1. Every covariate has a declared timing (`COVARIATE_TIMING`) and CV1/CV2 enforce it for H1–H5. No real data had been processed |
| Status | `FIXED (regression: events/covariates.test.mjs CV1, mutation-checked)` |
| Attempt | 1 |
