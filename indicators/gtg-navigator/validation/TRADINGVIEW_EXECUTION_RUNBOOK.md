# GTG TradingView Execution Runbook

Status: mandatory operating procedure for all GTG Navigator TradingView validation work.

## 1. Browser exclusivity — hard rule

- **Microsoft Edge is forbidden for this project unless Ahmed explicitly changes this rule.**
- Do not open Edge for TradingView, Claude, ChatGPT, or diagnostics.
- TradingView must exist in **one browser only** during a validation run.
- Current allowed browser: **Google Chrome**.
- If TradingView is already open in Chrome, never open another TradingView session in another browser.
- If a second TradingView session is discovered, stop the run and close/ignore the duplicate before continuing.

## 2. One controlled TradingView surface

Before validation:
- One TradingView chart surface only.
- One target symbol/timeframe only.
- No duplicate XAUUSD tabs.
- No Claude / ChatGPT / DevTools surface may be used as the target of TradingView automation.
- Record the exact top-level window handle and use only that handle for the run.
- Re-identify the target after any browser restart or window recreation.

## 3. Preflight gate — no validation before PASS

All items must be verified before reading any TradingView result:
1. Browser = Chrome.
2. Edge not used.
3. Target = OANDA:XAUUSD.
4. Timeframe = requested timeframe.
5. GTG Navigator visible.
6. DevTools closed.
7. No modal/dialog such as `Unsaved version`.
8. Pine Editor closed unless source verification is being performed.
9. Data Window closed unless data is being read.
10. Correct Pine source verified by Git blob.
11. Expected inputs verified:
   - ValidationMode = ON for validation captures.
   - StudyExtraBars = 5000 unless test contract says otherwise.
   - StrictDebug = OFF unless strict-debug test explicitly requires ON.
12. Chart returned to latest data before live-window validation.
13. Auto-scale applied after symbol/timeframe change when required.
14. Preflight snapshot written before measurement.

If any item fails: **do not continue the validation run.**

## 4. Source-of-truth rule

- GitHub commit/blob is the code source of truth.
- TradingView Pine Editor must be hash-checked against the expected Git blob before use.
- Do not infer source equality from title, visual appearance, or an enabled/disabled Update button.
- Normalize CRLF/LF before comparing when reading from Monaco clipboard.

## 5. UI automation rules

Preferred order:
1. UI Automation patterns: TogglePattern, SelectionItemPattern, InvokePattern, ScrollPattern.
2. Element-derived ClickablePoint.
3. Geometry derived from current element bounding rectangles.
4. Fixed screen coordinates only as a last-resort diagnostic, never as a reusable control method.

Never assume:
- A panel is open because it was clicked.
- A tab is active because it was previously selected.
- A button with the same name belongs to TradingView.
- A chart point remains valid after layout changes.

Verify state after each state-changing action.

## 6. Failure escalation rule

Every failure is classified:
- ENVIRONMENT
- SOURCE
- UI_AUTOMATION
- TRADINGVIEW_RUNTIME
- GTG_LOGIC
- DATA_CAPTURE

For each failure record:
- symptom
- actual cause
- fix
- prevention rule

Retry policy:
- First failure: diagnose.
- Second failure of the same method: stop using that method.
- **Never repeat the same failed method a third time.**
- Switch to a different mechanism or stop and report the blocker.

## 7. Known failures and permanent lessons

### E-01 — Mixed browser / mixed surface
Symptom: commands acted on the wrong UI surface.
Cause: TradingView, Claude, ChatGPT, or another browser surface coexisted without a locked target.
Prevention: Chrome-only TradingView; explicit window handle; no Edge.

### E-02 — Duplicate XAUUSD tabs
Symptom: correct actions produced inconsistent state because another XAUUSD tab carried different Pine/source/panels.
Prevention: one controlled XAUUSD surface per run.

### E-03 — DevTools changed Accessibility tree
Symptom: TradingView elements disappeared or changed between calls.
Cause: DevTools altered the accessible hierarchy.
Prevention: DevTools must remain closed during validation.

### E-04 — Unsaved Pine state
Symptom: dialogs and editor state interfered with chart automation.
Prevention: no Unsaved dialog during measurement. Verify/apply source, then close editor cleanly before reading results.

### E-05 — Table View virtualization changed in TradingView 153
Symptom: old extractor expected 58 accessible cells but only OHLC visible cells were exposed.
Prevention: do not rely on legacy Table View cell-count extractors. Use compact GTG diagnostics or a verified current extractor.

