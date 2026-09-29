// Event/control rows → CEM covariates and stratum (TRADE_CONTRACT §7, §12.1), measured at t−1
// (episode age and the start-of-test-episode Q excepted). Train-derived quantile edges for
// level age (quartiles) and zone width (terciles) are inputs, frozen before the Holdout.
import { percentrank } from '../engine/pine-ta.mjs';
import { sessionBin, volTercile, h4Regime, ageBin, speedBand, qBin, binOf, stratumOf } from '../stats/cem.mjs';
import { tradingDayId } from './comparators.mjs';

export const VOL_RANK_LEN = 500; // rankLen for M5 (§12.1)

// percent rank of ATR_M5 over the last 500 bars, per bar (Pine ta.percentrank semantics)
export const atrRank = (panel) => percentrank(panel.map((p) => p.atr), VOL_RANK_LEN);

export function covariatesOf(h, row, panel, rank, { levelAgeEdges = null, widthEdges = null } = {}) {
  const t = row.t, p = panel[t];
  const cov = {
    session: sessionBin(p.t),                        // the event bar's own session (a calendar fact)
    vol: volTercile(rank[t - 1]),
    h4: h4Regime(p.mtf1.H4.routeSign),               // routeSign_H4 at t−1
    D: row.D,
  };
  if (h === 'H1' || h === 'H5') cov.age = ageBin(row.age);
  if (h === 'H2') cov.age = ageBin(row.age, { zeroOwnBin: true });
  if (h === 'H3' || h === 'H4') cov.levelAge = levelAgeEdges ? binOf(row.levelAge, levelAgeEdges) : null;
  if (h === 'H3') { cov.width = widthEdges ? binOf(row.width, widthEdges) : null; cov.speed = speedBand(p.prev?.speedClass ?? null); }   // speed band at t−1
  if (h === 'H4') { cov.role = row.D; cov.q = qBin(row.q0); }
  return { ...cov, stratum: stratumOf(h, cov) };
}

// cluster = episode (risk set) or the event unit; day = trading day of the cluster's first row
export function withClusters(rows, panel, clusterOf = (r) => r.episode ?? `${r.family}:${r.t}:${r.slot ?? ''}:${r.D}`) {
  const first = new Map();
  for (const r of rows) { const c = clusterOf(r); if (!first.has(c)) first.set(c, r.t); }
  return rows.map((r) => { const c = clusterOf(r); return { ...r, cluster: c, day: tradingDayId(panel[first.get(c)].t) }; });
}
