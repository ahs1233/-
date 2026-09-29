# GTG Strategy Lab — TRADE_CONTRACT v0.2.1 (FROZEN)

> **Status: FROZEN — Pre-registration.**
> This file is the research protocol. It is not a strategy, and it is not a claim that GTG is profitable.
> Every value in it is fixed before any GTG event outcome has been computed.
> Any later change needs a new version (v0.3+), a stated reason, and a new freeze commit. Data before that new freeze can no longer serve as Pristine OOS for the changed parts.
> T_freeze = the timestamp of the first commit that contains this version (recorded in `FREEZE_RECORD.md`).
> **v0.2.1** changes only the data-acquisition layer (§2.2, §2.3), before any GTG event outcome was computed (messages 13–14). Its freeze commit defines **T_freeze_v0.2.1**, which replaces the v0.2 T_freeze for the Pristine OOS definition (§22).

The source of this contract is the GTG Lab dialogue (messages 1–11, GPT ↔ Claude), with methodological decisions delegated to both parties by the user. The change log is at the end (§32).

---

## 0. Research question

Do the outputs of GTG Navigator v0.4.7 carry repeatable information about the future movement of XAUUSD, beyond appropriate baselines and after costs? Or do they only organise the current state of the market well?

The aim is not to prove GTG. It is to try to reject the claim of an edge with the harshest reasonable test.

Allowed wording for the final verdict (§24). No wording stronger than the evidence may be used:
`No demonstrated edge` · `Historical edge only` · `Statistical edge but economically insufficient` · `Economically meaningful historical edge` · `Forward evidence of repeatable edge`.

---

## 1. Reference asset and Measurement Engine

### 1.1 The frozen production release
- GTG Navigator v0.4.7 — HEAD `0a77819d7a4bf29fe64a07b2233109707a10ca8b`, Pine blob `0c7cbe366668fba20c9bc128448f908ce9314041`, 116/116 (see `BASELINE_LOCK.md`).
- Forbidden: modifying it, re-tuning its thresholds, or redefining its zones, fuel, speed, flip or events.

### 1.2 GTG Measurement Engine
- A separate project inside `indicators/gtg-strategy-lab/`. Its only job is to reproduce the logic of the frozen release and export its internal state.
- **JS**: a complete implementation of geometry, identity, aggregation, state machine, events, Speed, Heading, Route, Fuel, the consumer layer (sections 13–17) and MTF logic, plus the extra fields in §6.
- **Pine "GTG Engine"**: a copy of the frozen file whose only change is exporting (Data Window / Pine Logs). It does not change the logic. It exists only for parity captures.
- The Zone Engine reuses `indicators/gtg-navigator/reference/engine.mjs` as it stands, or a verbatim copy of it. It is not rewritten. (The lab reads it from its own byte-identical copy `gtg-engine/` of the production tree at `0a77819`.)

### 1.3 Parity Gate (before any event study)
- Parity runs **only on the TradingView feed** that the production release uses (Parity Feed). Input bars (the chart and the higher timeframes as TradingView delivers them) are captured together with Pine outputs, and JS is run on the same bars.
- **Exact match required:** level/zone states, slots, `eventBits`, the ten alerts, event timestamps, bands/signs (routeSign, headingSign, tacticalSign, speedClass, fuelClass), identities (`memberKey`, `entryKeys`), `v_hashSlots`, `v_hashState`, `v_eventBits`.
- **Numeric match (frozen tolerances; precision differences only):**
  - Prices and distances: the table in `PINE_JS_PARITY.md` §2 (`abs ≤ 1e-9·|price| + 1e-6·mintick`, with ticks exact).
  - mitigation / evidence / q / gateQ / displayQ: `abs ≤ 1e-9`.
  - Sensor values: routeScore, headingScore, speedScore, instantSpeedScore, fuelScore, speedAcceleration, fuelAcceleration: `abs ≤ 1e-6`. Raw sensors in price units (MA, ATR): the price rule above.
- Any mismatch in an exact field, or outside the tolerance, **fails the gate**. Widening a tolerance because a test failed is forbidden. The Pine "GTG Engine" copy must reproduce the frozen release's `v_hashSlots`/`v_hashState`/`v_eventBits` on the same bars; otherwise the copy itself is rejected.
- After the gate passes, the same JS runs **unchanged** on the Research Feed (§2).

---

## 2. Data

### 2.1 Research Feed
- **Dukascopy XAUUSD** is the primary historical source.
- **Signal and volume series = Dukascopy BID** (F3). GTG runs on BID bars, and the Fuel volume is BID-side volume.
- **ASK is used for execution only** (§8). It is never used in signals or in Δ_info.
- The result is described explicitly as: *GTG logic evaluated on the Dukascopy XAUUSD feed*. It does not claim to match, tick for tick, what the user sees on TradingView.

