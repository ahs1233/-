# PINE_JS_PARITY — Zone Engine (sections 8–12)

**What this document states.** For each formula of the Pine engine: where it is in Pine, where it is in the JS reference, how the match was established, and what gap remains.
**What the reference proves.** The reference proves the algorithm. It does not prove that Pine runs it. A row whose status is `CODE_READ` has been matched by reading the source plus a JS test. It becomes `PINE_VERIFIED` only after a row-by-row comparison with a real Pine export. No row has that status yet.

Line numbers refer to `gtg_navigator_v0.4.7.pine` at baseline `cdf1a8a`.

## 1. Symbol metadata contract (R2)

- The reference takes the symbol's tick through `withSymbol(P, { mintick })`. There is **no default**. Any formula that Pine floors with `syminfo.mintick` throws `symbol metadata missing: mintick` if the tick is absent (test P5).
- Floors, per the Pine code:

| Quantity | Pine | JS (after the fix) | Test |
|---|---|---|---|
| Episode width | `max(hi − lo, mintick)` (864) | `runEpisode`: `max(hi − lo, requireMintick(P))` | P1, P2, P6 |
| `atrEng` | `max(nz(sma(tr(true), 20), tr(true)), mintick)` (532) | `computeSeries`: same, per bar | P3 |
| `atrA1`/`atrA2` | `na ? na : max(raw, mintick)` (571–572) | `Engine.step`: `floorTickOrNull` on the feed values | P4 |
| Swing `sAtr` | `max(nz(atrEng[pivotLen], atrEng), mintick)` (1154, 1162) | `max(atrEng[p], mintick)` | code read (`atrEng` is already floored) |
| Invariant tolerance | `abs(close)·1e-9 + mintick·1e-6` (1466) for I2/I3/I5 | `buildZones` → `checkBuilderInvariants(…, tol)` | T2 (invariants hold) |

- **Unit-level functions** (`buildZones`, `selectSlots`, `sameEvent`) take `ctx.atr`/`ctx.atrA1`/`ctx.atrA2` as they are given. It is up to the caller to supply values that are already floored, the way `Engine.step` does.

## 2. Tolerances for comparing Pine ↔ JS

| Field | Tolerance | Reason |
|---|---|---|
| Prices (lo, hi, dist) | Raw: `abs ≤ 1e-9·|price| + 1e-6·mintick`. Separately, ticks must match exactly: `round(x/mintick)` | Same as the Pine invariant tolerance. Both comparisons are reported; neither hides the other. |
| mitigation, evidence, q, gateQ, displayQ | `abs ≤ 1e-9` | These are sums and products of a few operations in double precision. |
| Keys (`memberKey`) | Exact equality of integers | Pine `int` is 64-bit. In JS, `memberKeyOf` rejects any key outside `Number.isSafeInteger`. |
| States, counters, flags, events | Exact equality | Integers or booleans. |

## 3. Policies

- **Rounding.** The engine itself never rounds prices. Rounding appears only in normalisation for comparison and hashing: Pine `math.round`, JS `Math.round`. The two agree for non-negative values (ties round up). Negative values are not expected in these fields; behaviour for them is `NOT_VERIFIED`.
- **Epsilon.** There are no epsilons inside the engine's decisions. The only fixed epsilon is the invariant tolerance above. The earlier `1e-12` values in JS have been removed.
- **na ↔ null:**
  - `lastTestChartBar`: `nz(x, bi − pivotLen − 1)` ↔ `x ?? bi − pivotLen − 1`.
  - `backStartChartBar`: `nz(x, bi)` ↔ `x ?? bi`.
  - HTF feed values are na ↔ `null`, and anchor upserts skip them.
  - `atrA*` stays na and is not floored (P4).
  - `prevClose`: `nz(close[1], close)` ↔ `i > 0 ? bars[i−1].c : b.c`.
- **Warm-up:**
  - `atrEng` for the first 19 bars is `tr` (`nz`) in both.
  - The engine runs on the last `W` bars in Pine (`engineOn`) and from `startBar` in JS.
  - Swings are computed over all bars in both (`ta.pivothigh` / `computeSeries`).
  - The ring buffer starts empty at the first engine bar in both.

