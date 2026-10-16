// Engineering smoke test tool: PASS/FAIL only, never a count (GPT message 38).
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars } from '../gtg-engine/reference/history.mjs';
import { smokeTest, feedErrors, aggregationErrors, engineErrors, LABEL } from './smoke.mjs';

const agg = (m1, s) => {
  const out = [];
  for (const b of m1) {
    const k = b.t - (b.t % (s * 1000)), x = out[out.length - 1];
    if (x && x.t === k) { x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; x.v += b.v; }
    else out.push({ t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
};
const m1 = marketBars(9000, 11).map((b, i) => ({ t: b.t, o: b.o * 20, h: b.h * 20, l: b.l * 20, c: b.c * 20, v: 50 + ((i * 7919) % 97) }));
const feedsOf = () => ({ M5: agg(m1, 300), M15: agg(m1, 900), H1: agg(m1, 3600), H4: agg(m1, 14400), D: agg(m1, 86400), W: agg(m1, 604800) });
const status = (rep) => Object.fromEntries(rep.checks.map((c) => [c.name, c.status]));
let BASE = null;
const base = () => (BASE ??= smokeTest(feedsOf(), { mintick: 0.01, w: 0.3 }));

test('SM1 report carries PASS/FAIL and error names only — no counts', () => {
  const rep = base();
  assert.equal(rep.label, LABEL);
  assert.deepEqual(Object.keys(rep).sort(), ['checks', 'label', 'verdict']);
  for (const c of rep.checks) {
    assert.deepEqual(Object.keys(c).sort(), ['errors', 'name', 'status']);
    for (const e of c.errors) assert.doesNotMatch(e, /\b\d+\s*(events?|rows?)\b|=\s*\d/);
  }
  // synthetic data has no 200 D bars → no Macro events: the tool must say so, by name only
  assert.deepEqual(status(rep), { Feeds: 'PASS', Aggregation: 'PASS', 'Event Engine': 'FAIL', Causality: 'FAIL' });
  assert.deepEqual(rep.checks[2].errors, ['no events generated: TC-H1 events, CE events']);   // ATR's leading na is not an error
  assert.ok(rep.checks[3].errors.every((e) => e.startsWith('vacuous:')), 'no truncation/perturbation difference');
});

test('SM2 a broken HTF bar or time axis fails its check', () => {
  assert.deepEqual([feedErrors(feedsOf()), aggregationErrors(feedsOf())], [[], []]);
  const f = feedsOf();
  f.H1[5] = { ...f.H1[5], h: f.H1[5].h + 1 };
  assert.match(aggregationErrors(f).join(), /^H1: differs from its M5 bars/);
  const g = feedsOf();
  [g.M5[10], g.M5[11]] = [g.M5[11], g.M5[10]];
  assert.deepEqual(feedErrors(g), ['M5: time not strictly increasing']);
});

test('SM3 ATR may be na only as a leading prefix', () => {
  const M5 = [0, 1, 2, 3].map((k) => ({ t: k * 300_000 }));
  const panel = (atr) => atr.map((a, i) => ({ t: M5[i].t, o: 1, h: 1, l: 1, c: 1, atr: a, atrEng: 1 }));
  const one = [{ t: 1 }];
  const r = (atr) => ({
    panel: panel(atr), tcH1: { rows: [], events: one }, h5: { events: [] }, ce: { rows: [], events: one, e3: [], e4: [], abstains: [] }, ceAny: { rows: [] },
    zone: { h3: one, flip1: one, flip1Unarmed: [], flip2: [], h4Comparator: [] }, p0: { events: [] }, p1: { events: [], p1Rejected: [] }, p2: { events: [] },
  });
  assert.deepEqual(engineErrors(r([NaN, NaN, 2, 3]), { M5 }), []);
  assert.deepEqual(engineErrors(r([NaN, 2, NaN, 3]), { M5 }), ['panel.atr: NaN/Infinity after its warm-up prefix']);
});
