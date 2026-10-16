// PG — Parity Gate tool, on synthetic exports written by the JS engine itself, with
// negative controls (every perturbation must be caught, and the EMA seed identified).
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars, htfBarsOf } from '../gtg-engine/reference/history.mjs';
import { runTimeframe } from '../engine/measure.mjs';
import { profileFor } from '../engine/profiles.mjs';
import { parseTvCsv, writeTvCsv } from './tv-csv.mjs';
import { compareExport, compareCopyToFrozen, pineStartBar } from './compare.mjs';

const MINTICK = 0.01;
const HEADER = ['time', 'open', 'high', 'low', 'close', 'MA14', 'MA22', 'MA50', 'MA200', 'MA1000',
  'v_hashSlots', 'v_hashState', 'v_eventBits', 'v_obsState',
  'm_volume', 'm_htfClose', 'm_htfMA50', 'm_htfMA200', 'm_htfMA50Past', 'm_htfATR',
  'm_routeScore', 'm_headingScore', 'm_speedScore', 'm_instantSpeedScore', 'm_fuelScore', 'm_atr'];

// A stand-in for a TradingView export: the JS engine plays "Pine" (route HTF from real
// HTF bars, anchors aggregated), and the export holds exactly the plotted columns.
function syntheticExport(seed, emaSeed, n = 3200, extra = 0) {
  const m = marketBars(n, seed).map((b, i) => ({ ...b, v: 40 + ((i * 7919 + seed) % 61) }));
  const prof = profileFor('M1');
  const [from, to] = [m[0].t, m[m.length - 1].t];
  const { start } = pineStartBar(n, 'M1', MINTICK, extra);
  const res = runTimeframe({ tf: 'M1', mintick: MINTICK, bars: m, htfBars: htfBarsOf(m, prof.htfSec, from, to),
    a1Bars: htfBarsOf(m, prof.a1Sec, from, to), a2Bars: htfBarsOf(m, prof.a2Sec, from, to), startBar: start, emaSeed });
  const rows = res.rows.map((r) => ({
    t: r.t, open: r.o, high: r.h, low: r.l, close: r.c, MA14: r.ma14, MA22: r.ma22, MA50: r.ma50, MA200: r.ma200, MA1000: r.ma1000,
    v_hashSlots: r.hashes ? r.hashes.hashSlots : NaN, v_hashState: r.hashes ? r.hashes.hashState : NaN,
    v_eventBits: r.hashes ? r.hashes.eventBits : NaN, v_obsState: r.engineOn ? r.consumer.obsState : NaN,
    m_volume: r.v, m_htfClose: r.htfClose, m_htfMA50: r.htfMA50, m_htfMA200: r.htfMA200, m_htfMA50Past: r.htfMA50Past, m_htfATR: r.htfATR,
    m_routeScore: r.routeScore, m_headingScore: r.headingScore, m_speedScore: r.speedScore, m_instantSpeedScore: r.instantSpeedScore,
    m_fuelScore: r.fuelScore, m_atr: r.atr,
  }));
  return rows;
}

const parse = (rows) => parseTvCsv(writeTvCsv(HEADER, rows));
const base = syntheticExport(4, 'first');

test('PG1 a faithful export passes and the EMA seed is identified', () => {
  const r = compareExport(parse(base), { tf: 'M1', mintick: MINTICK });
  assert.equal(r.verdict, 'PASS', JSON.stringify(r.runs.first.fields).slice(0, 400));
  assert.equal(r.emaSeed, 'first');
  assert.ok(r.runs.first.fields.v_hashState.compared > 1000);
  assert.ok(r.runs.sma.mismatched > 0, 'the other seed hypothesis is rejected by the data');
});

test('PG2 an export produced with the SMA seed is identified as such', () => {
  const r = compareExport(parse(syntheticExport(4, 'sma')), { tf: 'M1', mintick: MINTICK });
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.emaSeed, 'sma');
});

test('PG3 negative controls: one hash, one score (2e-6), one band are each caught', () => {
  const k = base.findIndex((r) => Number.isFinite(r.v_hashState)) + 50;
  for (const [col, f] of [['v_hashState', (v) => v + 1], ['m_speedScore', (v) => v + 2e-6], ['v_eventBits', (v) => v ^ 16]]) {
    const rows = base.map((r) => ({ ...r }));
    rows[k][col] = f(rows[k][col]);
    const r = compareExport(parse(rows), { tf: 'M1', mintick: MINTICK });
    assert.equal(r.verdict, 'FAIL', col);
    assert.equal(r.runs.first.fields[col].first.bar, k, col);
  }
});

test('PG4 low-precision export is refused, not re-toleranced', () => {
  const rows = base.map((r) => ({ ...r, m_speedScore: Math.round(r.m_speedScore * 100) / 100 }));
  assert.equal(compareExport(parse(rows), { tf: 'M1', mintick: MINTICK }).verdict, 'FAIL_EXPORT_PRECISION');
});

test('PG5 engine start must match the Pine rule (studyExtraBars accounted for)', () => {
  const withExtra = syntheticExport(4, 'first', 3200, 150);
  assert.equal(compareExport(parse(withExtra), { tf: 'M1', mintick: MINTICK, studyExtraBars: 150 }).verdict, 'PASS');
  assert.equal(compareExport(parse(withExtra), { tf: 'M1', mintick: MINTICK, studyExtraBars: 0 }).verdict.startsWith('FAIL'), true);
});

test('PG6 copy-vs-frozen hash comparison', () => {
  const p = parse(base);
  assert.equal(compareCopyToFrozen(p, p).verdict, 'PASS');
  const rows = base.map((r) => ({ ...r }));
  const k = rows.findIndex((r) => Number.isFinite(r.v_hashSlots)) + 3;
  rows[k].v_hashSlots += 1;
  const r = compareCopyToFrozen(p, parse(rows));
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.first.col, 'v_hashSlots');
});

test('PG7 replay refuses timeframes whose anchors are not clock-aligned', () => {
  assert.throws(() => compareExport(parse(base), { tf: 'M15', mintick: MINTICK }), /M1 and M5/);
});
