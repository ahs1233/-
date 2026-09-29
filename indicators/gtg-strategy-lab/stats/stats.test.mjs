// ST — CEM / ATT / support, block bootstrap, Holm and the decision rule, block length, DE,
// δ_econ and the power gate, on synthetic data only (message 22 §8: no edge outcome).
import test from 'node:test';
import assert from 'node:assert/strict';
import { att, controlWeights, sessionBin, stratumOf, quantileEdges, binOf, supportClass, ageBin } from './cem.mjs';
import { dayCells, attOfDays, bootstrap, pValue, ci99, holm, decide, rng } from './bootstrap.mjs';
import { acf, blockLength, designEffect, deltaEcon, powerGate, powerVerdict } from './power.mjs';

const close = (a, b, e = 1e-12) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test('ST1 ATT with Σw = 1 per episode, strata without controls outside the support', () => {
  const rows = [
    { isEvent: true, stratum: 'A', R: 1.0, cluster: 'e1' },
    { isEvent: false, stratum: 'A', R: 0.2, cluster: 'c1' }, { isEvent: false, stratum: 'A', R: 0.4, cluster: 'c1' },   // one episode, w = 1/2 each
    { isEvent: false, stratum: 'A', R: -0.3, cluster: 'c2' },                                                         // w = 1
    { isEvent: true, stratum: 'B', R: 2.0, cluster: 'e2' }, { isEvent: true, stratum: 'B', R: 0.0, cluster: 'e3' },
    { isEvent: false, stratum: 'B', R: 0.5, cluster: 'c3' },
    { isEvent: true, stratum: 'C', R: 9.0, cluster: 'e4' },                                                           // no control → outside
  ];
  assert.deepEqual(controlWeights(rows).slice(1, 4), [0.5, 0.5, 1]);
  const r = att(rows);
  const dA = 1.0 - (0.5 * 0.2 + 0.5 * 0.4 + 1 * -0.3) / 2, dB = 1.0 - 0.5;
  close(r.att, (1 * dA + 2 * dB) / 3);
  assert.deepEqual([r.events, r.supported], [4, 3]);
  close(r.support, 0.75);
  assert.equal(supportClass(0.75), 'MATCHED_SUPPORT_ONLY');
  assert.equal(supportClass(0.1), 'INCONCLUSIVE_SUPPORT');
  assert.equal(supportClass(0.9), 'BROAD');
});

function synth({ days = 400, perDay = 6, effect = 0, dayShock = 0, seed = 5 } = {}) {
  const rand = rng(seed), rows = [];
  const g = () => { let s = 0; for (let k = 0; k < 12; k++) s += rand(); return s - 6; };
  for (let d = 0; d < days; d++) {
    const shock = dayShock * g();
    for (let k = 0; k < perDay; k++) {
      const st = `${['NY', 'London'][k % 2]}|${k % 3 ? 1 : -1}`;
      rows.push({ isEvent: true, stratum: st, R: effect + shock + g(), cluster: `e${d}:${k}`, day: `d${String(d).padStart(4, '0')}` });
      for (let c = 0; c < 2; c++) rows.push({ isEvent: false, stratum: st, R: shock + g(), cluster: `c${d}:${k}`, day: `d${String(d).padStart(4, '0')}` });
    }
  }
  return rows;
}

test('ST2 day-cell ATT equals the row ATT; a shift Δ of every event outcome moves every resampled ATT by exactly Δ', () => {
  const rows = synth({ days: 60 });
  const dc = dayCells(rows);
  close(attOfDays(dc, dc.days.map((_, i) => i)).att, att(rows).att, 1e-9);
  const shifted = dayCells(rows.map((r) => (r.isEvent ? { ...r, R: r.R + 0.37 } : r)));
  const rand = rng(3);
  for (let b = 0; b < 20; b++) {
    const days = Array.from({ length: 60 }, () => Math.floor(rand() * 60));
    close(attOfDays(shifted, days).att - attOfDays(dc, days).att, 0.37, 1e-9);
  }
});

test('ST3 Holm, the one-sided null-centred p and the two-part decision rule', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.005, 0.5]).map((x) => +x.toFixed(4)), [0.04, 0.09, 0.09, 0.025, 0.5]);
  assert.equal(decide(0.01, 0.2), 'CLAIM');
  assert.equal(decide(0.01, -0.1), 'INCONCLUSIVE');
  assert.equal(decide(0.2, 0.1), 'INCONCLUSIVE');
  assert.equal(decide(0.2, -0.1), 'NO_CLAIM');
  assert.equal(pValue(1, [1, 1.5, 3, 0.5]), (1 + 1) / 5);   // only 3 − 1 ≥ 1
});

test('ST4 bootstrap: a real effect gives small p and CI above 0; the null does not', () => {
  const on = dayCells(synth({ days: 300, effect: 0.5 })), off = dayCells(synth({ days: 300, effect: 0, seed: 9 }));
  const a = bootstrap(on, { L: 1, B: 400 }), b = bootstrap(off, { L: 1, B: 400 });
  assert.ok(pValue(a.est.att, a.reps) < 0.01 && ci99(a.reps)[0] > 0);
  assert.ok(pValue(b.est.att, b.reps) > 0.01 && ci99(b.reps)[0] < 0);
});