### 2.2 Building bars (v0.2.1)
- **Primary source (historical and forward):** the official Dukascopy **M1 candles**, BID and ASK files per UTC day (`{BID|ASK}_candles_min_1.bi5`). M1 volume = the BID candle volume. Bar time = start of the UTC minute.
- **Sanitation:** only candles with `volume = 0 AND O = H = L = C` are excluded (no trading); the timestamp simply has no bar. A flat candle with volume is kept. No forward fill.
- **Ticks are not used to build the history.** `Full historical tick download from the Dukascopy endpoint under the current access pattern` is a **REJECTED_METHOD** (FAILURE_LOG F-002/F-003: HTTP 429 then 503 under a paced probe; ≈144k requests would be needed). It may only be reopened if the access path changes fundamentally.
- Ticks serve only the **Tick Audit** (§2.3).
- **Higher-timeframe aggregation is by UTC calendar time**, not by counting bars: M5/M15/H1 on UTC clock boundaries, H4 on 00/04/08/12/16/20 UTC, D = UTC calendar day (needed only because the Route layer on H4 requests D). Removing an empty bar never shifts a boundary.
- Sessions use the same Pine time strings and time zones (`Europe/London 0700-1600`, `America/New_York 0800-1700`, `Asia/Tokyo 0900-1700`, Mon–Fri), with daylight saving time.
- The data manifest records, per file or day: source, type (tick/M1), sha256, bar count, ASK coverage.

### 2.3 Tick Audit — validation of the official M1 candles (v0.2.1)
- **Sample: 20 UTC days, deterministic and stratified**, selected by this rule before any comparison is made:
  - 5 year buckets: the historical span (first valid day → T_freeze_v0.2.1) cut into 5 equal time ranges; in each, one calendar month drawn with `seed = 20260929` (Python `random.Random(seed)`, buckets in time order).
  - In each month, 4 day types from the official BID M1 of that month (full trading days only: ≥ 1200 M1 bars): **week-reopen** (the first trading day of the second week of the month), **high volatility** (largest BID daily range), **low volatility** (smallest BID daily range), **normal** (daily range closest to the month median; ties → earliest). A day already chosen is replaced by the next-closest day of the same type.
  - Every audit day spans Asia, London and New York.
- **Comparison:** tick-built M1 (BID OHLC from bid ticks, ASK OHLC from ask ticks, per UTC minute) against the official M1, per side, after the same sanitation:
  - **Timestamps:** the same set of minutes.
  - **OHLC:** `|Δ| ≤ one feed tick` (0.001 for XAUUSD, one Dukascopy point) on every field. This tolerance is frozen.
  - **Volume:** recorded, not required to be equal: correlation, scale ratio, missingness, zero-volume behaviour. The decision-level question is whether Fuel changes: `fuelClass`, `fuelSurge` and `fuelExhaustion` computed on M1 with the official volume vs the tick-derived volume (all else identical), on the bars of each audit day after the M1 Fuel warm-up.
- **Verdict:**
  - **PASS-A:** timestamps and OHLC within tolerance, and Fuel decisions identical. → Official M1 accepted.
  - **PASS-B:** timestamps and OHLC within tolerance; volume scale differs but Fuel decisions identical. → Accepted, with the recorded constraint *volume representation differs, event semantics stable on the audit sample*. (Fuel uses `volume / SMA(volume)`, so a constant scale factor cancels.)
  - **FAIL:** any OHLC/timestamp difference beyond tolerance, or a changed Fuel decision. → Official M1 may not be used before the cause is found.
- **If the source throttles even the 20-day sample:** record `TICK_AUDIT_BLOCKED_BY_SOURCE`. That is **not** a FAIL of the M1 data; an alternative tick source or an archived Dukascopy dataset is sought for the audit, without hammering the same endpoint.

### 2.4 Known feed constraint
- Fuel depends on volume, so `Fuel_TradingView ≠ Fuel_Dukascopy` is expected. This is feed dependence, not an engine error.
- Fuel conclusions apply to Fuel as computed from Dukascopy only.
- **Feed Sensitivity Check (exploratory):** on a common period between the Parity Feed and Dukascopy: event agreement, direction agreement, and zone/flip agreement where comparable. It is not used to choose a feed or change any threshold.

---

## 3. Decision time and endpoint

- Every decision uses closed bar t only. Everything known is known at `close(t)`. The first executable point is `open(t+1)`.
- The value of a higher timeframe X at t = the last X bar whose close time ≤ close(t). Every row stores the timestamp of the last closed X bar (§6).
- **ATR[t]** = `ta.atr(14)` on the event timeframe at t (the Pine `safeAtr`: max(atr, mintick)). It stays fixed for the event's whole life.
- **Primary endpoint (Δ_info, BID, cost-free):**
  `R_h = D × (BidClose[t+h] − BidOpen[t+1]) / ATR[t]`
