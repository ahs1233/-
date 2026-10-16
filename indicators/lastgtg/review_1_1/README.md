# lastgtg review 1.1 — versions B and C

Astra's patch package (`handoff/`, unchanged, checksums in `handoff/bundle_sha256.json`) applied
to `indicators/lastgtg/lastgtg.pine`, which stays untouched as version A.

- A — `indicators/lastgtg/lastgtg.pine` (sha256 `320e33eb…2e1744`).
- B — `build/lastgtg_B_1_1.pine`: green never bypasses the safety checks, no zone ahead reads
  as "no zone found" (yellow), move shares use the move that owns the drawn pullback zone,
  closed-bar exports in the Data Window and green start/end alerts.
- C — `build/lastgtg_C_1_1.pine`: B plus a break accepted only after two consecutive closes
  beyond the buffer inside a three-bar window; a strong body no longer accepts at once.

What was run here (2026-10-15):

- `python3 handoff/test_patch.py`: lamp truth table 147,456 cases, 20 C break cases,
  9 builder assertions, 3 examples, all passing.
- `python3 handoff/build_lastgtg.py indicators/lastgtg/lastgtg.pine --out …`: every anchor
  matched exactly once on the full original file; outputs in `build/` with their diffs.
- Every name the inserted code uses is declared earlier at global scope; 20 plots in total.

JS port for the history test (`js/`, gate 2 of `TEST_PREREGISTRATION.md`):

- `js/lamp-bc.mjs`: `gtgLampDecision`, `gtgLampReason`, the adapter inputs and the episode
  rule, on the same obstacle inputs as A (`../live/lamp.mjs` now exports `obstacleInputs`;
  `lampOf` unchanged, its tests pass).
- `js/build-c.mjs` → `js/zone-engine-c.mjs`, `js/measure-c.mjs`: the live engine with
  `c_breaking.pinefrag` in JS (exact replacements, each found once; lines marked `[C]`).
- `node --test indicators/lastgtg/review_1_1/js/bc.test.mjs`: JS lamp = the handoff's Pine
  translation on all 147,456 cases (lamp and reason), Astra's 20 C break cases on the real
  `updateLevel`, strong-body acceptance in A/B but not C, B row cases. 13/13 pass.

Gates of `TEST_PREREGISTRATION.md` v1.1 (record: `runs/GATES.md`): gate 1 (Pine compiles and runs,
logic test PASS — 19 cases), gate 2 (above), gate 3 (engine start window = continuous run on
the sampled bars) and gate 4 (Pine = JS on the same TradingView bars, M15 / H1 / H4 × A / B / C, no
difference on any of 932,217 compared values; `diag/` export-only copies, `tv/gate4_run.mjs`,
`js/gate4.mjs`, `js/gate4.test.mjs`) all pass.

Part 1 and Part 2 (code `js/part1/`, notes `runs/part1/RUN_NOTES.md`, results
`runs/part1/RESULTS.md`): no green-light version earns anything after real costs on M15, H1 or
H4 in 2021-10 → 2024, none beats the matched baseline, B and C show no difference from A, and no
cell qualifies for the forward test. Zone strength: inconclusive (too few weak zones); "important"
zones reacted less often than naive pivots on M15 and no differently on H1 / H4.
