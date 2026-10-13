// Sniper entry: higher-timeframe zone, lower-timeframe structure trigger (reports/sniper_preregistration.md).
//   node --max-old-space-size=12000 structure/sniper.mjs <train_feeds.json> <oos_feeds.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { runTimeframe } from '../engine/measure.mjs';
import { atr as computeAtr } from '../engine/pine-ta.mjs';

const [, , inpTrain, inpOos, out] = process.argv;
const SPLICE = Date.parse('2023-06-05T00:00:00Z');
const MS = { M5: 300_000, M15: 900_000, H1: 3_600_000, H4: 14_400_000 };
const COMBOS = [
  { name: 'H1+M5', htf: 'H1', ltf: 'M5', inputs: ['H4', 'H4', 'D'] },
  { name: 'H4+M15', htf: 'H4', ltf: 'M15', inputs: ['D', 'D', 'W'] },
];
const MIN_RR = 2, ARM_BARS = 48, MAX_HOLD = 300, COST = 0.30, STOP_BUF = 0.1, MIN_RISK = 0.25;

const load = (p) => { const d = JSON.parse(readFileSync(p, 'utf8')); return { meta: d.meta, feeds: Object.fromEntries(Object.entries(d.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))])) }; };

function htfRows(feeds, c) {
  const [h, a1, a2] = c.inputs, rows = [];
  runTimeframe({ tf: c.htf, bars: feeds[c.htf], htfBars: feeds[h], a1Bars: feeds[a1], a2Bars: feeds[a2], mintick: 0.001, keepRows: false,
    onRow: (r) => rows.push({ t: r.t, warmed: r.warmed, atr: r.atrEng, R1: r.slots[0], S1: r.slots[2] }) });
  return rows;
}

function run(feeds, c, keep) {
  const H = htfRows(feeds, c), L = feeds[c.ltf], la = computeAtr(L, 14), hp = MS[c.htf];
  const trades = [];
  let k = -1, swingH = NaN, swingL = NaN, busy = -1;
  const arm = { 1: null, '-1': null };
  for (let j = 4; j < L.length - 1; j++) {
    while (k + 1 < H.length && H[k + 1].t + hp <= L[j].t) k++;
    // 2-bar fractals confirmed at bar j (pivot at j-2).
    const p = j - 2;
    if (L[p].h > L[p - 1].h && L[p].h > L[p - 2].h && L[p].h > L[p + 1].h && L[p].h > L[p + 2].h) swingH = L[p].h;
    if (L[p].l < L[p - 1].l && L[p].l < L[p - 2].l && L[p].l < L[p + 1].l && L[p].l < L[p + 2].l) swingL = L[p].l;
    if (k < 0 || !H[k].warmed || !(H[k].atr > 0) || !(la[j] > 0) || !keep(L[j].t)) continue;
    const row = H[k], b = L[j];
    for (const dir of [1, -1]) {
      const key = String(dir);
      let a = arm[key];
      if (a) {
        a.ext = dir > 0 ? Math.min(a.ext, b.l) : Math.max(a.ext, b.h);
        const failed = dir > 0 ? b.c < a.zone.lo - a.hAtr : b.c > a.zone.hi + a.hAtr;
        if (failed || j - a.bar > ARM_BARS) { arm[key] = a = null; }
      }
      if (!a) {
        const z = dir > 0 ? row.S1 : row.R1;
        if (z?.active && b.l <= z.hi && b.h >= z.lo) arm[key] = { zone: { lo: z.lo, hi: z.hi }, bar: j, ext: dir > 0 ? b.l : b.h, hAtr: row.atr };
        continue;
      }
      const lvl = dir > 0 ? swingH : swingL;
      if (!Number.isFinite(lvl) || !(dir > 0 ? b.c > lvl : b.c < lvl)) continue;
      arm[key] = null;
      if (j <= busy) continue;
      const opp = dir > 0 ? row.R1 : row.S1;
      if (!opp?.active) continue;
      const entry = L[j + 1].o;
      let stop = a.ext - dir * STOP_BUF * la[j];
      if (dir * (entry - stop) <= 0) continue;
      if (Math.abs(entry - stop) < MIN_RISK * la[j]) stop = entry - dir * MIN_RISK * la[j];
      const target = dir > 0 ? opp.lo : opp.hi, risk = Math.abs(entry - stop), reward = dir * (target - entry);
      if (!(reward >= MIN_RR * risk)) continue;
      let exit = NaN, m, hitT = false;
      for (m = j + 1; m < L.length; m++) {
        const x = L[m];
        if (m > j + 1 && dir * (x.o - stop) <= 0) { exit = x.o; break; }
        if (dir > 0 ? x.l <= stop : x.h >= stop) { exit = stop; break; }
        if (m > j + 1) {
          if (dir * (x.o - target) >= 0) { exit = x.o; hitT = true; break; }
          if (dir > 0 ? x.h >= target : x.l <= target) { exit = target; hitT = true; break; }
        }
        if (m - (j + 1) >= MAX_HOLD) { exit = x.c; break; }
      }
      if (Number.isNaN(exit)) continue;
      const pnl = dir * (exit - entry) - COST;
      trades.push({ t: b.t, dir, R: pnl / risk, pnl, hitT, rr: reward / risk, chance: risk / (risk + reward) });
      busy = m;
    }
  }
  return trades;
}

