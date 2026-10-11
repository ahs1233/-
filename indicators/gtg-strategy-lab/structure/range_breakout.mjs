// Range-buy / breakout-ride strategy (reports/range_breakout_preregistration.md).
//   node structure/range_breakout.mjs <train_feeds.json> <oos_feeds.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { atr as computeAtr } from '../engine/pine-ta.mjs';

const [, , inpTrain, inpOos, out] = process.argv;
const SPLICE = Date.parse('2023-06-05T00:00:00Z');
const TRAIN_END = Date.parse('2024-03-20T15:20:24.500Z');
const N = 48, MIN_H = 2, MAX_H = 8, DRIFT = 0.30, TOUCH = 0.15, ENTRY = 0.10, STOP_ATR = 0.25;
const BRK_ATR = 0.10, TRAIL_ATR = 2, MAX_HOLD = 200, COST = 0.30;

const A = JSON.parse(readFileSync(inpTrain, 'utf8')), B = JSON.parse(readFileSync(inpOos, 'utf8'));
const toBar = ([t, o, h, l, c, v]) => ({ t, o, h, l, c, v });
const feed = (tf) => [...A.feeds[tf].filter((r) => r[0] < SPLICE), ...B.feeds[tf].filter((r) => r[0] >= SPLICE)].map(toBar);

function rangeAt(bars, atr, i) {
  const a = atr[i - 1];
  if (!(a > 0)) return null;
  let H = -Infinity, L = Infinity;
  for (let k = i - N; k < i; k++) { if (bars[k].h > H) H = bars[k].h; if (bars[k].l < L) L = bars[k].l; }
  const h = H - L;
  if (h < MIN_H * a || h > MAX_H * a) return null;
  if (Math.abs(bars[i - 1].c - bars[i - N].c) > DRIFT * h) return null;
  let lowT = 0, highT = 0, inLow = false, inHigh = false;
  for (let k = i - N; k < i; k++) {
    const lo = bars[k].l <= L + TOUCH * h, hi = bars[k].h >= H - TOUCH * h;
    if (lo && !inLow) lowT++;
    if (hi && !inHigh) highT++;
    inLow = lo; inHigh = hi;
  }
  return lowT >= 2 && highT >= 2 ? { H, L, h, a } : null;
}

// mode 'ride': the pre-registered rules; mode 'fixed': same entry/stop, target at the far edge.
function backtest(bars, atr, mode) {
  const trades = [];
  let i = N + 1;
  while (i < bars.length) {
    const rg = rangeAt(bars, atr, i);
    if (!rg) { i++; continue; }
    const b = bars[i], longLvl = rg.L + ENTRY * rg.h, shortLvl = rg.H - ENTRY * rg.h;
    const longHit = b.l <= longLvl, shortHit = b.h >= shortLvl;
    if (!longHit && !shortHit) { i++; continue; }
    if (longHit && shortHit) { i++; continue; }
    const dir = longHit ? 1 : -1;
    const lvl = dir > 0 ? longLvl : shortLvl, edge = dir > 0 ? rg.L : rg.H, far = dir > 0 ? rg.H : rg.L;
    let entry;
    if (dir * (lvl - b.o) > 0) { if (dir * (b.o - edge) <= 0) { i++; continue; } entry = b.o; } else entry = lvl;
    const a = rg.a, stop0 = edge - dir * STOP_ATR * a;
    let stop = stop0, be = false, cnt = 0, broke = false, best = NaN, exit = NaN, k = i;
    const hitStop = (bar) => (dir > 0 ? bar.l <= stop : bar.h >= stop);
    if (hitStop(b)) exit = stop;
    for (k = i + 1; Number.isNaN(exit) && k < bars.length; k++) {
      const x = bars[k];
      if (dir * (x.o - stop) <= 0) { exit = x.o; break; }
      if (hitStop(x)) { exit = stop; break; }
      if (mode === 'fixed') {
        if (dir > 0 ? x.h >= far : x.l <= far) { exit = far; break; }
      } else {
        if (!be && (dir > 0 ? x.h >= far : x.l <= far)) { stop = dir > 0 ? Math.max(stop, entry) : Math.min(stop, entry); be = true; }
        if (!broke) {
          cnt = dir * (x.c - (far + dir * BRK_ATR * a)) > 0 ? cnt + 1 : 0;
          if (cnt >= 2) { broke = true; best = x.c; }
        }
        if (broke) {
          best = dir > 0 ? Math.max(best, x.c) : Math.min(best, x.c);
          const trail = [far - dir * STOP_ATR * a, best - dir * TRAIL_ATR * a];
          stop = dir > 0 ? Math.max(stop, ...trail) : Math.min(stop, ...trail);
        }
      }
      if (k - i >= MAX_HOLD) { exit = x.c; break; }
    }
    if (Number.isNaN(exit)) break;
    const risk = Math.abs(entry - stop0), pnl = dir * (exit - entry) - COST;
    trades.push({ t: b.t, dir, entry, exit, risk, pnl, R: pnl / risk, broke, bars: k - i, h: rg.h, reward: Math.abs(far - entry), hitFar: dir * (exit - far) >= 0 });
    i = Math.max(k, i) + 1;
  }
  return trades;
}

