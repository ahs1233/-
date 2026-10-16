// Block length, design effect, δ_econ and the power gate (TRADE_CONTRACT §16, §17, §18).
// Train data only; no Holdout value may enter here (§17, §20).
import { rng, SEED, blockDays, attOfDays, holm, decide } from './bootstrap.mjs';

export function acf(x, lag) {
  const v = x.filter(Number.isFinite), n = v.length;
  if (n <= lag + 1) return NaN;
  const m = v.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { den += (v[i] - m) ** 2; if (i + lag < n) num += (v[i] - m) * (v[i + lag] - m); }
  return den > 0 ? num / den : NaN;
}

// §18: the smallest L in the candidate set with |ACF(L)| < 0.10 of the daily mean R_12 of the
// eligible population; none qualifies → the largest candidate (the most conservative).
export function blockLength(dailyMeans, candidates = [1, 2, 5, 10]) {
  for (const L of candidates) if (Math.abs(acf(dailyMeans, L)) < 0.10) return { L, acf: acf(dailyMeans, L) };
  const L = candidates[candidates.length - 1];
  return { L, acf: acf(dailyMeans, L), fallback: true };
}

// §16: DE = Var(mean) under the block bootstrap / Var(mean) assuming independence, same population.
// eligible: [{ day, R }] (all eligible risk-set observations of Train, events and controls pooled)
export function designEffect(eligible, L, { B = 2_000, seed = SEED } = {}) {
  const days = [...new Set(eligible.map((r) => r.day))].sort();
  const di = new Map(days.map((d, i) => [d, i]));
  const sum = new Float64Array(days.length), cnt = new Float64Array(days.length);
  let n = 0, s = 0, ss = 0;
  for (const r of eligible) { if (!Number.isFinite(r.R)) continue; const d = di.get(r.day); sum[d] += r.R; cnt[d]++; n++; s += r.R; ss += r.R * r.R; }
  const varR = (ss - (s * s) / n) / (n - 1);
  const rand = rng(seed), means = new Float64Array(B);
  for (let b = 0; b < B; b++) {
    let a = 0, c = 0;
    for (const d of blockDays(days.length, L, rand)) { a += sum[d]; c += cnt[d]; }
    means[b] = a / c;
  }
  const mm = means.reduce((a, b) => a + b, 0) / B;
  const varBlock = means.reduce((a, b) => a + (b - mm) ** 2, 0) / (B - 1);
  return { DE: varBlock / (varR / n), varBlock, varIid: varR / n, sigma: Math.sqrt(varR), n };
}

// §16: δ_econ = SR_min × σ_eligible / sqrt(N_eff_year), N_eff_year = episodes/year ÷ DE
export function deltaEcon({ srMin = 0.5, sigmaEligible, episodesPerYear, DE }) {
  const nEffYear = episodesPerYear / DE;
  return { deltaEcon: (srMin * sigmaEligible) / Math.sqrt(nEffYear), nEffYear };
}

// §17 power gate for the Holm family. hyps: [{ name, dc }] with every dc built on ONE common
// calendar of Train days (dayCells(rows, { days })). Each outer simulation draws a Holdout-sized
// block resample of Train days (nDays) and its own inner block bootstrap (Bin).
// Exact shortcut: adding Δ to every event outcome adds exactly Δ to every ATT (stratum weights
// sum to 1), so each simulation's centred inner distribution is Δ-free and serves the whole grid.
// MDE_k = the smallest Δ on the grid (step 0.01 ATR) with a confirmatory claim for k in ≥ 80% of
// simulations, the other hypotheses at Δ = 0 (null) inside the same Holm family.
// The null is imposed first: each simulated estimate is centred on the full-Train ATT, so the
// power never uses the size or sign of a Train effect — only its variance and dependence.
export function simulate(hyps, { L, nDays, Bout = 2_000, Bin = 1_000, seed = SEED } = {}) {
  const nCal = hyps[0].dc.days.length;
  for (const h of hyps) if (h.dc.days.length !== nCal) throw new Error('all hypotheses must share one calendar');
  const rand = rng(seed);
  const allDays = Array.from({ length: nCal }, (_, i) => i);
  const centre = hyps.map((h) => attOfDays(h.dc, allDays).att);
  const est = hyps.map(() => new Float64Array(Bout));
  const inner = hyps.map(() => new Array(Bout));        // sorted centred inner draws
  for (let o = 0; o < Bout; o++) {
    const O = blockDays(nCal, L, rand, nDays);
    const raw = hyps.map((h) => attOfDays(h.dc, O).att);
    hyps.forEach((_, k) => { est[k][o] = raw[k] - centre[k]; });
    const draws = hyps.map(() => new Float64Array(Bin));
    for (let b = 0; b < Bin; b++) {
      const I = blockDays(O.length, L, rand).map((j) => O[j]);
      hyps.forEach((h, k) => { draws[k][b] = attOfDays(h.dc, I).att - raw[k]; });
    }
    hyps.forEach((_, k) => { inner[k][o] = Float64Array.from(draws[k].filter(Number.isFinite)).sort(); });
  }
  return { names: hyps.map((h) => h.name), est, inner, Bout, Bin, L, nDays, seed };
}

