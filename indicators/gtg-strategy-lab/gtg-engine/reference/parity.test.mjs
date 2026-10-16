// Pine↔JS parity fixtures for symbol-metadata-dependent formulas (review item R2).
// Oracles are hand calculations of the Pine formulas cited per test, written
// independently of engine.mjs; tolerance for float results: 1e-12 absolute.
// Run: node --test indicators/gtg-navigator/reference/parity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SRC, TF, TYP, makeLevel, runEpisode, computeSeries, Engine, withSymbol } from './engine.mjs';

const TOL = 1e-12;
const near = (a, b) => Math.abs(a - b) <= TOL;

// Independent single-bar episode oracle for pine:863-877 (runEpisode), valid when the
// episode starts and ends on the same bar: width = max(hi − lo, mintick).
function oracleEpisode({ lo, hi, h, l, c, pc, atr, mintick, polarity, mitAlpha = 0.6, rejAtrK = 1.0 }) {
  const width = Math.max(hi - lo, mintick);
  const side = pc > hi ? 1 : pc < lo ? -1 : (polarity > 0 ? -1 : 1);
  const rawDepth = side < 0 ? (h - lo) / width : (hi - l) / width;
  const depth = Math.min(1, Math.max(0, rawDepth));
  const exit = side < 0 ? c < lo : c > hi;
  if (!exit) return null;
  const exc = side < 0 ? lo - c : c - hi;
  const rej = Math.min(1, Math.max(0, exc / (rejAtrK * atr)));
  return { rej, mitigation: depth * (1 - rej) * mitAlpha };
}

const level = (lo, hi, typ) => makeLevel({ key: 1, lo, hi, source: SRC.SWING, tfRank: TF.LOCAL, typ, birthTime: 0, s: 60, lastTestChartBar: 0 });

test('P1 R2 fixture: zone narrower than mintick uses width = mintick (Pine runEpisode)', () => {
  // lo=99.999 hi=100 mintick=0.01 ATR=0.1; high=100, low=close=prevClose=99.98; bar 10.
  const P = withSymbol(DEFAULTS, { mintick: 0.01 });
  const lv = level(99.999, 100, TYP.HIGH);
  const rej = runEpisode(lv, 100, 99.98, 99.98, 99.98, 0.1, 10, P);
  // Hand oracle: width 0.01, depth 0.001/0.01 = 0.1, rej 0.019/0.1 = 0.19, mit 0.1·0.81·0.6.
  assert.ok(near(rej, 0.19), `rej ${rej}`);
  assert.ok(near(lv.mitigation, 0.0486), `mitigation ${lv.mitigation}`);
});

test('P2 width floor across mintick sizes and both approach sides', () => {
  const cases = [];
  for (const mintick of [0.00001, 0.01, 0.25, 1]) {
    // Zone narrower than one tick (resistance, approached from below).
    cases.push({ lo: 100, hi: 100 + mintick / 4, h: 100 + mintick / 8, l: 99, c: 100 - 3 * mintick, pc: 99.5, atr: 50 * mintick, mintick, typ: TYP.HIGH, polarity: 1 });
    // Zone exactly one tick wide (support, approached from above).
    cases.push({ lo: 100, hi: 100 + mintick, h: 101, l: 100 + mintick / 2, c: 100 + 4 * mintick, pc: 101, atr: 50 * mintick, mintick, typ: TYP.LOW, polarity: -1 });
    // Zone wider than a tick: the floor must not matter.
    cases.push({ lo: 100, hi: 100 + 20 * mintick, h: 100 + 5 * mintick, l: 99, c: 100 - mintick, pc: 99.5, atr: 50 * mintick, mintick, typ: TYP.HIGH, polarity: 1 });
  }
  for (const k of cases) {
    const lv = level(k.lo, k.hi, k.typ);
    const rej = runEpisode(lv, k.h, k.l, k.c, k.pc, k.atr, 10, withSymbol(DEFAULTS, { mintick: k.mintick }));
    const o = oracleEpisode(k);
    assert.ok(o !== null && rej !== null, 'episode must close on this bar');
    assert.ok(near(rej, o.rej), `rej ${rej} vs ${o.rej} (mintick ${k.mintick})`);
    assert.ok(near(lv.mitigation, o.mitigation), `mitigation ${lv.mitigation} vs ${o.mitigation} (mintick ${k.mintick})`);
  }
});

test('P3 ATR floor: zero-range bars give atrEng = mintick (pine:532)', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ t: i * 60_000, o: 100, h: 100, l: 100, c: 100 }));
  const P = withSymbol(DEFAULTS, { mintick: 0.01 });
  const { atrEng } = computeSeries(bars, P);
  assert.ok(atrEng.every((a) => a === 0.01), `atrEng ${atrEng.slice(0, 3)}`);
  // Warm-up (fewer than ATR_ENG_LEN bars): nz(sma, tr) = tr, still floored.
  assert.equal(atrEng[0], 0.01);
});

test('P4 anchor ATR floor: na stays na, positive values are floored at mintick (pine:571-572)', () => {
  const bars = Array.from({ length: 5 }, (_, i) => ({ t: i * 60_000, o: 100, h: 101, l: 99, c: 100 }));
  const P = withSymbol(DEFAULTS, { mintick: 0.01 });
  const series = computeSeries(bars, P);
  const feed = (i) => ({ now: [null, i, i], atrA1: i === 0 ? null : 0.0001, atrA2: 3, items: [] });
  const eng = new Engine(bars, series, P, { anchorFeed: feed });
  const r0 = eng.step(0);
  assert.equal(r0.ctx.atrA1, null);
  const r1 = eng.step(1);
  assert.equal(r1.ctx.atrA1, 0.01);
  assert.equal(r1.ctx.atrA2, 3);
});

test('P5 contract: formulas that need the symbol tick refuse to run without it', () => {
  const lv = level(99.999, 100, TYP.HIGH);
  assert.throws(() => runEpisode(lv, 100, 99.98, 99.98, 99.98, 0.1, 10, DEFAULTS), /mintick/);
  assert.throws(() => computeSeries([{ t: 0, o: 1, h: 1, l: 1, c: 1 }], DEFAULTS), /mintick/);
  assert.throws(() => withSymbol(DEFAULTS, { mintick: 0 }), /mintick/);
  assert.throws(() => withSymbol(DEFAULTS, {}), /mintick/);
});

test('P6 negative control: re-injecting the 1e-12 floor breaks P1', () => {
  const lv = level(99.999, 100, TYP.HIGH);
  runEpisode(lv, 100, 99.98, 99.98, 99.98, 0.1, 10, { ...DEFAULTS, mintick: 1e-12 });
  const o = oracleEpisode({ lo: 99.999, hi: 100, h: 100, l: 99.98, c: 99.98, pc: 99.98, atr: 0.1, mintick: 0.01, polarity: 1 });
  assert.ok(!near(lv.mitigation, o.mitigation), 'the P1 check must detect the baseline defect');
  assert.ok(near(lv.mitigation, 0.486), `defect reproduces the baseline value, got ${lv.mitigation}`);
});
