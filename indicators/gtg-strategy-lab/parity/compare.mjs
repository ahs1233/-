// Parity Gate comparison (TRADE_CONTRACT §1.3): replay a TradingView export of the Pine
// "GTG Engine" copy in the JS Measurement Engine and compare field by field.
//
// Exact fields: v_hashSlots, v_hashState, v_eventBits, v_obsState, bands/signs.
// Numeric fields: sensor scores abs ≤ 1e-6; ATR and prices by the price rule
// (abs ≤ 1e-9·|x| + 1e-6·mintick) plus exact ticks. Tolerances are frozen; a failing
// field is reported, never re-toleranced.
import { htfBarsOf } from '../../gtg-navigator/reference/history.mjs';
import { priceTol } from '../../gtg-navigator/reference/snapshot.mjs';
import { runTimeframe } from '../engine/measure.mjs';
import { profileFor, INPUTS } from '../engine/profiles.mjs';
import { DEFAULTS, engineWindowFor } from '../engine/zone-engine.mjs';
import { zoneParams } from '../engine/profiles.mjs';

export const SCORE_TOL = 1e-6;
export const MIN_EXPORT_DECIMALS = 7;
export const EMA_SEEDS = ['first', 'sma'];

const EXACT = [
  ['v_hashSlots', (r) => r.hashes?.hashSlots],
  ['v_hashState', (r) => r.hashes?.hashState],
  ['v_eventBits', (r) => r.hashes?.eventBits],
  ['v_obsState', (r) => (r.engineOn ? r.consumer.obsState : NaN)],
];
const SCORES = [
  ['m_routeScore', (r) => r.routeScore],
  ['m_headingScore', (r) => r.headingScore],
  ['m_speedScore', (r) => r.speedScore],
  ['m_instantSpeedScore', (r) => r.instantSpeedScore],
  ['m_fuelScore', (r) => r.fuelScore],
];
const PRICES = [['m_atr', (r) => r.atr]];
const TICK_ONLY = [['MA50', (r) => r.ma50], ['MA200', (r) => r.ma200], ['MA1000', (r) => r.ma1000], ['MA14', (r) => r.ma14], ['MA22', (r) => r.ma22]];
const sign = (x, th) => (x > th ? 1 : x < -th ? -1 : 0);
const BANDS = [
  ['routeSign', 'm_routeScore', (r) => r.routeSign, (v) => sign(v, INPUTS.routeClearThreshold)],
  ['headingSign', 'm_headingScore', (r) => r.headingSign, (v) => sign(v, INPUTS.headingClearThreshold)],
];

// Builds the JS inputs from the export. Anchor bars are rebuilt from the chart bars by
// UTC time buckets, which equals the feed's own HTF bars only when every anchor
// timeframe is ≤ H1 (clock-aligned): M1 (A1 M5, A2 M15) and M5 (A1 M15, A2 H1).
export function inputsFromExport(rows, tf) {
  if (tf !== 'M1' && tf !== 'M5') throw new Error(`parity replay supports M1 and M5 (clock-aligned anchors); got ${tf}`);
  const prof = profileFor(tf);
  const bars = rows.map((r) => ({ t: r.t, o: r.open, h: r.high, l: r.low, c: r.close, v: r.m_volume }));
  const from = bars[0].t, to = bars[bars.length - 1].t;
  const htfInputs = rows.map((r) => ({ htfClose: r.m_htfClose, htfMA50: r.m_htfMA50, htfMA200: r.m_htfMA200, htfMA50Past: r.m_htfMA50Past, htfATR: r.m_htfATR }));
  return { prof, bars, htfInputs, a1Bars: htfBarsOf(bars, prof.a1Sec, from, to), a2Bars: htfBarsOf(bars, prof.a2Sec, from, to) };
}

// Pine: engineOn = bar_index >= last_bar_index − (engineWindow + studyExtraBars).
export function pineStartBar(nRows, tf, mintick, studyExtraBars) {
  const prof = profileFor(tf);
  const W = engineWindowFor(zoneParams(DEFAULTS, prof, mintick), prof.chartSec, prof.a1Sec, prof.a2Sec);
  return { start: Math.max(0, nRows - 1 - (W + studyExtraBars)), W };
}

