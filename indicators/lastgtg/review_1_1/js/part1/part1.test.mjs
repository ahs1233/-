// node --test indicators/lastgtg/review_1_1/js/part1/part1.test.mjs
// Part 1 scoring rules on synthetic minutes (../../TEST_PREREGISTRATION.md v1.1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateTrade } from './trade.mjs';
import { tradingDay, nyOffset, blockLength, matchedDraws, blockResamples, trailingMedian, interval, sessionOf } from './stats.mjs';

const T0 = Date.UTC(2023, 4, 10, 12, 0); // a Wednesday, 12:00 UTC
const MIN = 60_000, TF = 15 * MIN;
// rows: [bo, bh, bl, bc, ao, ah, al, ac] per minute starting at `start`, optional time gaps.
function m1(rows, start = T0, times = null) {
  const n = rows.length, col = (k) => Float64Array.from(rows, (r) => (r[k] == null ? NaN : r[k]));
  return { t: Float64Array.from(times ?? rows.map((_, i) => start + i * MIN)), bo: col(0), bh: col(1), bl: col(2), bc: col(3), ao: col(4), ah: col(5), al: col(6), ac: col(7) };
}
const flat = (p, s = 0.2) => [p, p, p, p, p + s, p + s, p + s, p + s];
const sig = (over = {}) => ({ close: T0, tfMs: TF, dir: 1, d: 1, expiryClose: T0 + 300 * TF, ...over });

test('long: enters at the ASK open of the first minute at or after the close, exits on BID at the target', () => {
  const r = simulateTrade(m1([flat(100), [100, 100.5, 99.9, 100.4, 100.2, 100.7, 100.1, 100.6], [100.4, 101.3, 100.3, 101.1, 100.6, 101.5, 100.5, 101.3]]), sig());
  assert.equal(r.status, 'done'); assert.equal(r.entry, 100.2); assert.equal(r.outcome, 'target');
  assert.equal(r.exit, 101.2); assert.ok(Math.abs(r.R - 1) < 1e-12); assert.ok(Math.abs(r.spread - 0.2) < 1e-12);
});

test('short: enters at the BID open, exits on ASK; costs inside R', () => {
  // entry 100 (BID); target 99, stop 101 on ASK. Ask low reaches 98.9 at minute 2.
  const r = simulateTrade(m1([flat(100), [99.5, 99.6, 98.7, 98.8, 99.7, 99.8, 98.9, 99.0]]), sig({ dir: -1 }));
  assert.equal(r.outcome, 'target'); assert.equal(r.exit, 99); assert.ok(Math.abs(r.R - 1) < 1e-12);
});

test('entry minute: only its high and low; both touched = stop', () => {
  const r = simulateTrade(m1([[100, 101.5, 98.5, 100, 100, 101.5, 98.5, 100]]), sig({ d: 1 }));
  assert.equal(r.outcome, 'both'); assert.equal(r.exit, 99); assert.ok(Math.abs(r.R + 1) < 1e-12);
});

test('later minute: an open beyond the stop exits at that open (loss beyond 1R)', () => {
  const r = simulateTrade(m1([flat(100, 0), [98.5, 98.6, 98.2, 98.4, 98.5, 98.6, 98.2, 98.4]]), sig());
  assert.equal(r.outcome, 'stop_open'); assert.equal(r.exit, 98.5); assert.ok(Math.abs(r.R + 1.5) < 1e-12);
});

test('later minute: an open beyond the target exits at the target, not the open', () => {
  const r = simulateTrade(m1([flat(100, 0), [101.6, 101.7, 101.5, 101.6, 101.6, 101.7, 101.5, 101.6]]), sig());
  assert.equal(r.outcome, 'target'); assert.equal(r.exit, 101); assert.ok(Math.abs(r.R - 1) < 1e-12);
});

test('nothing inside the signal bar: a minute opening before the close is ignored', () => {
  const r = simulateTrade(m1([[100, 105, 95, 100, 100, 105, 95, 100], flat(100, 0), [100, 101.2, 99.9, 101, 100, 101.2, 99.9, 101]], T0 - MIN), sig());
  assert.equal(r.entryT, T0); assert.equal(r.outcome, 'target');
});

test('not executable: heading 0, a gap longer than one signal bar, a missing entry-side open', () => {
  assert.equal(simulateTrade(m1([flat(100)]), sig({ dir: 0 })).cause, 'heading0');
  assert.equal(simulateTrade(m1([flat(100)], T0 + TF + MIN), sig()).cause, 'gap');
  assert.notEqual(simulateTrade(m1([flat(100)], T0 + TF), sig()).cause, 'gap'); // exactly one bar later is allowed
  assert.equal(simulateTrade(m1([[100, 100, 100, 100, null, null, null, null]]), sig()).cause, 'missing_open');
  assert.equal(simulateTrade(m1([[100, 100, 100, 100, null, null, null, null]]), sig({ dir: -1 })).status, 'unresolved_end');
});