## 4. Formulas

| # | Formula | Pine | JS | Status |
|---|---|---|---|---|
| F1 | `memberKey = birthTime·32 + disc` | 769 | `memberKeyOf` | CODE_READ + T0 |
| F2 | levelQuality / stateMult | 790–796 | `levelQuality` | CODE_READ + T6 |
| F3 | `precedes` (total order) | 800–801 | `precedes` | CODE_READ + T1 |
| F4 | runEpisode (width, depth, rej, mitigation) | 863–877 | `runEpisode` | CODE_READ + P1/P2 (**fixed in this round**) |
| F5 | updateLevel transitions | 908–972 | `updateLevel` | CODE_READ. A test for every transition is **missing** (listed under item [6] for a later round). |
| F6 | Anchor sync/upsert + width | 995–1044 | `syncAnchorPool`/`upsertAnchor` | CODE_READ + T8 |
| F7 | DOZ build | 1050–1087 | `dozBuild` | CODE_READ; exercised in T7 (`dozSeen > 0`) |
| F8 | Swing admission (width, departure) | 1153–1168 | `Engine.step` | CODE_READ |
| F9 | Components + packing | 1228–1286, 1395–1415 | `buildZones`/`packComponent` | CODE_READ + T1/T2 |
| F10 | sameEvent / MTF groups / gateQ | 1291–1360 | `sameEvent`/`aggregateZone` | CODE_READ + T3 |
| F11 | displayQ = gateQ + MA/psych confluence | 1453–1457 | JS: `displayQ = gateQ` | **GAP**: the reference does not model the MA/psych confluence (display only). |
| F12 | R*, R_eff, eligibility, containing, nearest-first | 1503–1668 | `selectSlots` | CODE_READ + T4/T5/T9 |
| F13 | entryKeys/lastKeys | 1670–1720 | `selectSlots` (`next`) | CODE_READ + T5/T9 |

## 5. Open gaps (not hidden)

| Gap | Effect | What closes it |
|---|---|---|
| **Pivot ties.** The JS rule for `ta.pivothigh/pivotlow` is left strict (`>`), right non-strict (`>=`). The rule Pine uses is not documented. | If Pine uses a different rule, swing and anchor keys differ whenever highs or lows are equal. | Run `tools/pivot_tie_probe.pine` in TradingView: the variant with 0 mismatches and ties > 0 is Pine's rule. **NOT_RUN.** |
| **HTF confirmation times.** Pine uses `request.security(…, expr[1], lookahead_on)`, so the closed HTF bar is available from the first chart bar of the next HTF bar. JS takes a ready-made `anchorFeed`; the test `htfFeedFactory` builds it with the same assumption. | The assumption itself has never been compared with Pine. Sessions and gaps make HTF bars irregular, while the test builder uses a fixed factor. | R5: a feed builder from independent timestamps, then comparison with a real Pine export. **NOT_RUN.** |
| **Timeframe profile.** JS `DEFAULTS` reflects only the M1 profile (`pivotLen 3`, `maxAge [720,96,64]`, `flipWindow 60`). Pine chooses per `profClass` (505–511). | Parity is claimed for M1 only. | Pass the profile explicitly per test (later round). |
| **Consumers (sections 13–17)**, including the 10 alerts | Not modelled in JS, apart from `reference/consumers.mjs`: a verbatim transcription of speedClass, speedColor, speedBurst, headingSign/Text and routeSign/Text, pinned by C11 (R3b). | R4 contract + tests (later round). |
| **Row-by-row comparison with a real Pine export** | None yet. | S2 files + the capture format (R1). **NOT_RUN.** |

## 6. Impact of the R2 fix on existing behaviour

`tools/impact-compare.mjs` compares the baseline engine with the fixed one on the same synthetic bars (`artifacts/r2-impact-synthetic.txt`):

