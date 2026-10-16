// GTG-state parity between two sources: ratios only (GPT messages 38, 42).
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars } from '../gtg-engine/reference/history.mjs';
import { sourceParity } from './source_parity.mjs';

const agg = (m1, s) => {
  const out = [];
  for (const b of m1) {
    const k = b.t - (b.t % (s * 1000)), x = out[out.length - 1];
    if (x && x.t === k) { x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; x.v += b.v; }
    else out.push({ t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
};
const m1Of = (scale) => marketBars(9000, 11).map((b, i) => ({ t: b.t, o: b.o * scale, h: b.h * scale, l: b.l * scale, c: b.c * scale, v: 50 + ((i * 7919) % 97) }));
const feedsOf = (m1) => ({ M5: agg(m1, 300), M15: agg(m1, 900), H1: agg(m1, 3600), H4: agg(m1, 14400), D: agg(m1, 86400), W: agg(m1, 604800) });

test('SP1 identical sources agree fully; a different source does not; no counts in the report', () => {
  const a = feedsOf(m1Of(20));
  const same = sourceParity(a, feedsOf(m1Of(20)), { mintick: 0.01, w: 0.3 });
  assert.equal(same.m5_bar_overlap, 1);
  for (const v of Object.values(same.state_agreement)) assert.equal(v, 1);
  for (const v of Object.values(same.event_jaccard)) assert.ok(v === null || v === 1);
  const other = sourceParity(a, feedsOf(m1Of(20).map((b, i) => (i % 7 ? b : { ...b, h: b.h + 0.4, c: b.c + 0.2 }))), { mintick: 0.01, w: 0.3 });
  assert.ok(Object.values(other.event_jaccard).some((v) => v !== null && v < 1));
  const values = [other.m5_bar_overlap, ...Object.values(other.state_agreement), ...Object.values(other.event_jaccard)];
  assert.ok(values.every((x) => x === null || (x >= 0 && x <= 1)), 'only ratios in [0, 1]');
  assert.deepEqual(Object.keys(other).sort(), ['event_jaccard', 'label', 'm5_bar_overlap', 'state_agreement']);
});
