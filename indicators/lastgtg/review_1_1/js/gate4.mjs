// Gate 4 of ../TEST_PREREGISTRATION.md (v1.1): Pine = JS on the same TradingView bars.
//   node --max-old-space-size=3000 gate4.mjs <captureDir> <outDir> [15,60,240] [A,B,C]
// captureDir: ../tv/gate4_run.mjs output (study_<res>_<v>.json, bars_<res>.json). The JS port
// is fed exactly TradingView's data: the chart bars are the study's own m_open…m_volume rows
// (pre-history rows included, F-006), the HTF / anchor bars are TradingView's own bars of
// those timeframes, the request.security history starts are recovered by securityStart (F-009 extended) and the
// engine starts on Pine's first engineOn row. Rows of bars that were still open when the
// study loaded are dropped (closed bars only). Every row is compared, layer by layer:
//   1 sensors (scores 1e-6; atrEng, HTF values within 1 mintick)
//   2 engine events (exact bits)
//   3 map (slot code exact, bounds within 1 mintick, quality 1e-6; nearest zone, role)
//   4 lamp (lamp, reason, heading, route, accepted, episode start — exact)
// No tolerance is changed after a run; a difference is reported with its first row.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runTimeframe as runA } from '../../live/measure.mjs';
import { runTimeframe as runC } from './measure-c.mjs';
import { lampOf, obstacleInputs } from '../../live/lamp.mjs';
import { lampOfBC, EpisodeTracker } from './lamp-bc.mjs';
import { profileFor, INPUTS } from '../../../gtg-strategy-lab/engine/profiles.mjs';
import { feedFromTvBars, feedKeysFor } from '../../../gtg-strategy-lab/parity/compare.mjs';
import { maOf } from '../../../gtg-strategy-lab/engine/pine-ta.mjs';
import { containingIndex } from '../../../gtg-strategy-lab/engine/pinecmp/sensors.mjs';
import { priceTol } from '../../../gtg-strategy-lab/gtg-engine/reference/snapshot.mjs';
import { A_REASON_TEXT } from '../diag/build-diag.mjs';

import { CALC_BARS } from '../diag/build-diag.mjs';
const RES_SEC = { 15: 900, 60: 3600, 240: 14400, '1D': 86400, '1W': 604800 };
export const MINTICK = 0.001, SCORE_TOL = 1e-6, PRICE_TOL = MINTICK;
const TF_OF = { 15: 'M15', 60: 'H1', 240: 'H4' };
const sign = (x, th) => (x > th ? 1 : x < -th ? -1 : 0);
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const num = (x) => (x === null || x === undefined || (typeof x === 'number' && Number.isNaN(x)) ? NaN : Number(x));

// study_<res>_<v>.json → rows { t (ms), <title>: value } of closed bars, time-ordered.
export function readStudy(path) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const rows = j.rows.map((r) => { const o = { idx: r[0], t: r[1] * 1000 }; j.titles.forEach((title, k) => { o[title] = num(r[k + 2]); }); return o; });
  rows.sort((a, b) => a.t - b.t);
  for (let i = 1; i < rows.length; i++) if (!(rows[i].t > rows[i - 1].t)) throw new Error(`${path}: duplicate time at ${i}`);
  const live = j.liveBarTime * 1000;
  const closed = rows.filter((r) => r.t < live);
  return { meta: { desc: j.desc, resolution: j.resolution, symbol: j.symbol, capturedAt: j.capturedAt, liveBarTime: new Date(live).toISOString(), studyRows: rows.length, droppedOpen: rows.length - closed.length, preHistoryRows: rows.filter((r) => r.idx <= -1000000).length }, rows: closed };
}

