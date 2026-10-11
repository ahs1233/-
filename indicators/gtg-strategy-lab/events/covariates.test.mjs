// CV — every CEM covariate is measured at t−1 or earlier, except those the contract names
// (COVARIATE_TIMING). Method: for sampled rows of every hypothesis, poison everything observed at
// bar t (OHLC, ATR, ATR_eng, scores, signs, slots, engine events) and require identical covariates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars } from '../gtg-engine/reference/history.mjs';
import { runEventPipeline } from './pipeline.mjs';
import { extractTC, extractH5 } from './tc.mjs';
import { extractCE } from './ce.mjs';
import { extractZoneEvents } from './zone.mjs';
import { atrRank, covariatesOf, withClusters, COVARIATE_TIMING } from './covariates.mjs';
import { STRATA } from '../stats/cem.mjs';

const agg = (m1, sec) => {
  const out = [];
  for (const b of m1) {
    const t = Math.floor(b.t / (sec * 1000)) * sec * 1000, last = out[out.length - 1];
    if (last && last.t === t) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; last.v += b.v; }
    else out.push({ t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
};
const m1 = marketBars(30_000, 17).map((b, i) => ({ t: b.t, o: b.o * 20, h: b.h * 20, l: b.l * 20, c: b.c * 20, v: 40 + ((i * 7919) % 89) }));
const feeds = { M5: agg(m1, 300), M15: agg(m1, 900), H1: agg(m1, 3600), H4: agg(m1, 14400), D: agg(m1, 86400), W: agg(m1, 604800) };
const R = runEventPipeline(feeds, { mintick: 0.01, w: 0.3 });

const JUNK = 987654.321;
function poisonAt(panel, t) {
  const p = panel[t];
  const q = { ...p, o: JUNK, h: JUNK, l: -JUNK, c: JUNK, atr: JUNK, atrEng: JUNK, headingSign: 1, headingScore: 99, routeSign: -1, events: {}, consumer: {},
    slots: p.slots.map((z) => ({ ...z, lo: -JUNK, hi: JUNK, entryKeys: [-1], primaryKey: -1 })) };
  const out = panel.slice(); out[t] = q; return out;
}
const sample = (rows, n = 60) => rows.filter((_, k) => k % Math.max(1, Math.floor(rows.length / n)) === 0).slice(0, n);
const edges = { levelAgeEdges: [5, 20, 60], widthEdges: [0.2, 0.5] };

test('CV0 the registry covers every stratum component of H1–H5', () => {
  for (const h of Object.keys(STRATA)) for (const k of STRATA[h]) assert.ok(k in COVARIATE_TIMING, `${h}: ${k} has no timing entry`);
});

test('CV1 poisoning bar t leaves every CEM covariate unchanged (H1, H2, H3, H4, H5)', () => {
  const rank = atrRank(R.panel);
  const families = {
    H1: withClusters(extractTC(R.panel, { macro: 'none' }).rows, R.panel),      // TC code path (the Macro needs 200 D bars)
    H5: withClusters(extractH5(R.panel).events, R.panel),
    H2: withClusters(extractCE(R.panel, { macro: () => true }).rows, R.panel),
    H3: R.zone.h3,
    H4: [...R.zone.flip1, ...R.zone.flip1Unarmed, ...R.zone.h4Comparator],
  };
  for (const [h, rows] of Object.entries(families)) {
    const picked = sample(rows.filter((r) => r.t > 1));
    assert.ok(picked.length >= 5, `${h}: only ${picked.length} rows to test`);
    for (const row of picked) {
      const bad = poisonAt(R.panel, row.t);
      let row2 = row;
      if (h === 'H3' || h === 'H4') {   // the extractor's own row fields (width, levelAge, Q) must not read bar t either
        const z = extractZoneEvents(bad);
        const all = [...z.h3, ...z.flip1, ...z.flip1Unarmed, ...z.h4Comparator];
        row2 = all.find((x) => x.t === row.t && x.family === row.family && x.slot === row.slot && x.D === row.D);
        assert.ok(row2, `${h}: row at ${row.t} vanished`);
        assert.deepEqual([row2.width, row2.levelAge, row2.q0], [row.width, row.levelAge, row.q0], `${h} row fields at ${row.t}`);
      }
      assert.deepEqual(covariatesOf(h, row2, bad, atrRank(bad), edges), covariatesOf(h, row, R.panel, rank, edges), `${h} covariates at ${row.t}`);
    }
  }
});

test('CV2 negative control: a covariate read at bar t is caught', () => {
  const row = R.h5.events.find((e) => e.t > 600);
  const leaky = (panel) => panel[row.t].atr;                                   // "volatility at t"
  assert.notEqual(leaky(poisonAt(R.panel, row.t)), leaky(R.panel));
});
