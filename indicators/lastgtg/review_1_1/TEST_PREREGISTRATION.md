# lastgtg A / B / C comparison on 2021–2024 — pre-registration v1.1

Frozen 2026-10-15, before any B or C row was computed on price data. Draft `2c02ac7`, revised
the same day with Astra's six points (exact parity, gaps at execution, matched baseline, longer
dependence blocks, zone snapshot before the touch, wording) as v1 `0296a62`. Not changed after
results; a change means a new dated version of this file.

**v1.1 (2026-10-15, before any result, Astra):** block lengths are measured on the data's own
calendar instead of fixed day counts (holidays and gaps make 300 bars last longer); gate 4's
export carries the higher-timeframe bars and the sensor values, not only the chart bars and the
lamp.

## What this test is, and is not
- **Development comparison, not independent evidence.** 2018-03 → 2024-03 (lab Train) was used
  to build parts of the engine and lastgtg (zone weights, pullback depth, entries); 2023-06 →
  2026-09 was used by later lab tests; 2025-01 → 2026-09 by the lastgtg 2025–2026 test. No
  historical period after 2018 is untouched. A result here selects what goes to a forward test.
- Two questions are kept apart: **Part 1** does the green light (A, B, C) earn anything after
  real costs; **Part 2** do zone scores separate better zones from worse ones.
- Every figure in Part 1 is a **per-signal R**: each signal is scored alone, overlapping signals
  included. It is not the return of a portfolio anyone could run.

## Versions
- **A** = `indicators/lastgtg/lastgtg.pine` (sha256 `320e33eb…2e1744`).
- **B**, **C** = `build/lastgtg_B_1_1.pine`, `build/lastgtg_C_1_1.pine` (hashes in `build/manifest.json`).
- The test runs on the JS port: A = `../live/zone-engine.mjs` + `../live/lamp.mjs` as live today;
  B = A with the lamp replaced by a line-for-line JS copy of `gtgLampDecision` and the
  `lamp_adapter` inputs (mapped zone ahead, room, closed-bar snapshot, episode start);
  C = B with the `c_breaking` engine change (and no strong-body acceptance).
- The indicator's logic is not changed during this work.

## Gates (all must pass before any Part 1 or Part 2 number is read)
A difference found by a gate is written down with its cause in the run log. A difference without
an explained cause fails the gate whatever its rate. Numeric tolerance: prices and distances equal
within 1 mintick (0.001); scores within 1e-6. Lamps, reason codes, directions, accepted flags,
episode starts and their bar times must be equal exactly.

1. **Pine compiles**: B and C added to a TradingView chart without error;
   `handoff/lastgtg_logic_tests.pine` shows PASS.
2. **JS decision = Pine decision**: the JS lamp function gives the same lamp and reason code as
   the Pine fragment (translated by `handoff/test_patch.py`) on all 147,456 cases; the JS C branch
   passes the same 20 break cases.
3. **Engine start (engineOn), A, B and C each**: Pine computes the sensors (moving averages, ATR,
   HTF and anchor series) from the first chart bar and starts the zone engine `engineWindow` bars
   before the last bar; the JS research run starts the engine at the first warmed bar. For 50
   green-start bars and 50 random warmed bars per timeframe and version (seed 20261015), a run
   whose sensors start at least 2,000 bars and 1,000 HTF bars before the bar and whose engine
   starts exactly `engineWindow` bars before it must give the same lamp, reason, heading, route,
   accepted flag and episode start as the continuous run. Every difference is listed with its
   cause. Differences that come from the indicator itself (memory carried by slot hysteresis or
   anchor geometry) are a property of the indicator, reported as such; if they change more than
   2% of the sampled green starts of any timeframe, the test stops, because history could not
   stand for what a live chart shows.
