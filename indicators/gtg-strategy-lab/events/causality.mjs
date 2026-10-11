// The Causality Gate (message 22 §8B, message 24 §7): future truncation and future perturbation
// invariants on the full event pipeline, with a non-vacuity requirement per family. Used by the
// synthetic tests and by the real-data CLI below. Reports counts only — never an outcome.
import { readFileSync, writeFileSync } from 'node:fs';
import { runEventPipeline } from './pipeline.mjs';
import { extractCE } from './ce.mjs';

export const FAMILIES = [
  ['TC-H1 rows', (r) => r.tcH1.rows], ['TC-H1 events', (r) => r.tcH1.events], ['H5 events', (r) => r.h5.events],
  ['CE rows', (r) => r.ce.rows], ['CE events', (r) => r.ce.events], ['CE E3', (r) => r.ce.e3], ['CE E4', (r) => r.ce.e4], ['CE abstains', (r) => r.ce.abstains],
  ['CE rows (Macro off)', (r) => r.ceAny.rows],
  ['H3', (r) => r.zone.h3], ['FLIP-1', (r) => r.zone.flip1], ['FLIP-1 unarmed', (r) => r.zone.flip1Unarmed], ['FLIP-2', (r) => r.zone.flip2], ['H4 comparator', (r) => r.zone.h4Comparator],
  ['P0', (r) => r.p0.events], ['P1', (r) => r.p1.events], ['P1-rejected', (r) => r.p1.p1Rejected], ['P2', (r) => r.p2.events],
];
// families that must have fired for a PASS (message 24 §7)
export const REQUIRED = ['TC-H1 events', 'CE events', 'FLIP-1', 'H3'];

const strip = (o) => JSON.parse(JSON.stringify(o));
const before = (list, T) => strip((list ?? []).filter((e) => e.t < T));
export const run = (feeds, opts) => { const r = runEventPipeline(feeds, opts); r.ceAny = extractCE(r.panel, { macro: () => true }); return r; };

export function compareBefore(full, other, T) {
  const diffs = [];
  if (JSON.stringify(strip(other.panel.slice(0, T))) !== JSON.stringify(strip(full.panel.slice(0, T)))) diffs.push('panel');
  for (const [name, get] of FAMILIES) if (JSON.stringify(before(get(other), T)) !== JSON.stringify(before(get(full), T))) diffs.push(name);
  return diffs;
}

// Every higher-timeframe bar is rebuilt from the M5 bars inside its interval [t_k, t_{k+1}) — the
// calendar buckets are unions of M5 bars — so a truncated or perturbed run gets HTF bars built only
// from the M5 data it has (the open HTF bar at a cut holds pre-cut data only), with the same
// summation order as the full run.
export function rebuildFromM5(m5, intervals) {
  const out = [];
  let j = 0;
  for (let k = 0; k < intervals.length; k++) {
    const a = intervals[k], b = k + 1 < intervals.length ? intervals[k + 1] : Infinity;
    while (j < m5.length && m5[j].t < a) j++;
    let bar = null;
    for (; j < m5.length && m5[j].t < b; j++) {
      const x = m5[j];
      if (!bar) bar = { t: a, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v };
      else { bar.h = Math.max(bar.h, x.h); bar.l = Math.min(bar.l, x.l); bar.c = x.c; bar.v += x.v; }
    }
    if (bar) out.push(bar);
  }
  return out;
}
const HTF = ['M15', 'H1', 'H4', 'D', 'W'];
const withM5 = (m5, intervals) => ({ M5: m5, ...Object.fromEntries(HTF.map((tf) => [tf, rebuildFromM5(m5, intervals[tf])])) });

// feeds: { M5, M15, H1, H4, D, W } of { t, o, h, l, c, v } (HTF only supply their open times).
export function causalityGate(feeds, { mintick, w, cuts = [0.55, 0.8], perturbAt = 0.7 } = {}) {
  const intervals = Object.fromEntries(HTF.map((tf) => [tf, feeds[tf].map((b) => b.t)]));
  const M5 = feeds.M5;
  const full = run(withM5(M5, intervals), { mintick, w });
  const counts = Object.fromEntries(FAMILIES.map(([n, g]) => [n, (g(full) ?? []).length]));
  const checks = [];
  for (const frac of cuts) {
    let k = Math.floor(M5.length * frac);
    while (k < M5.length - 1 && M5[k].t % 3_600_000 === 0) k++;              // inside an open H1/H4 bar
    const tCut = M5[k].t;
    const other = run(withM5(M5.slice(0, k), intervals), { mintick, w });
    checks.push({ kind: 'truncation', at: new Date(tCut).toISOString(), T: other.panel.length, diffs: compareBefore(full, other, other.panel.length) });
  }
  {
    const k = Math.floor(M5.length * perturbAt), tP = M5[k].t;
    const alt = M5.map((b, i) => (i < k ? b : { ...b, o: b.o * 1.03, h: b.h * 1.05, l: b.l * 1.01, c: b.c * 1.02, v: b.v * 3 }));
    const other = run(withM5(alt, intervals), { mintick, w });
    checks.push({ kind: 'perturbation', at: new Date(tP).toISOString(), T: k, diffs: compareBefore(full, other, k) });
  }
  const vacuous = REQUIRED.filter((n) => !(counts[n] > 0));
  const verdict = checks.some((c) => c.diffs.length) ? 'FAIL' : vacuous.length ? 'VACUOUS' : 'PASS';
  return { verdict, vacuous, counts, checks, bars: { M5: M5.length, D: feeds.D.length } };
}

// CLI: node causality.mjs feeds.json report.json [mintick] [w]
if (process.argv[1] && process.argv[1].endsWith('causality.mjs') && process.argv[2]) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const feeds = Object.fromEntries(Object.entries(doc.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))]));
  const rep = { meta: doc.meta, ...causalityGate(feeds, { mintick: Number(process.argv[4] ?? 0.001), w: Number(process.argv[5] ?? 0.3) }) };
  writeFileSync(process.argv[3], JSON.stringify(rep, null, 1));
  console.log(JSON.stringify({ verdict: rep.verdict, vacuous: rep.vacuous, counts: rep.counts, checks: rep.checks.map((c) => ({ kind: c.kind, at: c.at, diffs: c.diffs })) }, null, 1));
  process.exitCode = rep.verdict === 'PASS' ? 0 : 1;
}
