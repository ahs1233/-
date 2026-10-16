// lastgtg historical green-light test 2025–2026 (HISTORY_PREREGISTRATION.md).
//   node --max-old-space-size=3000 history.mjs <feedDir> <outDir> [M1,M5,M15,H1,H4]
// feedDir: the CSVs of export_history.py. Writes <outDir>/summary.json, signals_<tf>.csv,
// progress.log. Nothing here changes the indicator: the live modules are imported as they are.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTimeframe } from '../live/measure.mjs';
import { DEFAULTS, engineWindowFor } from '../live/zone-engine.mjs';
import { lampOf } from '../live/lamp.mjs';
import { profileFor, zoneParams } from '../../gtg-strategy-lab/engine/profiles.mjs';
import { lowerBound, scoreBid, scoreSpread, wilson, tally, Z_995 } from './score.mjs';

export const START = Date.UTC(2025, 0, 1), END = Date.UTC(2026, 8, 26);
const MINTICK = 0.001, SENSOR_WARM = 1100, GREEN_EXPIRY_BARS = 300, SEED = 20261014, SAMPLES = 50;
const PINE_TO_TF = { '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', D: 'D', W: 'W' };
const KINDS = ['break', 'aligned'];

export function readFeed(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const bars = [], ask = { ah: [], al: [], ac: [] };
  for (let k = 1; k < lines.length; k++) {
    const s = lines[k];
    if (!s) continue;
    const f = s.split(',');
    bars.push({ t: Number(f[0]), o: Number(f[1]), h: Number(f[2]), l: Number(f[3]), c: Number(f[4]), v: Number(f[5]) });
    if (f.length > 6) {
      ask.ah.push(f[6] === '' ? NaN : Number(f[6])); ask.al.push(f[7] === '' ? NaN : Number(f[7])); ask.ac.push(f[8] === '' ? NaN : Number(f[8]));
    }
  }
  return { bars, ask };
}

// Seeded shuffle (mulberry32) for the validity samples.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pick(arr, n, rand) {
  const a = arr.slice();
  for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
  return a.slice(0, n);
}

// Bar open times per feed, computed once (the validity check cuts the same feeds many times).
const TIMES = new WeakMap();
const timesOf = (arr) => { let ts = TIMES.get(arr); if (!ts) { ts = Float64Array.from(arr, (b) => b.t); TIMES.set(arr, ts); } return ts; };
const upTo = (arr, T) => arr.slice(0, lowerBound(timesOf(arr), T + 1));

// Live-style lamp at chart index i: bars cut at i, engine started W bars back (runner.mjs).
// htfMode 'fixed': HTF / anchor bars opening at or before the chart bar (= runner with the forming
// placeholder); 'closed': only HTF bars closed by the chart bar's close (the runner before aaac5a2).
function liveLamp(tf, feeds, chart, i, W, htfMode) {
  const prof = profileFor(tf);
  const bars = chart.slice(Math.max(0, i + 1 - (W + SENSOR_WARM)), i + 1);
  const T = chart[i].t, Tc = T + prof.chartSec * 1000;
  // closed by Tc: open + period <= Tc, i.e. open <= Tc - period
  const cut = (arr, sec) => (htfMode === 'fixed' ? upTo(arr, T) : upTo(arr, Tc - sec * 1000));
  let last = null;
  runTimeframe({ tf, bars, htfBars: cut(feeds[prof.htfTf], prof.htfSec), a1Bars: cut(feeds[PINE_TO_TF[prof.a1Tf]], prof.a1Sec), a2Bars: cut(feeds[PINE_TO_TF[prof.a2Tf]], prof.a2Sec),
    mintick: MINTICK, startBar: Math.max(0, bars.length - 1 - W), keepRows: false, onRow: (r) => { if (r.i === bars.length - 1) last = r; } });
  if (!last || !last.engineOn) return null;
  const lp = lampOf(last, { mintick: MINTICK });
  return { lamp: lp.lamp, kind: lp.kind, dir: lp.greenDir };
}

