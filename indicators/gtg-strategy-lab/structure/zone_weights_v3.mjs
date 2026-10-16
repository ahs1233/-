// Zone and momentum weights v3: year weights + RSI + walk-forward exams on 2025 and 2026
// (reports/zone_weights_v3_preregistration.md). Events and outcome are those of v1/v2.
//   node --max-old-space-size=12000 structure/zone_weights_v3.mjs <train_feeds.json> <oos_feeds.json> <out.json> [mintick]
import { readFileSync, writeFileSync } from 'node:fs';
import { runTimeframe } from '../engine/measure.mjs';

const [, , inpTrain, inpOos, out, mt] = process.argv;
const MINTICK = Number(mt ?? 0.001);
const HORIZON = 48;
const SPLICE = Date.parse('2023-06-05T00:00:00Z');
const RANK_W = [25, 20, 16, 13, 10, 8, 5, 2, 1];
const INPUTS_OF = { M15: ['H1', 'H1', 'H4'], H1: ['H4', 'H4', 'D'] };
const BAR_MS = { M15: 900_000, H1: 3_600_000 };
const VP_LEN = 500, VP_BIN = 0.25;

// Train feeds before SPLICE, post-Train feeds from SPLICE (identical where they overlap).
const docA = JSON.parse(readFileSync(inpTrain, 'utf8')), docB = JSON.parse(readFileSync(inpOos, 'utf8'));
const doc = { meta: { train: docA.meta?.feeds_sha256, oos: docB.meta?.feeds_sha256 } };
const toBar = ([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol });
const feeds = Object.fromEntries(Object.keys(docA.feeds).map((k) => [k,
  [...docA.feeds[k].filter((r) => r[0] < SPLICE), ...docB.feeds[k].filter((r) => r[0] >= SPLICE)].map(toBar)]));

const tfRankOf = (key) => Math.floor(((key % 32) % 6) / 2);
const birthOf = (key) => Math.floor(key / 32);

function compactRows(tf) {
  const [htf, a1, a2] = INPUTS_OF[tf];
  const rows = [];
  runTimeframe({ tf, bars: feeds[tf], htfBars: feeds[htf], a1Bars: feeds[a1], a2Bars: feeds[a2], mintick: MINTICK, keepRows: false,
    onRow: (r) => rows.push({ t: r.t, h: r.h, l: r.l, c: r.c, warmed: r.warmed, atrEng: r.atrEng,
      speed: r.speedScore, fuel: r.fuelScore, fuelAcc: r.fuelAcceleration, heading: r.headingScore, route: r.routeScore,
      v: r.v, ma50: r.ma50, ma200: r.ma200, ma1000: r.ma1000,
      R1: r.slots[0], S1: r.slots[2] }) });
  // RSI(14), Wilder smoothing on closes (the first value at bar 14).
  let up = 0, dn = 0;
  for (let i = 0; i < rows.length; i++) {
    rows[i].rsi = NaN;
    if (i === 0) continue;
    const ch = rows[i].c - rows[i - 1].c, u = Math.max(ch, 0), d = Math.max(-ch, 0);
    if (i <= 14) { up += u / 14; dn += d / 14; } else { up = (up * 13 + u) / 14; dn = (dn * 13 + d) / 14; }
    if (i >= 14) rows[i].rsi = dn === 0 ? 100 : 100 - 100 / (1 + up / dn);
  }
  return rows;
}

const cap = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function maFeatures(rows, i, z, dir, atr) {
  const p = rows[i - 1], mid = (z.lo + z.hi) / 2;
  const near = (m) => m >= z.lo - 0.25 * atr && m <= z.hi + 0.25 * atr;
  return [
    Math.min(10, Math.abs(p.ma50 - mid) / atr), Math.min(10, Math.abs(p.ma200 - mid) / atr), Math.min(10, Math.abs(p.ma1000 - mid) / atr),
    near(p.ma50) || near(p.ma200) || near(p.ma1000) ? 1 : 0,
    cap(dir * (p.c - p.ma200) / atr, -10, 10),
    dir * (p.ma50 - rows[i - 6].ma50) / atr,
  ];
}

