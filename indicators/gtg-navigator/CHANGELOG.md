# CHANGELOG — GTG Navigator

Each entry: problem → fixture before the change → the change → test after → effect on other behaviour.
Baseline for this task: `cdf1a8a` (Pine blob `3f7dd0e`). Review items: `validation/REVIEW_FINDINGS.md`.

## Unreleased — quality-hardening task (Astra review, R1–R7)

### R6 — CI (reference only, no Pine change)
- **Problem**: the Navigator tests were not run by any CI job (`ci.yml` → `pnpm test` → turbo, apps/packages only).
- **Change**: `.github/workflows/gtg-navigator.yml`, a standalone job on Node 22 and 24 with a per-commit summary.
- **Negative control**: a deliberately failing test makes the step exit with code 1.

### R2 — symbol tick in the JS reference (no Pine change)
- **Problem**: JS floored the episode width and ATR at `1e-12`; Pine floors them at `syminfo.mintick`. On Astra's fixture, JS mitigation was 0.486 against 0.0486 in Pine.
- **Fixture before the change**: `parity.test.mjs` P1–P6, 5 of 6 failing on the baseline (`validation/artifacts/r2-parity-prefix-cdf1a8a.txt`).
- **Change**:
  - `withSymbol(P, { mintick })` is now required, with no default.
  - JS applies the same floors as Pine to the episode width, `atrEng`, A1/A2 ATR and swing ATR.
  - The invariant tolerance is aligned with Pine.
- **After**: P1–P6 pass. P6 re-injects the old floor as a negative control.
- **Effect**: on synthetic data, 0 of 8000 bars differ at tick 0.01 and 0.1, and 1169 of 8000 differ at tick 1 (`validation/artifacts/r2-impact-synthetic.txt`).

### R1 — equivalence evidence (Pine instrumentation + JS reference)
- **Problem**: `slotDigest = key + 7·ticks(lo) + 13·ticks(hi)` is linear, so different bounds collide (for example [100,101] and [100.13,100.93]). It also ignores member keys, quality, level states and events. The README said a matching digest meant identical slots.
- **Fixture**: `snapshot.test.mjs` S1–S3 show the baseline digest colliding (negative control) while the new comparison detects the difference.
- **JS change**:
  - `snapshot.mjs` builds a canonical snapshot with four equivalence levels (geometry, identity, state, events) and no absolute bar index.
  - It compares snapshots field by field with the declared tolerances, reporting raw and tick differences separately.
  - The hash is auxiliary only.
  - `capture.mjs` defines the `GTGSNAP` text format (v1 at first; v2 after message 45) and its parser.
- **Pine change** (instrumentation only; engine decisions untouched):
  - Removed `v_slotChecksum`, `v_slotDigestBar` and `slotDigest`.
  - Added `v_hashSlots`, `v_hashLevels` (renamed `v_hashState` after message 45) and `v_eventBits` (both modes).
  - Added `v_loR1…v_hiS2` (validationMode).
  - Added the `captureFrom`/`captureTo` log capture.
  - Added `SlotState.gateQ` (written, never read by the engine).
  - HUD `cs` → `hs`.
  - Plot-type outputs: 42 → 51 of 64.
- **After**:
  - S1–S11 and C1–C7 pass.
  - The capture self-test shows zero differences with 700 bars of history withheld, and catches a single altered key.
  - Pine syntax parse: 0 problems. **TradingView compile/runtime: NOT_RUN.**
- **Effect on the engine**: none intended. The new code only reads engine state. This must be confirmed in TradingView by comparing slots before and after on the same bars (the handoff to GPT).

### R1 revision after review message 45 (JS + Pine instrumentation)
- **Problem**:
  - The state comparison went through a key-to-record map, so a repeated key could hide.
  - The OHLC ring, which `dozBuild` and `containEntrySide` read, was not in the state level.
  - Source identity was only implicit in `memberKey`.
  - `compare-captures` passed when a whole bar was missing.