function cell(recs, key) {
  const all = tally(recs.map((r) => r[key]));
  const y25 = tally(recs.filter((r) => r.year === 2025).map((r) => r[key]));
  const y26 = tally(recs.filter((r) => r.year === 2026).map((r) => r[key]));
  const [lo, hi] = wilson(all.win, all.n, Z_995);
  return { ...all, wilson995: [lo, hi], y2025: y25, y2026: y26 };
}

function verdict(c, base) {
  if (c.n < 40) return 'too few';
  const ok = c.wilson995[0] > 0.5 && c.share > base.share && c.y2025.share > 0.5 && c.y2026.share > 0.5;
  return ok ? 'useful' : 'not shown';
}

export function runTf(tf, feeds, m1, log) {
  const prof = profileFor(tf);
  const P = zoneParams(DEFAULTS, prof, MINTICK);
  const W = engineWindowFor(P, prof.chartSec, prof.a1Sec, prof.a2Sec);
  const allBars = feeds[tf];
  const idx0 = lowerBound(timesOf(allBars), START);
  const chart = allBars.slice(Math.max(0, idx0 - (W + SENSOR_WARM + 300)));
  const lamps = new Int8Array(chart.length).fill(-1), kinds = new Int8Array(chart.length), dirs = new Int8Array(chart.length);
  const sig = [], base = [], periodIdx = [];
  let prev = null, notWarmed = 0;
  const t0 = Date.now();
  runTimeframe({ tf, bars: chart, htfBars: feeds[prof.htfTf], a1Bars: feeds[PINE_TO_TF[prof.a1Tf]], a2Bars: feeds[PINE_TO_TF[prof.a2Tf]],
    mintick: MINTICK, startBar: 0, keepRows: false, onRow: (r) => {
      const inP = r.t >= START && r.t < END;
      if (!r.warmed) { if (inP) notWarmed++; prev = null; return; }
      const lp = lampOf(r, { mintick: MINTICK });
      lamps[r.i] = lp.lamp; kinds[r.i] = lp.kind === 'break' ? 1 : lp.kind === 'aligned' ? 2 : 0; dirs[r.i] = lp.greenDir;
      if (inP) {
        periodIdx.push(r.i);
        if (prev && lp.lamp === 2 && lp.greenDir !== 0 && !(prev.lamp === 2 && prev.dir === lp.greenDir)) {
          sig.push({ i: r.i, t: r.t, c: r.c, atr: r.atrEng, kind: lp.kind, dir: lp.greenDir, head: lp.head });
        }
        if (r.headingSign !== 0) base.push({ i: r.i, t: r.t, c: r.c, atr: r.atrEng, dir: r.headingSign });
      }
      prev = { lamp: lp.lamp, dir: lp.greenDir };
    } });
  log(`${tf} engine done in ${Math.round((Date.now() - t0) / 1000)} s: W=${W} chart=${chart.length} period rows=${periodIdx.length} signals=${sig.length} baseline=${base.length} notWarmed=${notWarmed}`);

  // Validity check (pre-registered): live-style lamp at sampled bars.
  const rand = rng(SEED + TFS_ORDER.indexOf(tf));
  const samples = [...pick(sig.map((s) => s.i), SAMPLES, rand), ...pick(periodIdx, SAMPLES, rand)];
  let diff = 0, diffClosed = 0;
  const examples = [];
  for (const i of samples) {
    const cont = { lamp: lamps[i], kind: kinds[i] === 1 ? 'break' : kinds[i] === 2 ? 'aligned' : null, dir: dirs[i] };
    const fx = liveLamp(tf, feeds, chart, i, W, 'fixed');
    const cl = liveLamp(tf, feeds, chart, i, W, 'closed');
    const same = (x) => x && x.lamp === cont.lamp && x.kind === cont.kind && x.dir === cont.dir;
    if (!same(fx)) { diff++; if (examples.length < 5) examples.push({ t: new Date(chart[i].t).toISOString(), cont, live: fx }); }
    if (!same(cl)) diffClosed++;
  }
  const validity = { checked: samples.length, differing: diff, share: samples.length ? diff / samples.length : 0, pass: samples.length ? diff / samples.length <= 0.02 : false,
    asBuiltDiffering: diffClosed, examples };
  log(`${tf} validity: ${diff}/${samples.length} differ (fixed live), ${diffClosed}/${samples.length} (closed-HTF live as built)`);

  // Scoring A and B.
  const ms = prof.chartSec * 1000;
  const score = (x) => {
    const closeT = x.t + ms, from = lowerBound(m1.t, closeT), exp = x.t + (GREEN_EXPIRY_BARS + 1) * ms;
    const a = scoreBid(m1, from, x.dir, x.c + x.dir * x.atr, x.c - x.dir * x.atr, exp);
    const k = from - 1;
    const entryAsk = k >= 0 && m1.t[k] >= x.t ? m1.ac[k] : NaN;
    const b = scoreSpread(m1, from, x.dir, x.c, entryAsk, x.atr, exp);
    return { resA: a.res, barsA: a.j >= 0 ? Math.round((m1.t[a.j] - closeT) / ms) : '', resB: b.res, spread: Number.isFinite(entryAsk) ? entryAsk - x.c : NaN, year: new Date(x.t).getUTCFullYear() };
  };
  const sigRecs = sig.map((s) => ({ ...s, ...score(s) }));
  const baseRecs = base.map((s) => ({ ...s, ...score(s) }));
  const baseline = { A: cell(baseRecs, 'resA'), B: cell(baseRecs, 'resB') };
  const cells = {};
  for (const kind of KINDS) {
    const recs = sigRecs.filter((r) => r.kind === kind);
    const A = cell(recs, 'resA'), B = cell(recs, 'resB');
    const sp = recs.map((r) => r.spread).filter(Number.isFinite);
    cells[kind] = { A, B, verdictA: verdict(A, baseline.A), verdictB: verdict(B, baseline.B), meanSpread: sp.length ? sp.reduce((s, x) => s + x, 0) / sp.length : NaN,
      meanAtr: recs.length ? recs.reduce((s, r) => s + r.atr, 0) / recs.length : NaN };
  }
  return { tf, W, chartBars: chart.length, periodRows: periodIdx.length, notWarmed, validity, baseline, cells, sigRecs };
}