// Volume of bars i−VP_LEN … i−1 spread evenly over each bar's range, in bins of VP_BIN·ATR.
function vpFeatures(rows, i, z, dir, atr) {
  const a = Math.max(0, i - VP_LEN), bin = VP_BIN * atr;
  let lo = Infinity, hi = -Infinity;
  for (let k = a; k < i; k++) { lo = Math.min(lo, rows[k].l); hi = Math.max(hi, rows[k].h); }
  const n = Math.max(1, Math.ceil((hi - lo) / bin)), vol = new Float64Array(n);
  for (let k = a; k < i; k++) {
    const r = rows[k], v = r.v > 0 ? r.v : 0;
    const b0 = Math.min(n - 1, Math.floor((r.l - lo) / bin)), b1 = Math.min(n - 1, Math.floor((r.h - lo) / bin));
    for (let b = b0; b <= b1; b++) vol[b] += v / (b1 - b0 + 1);
  }
  const total = vol.reduce((s, x) => s + x, 0), avg = total / n;
  const density = (x0, x1) => {
    const b0 = cap(Math.floor((Math.min(x0, x1) - lo) / bin), 0, n - 1), b1 = cap(Math.floor((Math.max(x0, x1) - lo) / bin), 0, n - 1);
    let s = 0; for (let b = b0; b <= b1; b++) s += vol[b];
    return s / (b1 - b0 + 1);
  };
  let poc = 0; for (let b = 1; b < n; b++) if (vol[b] > vol[poc]) poc = b;
  const order = [...vol.keys()].sort((x, y) => vol[y] - vol[x]), inVA = new Uint8Array(n);
  let acc = 0; for (const b of order) { if (acc >= 0.7 * total) break; inVA[b] = 1; acc += vol[b]; }
  const mid = (z.lo + z.hi) / 2, midBin = cap(Math.floor((mid - lo) / bin), 0, n - 1);
  const pocPx = lo + (poc + 0.5) * bin, c = rows[i - 1].c, nearEdge = dir > 0 ? z.lo : z.hi;
  const lg = (x) => Math.log((x + 1e-12) / (avg + 1e-12));
  return [
    avg > 0 ? lg(density(z.lo, z.hi)) : 0,
    Math.min(20, Math.abs(mid - pocPx) / atr),
    inVA[midBin],
    avg > 0 && Math.abs(nearEdge - c) >= bin ? lg(density(c, nearEdge)) : 0,
  ];
}

function arrivals(tf, rows) {
  const ev = [];
  const busyUntil = new Map();
  for (let i = 7; i < rows.length - 1; i++) {
    const p = rows[i - 1], r = rows[i];
    if (!p.warmed || !r.warmed || !(p.atrEng > 0)) continue;
    for (const [z, dir] of [[p.R1, 1], [p.S1, -1]]) {
      if (!z || !z.active || z.containing) continue;
      const touched = dir > 0 ? r.h >= z.lo : r.l <= z.hi;
      if (!touched) continue;
      if ((busyUntil.get(z.primaryKey) ?? -1) >= i) continue;
      const atr = p.atrEng;
      let outcome = 'none', end = Math.min(rows.length - 1, i + HORIZON - 1);
      for (let k = i; k <= Math.min(rows.length - 1, i + HORIZON - 1); k++) {
        const c = rows[k].c;
        const brk = dir > 0 ? c >= z.hi + atr : c <= z.lo - atr;
        const rej = dir > 0 ? c <= z.lo - atr : c >= z.hi + atr;
        if (brk) { outcome = 'break'; end = k; break; }
        if (rej) { outcome = 'reject'; end = k; break; }
      }
      busyUntil.set(z.primaryKey, end);
      const keys = z.lastKeys ?? [];
      ev.push({
        t: r.t, tf, outcome,
        zone: [z.displayQ / 100, z.gateQ / 100, (z.hi - z.lo) / atr, keys.length,
          keys.some((k) => tfRankOf(k) > 0) ? 1 : 0, Math.log1p(Math.max(0, (p.t - birthOf(z.primaryKey)) / BAR_MS[tf]))],
        move: [p.speed / 100, p.fuel / 100, p.fuelAcc / 100, dir * p.heading / 100, dir * p.route / 100, dir * (p.c - rows[i - 7].c) / atr],
        ma: maFeatures(rows, i, z, dir, atr),
        vp: vpFeatures(rows, i, z, dir, atr),
        rsi: [dir * (p.rsi - 50) / 50, dir * (p.rsi - rows[i - 7].rsi) / 50],
        year: new Date(r.t).getUTCFullYear(),
      });
    }
  }
  return ev;
}

