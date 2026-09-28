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

### Documentation (R7, partial)
- README:
  - The test list now includes T7b, P, S and C.
  - The digest claim is withdrawn.
  - The parity claim is withdrawn in favour of `PINE_JS_PARITY.md`.
  - Gates are marked historical vs current.
- Notion: not reachable from this environment (404). The update text will be prepared at the end of the task and marked as unpublished.
