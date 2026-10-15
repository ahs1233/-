// Gate 3 of ../TEST_PREREGISTRATION.md (v1.1): does a run whose engine starts exactly
// engineWindow bars before a bar (as Pine's engineOn) give what the continuous run gives,
// for A, B and C? Bars and times only: no outcome, no price after the bar is read.
//   node --max-old-space-size=3000 gate3.mjs <feedDir> <outDir> [M5,M15,H1,H4]
// feedDir: the CSVs of ../../history/export_history.py. Writes <outDir>/gate3_<tf>.json and
// progress.log. Samples per timeframe: 50 green starts of each version + 50 random warmed bars
// of the period (seed 20261015); every sampled bar is checked for all three versions.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTimeframe as runA } from '../../live/measure.mjs';
import { runTimeframe as runC } from './measure-c.mjs';
import { DEFAULTS, engineWindowFor } from '../../live/zone-engine.mjs';
import { lampOf } from '../../live/lamp.mjs';
import { lampOfBC, EpisodeTracker } from './lamp-bc.mjs';
import { profileFor, zoneParams } from '../../../gtg-strategy-lab/engine/profiles.mjs';

export const START = Date.UTC(2021, 9, 1), END = Date.UTC(2025, 0, 1);
const MINTICK = 0.001, SENSOR_WARM = 2000, SEED = 20261015, SAMPLES = 50;
const PINE_TO_TF = { '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', D: 'D', W: 'W' };
const TFS_ORDER = ['M1', 'M5', 'M15', 'H1', 'H4'];
const VERSIONS = ['A', 'B', 'C'];

export function readFeed(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const bars = [];
  for (let k = 1; k < lines.length; k++) {
    const s = lines[k];
    if (!s) continue;
    const f = s.split(',');
    bars.push({ t: Number(f[0]), o: Number(f[1]), h: Number(f[2]), l: Number(f[3]), c: Number(f[4]), v: Number(f[5]) });
  }
  return bars;
}

function rng(seed) { // mulberry32, as ../../history/history.mjs
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pick(arr, n, rand) {
  const a = arr.slice();
  for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
  return a.slice(0, n);
}
function lowerBound(ts, x) { let lo = 0, hi = ts.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < x) lo = m + 1; else hi = m; } return lo; }
const TIMES = new WeakMap();
const timesOf = (arr) => { let ts = TIMES.get(arr); if (!ts) { ts = Float64Array.from(arr, (b) => b.t); TIMES.set(arr, ts); } return ts; };
const upTo = (arr, T) => arr.slice(0, lowerBound(timesOf(arr), T + 1));

// The three versions on one row of an engine: A and B read the A engine, C the C engine.
function lampA(r) {
  const lp = lampOf(r, { mintick: MINTICK });
  const ev = r.events;
  return { lamp: lp.lamp, reason: lp.why, heading: r.headingSign, route: r.routeSign, accepted: ev.acceptedUp && ev.acceptedDn ? 2 : ev.acceptedUp ? 1 : ev.acceptedDn ? -1 : 0 };
}
function lampB(r) {
  const p = lampOfBC(r, { mintick: MINTICK });
  return { lamp: p.lamp, reason: p.reason, heading: p.heading, route: p.route, accepted: p.accepted };
}
const ENGINE_OF = { A: 'A', B: 'A', C: 'C' };
const LAMP_OF = { A: lampA, B: lampB, C: lampB };
const RUN_OF = { A: runA, C: runC };

// Runs one engine over `bars` and returns, per version it serves, the state at every row index
// in `want` (a Set) — plus the episode start computed over the whole run (Pine snapshot rule).
function scan(engine, args, want, onPeriodRow) {
  const versions = VERSIONS.filter((v) => ENGINE_OF[v] === engine);
  const trackers = Object.fromEntries(versions.map((v) => [v, new EpisodeTracker()]));
  const got = new Map();
  RUN_OF[engine]({ ...args, keepRows: false, onRow: (r) => {
    const st = {};
    for (const v of versions) {
      const x = r.engineOn ? LAMP_OF[v](r) : { lamp: 1, reason: v === 'A' ? 'off' : 10, heading: r.headingSign, route: r.routeSign, accepted: 0 };
      const ep = trackers[v].push(r.engineOn, x.lamp, x.heading);
      st[v] = { ...x, start: ep.start };
    }
    if (onPeriodRow) onPeriodRow(r, st);
    if (want && want.has(r.i)) got.set(r.i, { st, slots: r.slots.map((s) => (s.active ? [s.lo, s.hi, s.displayQ] : null)) });
  } });
  return got;
}

const FIELDS = ['lamp', 'reason', 'heading', 'route', 'accepted', 'start'];