function stats(ts) {
  if (!ts.length) return { n: 0 };
  const pos = ts.filter((x) => x.pnl > 0).reduce((s, x) => s + x.pnl, 0), neg = -ts.filter((x) => x.pnl <= 0).reduce((s, x) => s + x.pnl, 0);
  const rr = ts.map((x) => x.rr).sort((a, b) => a - b);
  return { n: ts.length, winRate: ts.filter((x) => x.pnl > 0).length / ts.length, avgR: ts.reduce((s, x) => s + x.R, 0) / ts.length,
    profitFactor: neg > 0 ? pos / neg : Infinity, targetRate: ts.filter((x) => x.hitT).length / ts.length,
    targetChance: ts.reduce((s, x) => s + x.chance, 0) / ts.length, medianRR: rr[rr.length >> 1] };
}

const A = load(inpTrain), B = load(inpOos);
// Amendment 1: one spliced series per timeframe (Train bars before SPLICE, post-Train bars from SPLICE)
// so the H4 engine, which needs a long weekly history, is warm in the post-Train period.
const SP = { meta: B.meta, feeds: Object.fromEntries(Object.keys(B.feeds).map((tf) => [tf, [...A.feeds[tf].filter((r) => r.t < SPLICE), ...B.feeds[tf].filter((r) => r.t >= SPLICE)]])) };
const report = { prereg: 'reports/sniper_preregistration.md', feeds: { train: A.meta?.feeds_sha256, oos: B.meta?.feeds_sha256 }, combos: {} };
let valid = 0;
const fmt = (s) => s.n ? `n=${s.n} win ${(100 * s.winRate).toFixed(0)}% avg ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(3)}R PF ${s.profitFactor.toFixed(2)} median RR ${s.medianRR.toFixed(1)} target ${(100 * s.targetRate).toFixed(1)}% vs chance ${(100 * s.targetChance).toFixed(1)}%` : 'n=0';
for (const c of COMBOS) {
  const t0 = Date.now();
  const all = run(SP.feeds, c, () => true);
  const res = { train: stats(all.filter((x) => x.t < SPLICE)), post: stats(all.filter((x) => x.t >= SPLICE)) };
  res.criteria = { positiveBoth: res.train.avgR > 0 && res.post.avgR > 0, pf120: res.post.profitFactor >= 1.2, n100: res.post.n >= 100 };
  res.pass = Object.values(res.criteria).every(Boolean);
  if (res.pass) valid++;
  report.combos[c.name] = res;
  console.log(`\n=== ${c.name} (${Math.round((Date.now() - t0) / 1000)}s)`);
  console.log(`  Train: ${fmt(res.train)}`);
  console.log(`  Post : ${fmt(res.post)}  -> ${res.pass ? 'PASS' : 'fail'} ${JSON.stringify(res.criteria)}`);
}
report.verdict = valid > 0 ? 'VALID' : 'NOT_VALID';
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('\nverdict', report.verdict);
