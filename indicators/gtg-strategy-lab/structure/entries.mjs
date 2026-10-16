// Three confirmed-entry types (reports/entries_preregistration.md).
//   node --max-old-space-size=12000 structure/entries.mjs <train_feeds.json> <oos_feeds.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { runTimeframe } from '../engine/measure.mjs';
import { detectSwings } from './segmentation.mjs';

const [, , inpTrain, inpOos, out] = process.argv;
const SPLICE = Date.parse('2023-06-05T00:00:00Z');
const MIN_RISK_ATR = 0.25, BUF_ATR = 0.25, MAX_HOLD = 200, COST = 0.30;
const SETUP = { M5: { inputs: ['H1', 'M15', 'H1'], thr: 1.0 }, M15: { inputs: ['H1', 'H1', 'H4'], thr: 1.0 }, H1: { inputs: ['H4', 'H4', 'D'], thr: 1.2 } };

const load = (p) => { const d = JSON.parse(readFileSync(p, 'utf8')); return { meta: d.meta, feeds: Object.fromEntries(Object.entries(d.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))])) }; };

function compactRows(feeds, tf) {
  const [htf, a1, a2] = SETUP[tf].inputs;
  const rows = [];
  runTimeframe({ tf, bars: feeds[tf], htfBars: feeds[htf], a1Bars: feeds[a1], a2Bars: feeds[a2], mintick: 0.001, keepRows: false,
    onRow: (r) => rows.push({ t: r.t, warmed: r.warmed, atr: r.atrEng, rejR: r.events.rejectR, rejS: r.events.rejectS, R1: r.slots[0], S1: r.slots[2] }) });
  return rows;
}

// Trade from signal bar i: entry at the next open; stop/target fixed. Returns null when skipped.
function sim(bars, i, dir, stop, target, atr) {
  if (i + 1 >= bars.length || !(atr > 0)) return null;
  const entry = bars[i + 1].o;
  if (dir * (entry - stop) <= 0) return null;
  if (Math.abs(entry - stop) < MIN_RISK_ATR * atr) stop = entry - dir * MIN_RISK_ATR * atr;
  const risk = Math.abs(entry - stop), reward = dir * (target - entry);
  if (!(reward >= risk)) return null;
  let exit = NaN, k, hitT = false;
  for (k = i + 1; k < bars.length; k++) {
    const b = bars[k];
    if (k > i + 1 && dir * (b.o - stop) <= 0) { exit = b.o; break; }
    if (dir > 0 ? b.l <= stop : b.h >= stop) { exit = stop; break; }
    if (k > i + 1) {
      if (dir * (b.o - target) >= 0) { exit = b.o; hitT = true; break; }
      if (dir > 0 ? b.h >= target : b.l <= target) { exit = target; hitT = true; break; }
    }
    if (k - (i + 1) >= MAX_HOLD) { exit = b.c; break; }
  }
  if (Number.isNaN(exit)) return null;
  const pnl = dir * (exit - entry) - COST;
  return { t: bars[i].t, dir, R: pnl / risk, pnl, hitT, chance: risk / (risk + reward), end: k };
}

function typeA(bars, rows, keep) {
  const ts = []; let busy = -1;
  for (let i = 1; i < rows.length - 1; i++) {
    const r = rows[i], p = rows[i - 1];
    if (!r.warmed || !(r.atr > 0) || !keep(r.t) || i <= busy || r.rejR === r.rejS) continue;
    let tr = null;
    if (r.rejR && p.R1?.active && bars[i].h >= p.R1.lo && r.S1?.active)
      tr = sim(bars, i, -1, Math.max(p.R1.hi, bars[i].h) + BUF_ATR * r.atr, r.S1.hi, r.atr);
    if (r.rejS && p.S1?.active && bars[i].l <= p.S1.hi && r.R1?.active)
      tr = sim(bars, i, 1, Math.min(p.S1.lo, bars[i].l) - BUF_ATR * r.atr, r.R1.lo, r.atr);
    if (tr) { ts.push(tr); busy = tr.end; }
  }
  return ts;
}

function typeC(bars, rows, keep) {
  const ts = []; let busy = -1;
  for (let i = 1; i < rows.length - 4; i++) {
    const r = rows[i], p = rows[i - 1];
    if (!r.warmed || !(r.atr > 0) || !keep(r.t) || i <= busy) continue;
    for (const [Z, dir] of [[p.R1, -1], [p.S1, 1]]) {
      if (!Z?.active || Z.containing) continue;
      const broke = dir < 0 ? bars[i].c > Z.hi : bars[i].c < Z.lo;
      if (!broke) continue;
      let ext = dir < 0 ? bars[i].h : bars[i].l;
      for (let j = i + 1; j <= i + 3; j++) {
        ext = dir < 0 ? Math.max(ext, bars[j].h) : Math.min(ext, bars[j].l);
        const back = dir < 0 ? bars[j].c < Z.hi : bars[j].c > Z.lo;
        if (!back) continue;
        const rj = rows[j], opp = dir < 0 ? rj.S1 : rj.R1;
        if (opp?.active && rj.atr > 0) {
          const tr = sim(bars, j, dir, ext - dir * BUF_ATR * rj.atr, dir < 0 ? opp.hi : opp.lo, rj.atr);
          if (tr) { ts.push(tr); busy = tr.end; }
        }
        break;
      }
      if (i <= busy) break;
    }
  }
  return ts;
}