| Case | Bars with a different map |
|---|---|
| seed 21, mintick 0.01 | 0 / 8000 |
| seed 21, mintick 0.1 | 0 / 8000 |
| seed 7, mintick 1 (tick comparable to ATR ≈ 1) | 1169 / 8000 |

The fix only changes results when the tick is comparable to zone width or ATR, which is exactly the case it targets.

The synthetic data is not on the tick grid. That makes the mintick 1 case a stress test, not a realistic market.

## 7. Snapshot, hash and capture contract (R1, revised after review message 45)

### 7.1 What each level contains

| Level | Content |
|---|---|
| geometry | per slot: `active`, `side`, `containing`, `lo`, `hi` |
| identity | geometry + `primaryKey`, sorted `lastKeys`, sorted `entryKeys`, `gateQ`, `displayQ` |
| state | identity + every pool record (local, A1, A2, tombstones included), each with **source identity** (`source`, `tfRank`, `typ`, `birthTime`, `price`) and its state fields; the DOZ swing trackers; the **OHLC ring** (index = age, 0 = newest) |
| events | the 7 engine events (Pine: plus the 10 alert conditions in `alertBits`) |

**Persistent-variable inventory** (Pine `var` state that a later engine decision reads) and its coverage:

| Variable | Read by | In `state`? |
|---|---|---|
| `localPool`, `anchorPoolA1/A2` (all `Level` fields) | every phase | yes, except `birthNativeBar` (absolute index; `ageNative` is its relative form) and `birthAtr` (written at admission, never read afterwards: `grep birthAtr` finds only the type field and the `Level.new` calls) |
| slot `entryKeys` / `lastKeys` | privilege (`zonePrivSlot`), event filter (`keyInPrevSlots`) | yes (identity) |
| `SlotState` scalars | consumers, HUD, drawing | `active/containing/side/lo/hi/primaryKey/gateQ/quality` yes; `distAtr/isFar/leftTime/roleType/navTag/shortTag` are recomputed from the zone on every write and not read by the engine; `side/quality` of an inactive slot are stale values nothing reads |
| `lastSwingHigh/Low Px/Bar/Broken` | DOZ trigger | yes (trackers, bar as relative age) |
| `ringO/H/L/C` | `dozBuild`, `containEntrySide` | yes (ring) |
| `feedKeysA1/A2`, `work`, `srt`, `zonePool`, scratch arrays | — | rebuilt from scratch on every engine bar; not state |
| `tel.*` | nothing in the engine | not state |

Input-derived series (`ta.pivothigh`, `ta.sma`, the HTF `request.security` feed) are functions of the bars, not engine state. Their equality is what the conditions of a determinism claim (same OHLC, same feed, same settings, sufficient warm-up) require.

`memberKey = birthTime·32 + src·6 + tfRank·2 + typ` is injective within its contract (T0). The state level nevertheless compares `source`, `tfRank`, `typ`, `birthTime` and `price` explicitly, so a wrong key encoding cannot hide a different identity (S15).

### 7.2 Comparison rules

- `compareSnapshots` groups records by key. Every one of these is reported, and none is resolved through a map lookup:
  - a different record count (`levels.length`);
  - a key present on one side only (`missing`);
  - a key present a different number of times (`multiplicity`, S12).
- A repeated key is itself a critical invariant violation (`DUP_KEY`). The comparison must never hide it.
- Prices use the tolerance in §2, and ticks are compared separately. The ring uses the same price rules.

### 7.3 Auxiliary hash (Pine 12a ↔ `snapshot.mjs`)

- **Arithmetic.** For each input `x`, with `p = 2^31 − 1`:
  - `r = x mod p`, kept ≥ 0;
  - `mix(x) = (r²·3 + r·131071 + 1) mod p`;
  - `h ← (h·1000003 + mix(x)) mod p`.
  - This was checked against an independent Python implementation (S11). Every intermediate value stays below 2^62.
- **`hashSlots`** (identity level) encodes:
  - the tag `1`;
  - for an inactive slot: `[0]`;
  - for an active slot: `[1, containing, side, ticks(lo), ticks(hi), primaryKey, round(gateQ·100), round(displayQ·100), nLast, …sorted lastKeys, nEntry, …sorted entryKeys]`.
