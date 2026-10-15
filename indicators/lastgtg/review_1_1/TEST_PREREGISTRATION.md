# lastgtg A / B / C comparison on 2021–2024 — pre-registration (draft for approval)

Written 2026-10-15, before any B or C row was computed on price data. Once approved it is
committed and not changed after results; a change means a new dated version of this file.

## What this test is, and is not
- **Development comparison, not independent evidence.** 2018-03 → 2024-03 (lab Train) was used
  to build parts of the engine and lastgtg (zone weights, pullback depth, entries); 2023-06 →
  2026-09 was used by later lab tests; 2025-01 → 2026-09 by the lastgtg 2025–2026 test. No
  historical period after 2018 is untouched. A result here selects what goes to a forward test.
- Two questions are kept apart: **Part 1** does the green light (A, B, C) earn anything after
  real costs; **Part 2** do zone scores separate better zones from worse ones.

## Versions
- **A** = `indicators/lastgtg/lastgtg.pine` (sha256 `320e33eb…2e1744`).
- **B**, **C** = `build/lastgtg_B_1_1.pine`, `build/lastgtg_C_1_1.pine` (hashes in `build/manifest.json`).
- The test runs on the JS port: A = `../live/zone-engine.mjs` + `../live/lamp.mjs` as live today;
  B = A with the lamp replaced by a line-for-line JS copy of `gtgLampDecision` and the
  `lamp_adapter` inputs (mapped zone ahead, room, closed-bar snapshot, episode start);
  C = B with the `c_breaking` engine change (and no strong-body acceptance).

## Gates (all must pass before any Part 1 or Part 2 number is read)
1. **Pine compiles**: B and C added to a TradingView chart without error;
   `handoff/lastgtg_logic_tests.pine` shows PASS.
2. **JS decision = Pine decision**: the JS lamp function gives the same lamp and reason as the
   Pine fragment on all 147,456 cases of `handoff/test_patch.py`; the JS C branch passes the
   same 20 break cases.
3. **Engine window (engineOn)**: Pine runs the engine only on the last `engineWindow` bars; the
   JS research run is continuous. For 50 green-start bars and 50 random warmed bars per
   timeframe (seed 20261015), a run started exactly `engineWindow` bars before the bar (HTF and
   anchor bars opening at or before it, as `../live/runner.mjs`) must give the same lamp, reason,
   heading, route and accepted flag as the continuous run. More than 2% differing in any
   timeframe stops the test.
4. **Pine = JS on the same bars**: for each of M15, H1 and H4, one TradingView OANDA:XAUUSD window
   (the bars Pine's engine runs on) is exported with the B and C Data Window plots; the same
   bars are fed to the JS port. Required: lamp closed equal on ≥ 98% of engine bars, reason
   equal on ≥ 95%, green-episode starts matched on ≥ 95% of either side's starts. Below that the
   test stops, the port is fixed and this gate is run again; no outcome is read in between.

## Data and period
- v0.2.3 canonical Dukascopy XAU/USD M1 store on the desktop (`C:/Users/alk/gtg-lab-data-jforex`),
  BID and ASK per minute; bars from it with the lab's frozen calendar
  (`../history/export_history.py`, extended to write the M1 BID and ASK opens).
- Signals: closed bars opening in **[2021-10-01 00:00 UTC, 2025-01-01 00:00 UTC)**. Warm-up
  from 2019-06-01; a bar counts only when the engine is warmed. Scoring may read M1 to 2025-03-31.
- Timeframes: **M15, H1 and H4 decide**; M1 and M5 are reported only (in 2025–2026 the spread was
  about a third of the M1 distance, so they cannot pass after cost whatever B or C change).

## Part 1 — green light
- **Signal**: green-episode start on a closed bar (B/C: `gtgGreenStart`; A: the same rule on
  A's lamp — a bar is a start when it is green and the previous bar was not green, or was green
  in the other direction). Direction = the heading at that bar. One trade per episode start;
  overlapping trades are allowed and each is scored alone.
- **Entry**: the first M1 bar opening at or after the signal bar's close; a long buys at its ASK
  open, a short sells at its BID open. Nothing inside the signal bar.
- **Exit**: distance `d` = `atrEng` of the signal bar; target = entry + dir·d, stop = entry − dir·d.
  A long exits on BID (target: BID high ≥ target; stop: BID low ≤ stop); a short exits on ASK
  (target: ASK low ≤ target; stop: ASK high ≥ stop). Both in one M1 bar = loss. No touch within
  300 signal-timeframe bars = `expired`, closed at that M1 close on the exit side.
- **Result per trade**: R = +1 (target), −1 (stop or tie), or the expired close in units of `d`.
  Costs are inside R because entry and exit use the real BID/ASK; no extra spread is taken.
  **Stress**: R − s/d, with s = the median entry spread of all Part 1 trades (commission and
  slippage are not known; this stands in for them).
- **Baseline**: every warmed closed bar with a non-zero heading, entered with the heading, same
  entry, exit and costs.
- **Intervals**: block bootstrap over trading days, 10,000 resamples, seed 20261015; the days are
  drawn once and shared by every version, so A, B and C are compared on the same resample.
- **Reported** per version × timeframe: episodes, target / stop / tie / expired, win share,
  mean R, mean R stress, mean R per year (2022, 2023, 2024; 2021 Q4 shown, not judged), baseline
  mean R, and for B and C how many A starts they drop, by reason code.

### Verdicts (M15, H1, H4 only)
- **B against A**, **C against B**: the difference in mean R; `better` if the 95% interval is
  above 0, `worse` if below 0, else `no difference shown`.
- **Candidate for the forward test** (9 cells: 3 versions × 3 timeframes), all of:
  1. at least 100 episodes;
  2. mean R: lower edge of the 99.5% interval above 0;
  3. mean R above the baseline mean R of that timeframe;
  4. mean R above 0 in 2022, 2023 and 2024 separately;
  5. mean R stress above 0.
- Neighbouring episodes are not independent; the day blocks soften this, they do not remove it.

## Part 2 — zone quality (independent of the lamp)
- **Zones**: the nearest support and resistance (S1, R1) on closed M15, H1 and H4 bars. Engine
  A/B is one population (B does not change the engine); C is a second population.
- **First touch**: the first closed bar, after a zone enters S1/R1, whose range overlaps the zone
  while the previous close was outside it.
- **Outcome within 48 bars**: `reaction` if a close lands ≥ 1 `atrEng` from the zone on the side
  price came from before any close beyond the far edge + `breakBufK·atrEng`; `break` if that
  beyond-close comes first; otherwise `neither` (counted, not in the share).
- **Groups**: the strength word at the touch (weak < `mediumQ` ≤ medium < `strongQ` ≤ important),
  and a control: naive pivot zones (`TRADE_CONTRACT.md` P1: pivot high/low of the same
  `pivotLen`, width = median width / `atrEng` of the displayed zones on the same timeframe).
- **Measure**: reaction share = reaction / (reaction + break), with the same day-block bootstrap.
- **Verdict**: `scores separate zones` if, on at least two of the three timeframes, important
  minus weak and important minus control both have a 95% lower edge above 0, with the same sign
  in 2022, 2023 and 2024. The lab's 2018–2024 zone-weight test (`gtg-strategy-lab/reports`) found
  weights not useful; this Part checks the strength word lastgtg actually shows.

## After the results
- Nothing in A, B or C is changed because of these numbers. A changed version is a new version
  with its own contract.
- A candidate cell, if any, is frozen at a dated commit and run live on the desktop; only those
  forward records count as independent evidence.
