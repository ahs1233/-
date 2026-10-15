// Part 1 statistics (../../TEST_PREREGISTRATION.md v1.1, "Baselines", "Dependence", "Verdicts").
export const SEED = 20261015;

export function rng(seed) { // mulberry32, as gate3.mjs and ../../history/history.mjs
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// New York UTC offset (hours) at UTC ms t: US rules since 2007 (DST from the second Sunday of
// March 02:00 local to the first Sunday of November 02:00 local).
function nthSunday(y, m, n) { const d = new Date(Date.UTC(y, m, 1)); const first = (7 - d.getUTCDay()) % 7 + 1; return first + 7 * (n - 1); }
export function nyOffset(t) {
  const y = new Date(t).getUTCFullYear();
  const start = Date.UTC(y, 2, nthSunday(y, 2, 2), 7); // 02:00 EST = 07:00 UTC
  const end = Date.UTC(y, 10, nthSunday(y, 10, 1), 6); // 02:00 EDT = 06:00 UTC
  return t >= start && t < end ? -4 : -5;
}
// The lab's trading day: New York 17:00 to 17:00, labelled by the date it ends on (days since epoch).
export function tradingDay(t) { return Math.floor((t + (nyOffset(t) + 7) * 3_600_000) / 86_400_000); }

// L_tf: the largest number of distinct trading days spanned by `span` consecutive bars whose first
// bar opens in [start, end). Bar times only.
export function blockLength(barT, start, end, span = 301) {
  const day = barT.map(tradingDay);
  const changes = new Int32Array(day.length); // changes[i] = number of day changes in bars 0..i
  for (let i = 1; i < day.length; i++) changes[i] = changes[i - 1] + (day[i] !== day[i - 1] ? 1 : 0);
  let best = 0, at = -1;
  for (let i = 0; i + span - 1 < barT.length; i++) {
    if (barT[i] < start || barT[i] >= end) continue;
    const k = changes[i + span - 1] - changes[i] + 1;
    if (k > best) { best = k; at = i; }
  }
  return { L: best, firstBarOfLongest: at >= 0 ? new Date(barT[at]).toISOString() : null };
}

// Median of the previous `len` values (current excluded); NaN until len values exist.
export function trailingMedian(x, len = 500) {
  const out = new Float64Array(x.length).fill(NaN);
  const buf = new Float64Array(len);
  for (let i = len; i < x.length; i++) {
    for (let k = 0; k < len; k++) buf[k] = x[i - len + k];
    buf.sort();
    out[i] = len % 2 ? buf[(len - 1) / 2] : (buf[len / 2 - 1] + buf[len / 2]) / 2;
  }
  return out;
}
export function quantile(sorted, q) { // linear interpolation (type 7)
  if (!sorted.length) return NaN;
  const h = (sorted.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}
export const tercileOf = (v, cuts) => (!Number.isFinite(v) ? -1 : v < cuts[0] ? 0 : v < cuts[1] ? 1 : 2);
// Session bucket of the signal close (UTC hour): 00–07, 07–12, 12–16, 16–21, 21–24.
export const sessionOf = (t) => { const h = new Date(t).getUTCHours(); return h < 7 ? 0 : h < 12 ? 1 : h < 16 ? 2 : h < 21 ? 3 : 4; };

// Matched baseline draws: for each draw, as many baseline trades per stratum as the version has
// executable starts in it; without replacement when the stratum holds enough, else with.
// starts / pool: arrays of { stratum, idx } (idx = baseline trade index). Returns draws[d] = idx[].
export function matchedDraws(startStrata, poolByStratum, nDraws, seed) {
  const rand = rng(seed);
  const need = new Map();
  for (const s of startStrata) need.set(s, (need.get(s) ?? 0) + 1);
  const keys = [...need.keys()].sort();
  const draws = [];
  for (let d = 0; d < nDraws; d++) {
    const out = [];
    for (const s of keys) {
      const pool = poolByStratum.get(s) ?? [], k = need.get(s);
      if (!pool.length) throw new Error(`stratum ${s} has no baseline trade`);
      if (pool.length >= k) {
        const a = pool.slice();
        for (let j = 0; j < k; j++) { const r = j + Math.floor(rand() * (a.length - j)); [a[j], a[r]] = [a[r], a[j]]; out.push(a[j]); }
      } else for (let j = 0; j < k; j++) out.push(pool[Math.floor(rand() * pool.length)]);
    }
    draws.push(out);
  }
  return draws;
}

// Circular moving-block bootstrap over the trading-day sequence `days` (sorted day labels).
// Returns resamples[r] = Int32Array of day positions (length = days.length).
export function blockResamples(nDays, L, nRes, seed) {
  const rand = rng(seed), out = [];
  const nBlocks = Math.ceil(nDays / L);
  for (let r = 0; r < nRes; r++) {
    const a = new Int32Array(nDays);
    let k = 0;
    for (let b = 0; b < nBlocks; b++) { const s = Math.floor(rand() * nDays); for (let j = 0; j < L && k < nDays; j++) a[k++] = (s + j) % nDays; }
    out.push(a);
  }
  return out;
}
// Per-day sums and counts of a series of { day (position), R } for fast resampling.
export function dayTotals(items, nDays) {
  const sum = new Float64Array(nDays), cnt = new Int32Array(nDays);
  for (const x of items) { sum[x.day] += x.R; cnt[x.day]++; }
  return { sum, cnt };
}
export function resampledMean(tot, sample) {
  let s = 0, c = 0;
  for (let k = 0; k < sample.length; k++) { s += tot.sum[sample[k]]; c += tot.cnt[sample[k]]; }
  return c ? s / c : NaN;
}
// Two-sided percentile interval at level `level` (0.95 → 2.5 % and 97.5 %).
export function interval(values, level) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const a = (1 - level) / 2;
  return [quantile(v, a), quantile(v, 1 - a)];
}
export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