// Pine columns of each version → the comparable lamp fields.
function pineLamp(v, p) {
  if (v === 'A') {
    const ev = p.m_events;
    return { lamp: p.m_lampA, reason: A_REASON_TEXT[p.m_codeA], heading: sign(p.m_headingScore, INPUTS.headingClearThreshold), route: sign(p.m_routeScore, INPUTS.routeClearThreshold),
      accepted: (ev & 4) && (ev & 8) ? 2 : ev & 4 ? 1 : ev & 8 ? -1 : 0, start: p.m_startA === 1 };
  }
  return { lamp: p['GTG lamp closed 0R 1Y 2G'], reason: p['GTG reason closed'], heading: p['GTG heading closed'], route: p['GTG route closed'],
    accepted: p['GTG accepted closed -1 down 1 up 2 both'], start: p['GTG green episode start'] === 1 };
}
function jsLamp(v, r) {
  if (v === 'A') { const x = lampOf(r, { mintick: MINTICK }); const ev = r.events; return { lamp: x.lamp, reason: x.why, heading: r.headingSign, route: r.routeSign, accepted: ev.acceptedUp && ev.acceptedDn ? 2 : ev.acceptedUp ? 1 : ev.acceptedDn ? -1 : 0 }; }
  const x = lampOfBC(r, { mintick: MINTICK });
  return { lamp: x.lamp, reason: x.reason, heading: x.heading, route: x.route, accepted: x.accepted };
}
const evBits = (e) => (e.breakingUp ? 1 : 0) + (e.breakingDn ? 2 : 0) + (e.acceptedUp ? 4 : 0) + (e.acceptedDn ? 8 : 0) + (e.rejectR ? 16 : 0) + (e.rejectS ? 32 : 0) + (e.flipConfirmed ? 64 : 0);

// [layer, name, pine getter, js getter, kind]; kind: score | price | exact
const SLOTS = ['R1', 'R2', 'S1', 'S2'];
const FIELDS = [
  ...['headingScore', 'routeScore', 'speedScore', 'instantSpeedScore', 'fuelScore', 'fuelAcceleration'].map((k) => [1, k, (p) => p[`m_${k}`], (r) => r[k], 'score']),
  [1, 'atrEng', (p) => p.m_atrEng, (r) => r.atrEng, 'price'],
  ...['htfClose', 'htfMA50', 'htfMA200', 'htfATR'].map((k) => [1, k, (p) => p[`m_${k}`], (r) => r[k], 'price']),
  [2, 'events', (p) => p.m_events & 127, (r) => evBits(r.events), 'exact'],
  ...SLOTS.flatMap((n, k) => [
    [3, `${n}.code`, (p) => Math.floor(p.m_slotCodes / 3 ** k) % 3, (r) => (r.slots[k].active ? (r.slots[k].containing ? 2 : 1) : 0), 'exact'],
    [3, `${n}.lo`, (p) => p[`m_${n}_lo`], (r) => (r.slots[k].active ? r.slots[k].lo : NaN), 'price'],
    [3, `${n}.hi`, (p) => p[`m_${n}_hi`], (r) => (r.slots[k].active ? r.slots[k].hi : NaN), 'price'],
    [3, `${n}.q`, (p) => p[`m_${n}_q`], (r) => (r.slots[k].active ? r.slots[k].displayQ : NaN), 'score'],
  ]),
  [3, 'obstacleRole', (p) => p.m_obstacleRole, (r, o) => o.obstacleRole, 'exact'],
  [3, 'nearestObstacleAtr', (p) => p.m_nearestObstacleAtr, (r, o) => o.nearestObstacleAtr, 'score'],
];
// engineOn is bit 128 of m_events (plot budget, ../diag/build-diag.mjs).
const pineOn = (p) => (p.m_events & 128) === 128;
// Where TradingView started each request.security history. With calc_bars_count the route-HTF
// values are na until the first HTF bar that opens at or after the first computed chart bar
// (run 2: 6 na rows on M15, 9 on H4), so the start can lie after the HTF bar holding row 0; the
// lab's inferHtfStart (F-009) only searched before it. The start is the UNIQUE HTF bar s whose
// slice reproduces m_htfClose and m_htfMA200 on every row, na pattern included. The same
// "first bar opening at or after the first chart bar" rule is then used for the anchors and
// checked against the route start.
export function securityStart(rows, htf, { back = 400, ahead = 400 } = {}) {
  const ruleStart = htf.findIndex((b) => b.t >= rows[0].t);
  const k0 = ruleStart < 0 ? htf.length - 1 : ruleStart;
  const zero = [];
  for (let s = Math.max(0, k0 - back); s <= Math.min(htf.length - 1, k0 + ahead); s++) {
    const sl = htf.slice(s), k = containingIndex(rows, sl), closes = sl.map((b) => b.c);
    const ma = maOf(INPUTS.maType, closes, 200, 'sma');
    let bad = 0;
    for (let i = 0; i < rows.length && bad === 0; i++) {
      const j = k[i] - 1;
      for (const [pv, jv] of [[rows[i].m_htfClose, j >= 0 ? closes[j] : NaN], [rows[i].m_htfMA200, j >= 0 ? ma[j] : NaN]]) {
        const pf = Number.isFinite(pv), jf = Number.isFinite(jv);
        if (pf !== jf || (pf && !(Math.abs(pv - jv) <= Math.max(priceTol(pv, MINTICK), priceTol(jv, MINTICK))))) bad++;
      }
    }
    if (bad === 0) zero.push(s);
  }
  return { start: zero.length === 1 ? zero[0] : null, candidates: zero.length, ruleStart, sameAsRule: zero.length === 1 && zero[0] === ruleStart,
    t: zero.length === 1 ? new Date(htf[zero[0]].t).toISOString() : null };
}

