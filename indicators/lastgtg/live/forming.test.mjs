// node --test indicators/lastgtg/live/forming.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { withForming } from './forming.mjs';
import { containingIndex } from '../../gtg-strategy-lab/engine/pinecmp/sensors.mjs';

const M15 = 900, min = 60_000;
const htf = [0, 15, 30].map((m) => ({ t: m * min, o: 1, h: 2, l: 0, c: 1, v: 1 })); // closed 00:00, 00:15, 00:30

test('chart bar inside the forming HTF bar: containing index is the forming bar', () => {
  const chart = [{ t: 50 * min }]; // 00:50 lies in the 00:45 bar, not yet closed
  assert.equal(containingIndex(chart, htf)[0], 2); // without it: 00:30 (one too early)
  const f = withForming(htf, M15, chart[0].t);
  assert.equal(f.length, 4);
  assert.equal(f[3].t, 45 * min);
  assert.equal(containingIndex(chart, f)[0], 3); // k-1 = 00:30, the last closed bar
});

test('chart bar = last minute of a just-closed HTF bar: nothing appended', () => {
  const chart = [{ t: 44 * min }];
  assert.equal(withForming(htf, M15, chart[0].t), htf);
  assert.equal(containingIndex(chart, htf)[0], 2);
});

test('after a gap the placeholder still sits before the chart bar', () => {
  const f = withForming(htf, M15, 600 * min);
  assert.equal(f.at(-1).t, 45 * min);
  assert.equal(containingIndex([{ t: 600 * min }], f)[0], 3);
});