// L2-regularised logistic regression by Newton iterations on standardised features.
function fitLogit(X, y, lambda = 1e-3, sw = null) {
  const n = X.length, d = X[0].length + 1;
  const W = sw ?? new Array(n).fill(1), wsum = W.reduce((a, b) => a + b, 0);
  let w = new Array(d).fill(0);
  for (let it = 0; it < 50; it++) {
    const g = new Array(d).fill(0), H = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let r = 0; r < n; r++) {
      const x = [1, ...X[r]];
      const z = x.reduce((s, v, j) => s + v * w[j], 0), pr = 1 / (1 + Math.exp(-z)), s = pr * (1 - pr);
      for (let a = 0; a < d; a++) { g[a] += W[r] * (pr - y[r]) * x[a]; for (let b = 0; b < d; b++) H[a][b] += W[r] * s * x[a] * x[b]; }
    }
    for (let a = 1; a < d; a++) { g[a] += lambda * wsum * w[a]; H[a][a] += lambda * wsum; }
    const step = solve(H, g);
    w = w.map((v, j) => v - step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return w;
}
function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}
const predict = (w, X) => X.map((x) => 1 / (1 + Math.exp(-(w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0)))));
function auc(p, y) {
  const idx = p.map((v, i) => [v, y[i]]).sort((a, b) => a[0] - b[0]);
  let rank = 0, sumPos = 0, nPos = 0;
  for (let i = 0; i < idx.length;) {
    let j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (idx[k][1] === 1) { sumPos += avg; nPos++; }
    i = j; rank = j;
  }
  const nNeg = idx.length - nPos;
  return (sumPos - nPos * (nPos + 1) / 2) / (nPos * nNeg);
}
function terciles(p, y) {
  const s = p.map((v, i) => [v, y[i]]).sort((a, b) => a[0] - b[0]), k = Math.floor(s.length / 3);
  const rate = (a) => a.reduce((x, e) => x + e[1], 0) / a.length;
  return { low: rate(s.slice(0, k)), mid: rate(s.slice(k, s.length - k)), high: rate(s.slice(s.length - k)) };
}
function standardiser(X) {
  const d = X[0].length, mu = [], sd = [];
  for (let j = 0; j < d; j++) {
    const v = X.map((x) => x[j]), m = v.reduce((a, b) => a + b, 0) / v.length;
    mu.push(m); sd.push(Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1);
  }
  return { mu, sd, apply: (X2) => X2.map((x) => x.map((v, j) => (v - mu[j]) / sd[j])) };
}

const ZONE_NAMES = ['displayQ', 'gateQ', 'widthAtr', 'members', 'hasAnchor', 'logAge'];
const MOVE_NAMES = ['speed', 'fuel', 'fuelAcc', 'headingToward', 'routeToward', 'approach6'];
const MA_NAMES = ['distMA50', 'distMA200', 'distMA1000', 'maInZone', 'priceVsMA200Toward', 'ma50SlopeToward'];
const VP_NAMES = ['zoneDensityLog', 'distPOC', 'zoneInValueArea', 'pathDensityLog'];
const RSI_NAMES = ['rsiToward', 'rsiChange6Toward'];
const GROUPS = { zone: ZONE_NAMES, move: MOVE_NAMES, ma: MA_NAMES, vp: VP_NAMES, rsi: RSI_NAMES };
const NAMES = [...ZONE_NAMES, ...MOVE_NAMES, ...MA_NAMES, ...VP_NAMES, ...RSI_NAMES];
const feat = (e) => [...e.zone, ...e.move, ...e.ma, ...e.vp, ...e.rsi];
const yOf = (e) => (e.outcome === 'break' ? 1 : 0);

// Sample weights: recency rank of the year inside the learning set (latest = 25%, …),
// renormalised over the years present, split evenly over each year's arrivals.
function yearWeights(evs) {
  const years = [...new Set(evs.map((e) => e.year))].sort((a, b) => b - a);
  const raw = years.map((_, k) => RANK_W[Math.min(k, RANK_W.length - 1)]), tot = raw.reduce((a, b) => a + b, 0);
  const share = Object.fromEntries(years.map((y, k) => [y, raw[k] / tot]));
  const cnt = {}; for (const e of evs) cnt[e.year] = (cnt[e.year] ?? 0) + 1;
  const n = evs.length;
  return { share, w: evs.map((e) => share[e.year] / cnt[e.year] * n) };
}