const LAMP_FIELDS = ['lamp', 'reason', 'heading', 'route', 'accepted', 'start'];

function same(a, b, kind) {
  const na = !fin(a), nb = !fin(b);
  if (na || nb) return na && nb && (typeof a !== 'string' || a === b);
  if (kind === 'exact') return a === b;
  return Math.abs(a - b) <= (kind === 'score' ? SCORE_TOL : PRICE_TOL);
}

export function gateCell(dir, res, v, opts = {}) {
  const tf = TF_OF[res];
  const { meta, rows } = readStudy(join(dir, `study_${res}_${v}.json`));
  const keys = feedKeysFor(tf);
  const feed = {};
  // HTF / anchor bars of the study's own page load when captured (run 3 on), else the final dump.
  const feedFiles = {};
  for (const k of new Set(Object.values(keys))) {
    feedFiles[k] = [`bars_${k}_for_${res}_${v}.json`, `bars_${k}.json`].find((f) => existsSync(join(dir, f)));
    feed[k] = feedFromTvBars(JSON.parse(readFileSync(join(dir, feedFiles[k]), 'utf8')));
  }
  const bars = rows.map((r) => ({ t: r.t, o: r.m_open, h: r.m_high, l: r.m_low, c: r.m_close, v: r.m_volume }));
  // The study's bars must be TradingView's chart bars where both exist.
  // The chart bars dumped right after this study was read (same page load), else the final dump.
  const chartFile = [`bars_${res}_with_${v}.json`, `bars_${res}.json`].map((f) => join(dir, f)).find((f) => existsSync(f));
  const chart = chartFile ? feedFromTvBars(JSON.parse(readFileSync(chartFile, 'utf8'))) : [];
  const byT = new Map(chart.map((b) => [b.t, b]));
  let chartChecked = 0, chartBad = 0;
  const chartBadList = [];
  for (const b of bars) {
    const c = byT.get(b.t); if (!c) continue; chartChecked++;
    if (c.o !== b.o || c.h !== b.h || c.l !== b.l || c.c !== b.c || c.v !== b.v) { chartBad++; if (chartBadList.length < 30) chartBadList.push({ t: new Date(b.t).toISOString(), study: [b.o, b.h, b.l, b.c, b.v], chart: [c.o, c.h, c.l, c.c, c.v] }); }
  }

  const htfStart = securityStart(rows, feed[keys.htf]);
  const htfBars = htfStart.start == null ? feed[keys.htf] : feed[keys.htf].slice(htfStart.start);
  // Every request.security history holds ceil(calc_bars_count × chartSec / htfSec) bars up to the
  // live HTF bar (run 3: route H1 on M15 = 750, H4 on H1 = 750, D on H4 = 500 — each equal to the
  // unique start securityStart recovers; D anchor on H1 = 125 — the only start with no difference;
  // W anchor on H4 = 72, inside the 68–78 range that all reproduce Pine). Anchors use this rule.
  // Copies without the limit ("diag full", TradingView's own history): the same rule on the number
  // of bars Pine computed, which is every exported row only when row 0 is Pine's first bar (its
  // atrEng is then that bar's own range); checked and reported.
  const full = /diag full/.test(meta.desc);
  const firstBarSig = Math.abs(rows[0].m_atrEng - Math.max(rows[0].m_high - rows[0].m_low, MINTICK)) <= MINTICK && !Number.isFinite(rows[0].m_headingScore);
  const computedBars = full ? meta.studyRows : CALC_BARS;
  const secBars = (k) => { const n = Math.ceil(computedBars * profileFor(tf).chartSec / RES_SEC[k]); return feed[k].slice(Math.max(0, feed[k].length - n)); };
  const routeRule = secBars(keys.htf);
  htfStart.ruleBars = routeRule.length; htfStart.sameAsBarRule = htfStart.start != null && routeRule[0] === feed[keys.htf][htfStart.start];
  const anchorBars = (k) => secBars(k);
  // opts.a1Shift / a2Shift (exploration only, not used by the gate): move an anchor start by whole bars.
  const shifted = (k, bars, n) => { if (!n) return bars; const s0 = feed[k].indexOf(bars[0]); return feed[k].slice(Math.max(0, s0 + n)); };
  const a1Bars = shifted(keys.a1, anchorBars(keys.a1), opts.a1Shift), a2Bars = shifted(keys.a2, anchorBars(keys.a2), opts.a2Shift);
  const startBar = rows.findIndex((r) => pineOn(r));
  const run = v === 'C' ? runC : runA;
  const tracker = new EpisodeTracker();
  const stats = new Map(), first = { 1: null, 2: null, 3: null, 4: null };
  const note = (layer, name, i, ok, pv, jv) => {
    const s = stats.get(name) ?? { layer, compared: 0, mismatched: 0, maxAbs: 0, first: null, sample: [] };
    s.compared++;
    if (fin(pv) && fin(jv)) s.maxAbs = Math.max(s.maxAbs, Math.abs(pv - jv));
    if (!ok) { s.mismatched++; if (s.sample.length < 12) s.sample.push([i, new Date(rows[i].t).toISOString(), pv, jv]); if (!s.first) s.first = { row: i, t: new Date(rows[i].t).toISOString(), pine: pv, js: jv }; if (!first[layer] || first[layer].row > i) first[layer] = { row: i, t: new Date(rows[i].t).toISOString(), field: name }; }
    stats.set(name, s);
  };
  const pineStarts = [], jsStarts = [];
  let engineRows = 0, i = 0;
  const trace = {};
  run({ tf, mintick: MINTICK, bars, htfBars, a1Bars, a2Bars, startBar, emaSeed: 'sma', keepRows: false, onRow: (r) => {
    const p = rows[i];
    if (r.t !== p.t) throw new Error(`row ${i} time`);
    const o = obstacleInputs(r, { mintick: MINTICK });
    note(0, 'engineOn', i, pineOn(p) === r.engineOn, pineOn(p) ? 1 : 0, r.engineOn ? 1 : 0);
    for (const [layer, name, pg, jg, kind] of FIELDS) {
      if (layer >= 2 && !(pineOn(p))) continue;
      const pv = pg(p), jv = jg(r, o);
      note(layer, name, i, same(pv, jv, kind), pv, jv);
    }
    const jl = r.engineOn ? jsLamp(v, r) : { lamp: 1, reason: v === 'A' ? null : 10, heading: r.headingSign, route: r.routeSign, accepted: 0 };
    const ep = tracker.push(r.engineOn, jl.lamp, jl.heading);
    if (pineOn(p)) {
      engineRows++;
      const pl = pineLamp(v, p);
      const jlx = { ...jl, start: ep.start };
      for (const f of LAMP_FIELDS) note(4, f, i, pl[f] === jlx[f], pl[f], jlx[f]);
      if (pl.start) pineStarts.push({ t: new Date(p.t).toISOString(), dir: pl.heading });
      if (ep.start) jsStarts.push({ t: new Date(p.t).toISOString(), dir: jl.heading });
    }
    i++;
  } });
  const fields = Object.fromEntries(stats);
  const mismatched = [...stats.values()].reduce((s, f) => s + f.mismatched, 0);
  const startsEqual = JSON.stringify(pineStarts) === JSON.stringify(jsStarts);
  const firstLayer = [1, 2, 3, 4].find((l) => first[l]) ?? null;
  return {
    res, tf, version: v, pass: mismatched === 0 && startsEqual && chartBad === 0 && pineStarts.length > 0 && (!full || firstBarSig),
    meta, rows: rows.length, variant: full ? 'full' : 'calc_bars_count', firstRowIsFirstComputedBar: firstBarSig, computedBars, chartBarsChecked: chartChecked, chartBarsDiffering: chartBad, chartBadList,
    htfStart, feedFiles, startBar, engineRows, firstRow: new Date(rows[0].t).toISOString(), lastRow: new Date(rows.at(-1).t).toISOString(),
    starts: { pine: pineStarts.length, js: jsStarts.length, equal: startsEqual, list: pineStarts },
    mismatched, firstDifferenceByLayer: first, firstLayer, fields, trace,
  };
}

