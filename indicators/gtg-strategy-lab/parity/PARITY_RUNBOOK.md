# Parity Gate — TradingView capture steps (TRADE_CONTRACT §1.3)

**Goal:** prove that the JS Measurement Engine reproduces GTG exactly as TradingView runs it. We capture one TradingView export, replay the same bars in JS, and compare field by field. No historical research starts before this gate passes.

**Required cells:** XAUUSD on **M5** (primary) and on **M1**.
Only these two frames can be replayed exactly. Their anchor frames (M5/M15/H1) are aligned to the hour, so JS can rebuild them from the chart bars. The frames' constants are verified separately against the frozen Pine text (tests PF1–PF4).

---

## Steps (for each frame: M5, then M1)

1. **Symbol:** use the same XAUUSD symbol you use in production (for example `OANDA:XAUUSD`). Write down its exact name; it goes into the report.
2. **Time:** capture while the market is closed (the weekend) if possible, so every bar is confirmed. If you capture during the week, the tool ignores the last unconfirmed bar automatically.
3. **Add the copy:** Pine Editor → New → paste the full contents of `indicators/gtg-strategy-lab/engine/gtg_engine_v0.4.7_measure.pine` → Save it under a new name (`GTG Engine m`) → Add to chart.
   **Do not overwrite the production script "GTG v0.4.7".**
4. **Settings for GTG Engine m** (Inputs, DEBUG group):
   - `validationMode` = on
   - `studyExtraBars` = **2000** (write the number down; it goes into the report)
   - Group General: turn on `MA14 / MA22` (for comparing the moving averages). The other settings stay at their defaults.
5. **Export the copy:** chart menu (⋯ or the arrow next to the chart name) → **Export chart data…** → Time format: **UNIX timestamp** → Export.
   Rename the file to `engine_M5.csv` (or `engine_M1.csv`).
6. **Export the production release for comparison** (on the same chart, without changing the symbol or frame and without reloading):
   - Remove GTG Engine m from the chart.
   - Add the production script **GTG v0.4.7**.
   - Set `validationMode` = on and `studyExtraBars` = the same number (2000).
   - Export chart data again → rename the file to `frozen_M5.csv`.
7. **Deliver the files:** upload the four CSV files (engine/frozen × M5/M1) into this conversation, or into the folder `indicators/gtg-strategy-lab/parity/captures/` on the branch.

---

## What I will run afterwards

```bash
node indicators/gtg-strategy-lab/parity/compare-tv-export.mjs \
  --csv captures/engine_M5.csv --frozen captures/frozen_M5.csv \
  --tf M5 --mintick 0.01 --extra 2000 --out captures/report_M5.json
```

**The gate passes only when both of the following hold:**
- **replay = PASS:** exact match of v_hashSlots / v_hashState / v_eventBits / v_obsState, the signs (Route/Heading) and moving-average ticks; the scores (Route, Heading, Speed, Instant Speed, Fuel) within 1e-6; ATR by the price rule.
- **copy vs frozen = PASS:** the measurement copy gives exactly the same hashes as the production release on the same bars.

**Other results and what they mean:**
- `FAIL_EXPORT_PRECISION`: the export truncated the decimals. This is an export-layer problem, not a logic problem. It goes into FAILURE_LOG (layer 3) and needs a different capture method. The tolerance is never widened.
- `FAIL_ENGINE_START`: the `studyExtraBars` value passed to the tool does not match the one used in the capture.
- `PASS_SEED_UNDECIDED`: the data could not tell apart the two hypotheses for the EMA seed. A longer capture is needed.

**Two open questions only the capture can settle (they are not tuning):**
- the initial value of `ta.ema` (the first value, or an SMA);
- how `ta.percentrank` handles na at the start of the series.

The tool tests both hypotheses and reports which one matches exactly. If neither matches: **FAIL**, and it is logged in FAILURE_LOG.