### E-06 — Data Window `∅` misinterpreted
Symptom: validation values appeared empty.
Cause encountered: chart was outside the effective engine/study window, or wrong state was being observed.
Prevention: return to latest data first; verify `v_cfg` becomes numeric before interpreting diagnostic outputs.

### E-07 — Closed/current bar ambiguity
Symptom: current bar produced `∅` or incomplete state.
Prevention: validation evidence must use confirmed closed bars unless a test explicitly targets intrabar behavior.

### E-08 — Wrong Pine source despite correct script title
Symptom: editor title matched GTG but Git blob did not.
Prevention: hash Monaco contents before each validation build.

### E-09 — CRLF hash mismatch
Symptom: apparent source mismatch.
Cause: line-ending normalization.
Prevention: normalize CRLF -> LF before Git blob comparison.

### E-10 — Hardcoded chart coordinates
Symptom: right-click landed on price scale/object instead of chart background after layout changes.
Prevention: derive coordinates from current bounding rectangles; do not reuse old fixed coordinates.

### E-11 — Panel toggle ambiguity
Symptom: click intended to open a panel closed it instead.
Prevention: read TogglePattern state first; only toggle when state differs from desired state.

### E-12 — Settings button has no ClickablePoint
Symptom: visible Settings element rejected GetClickablePoint.
Prevention: prefer InvokePattern when available.

### E-13 — Chrome restart/session restoration
Symptom: tab/window state changed and previous automation handles became invalid.
Prevention: all handles are invalid after restart. Run full preflight again; do not reuse old window/tab assumptions.

### E-14 — Accessibility target changed to Claude
Symptom: UIA returned Claude Code elements while TradingView was intended.
Cause: selecting the first Chrome top-level window / mixed tabs.
Prevention: never select Chrome by process alone; target the verified TradingView window/surface explicitly.

### E-15 — Legacy E35 extraction loop
Symptom: old extractor returned 0 usable rows after TradingView UI changes.
Prevention: run a short smoke test before any long extraction. Stop immediately if schema/count differs from contract.

### E-16 — Profiler timeout on 680fb20
Symptom: Profiler shows "Heavy script" (production) and times out (RE10110 with validationMode ON + 5000; "Calculation timed out" with OFF + 0); normal runtime is 0 errors.
Cause (static, not yet confirmed on TradingView): state-level hash in section 12a ran on every engine step in production.
Fix: candidate a123ad6 gates it behind validationMode or the capture.
Prevention: static contract C18; re-profile the candidate before any other G2 claim.

## 8. Evidence separation

Never conflate:
- reference tests PASS
- CI PASS
- Pine compile PASS
- TradingView runtime PASS
- real-market validation PASS
- performance PASS

Each gets an independent evidence line and artifact.

## 9. Completed evidence that must not be rerun without technical reason

Current known completed evidence:
- Reference suite: 107/107 PASS at 68cf96e (R5); 108/108 at a123ad6 (G2 candidate, C18 added).
- GTG workflow SUCCESS.
- General CI SUCCESS.
- E35 real XAU M1 1000-row validation previously completed with:
  - AlertMismatch = 0
  - no Accepted without nearby Break within the tested causal contract
  - no Flip without prior Accepted within the tested causal contract
  - max invariant violations = 0
- On 680fb20 (blob 8cdddd1), OANDA:XAUUSD: M1 runtime PASS (Runtime=0), H1 sanity PASS, N2 ON/OFF zone geometry PASS, GTGDIAG window PASS (E39).
- G2 on 680fb20: FAILED — PROFILER_TIMEOUT (normal runtime still PASS). Candidate a123ad6 NOT_RETESTED_ON_TRADINGVIEW.
- Do not rerun these merely because a later UI action fails.

## 10. Operational discipline

- One objective per run.
- One controlled state transition at a time.
- Verify after every transition.
- Keep a checkpoint after every completed gate.
- If the UI becomes ambiguous: stop, restore preflight, continue from last valid checkpoint.
- Never improvise around a broken environment while simultaneously collecting evidence.

## 11. Current required order

1. Preflight PASS.
2. Source/blob verification.
3. Runtime/diagnostic read on XAU M1.
4. H1 sanity.
5. N2 instrumentation ON/OFF.
6. G2 performance.
7. R5 determinism/reload/prepend history.
8. Matrix XAU/BTC × M1/M5/M15/H1.
9. Evidence Matrix + Validation Report + Notion.
10. Claude handoff only with verified artifacts.
