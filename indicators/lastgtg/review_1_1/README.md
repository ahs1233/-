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

Not done yet: Pine compilation in TradingView, `handoff/lastgtg_logic_tests.pine`, replays of
the edge cases, and any test on price data. The comparison of A, B and C on data is
pre-registered separately before anything is computed.