export function gateTf(tf, feeds, log) {
  const prof = profileFor(tf);
  const P = zoneParams(DEFAULTS, prof, MINTICK);
  const W = engineWindowFor(P, prof.chartSec, prof.a1Sec, prof.a2Sec);
  const all = feeds[tf];
  const chart = all.slice(0, lowerBound(timesOf(all), END));
  const htf = { htfBars: feeds[prof.htfTf], a1Bars: feeds[PINE_TO_TF[prof.a1Tf]], a2Bars: feeds[PINE_TO_TF[prof.a2Tf]] };
  const base = { tf, mintick: MINTICK, ...htf };

  // 1. Continuous research runs (engine from the first bar), A engine then C engine.
  const period = [], starts = { A: [], B: [], C: [] };
  const t0 = Date.now();
  for (const engine of ['A', 'C']) {
    scan(engine, { ...base, bars: chart, startBar: 0 }, null, (r, st) => {
      if (!(r.warmed && r.t >= START && r.t < END)) return;
      if (engine === 'A') period.push(r.i);
      for (const v of Object.keys(st)) if (st[v].start) starts[v].push(r.i);
    });
  }
  log(`${tf} continuous runs ${Math.round((Date.now() - t0) / 1000)} s: W=${W} chart=${chart.length} period=${period.length} starts A=${starts.A.length} B=${starts.B.length} C=${starts.C.length}`);

  // 2. Samples: 50 starts per version + 50 random period bars; union, sorted.
  const rand = rng(SEED + TFS_ORDER.indexOf(tf));
  const sampled = new Set([...pick(starts.A, SAMPLES, rand), ...pick(starts.B, SAMPLES, rand), ...pick(starts.C, SAMPLES, rand), ...pick(period, SAMPLES, rand)]);
  const sample = [...sampled].sort((a, b) => a - b);

  // 3. Continuous state at the sampled bars (second pass, same runs).
  const cont = {};
  for (const engine of ['A', 'C']) for (const [i, x] of scan(engine, { ...base, bars: chart, startBar: 0 }, sampled)) {
    cont[i] = cont[i] || { st: {}, slots: {} };
    Object.assign(cont[i].st, x.st); cont[i].slots[engine] = x.slots;
  }

  // 4. Live-style at each sampled bar: sensors from W + SENSOR_WARM bars back, engine W bars
  //    back, HTF / anchor bars opening at or before the bar (../../live/runner.mjs).
  const diffs = [];
  const counts = Object.fromEntries(VERSIONS.map((v) => [v, { checked: 0, differing: 0, fields: Object.fromEntries(FIELDS.map((f) => [f, 0])), startsSampled: 0, startsDiffering: 0 }]));
  const t1 = Date.now();
  for (const i of sample) {
    const from = Math.max(0, i + 1 - (W + SENSOR_WARM));
    const bars = chart.slice(from, i + 1);
    const T = chart[i].t;
    const args = { tf, mintick: MINTICK, bars, htfBars: upTo(htf.htfBars, T), a1Bars: upTo(htf.a1Bars, T), a2Bars: upTo(htf.a2Bars, T), startBar: Math.max(0, bars.length - 1 - W) };
    const live = { st: {}, slots: {} };
    for (const engine of ['A', 'C']) {
      const got = scan(engine, args, new Set([bars.length - 1])).get(bars.length - 1);
      Object.assign(live.st, got.st); live.slots[engine] = got.slots;
    }
    for (const v of VERSIONS) {
      const c = cont[i].st[v], l = live.st[v], k = counts[v];
      k.checked++;
      if (c.start) k.startsSampled++;
      const bad = FIELDS.filter((f) => c[f] !== l[f]);
      if (bad.length) {
        k.differing++; for (const f of bad) k.fields[f]++;
        if (c.start || l.start) k.startsDiffering++;
        diffs.push({ version: v, t: new Date(T).toISOString(), i, fields: bad, continuous: c, live: l,
          slotsContinuous: cont[i].slots[ENGINE_OF[v]], slotsLive: live.slots[ENGINE_OF[v]] });
      }
    }
  }
  log(`${tf} live-style checks ${Math.round((Date.now() - t1) / 1000)} s on ${sample.length} bars: ` + VERSIONS.map((v) => `${v} ${counts[v].differing}/${counts[v].checked} (starts ${counts[v].startsDiffering}/${counts[v].startsSampled})`).join(', '));
  const pass = VERSIONS.every((v) => counts[v].differing === 0);
  return { tf, W, sensorWarm: SENSOR_WARM, chartBars: chart.length, chartFrom: new Date(chart[0].t).toISOString(), periodRows: period.length,
    starts: { A: starts.A.length, B: starts.B.length, C: starts.C.length }, sampled: sample.length, counts, pass, diffs };
}

if (process.argv[1] && process.argv[1].endsWith('gate3.mjs')) {
  const [, , feedDir, outDir, tfArg] = process.argv;
  const tfs = tfArg ? tfArg.split(',') : ['M5', 'M15', 'H1', 'H4'];
  mkdirSync(outDir, { recursive: true });
  const log = (m) => { const s = `${new Date().toISOString()} ${m}`; console.log(s); appendFileSync(join(outDir, 'progress.log'), s + '\n'); };
  const feeds = {};
  for (const tf of ['M5', 'M15', 'H1', 'H4', 'D', 'W']) {
    feeds[tf] = readFeed(join(feedDir, `XAUUSD_${tf}.csv`));
    log(`read ${tf}: ${feeds[tf].length} bars ${new Date(feeds[tf][0].t).toISOString()} → ${new Date(feeds[tf].at(-1).t).toISOString()}`);
  }
  if (tfs.includes('M1')) feeds.M1 = readFeed(join(feedDir, 'XAUUSD_M1.csv'));
  for (const tf of tfs) {
    const res = gateTf(tf, feeds, log);
    writeFileSync(join(outDir, `gate3_${tf}.json`), JSON.stringify(res, null, 1));
    log(`${tf} ${res.pass ? 'PASS' : 'DIFFERENCES — see gate3_' + tf + '.json'}`);
  }
  log('done');
}
