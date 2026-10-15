# lastgtg A / B / C on 2021-10 → 2024 — results of TEST_PREREGISTRATION.md v1.1

Run 2026-10-15 after gates 1–4 passed (`../GATES.md`), notes fixed beforehand (`RUN_NOTES.md`),
L_tf logged and committed before scoring (`signals/prelog.json`).

## Contract and gate 4 (evidence, in commit order)
- Contract: `../../TEST_PREREGISTRATION.md` v1.1, commit `b335758` (2026-10-15 17:12 UTC), not
  changed since (`git log` on the file shows only `2c02ac7`, `0296a62`, `b335758`).
- Gate 4 PASS, commit `22894d9` (21:28:55 UTC), before any Part 1 / Part 2 code was run:
  `../GATES.md` § gate 4; reports `../gate4/report_run3/` (`summary.json`: 9 cells, 0 mismatched
  values, 932,217 compared); the TradingView capture `../gate4/capture_20261015_run3/` (+ `SHA256SUMS`);
  replay test `../../js/gate4.test.mjs` 9/9 on that capture; export-only copies `../../diag/`
  (manifest, diffs, `diag.test.mjs` 7/7). Then: Part 1 code `218556b` (21:36), Part 2 code `1ea8c57`
  (21:39), signals log `fa89f2c` (21:40), outputs `4f7d6b8` (21:42), this file `4edb223` (21:43).
- One declared deviation awaits the reviewer's acceptance: the gate 4 copies carry
  `calc_bars_count = 3000` in their declaration (a run setting, the only non-export line; without it
  TradingView computes on history it never exports). Until it is accepted, read these results as
  conditional on gate 4. Outputs: `results/`
(`part1_<tf>.json`, every trade in `trades_<tf>.csv`, `part2.json`, logs). Development comparison,
not independent evidence (contract, first section). Per-signal R, overlapping signals included.

## Part 1 — green light after real costs

R = (exit − entry)·dir / atrEng, BID/ASK minutes, target and stop ±1 atrEng. Intervals: circular
block bootstrap over NY trading days (L_tf: M15 5, H1 15, H4 52, M5 3 days), 10,000 resamples;
"99.5 %" two-sided. Matched = baseline bars of the same direction × year × session × volatility
tercile, 200 draws.

| TF | version | starts | executable | win share | mean R | 99.5 % interval | mean R stress | matched mean R | mean R − matched, 95 % | 2022 / 2023 / 2024 mean R |
|---|---|---|---|---|---|---|---|---|---|---|
| M15 | A | 6,078 | 5,360 | 0.413 | −0.174 | [−0.218, −0.130] | −0.349 | −0.181 | [−0.037, 0.051] | −0.148 / −0.180 / −0.157 |
| M15 | B | 1,118 | 1,118 | 0.410 | −0.181 | [−0.272, −0.087] | −0.354 | −0.183 | [−0.102, 0.104] | −0.134 / −0.197 / −0.234 |
| M15 | C | 958 | 958 | 0.412 | −0.176 | [−0.278, −0.071] | −0.347 | −0.178 | [−0.109, 0.110] | −0.156 / −0.150 / −0.271 |
| H1 | A | 1,584 | 1,396 | 0.450 | −0.105 | [−0.193, −0.020] | −0.184 | −0.093 | [−0.095, 0.076] | −0.112 / −0.160 / −0.089 |
| H1 | B | 383 | 379 | 0.443 | −0.115 | [−0.278, 0.062] | −0.194 | −0.088 | [−0.207, 0.154] | 0.008 / −0.239 / −0.188 |
| H1 | C | 327 | 324 | 0.435 | −0.130 | [−0.321, 0.074] | −0.207 | −0.088 | [−0.228, 0.147] | 0.038 / −0.306 / −0.213 |
| H4 | A | 270 | 237 | 0.460 | −0.080 | [−0.312, 0.122] | −0.117 | −0.017 | [−0.266, 0.131] | −0.500 (4) / −0.124 / −0.018 |
| H4 | B | 59 | 58 | 0.466 | −0.069 | [−0.385, 0.241] | −0.106 | 0.006 | [−0.510, 0.335] | 0.000 (2) / −0.152 / 0.043 |
| H4 | C | 53 | 50 | 0.420 | −0.160 | [−0.458, 0.179] | −0.198 | 0.030 | [−0.621, 0.234] | −1.000 (1) / −0.103 / −0.200 |