test('expired at the last M1 close at or before the 300th bar close, on the exit side', () => {
  const rows = Array.from({ length: 40 }, (_, i) => [100, 100.1, 99.9, 100 + i * 0.001, 100.2, 100.3, 100.1, 100.2]);
  const r = simulateTrade(m1(rows), sig({ expiryClose: T0 + 30 * MIN }));
  assert.equal(r.outcome, 'expired'); assert.equal(r.exitT, T0 + 29 * MIN); assert.equal(r.exit, 100 + 29 * 0.001);
});

test('unresolved_end: the M1 data end before the trade is resolved, or no expiry bar in the feed', () => {
  const rows = Array.from({ length: 10 }, () => flat(100));
  assert.equal(simulateTrade(m1(rows), sig()).status, 'unresolved_end');
  assert.equal(simulateTrade(m1(rows), sig({ expiryClose: Infinity })).status, 'unresolved_end');
});

test('trading day: New York 17:00 to 17:00 across both DST regimes', () => {
  assert.equal(nyOffset(Date.UTC(2023, 6, 1)), -4); assert.equal(nyOffset(Date.UTC(2023, 0, 10)), -5);
  assert.equal(nyOffset(Date.UTC(2023, 2, 12, 6, 59)), -5); assert.equal(nyOffset(Date.UTC(2023, 2, 12, 7)), -4);
  // Summer: 21:00 UTC is 17:00 NY, the next day starts.
  assert.equal(tradingDay(Date.UTC(2023, 6, 5, 20, 59)) + 1, tradingDay(Date.UTC(2023, 6, 5, 21, 0)));
  // Winter: 22:00 UTC.
  assert.equal(tradingDay(Date.UTC(2023, 0, 5, 21, 59)) + 1, tradingDay(Date.UTC(2023, 0, 5, 22, 0)));
  for (let t = Date.UTC(2021, 0, 1); t < Date.UTC(2025, 0, 1); t += 3_600_000 * 7) {
    const ny = new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit' });
    const h = (new Date(t).getUTCHours() + nyOffset(t) + 24) % 24;
    assert.equal(Number(ny) % 24, h, new Date(t).toISOString());
  }
});

test('block length counts distinct trading days over 301 bars starting in the period', () => {
  const t = [];
  for (let d = 0; d < 30; d++) for (let h = 0; h < 20; h++) t.push(Date.UTC(2023, 0, 2 + d, 0) + h * 3_600_000);
  const { L } = blockLength(t, t[0], t[t.length - 1] + 1, 21);
  assert.ok(L === 2 || L === 3);
});

test('matched draws respect strata and replacement rule; resamples are circular blocks', () => {
  const pool = new Map([['a', [1, 2, 3]], ['b', [9]]]);
  const d = matchedDraws(['a', 'a', 'b', 'b'], pool, 5, 1);
  for (const x of d) { assert.equal(x.filter((i) => i < 9).length, 2); assert.equal(new Set(x.filter((i) => i < 9)).size, 2); assert.equal(x.filter((i) => i === 9).length, 2); }
  const r = blockResamples(10, 3, 4, 1);
  for (const a of r) { assert.equal(a.length, 10); for (let k = 1; k < 3; k++) assert.equal(a[k], (a[0] + k) % 10); }
});

test('helpers: trailing median, percentile interval, session buckets', () => {
  const m = trailingMedian([1, 2, 3, 4, 5, 100], 3);
  assert.ok(Number.isNaN(m[2])); assert.equal(m[3], 2); assert.equal(m[5], 4);
  assert.deepEqual(interval([1, 2, 3, 4, 5], 0.5), [2, 4]);
  assert.deepEqual([0, 6, 7, 11, 12, 15, 16, 20, 21, 23].map((h) => sessionOf(Date.UTC(2023, 0, 1, h))), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

import { outcomeOf, groupOf } from './part2.mjs';
test('Part 2: reaction before break on the side price came from; 48-bar window; strength words', () => {
  const z = { lo: 100, hi: 101, atr: 2, side: 1 }; // price came from above (support)
  assert.equal(outcomeOf([100.5, 102, 103.1], 0, z, 0.1), 'reaction'); // close >= hi + atr
  assert.equal(outcomeOf([100.5, 99.7], 0, z, 0.1), 'break'); // close < lo - 0.1·atr
  assert.equal(outcomeOf([100.5, 99.9, 103.2], 0, z, 0.1), 'reaction'); // 99.9 is not beyond lo - 0.2
  const flat48 = Array(48).fill(100.5);
  assert.equal(outcomeOf(flat48, 0, z, 0.1), 'neither');
  assert.equal(outcomeOf([...flat48, 104], 0, z, 0.1), 'neither'); // 49th close is outside the window
  assert.equal(outcomeOf(Array(10).fill(100.5), 0, z, 0.1), 'unresolved_end');
  assert.equal(outcomeOf([100.5, 98.1, 97.9], 0, { ...z, side: -1 }, 0.1), 'reaction'); // from below: close <= lo - atr (98)
  assert.deepEqual([47.9, 48, 71.9, 72].map(groupOf), ['weak', 'medium', 'medium', 'important']);
});