- **Signal return (diagnostic only):** from `BidClose[t]`.
- **MFE/MAE:** from `BidOpen[t+1]` to the end of h, in units of ATR[t]: the largest move in the direction of D, and the largest move against it.
- **Primary horizon for H1–H5:** h = 12 bars of M5 (60 minutes = one H1 bar, the direction layer).
- **Secondary horizons for M5:** 3 / 6 / 24 / 48 bars. Other timeframes (exploratory): {1, 3, 6, 12, 24, 48} bars; minutes (15/30/60/120) for M1/M5/M15 only.
- A secondary horizon may never be promoted to primary.
- If t+h runs past the end of the data or past a split boundary (§20), the observation is censored and excluded from that horizon only.

---

## 4. Unified notation

- Direction: `+1` Bullish, `0` Neutral/Mixed, `−1` Bearish. It applies to Route, Heading, MTF, Break direction and Flip direction.
- `routeSign_X`: routeScore_X > +22 → +1; < −22 → −1; else 0 (the frozen release's thresholds).
- `headingSign_X`: headingScore_X > +20 → +1; < −20 → −1; else 0. (`tacticalSign` is not used to define episodes.)
- `headingEffLen`: M1 = 8, M5 = 10, M15 = 12, H1/H4 = 14 (the frozen release's values).
- `BREAK_WINDOW = 3`, `pivotLen` / `flipWindow` / `maxAgeLocal`: the frozen release's per-timeframe profiles.
- Speed and Fuel have no direction. Their raw values, bands (the release's thresholds), the delta from the previous bar and `speedAcceleration`/`fuelAcceleration` are stored. No new threshold is introduced.
- **Context features (recorded, not conditions in H1–H5):**
  - `trendPersistenceIncreasing` = `tacticalSign = D AND fuelAcceleration > 0`
  - `countertrendFuelDecaying` = `tacticalSign = −D AND fuelAcceleration < 0`

---

## 5. Stages

### Stage 1 — Event Edge (the subject of this contract)
The question: what does price do after the event, compared with a similar situation where the event did not appear?
Not allowed here: stop/target optimisation, position sizing, trailing, re-entry optimisation, or Profit Factor as primary evidence.

### Stage 2 — Tradable Strategy (DEFERRED)
It does not start until at least one event passes Stage 1. See §29.

---

## 6. Snapshot contract

Every event row (and every control row) stores an immutable snapshot:
timestamp (UTC), symbol, feed, timeframe, family, subtype, D, episode id, episode age;
route raw/band/sign, heading raw/band/sign, tacticalSign — on M5/M15/H1/H4 with the last-closed timestamp of each;
speedScore/instant/class/acceleration, fuelScore/class/acceleration, fuelExhaustion, noChaseUp/Dn;
R1/R2/S1/S2 (lo, hi, strength Q, state, navTag, entryKeys, primaryKey, containing, distance / ATR_eng);
event source level: memberKey, source slot, origin polarity, state before and after, breakDir, everBreaking, level age, Q at the start of the test episode;
strong obstacle, acceptance, rejection (strength), break, flip (direction);
MA relationships (ma14/22/50/200 ordering, price vs ma50/200), ATR[t], ATR_eng, session, volatility tercile, H4 regime;
v_hashSlots, v_hashState, v_eventBits.
The **new** fields exported by the Measurement Engine (they exist inside the engine but are not exported by the release): the rejection's source slot, flip direction, the `BREAKING → ACTIVE` transition, origin polarity, and `everBreaking` (the level has entered BREAKING at least once before t).

---

## 7. Covariate rule (Conditioning)

- **Every matching covariate is measured at t−1**, except episode age (§9). For Flip, covariates are measured at the start of the test episode that ended in `FLIP_CONFIRMED` (before the transition).
- Pre-treatment covariates (allowed in matching): session, volatility, H4 regime, D, episode age, level/zone age, width, role, Q before the event, speed band at t−1.
- Trigger components / mediators (**forbidden** in primary matching): Heading movement inside the trigger bar, rejection displacement inside the trigger bar, any variable produced after the event.
- **Δ_mechanical** intentionally conditions on some of these components (§13). That is why it is never primary.

---

## 8. Execution cost (C0 / C1 / C2)

Signal series = BID. Execution depends on side:

| | Entry | Exit at horizon |
|---|---|---|
| **Long** | `AskOpen[t+1] + s_entry` | `BidClose[t+h] − s_exit` |
| **Short** | `BidOpen[t+1] − s_entry` | `AskClose[t+h] + s_exit` |

- `R_net = D × (exit − entry) / ATR[t] − commission / ATR[t]`
- **slippage** per market execution = `0.5 × contemporaneous spread`, charged once on entry (spread at open t+1) and once on exit (spread at close t+h). This is a frozen **assumption**, not a fact about Dukascopy or the user's account.
- **Commission in C1 = 0**, explicitly: C1 is a Dukascopy spread benchmark, not the cost of the user's account.
- ASK is taken directly from Dukascopy. It is not rebuilt from BID + spread, unless the source lacks ASK. Any event without real ASK is marked `C1_unavailable`: it stays in Δ_info but is excluded from the economic claim, and its share is published. Real and assumed costs are never mixed.
- **C0** = no execution cost (R_h on BID).
- **C2 (Stress)** = spread ×2 and slippage ×2 on entry and exit (commission stays 0). This stress is documented, not a vague total multiplier.
- `C1_ATR(t)` is computed per event and published by session. Costs are not hidden behind one average.

---

## 9. Episodes

There is no global definition. The end of an episode may never depend on a target, win, loss or future return.

### 9.1 TC (H1, H5)
- **Start (bar s):** `headingSign_M5[s−1] = D` and `headingSign_M5[s] ≠ D`, while the family's Macro condition holds (for H1: §11.1; for H5 Single-TF: no Macro condition, D = headingSign_M5[s−1]).
- **Open:** while `headingSign_M5 ≠ D` and `age = t − s ≤ headingEffLen(M5) = 10` and the Macro condition still holds (H1).
- **Event (E4-TC):** the first t in the episode with `headingSign_M5[t] = D`. One trigger per episode by construction.
- **Censored precursor:** age exceeds 10 without a trigger, or Macro fails. It is not deleted: its bars stay controls in the risk set.

### 9.2 CE (H2)
- **Countertrend leg:** starts when `headingSign_M5` becomes `−D` while Macro (§11.2) holds. It ends when `headingSign_M5 = D` or Macro fails.
- **E1** (§10) inside the leg starts the H2 episode's **age clock** (age 0 at the E1 bar).
- **Event:** the first E2 after E1 in the same leg (age ≥ 0; E1 and E2 on the same bar is allowed).
- **Censored:** the leg ends, Macro fails, or `acceptedUp/Dn` against D appears on a level in the tested zone — all before E2.
- **Primary unit:** the first E2 per leg.
- **Secondary unit (zone layer):** (leg, zone), with errors clustered by leg.

### 9.3 Flip (H4) and zone reactions (H3)
- **Event unit = (bar, slot, entryKeys).** Several levels in one zone that transition on the same bar count as one event.
- **FLIP-1** = `BROKEN → FLIP_CONFIRMED` (the first successful retest from the new side, rej ≥ 0.5 within flipWindow).
- **FLIP-2** = the first later independent rejection while the level is `ST_FLIP` (independence is guaranteed by the engine's rule: more than pivotLen bars since the previous test). Secondary.
- Identity: `slot=<current slot> / origin=<R|S>` instead of names like S1_FLIP.

### 9.4 Episodes and family overlap
- Published: raw triggers, independent episodes, controls and effective N.
- `Jaccard(TC, CE)` on event bars is computed on development data before the Holdout. If > 0.50, H1 and H2 are merged or the distinction between them is redefined **before** the Holdout, and the Holm family is re-registered in a timestamped commit.

---

## 10. E1–E4 (frozen definitions)

Written for Short (D = −1) with a resistance zone; Long is the exact mirror (S1/S2, low ≤ zone.hi, rejectS, > +20). "Zone" = R1 or R2 slot at t (its current `entryKeys`).

| | Definition | Engine source |
|---|---|---|
| **E1 Test** | The first bar in the countertrend leg with `high ≥ zone.lo`, or `zoneDistance(zone)/ATR_eng ≤ nearObstacleAtr = 0.35` | `candleTouchesObstacle` / `zoneDistance` |
| **E2 Rejection** | `ev.rejectR` at t from a level whose `memberKey` is in the zone's entryKeys, rejection strength ≥ 0.5 | `runEpisode` + `markRejection` |
| **E3 Failed Acceptance** | A level in the zone goes `BREAKING → ACTIVE` (or `→ FLIP` if the break came from FLIP) because a close came back to the original side within `BREAK_WINDOW = 3` | `updateLevel`, the `back` branch (exported by the Measurement Engine) |
| **E4 Heading Confirmation** | `headingScore_M5` crosses below −20 (Short) / above +20 (Long) within `headingEffLen` bars after E1 (when E1 is part of the contract), or at the TC event (§9.1) | `headingSign` |

- H1 uses E4-TC. H2 uses E2 alone (no E4 requirement). E1/E3/E4 inside CE are exploratory timing variants.

---

## 11. The five confirmatory hypotheses

Common to all: primary timeframe M5 · h = 12 · endpoint R_12 on BID · Δ_info = ATT (§12) · decision per §21 and §24.

### 11.1 H1 — TC Confirmation Edge
- Macro (MTF-Route): `routeSign_H4 = routeSign_H1 = routeSign_M15 = D` at t−1.
- Event: E4-TC (§9.1) with no zone requirement. TC-B (with zone interaction) is exploratory.
- Control: a risk-set bar in another TC episode that is open at the same age a and has no trigger at that bar (§12.2).
- Matching: session × volatility × H4 regime × episode age × D.

### 11.2 H2 — CE Early Rejection Edge
- Macro: `routeSign_H4 = routeSign_H1 = D` at t−1. Countertrend leg `−D` (§9.2). E1 happened in R1/R2 (Short) or S1/S2 (Long).
- Event: E2. Fuel is **not** required (it is recorded; `CE E2 + countertrendFuelDecaying` is exploratory).
- Control: an open risk-set bar in another CE episode at the same age (counted from E1), with no E2 at that bar.
- Matching: session × volatility × H4 regime × age since E1 × D.

### 11.3 H3 — Zone Selection Edge
- Event: rejection (rej ≥ 0.5) from a level belonging to a displayed slot (R1/R2/S1/S2) at t. D = the rejection direction (fade).
- Primary comparator: **P1 naive online pivot** (§14), run through the same Reaction Engine.
- Matching: session × volatility × H4 regime × D × level age × zone width × approach context (speed band at t−1). **Episode age is not used.**

### 11.4 H4 — Flip Edge
- Event: FLIP-1.
- Comparator: a rejection (rej ≥ 0.5) from a level that is `ACTIVE` at t, has the same current role (support vs support), and has `everBreaking = false` at t (never broken **before** t; the future is not used).
- Matching (pre-flip covariates only): session × volatility × H4 regime × D × role × pre-event Q bucket (< 48 / 48–72 / ≥ 72, from Q at the start of the test episode) × level/zone age. **Episode age is not used.**

### 11.5 H5 — MTF Edge
- Base population: Single-TF TC (§9.1 with no Macro filter).
- Treatment: `headingSign_M15 = headingSign_H1 = headingSign_H4 = D` at t−1 (MTF-Heading). The Route layer is not used, to avoid double-counting.
- Δ_H5 = ATT of the aligned events against the non-aligned events from the same population.
- Matching: session × volatility × episode age × D. **H4 regime is excluded** (F2), because it is a component of the treatment.

---

## 12. Matching and estimation

### 12.1 CEM
- Coarsened Exact Matching on the strata of each hypothesis (§11). D is always an exact stratum (F1).
- **Bins:**
  - Session: Asia / London / New York by the Pine strings. An overlap goes to the later session (NY > London > Asia); a bar in no session → a fourth "Off" stratum.
  - Volatility: tercile of `ATR_M5` percentile rank over the last 500 bars at t−1 (rankLen for M5).
  - H4 regime at t−1: routeSign_H4 → Bull / Neutral / Bear.
  - Episode age: `1`, `2`, `3–4`, `5+` (up to headingEffLen). For H2, age 0 is its own bin.
  - Level/zone age, zone width: quartiles / terciles whose boundaries are computed from **Train** on the combined population (GTG + comparator), then frozen.
  - Speed band at t−1: slow / normal / fast (25 / 70).
  - Q bucket: < 48 / 48–72 / ≥ 72.
- Bins are not changed after the Holdout is opened.

### 12.2 The Risk-set (H1, H2)
- Indexed by **episode age**, not calendar time. At age a: Event = an episode that fires at a; Control = another episode alive at a with no trigger at a (even if it fires later).
- Defining a control as "never fired during the episode" is forbidden (it uses the future).
- Contamination of controls by later triggers biases Δ toward zero. It is accepted as a conservative bias and stated.

### 12.3 Weights and the estimator
- A single episode's control rows share total weight 1 (Σw = 1 per episode).
- Within stratum s: `Δ_s = mean(R_event,s) − weighted mean(R_control,s)`.
- `ATT = Σ_s (n_event,s / N_event_supported) × Δ_s`. Events in strata without controls → outside the support.

### 12.4 Common support
- `support = events with ≥ 1 control in their stratum / all events`.
- < 20% → INCONCLUSIVE (insufficient common support).
- 20% to < 80% → the conclusion applies to the matched-support population only.
- ≥ 80% → it may be read as broadly covering the observed events.
- Every rate is published.

---

## 13. Baseline ladder

| Estimand | Control | Role |
|---|---|---|
| **Δ_precursor** | Risk-set, same precursor (§12.2) | **Primary for H1/H2** |
| Δ_broad | Same timeframe, D, session, volatility, H4 regime; no precursor required | Secondary, must be published |
| Δ_mechanical | Same precursor + the quartile of directional displacement over the last headingEffLen bars / ATR at t−1 | Secondary. Direct effect beyond the price move. It is never primary. If it fails common support, that is a finding ("Heading ≈ Momentum"), not a technical failure |

For H3/H4/H5 the primary comparator is the one defined in §11.

---

## 14. Placebo and comparators (H3)

| Level | Definition | Role |
|---|---|---|
| **P0 Random** | A level at a random distance from price, with width (in ATR) and daily count matched to GTG slots. seed = hash(timestamp, TF) | Sanity check |
| **P1 Naive online pivot** | `ta.pivothigh/pivotlow(pivotLen, pivotLen)` on the event timeframe. Zone = [ph − w·ATR, ph] / [pl, pl + w·ATR], where w = median width/ATR_eng of displayed GTG zones in **Train**. No quality, no merging, no selection | **Primary for H3** |
| **P1-rejected** | P1 levels that **were not in any GTG slot up to t** (not "never appeared later") | Secondary: the value of the selection layer |
| **P2 Structural** | PDH/PDL (UTC day) and round numbers (the release's psychStep) | Structural Comparators — secondary, not a null |

- **Online:** each P1 level carries `availableFromTimestamp` = the close of the bar where the pivot was confirmed (pivot bar + pivotLen). It does not exist before that. Drawing it retroactively at the pivot's centre is forbidden.
- **Same Reaction Engine:** every P0/P1/P2 level passes through the release's `runEpisode`/`updateLevel` with the same `rejAtrK`, `breakBufK`, `mitAlpha`, pivotLen spacing and maxAgeLocal. Writing a different detector is forbidden.

---

## 15. MTF (exploratory beyond H5)
Single-TF · MTF-Route · MTF-Heading · Incremental: M5 → +M15 → +H1 → +H4, with Δ incremental reported per layer. If H1/H4 add no marginal value, that does not mean showing them in the Navigator is useless; it only means there is no evidence they add an independent edge.

---

## 16. Economic threshold δ_econ

- `δ_econ = SR_min × σ_eligible / sqrt(N_eff_year)`
- **SR_min = 0.50** (confirmatory). Sensitivity only: 0.25 and 1.00.
- `σ_eligible` = the standard deviation of R_12 (BID) across all eligible risk-set observations in **Train**, before events are separated from controls. It does not use any GTG outcome.
- `N_eff_year` = (independent episodes per year in Train) ÷ DE, where DE (design effect) = the variance of the mean under the block bootstrap ÷ the variance of the mean assuming independence, on the same population.
- δ_econ is an economic-hurdle proxy. It is not a claim that a strategy achieved Sharpe 0.5 (the real Sharpe belongs to Stage 2).
- Computed per hypothesis, from Train only.

---

## 17. Power gate

- Before the Holdout is opened, for each hypothesis, using Train only:
  - estimate variance, dependence (blocks, §18), the event rate and the expected N_eff in the Holdout (event rate × Holdout length);
  - run a block-bootstrap simulation with the same estimator, matching, Holm family and decision rule (§21), injecting a shift Δ into the event outcomes;
  - `MDE` = the smallest Δ on a 0.01·ATR grid that gives a confirmatory claim in ≥ 80% of simulations. B = 2,000 per grid point.
- The normal-approximation formula is a sanity check only.
- **Gate:** if `MDE > δ_econ` → the hypothesis is **UNDERPOWERED** before the Holdout, and its highest possible verdict is INCONCLUSIVE, whatever its p-value.
- The results (MDE, δ_econ, N_eff, block length) are recorded in a timestamped commit **before** Validation is examined, together with the forward stop rule (§26).

---

## 18. Bootstrap

- Moving/stationary **block bootstrap** that preserves episode dependence and intraday clustering. B = 10,000 for decisions. Frozen seed: `20260929`.
- **Block length (a frozen rule applied to Train):** the smallest L in {1, 2, 5, 10} trading days (the day starts 22:00 UTC) such that |ACF| of the daily mean R_12 of the eligible population (not the event−control difference) at lag L < 0.10. For H1/H4 exploratory: the same rule on {5, 10, 20} days.
- Block length is not changed because of results.

---

## 19. Multiplicity

- The confirmatory family = **H1, H2, H3, H4, H5** (5).
- One-sided p (H: Δ > 0) from the null-centred bootstrap: `p = (1 + #{Δ*−Δ̂ ≥ Δ̂}) / (B + 1)`.
- **A confirmatory claim needs both:** Holm-adjusted p < 0.05, **and** the lower bound of the 99% percentile block-bootstrap CI > 0 (Bonferroni-compatible 0.05/5).
- If they disagree → **INCONCLUSIVE**. The preferred test is never chosen.
- Everything outside the family is exploratory: other timeframes, horizons, sessions, volatility, Q, Long/Short, FLIP-2, CE E1/E3/E4, fuel/speed filters, TC-B, MA-only (H6), and every combination from the ablation.
- An interesting exploratory result becomes a hypothesis for new data. It is never a confirmatory result after the fact.

---

## 20. Historical split

- From the first valid timestamp to T_freeze. The first valid M5 timestamp = the first M5 bar where every timeframe used (M5, M15, H1, H4, and D for Route H4) has passed its warm-up: `max(engineWindow, rankLen, 200)` bars on each timeframe.
- Everything before T_freeze is **RETROSPECTIVE**.
- By time: **Train = the first 50%**, **Validation = the next 20%**, **Historical Holdout = the last 30%**.
- The Historical Holdout is **not** Pristine OOS.
- **Label embargo:** 48 M5 bars (4 hours) at each boundary for the M5 hypotheses. For an exploratory timeframe, the largest forward horizon of that analysis.
- **Feature warm-up** is read from the past across boundaries and is not deleted.
- **Excluded windows:** the days of GTG development captures documented in the repository (2024-01-05; 2026-09-27 to 2026-09-29 UTC), plus any date the user reports as the origin of the CE family before event extraction (Step 6), with a timestamped commit.
- Roles:
  - **Train:** noise, power, δ_econ, bins, block length, data diagnostics.
  - **Validation:** a protocol dry run. Confirmatory hypotheses are not modified.
  - **Holdout:** opened once, at the end.
  - The Holdout allows the phrase `Historical / Backtest Edge` only.

---

## 21. Walk-forward

- **K = 5** equal consecutive time segments inside the development period (Train + Validation = 70%).
- Every fold is published: Δ, CI, N, coverage. Also: the share of positive folds, median Δ, worst fold, and variance across folds.
- **Stability:** positive folds ≥ ceil(0.70 × 5) = 4, and it may never be used to ignore a severely negative fold (all folds are published).
- The rules are frozen before folds are aggregated.

---

## 22. Pristine OOS and Forward

- **Pristine OOS** = only data with timestamp > T_freeze_v0.2.1 (the freeze of the current version), and only if the contract is not modified.
- Recording raw forward data starts at T_freeze. It is **not analysed**.
- It is opened by **one** rule, registered in the §17 commit before any look: either an information-based stop (the target N_eff from the power design) or a calendar stop.
- Looking repeatedly, then stopping when the result looks good, is forbidden. Interim looks need an alpha-spending protocol (O'Brien-Fleming) registered in advance.
- **Transfer Test** (instruments not used in development, e.g. XAGUSD/EURUSD) = cross-market generalisation evidence only. It proves nothing about XAUUSD.

---

## 23. Ablation (retrospective, exploratory)
Base → +Route → +Heading → +Speed → +Fuel → +Zones → +Flip → +MTF → Full GTG, plus leave-one-out (Full − Fuel, Full − Zones, Full − MTF, …). The aim is the marginal value of each component, not the best combination. MA-only and "Simple trend" are mandatory comparators (not confirmatory).

---

## 24. Verdicts (per hypothesis)

| Verdict | Conditions |
|---|---|
| **INFORMATION EDGE** | §19 met on Δ_info (the lower CI bound > 0 after Holm), with no power or common-support failure |
| **ECONOMICALLY MEANINGFUL HISTORICAL EDGE** | Information Edge **and** the lower bound of the 99% CI of the event's **absolute** net return under C1 (`E[R_net,12]`) > δ_econ **and** the power gate passed **and** common support ≥ 20% **and** walk-forward stable (§21) |
| **INFORMATION EDGE BUT NOT ECONOMICALLY SUFFICIENT** | Information Edge, but the absolute net return does not exceed δ_econ |
| **NEGATIVE EDGE** | The upper bound of the 99% CI of Δ_info < 0 |
| **NO ECONOMICALLY USEFUL EDGE DETECTED** | The upper bound of the 99% CI of the absolute net return under C1 < δ_econ |
| **INCONCLUSIVE** | Insufficient power, insufficient support, a CI/Holm conflict, unstable evidence, or an insufficient sample. This does **not** mean "No Edge" |

- C0 and C2 are published alongside. Success under C0 alone does not allow the phrase Tradable Edge.
- The economic claim uses only events with real ASK (§8).

---

## 25. Abstain / Invalid observation (Stage 1)
Abstain means the event definition is not complete. The reasons are recorded and counted: required state is neutral, required zone is missing, conflicting trigger (`ABSTAIN_CONFLICT`: rejection and acceptance in opposite directions on the same bar), missing measurement, invalid MTF timestamp, event censored before the trigger, common-support failure.
A missing zone is not missing data: if the event does not need a zone, the observation stays. The rate of missing zones by regime is published.

---

## 26. Forward stop rule
Recorded in the §17 commit, before any look at data > T_freeze. Default if the power design gives no achievable N: a calendar stop at 12 months from T_freeze. Changing it after the first look is forbidden.

---

## 27. Reporting dimensions (exploratory unless pre-registered)
Raw triggers, episodes, controls, support, Long/Short, timeframe, session, volatility, regime, zone type, Q bucket, flip state, MTF state, C0/C1/C2, MFE, MAE, forward return, zone reach, time to target/invalidation.
Choosing the best cell and declaring an edge is forbidden.

---

## 28. Final Dashboard
It must answer, without cherry-picking: where GTG is strong or weak; best/worst event, timeframe and regime; where abstaining is best; which component adds value and which does not; whether MTF, Flip and Zones add information (vs placebo); whether results survive C1 and C2; whether results are historical only; whether they passed Pristine OOS. The final verdict uses the wording in §0 only.

---

## 29. Stage 2 — Trade Contract (DEFERRED — NOT USED TO PROVE EVENT EDGE)
Long/Short Entry at `open(t+1)`; Logical Invalidation (confirmed acceptance through the zone the hypothesis was built on, or the Macro contract failing) is separate from the Hard Stop (behind the structural boundary + an ATR buffer); T1/T2/T3; Time exit; Re-entry (a new trigger + a new event id + a new pullback/retest). GTG-based targets are a trade-management hypothesis, not an oracle for event edge. No stop or target is frozen before Stage 1 succeeds.

---

## 30. Anti-Loop Protocol (a binding operating rule)

- Every failure is recorded in `FAILURE_LOG.md`: Symptom · Root cause hypothesis · Evidence · Method · Result · Layer.
- Before any change after a failure, identify the layer: 1 Data · 2 Event definition · 3 Measurement/export · 4 Matching · 5 Statistics · 6 Implementation · 7 Environment.
- **The same method failing twice for the same root cause → `REJECTED_METHOD`.** No third attempt on the same path unless new evidence changes the root-cause model. The reason for rejection is recorded so no later implementer repeats it.
- A technical hypothesis that a test proves wrong is removed from the options. It is not recycled in new wording.
- Unlimited trial and error is forbidden. Several symptoms from one origin → stop partial patches and fix the origin.
- Every fix is followed by a **regression test** that proves the cause was fixed.
- An isolated syntax error or typo is not a methodological failure of the method.
- Changing the research methodology to make a test pass is forbidden. **A negative research result is not an implementation failure.**

---

## 31. Execution order
0. Branch `claude/gtg-strategy-lab-edge-f0h5ra` on top of `lab/gtg-strategy-lab-v0.1`.
1. This commit (T_freeze) + `FREEZE_RECORD.md`, then the Integrity Gate.
2. Raw forward capture (no analysis).
3. Dukascopy data layer + data integrity tests.
4. GTG Measurement Engine (JS + the Pine "GTG Engine" copy).
5. **Parity Gate** — stop and report status before any event study.
6. Event extraction + causality tests (cutting the future does not change any past event).
7. Train: σ, N_eff, blocks, bins, δ_econ, power + the forward stop rule → commit.
8. Validation + walk-forward.
9. Historical Holdout (once) → `EDGE_REPORT.md` + Dashboard.
10. Pristine OOS at the registered stop rule.

---

## 32. Change log

| Version | Source | Change |
|---|---|---|
| v0.1 | Messages 1 (GPT) and 1 (Claude) | Two initial drafts: TC / CE / Flip, general rules |
| v0.2 candidate | Message 5 (GPT) after messages 2–4 | Event study first; outcome-free episodes; directionless fuel; MTF-Route / MTF-Heading; FLIP-1/FLIP-2; comparator ladder; decision rule; OOS levels |
| v0.2 amendments | Messages 6–9 | Risk-set by episode age; covariates at t−1; placebo ladder P0/P1/P2; δ_econ from the eligible population with N_eff; H6 → exploratory; CE = E2 without E4; information decision separate from economic decision; side-aware execution; Measurement Engine JS with parity on the TradingView feed |
| **v0.2 pre-freeze fixes** | Message 10 (Claude) | **F1** D is an exact stratum in all matching, and episode age is removed from H3/H4. **F2** H4 regime is removed from H5 matching. **F3** Dukascopy BID for signal and volume; ASK for execution only |
| v0.2 clarification | Message 11 (GPT) | Level/zone age stays a pre-event covariate in H3/H4 (distinct from episode age in H1/H2/H5) |
| **v0.2 FROZEN** | Commit `e4ceb8e` | Freeze approved (message 11) |
| **v0.2.1 FROZEN** | Messages 13–14 | Data acquisition only: official Dukascopy M1 BID/ASK candles as primary source (history + forward); full tick history = REJECTED_METHOD (F-002/F-003); Tick Audit protocol with PASS-A / PASS-B / FAIL (§2.3). No change to hypotheses, thresholds, CEM, horizons, costs or decision rules. New T_freeze_v0.2.1 |
