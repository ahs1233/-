// CEM strata, weights, ATT and common support (TRADE_CONTRACT §12).
//
// Rows: { isEvent, stratum, R, cluster, day }
//   stratum  the CEM cell (string); D is always part of it (F1)
//   cluster  the episode (risk set, §12.2) or the comparator unit; control rows of one cluster
//            share total weight 1 (§12.3)
//   day      trading day (§2.2) of the cluster's start: bootstrap blocks never split a cluster
// ATT = Σ_s (n_event,s / N_event_supported) × (mean R_event,s − weighted mean R_control,s).
// Events in strata without controls are outside the support (§12.1, §12.4).

// ---------- bins (§12.1) ----------
const tzFmt = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
const FMT = { London: tzFmt('Europe/London'), NewYork: tzFmt('America/New_York'), Tokyo: tzFmt('Asia/Tokyo') };
const WEEKDAY = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
const sessCache = new Map();
function inWindow(fmt, t, from, to) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const h = +p.hour;
  return WEEKDAY.has(p.weekday) && h >= from && h < to;
}
// Pine: time(tf, "0700-1600:23456", "Europe/London") etc. on the bar open; overlaps go to the
// later session (NY > London > Asia); no session → "Off". Windows start on whole hours.
export function sessionBin(t) {
  const key = Math.floor(t / 3_600_000);
  let v = sessCache.get(key);
  if (v === undefined) {
    const h0 = key * 3_600_000;
    v = inWindow(FMT.NewYork, h0, 8, 17) ? 'NY' : inWindow(FMT.London, h0, 7, 16) ? 'London' : inWindow(FMT.Tokyo, h0, 9, 17) ? 'Asia' : 'Off';
    sessCache.set(key, v);
  }
  return v;
}
// volatility: tercile of the percent rank of ATR_M5 over the last 500 bars, at t−1
export const volTercile = (pctRank) => (pctRank == null || Number.isNaN(pctRank) ? null : pctRank < 100 / 3 ? 'low' : pctRank < 200 / 3 ? 'mid' : 'high');
export const h4Regime = (routeSignH4) => (routeSignH4 > 0 ? 'Bull' : routeSignH4 < 0 ? 'Bear' : 'Neutral');
export const ageBin = (age, { zeroOwnBin = false } = {}) => (age === 0 && zeroOwnBin ? '0' : age <= 1 ? '1' : age === 2 ? '2' : age <= 4 ? '3-4' : '5+');
export const speedBand = (speedClass) => (speedClass == null ? null : speedClass === 0 ? 'slow' : speedClass === 1 ? 'normal' : 'fast');
export const qBin = (q) => (q == null || Number.isNaN(q) ? null : q < 48 ? '<48' : q < 72 ? '48-72' : '>=72');
// quantile boundaries from Train (combined GTG + comparator population), then frozen
export function quantileEdges(values, k) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) throw new Error('quantileEdges: no values');
  return Array.from({ length: k - 1 }, (_, j) => v[Math.min(v.length - 1, Math.floor(((j + 1) * v.length) / k))]);
}
export const binOf = (x, edges) => (Number.isFinite(x) ? `q${edges.filter((e) => x >= e).length}` : null);

// Strata per hypothesis (§11); a null component → the row is outside every stratum.
export const STRATA = Object.freeze({
  H1: ['session', 'vol', 'h4', 'age', 'D'],
  H2: ['session', 'vol', 'h4', 'age', 'D'],
  H3: ['session', 'vol', 'h4', 'D', 'levelAge', 'width', 'speed'],
  H4: ['session', 'vol', 'h4', 'D', 'role', 'q', 'levelAge'],
  H5: ['session', 'vol', 'age', 'D'],
});
export function stratumOf(h, cov) {
  const parts = STRATA[h].map((k) => cov[k]);
  return parts.some((x) => x == null) ? null : parts.join('|');
}

// ---------- estimator ----------
export function controlWeights(rows) {
  const n = new Map();
  for (const r of rows) if (!r.isEvent) n.set(r.cluster, (n.get(r.cluster) ?? 0) + 1);
  return rows.map((r) => (r.isEvent ? 1 : 1 / n.get(r.cluster)));
}

export function att(rows) {
  const w = controlWeights(rows);
  const S = new Map();
  rows.forEach((r, i) => {
    if (r.stratum == null || !Number.isFinite(r.R)) return;
    const s = S.get(r.stratum) ?? { eN: 0, eS: 0, cW: 0, cS: 0 };
    if (r.isEvent) { s.eN++; s.eS += r.R; } else { s.cW += w[i]; s.cS += w[i] * r.R; }
    S.set(r.stratum, s);
  });
  return attFromStrata(S.values());
}

export function attFromStrata(strata) {
  let nAll = 0, nSup = 0, acc = 0;
  for (const s of strata) {
    nAll += s.eN;
    if (s.eN > 0 && s.cW > 0) { nSup += s.eN; acc += s.eN * (s.eS / s.eN - s.cS / s.cW); }
  }
  return { att: nSup > 0 ? acc / nSup : NaN, events: nAll, supported: nSup, support: nAll > 0 ? nSup / nAll : NaN };
}

// §12.4 reading of the support rate
export const supportClass = (rate) => (!(rate >= 0.2) ? 'INCONCLUSIVE_SUPPORT' : rate < 0.8 ? 'MATCHED_SUPPORT_ONLY' : 'BROAD');