function compareRun(rows, js, mintick) {
  const fields = new Map();
  const note = (name, i, a, b) => {
    const f = fields.get(name) ?? { compared: 0, mismatched: 0, first: null };
    f.compared++;
    if (a !== undefined) { f.mismatched++; if (!f.first) f.first = { bar: i, t: rows[i].t, pine: a, js: b }; }
    fields.set(name, f);
  };
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i], r = js[i];
    for (const [col, get] of EXACT) {
      if (!(col in p) || Number.isNaN(p[col])) continue;
      const v = get(r);
      note(col, i, v === p[col] ? undefined : p[col], v);
    }
    for (const [col, get] of SCORES) {
      if (!(col in p) || Number.isNaN(p[col])) continue;
      const v = get(r);
      note(col, i, Math.abs(v - p[col]) <= SCORE_TOL ? undefined : p[col], v);
    }
    for (const [col, get] of PRICES) {
      if (!(col in p) || Number.isNaN(p[col])) continue;
      const v = get(r);
      const ok = Math.abs(v - p[col]) <= Math.max(priceTol(v, mintick), priceTol(p[col], mintick)) && Math.round(v / mintick) === Math.round(p[col] / mintick);
      note(col, i, ok ? undefined : p[col], v);
    }
    for (const [col, get] of TICK_ONLY) {
      if (!(col in p) || Number.isNaN(p[col])) continue;
      const v = get(r);
      note(`${col}(ticks)`, i, Math.round(v / mintick) === Math.round(p[col] / mintick) ? undefined : p[col], v);
    }
    for (const [name, col, get, fromPine] of BANDS) {
      if (!(col in p) || Number.isNaN(p[col])) continue;
      const a = fromPine(p[col]), b = get(r);
      note(name, i, a === b ? undefined : a, b);
    }
  }
  const out = Object.fromEntries(fields);
  const mismatched = Object.values(out).reduce((s, f) => s + f.mismatched, 0);
  return { fields: out, mismatched };
}

export function compareExport(parsed, { tf, mintick, studyExtraBars = 0 }) {
  const { rows, decimals } = parsed;
  const lowPrecision = SCORES.map(([c]) => c).filter((c) => decimals.has(c) && decimals.get(c) < MIN_EXPORT_DECIMALS);
  const inp = inputsFromExport(rows, tf);
  const { start, W } = pineStartBar(rows.length, tf, mintick, studyExtraBars);
  const hasEngineCols = rows.some((r) => Number.isFinite(r.v_hashSlots));
  const pineFirstEngineRow = rows.findIndex((r) => Number.isFinite(r.v_hashSlots));
  const runs = {};
  for (const seed of EMA_SEEDS) {
    const js = runTimeframe({ tf, mintick, bars: inp.bars, htfInputs: inp.htfInputs, a1Bars: inp.a1Bars, a2Bars: inp.a2Bars, startBar: start, emaSeed: seed }).rows;
    runs[seed] = compareRun(rows, js, mintick);
  }
  const passing = EMA_SEEDS.filter((s) => runs[s].mismatched === 0 && Object.keys(runs[s].fields).length > 0);
  let verdict = passing.length === 1 ? 'PASS' : passing.length > 1 ? 'PASS_SEED_UNDECIDED' : 'FAIL';
  if (!hasEngineCols) verdict = 'FAIL_NO_ENGINE_COLUMNS';
  if (lowPrecision.length) verdict = 'FAIL_EXPORT_PRECISION';
  if (hasEngineCols && pineFirstEngineRow !== start) verdict = verdict.startsWith('FAIL') ? verdict : 'FAIL_ENGINE_START';
  return {
    verdict, emaSeed: passing[0] ?? null, tf, mintick, bars: rows.length, W, jsStartBar: start, pineFirstEngineRow,
    lowPrecision, runs,
  };
}

// The Pine copy must reproduce the frozen release's own exports on the same bars.
export function compareCopyToFrozen(copyParsed, frozenParsed) {
  const cols = ['v_hashSlots', 'v_hashState', 'v_eventBits', 'v_obsState'];
  const byT = new Map(frozenParsed.rows.map((r) => [r.t, r]));
  let shared = 0, compared = 0, mismatched = 0, first = null;
  for (const c of copyParsed.rows) {
    const f = byT.get(c.t);
    if (!f) continue;
    shared++;
    for (const col of cols) {
      const a = f[col], b = c[col];
      if (Number.isNaN(a) && Number.isNaN(b)) continue;
      compared++;
      if (a !== b) { mismatched++; if (!first) first = { t: c.t, col, frozen: a, copy: b }; }
    }
  }
  return { verdict: shared > 0 && compared > 0 && mismatched === 0 ? 'PASS' : 'FAIL', shared, compared, mismatched, first };
}
