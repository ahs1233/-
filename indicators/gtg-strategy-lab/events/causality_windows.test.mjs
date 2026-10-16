// Windowed Real Causality Gate: plan coverage, pre-roll on a weekly open, CG1–CG3 on synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars } from '../gtg-engine/reference/history.mjs';
import { windowPlan, windowFeeds, gateWindow } from './causality_windows.mjs';

const agg = (m1, s) => {
  const out = [];
  for (const b of m1) {
    const k = b.t - (b.t % (s * 1000)), x = out[out.length - 1];
    if (x && x.t === k) { x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; x.v += b.v; }
    else out.push({ t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
};

test('CW1 the plan covers the data from its first to its last bar without gaps', () => {
  const t0 = Date.UTC(2018, 2, 1), t1 = Date.UTC(2026, 8, 30, 13, 40);
  const p = windowPlan(t0, t1);
  assert.equal(p[0][0], t0);
  assert.equal(p.at(-1)[1], t1);
  for (let i = 1; i < p.length; i++) assert.ok(p[i][0] <= p[i - 1][1], `gap before window ${i}`);
  assert.equal(p.length, 8);
});

test('CW2 a window after the data start: pre-roll on a weekly open, every HTF bar whole, CG1–CG3 pass', () => {
  const m1 = marketBars(36000, 11).map((b, i) => ({ t: b.t, o: b.o * 20, h: b.h * 20, l: b.l * 20, c: b.c * 20, v: 50 + ((i * 7919) % 97) }));
  const feeds = { M5: agg(m1, 300), M15: agg(m1, 900), H1: agg(m1, 3600), H4: agg(m1, 14400), D: agg(m1, 86400), W: agg(m1, 604800) };
  const a = feeds.M5[Math.floor(feeds.M5.length * 0.55)].t, b = feeds.M5.at(-1).t + 300_000;
  const { p, build, m5 } = windowFeeds(feeds, a, b, 0.01);
  assert.ok(feeds.W.some((x) => x.t === p) && p < a, 'pre-roll starts on a weekly open before the measured part');
  const f = build(m5);
  // kept + rebuilt higher-timeframe bars equal the dataset's own bars over the window
  for (const tf of ['H1', 'H4', 'D']) {
    const own = feeds[tf].filter((x) => x.t < b).slice(-f[tf].length);
    assert.deepEqual(f[tf].map((x) => [x.t, x.o, x.h, x.l, x.c]), own.map((x) => [x.t, x.o, x.h, x.l, x.c]));
  }
  const r = gateWindow(feeds, a, b, { mintick: 0.01, w: 0.3 });
  assert.deepEqual([r.CG1, r.CG2, r.CG3], ['PASS', 'PASS', 'PASS']);
  assert.ok(r.errors.every((e) => e.startsWith('vacuous:')), JSON.stringify(r.errors));   // no Macro without 200 D bars
});
