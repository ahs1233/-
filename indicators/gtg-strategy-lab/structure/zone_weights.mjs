// Zone and momentum weights from history (reports/zone_weights_preregistration.md).
//   node --max-old-space-size=12000 structure/zone_weights.mjs <feeds.json> <out.json> [mintick]
import { readFileSync, writeFileSync } from 'node:fs';
import { runTimeframe } from '../engine/measure.mjs';

const [, , inp, out, mt] = process.argv;
const MINTICK = Number(mt ?? 0.001);
const HORIZON = 48;
const FIT_END = Date.parse('2022-07-01T00:00:00Z');
const INPUTS_OF = { M15: ['H1', 'H1', 'H4'], H1: ['H4', 'H4', 'D'] };
const BAR_MS = { M15: 900_000, H1: 3_600_000 };

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
      R1: r.slots[0], S1: r.slots[2] }) });
  return rows;
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
const report = { prereg: 'reports/zone_weights_preregistration.md', mintick: MINTICK, feeds_sha256: doc.meta?.feeds_sha256, tf: {} };

for (const tf of ['M15', 'H1']) {
  const t0 = Date.now();
  const rows = compactRows(tf);
  const ev = arrivals(tf, rows);
  const decided = ev.filter((e) => e.outcome !== 'none');
  const fit = decided.filter((e) => e.t < FIT_END), chk = decided.filter((e) => e.t >= FIT_END);
  const res = { arrivals: ev.length, none: ev.length - decided.length, fitN: fit.length, checkN: chk.length,
    breakRateFit: fit.filter((e) => e.outcome === 'break').length / fit.length,
    breakRateCheck: chk.filter((e) => e.outcome === 'break').length / chk.length, models: {}, seconds: 0 };
  for (const [name, feat, names] of [['zone', (e) => e.zone, ZONE_NAMES], ['move', (e) => e.move, MOVE_NAMES], ['both', (e) => [...e.zone, ...e.move], [...ZONE_NAMES, ...MOVE_NAMES]]]) {
    const st = standardiser(fit.map(feat));
    const yF = fit.map((e) => (e.outcome === 'break' ? 1 : 0)), yC = chk.map((e) => (e.outcome === 'break' ? 1 : 0));
    const w = fitLogit(st.apply(fit.map(feat)), yF);
    const pC = predict(w, st.apply(chk.map(feat)));
    res.models[name] = { aucFit: auc(predict(w, st.apply(fit.map(feat))), yF), aucCheck: auc(pC, yC), tercilesCheck: terciles(pC, yC),
      weights: Object.fromEntries(names.map((nm, j) => [nm, w[j + 1]])), intercept: w[0], mu: st.mu, sd: st.sd };
  }
  const b = res.models.both;
  res.criteria = { aucAtLeast060: b.aucCheck >= 0.60, tercileSpread15: b.tercilesCheck.high - b.tercilesCheck.low >= 0.15,
    comparisonAdds: b.aucCheck >= Math.max(res.models.zone.aucCheck, res.models.move.aucCheck) + 0.01 };
  // Exploratory (not a pre-registered criterion): random-walk chance of a reject first from the
  // near edge, with reject at 1 ATR and break at width + 1 ATR: (1 + w) / (2 + w).
  res.rejectRateAll = decided.filter((e) => e.outcome === 'reject').length / decided.length;
  res.rejectRandomWalk = decided.reduce((s, e) => s + (1 + e.zone[2]) / (2 + e.zone[2]), 0) / decided.length;
  for (const [lab, lo, hi] of [['weak<48', 0, 0.48], ['medium', 0.48, 0.72], ['strong>=72', 0.72, 2]]) {
    const g = decided.filter((e) => e.zone[0] >= lo && e.zone[0] < hi);
    res['reject_' + lab] = [g.length, g.filter((e) => e.outcome === 'reject').length / g.length, g.reduce((s, e) => s + (1 + e.zone[2]) / (2 + e.zone[2]), 0) / g.length];
  }
  res.seconds = Math.round((Date.now() - t0) / 1000);
  report.tf[tf] = res;
  console.log(JSON.stringify({ tf, arrivals: res.arrivals, none: res.none, fitN: res.fitN, checkN: res.checkN,
    breakRateFit: res.breakRateFit.toFixed(3), breakRateCheck: res.breakRateCheck.toFixed(3),
    auc: Object.fromEntries(Object.entries(res.models).map(([k, m]) => [k, [m.aucFit.toFixed(3), m.aucCheck.toFixed(3)]])),
    rejectAll: res.rejectRateAll.toFixed(3), rejectRW: res.rejectRandomWalk.toFixed(3), byStrength: ['weak<48', 'medium', 'strong>=72'].map((k) => [k, res['reject_' + k][0], res['reject_' + k][1].toFixed(3), res['reject_' + k][2].toFixed(3)]), tercilesBoth: Object.fromEntries(Object.entries(b.tercilesCheck).map(([k, v]) => [k, v.toFixed(3)])), criteria: res.criteria, seconds: res.seconds }));
}
const n = report.tf.M15 && report.tf.H1 ? ['M15', 'H1'].filter((tf) => report.tf[tf].criteria.aucAtLeast060 && report.tf[tf].criteria.tercileSpread15).length : 0;
report.verdict = n === 2 ? 'USEFUL' : n === 1 ? 'WEAK' : 'NOT_USEFUL';
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('verdict', report.verdict);