test('ST5 block length rule and design effect follow the day dependence', () => {
  const rand = rng(1);
  const iid = Array.from({ length: 800 }, () => rand() - 0.5);
  const ar = []; let x = 0;
  for (let i = 0; i < 800; i++) { x = 0.9 * x + (rand() - 0.5); ar.push(x); }
  assert.equal(blockLength(iid).L, 1);
  assert.ok(blockLength(ar).L >= 5 || blockLength(ar).fallback);
  assert.ok(Math.abs(acf(ar, 1) - 0.9) < 0.1);
  const flat = synth({ days: 200, dayShock: 0 }).filter((r) => !r.isEvent);
  const clus = synth({ days: 200, dayShock: 1.5 }).filter((r) => !r.isEvent);
  const d0 = designEffect(flat, 1, { B: 600 }).DE, d1 = designEffect(clus, 1, { B: 600 }).DE;
  assert.ok(d0 > 0.7 && d0 < 1.4, `DE iid ${d0}`);
  assert.ok(d1 > 3, `DE clustered ${d1}`);
  const e = deltaEcon({ srMin: 0.5, sigmaEligible: 1.2, episodesPerYear: 400, DE: 4 });
  close(e.nEffYear, 100);
  close(e.deltaEcon, (0.5 * 1.2) / 10);
});

test('ST6 power gate: MDE exists, shrinks with a longer Holdout, the null rarely claims, and a Train effect does not leak in', () => {
  const days = [...new Set(synth({ days: 250 }).map((r) => r.day))].sort();
  const hyps = [0, 1, 2].map((k) => ({ name: `H${k + 1}`, dc: dayCells(synth({ days: 250, seed: 20 + k }), { days }) }));
  // the same data with a large Train effect gives the same MDE (the null is imposed first)
  const eff = [0, 1, 2].map((k) => ({ name: `H${k + 1}`, dc: dayCells(synth({ days: 250, seed: 20 + k, effect: 0.8 }), { days }) }));
  const a = powerGate(hyps, { L: 1, nDays: 120, Bout: 60, Bin: 100, grid: { step: 0.02, max: 1.5 } });
  const b = powerGate(eff, { L: 1, nDays: 120, Bout: 60, Bin: 100, grid: { step: 0.02, max: 1.5 } });
  assert.deepEqual(b.map((x) => x.MDE), a.map((x) => x.MDE));
  const short = powerGate(hyps, { L: 1, nDays: 60, Bout: 120, Bin: 150, grid: { step: 0.02, max: 1.5 } });
  const long = powerGate(hyps, { L: 1, nDays: 240, Bout: 120, Bin: 150, grid: { step: 0.02, max: 1.5 } });
  for (let k = 0; k < 3; k++) {
    assert.ok(short[k].MDE != null && long[k].MDE != null, JSON.stringify({ short, long }));
    assert.ok(long[k].MDE < short[k].MDE, `H${k + 1}: ${long[k].MDE} !< ${short[k].MDE}`);
    assert.ok(long[k].claimRateAtZero < 0.1);
  }
  assert.equal(powerVerdict(0.12, 0.10), 'UNDERPOWERED');
  assert.equal(powerVerdict(0.08, 0.10), 'POWERED');
  assert.equal(powerVerdict(null, 0.10), 'UNDERPOWERED');
});

test('ST7 CEM bins: sessions by the Pine strings with DST and the later-session rule; null covariates leave the support', () => {
  assert.equal(sessionBin(Date.UTC(2026, 6, 15, 13, 30)), 'NY');       // 09:30 EDT, 14:30 BST → overlap → NY
  assert.equal(sessionBin(Date.UTC(2026, 6, 15, 7, 0)), 'London');     // 08:00 BST, 03:00 EDT
  assert.equal(sessionBin(Date.UTC(2026, 6, 15, 1, 0)), 'Asia');       // 10:00 JST
  assert.equal(sessionBin(Date.UTC(2026, 6, 15, 22, 0)), 'Off');       // 07:00 JST, 18:00 EDT
  assert.equal(sessionBin(Date.UTC(2026, 0, 15, 12, 30)), 'London');   // 07:30 EST (NY not open), 12:30 GMT
  assert.equal(sessionBin(Date.UTC(2026, 6, 18, 13, 30)), 'Off');      // Saturday
  assert.equal(stratumOf('H1', { session: 'NY', vol: 'low', h4: 'Bull', age: '1', D: 1 }), 'NY|low|Bull|1|1');
  assert.equal(stratumOf('H1', { session: 'NY', vol: null, h4: 'Bull', age: '1', D: 1 }), null);
  const edges = quantileEdges([1, 2, 3, 4, 5, 6, 7, 8], 4);
  assert.deepEqual([binOf(1, edges), binOf(4, edges), binOf(8, edges)], ['q0', 'q1', 'q3']);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map((a) => ageBin(a, { zeroOwnBin: true })), ['0', '1', '2', '3-4', '3-4', '5+']);
});