- **Fixtures before the change**: `snapshot-coverage.test.mjs` S12–S15 all fail (0 of 4) against the `2021946` code (`validation/artifacts/r1b-coverage-before-2021946.txt`).
- **Change**:
  - Comparison is grouped by key, with length and multiplicity checks.
  - The state level gains the ring (age order) and the explicit fields `source/tfRank/typ/birthTime/price`.
  - `hashLevels` becomes `hashState` and also covers the ring (`v_hashLevels` → `v_hashState`).
  - The capture format becomes `GTGSNAP v2`, with the identity fields and RING lines.
  - `compare-captures` is strict about coverage: two-file bar sets must match unless `--intersection-ok` is given; `--expect-times` / `--expect-from/--expect-to/--step-ms` apply to a single file; MISSING and INCOMPLETE are reported separately.
- **After**: S12–S15 pass 4 of 4, the full suite passes 41 of 41, and C8/C9 pin the Pine order.
- **Plot count**: unchanged at 51 of 64.
- **Pine per-bar cost**: now includes the ring hash. Not measured; this is a G2 requirement.

### R3 — Q_stay ≤ Q_enter input contract (JS reference + Pine)
- **Problem**: the input ranges allow `qStay > qEnter`. A constant candidate with gateQ 70 at 55/80 then gives R1 = true,false,true,false,… because the held zone fails its own hold threshold and is re-admitted on the next bar.
- **Fixture before the change**: `params.test.mjs` Q1 and Q4 fail against d0d4df9 (`validation/artifacts/r3-params-prefix-d0d4df9.txt`, which also records the flicker sequence). Q2 (no valid pair alternates; independent hysteresis oracle over a grid) and Q3 (the boundaries and the defaults) pass both before and after.
- **Change**:
  - Reference: `checkParams` refuses `qStay > qEnter` in `selectSlots` and in the `Engine` constructor.
  - Pine: `runtime.error` on `barstate.isfirst`, with an Arabic message. Nothing is clamped and the input ranges are unchanged.
- **After**: Q1–Q4 pass 4 of 4, and C10 pins the Pine guard (it fails when the guard is weakened).
- **Effect**: 0 of 8000 bars differ on 3 seeds with the defaults (`validation/artifacts/r3-impact-synthetic.txt`). No calibration or selection change.
- **Other threshold pairs**: reviewed in `validation/REVIEW_FINDINGS.md`, with no guards added. The heading and route clear/strong inversions are flagged for a decision.

### R3b — semantic input contracts for heading, route and speed (JS reference + Pine)
- **Problem**: overlapping input ranges allow three states that contradict themselves:
  - heading or route: the text reads "↑ صاعد بقوة" while the sign is 0. This happens when clear > strong, and also when clear = strong at the boundary score.
  - speed: Speed Burst and the orange colour fire while the class is still "طبيعية" (when extreme < fast).
- **Fixture before the change**: `consumers.test.mjs` K1–K3 fail on 466ec8b. The recorded outputs are in `validation/artifacts/r3b-consumers-prefix-466ec8b.txt`. `reference/consumers.mjs` transcribes the Pine lines verbatim, and C11 fails if Pine changes them.
- **Change**:
  - `checkParams` enforces `headingStrong > headingClear`, `routeStrong > routeClear` and `speedExtreme ≥ speedFast`.
  - Pine raises `runtime.error` on `barstate.isfirst` with Arabic messages.
  - Nothing is clamped. Defaults and ranges are unchanged.
- **After**:
  - K1–K6 pass 6 of 6.
  - K4 checks consistency over a score grid with boundary configurations.
  - K6 shows the oracle rejects the recorded contradictions.
  - C12 pins the guards; it fails when the route guard is weakened.
  - The full suite passes 54 of 54.
- **Not guarded (documentation only)**: mediumQ/strongQ, fuelHigh/fuelExtreme, and the obstacle distances. An inversion there only makes a label band unreachable.
- **Effect**: engine impact is 0 of 8000 bars on seeds 21/7/5. The defaults satisfy every contract (K5, C12).

### R4 — alert contracts (JS reference + Pine; engine geometry unchanged)
- **R4-A Strong Obstacle.** The event means entering Strong+Near for a specific obstacle on a confirmed close.
  - Identity is dest1's slot `entryKeys`; the same obstacle means its entry keys intersect the latch keys.
  - The latch (`strongObsLatch` / `strongObsKeys`) moves on confirmed bars only.
  - Before: the distance-crossing rule missed three cases: weak→strong, A→B and quality re-entry (`validation/artifacts/r4a-strong-obstacle-before-after.txt`).
  - `primaryKey` was rejected as the token because it churns within one real zone (O8).
  - Tests: O1–O9, C13.
