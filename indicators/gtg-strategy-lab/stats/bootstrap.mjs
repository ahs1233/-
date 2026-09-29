// Block bootstrap, p-values, CI, Holm and the decision rule (TRADE_CONTRACT §18, §19, §21, §24).
//
// Resampling unit = trading day (§2.2); blocks of L consecutive days (circular moving block, so
// every day has the same inclusion probability); clusters never cross a block (rows carry the
// day of their cluster's start). B = 10,000 for decisions, frozen seed 20260929.
// For speed the rows are pre-aggregated per (day, stratum): a resample is a sum of day cells.
import { controlWeights } from './cem.mjs';

export const SEED = 20260929;
export function rng(seed = SEED) {         // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// rows → day cells, flattened: for day d, cells off[d]..off[d+1]−1 hold (stratum, eN, eS, cW, cS).
// `days` may be given (a common calendar across hypotheses); days without rows are empty.
export function dayCells(rows, { days = null } = {}) {
  const w = controlWeights(rows);
  days ??= [...new Set(rows.map((r) => r.day))].sort();
  const dIdx = new Map(days.map((d, i) => [d, i]));
  const strata = [...new Set(rows.filter((r) => r.stratum != null).map((r) => r.stratum))].sort();
  const sIdx = new Map(strata.map((x, i) => [x, i]));
  const per = days.map(() => new Map());
  rows.forEach((r, i) => {
    if (r.stratum == null || !Number.isFinite(r.R)) return;
    const di = dIdx.get(r.day);
    if (di === undefined) throw new Error(`row day ${r.day} not in the calendar`);
    const m = per[di], k = sIdx.get(r.stratum);
    const c = m.get(k) ?? [0, 0, 0, 0];
    if (r.isEvent) { c[0]++; c[1] += r.R; } else { c[2] += w[i]; c[3] += w[i] * r.R; }
    m.set(k, c);
  });
  const off = new Int32Array(days.length + 1);
  per.forEach((m, d) => { off[d + 1] = off[d] + m.size; });
  const st = new Int32Array(off[days.length]), eN = new Float64Array(st.length), eS = new Float64Array(st.length), cW = new Float64Array(st.length), cS = new Float64Array(st.length);
  per.forEach((m, d) => { let j = off[d]; for (const [k, c] of m) { st[j] = k; eN[j] = c[0]; eS[j] = c[1]; cW[j] = c[2]; cS[j] = c[3]; j++; } });
  return { days, strata, off, st, eN, eS, cW, cS, acc: new Float64Array(strata.length * 4) };
}

export function attOfDays(dc, dayList) {
  const a = dc.acc;
  a.fill(0);
  for (const d of dayList) for (let j = dc.off[d]; j < dc.off[d + 1]; j++) {
    const k = dc.st[j] * 4;
    a[k] += dc.eN[j]; a[k + 1] += dc.eS[j]; a[k + 2] += dc.cW[j]; a[k + 3] += dc.cS[j];
  }
  let nAll = 0, nSup = 0, acc = 0;
  for (let k = 0; k < a.length; k += 4) {
    nAll += a[k];
    if (a[k] > 0 && a[k + 2] > 0) { nSup += a[k]; acc += a[k] * (a[k + 1] / a[k] - a[k + 3] / a[k + 2]); }
  }
  return { att: nSup > 0 ? acc / nSup : NaN, events: nAll, supported: nSup, support: nAll > 0 ? nSup / nAll : NaN };
}

// circular moving blocks of L days, total length n (default: the sample's own day count)
export function blockDays(nDays, L, rand, n = nDays) {
  const out = [];
  while (out.length < n) {
    const s = Math.floor(rand() * nDays);
    for (let j = 0; j < L && out.length < n; j++) out.push((s + j) % nDays);
  }
  return out;
}

export function bootstrap(dc, { L, B = 10_000, seed = SEED, n = dc.days.length } = {}) {
  const rand = rng(seed);
  const all = dc.days.map((_, i) => i);
  const est = attOfDays(dc, all);
  const reps = new Float64Array(B);
  for (let b = 0; b < B; b++) reps[b] = attOfDays(dc, blockDays(dc.days.length, L, rand, n)).att;
  return { est, reps };
}

// one-sided p for H: Δ > 0 from the null-centred bootstrap (§19)
export function pValue(est, reps) {
  let k = 0, B = 0;
  for (const x of reps) { if (!Number.isFinite(x)) continue; B++; if (x - est >= est) k++; }
  return (1 + k) / (B + 1);
}
export function percentile(reps, q) {
  const v = Array.from(reps).filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const pos = q * (v.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
export const ci99 = (reps) => [percentile(reps, 0.005), percentile(reps, 0.995)];

export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(ps.length);
  let running = 0;
  order.forEach(([p, i], k) => { running = Math.max(running, Math.min(1, (ps.length - k) * p)); adj[i] = running; });
  return adj;
}

// §19: a confirmatory claim needs Holm p < 0.05 AND the 99% CI lower bound > 0; disagreement → INCONCLUSIVE
export function decide(holmP, ciLow) {
  const a = holmP < 0.05, b = ciLow > 0;
  return a && b ? 'CLAIM' : a !== b ? 'INCONCLUSIVE' : 'NO_CLAIM';
}