All-heading-bars baseline: M15 −0.190 (49,301 trades), H1 −0.105 (12,688), H4 −0.033 (2,113).
s_tf (median entry spread) 0.350 / 0.357 / 0.357. No trade expired and none was unresolved: ±1
atrEng is always reached well inside 300 bars. Not executable: heading 0 (A only: 690 / 179 / 28) and
a gap after the signal (28 / 9 / 5 for A).

**H4 coverage.** H4 signals cover 2022-12-06 → 2024-12-31 only: 2021 Q4 is absent and 2022 holds
4 / 2 / 1 starts. Its failure of condition 4 on 2022 reflects missing coverage, not a losing year.
Why: a bar counts once the engine is warmed, i.e. `engineWindow` bars after the first feed bar;
that window is the indicator's own (Pine: `engineOn = bar_index >= last_bar_index - engineWindow`),
2 × the longest level life + 63 bars; on H4 the longest life is the weekly anchor's 64 weeks =
2,688 H4 bars, so W = 5,441 H4 bars ≈ 3.5 years. With the contract's warm-up start 2019-06-01 that
ends 2022-12-06 (M15 warms 2019-07-03, H1 2019-12-10). The data does not force it: the Dukascopy store
starts 2018-03-01, early enough to warm H4 by about September 2021. Whether a run started fewer than
W bars back already gives the same H4 state is not tested (gate 3 tested exactly W); the factor 2 is
a bound, not a measured need. Covering 2021-10 → 2022 on H4 needs a new contract version (earlier
warm-up start, or a tested shorter warm-up).

**Verdicts (M15, H1, H4)** — the contract's label "no difference shown" means the 95 % interval
of the difference contains 0: there is not enough evidence that one version is better or worse.
It does not mean the versions are equal; the intervals are wide (H4 ±0.2 R).
- B against A: −0.007 [−0.065, 0.053], −0.010 [−0.100, 0.088], +0.011 [−0.158, 0.191] → no difference
  shown on any timeframe.
- C against B: +0.005 [−0.031, 0.042], −0.015 [−0.075, 0.043], −0.091 [−0.282, 0.107] → no
  difference shown on any timeframe.
- Candidate for the forward test: **none of the nine cells**. Condition 1 (≥ 100 starts) holds for
  A, B, C on M15 and H1 and A on H4; conditions 2 to 6 fail in every cell (mean R negative, no
  margin over the matched baseline, at least one losing year, stress negative), with L_tf and 2·L_tf
  alike.
- What B and C drop of A's starts (M15): B keeps 1,005 of 6,078; the largest drops are "inside a
  zone" (21: 1,018), "no zone ahead" (44: 1,001), "against the route" (22: 835), no clear heading /
  route (30, 31: 1,060). C adds "break awaiting a second close" (34: 1,103). Same pattern on H1 / H4.

M5 (diagnostic only): mean R −0.348 / −0.319 / −0.327 against a baseline −0.346; spread is a large
share of the M5 distance, as the contract anticipated.

## Part 2 — do zone scores separate better zones from worse ones?

48 closes after the first touch of each zone; reaction = a close 1 atrEng back on the side price
came from before a close beyond the far edge. Blocks: M15 2, H1 4, H4 10 trading days.

| TF | population | touches weak / medium / important / control | reaction share weak / medium / important / control | important − control, 95 % |
|---|---|---|---|---|
| M15 | A/B | 15 / 1,304 / 3,360 / 8,758 | 0.667 / 0.409 / 0.427 / 0.479 | [−0.067, −0.037] |
| M15 | C | 12 / 1,256 / 3,079 / 8,765 | 0.583 / 0.415 / 0.428 / 0.483 | [−0.071, −0.039] |
| H1 | A/B | 1 / 324 / 852 / 2,162 | — / 0.426 / 0.477 / 0.478 | [−0.032, 0.030] |
| H1 | C | 3 / 296 / 781 / 2,164 | — / 0.436 / 0.471 / 0.482 | [−0.044, 0.023] |
| H4 | A/B | 1 / 50 / 140 / 358 | — / 0.420 / 0.407 / 0.450 | [−0.115, 0.037] |
| H4 | C | 1 / 42 / 133 / 358 | — / 0.452 / 0.421 / 0.458 | [−0.112, 0.044] |

**Verdict: inconclusive on every timeframe for both populations**: the weak group never reaches
50 touches (a zone enters a slot only at q ≥ 55, so a displayed score below 48 is rare). The
comparison that could be made says the opposite of separation: zones the panel calls "important"
reacted less often than naive pivot zones on M15 (interval below 0 in both populations, same sign in
2022, 2023 and 2024) and no differently on H1 and H4. "Neither" is about 0 % on all timeframes.