4. **Pine = JS on the same bars**: for each of M15, H1 and H4 and each of A, B and C, one
   TradingView OANDA:XAUUSD window is exported, and the JS port is fed exactly those data:
   - the chart-timeframe bars from the first loaded bar, and the bars of that profile's HTF, A1
     and A2 timeframes from their own first loaded bars (so the higher-timeframe series and the
     sensor warm-up can be rebuilt with the same timing);
   - the Data Window plots of a copy of the version used only for this export: the B/C closed
     snapshot plots, plus plots of the sensor and map values the lamp reads (heading and route
     scores, speed, fuel, `atrEng`, the HTF close, MA50, MA200 and ATR, the nearest zone's bounds
     and distance). The copy adds plots only; no logic is touched, and it never produces a
     result. A gets the same plots on its own copy.
   Required on every engine bar: lamp, reason code, heading, route, accepted flag and episode
   start equal; every green-episode start equal in time and direction; the sensor and map values
   equal within the tolerance above. Any unexplained difference stops the test; the port is fixed
   and the gate is run again; no outcome is read in between.

## Data and period
- v0.2.3 canonical Dukascopy XAU/USD M1 store on the desktop (`C:/Users/alk/gtg-lab-data-jforex`),
  BID and ASK per minute; bars from it with the lab's frozen calendar
  (`../history/export_history.py`, extended to write the M1 BID and ASK opens).
- Signals: closed bars opening in **[2021-10-01 00:00 UTC, 2025-01-01 00:00 UTC)**. Warm-up from
  2019-06-01; a bar counts only when the engine is warmed. Scoring may read M1 to 2025-06-30.
- Timeframes: **M15, H1 and H4 decide**. M1 and M5 are reported as diagnostics only, by this prior
  decision: their spread is large against their distance, which calls for care, not a verdict.

## Part 1 — green light
### Signal
- Green-episode start on a closed bar (B/C: `gtgGreenStart`; A: the same rule on A's lamp — a bar
  is a start when it is green and the previous bar was not green, or was green with the other
  heading). Direction = the heading at that bar. One trade per start; each is scored alone.
- A start with heading 0 (possible in A, whose break branch ignores the heading) is
  `not executable` and counted, never given a default direction.

### Entry
- The first M1 bar opening at or after the signal bar's close; a long buys at its ASK open, a
  short sells at its BID open. Nothing inside the signal bar is used.
- `not executable` (counted apart, out of every denominator) when: that M1 bar opens more than
  one signal-timeframe bar after the signal close (session break, weekend or missing data), or its
  entry-side open is missing.

### Exit
- Distance `d` = `atrEng` of the signal bar; target = entry + dir·d, stop = entry − dir·d. A long
  exits on BID, a short on ASK.
- In the entry minute only its high and low are checked. In every later minute, **its open is
  checked first**: an open at or beyond the stop exits at that open (the loss can exceed 1R); an
  open at or beyond the target exits at the target. Then its high and low: stop and target both
  touched = exit at the stop; one touched = exit at that level.
