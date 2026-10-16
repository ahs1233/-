// TA — Pine series semantics against hand-computed oracles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { atr, ema, hist, nz, percentrank, rma, sma, trTrue, wma } from './pine-ta.mjs';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('TA1 sma: na until len values; na inside the window propagates', () => {
  const s = sma([1, 2, 3, 4, NaN, 6, 7, 8], 3);
  assert.ok(Number.isNaN(s[0]) && Number.isNaN(s[1]));
  assert.deepEqual(s.slice(2, 4), [2, 3]);
  assert.ok(Number.isNaN(s[4]) && Number.isNaN(s[5]) && Number.isNaN(s[6]));
  assert.equal(s[7], 7);
});

test('TA2 ema seed "first" = documented Pine recursion; "sma" = SMA seed', () => {
  const x = [10, 11, 12, 13];
  const a = 2 / 4;
  const e = ema(x, 3, 'first');
  assert.equal(e[0], 10);
  close(e[1], a * 11 + (1 - a) * 10);
  close(e[3], a * 13 + (1 - a) * (a * 12 + (1 - a) * (a * 11 + (1 - a) * 10)));
  const s = ema(x, 3, 'sma');
  assert.ok(Number.isNaN(s[0]) && Number.isNaN(s[1]));
  assert.equal(s[2], 11);
  close(s[3], a * 13 + (1 - a) * 11);
});

test('TA3 ema restarts from src after an na source value (na(sum[1]) branch)', () => {
  const e = ema([1, NaN, 5, 7], 3, 'first');
  assert.equal(e[0], 1);
  assert.ok(Number.isNaN(e[1]));
  assert.equal(e[2], 5);
});

test('TA4 rma seeded by sma; atr = rma(tr(true))', () => {
  const r = rma([2, 4, 6, 8], 2);
  assert.ok(Number.isNaN(r[0]));
  assert.equal(r[1], 3);
  close(r[2], 0.5 * 6 + 0.5 * 3);
  const bars = [{ h: 10, l: 8, c: 9 }, { h: 12, l: 9, c: 11 }, { h: 11, l: 7, c: 8 }];
  assert.deepEqual(trTrue(bars), [2, 3, 4]); // bar 0: h − l; bar 2: max(4, |11−11|, |7−11|)
  const a = atr(bars, 2);
  assert.equal(a[1], 2.5);
  close(a[2], 0.5 * 4 + 0.5 * 2.5);
});

test('TA5 percentrank: na until len previous values; share of them <= current', () => {
  // i = 4, current 2, previous four = [3, 3, 1, 5]: values ≤ 2 → {1} → 25
  // i = 5, current 9, previous four = [2, 3, 3, 1]: all ≤ 9 → 100
  const p = percentrank([5, 1, 3, 3, 2, 9], 4);
  assert.ok(p.slice(0, 4).every(Number.isNaN));
  assert.equal(p[4], 25);
  assert.equal(p[5], 100);
});

test('TA6 wma, hist, nz', () => {
  const w = wma([1, 2, 3], 3);
  close(w[2], (1 * 1 + 2 * 2 + 3 * 3) / 6);
  assert.ok(Number.isNaN(hist([1, 2], 0, 1)));
  assert.equal(hist([1, 2], 1, 1), 1);
  assert.equal(nz(NaN, 4), 4);
  assert.equal(nz(0, 4), 0);
});
