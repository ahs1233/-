// node --test indicators/lastgtg/history/score.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { lowerBound, scoreBid, scoreSpread, wilson, tally, Z_995 } from './score.mjs';

const m1 = (rows) => ({ t: rows.map((r) => r[0]), h: rows.map((r) => r[1]), l: rows.map((r) => r[2]), ah: rows.map((r) => r[3] ?? NaN), al: rows.map((r) => r[4] ?? NaN) });

test('lowerBound', () => {
  assert.equal(lowerBound([1, 3, 5], 0), 0);
  assert.equal(lowerBound([1, 3, 5], 3), 1);
  assert.equal(lowerBound([1, 3, 5], 4), 2);
  assert.equal(lowerBound([1, 3, 5], 9), 3);
});

test('scoreBid: first touch, tie = loss_both, expiry, end', () => {
  const m = m1([[1, 101, 99.5], [2, 102, 100], [3, 103, 97]]);
  assert.deepEqual(scoreBid(m, 0, 1, 102, 98, 99), { res: 'win', j: 1 });
  assert.deepEqual(scoreBid(m, 0, -1, 98, 102, 99), { res: 'loss', j: 1 });
  assert.deepEqual(scoreBid(m, 2, 1, 102, 98, 99), { res: 'loss_both', j: 2 });
  assert.deepEqual(scoreBid(m, 0, 1, 110, 90, 2), { res: 'expired', j: 1 });
  assert.deepEqual(scoreBid(m, 0, 1, 110, 90, 99), { res: 'open_at_end', j: -1 });
});

test('scoreSpread: long buys ASK sells BID, short sells BID buys ASK', () => {
  // long: entry ask 100.3, dist 1 -> target 101.3 on BID high, stop 99.3 on BID low
  const m = m1([[1, 101.0, 99.5, 101.3, 99.8], [2, 101.4, 100, 101.7, 100.3]]);
  assert.equal(scoreSpread(m, 0, 1, 100, 100.3, 1, 99).res, 'win');
  assert.equal(scoreSpread(m, 0, 1, 100, 100.3, 1, 99).j, 1);
  // short: entry bid 100, target 99 on ASK low, stop 101 on ASK high -> ASK high 101.3 at j=0
  assert.equal(scoreSpread(m, 0, -1, 100, 100.3, 1, 99).res, 'loss');
  assert.equal(scoreSpread(m1([[1, 1, 1]]), 0, -1, 100, NaN, 1, 99).res, 'no_ask');
  assert.equal(scoreSpread(m, 0, 1, 100, NaN, 1, 99).res, 'no_ask');
});

test('wilson and tally', () => {
  const [lo, hi] = wilson(60, 100, 1.959964);
  assert.ok(Math.abs(lo - 0.502) < 0.001 && Math.abs(hi - 0.691) < 0.001);
  assert.ok(wilson(60, 100, Z_995)[0] < 0.47);
  const t = tally(['win', 'win', 'loss', 'loss_both', 'expired', 'open_at_end']);
  assert.equal(t.n, 5); assert.equal(t.share, 0.4); assert.equal(t.open_at_end, 1);
});
