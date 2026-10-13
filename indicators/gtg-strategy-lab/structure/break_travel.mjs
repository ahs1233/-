// Distance travelled after an accepted break (reports/break_travel_preregistration.md).
//   node --max-old-space-size=12000 structure/break_travel.mjs <train_feeds.json> <oos_feeds.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { runTimeframe } from '../engine/measure.mjs';

const [, , inpTrain, inpOos, out] = process.argv;
const SPLICE = Date.parse('2023-06-05T00:00:00Z');
const MAX_BARS = 300;
const SETUP = { M5: { inputs: ['H1', 'M15', 'H1'], thr: 1.0 }, M15: { inputs: ['H1', 'H1', 'H4'], thr: 1.0 }, H1: { inputs: ['H4', 'H4', 'D'], thr: 1.2 } };

const load = (p) => { const d = JSON.parse(readFileSync(p, 'utf8')); return { meta: d.meta, feeds: Object.fromEntries(Object.entries(d.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))])) }; };

function compactRows(feeds, tf) {
  const [htf, a1, a2] = SETUP[tf].inputs;
  const rows = [];
  runTimeframe({ tf, bars: feeds[tf], htfBars: feeds[htf], a1Bars: feeds[a1], a2Bars: feeds[a2], mintick: 0.001, keepRows: false,
    onRow: (r) => rows.push({ t: r.t, h: r.h, l: r.l, c: r.c, warmed: r.warmed, atr: r.atrEng, up: r.events.acceptedUp, dn: r.events.acceptedDn }) });
  return rows;
}

// Travel from the close of bar i in direction dir, until a pullback of thr × atr from the running extreme.
function travel(rows, i, dir, atr, thr) {
  const start = rows[i].c;
  let ext = start, end = Math.min(rows.length - 1, i + MAX_BARS);
  for (let k = i + 1; k <= Math.min(rows.length - 1, i + MAX_BARS); k++) {
    const r = rows[k];
    const adv = dir > 0 ? r.h : r.l;
    if (dir * (adv - ext) > 0) ext = adv;
    const back = dir > 0 ? r.l : r.h;
    if (dir * (ext - back) >= thr * atr) { end = k; break; }
  }
  return { dist: Math.max(0, dir * (ext - start)) / atr, end };
}

function events(rows, thr, keep) {
  const out = [];
  let busy = -1;
  for (let i = 1; i < rows.length - 1; i++) {
    const r = rows[i];
    if (!r.warmed || !(r.atr > 0) || !keep(r.t) || i <= busy) continue;
    if (!r.up && !r.dn) continue;
    const dir = r.up ? 1 : -1;
    const tr = travel(rows, i, dir, r.atr, thr);
    out.push(tr.dist);
    busy = tr.end;
  }
  return out;
}

// Comparison only: every 10th bar, fixed-seed random direction.
function baseline(rows, thr, keep) {
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = [];
  for (let i = 1; i < rows.length - 1; i += 10) {
    const r = rows[i];
    if (!r.warmed || !(r.atr > 0) || !keep(r.t)) continue;
    out.push(travel(rows, i, rnd() < 0.5 ? 1 : -1, r.atr, thr).dist);
  }
  return out;
}

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : null; };
const summ = (a) => ({ n: a.length, p25: q(a, 0.25), median: q(a, 0.5), p75: q(a, 0.75) });

const A = load(inpTrain), B = load(inpOos);
const report = { prereg: 'reports/break_travel_preregistration.md', feeds: { train: A.meta?.feeds_sha256, oos: B.meta?.feeds_sha256 }, tf: {} };
let stable = 0;
for (const tf of ['M5', 'M15', 'H1']) {
  const t0 = Date.now(), thr = SETUP[tf].thr;
  const rA = compactRows(A.feeds, tf), rB = compactRows(B.feeds, tf);
  const tr = events(rA, thr, (t) => t < SPLICE), po = events(rB, thr, (t) => t >= SPLICE);
  const res = { train: summ(tr), post: summ(po), pooled: summ([...tr, ...po]),
    baselineTrain: summ(baseline(rA, thr, (t) => t < SPLICE)), baselinePost: summ(baseline(rB, thr, (t) => t >= SPLICE)) };
  res.criteria = { n100: res.train.n >= 100 && res.post.n >= 100,
    medianWithin25: Math.abs(res.post.median - res.train.median) <= 0.25 * res.train.median };
  res.stable = res.criteria.n100 && res.criteria.medianWithin25;
  if (res.stable) stable++;
  res.seconds = Math.round((Date.now() - t0) / 1000);
  report.tf[tf] = res;
  const f = (s) => `n=${s.n} p25 ${s.p25?.toFixed(2)} median ${s.median?.toFixed(2)} p75 ${s.p75?.toFixed(2)}`;
  console.log(`\n=== ${tf} (zigzag ${thr} ATR) ${res.seconds}s`);
  console.log(`  break  Train: ${f(res.train)}`);
  console.log(`  break  Post : ${f(res.post)}`);
  console.log(`  break  All  : ${f(res.pooled)}`);
  console.log(`  random Train: ${f(res.baselineTrain)}`);
  console.log(`  random Post : ${f(res.baselinePost)}`);
  console.log(`  stable: ${res.stable} ${JSON.stringify(res.criteria)}`);
}
report.verdict = stable >= 2 ? 'USEFUL' : 'NOT_USEFUL';
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('\nverdict', report.verdict);
