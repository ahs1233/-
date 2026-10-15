# lastgtg A / B / C on 2021-10 → 2024 — results of TEST_PREREGISTRATION.md v1.1

Run 2026-10-15 after gates 1–4 passed (`../GATES.md`), notes fixed beforehand (`RUN_NOTES.md`),
L_tf logged and committed before scoring (`signals/prelog.json`). Outputs: `results/`
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
a gap after the signal (28 / 9 / 5 for A). H4 is warmed only from 2022-12-06 (W = 5,441 bars from
2019-06), so its 2022 holds 4 / 2 / 1 starts.

**Verdicts (M15, H1, H4):**
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
- In 2021-10 → 2024, on these rules, no version of the green light earned anything after real
  costs on M15, H1 or H4, and none did better than random bars with the same direction, year,
  session and volatility. B and C did not change the result against A.
- The zone strength word did not pick zones that hold better than naive pivots; on M15 it did worse.
- Nothing in A, B or C is changed because of these numbers (contract, "After the results").
- Not run: M1 as a signal timeframe (needs M1 from 2019-06 and its own gate 3).