- **`hashState`** (state level; `v_hashState`, formerly `v_hashLevels`) encodes:
  - the prefix `[2, nLevels]`;
  - then, for each record sorted by key: `[key, source, tfRank, typ, birthTime, ticks(price), state, polarity, ticks(lo), ticks(hi), q6(s), q6(mitigation), q6(evidence), tests, ageNative, epActive, epSide, q6(epMaxDepth), breakDir, breakCloses, breakFromFlip, backCloses, sinceTest|−1, sinceState|−1, sinceBack|−1]`;
  - then each tracker: `[1, ticks(px), since, broken]` or `[0]`;
  - then `[ringSize, ticks(o), ticks(h), ticks(l), ticks(c), …]` in age order.
- **Negative controls** on the Pine field order: C2, C3, C8 and C9 in `pine-contract.test.mjs`. Swapping two lines makes C2 fail.
- **Limitation.** If a key were repeated, Pine's `array.sort_indices` gives no order among the equal keys, so the hash could vary. The raw comparison reports the multiplicity regardless (S12).

### 7.4 Pine exports and capture

- **Data Window exports:**
  - both modes: `v_hashSlots`, `v_hashState`, `v_eventBits` (engine events in bits 0–6, the 10 alerts in bits 7–16);
  - with `validationMode`: `v_loR1…v_hiS2` (raw, precision 10);
  - plot-type outputs: 51 of 64 (C5).
- **Log capture.** `captureFrom`/`captureTo` prints `GTGSNAP v2` lines through `log.info`:
  - `META`, 4 × `SLOT`, one `LVL` line per record (with the identity fields), `TRK`, `RING` (16 bars per line), `EV`, `END`;
  - one bar costs `8 + nLevels + ceil(ring/16)` messages, at most about 72;
  - `v1` captures are rejected by the parser.
- **Coverage.** Pine Logs keeps at most **10,000 historical messages per script**. GPT reported this from the official TradingView *Debugging → Pine Logs* page (message 45). Claude could not open that page from this environment.
  - A capture is therefore a **short-window, targeted** diagnostic: about 20 closed bars, far below the limit. It is not a substitute for the long-range CSV/S2 export.
- **`tools/compare-captures.mjs`** fails (exit 1) on:
  - an **INCOMPLETE BAR**: a line of a captured bar is missing or duplicated, or the LVL or RING count differs from the declared one;
  - a **MISSING BAR**: an expected bar with no line at all. This is checked with `--expect-times <file>`, or with `--expect-from/--expect-to/--step-ms` for 24/7 symbols;
  - an **UNEXPECTED BAR**;
  - two files whose bar sets differ (`ONLY_A`/`ONLY_B`), unless the explicit opt-in `--intersection-ok` is given;
  - any field difference or alert-bit difference;
  - a Pine hash that differs from the JS hash computed from the same captured fields.
  - Negative controls: S14 and `artifacts/r1b-capture-tool-selftest.txt`.
- **Near-boundary caveat.** Captured floats have 10 decimals. A quantised field recomputed from the text can differ from Pine's value when the exact value lies within about 5·10⁻⁵ of a rounding boundary. If every raw field matches but the hashes do not, check this first.
- **TradingView acceptance (G1/E20)** must confirm that large keys such as `54405343360000` print in full through `str.tostring(x, "#")`, with no scientific notation and no separators.

### 7.5 Cost (G2 requirement, not measured)

- The hashes are computed on every engine bar in both modes, so that on/off comparisons stay possible. Per bar that is about (levels × 25) + (ring × 4) + slot keys hash steps, plus a sort of at most about 60 keys.
- The logic is read-only with respect to the engine. **Its runtime cost is NOT measured.**
- G2 must compare `cdf1a8a` with this version on the same symbol, timeframe and data. If the cost is material, the capture and hash path is moved behind a diagnostic switch in a way that keeps the on/off comparison valid (to be proposed, not assumed).
