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
| — | — | — |

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
