// H1–H5 rows for the Train Power Gate: Train only, Holdout locked, R censored at the Train end,
// P1 width, Train quantile edges; power driver reports no ATT.
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars } from '../gtg-engine/reference/history.mjs';
import { buildHypotheses, H } from './hypotheses.mjs';
import { makeSplit } from './split.mjs';
import { powerTrain } from '../stats/power_train.mjs';

const agg = (m1, s) => {
  const out = [];
  for (const b of m1) {
    const k = b.t - (b.t % (s * 1000)), x = out[out.length - 1];
    if (x && x.t === k) { x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; x.v += b.v; }
    else out.push({ t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
};
const m1 = marketBars(42000, 11).map((b, i) => ({ t: b.t, o: b.o * 20, h: b.h * 20, l: b.l * 20, c: b.c * 20, v: 50 + ((i * 7919) % 97) }));
const feeds = { M5: agg(m1, 300), M15: agg(m1, 900), H1: agg(m1, 3600), H4: agg(m1, 14400), D: agg(m1, 86400), W: agg(m1, 604800) };
const split = makeSplit(feeds.M5[2000].t, feeds.M5.at(-1).t + 300_000, { excluded: [] });
let HYP = null;
const hyp = () => (HYP ??= buildHypotheses(feeds, { mintick: 0.01, split }));

test('HY1 rows are Train only, R censored at the Train end, strata from Train edges', () => {
  const r = hyp();
  const [b1] = split.boundaries;
  for (const h of H) for (const x of r.rows[h]) {
    assert.equal(split.segmentOf(x.time), 'train', `${h} row outside Train`);
    if (Number.isFinite(x.R)) assert.ok(feeds.M5[x.t + 12].t < b1, `${h} R reads past the Train end`);
    assert.ok(x.day && x.cluster);
  }
  assert.ok(r.w > 0 && r.edges.H3.widthEdges.length === 2 && r.edges.H3.levelAgeEdges.length === 3 && r.edges.H4.levelAgeEdges.length === 3);
  const p1 = r.rows.H3.filter((x) => !x.isEvent), gtg = r.rows.H3.filter((x) => x.isEvent);
  assert.ok(p1.length > 0 && gtg.length > 0, 'H3 has GTG events and P1 controls');
  assert.ok(r.rows.H3.some((x) => x.stratum !== null), 'H3 rows reach a stratum (P1 rows carry width)');
  assert.ok(r.rows.H5.length > 0 && r.rows.H4.length > 0);
});

test('HY2 the power driver reports gate quantities only — never an ATT', () => {
  const rep = powerTrain(hyp(), { nDays: 10, Bout: 30, BinA: 60, BinB: 120, grid: { step: 0.05, max: 1.0 } });
  const keys = Object.keys(rep.per[0]).sort();
  assert.ok(!keys.some((k) => /att|expect|pf|mean/i.test(k)), keys.join(','));
  for (const x of rep.per) assert.ok(['POWERED', 'UNDERPOWERED'].includes(x.verdict));
});