function typeB(bars, thr, keep) {
  const { swings, atr } = detectSwings(bars, { atrLen: 14, threshold: thr });
  const ts = []; let busy = -1;
  for (let k = 1; k < swings.length; k++) {
    const p = swings[k - 1], s = swings[k];
    const span = s.price - p.price, a0 = atr[p.bar];
    if (!(a0 > 0) || Math.abs(span) < 4 * a0) continue;
    const dir = span > 0 ? 1 : -1, c = s.confirmBar;
    if (!keep(bars[c].t) || c <= busy) continue;
    const l45 = s.price - 0.45 * span;
    let entered = false, deep = NaN;
    for (let j = c; j <= Math.min(bars.length - 2, c + 60); j++) {
      const b = bars[j];
      if (dir > 0 ? b.h > s.price : b.l < s.price) break;
      if (dir > 0 ? b.l <= p.price : b.h >= p.price) break;
      if (!entered && (dir > 0 ? b.l <= l45 : b.h >= l45)) { entered = true; deep = dir > 0 ? b.l : b.h; }
      if (entered) deep = dir > 0 ? Math.min(deep, b.l) : Math.max(deep, b.h);
      if (entered && j > c && (dir > 0 ? b.c > bars[j - 1].h : b.c < bars[j - 1].l)) {
        const tr = j > busy ? sim(bars, j, dir, deep - dir * BUF_ATR * atr[j], s.price, atr[j]) : null;
        if (tr) { ts.push(tr); busy = tr.end; }
        break;
      }
    }
  }
  return ts;
}

function stats(ts) {
  if (!ts.length) return { n: 0 };
  const pos = ts.filter((x) => x.pnl > 0).reduce((s, x) => s + x.pnl, 0), neg = -ts.filter((x) => x.pnl <= 0).reduce((s, x) => s + x.pnl, 0);
  return { n: ts.length, winRate: ts.filter((x) => x.pnl > 0).length / ts.length, avgR: ts.reduce((s, x) => s + x.R, 0) / ts.length,
    profitFactor: neg > 0 ? pos / neg : Infinity, targetRate: ts.filter((x) => x.hitT).length / ts.length,
    targetChance: ts.reduce((s, x) => s + x.chance, 0) / ts.length };
}

const A = load(inpTrain), B = load(inpOos);
const report = { prereg: 'reports/entries_preregistration.md', feeds: { train: A.meta?.feeds_sha256, oos: B.meta?.feeds_sha256 }, tf: {} };
const passes = { A: 0, B: 0, C: 0 };
const fmt = (s) => s.n ? `n=${s.n} win ${(100 * s.winRate).toFixed(0)}% avg ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(3)}R PF ${s.profitFactor.toFixed(2)} target ${(100 * s.targetRate).toFixed(1)}% vs chance ${(100 * s.targetChance).toFixed(1)}%` : 'n=0';
for (const tf of ['M5', 'M15', 'H1']) {
  const t0 = Date.now(), thr = SETUP[tf].thr;
  const bA = A.feeds[tf], bB = B.feeds[tf];
  const rA = compactRows(A.feeds, tf), rB = compactRows(B.feeds, tf);
  const pre = (t) => t < SPLICE, post = (t) => t >= SPLICE;
  const res = {
    A: { train: stats(typeA(bA, rA, pre)), post: stats(typeA(bB, rB, post)) },
    B: { train: stats(typeB(bA, thr, pre)), post: stats(typeB(bB, thr, post)) },
    C: { train: stats(typeC(bA, rA, pre)), post: stats(typeC(bB, rB, post)) },
  };
  console.log(`\n=== ${tf} (${Math.round((Date.now() - t0) / 1000)}s)`);
  for (const k of ['A', 'B', 'C']) {
    const r = res[k];
    r.criteria = { positiveBoth: r.train.avgR > 0 && r.post.avgR > 0, pf120: r.post.profitFactor >= 1.2, n100: r.post.n >= 100 };
    r.pass = Object.values(r.criteria).every(Boolean);
    if (r.pass) passes[k]++;
    console.log(`  ${k} Train: ${fmt(r.train)}`);
    console.log(`  ${k} Post : ${fmt(r.post)}  -> ${r.pass ? 'PASS' : 'fail'} ${JSON.stringify(r.criteria)}`);
  }
  report.tf[tf] = res;
}
report.verdict = Object.fromEntries(Object.entries(passes).map(([k, v]) => [k, v >= 2 ? 'VALID' : 'NOT_VALID']));
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('\nverdict', JSON.stringify(report.verdict));
