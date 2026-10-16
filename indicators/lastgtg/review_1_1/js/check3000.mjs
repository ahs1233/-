// The 3000-bar check (reviewer, 2026-10-16): does the gate 4 copy (calc_bars_count = 3000) show
// what the original shows on TradingView's own history? ../tv/check3000_run.mjs reads both in one
// page load; this compares them on every common closed bar: lamp, reason, heading, green-episode
// start (time and direction), and where the engine runs.
//   node check3000.mjs <captureDir> <outDir> [15,60,240] [A,B,C]
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readStudy } from './gate4.mjs';
import { INPUTS } from '../../../gtg-strategy-lab/engine/profiles.mjs';

const TF_OF = { 15: 'M15', 60: 'H1', 240: 'H4' };
const sign = (x, th) => (x > th ? 1 : x < -th ? -1 : 0);
const num = (x) => (Number.isFinite(x) ? x : null);
// Comparable fields of one row (B / C frozen exports, or A's export-only lamp copy).
function fields(v, r) {
  if (v === 'A') return { lamp: num(r.m_lampA), reason: num(r.m_codeA), heading: sign(r.m_headingScore, INPUTS.headingClearThreshold), start: r.m_startA === 1, engine: (r.m_events & 128) === 128 };
  return { lamp: num(r['GTG lamp closed 0R 1Y 2G']), reason: num(r['GTG reason closed']), heading: num(r['GTG heading closed']), start: r['GTG green episode start'] === 1, engine: r['GTG confirmed engine step'] === 1 };
}
const FIELDS = ['engine', 'lamp', 'reason', 'heading', 'start'];

export function checkPair(dir, res, v) {
  const o = readStudy(join(dir, `pair_${res}_${v}_orig.json`)), d = readStudy(join(dir, `pair_${res}_${v}_diag.json`));
  const byT = new Map(d.rows.map((r) => [r.t, r]));
  const common = o.rows.filter((r) => byT.has(r.t));
  const stats = Object.fromEntries(FIELDS.map((f) => [f, { mismatched: 0, first: null, last: null, sample: [] }]));
  const startsO = [], startsD = [];
  let lastBad = -1;
  common.forEach((r, k) => {
    const a = fields(v, r), b = fields(v, byT.get(r.t));
    for (const f of FIELDS) if (a[f] !== b[f]) {
      const s = stats[f]; s.mismatched++; const at = new Date(r.t).toISOString();
      if (!s.first) s.first = at; s.last = at; if (s.sample.length < 8) s.sample.push([at, a[f], b[f]]); lastBad = k;
    }
    if (a.start) startsO.push(`${new Date(r.t).toISOString()} ${a.heading}`);
    if (b.start) startsD.push(`${new Date(r.t).toISOString()} ${b.heading}`);
  });
  const engineFirst = (rows) => { const r = rows.find((x) => fields(v, x).engine); return r ? new Date(r.t).toISOString() : null; };
  const agreeFrom = lastBad + 1 < common.length ? new Date(common[lastBad + 1].t).toISOString() : null;
  const setD = new Set(startsD), setO = new Set(startsO);
  return {
    tf: TF_OF[res], version: v,
    orig: { desc: o.meta.desc, rows: o.rows.length, first: new Date(o.rows[0].t).toISOString(), engineFrom: engineFirst(o.rows) },
    diag: { desc: d.meta.desc, rows: d.rows.length, first: new Date(d.rows[0].t).toISOString(), engineFrom: engineFirst(d.rows) },
    common: { rows: common.length, first: common.length ? new Date(common[0].t).toISOString() : null, last: common.length ? new Date(common.at(-1).t).toISOString() : null },
    fields: stats,
    identical: FIELDS.every((f) => stats[f].mismatched === 0),
    agreeFrom, agreeRows: common.length - (lastBad + 1),
    starts: { orig: startsO.length, diag: startsD.length, onlyOrig: startsO.filter((x) => !setD.has(x)), onlyDiag: startsD.filter((x) => !setO.has(x)) },
  };
}

if (process.argv[1] && process.argv[1].endsWith('check3000.mjs')) {
  const [, , dir, outDir, resArg = '15,60,240', vArg = 'A,B,C'] = process.argv;
  mkdirSync(outDir, { recursive: true });
  const all = [];
  for (const res of resArg.split(',')) for (const v of vArg.split(',')) {
    if (!existsSync(join(dir, `pair_${res}_${v}_orig.json`))) continue;
    const x = checkPair(dir, res, v); all.push(x);
    console.log(`${x.tf} ${v}: ${x.identical ? 'IDENTICAL' : 'DIFFERENT'} on ${x.common.rows} common rows (${x.common.first} → ${x.common.last}); engine orig from ${x.orig.engineFrom}, diag from ${x.diag.engineFrom}; ` +
      FIELDS.map((f) => `${f} ${x.fields[f].mismatched}${x.fields[f].mismatched ? ` (${x.fields[f].first} → ${x.fields[f].last})` : ''}`).join(', ') +
      `; agree on the last ${x.agreeRows} rows from ${x.agreeFrom}; starts ${x.starts.orig}/${x.starts.diag}, only orig ${x.starts.onlyOrig.length}, only diag ${x.starts.onlyDiag.length}`);
  }
  writeFileSync(join(outDir, 'check3000.json'), JSON.stringify(all, null, 1));
}