## What this does and does not say
- In 2021-10 → 2024 (H4: 2022-12 → 2024), with a symmetric ±1 atrEng target and stop and this
  execution, every version lost on average after real costs on M15, H1 and H4, and there is no
  evidence that any did better than random bars with the same direction, year, session and
  volatility. B and C cut the number of signals, but there is not enough evidence that the signals
  they keep are better or worse than A's.
- It does not show the indicator is useless in every use; it shows this trading rule showed no
  edge in this sample.
- The zone strength word did not pick zones that hold better than naive pivots; on M15 it did worse.
- Nothing in A, B or C is changed because of these numbers (contract, "After the results").
- Not run: M1 as a signal timeframe (needs M1 from 2019-06 and its own gate 3).

## Appendix — every interval (block bootstrap, L_tf / 2·L_tf)

| TF | series | starts | executable | mean R | 99.5 % interval, L / 2L (base: 95 %, L) | matched mean R | mean R − matched, 95 %, L / 2L |
|---|---|---|---|---|---|---|---|
| M15 | baseline | 49,776 | 49,301 | −0.190 | [−0.207, −0.173] | | |
| M15 | A | 6,078 | 5,360 | −0.174 | [−0.218, −0.130] / [−0.216, −0.131] | −0.181 | [−0.037, +0.051] / [−0.038, +0.051] |
| M15 | B | 1,118 | 1,118 | −0.181 | [−0.272, −0.087] / [−0.278, −0.083] | −0.183 | [−0.102, +0.104] / [−0.103, +0.107] |
| M15 | C | 958 | 958 | −0.176 | [−0.278, −0.071] / [−0.281, −0.071] | −0.178 | [−0.109, +0.110] / [−0.107, +0.111] |
| H1 | baseline | 12,819 | 12,688 | −0.105 | [−0.139, −0.072] | | |
| H1 | A | 1,584 | 1,396 | −0.105 | [−0.193, −0.020] / [−0.193, −0.016] | −0.093 | [−0.095, +0.076] / [−0.093, +0.073] |
| H1 | B | 383 | 379 | −0.115 | [−0.278, +0.062] / [−0.271, +0.058] | −0.088 | [−0.207, +0.154] / [−0.204, +0.151] |
| H1 | C | 327 | 324 | −0.130 | [−0.321, +0.074] / [−0.319, +0.071] | −0.088 | [−0.228, +0.147] / [−0.232, +0.152] |
| H4 | baseline | 2,182 | 2,113 | −0.033 | [−0.123, +0.064] | | |
| H4 | A | 270 | 237 | −0.080 | [−0.312, +0.122] / [−0.292, +0.111] | −0.017 | [−0.266, +0.131] / [−0.266, +0.136] |
| H4 | B | 59 | 58 | −0.069 | [−0.385, +0.241] / [−0.356, +0.175] | +0.006 | [−0.510, +0.335] / [−0.483, +0.313] |
| H4 | C | 53 | 50 | −0.160 | [−0.458, +0.179] / [−0.391, +0.100] | +0.030 | [−0.621, +0.234] / [−0.595, +0.214] |
| M5 | baseline | 149,328 | 148,786 | −0.346 | [−0.358, −0.334] | | |
| M5 | A | 18,447 | 16,367 | −0.348 | [−0.373, −0.325] / [−0.374, −0.322] | −0.337 | [−0.035, +0.012] / [−0.035, +0.013] |
| M5 | B | 745 | 740 | −0.319 | [−0.425, −0.205] / [−0.426, −0.202] | −0.290 | [−0.152, +0.092] / [−0.149, +0.092] |
| M5 | C | 625 | 621 | −0.327 | [−0.444, −0.206] / [−0.442, −0.202] | −0.284 | [−0.179, +0.092] / [−0.177, +0.090] |

Differences, 95 %, L / 2L: M15 B−A −0.007 [−0.065, +0.053] / [−0.067, +0.055], C−B +0.005
[−0.031, +0.042] / [−0.031, +0.043]; H1 B−A −0.010 [−0.100, +0.088] / [−0.092, +0.079], C−B −0.015
[−0.075, +0.043] / [−0.066, +0.036]; H4 B−A +0.011 [−0.158, +0.191] / [−0.138, +0.152], C−B −0.091
[−0.282, +0.107] / [−0.295, +0.087]; M5 B−A +0.029 [−0.044, +0.105], C−B −0.008 [−0.059, +0.044].
