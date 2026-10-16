// Zone and momentum weights v2: + moving averages + volume profile
// (reports/zone_weights_v2_preregistration.md). Events, outcome and split are those of v1.
//   node --max-old-space-size=12000 structure/zone_weights_v2.mjs <feeds.json> <out.json> [mintick]
import { readFileSync, writeFileSync } from 'node:fs';
import { runTimeframe } from '../engine/measure.mjs';

const [, , inp, out, mt] = process.argv;
const MINTICK = Number(mt ?? 0.001);
const HORIZON = 48;
const FIT_END = Date.parse('2022-07-01T00:00:00Z');
const INPUTS_OF = { M15: ['H1', 'H1', 'H4'], H1: ['H4', 'H4', 'D'] };
const BAR_MS = { M15: 900_000, H1: 3_600_000 };
const VP_LEN = 500, VP_BIN = 0.25;

const doc = JSON.parse(readFileSync(inp, 'utf8'));
const feeds = Object.fromEntries(Object.entries(doc.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))]));

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
      });
    }
  }
  return ev;
}

// L2-regularised logistic regression by Newton iterations on standardised features.
function fitLogit(X, y, lambda = 1e-3) {
  const n = X.length, d = X[0].length + 1;
  let w = new Array(d).fill(0);
  for (let it = 0; it < 50; it++) {
    const g = new Array(d).fill(0), H = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let r = 0; r < n; r++) {
      const x = [1, ...X[r]];
      const z = x.reduce((s, v, j) => s + v * w[j], 0), pr = 1 / (1 + Math.exp(-z)), s = pr * (1 - pr);
      for (let a = 0; a < d; a++) { g[a] += (pr - y[r]) * x[a]; for (let b = 0; b < d; b++) H[a][b] += s * x[a] * x[b]; }
    }
    for (let a = 1; a < d; a++) { g[a] += lambda * n * w[a]; H[a][a] += lambda * n; }
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
const report = { prereg: 'reports/zone_weights_v2_preregistration.md', mintick: MINTICK, feeds_sha256: doc.meta?.feeds_sha256, vp: { len: VP_LEN, binAtr: VP_BIN }, tf: {} };
const MODELS = [
  ['v1', (e) => [...e.zone, ...e.move], [...ZONE_NAMES, ...MOVE_NAMES]],
  ['ma', (e) => e.ma, MA_NAMES],
  ['vp', (e) => e.vp, VP_NAMES],
  ['all', (e) => [...e.zone, ...e.move, ...e.ma, ...e.vp], [...ZONE_NAMES, ...MOVE_NAMES, ...MA_NAMES, ...VP_NAMES]],
];

for (const tf of ['M15', 'H1']) {
  const t0 = Date.now();
  const rows = compactRows(tf);
  const ev = arrivals(tf, rows);
  const decided = ev.filter((e) => e.outcome !== 'none');
  const fit = decided.filter((e) => e.t < FIT_END), chk = decided.filter((e) => e.t >= FIT_END);
  const res = { arrivals: ev.length, none: ev.length - decided.length, fitN: fit.length, checkN: chk.length,
    breakRateFit: fit.filter((e) => e.outcome === 'break').length / fit.length,
    breakRateCheck: chk.filter((e) => e.outcome === 'break').length / chk.length, models: {}, seconds: 0 };
  const yF = fit.map((e) => (e.outcome === 'break' ? 1 : 0)), yC = chk.map((e) => (e.outcome === 'break' ? 1 : 0));
  for (const [name, feat, names] of MODELS) {
    const st = standardiser(fit.map(feat));
    const w = fitLogit(st.apply(fit.map(feat)), yF);
    const pC = predict(w, st.apply(chk.map(feat)));
    res.models[name] = { aucFit: auc(predict(w, st.apply(fit.map(feat))), yF), aucCheck: auc(pC, yC), tercilesCheck: terciles(pC, yC),
      weights: Object.fromEntries(names.map((nm, j) => [nm, w[j + 1]])), intercept: w[0], mu: st.mu, sd: st.sd };
  }
  const a = res.models.all;
  res.criteria = { aucAtLeast060: a.aucCheck >= 0.60, tercileSpread15: a.tercilesCheck.high - a.tercilesCheck.low >= 0.15,
    gainOverV1: a.aucCheck >= res.models.v1.aucCheck + 0.02 };
  // Exploratory (not a pre-registered criterion): reject rate vs the random-walk chance
  // (1 + w) / (2 + w) for each simple group of the new features.
  const grp = (f) => { const g = decided.filter(f); return g.length ? [g.length, +(g.filter((e) => e.outcome === 'reject').length / g.length).toFixed(3), +(g.reduce((s, e) => s + (1 + e.zone[2]) / (2 + e.zone[2]), 0) / g.length).toFixed(3)] : [0]; };
  res.exploratory = {
    all: grp(() => true),
    maInZone: grp((e) => e.ma[3] === 1), maNotInZone: grp((e) => e.ma[3] === 0),
    ma200Within1Atr: grp((e) => e.ma[1] <= 1), ma1000Within1Atr: grp((e) => e.ma[2] <= 1),
    highVolumeNode: grp((e) => e.vp[0] > 0.4), lowVolumeNode: grp((e) => e.vp[0] < -0.4),
    inValueArea: grp((e) => e.vp[2] === 1), outsideValueArea: grp((e) => e.vp[2] === 0),
    nearPOC1Atr: grp((e) => e.vp[1] <= 1),
    maInZoneAndHVN: grp((e) => e.ma[3] === 1 && e.vp[0] > 0.4),
  };
  res.seconds = Math.round((Date.now() - t0) / 1000);
  report.tf[tf] = res;
  console.log(JSON.stringify({ tf, arrivals: res.arrivals, none: res.none, fitN: res.fitN, checkN: res.checkN,
    breakRateCheck: res.breakRateCheck.toFixed(3),
    auc: Object.fromEntries(Object.entries(res.models).map(([k, m]) => [k, [m.aucFit.toFixed(3), m.aucCheck.toFixed(3)]])),
    tercilesAll: Object.fromEntries(Object.entries(a.tercilesCheck).map(([k, v]) => [k, v.toFixed(3)])), criteria: res.criteria, seconds: res.seconds }));
  console.log('  exploratory [n, reject rate, random-walk chance]:', JSON.stringify(res.exploratory));
}
const n = ['M15', 'H1'].filter((tf) => Object.values(report.tf[tf].criteria).every(Boolean)).length;
report.verdict = n === 2 ? 'USEFUL' : n === 1 ? 'WEAK' : 'NOT_USEFUL';
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('verdict', report.verdict);