const countGe = (sorted, x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] >= x) hi = m; else lo = m + 1; } return sorted.length - lo; };
const quant = (sorted, p) => { const pos = p * (sorted.length - 1), a = Math.floor(pos), b = Math.ceil(pos); return sorted[a] + (sorted[b] - sorted[a]) * (pos - a); };

// share of simulations with a confirmatory claim for hypothesis k at shift delta (others at 0)
export function claimRate(sim, k, delta) {
  const H = sim.est.length;
  let claims = 0, valid = 0;
  for (let o = 0; o < sim.Bout; o++) {
    if (!Number.isFinite(sim.est[k][o]) || !sim.inner[k][o].length) continue;
    valid++;
    const ps = new Array(H);
    for (let j = 0; j < H; j++) {
      const e = sim.est[j][o] + (j === k ? delta : 0), s = sim.inner[j][o];
      ps[j] = Number.isFinite(e) && s.length ? (1 + countGe(s, e)) / (s.length + 1) : 1;
    }
    const low = sim.est[k][o] + delta + quant(sim.inner[k][o], 0.005);
    if (decide(holm(ps)[k], low) === 'CLAIM') claims++;
  }
  return valid ? claims / valid : NaN;
}

const gridOf = ({ step, max }) => { const g = []; for (let d = 0; d <= max + 1e-12; d = Math.round((d + step) * 1e6) / 1e6) g.push(d); return g; };

export function powerGate(hyps, { L, nDays, Bout = 2_000, Bin = 1_000, grid = { step: 0.01, max: 1.0 }, target = 0.8, seed = SEED } = {}) {
  const sim = simulate(hyps, { L, nDays, Bout, Bin, seed });
  const g = gridOf(grid);
  return hyps.map((h, k) => {
    let mde = null;
    for (const d of g) if (claimRate(sim, k, d) >= target) { mde = d; break; }
    return { name: h.name, MDE: mde, claimRateAtZero: claimRate(sim, k, 0), outerValid: sim.est[k].filter(Number.isFinite).length };
  });
}

// Two-stage power (message 24 §5). Stage A: inner B = 1,000 over the whole grid. Stage B: only
// the cells near the decision — claim rate in [0.75, 0.85], or |Δ − δ_econ| ≤ 0.02 ATR — are
// re-evaluated with inner B = 10,000 (same outer seed, so the same outer resamples). The MDE is
// then read from the Stage B value where one exists, else from Stage A.
export function powerGateTwoStage(hyps, dEcon, { L, nDays, Bout = 2_000, BinA = 1_000, BinB = 10_000, grid = { step: 0.01, max: 1.0 }, target = 0.8, seed = SEED, band = [0.75, 0.85], near = 0.02 } = {}) {
  const g = gridOf(grid);
  const A = simulate(hyps, { L, nDays, Bout, Bin: BinA, seed });
  const rateA = hyps.map((_, k) => g.map((d) => claimRate(A, k, d)));
  const cells = hyps.map((_, k) => g.map((d, i) => (rateA[k][i] >= band[0] && rateA[k][i] <= band[1]) || Math.abs(d - dEcon[k]) <= near + 1e-12));
  const needB = cells.some((row) => row.some(Boolean));
  const B = needB ? simulate(hyps, { L, nDays, Bout, Bin: BinB, seed }) : null;
  return hyps.map((h, k) => {
    const rate = g.map((d, i) => (cells[k][i] ? claimRate(B, k, d) : rateA[k][i]));
    const i = rate.findIndex((r) => r >= target);
    const mde = i < 0 ? null : g[i];
    return { name: h.name, MDE: mde, deltaEcon: dEcon[k], verdict: powerVerdict(mde, dEcon[k]), refinedCells: cells[k].filter(Boolean).length,
      powerAtDeltaEcon: claimRate(B ?? A, k, dEcon[k]),
      stageA_MDE: (() => { const j = rateA[k].findIndex((r) => r >= target); return j < 0 ? null : g[j]; })(), BinA, BinB: needB ? BinB : null, seed };
  });
}

// §17 gate: MDE > δ_econ (or no MDE on the grid) → UNDERPOWERED, highest verdict INCONCLUSIVE
export const powerVerdict = (mde, dEcon) => (mde == null || mde > dEcon ? 'UNDERPOWERED' : 'POWERED');