if (process.argv[1] && process.argv[1].endsWith('gate4.mjs')) {
  const [, , dir, outDir, resArg = '15,60,240', vArg = 'A,B,C'] = process.argv;
  mkdirSync(outDir, { recursive: true });
  const summary = [];
  for (const res of resArg.split(',')) for (const v of vArg.split(',')) {
    if (!existsSync(join(dir, `study_${res}_${v}.json`))) { console.log(`${res} ${v}: no capture`); continue; }
    const t0 = Date.now();
    const out = gateCell(dir, res, v);
    writeFileSync(join(outDir, `gate4_${out.tf}_${v}.json`), JSON.stringify(out, null, 1));
    const bad = Object.entries(out.fields).filter(([, f]) => f.mismatched).map(([n, f]) => `${n} ${f.mismatched}/${f.compared}`);
    console.log(`${out.tf} ${v}: ${out.pass ? 'PASS' : 'FAIL'} rows ${out.rows} (pre-history ${out.meta.preHistoryRows}, open dropped ${out.meta.droppedOpen}) engine rows ${out.engineRows} startBar ${out.startBar} htfStart ${out.htfStart.t ?? "none"} (candidates ${out.htfStart.candidates}, = bar rule ${out.htfStart.sameAsBarRule}) starts pine ${out.starts.pine} js ${out.starts.js} equal ${out.starts.equal} chart bars ${out.chartBarsChecked}/${out.chartBarsDiffering} bad; ${bad.length ? 'differences: ' + bad.join(', ') + ' first layer ' + out.firstLayer + ' ' + JSON.stringify(out.firstDifferenceByLayer[out.firstLayer]) : 'no difference'} (${Math.round((Date.now() - t0) / 1000)} s)`);
    summary.push({ tf: out.tf, version: v, pass: out.pass, rows: out.rows, engineRows: out.engineRows, starts: out.starts.pine, mismatched: out.mismatched, firstLayer: out.firstLayer });
  }
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
}
