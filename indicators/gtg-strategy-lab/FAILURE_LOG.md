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
| Status | `FIXED (regression: test_data.Fetch)` — pending confirmation on real data |
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
| Status | `OPEN — waiting for (a) the throttle to cool down before a paced re-probe and (b) a methodological decision on the source granularity` |
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
| Status | `RECOVERED / CONTAINED` — not "did not happen" |
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
| Status | `FIXED (regression: pine-copy.test.mjs PC1–PC3)` — pending the TradingView run |
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
| Status | `OPEN → re-run pending` |
| Attempt | 1 |
