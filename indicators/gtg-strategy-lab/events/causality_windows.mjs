// Real Causality Gate on overlapping windows (GPT message 55; RAM-bound: the whole history does
// not fit one run). The gate logic is causality.mjs, unchanged and identical in every window:
//   CG1  future truncation at 55% and 80% of the measured part: nothing before the cut changes
//   CG2  future perturbation at 70%: nothing before it changes
//   CG3  negative control: an extractor that reads bar t+1 must be caught by the same comparison
//   non-vacuity: the required families fire inside the measured part (names only, never counts)
// Pre-roll: M5 starts on a weekly bar open (also a D/H4/H1 boundary, so no higher-timeframe bar is
// split) at least warmupBars(M5) before the measured start; the higher-timeframe bars wholly before
// that open are the dataset's own bars (past only, enough for each warm-up); inside the window every
// higher-timeframe bar is rebuilt from M5, as in causality.mjs. Overlaps between consecutive windows
// are compared for continuity (agreement ratios of discrete states and event times) — never pooled
// into results. Reports PASS/FAIL, dates and ratios only.
//   node --max-old-space-size=3000 causality_windows.mjs feeds.json report.json [mintick] [w]
import { readFileSync, writeFileSync } from 'node:fs';
import { run, compareBefore, rebuildFromM5, FAMILIES, REQUIRED } from './causality.mjs';
import { warmupBars } from './split.mjs';

const HTF = ['M15', 'H1', 'H4', 'D', 'W'];
const MONTH = (t, k) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDate()); };

// windows of `len` months stepping `step` months; the last one ends exactly at the data end
export function windowPlan(t0, tEnd, len = 18, step = 12) {
  const out = [];
  for (let a = t0; MONTH(a, len + step) <= tEnd; a = MONTH(a, step)) out.push([a, MONTH(a, len)]);
  out.push([Math.max(t0, MONTH(tEnd, -len)), tEnd]);
  return out;
}

function lastIndexBefore(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; } return lo - 1; }

export function windowFeeds(feeds, a, b, mintick) {
  const iA = lastIndexBefore(feeds.M5, a) + 1;
  const want = feeds.M5[Math.max(0, iA - warmupBars('M5', mintick) - 200)].t;
  const wk = lastIndexBefore(feeds.W, want + 1);
  const p = iA === 0 || wk < 0 ? feeds.M5[0].t : Math.max(feeds.M5[0].t, feeds.W[wk].t);
  const m5 = feeds.M5.filter((x) => x.t >= p && x.t < b);
  const keep = {}, intervals = {};
  for (const tf of HTF) {
    const i = lastIndexBefore(feeds[tf], p);
    const n = tf === 'W' ? i + 1 : Math.ceil(warmupBars(tf, mintick) * 1.25) + 10;
    keep[tf] = feeds[tf].slice(Math.max(0, i + 1 - n), i + 1);
    intervals[tf] = feeds[tf].filter((x) => x.t >= p && x.t < b).map((x) => x.t);
  }
  const build = (m) => ({ M5: m, ...Object.fromEntries(HTF.map((tf) => [tf, keep[tf].concat(rebuildFromM5(m, intervals[tf]))])) });
  return { p, m5, build, iMeasured: m5.findIndex((x) => x.t >= a) };
}

// reads the next bar's close: at the last bar before any cut it differs between the full and the cut run
const leaky = (panel) => panel.map((q, t) => ({ t, next: panel[t + 1] ? panel[t + 1].c : null }));
const before = (list, T) => JSON.stringify((list ?? []).filter((e) => e.t < T));
const stateKey = (q) => `${q.headingSign}|${q.routeSign}|${q.slots.filter((s) => s.active).map((s) => `${s.name}:${s.primaryKey}`).sort().join(',')}`;

