// Engineering Smoke Test — NOT RESEARCH EVIDENCE (GPT message 38).
// Runs the feeds checks, the full event pipeline and the Causality Gate on real feeds and reports
// PASS/FAIL per check only. No count, rate, timing distribution, outcome, power or edge is printed
// or written: the data may lie in the Historical Holdout. Non-vacuity is checked internally; a
// failure names the family, never a number. Nothing here may change H1–H5, event conditions or
// the research window.
import { readFileSync, writeFileSync } from 'node:fs';
import { causalityGate, rebuildFromM5, run, FAMILIES, REQUIRED } from './causality.mjs';

export const LABEL = 'Engineering Smoke Test — NOT RESEARCH EVIDENCE';
const TFS = ['M5', 'M15', 'H1', 'H4', 'D', 'W'];
const CLOCK = { M5: 300_000, M15: 900_000, H1: 3_600_000 };
const HTF = ['M15', 'H1', 'H4', 'D', 'W'];

export function feedErrors(feeds) {
  const errs = [];
  for (const tf of TFS) {
    const f = feeds[tf];
    if (!f?.length) { errs.push(`${tf}: empty`); continue; }
    for (let i = 0; i < f.length; i++) {
      const b = f[i];
      if (![b.t, b.o, b.h, b.l, b.c, b.v].every(Number.isFinite)) { errs.push(`${tf}: non-finite value`); break; }
      if (i && !(b.t > f[i - 1].t)) { errs.push(`${tf}: time not strictly increasing`); break; }
      if (CLOCK[tf] && b.t % CLOCK[tf] !== 0) { errs.push(`${tf}: bar not on its clock boundary`); break; }
      if (!(b.l <= Math.min(b.o, b.c) && Math.max(b.o, b.c) <= b.h) || b.v < 0) { errs.push(`${tf}: OHLC/volume inconsistent`); break; }
    }
  }
  return errs;
}

// every HTF bar must be the union of the M5 bars inside it (same calendar, same data)
export function aggregationErrors(feeds) {
  const errs = [];
  for (const tf of HTF) {
    const re = rebuildFromM5(feeds.M5, feeds[tf].map((b) => b.t));
    if (re.length !== feeds[tf].length) { errs.push(`${tf}: bar without M5 content`); continue; }
    const bad = re.findIndex((r, i) => {
      const b = feeds[tf][i];
      return r.o !== b.o || r.h !== b.h || r.l !== b.l || r.c !== b.c || Math.abs(r.v - b.v) > 1e-9 * Math.max(1, Math.abs(b.v));
    });
    if (bad >= 0) errs.push(`${tf}: differs from its M5 bars at ${new Date(feeds[tf][bad].t).toISOString()}`);
  }
  return errs;
}

function nonFinite(x, path = 'panel', seen = new Set()) {
  if (typeof x === 'number') return Number.isFinite(x) ? null : path;
  if (!x || typeof x !== 'object' || seen.has(x)) return null;
  seen.add(x);
  for (const [k, v] of Object.entries(x)) { const p = nonFinite(v, `${path}.${k}`, seen); if (p) return p; }
  return null;
}

export function engineErrors(r, feeds) {
  const errs = [];
  const M5 = feeds.M5;
  if (r.panel.length !== M5.length) errs.push('panel length ≠ M5 bars');
  if (r.panel.some((p, i) => p.t !== M5[i].t)) errs.push('panel time ≠ M5 time');
  const nf = r.panel.map((p) => nonFinite({ o: p.o, h: p.h, l: p.l, c: p.c })).find(Boolean);
  if (nf) errs.push(`NaN/Infinity in ${nf}`);
  // ATR series are na (NaN) until their length is filled, as in Pine; once defined they stay defined
  for (const k of ['atr', 'atrEng']) {
    const first = r.panel.findIndex((p) => Number.isFinite(p[k]));
    if (first < 0 || r.panel.slice(first).some((p) => !Number.isFinite(p[k]))) errs.push(`panel.${k}: NaN/Infinity after its warm-up prefix`);
  }
  for (const [name, get] of FAMILIES) {
    const list = get(r) ?? [];
    let prev = -1;
    for (const e of list) {
      if (!Number.isInteger(e.t) || e.t < 0 || e.t >= M5.length) { errs.push(`${name}: bar index out of range`); break; }
      if (e.time !== undefined && e.time !== M5[e.t].t) { errs.push(`${name}: time ≠ bar time`); break; }
      if (e.t < prev) { errs.push(`${name}: not in time order`); break; }
      prev = e.t;
    }
  }
  const vacuous = REQUIRED.filter((n) => !((FAMILIES.find(([k]) => k === n)[1](r) ?? []).length > 0));
  if (vacuous.length) errs.push(`no events generated: ${vacuous.join(', ')}`);
  return errs;
}

const verdict = (errs) => (errs.length ? 'FAIL' : 'PASS');

export function smokeTest(feeds, { mintick, w }) {
  const out = { label: LABEL, checks: [] };
  const add = (name, errs) => out.checks.push({ name, status: verdict(errs), errors: errs });
  add('Feeds', feedErrors(feeds));
  add('Aggregation', aggregationErrors(feeds));
  try {
    add('Event Engine', engineErrors(run(feeds, { mintick, w }), feeds));
  } catch (e) {
    add('Event Engine', [`crash: ${e.message}`]);
  }
  try {
    const g = causalityGate(feeds, { mintick, w });
    const errs = g.checks.filter((c) => c.diffs.length).map((c) => `${c.kind} at ${c.at}: ${c.diffs.join(', ')}`);
    if (g.vacuous.length) errs.push(`vacuous: ${g.vacuous.join(', ')}`);
    add('Causality', errs);
  } catch (e) {
    add('Causality', [`crash: ${e.message}`]);
  }
  out.verdict = out.checks.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL';
  return out;
}

// CLI: node smoke.mjs feeds.json report.json [mintick] [w]
if (process.argv[1] && process.argv[1].endsWith('smoke.mjs') && process.argv[2]) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const feeds = Object.fromEntries(Object.entries(doc.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))]));
  const rep = smokeTest(feeds, { mintick: Number(process.argv[4] ?? 0.001), w: Number(process.argv[5] ?? 0.3) });
  rep.input = { feeds_sha256: doc.meta?.feeds_sha256, first: doc.meta?.first, last: doc.meta?.last };
  writeFileSync(process.argv[3], JSON.stringify(rep, null, 1));
  console.log(LABEL);
  for (const c of rep.checks) console.log(`${c.name}: ${c.status}${c.errors.length ? ' — ' + c.errors.join('; ') : ''}`);
  console.log(`Smoke: ${rep.verdict}`);
  process.exitCode = rep.verdict === 'PASS' ? 0 : 1;
}