function exam(evs, testYear, weighted) {
  const learn = evs.filter((e) => e.year < testYear), test = evs.filter((e) => e.year === testYear);
  const st = standardiser(learn.map(feat));
  const yw = yearWeights(learn);
  const w = fitLogit(st.apply(learn.map(feat)), learn.map(yOf), 1e-3, weighted ? yw.w : null);
  const p = predict(w, st.apply(test.map(feat))), y = test.map(yOf);
  const tr = terciles(p, y);
  return { learnN: learn.length, testN: test.length, breakRateTest: y.reduce((a, b) => a + b, 0) / y.length,
    yearShare: weighted ? yw.share : null, auc: auc(p, y), terciles: tr,
    pass: { auc060: auc(p, y) >= 0.60, spread15: tr.high - tr.low >= 0.15 } };
}

const report = { prereg: 'reports/zone_weights_v3_preregistration.md', mintick: MINTICK, feeds: doc.meta, splice: new Date(SPLICE).toISOString(), vp: { len: VP_LEN, binAtr: VP_BIN }, tf: {} };
let passes = 0;
for (const tf of ['M15', 'H1']) {
  const t0 = Date.now();
  const rows = compactRows(tf);
  const ev = arrivals(tf, rows).filter((e) => e.outcome !== 'none' && feat(e).every(Number.isFinite));
  const res = { decided: ev.length, byYear: {}, exams: {}, perYear: {} };
  for (const e of ev) res.byYear[e.year] = (res.byYear[e.year] ?? 0) + 1;
  for (const ty of [2025, 2026]) {
    res.exams[ty] = { weighted: exam(ev, ty, true), unweighted: exam(ev, ty, false) };
    if (res.exams[ty].weighted.pass.auc060 && res.exams[ty].weighted.pass.spread15) passes++;
  }
  // Inside each year (descriptive): standardised weights of a model fitted on that year alone.
  for (const y of Object.keys(res.byYear).map(Number).sort()) {
    const g = ev.filter((e) => e.year === y);
    if (g.length < 200) continue;
    const st = standardiser(g.map(feat));
    const w = fitLogit(st.apply(g.map(feat)), g.map(yOf));
    const byName = Object.fromEntries(NAMES.map((nm, j) => [nm, +w[j + 1].toFixed(3)]));
    res.perYear[y] = { n: g.length, breakRate: +(g.reduce((a, e) => a + yOf(e), 0) / g.length).toFixed(3), inSampleAuc: +auc(predict(w, st.apply(g.map(feat))), g.map(yOf)).toFixed(3),
      groupStrength: Object.fromEntries(Object.entries(GROUPS).map(([k, names]) => [k, +Math.sqrt(names.reduce((s, nm) => s + byName[nm] ** 2, 0)).toFixed(3)])), weights: byName };
  }
  res.seconds = Math.round((Date.now() - t0) / 1000);
  report.tf[tf] = res;
  const ex = (x) => `AUC ${x.auc.toFixed(3)} terciles ${(100 * x.terciles.low).toFixed(0)}/${(100 * x.terciles.high).toFixed(0)}% n=${x.testN}`;
  console.log(`\n${tf}: ${ev.length} decided arrivals, by year ${JSON.stringify(res.byYear)} (${res.seconds}s)`);
  for (const ty of [2025, 2026]) console.log(`  exam ${ty}: weighted ${ex(res.exams[ty].weighted)} | unweighted ${ex(res.exams[ty].unweighted)}`);
  console.log('  inside each year — break rate, in-sample AUC, group strength (zone/move/ma/vp/rsi):');
  for (const [y, r] of Object.entries(res.perYear)) console.log(`   ${y} n=${r.n} break ${(100 * r.breakRate).toFixed(0)}% AUCin ${r.inSampleAuc} | ${Object.entries(r.groupStrength).map(([k, v]) => `${k} ${v}`).join(' ')}`);
}
report.passes = passes;
report.verdict = passes === 4 ? 'USEFUL' : passes > 0 ? 'WEAK' : 'NOT_USEFUL';
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('\nverdict', report.verdict, `(${passes} of 4 exams pass both criteria)`);
