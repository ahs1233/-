# Addendum A1 to TEST_PREREGISTRATION.md v1.1 — H4 coverage completion after seeing the results

Declared 2026-10-16, **after** the Part 1 and Part 2 results of v1.1 were read
(`runs/part1/RESULTS.md`), at the reviewer's request. The run it governs is named
"H4 coverage completion after seeing the results" (استكمال تغطية H4 بعد الاطلاع على النتائج). It is
not independent evidence and does not replace the v1.1 run, which is kept unchanged for comparison.

## Why
Under v1.1 a bar counts once the engine is warmed, i.e. `engineWindow` bars after the first feed
bar. On H4 that window is 5,441 bars; with the v1.1 warm-up start (2019-06-01) H4 was warmed only
from 2022-12-06, so H4 signals covered 2022-12-06 → 2024-12-31 and 2022 held 4 / 2 / 1 starts. The
Dukascopy store starts 2018-03-01.

## The one change
- **H4 only**: the feeds start at the store's first day, **2018-03-01**, instead of 2019-06-01.
  The window is not shortened; a bar still counts only when warmed. If H4 is not warmed by
  2021-10-01 even so, the first warmed bar is reported and the period starts there.

## Unchanged
Signal period [2021-10-01, 2025-01-01), versions A / B / C (frozen files and JS port as in v1.1),
entry, exit, costs, stress, baselines, matched draws, block bootstrap, verdict rules, Part 2 rules,
seeds, the M1 feed (from 2021-09-01) and the code (`js/part1/`), apart from pointing it at the new
feeds. M15, H1, M5 are not rerun (they were warmed from 2019).

## Consequences stated before the run
- L_tf and the Part 2 block length are recomputed by the same rule (bar times of the period; expected
  unchanged) and logged before scoring.
- The volatility tercile cuts come, as v1.1 says, from the warm-up bars before 2021-10-01; with the
  earlier start these now include 2018-03-01 → 2019-05-31.
- Part 2 on H4 is rerun with the same feeds (it had the same coverage gap).
- Both runs are reported side by side; neither is chosen after the fact.
