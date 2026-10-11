// SP — historical split, embargo, excluded windows, walk-forward folds and the Holdout lock (§20, §21).
import test from 'node:test';
import assert from 'node:assert/strict';
import { warmupBars, firstValidTime, makeSplit, assertNotHoldout, EMBARGO_BARS, M5_MS } from './split.mjs';

test('SP1 warm-up per timeframe = max(engineWindow, rankLen, 200); D = 200', () => {
  assert.deepEqual(['M5', 'M15', 'H1', 'H4', 'D'].map((tf) => warmupBars(tf, 0.001)), [1600, 2113, 3137, 5441, 200]);
});

test('SP2 first valid time waits for the slowest timeframe (by close time)', () => {
  const mk = (n, dur, t0 = 0) => Array.from({ length: n }, (_, i) => ({ t: t0 + i * dur }));
  const feeds = { M5: mk(400_000, 300_000), M15: mk(140_000, 900_000), H1: mk(35_000, 3_600_000), H4: mk(8_800, 14_400_000), D: mk(1_460, 86_400_000) };
  const r = firstValidTime(feeds, 0.001);
  assert.equal(r.t, 5441 * 14_400_000);                         // H4 is the slowest: 5441 × 4 h
  assert.match(firstValidTime({ ...feeds, D: mk(150, 86_400_000) }, 0.001).reason, /^D: 150 < 200/);
});

test('SP3 50/20/30 by time, 48-bar embargo on both sides of each boundary, excluded days, 5 equal dev folds', () => {
  const day = 86_400_000, first = Date.UTC(2020, 0, 1), freeze = first + 1000 * day;
  const s = makeSplit(first, freeze);
  assert.deepEqual(s.boundaries, [first + 500 * day, first + 700 * day]);
  const [b1, b2] = s.boundaries, e = EMBARGO_BARS * M5_MS;
  assert.equal(s.segmentOf(b1 - e - 1), 'train');
  assert.equal(s.segmentOf(b1 - e), 'embargo');
  assert.equal(s.segmentOf(b1 + e - 1), 'embargo');
  assert.equal(s.segmentOf(b1 + e), 'validation');
  assert.equal(s.segmentOf(b2 + e), 'holdout');
  assert.equal(s.segmentOf(freeze), 'outside');
  assert.equal(s.segmentOf(first - 1), 'outside');
  const x = makeSplit(Date.UTC(2023, 0, 1), Date.UTC(2026, 9, 1));
  assert.equal(x.segmentOf(Date.UTC(2024, 0, 5, 12)), 'excluded');
  assert.deepEqual([0, 139, 140, 699].map((d) => s.foldOf(first + d * day + 1)), [0, 0, 1, 4]);
  assert.equal(s.foldOf(b2 + e), null);                          // holdout is not a fold
  assert.equal(s.foldOf(b1), null);                              // embargoed rows are in no fold
});

test('SP4 the Holdout lock rejects any holdout row before the final step', () => {
  const day = 86_400_000, first = Date.UTC(2020, 0, 1), s = makeSplit(first, first + 1000 * day);
  assert.doesNotThrow(() => assertNotHoldout([{ time: first + 10 * day }], s));
  assert.throws(() => assertNotHoldout([{ time: first + 10 * day }, { time: first + 900 * day }], s), /HOLDOUT LOCKED/);
});