- `expired`: neither level reached by the close of the 300th signal-timeframe bar after the
  signal bar (counted on that timeframe's bars, not on wall time); exit at the last M1 close at
  or before that bar's close, on the exit side.
- `unresolved_end`: the M1 data end before the trade is resolved; counted, out of every
  denominator.

### Result, costs
- R = (exit − entry)·dir / d. Costs are inside R because entry and exit use the real BID/ASK; no
  extra spread is taken.
- **Stress (a sensitivity assumption, not a measure of commission or slippage)**: R − s_tf/d, with
  s_tf = the median entry spread of the all-heading-bars baseline trades of that timeframe; the
  same s_tf for A, B and C.

### Baselines
- **All-heading-bars baseline**: every warmed closed bar with a non-zero heading, entered with
  the heading, same entry, exit and costs.
- **Matched baseline**: for each version × timeframe, 200 draws (seed 20261015) of as many
  baseline bars as the version has executable starts, drawn within the same strata as the starts:
  direction, calendar year, session (UTC hour of the signal close: 00–07, 07–12, 12–16, 16–21,
  21–24) and volatility tercile (`atrEng` divided by the median `atrEng` of the previous 500 bars;
  tercile cut points from the warm-up bars before 2021-10-01). A stratum with fewer baseline bars
  than starts draws with replacement. No outcome is used to draw.

### Dependence
- Moving-block bootstrap over trading days (the lab's trading day: New York 17:00 to 17:00),
  circular, 10,000 resamples, seed 20261015. **Block length L_tf** = the largest number of distinct
  trading days spanned by 301 consecutive bars of that timeframe whose first bar opens in the
  signal period, computed from the feed's bar times alone (no price, no outcome) and written to
  the run log before any Part 1 result; sensitivity run with 2·L_tf. A trade belongs to its entry
  day. The same resampled days are used
  for A, B, C and both baselines, so all are compared on the same draw. For the matched baseline,
  each resample also takes one of the 200 draws at random.

### Reported per version × timeframe
Starts; not executable (by cause); target / stop / both / expired / unresolved_end; win share;
mean R; mean R stress; mean R per year (2022, 2023, 2024; 2021 Q4 shown, not judged); both
baselines' mean R; for B and C, how many A starts they drop, by reason code.

### Verdicts (M15, H1, H4 only)
- **B against A**, **C against B**: the difference in mean R with its 95% interval; `better` if
  above 0, `worse` if below 0, else `no difference shown`.
- **Candidate for the forward test** (9 cells: 3 versions × 3 timeframes), all of:
  1. at least 100 executable starts;
  2. mean R: lower edge of the 99.5% interval above 0;
  3. mean R minus the matched baseline's mean R: lower edge of the 95% interval above 0;
  4. mean R above 0 in 2022, 2023 and 2024 separately;
  5. mean R stress above 0;
  6. conditions 2 and 3 still hold with the 2·L_tf blocks.

## Part 2 — zone quality (independent of the lamp)
- **Populations**: zones in S1, S2, R1, R2 on closed M15, H1 and H4 bars. Engine A/B is one
  population (B does not change the engine); C is a second population.
- **Identity**: a zone is followed by its slot entry key; moving between R1 and R2, or leaving
  the slots and coming back, is the same zone. Each identity gives at most one touch, its first.
- **Snapshot**: the zone's bounds, strength score and `atrEng` are read on the **last closed bar
  before the touch bar** and frozen; that frozen zone is followed through the whole window even if
  it leaves the slots or its score changes.
- **Touch**: the first closed bar whose range overlaps the snapshot bounds while the previous
  close was outside them.
- **Outcome within 48 bars**: `reaction` if a close lands ≥ 1 snapshot `atrEng` from the zone on
  the side price came from before any close beyond the far edge + `breakBufK`·snapshot `atrEng`;
  `break` if that beyond-close comes first; otherwise `neither`.
- **Groups**: the strength word from the snapshot score (weak < `mediumQ` ≤ medium < `strongQ` ≤
  important), and a control of naive pivot zones (`TRADE_CONTRACT.md` P1: pivot high/low of the
  same `pivotLen`; width = the median width / `atrEng` of displayed zones on that timeframe over the
  warm-up bars 2019-06-01 → 2021-09-30, then fixed). Control zones follow the same identity,
  snapshot, touch and outcome rules.
- **Measures**: reaction share = reaction / (reaction + break), and the `neither` share of all
  touches, with the moving-block bootstrap above (Part 2 blocks: the same rule with 49
  consecutive bars per timeframe, logged before any Part 2 result; sensitivity with twice that).
- **Minimum**: 50 touches per group, timeframe and population; fewer = `inconclusive` for that
  comparison.
- **Verdict**: `scores separate zones` if, on at least two of the three timeframes, important minus
  weak and important minus control both have a 95% lower edge above 0, with the same sign in 2022,
  2023 and 2024. The lab's 2018–2024 zone-weight test (`gtg-strategy-lab/reports`) found weights
  not useful; this Part checks the strength word lastgtg actually shows.

## After the results
- Nothing in A, B or C is changed because of these numbers. A changed version is a new version
  with its own contract.
- A candidate cell, if any, is frozen at a dated commit and run live on the desktop; only those
  forward records count as independent evidence.