export function gateWindow(feeds, a, b, { mintick, w, cuts = [0.55, 0.8], perturbAt = 0.7 }) {
  const { p, m5, build, iMeasured } = windowFeeds(feeds, a, b, mintick);
  const at = (f) => { let k = iMeasured + Math.floor((m5.length - iMeasured) * f); while (k < m5.length - 1 && m5[k].t % 3_600_000 === 0) k++; return k; };
  const full = run(build(m5), { mintick, w });
  const errors = [];
  let cg1 = true, cg3 = null;
  for (const f of cuts) {
    const k = at(f);
    const other = run(build(m5.slice(0, k)), { mintick, w });
    const T = other.panel.length;
    const diffs = compareBefore(full, other, T);
    if (diffs.length) { cg1 = false; errors.push(`CG1 cut ${new Date(m5[k].t).toISOString()}: ${diffs.join(', ')}`); }
    if (cg3 === null) cg3 = before(leaky(other.panel), T) !== before(leaky(full.panel), T);
  }
  const kp = at(perturbAt);
  const alt = m5.map((x, i) => (i < kp ? x : { ...x, o: x.o * 1.03, h: x.h * 1.05, l: x.l * 1.01, c: x.c * 1.02, v: x.v * 3 }));
  const diffs2 = compareBefore(full, run(build(alt), { mintick, w }), kp);
  if (diffs2.length) errors.push(`CG2 at ${new Date(m5[kp].t).toISOString()}: ${diffs2.join(', ')}`);
  if (!cg3) errors.push('CG3: the leaky extractor was not caught');
  const vacuous = REQUIRED.filter((n) => !((FAMILIES.find(([k]) => k === n)[1](full) ?? []).some((e) => e.t >= iMeasured)));
  if (vacuous.length) errors.push(`vacuous: ${vacuous.join(', ')}`);
  const states = new Map(full.panel.filter((q) => q.t >= a && q.warmed).map((q) => [q.t, stateKey(q)]));
  const events = new Set(FAMILIES.flatMap(([n, g]) => (g(full) ?? []).filter((e) => e.time >= a).map((e) => `${n}@${e.time}`)));
  return {
    window: [new Date(a).toISOString(), new Date(b).toISOString()], preroll_from: new Date(p).toISOString(),
    CG1: cg1 ? 'PASS' : 'FAIL', CG2: diffs2.length ? 'FAIL' : 'PASS', CG3: cg3 ? 'PASS' : 'FAIL', non_vacuity: vacuous.length ? 'FAIL' : 'PASS',
    errors, _states: states, _events: events,
  };
}

function continuity(prev, cur, a, b) {
  const t = [...prev._states.keys()].filter((x) => x >= a && x < b && cur._states.has(x));
  const same = t.filter((x) => prev._states.get(x) === cur._states.get(x)).length;
  const pe = [...prev._events].filter((e) => { const x = +e.split('@')[1]; return x >= a && x < b; });
  const ce = [...cur._events].filter((e) => { const x = +e.split('@')[1]; return x >= a && x < b; });
  const union = new Set([...pe, ...ce]);
  return { state_agreement: t.length ? same / t.length : null, event_jaccard: union.size ? pe.filter((e) => cur._events.has(e)).length / union.size : null };
}

export function causalityWindows(feeds, opts, log = () => {}) {
  const plan = windowPlan(feeds.M5[0].t, feeds.M5.at(-1).t + 300_000);
  const out = [];
  let prev = null;
  for (const [a, b] of plan) {
    const r = gateWindow(feeds, a, b, opts);
    if (prev) r.continuity_with_previous = continuity(prev, r, a, Math.min(b, Date.parse(prev.window[1])));
    const { _states, _events, ...pub } = r;
    out.push(pub);
    log(JSON.stringify(pub));
    prev = r;
  }
  const pass = out.every((r) => r.CG1 === 'PASS' && r.CG2 === 'PASS' && r.CG3 === 'PASS' && r.non_vacuity === 'PASS');
  return { label: 'Real Causality Gate (windows) — PASS/FAIL only, no outcomes', windows: out.length, overall: pass ? 'PASS' : 'FAIL', per_window: out };
}

if (process.argv[1] && process.argv[1].endsWith('causality_windows.mjs') && process.argv[2]) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const feeds = Object.fromEntries(Object.entries(doc.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))]));
  const rep = causalityWindows(feeds, { mintick: Number(process.argv[4] ?? 0.001), w: Number(process.argv[5] ?? 0.3) }, (s) => console.log(s));
  writeFileSync(process.argv[3], JSON.stringify({ input: { feeds_sha256: doc.meta?.feeds_sha256 }, ...rep }, null, 1));
  console.log(`Real Causality: ${rep.overall} (${rep.windows} windows)`);
  process.exitCode = rep.overall === 'PASS' ? 0 : 1;
}