- **R4-B event provenance.**
  - `Level.navArmed` is armed at ACTIVE/FLIP→BREAKING when the level was displayed on the previous bar.
  - Break Accepted and Flip Confirmed now follow the arm instead of the current slot.
  - The arm is cleared on back or expiry, on flip, on death, and at the end of flipWindow.
  - Before: B1–B7 fail (`validation/artifacts/r4b-lifecycle-prefix-06a61a2.txt`). After: B1–B8 pass.
  - Slot maps: 0 differing bars. Breaking and Reject: 0 differences. Every Accepted/Flip difference is attributed per level to the arm (`validation/artifacts/r4-impact-synthetic.txt`).
  - Tests: B1–B8, C14.
- **R4-C.** `validation/ALERT_CONTRACT.md` covers all ten alerts. `consumers.mjs` transcribes every alert source line, pinned by C11. Tests: A1–A6.
  - Open contract questions: Q-A (the Accepted message for a FLIP that dies), Q-B (No Chase is obstacle-agnostic), Q-C (event rates on real data).
- **Continuation state.**
  - `navArmed` and the latch are in the canonical state level and in `hashState`.
  - Capture moves to `GTGSNAP v3`: `navArmed` on LVL lines, plus an OBS line.
  - New export `v_obsState`. Plot outputs: 52 of 64.

### After review message 53 (tests + one alert message; no engine change)
- **I13 identity continuity.** Five tests pin the property that makes the entry-key intersection safe:
  - A held slot's entry keys only shrink (prev ∩ current).
  - An empty intersection ends the privilege; a re-entry is a fresh identity.
  - No active slot has empty entry keys.
  - Merge and split do not add keys.
  - The property holds across three seeds × 4000 bars.
  - Negative control: an injected defect (a held slot taking all members) fails 4 of 5 (`validation/artifacts/i13-identity-negative-control.txt`).
- **Q-A.** The Break Accepted alert message is now neutral: «الكسر أصبح مقبولًا وفق محرك المناطق.». The condition is unchanged and there are still 10 alerts (C15).
- HUD roadStatus for breakAcceptedUp/Dn → «اختراق مقبول» / «كسر مقبول» (message 55; text only; «Flip محتمل» kept on the BROKEN navTag, C16).
- **Q-B.** No Chase stays obstacle-agnostic. This is recorded as a DESIGN_DECISION.
- **Q-C.** R4-B is accepted provisionally. It becomes final only after GPT measures it on real XAU data in TradingView.

### E41 helper — R5 reload fingerprint (validation only; no engine change)
- **Why**: E41 needs a comparison of loads that avoids Table View and long UI loops.
- **TradingView result (GPT)**: XAU M1, 40-bar window. Readings A, B and C gave the same tuple, with n=40 and cold=0. `compare-r5.mjs` returned RESULT OK (E41).
- **Change**: inside the capture window only, Pine folds hashSlots, hashState and the event bits over the warmed bars. The GTGDIAG cell shows the result as `R5=<n>,<cold>,<from>,<to>,<hSlots>,<hState>,<hEvents>`. There is no plot and no work outside the window.
- **JS twin**: `diag.mjs` (`r5Fingerprint`, `parseR5`, `r5Verdict`) and `tools/compare-r5.mjs`.
- **Tests**:
  - R5.1–R5.3: the long warm-up, short warm-up and moved-window reload loads agree. A cold start, a position-grouped feed and a single flipped event bit are all rejected.
  - C19, whose 4 negative controls each fail it alone (`validation/artifacts/e41-helper-checks.txt`).

### G2 — state-level hash only when read (Pine telemetry; no engine change)
- **Problem**: G2 FAILED on 680fb20. The Profiler warns "Heavy script" and times out, while cdf1a8a profiles cleanly; normal runtime is 0 errors. Section 12a computed hashState on every engine step: about 1,776 hash steps, plus a sort and helper calls. With validationMode off and no capture, nothing reads it.
- **Change**: `hashStateOn = engineStep and (validationMode or captureOn)` now gates the pool collection, the sort, hashState and the latch fold. hashSlots (about 57 steps) stays on every engine step.
- **Effect**: v_hashState is na in production. Hash values are unchanged wherever they are computed. Engine, events, selection and calibration are unchanged.
- **TradingView (GPT)**: on XAU M1 in production mode the Profiler now completes, with no timeout (E44). No reliable total time was exposed, so the numeric comparison with cdf1a8a stays open.
- **Tests**: C18 pins the gate and the read-only property. Its 4 negative controls each fail C18 alone (`validation/artifacts/g2-cost-gate-checks.txt`).

