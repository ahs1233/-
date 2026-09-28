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
| **Consumers (sections 13–17)**, including the 10 alerts | Not modelled in JS. | R4 contract + tests (later round). |
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

## 7. Snapshot, hash and capture contract (R1)

- **Canonical snapshot**: `reference/snapshot.mjs` (`canonicalSnapshot`). There is no absolute `bar_index` in it. Chart-bar fields are replaced by their age relative to the snapshot bar (`sinceTest`, `sinceState`, `sinceBack`, and the tracker's `since`). `ageNative` is already relative.
- **Full equality**: `compareSnapshots` compares raw fields using the tolerances in §2, level by level (geometry ⊂ identity ⊂ state; events is a separate level).
- **Auxiliary hash** (Pine 12a ↔ `snapshot.mjs`):
  - Arithmetic: `h ← (h·1000003 + mix(x)) mod (2^31−1)` with `mix(x) = (r²·3 + r·131071 + 1) mod p`, where `r = x mod p ≥ 0`. This is verified against an independent Python implementation (S11).
  - The intermediate values stay below 2^62 in Pine's 64-bit `int`. JS uses BigInt.
  - Slot encoding:
    - Starts with tag `1`.
    - An inactive slot → `[0]`.
    - An active slot → `[1, containing, side, ticks(lo), ticks(hi), primaryKey, round(gateQ·100), round(displayQ·100), nLast, …sorted lastKeys, nEntry, …sorted entryKeys]`.
  - Level encoding:
    - Starts with `[2, nLevels]`.
    - Then, for each record sorted by key: `[key, state, polarity, ticks(lo), ticks(hi), q6(s), q6(mitigation), q6(evidence), tests, ageNative, epActive, epSide, q6(epMaxDepth), breakDir, breakCloses, breakFromFlip, backCloses, sinceTest|−1, sinceState|−1, sinceBack|−1]`.
    - Then each tracker: `[1, ticks(px), since, broken]` or `[0]`.
  - Here `q6(x) = round(x·10^6)`.
  - The field order in Pine is checked against this list by C2/C3 in `pine-contract.test.mjs`. Negative control: swapping two lines in Pine makes C2 fail.
- **Pine exports**:
  - In both modes: `v_hashSlots`, `v_hashLevels`, `v_eventBits` (engine events in bits 0–6, the ten alerts in bits 7–16).
  - With `validationMode`: `v_loR1…v_hiS2` (raw, precision 10).
  - Total plot-type outputs: 51 of 64 (checked by C5).
- **Diagnostic capture** (`captureFrom`/`captureTo`):
  - Pine prints the full snapshot as `GTGSNAP v1` lines through `log.info`.
  - `tools/compare-captures.mjs` parses one or two captures. It reports incomplete bars (the END line or the LVL count), compares field by field at the requested levels, and **recomputes the hash in JS from the captured raw fields and compares it with the hash Pine printed**. That checks the Pine hash code on real data.
  - Self-test on JS captures: `artifacts/r1-capture-tool-selftest.txt`.
- **Coverage limits**:
  - The Pine Logs pane keeps a limited number of messages. Each captured bar costs `8 + nLevels` messages, up to 68.
  - The exact retention limit and the maximum message length were **not verified**: the TradingView docs could not be reached from this environment (the egress proxy blocked them).
  - Captures are therefore meant for short ranges, and completeness is checked per bar rather than assumed.
- **Near-boundary caveat**:
  - Captured floats have 10 decimals, so a quantised field (`ticks`, `q6`, `q100`) recomputed from the text can differ from Pine's value when the exact value lies within ~5·10⁻⁵ of a rounding boundary.
  - If a Pine↔JS hash mismatch occurs while every raw field matches within tolerance, check this first. It is not proof of a hash bug.
