// Parity Gate comparison (TRADE_CONTRACT §1.3): replay a TradingView export of the Pine
// "GTG Engine" copy in the JS Measurement Engine and compare field by field.
//
// Exact fields: v_hashSlots, v_hashState, v_eventBits, v_obsState, bands/signs.
// Numeric fields: sensor scores abs ≤ 1e-6; ATR and prices by the price rule
// (abs ≤ 1e-9·|x| + 1e-6·mintick) plus exact ticks. Tolerances are frozen; a failing
// field is reported, never re-toleranced.
import { htfBarsOf } from '../gtg-engine/reference/history.mjs';
import { priceTol } from '../gtg-engine/reference/snapshot.mjs';
import { runTimeframe } from '../engine/measure.mjs';
import { containingIndex } from '../engine/pinecmp/sensors.mjs';
import { maOf } from '../engine/pine-ta.mjs';
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
// Route HTF values (request.security, lookahead_on, [1]/[6]). Compared only when JS computes
// them from the feed's own HTF bars (feed mode); in export mode they are the JS inputs.
const HTF_PRICES = [
  ['m_htfClose', (r) => r.htfClose], ['m_htfMA50', (r) => r.htfMA50], ['m_htfMA200', (r) => r.htfMA200],
  ['m_htfMA50Past', (r) => r.htfMA50Past], ['m_htfATR', (r) => r.htfATR],
];
const TICK_ONLY = [['MA50', (r) => r.ma50], ['MA200', (r) => r.ma200], ['MA1000', (r) => r.ma1000], ['MA14', (r) => r.ma14], ['MA22', (r) => r.ma22]];
const sign = (x, th) => (x > th ? 1 : x < -th ? -1 : 0);
const BANDS = [
  ['routeSign', 'm_routeScore', (r) => r.routeSign, (v) => sign(v, INPUTS.routeClearThreshold)],
  ['headingSign', 'm_headingScore', (r) => r.headingSign, (v) => sign(v, INPUTS.headingClearThreshold)],
];

// Pine timeframe string of a profile's HTF / anchor → the feed file key (TradingView resolution).
export const RES_OF = Object.freeze({ M1: '1', M5: '5', M15: '15', H1: '60', H4: '240', D: '1D', 1: '1', 5: '5', 15: '15', 60: '60', 240: '240', W: '1W' });
export const feedKeysFor = (tf) => { const p = profileFor(tf); return { htf: RES_OF[p.htfTf], a1: RES_OF[p.a1Tf], a2: RES_OF[p.a2Tf] }; };

// tv_bars.mjs dump { resolution, bars: [[t_sec, o, h, l, c, v], ...] } → feed bars (t in ms).
export function feedFromTvBars(dump) {
  const out = dump.bars.map(([t, o, h, l, c, v]) => ({ t: t * 1000, o, h, l, c, v }));
  for (let i = 1; i < out.length; i++) if (!(out[i].t > out[i - 1].t)) throw new Error(`${dump.resolution}: bars not strictly time-ordered at ${i}`);
  return out;
}

// TradingView computes request.security on an HTF history that starts where the platform
// chose to load it, not at the first HTF bar of the feed; a seeded MA (EMA 200) carries
// that start for hundreds of HTF bars (F-009). The start is a platform fact, recovered here
// as the unique HTF bar s whose MA seeded at s reproduces the exported column on every row.
// Full history is used when it already reproduces it (converged).
export function inferHtfStart(rows, htfBars, mintick, { col = 'm_htfMA200', len = 200, back = 4000, maType = INPUTS.maType } = {}) {
  const k = containingIndex(rows.map((r) => ({ t: r.t })), htfBars);
  const k0 = k.find((x) => x >= 0);
  const closes = htfBars.map((b) => b.c);
  const badFor = (s) => {
    const m = maOf(maType, closes.slice(s), len, 'sma');
    let bad = 0, cmp = 0;
    for (let i = 0; i < rows.length; i++) {
      const j = k[i] - 1 - s, p = rows[i][col];
      if (j < 0 || !Number.isFinite(p)) continue;
      cmp++;
      if (!(Math.abs(m[j] - p) <= Math.max(priceTol(m[j], mintick), priceTol(p, mintick)))) bad++;
    }
    return { bad, cmp };
  };
  const full = badFor(0);
  if (full.cmp > 0 && full.bad === 0) return { start: 0, t: htfBars[0].t, basis: 'full-history', compared: full.cmp };
  const zero = [];
  let nextBest = Infinity;
  for (let s = Math.max(0, k0 - back); s <= k0; s++) {
    const r = badFor(s);
    if (r.cmp > 0 && r.bad === 0) zero.push(s); else nextBest = Math.min(nextBest, r.bad);
  }
  if (zero.length !== 1) return { start: null, basis: zero.length ? 'ambiguous' : 'none', candidates: zero.length, fullHistoryBad: full.bad };
  return { start: zero[0], t: htfBars[zero[0]].t, basis: 'unique', compared: full.cmp, nextBestBad: nextBest, fullHistoryBad: full.bad };
}