### R5 — reload determinism from independent histories (JS reference and tests only; no engine or Pine change)
- **Problem**: T7 compared two engines that shared one `series` and one `anchorFeed` computed from the whole 8000-bar array, so it could not see anything that depends on how much history a chart has. Its HTF builder also grouped bars by array position.
- **Change**: `reference/history.mjs` builds everything a chart instance sees from its own data:
  - an M1 market with an XAU-like session calendar (daily break, weekend);
  - the series from the load alone;
  - A1/A2 from time buckets of the market, starting at the load's own HTF history start, with Pine's `lookahead_on` + `[1]` semantics;
  - the engine start from the end of the load (`last − (W + studyExtraBars)`), as in Pine.
- **Tests** (`reference/history.test.mjs`):
  - H0: bucket semantics on a hand fixture.
  - H1: causality from prefixes, with a lookahead control.
  - H2: shorter and longer history plus HTF start, 2 seeds, with a position-grouped-feed control.
  - H3: studyExtraBars 0/700/3000.
  - H4: live continuation against a reload with a moved window.
  - H5: byte-identical replay.
  - H6: the warm-up is real (617 bars differ, last at +616) and W = 1983 covers it.
- **Negative controls**: 4 mutations, each failing at least one test (`validation/artifacts/r5-history-checks.txt`):
  - M1: infinite-memory ATR.
  - M2: a 600-bar warm-up.
  - M3: unbounded HTF pivot list.
  - M4: a feed without `[1]`.
- **Effect**: none on the engine or Pine. TradingView counterpart: E41 (NOT_RUN).

### Diagnostics moved to a validation-only table; INV corrected (review message 59; measurement only)
- **Problem**: the four 18b `plot()` calls (commit `98177c2`, blob `461ca64`) caused **RE10140** on TradingView, the plot-count limit.
  - The earlier "52 → 56 of 64" statement was a *source call* count, not a plot-count measurement. That claim is withdrawn.
  - The actual count was not observable before the error.
- **Change**:
  - The four values are now shown in a validation-only table at `position.bottom_left`, with no `plot()` calls. The table is cleared when validationMode is off.
  - On the open bar the table shows the values of the last confirmed bar.
  - Source plot-type calls are back to 52, the same as `7f97c41`, which ran.
- **INV (message 59)**: INV is now the cumulative maximum of `tel.violations` / `tel.violationsCritical`, packed in base 2^26, with overflow → `na`.
  - The previous "new violation bars in the window" metric read 0 for a violation before the window, which is a false clean.
- **Tests**: D8 (INV and the counterexample), D9 (table text), C17 rewritten with four negative controls. The engine, consumers and event outputs are unchanged: the Pine diff against `7f97c41` is one additive hunk in section 18b.

### Rolling validation diagnostics (review message 57, second version; measurement only) — superseded by the entry above
- **Pine section 18b** adds four packed Data Window plots, validationMode only, `na` on the open bar:
  - `v_diagEvt1000`, `v_diagMismatch1000`, `v_diagCausal1000`, `v_diagInv1000`;
  - they cover the last 1000 confirmed bars, counted over warmed engine bars;
  - they use the analyzer masks.
  - There is no engine, selection, calibration or event change.
  - ~~Plot outputs: 52 → 56 of 64~~. This was a source-call count, and TradingView rejected the version with RE10140 (see the entry above).
- **Reference and tooling**: `reference/diag.mjs` (packing, decoder and rolling model), `validation/tools/decode-diag.mjs`, tests D1–D7 and C17.
- **Deviation**: `v_diagInv1000` counts bars with a new violation or a new critical violation. The requested windowed maximum of the cumulative counters was dropped: it would carry pre-window history, and its base 65536 is not safely bounded. See `PINE_JS_PARITY.md` §8.

### Documentation (R7, partial)
- README:
  - The test list now includes T7b, P, S and C.
  - The digest claim is withdrawn.
  - The parity claim is withdrawn in favour of `PINE_JS_PARITY.md`.
  - Gates are marked historical vs current.
- Notion: not reachable from this environment (404). The update text will be prepared at the end of the task and marked as unpublished.