function stats(ts) {
  if (!ts.length) return { n: 0 };
  const pos = ts.filter((x) => x.pnl > 0).reduce((s, x) => s + x.pnl, 0), neg = -ts.filter((x) => x.pnl <= 0).reduce((s, x) => s + x.pnl, 0);
  let cum = 0, peak = 0, dd = 0;
  for (const x of ts) { cum += x.R; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  const br = ts.filter((x) => x.broke);
  return { n: ts.length, winRate: ts.filter((x) => x.pnl > 0).length / ts.length, avgR: ts.reduce((s, x) => s + x.R, 0) / ts.length,
    avgUsd: ts.reduce((s, x) => s + x.pnl, 0) / ts.length, totalR: cum, profitFactor: neg > 0 ? pos / neg : Infinity, maxDrawdownR: dd,
    medianRiskUsd: [...ts.map((x) => x.risk)].sort((p, q) => p - q)[ts.length >> 1], breakoutShare: br.length / ts.length,
    breakoutAvgR: br.length ? br.reduce((s, x) => s + x.R, 0) / br.length : null,
    // Exploratory: share of trades that reached the far edge vs the random-walk chance risk / (risk + reward).
    farEdgeRate: ts.filter((x) => x.hitFar).length / ts.length, farEdgeChance: ts.reduce((s, x) => s + x.risk / (x.risk + x.reward), 0) / ts.length };
}

const report = { prereg: 'reports/range_breakout_preregistration.md', feeds: { train: A.meta?.feeds_sha256, oos: B.meta?.feeds_sha256 }, tf: {} };
let profitable = 0;
const fmt = (s) => s.n ? `n=${s.n} win ${(100 * s.winRate).toFixed(0)}% avg ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(3)}R (${s.avgUsd >= 0 ? '+' : ''}${s.avgUsd.toFixed(2)}$) PF ${s.profitFactor.toFixed(2)} total ${s.totalR.toFixed(0)}R maxDD ${s.maxDrawdownR.toFixed(0)}R risk~${s.medianRiskUsd.toFixed(1)}$ breakouts ${(100 * s.breakoutShare).toFixed(0)}%${s.breakoutAvgR != null ? ` (avg ${s.breakoutAvgR.toFixed(2)}R)` : ''}` : 'n=0';
for (const tf of ['M5', 'M15', 'H1']) {
  const bars = feed(tf), atr = computeAtr(bars, 14);
  const res = {};
  for (const mode of ['ride', 'fixed']) {
    const ts = backtest(bars, atr, mode);
    res[mode] = { train: stats(ts.filter((x) => x.t < TRAIN_END)), post: stats(ts.filter((x) => x.t >= TRAIN_END)),
      byYear: Object.fromEntries([...new Set(ts.map((x) => new Date(x.t).getUTCFullYear()))].map((y) => [y, stats(ts.filter((x) => new Date(x.t).getUTCFullYear() === y))])) };
  }
  const r = res.ride;
  res.criteria = { positiveBoth: r.train.avgR > 0 && r.post.avgR > 0, pf120: r.post.profitFactor >= 1.2, n100: r.post.n >= 100 };
  if (Object.values(res.criteria).every(Boolean)) profitable++;
  report.tf[tf] = res;
  console.log(`\n=== ${tf} ===`);
  console.log(`  ride  Train: ${fmt(r.train)}`);
  console.log(`  ride  Post : ${fmt(r.post)}`);
  console.log(`  fixed Train: ${fmt(res.fixed.train)}`);
  console.log(`  fixed Post : ${fmt(res.fixed.post)}`);
  console.log(`  fixed: reached the far edge Train ${(100 * res.fixed.train.farEdgeRate).toFixed(1)}% vs chance ${(100 * res.fixed.train.farEdgeChance).toFixed(1)}% | Post ${(100 * res.fixed.post.farEdgeRate).toFixed(1)}% vs chance ${(100 * res.fixed.post.farEdgeChance).toFixed(1)}%`);
  console.log(`  ride by year avgR: ${Object.entries(r.byYear).map(([y, s]) => `${y} ${s.avgR.toFixed(2)}`).join(' | ')}`);
  console.log(`  criteria: ${JSON.stringify(res.criteria)}`);
}
report.verdict = profitable > 0 ? 'PROFITABLE' : 'NOT_PROFITABLE';
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('\nverdict', report.verdict);