const TFS_ORDER = ['M1', 'M5', 'M15', 'H1', 'H4'];

if (process.argv[1] && process.argv[1].endsWith('history.mjs')) {
  const [, , feedDir, outDir, tfArg] = process.argv;
  const tfs = tfArg ? tfArg.split(',') : TFS_ORDER;
  mkdirSync(outDir, { recursive: true });
  const log = (m) => { const s = `${new Date().toISOString()} ${m}`; console.log(s); appendFileSync(join(outDir, 'progress.log'), s + '\n'); };
  const feeds = {};
  let m1 = null;
  for (const tf of ['M1', 'M5', 'M15', 'H1', 'H4', 'D', 'W']) {
    const { bars, ask } = readFeed(join(feedDir, `XAUUSD_${tf}.csv`));
    feeds[tf] = bars;
    if (tf === 'M1') m1 = { t: Float64Array.from(bars, (b) => b.t), h: Float64Array.from(bars, (b) => b.h), l: Float64Array.from(bars, (b) => b.l), ah: Float64Array.from(ask.ah), al: Float64Array.from(ask.al), ac: Float64Array.from(ask.ac) };
    log(`read ${tf}: ${bars.length} bars ${bars.length ? new Date(bars[0].t).toISOString() + ' → ' + new Date(bars.at(-1).t).toISOString() : ''}`);
  }
  const summary = { period: [new Date(START).toISOString(), new Date(END).toISOString()], m1End: new Date(m1.t[m1.t.length - 1]).toISOString(), tfs: {} };
  for (const tf of tfs) {
    const res = runTf(tf, feeds, m1, log);
    const { sigRecs, ...rest } = res;
    summary.tfs[tf] = rest;
    writeFileSync(join(outDir, `signals_${tf}.csv`), 'signal_bar_utc,kind,dir,entry,atr,resA,bars_to_A,resB,spread,head\n'
      + sigRecs.map((r) => [new Date(r.t).toISOString().slice(0, 16), r.kind, r.dir, r.c, r.atr.toFixed(3), r.resA, r.barsA, r.resB, Number.isFinite(r.spread) ? r.spread.toFixed(3) : '', `"${r.head}"`].join(',')).join('\n') + '\n');
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
    log(`${tf} written`);
  }
  log('done');
}
