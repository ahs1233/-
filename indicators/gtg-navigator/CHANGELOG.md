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

### Documentation (R7, partial)
- README:
  - The test list now includes T7b, P, S and C.
  - The digest claim is withdrawn.
  - The parity claim is withdrawn in favour of `PINE_JS_PARITY.md`.
  - Gates are marked historical vs current.
- Notion: not reachable from this environment (404). The update text will be prepared at the end of the task and marked as unpublished.
