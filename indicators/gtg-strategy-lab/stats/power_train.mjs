// Train-only Power Gate driver (TRADE_CONTRACT §12.4, §16–§18; GPT message 57). Reports, per
// hypothesis: block length, DE, σ_eligible, N_eff/year, δ_econ, support class, MDE, power at
// δ_econ and POWERED / UNDERPOWERED. Never an ATT, expectancy, PF or H1–H5 result.
// Joint simulation (one Holm family, §17): the largest block length of the five (conservative).
import { dayCells, attOfDays } from './bootstrap.mjs';
import { blockLength, designEffect, deltaEcon, powerGateTwoStage } from './power.mjs';
import { supportClass } from './cem.mjs';

const sd = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };

export function hypothesisStats(rows, trainDays, trainYears, { deB = 2_000 } = {}) {
  const elig = rows.filter((r) => Number.isFinite(r.R));
  const byDay = new Map();
  for (const r of elig) { const x = byDay.get(r.day) ?? [0, 0]; x[0] += r.R; x[1]++; byDay.set(r.day, x); }
  const daily = trainDays.filter((d) => byDay.has(d)).map((d) => byDay.get(d)[0] / byDay.get(d)[1]);
  const bl = blockLength(daily);
  const de = designEffect(elig.map((r) => ({ day: r.day, R: r.R })), bl.L, { B: deB });
  const episodes = new Set(elig.map((r) => r.cluster)).size;
  const econ = deltaEcon({ srMin: 0.5, sigmaEligible: sd(elig.map((r) => r.R)), episodesPerYear: episodes / trainYears, DE: de.DE });
  const dc = dayCells(rows, { days: trainDays });
  const all = trainDays.map((_, i) => i);
  const s = attOfDays(dc, all);
  return {
    eligible_rows: elig.length, episodes, L: bl.L, L_fallback: !!bl.fallback, DE: de.DE, sigma: de.sigma,
    nEffYear: econ.nEffYear, deltaEcon: econ.deltaEcon, support: s.support, supportClass: supportClass(s.support), dc,
  };
}

export function powerTrain(hyp, { nDays, Bout = 2_000, BinA = 1_000, BinB = 10_000, grid = { step: 0.01, max: 1.0 } } = {}) {
  const names = Object.keys(hyp.rows);
  const st = Object.fromEntries(names.map((h) => [h, hypothesisStats(hyp.rows[h], hyp.trainDays, hyp.trainYears)]));
  const L = Math.max(...names.map((h) => st[h].L));
  const gate = powerGateTwoStage(names.map((h) => ({ name: h, dc: st[h].dc })), names.map((h) => st[h].deltaEcon), { L, nDays, Bout, BinA, BinB, grid });
  return {
    label: 'Power Gate — Train only (no ATT, no outcomes reported)', jointL: L, nDaysHoldout: nDays, w: hyp.w, jaccardTcCe: hyp.jaccardTcCe,
    per: names.map((h, k) => {
      const { dc, ...s } = st[h];
      return { h, ...s, MDE: gate[k].MDE, powerAtDeltaEcon: gate[k].powerAtDeltaEcon, verdict: gate[k].verdict, stageA_MDE: gate[k].stageA_MDE, refinedCells: gate[k].refinedCells };
    }),
  };
}