// Builds the JS inputs from the export.
// Export mode (feed = null): route HTF values are taken from the export, and anchor bars
// are rebuilt from the chart bars by UTC time buckets, which equals the feed's own HTF bars
// only when every anchor timeframe is ≤ H1 (clock-aligned): M1 (A1 M5, A2 M15) and M5
// (A1 M15, A2 H1).
// Feed mode (feed = { [resolution]: bars }): the route HTF and both anchors come from the
// feed's own bars of those timeframes (t = open time, ms), and JS computes every HTF value
// itself; this is the MTF parity (message 18). Any timeframe M1..H4.
export function inputsFromExport(rows, tf, feed = null, mintick = 0.001) {
  const prof = profileFor(tf);
  const bars = rows.map((r) => ({ t: r.t, o: r.open, h: r.high, l: r.low, c: r.close, v: r.m_volume }));
  if (feed) {
    const k = feedKeysFor(tf);
    for (const [role, res] of Object.entries(k)) if (!feed[res]) throw new Error(`feed mode: no bars for ${role} (${res})`);
    const htfStart = inferHtfStart(rows, feed[k.htf], mintick);
    const htfBars = htfStart.start == null ? feed[k.htf] : feed[k.htf].slice(htfStart.start);
    return { prof, bars, htfInputs: null, htfBars, htfStart, a1Bars: feed[k.a1], a2Bars: feed[k.a2], mode: 'feed' };
  }
  if (tf !== 'M1' && tf !== 'M5') throw new Error(`parity replay supports M1 and M5 (clock-aligned anchors); got ${tf}`);
  const from = bars[0].t, to = bars[bars.length - 1].t;
  const htfInputs = rows.map((r) => ({ htfClose: r.m_htfClose, htfMA50: r.m_htfMA50, htfMA200: r.m_htfMA200, htfMA50Past: r.m_htfMA50Past, htfATR: r.m_htfATR }));
  return { prof, bars, htfInputs, htfBars: [], a1Bars: htfBarsOf(bars, prof.a1Sec, from, to), a2Bars: htfBarsOf(bars, prof.a2Sec, from, to), mode: 'export' };
}

// Pine: engineOn = bar_index >= last_bar_index − (engineWindow + studyExtraBars).
export function pineStartBar(nRows, tf, mintick, studyExtraBars) {
  const prof = profileFor(tf);
  const W = engineWindowFor(zoneParams(DEFAULTS, prof, mintick), prof.chartSec, prof.a1Sec, prof.a2Sec);
  return { start: Math.max(0, nRows - 1 - (W + studyExtraBars)), W };
}

function compareRun(rows, js, mintick, feedMode = false) {
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
    for (const [col, get] of feedMode ? [...PRICES, ...HTF_PRICES] : PRICES) {
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

export function compareExport(parsed, { tf, mintick, studyExtraBars = 0, feed = null }) {
  const { rows, decimals } = parsed;
  const lowPrecision = SCORES.map(([c]) => c).filter((c) => decimals.has(c) && decimals.get(c) < MIN_EXPORT_DECIMALS);
  const inp = inputsFromExport(rows, tf, feed, mintick);
  const { start, W } = pineStartBar(rows.length, tf, mintick, studyExtraBars);
  const hasEngineCols = rows.some((r) => Number.isFinite(r.v_hashSlots));
  const pineFirstEngineRow = rows.findIndex((r) => Number.isFinite(r.v_hashSlots));
  const runs = {};
  for (const seed of EMA_SEEDS) {
    const js = runTimeframe({ tf, mintick, bars: inp.bars, htfBars: inp.htfBars, htfInputs: inp.htfInputs, a1Bars: inp.a1Bars, a2Bars: inp.a2Bars, startBar: start, emaSeed: seed }).rows;
    runs[seed] = compareRun(rows, js, mintick, inp.mode === 'feed');
  }
  const passing = EMA_SEEDS.filter((s) => runs[s].mismatched === 0 && Object.keys(runs[s].fields).length > 0);
  let verdict = passing.length === 1 ? 'PASS' : passing.length > 1 ? 'PASS_SEED_UNDECIDED' : 'FAIL';
  if (!hasEngineCols) verdict = 'FAIL_NO_ENGINE_COLUMNS';
  if (lowPrecision.length) verdict = 'FAIL_EXPORT_PRECISION';
  if (hasEngineCols && pineFirstEngineRow !== start) verdict = verdict.startsWith('FAIL') ? verdict : 'FAIL_ENGINE_START';
  return {
    verdict, emaSeed: passing[0] ?? null, tf, mintick, mode: inp.mode, htfStart: inp.htfStart ?? null, bars: rows.length, W, jsStartBar: start, pineFirstEngineRow,
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
