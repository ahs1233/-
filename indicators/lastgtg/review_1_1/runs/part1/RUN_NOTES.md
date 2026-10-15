# Part 1 — run notes, written before any Part 1 number

Contract: `../../TEST_PREREGISTRATION.md` v1.1 (frozen 2026-10-15). Code: `../../js/part1/`
(`trade.mjs` one trade, `stats.mjs` days / blocks / draws, `part1.mjs` the two stages;
`part1.test.mjs` 13/13 on synthetic minutes). Gates 1–4 passed (`../GATES.md`).

## Data
`../../../history/export_history.py` (ASK open added as the last M1 column, test passing) on the
v0.2.3 Dukascopy store `C:/Users/alk/gtg-lab-data-jforex`, `--from 2019-06-01 --m1-from 2021-09-01
--to 2025-06-30`: 1,891 days 2019-06-02 → 2025-06-30, 2,155,061 in-session minutes, 1,357,422 M1
rows with BID and ASK. sha256: M1 `46b1cc45…`, M5 `4ae92384…`, M15 `cd86b140…`, H1 `897c8d98…`,
H4 `21f2ab29…`, D `190930e0…`, W `fb1e4c76…`.

## Two stages
1. `signals` runs the A and C engines (B reads the A engine) continuously from the first feed bar,
   as gate 3's continuous run, and writes, for every warmed bar opening in [2021-10-01, 2025-01-01),
   time, `atrEng`, heading, volatility ratio and each version's lamp / reason / episode start. It
   reads no price after any bar. It also logs L_tf, the Part 2 block length and the volatility
   tercile cuts (`prelog.json`). That log is committed before stage 2 runs.
2. `score` reads the M1 BID / ASK minutes and computes everything else.

## Points the contract leaves open, fixed here before any result
- Signal bar close = bar open + the timeframe's length.
- Calendar year of a signal = UTC year of the signal bar's open (the period is defined on opens);
  2021 Q4 = signals before 2022-01-01. Session bucket = UTC hour of the signal close, as written.
- "99.5 % interval" and "95 % interval" = two-sided percentile intervals of the block bootstrap
  (99.5 % → 0.25 % and 99.75 % points; 95 % → 2.5 % and 97.5 %).
- Win share = trades with R > 0 / executable resolved trades.
- An exit-side minute with a missing price is skipped (no information) and counted (`skippedMinutes`).
- A trade whose expiry bar is beyond the feed, or whose M1 data end first, is `unresolved_end`.
- s_tf = median entry spread (ASK open − BID open at the entry minute) over the executable resolved
  all-heading-bars baseline trades.
- Bootstrap day sequence = trading days (New York 17:00 → 17:00) holding a period bar or an entry,
  in order; blocks circular; the resamples come from one stream seeded 20261015 and are the same
  for A, B, C and both baselines; each resample's matched draw is picked from a second stream seeded
  20261016. Matched draws: stream seeded 20261015 for each version.
- A start bar's trade is the all-heading-bars trade of the same bar (same entry, exit and costs).
- "Warmed" = engine running and at least `engineWindow` bars after the engine start. With warm-up
  from 2019-06-01 the long H4 window (W = 5,441 bars) may leave H4 unwarmed for part of the
  period; the first warmed bar of each timeframe is logged in `prelog.json`. Condition 4 then
  judges each year on what is there (a year with no executable start fails it). A consequence of
  the frozen contract, not changed.
- M1 is not run as a signal timeframe here (it needs M1 bars from 2019-06 for its warm-up and its
  own gate 3); M5 is run as the diagnostic. Neither decides.
