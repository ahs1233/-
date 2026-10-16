// PCMP — Pine float comparison semantics (FAILURE_LOG F-007).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eq, ne, lt, gt, le, ge } from './pine-cmp.mjs';
import { SOURCES, sha256 } from './pinecmp/build.mjs';
import * as REF from '../gtg-engine/reference/engine.mjs';
import * as PC from './pinecmp/zone-engine.mjs';
import { canonicalSnapshot, compareSnapshots } from '../gtg-engine/reference/snapshot.mjs';
import { marketBars, loadInputs } from '../gtg-engine/reference/history.mjs';
import { consumerStep, newConsumerState } from './pinecmp/consumer.mjs';
import * as JSC from './consumer.mjs';
import { INPUTS } from './profiles.mjs';

const lab = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

test('PCMP1 the TradingView probe table (2026-09-29, probes 1 and 2)', () => {
  const T = [
    [le(1 + 9e-11, 1), true], [le(1 + 1e-10, 1), false], [le(1 + 1e-11, 1), true], [le(1 + 1e-9, 1), false],
    [gt(1 + 1e-10, 1), true], [gt(1 + 1e-13, 1), false],
    [le(4000 + 5e-11, 4000), true], [le(4000 + 2e-10, 4000), false], [le(4000 + 1e-8, 4000), false],
    [le(1e6 + 1e-6, 1e6), false], [le(1e6 + 1e-5, 1e6), false],
    [le(1e-6 + 1e-12, 1e-6), true], [le(1e-6 + 1e-15, 1e-6), true],
    [ge(1 - 5e-11, 1), true], [le(0 + 5e-11, 0), true], [le(0 + 2e-10, 0), false],
    [eq(0.1 + 0.2, 0.3), true], [le(0.3000000000001682, 0.3), true],
  ];
  T.forEach(([got, want], k) => assert.equal(got, want, `row ${k}`));
});

test('PCMP2 na and non-numbers keep JavaScript semantics', () => {
  for (const f of [lt, gt, le, ge, eq]) assert.equal(f(NaN, 1), false);
  assert.equal(eq(NaN, NaN), false);
  assert.equal(ne(NaN, NaN), true);
  assert.equal(eq(Infinity, Infinity), true);
  assert.equal(eq('a', 'a'), true);
  assert.equal(eq(null, 0), false);
  assert.equal(eq(undefined, null), false);
  assert.equal(lt(2, 3), true);
  assert.equal(ge(3, 2), true);
});

test('PCMP3 every generated file is built from the current source (rebuild: node engine/pinecmp/build.mjs)', () => {
  for (const [src, gen] of SOURCES) {
    const g = readFileSync(lab(`engine/pinecmp/${gen}`), 'utf8');
    const m = g.match(/^\/\/ source sha256: ([0-9a-f]{64})$/m);
    assert.ok(m, `${gen}: header`);
    assert.equal(m[1], sha256(readFileSync(lab(src), 'utf8')), `${gen} is stale for ${src}`);
    assert.ok(!/[^=!<>]([<>]=?|[!=]==)[^=<>]/.test(g.replace(/^\/\/.*$/gm, '').replace(/=>/g, '').replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, '')),
      `${gen}: a raw comparison operator survived`);
  }
});

test('PCMP4 Pine-comparison zone engine = reference on synthetic data (no near-ties there)', () => {
  const P = REF.withSymbol(REF.DEFAULTS, { mintick: 0.01 });
  for (const seed of [3, 11]) {
    const n = 4000, market = marketBars(n, seed);
    const { chart, series, anchorFeed } = loadInputs(market, P, { first: 0, last: n - 1 });
    const opts = { anchorFeed, a1Sec: 300, a2Sec: 900 };
    const ref = new REF.Engine(chart, series, P, opts), pc = new PC.Engine(chart, series, P, opts);
    for (let i = 0; i < n; i++) {
      const a = canonicalSnapshot(ref, ref.step(i), i, { symbol: 'SYN', timeframe: '1' });
      const b = canonicalSnapshot(pc, pc.step(i), i, { symbol: 'SYN', timeframe: '1' });
      assert.deepEqual(compareSnapshots(a, b, ['state', 'events']), [], `seed ${seed} bar ${i}`);
    }
  }
});

test('PCMP5 regression M1 2026-09-25T07:28Z: obstacle 0.30000000000001 ATR away engages no-chase like Pine', () => {
  // The parity mismatch that found F-007: nearestObstacleAtr = 0.30000000000016824 vs
  // noChaseAtr = 0.30 → Pine sets noChase (eventBits 5120), exact JS did not (1024).
  const atr = 1, c = 100, lo = 100.30000000000001;
  assert.ok((lo - c) / atr > INPUTS.noChaseAtr, 'the case is a strict > in binary64');
  const R1 = { active: true, lo, hi: lo + 1, quality: 40, gateQ: 40, containing: false, entryKeys: [1] };
  const S1 = { active: true, lo: 90, hi: 91, quality: 40, gateQ: 40, containing: false, entryKeys: [2] };
  const E = { active: false };
  const bar = { o: 99.9, h: 100.05, l: 99.8, c };
  const s = { tacticalSign: 1, routeSign: 1, fuelAcceleration: -10, fuelScore: 10, speedScore: 90, instantSpeedScore: 90, headingScore: 0 };
  const ev = {};
  const pine = consumerStep(newConsumerState(), bar, [R1, E, S1, E], ev, s, atr);
  const exact = JSC.consumerStep(JSC.newConsumerState(), bar, [R1, E, S1, E], ev, s, atr);
  assert.equal(pine.noChaseUp, true);
  assert.equal(pine.noChaseEvent, true);
  assert.equal(exact.noChaseUp, false, 'exact JavaScript comparison misses it');
});
