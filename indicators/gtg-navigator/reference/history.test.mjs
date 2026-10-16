// R5 — reload determinism from independent histories (review item R5).
// Each load rebuilds series, HTF feeds and the engine start from its own data
// (reference/history.mjs); nothing is shared between the runs being compared.
// Equality is checked on the full canonical snapshot (levels 'state' + 'events') at
// every shared timestamp where both runs are warmed (index ≥ start + W).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, withSymbol, engineWindowFor } from './engine.mjs';
import { compareSnapshots } from './snapshot.mjs';
import { formatCapture } from './capture.mjs';
import { MIN_MS, marketBars, sessionOpen, htfBarsOf, timeFeed, loadInputs, runLoad } from './history.mjs';

const P = withSymbol(DEFAULTS, { mintick: 0.01 });
const W = engineWindowFor(P, 60, 300, 900);
const N = 9000;
const LAST = N - 1;
const EXTRA = 3000;
const LEVELS = ['state', 'events'];

const markets = new Map();
const market = (seed) => { if (!markets.has(seed)) markets.set(seed, marketBars(N, seed)); return markets.get(seed); };

// Compares two loads on their shared timestamps. onlyWarmed = false also compares bars
// where one side is still inside its warm-up (negative control).
function compareLoads(A, B, { onlyWarmed = true } = {}) {
  let shared = 0, mismatched = 0, lastMismatchTime = null;
  const paths = new Map();
  for (const [t, a] of A.snaps) {
    const b = B.snaps.get(t);
    if (!b) continue;
    if (onlyWarmed && !(a.warmed && b.warmed)) continue;
    shared++;
    const d = compareSnapshots(a.snap, b.snap, LEVELS);
    if (d.length) {
      mismatched++;
      lastMismatchTime = t;
      for (const x of d) { const k = x.path.split('.').slice(0, 2).join('.').replace(/\d{10,}/, 'K'); paths.set(k, (paths.get(k) ?? 0) + 1); }
    }
  }
  return { shared, mismatched, lastMismatchTime, paths: [...paths].sort((x, y) => y[1] - x[1]).slice(0, 6) };
}

test('H0 HTF feed from time buckets: gaps, bucket-start times, previous closed bar (lookahead_on + [1])', (t) => {
  const T = Date.UTC(2024, 0, 2, 0, 0); // Tuesday 00:00 UTC
  const mins = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 23, 24, 25];
  const m = mins.map((k, i) => ({ t: T + k * MIN_MS, o: 100 + i, h: 101 + i, l: 99 + i, c: 100.5 + i }));
  const htf = htfBarsOf(m, 300, m[0].t, m[m.length - 1].t);
  assert.deepEqual(htf.map((b) => (b.t - T) / MIN_MS), [0, 5, 10, 20, 25]); // no bar for the empty 00:15 bucket
  assert.equal(htf[2].h, 101 + 12); assert.equal(htf[2].c, 100.5 + 12); // 00:10 bucket = bars 00:10–00:12
  const f = timeFeed(m, htf, 300, 1);
  const at = (minute) => f(mins.indexOf(minute)).now;
  assert.equal(at(3), null);  // inside the first HTF bar: nothing closed yet
  assert.equal(at(7), 0);     // inside 00:05 → 00:00 bar
  assert.equal(at(12), 1);    // inside 00:10 → 00:05 bar
  assert.equal(at(20), 2);    // after the gap: previous *existing* HTF bar (00:10), not the empty 00:15
  const la = timeFeed(m, htf, 300, 1, { lookahead: true });
  assert.equal(la(mins.indexOf(20)).now, 3); // the defect reads the forming bar
});

test('H0b the market has session gaps (daily break and weekend)', (t) => {
  const M = market(21);
  let daily = 0, weekend = 0;
  for (let i = 1; i < M.length; i++) {
    const gap = M[i].t - M[i - 1].t;
    if (gap === 61 * MIN_MS) daily++;
    else if (gap > 24 * 60 * MIN_MS) weekend++;
    else assert.equal(gap, MIN_MS);
    assert.ok(sessionOpen(M[i].t));
  }
  assert.ok(daily >= 3 && weekend >= 1, `daily ${daily}, weekend ${weekend}`);
});

test('H1 causality: series and anchor feeds at bar i are the same when built from the prefix ending at i', (t) => {
  const M = market(21);
  const first = 1234;
  const full = loadInputs(M, P, { first, last: LAST, htfBack: [4, 9] });
  const fullLA = loadInputs(M, P, { first, last: LAST, htfBack: [4, 9], feed: 'lookahead' });
  let checked = 0, laDiff = 0;
  for (let i = 40; i < LAST - first; i += 157) {
    const pre = loadInputs(M, P, { first, last: first + i, htfBack: [4, 9] });
    assert.equal(pre.series.atrEng[i], full.series.atrEng[i], `atrEng @${i}`);
    assert.equal(pre.series.swingPH[i], full.series.swingPH[i], `swingPH @${i}`);
    assert.equal(pre.series.swingPL[i], full.series.swingPL[i], `swingPL @${i}`);
    assert.deepEqual(pre.anchorFeed(i), full.anchorFeed(i), `anchorFeed @${i}`);
    checked++;
    // Negative control: the lookahead defect sees the forming HTF bar, which the prefix
    // has only partially.
    const preLA = loadInputs(M, P, { first, last: first + i, htfBack: [4, 9], feed: 'lookahead' });
    if (JSON.stringify(preLA.anchorFeed(i)) !== JSON.stringify(fullLA.anchorFeed(i))) laDiff++;
  }
  assert.ok(checked >= 45, `checked ${checked}`);
  assert.ok(laDiff > 0, 'negative control: a lookahead feed must break causality');
  t.diagnostic(`prefix points ${checked}; lookahead control differs at ${laDiff}`);
});

for (const seed of [21, 7]) {
  test(`H2 seed ${seed}: shorter history, longer history (prepend) and HTF history start do not change warmed bars`, (t) => {
    const M = market(seed);
    const base = runLoad(M, P, { first: 1500, last: LAST, extra: EXTRA, htfBack: [0, 0] });
    const shorter = runLoad(M, P, { first: 2777, last: LAST, extra: EXTRA, htfBack: [7, 3] }); // drop not a multiple of 5 or 15
    const longer = runLoad(M, P, { first: 0, last: LAST, extra: EXTRA, htfBack: [13, 2] });   // 1500 bars prepended
    for (const [name, X] of [['shorter', shorter], ['longer', longer]]) {
      const r = compareLoads(base, X);
      assert.equal(r.shared, EXTRA + 1, `${name}: shared warmed bars`);
      assert.equal(r.mismatched, 0, `${name}: ${JSON.stringify(r.paths)}`);
    }
    for (const X of [base, shorter, longer]) assert.deepEqual(X.violations, []);
    // Sanity: the compared bars exercise slots, anchors and events.
    let withSlot = 0, withAnchor = 0, withEvent = 0;
    for (const { snap } of base.snaps.values()) {
      if (snap.slots.some((s) => s.active)) withSlot++;
      if (snap.levels.some((l) => l.tfRank > 0)) withAnchor++;
      if (Object.values(snap.events).some(Boolean)) withEvent++;
    }
    assert.ok(withSlot > EXTRA * 0.5 && withAnchor > EXTRA * 0.5 && withEvent > 50, `slot ${withSlot} anchor ${withAnchor} event ${withEvent}`);
    t.diagnostic(`W=${W} shared=${EXTRA + 1} slot=${withSlot} anchor=${withAnchor} event=${withEvent}`);
  });
}

test('H2-NC negative control: HTF bars built by array position depend on where the load starts', (t) => {
  const M = market(21);
  const a = runLoad(M, P, { first: 1500, last: LAST, extra: EXTRA, feed: 'index' });
  const b = runLoad(M, P, { first: 2777, last: LAST, extra: EXTRA, feed: 'index' });
  const r = compareLoads(a, b);
  assert.equal(r.shared, EXTRA + 1);
  assert.ok(r.mismatched > 0, 'the comparison must detect a history-dependent feed');
  t.diagnostic(`index feed: ${r.mismatched}/${r.shared} warmed bars differ; ${JSON.stringify(r.paths)}`);
});

test('H3 studyExtraBars: 0, 700 and 3000 agree on every bar they all have warmed', (t) => {
  const M = market(21);
  const runs = [0, 700, EXTRA].map((extra) => runLoad(M, P, { first: 1500, last: LAST, extra, htfBack: [3, 5] }));
  assert.equal(runs[0].snaps.size, 1); // extra = 0: only the last bar is warmed
  assert.equal(runs[1].snaps.size, 701);
  for (let k = 0; k < runs.length; k++) for (let m = k + 1; m < runs.length; m++) {
    const r = compareLoads(runs[k], runs[m]);
    assert.equal(r.shared, Math.min(runs[k].snaps.size, runs[m].snaps.size));
    assert.equal(r.mismatched, 0, JSON.stringify(r.paths));
  }
});

test('H4 reload later: a live continuation and a fresh reload with a moved history window agree', (t) => {
  const M = market(21);
  const opened = runLoad(M, P, { first: 0, last: 6000, extra: EXTRA }); // chart opened at bar 6000
  // Live: the engine start was fixed when the chart opened and it kept running to LAST.
  const live = runLoad(M, P, { first: 0, last: LAST, startAt: opened.start });
  // Reload at LAST with the history window moved forward (bar-count limit).
  const reload = runLoad(M, P, { first: 2000, last: LAST, extra: EXTRA, htfBack: [6, 1] });
  const r = compareLoads(live, reload);
  assert.equal(r.shared, EXTRA + 1);
  assert.equal(r.mismatched, 0, JSON.stringify(r.paths));
  // The live run also reproduces what the chart showed when it opened (nothing repaints).
  const past = compareLoads(opened, live);
  assert.equal(past.shared, EXTRA + 1);
  assert.equal(past.mismatched, 0, JSON.stringify(past.paths));
});

test('H5 replay: rebuilding the same load from scratch gives byte-identical GTGSNAP captures', (t) => {
  const text = () => {
    const M = marketBars(N, 7); // fresh market, fresh inputs, fresh engine
    const L = runLoad(M, P, { first: 1500, last: LAST, extra: 700, htfBack: [2, 2] });
    return [...L.snaps.values()].map(({ snap }) => formatCapture(snap)).join('\n');
  };
  const a = text(), b = text();
  assert.ok(a.length > 100_000);
  assert.equal(a, b);
});

test('H6 warm-up is real and W covers it: differences inside the window, none after it', (t) => {
  const M = market(21);
  const early = runLoad(M, P, { first: 0, last: LAST, extra: 5000 });
  const late = runLoad(M, P, { first: 0, last: LAST, extra: 1000, keep: 'all' }); // starts 4000 bars later
  const inside = compareLoads(early, late, { onlyWarmed: false });
  const lateStartT = M[late.start].t;
  assert.ok(inside.mismatched > 0, 'expected differences right after a late start');
  const lagBars = M.findIndex((b) => b.t === inside.lastMismatchTime) - late.start;
  assert.ok(lagBars < W, `last difference ${lagBars} bars after the late start (W = ${W})`);
  const after = compareLoads(early, late);
  assert.equal(after.shared, 1001);
  assert.equal(after.mismatched, 0);
  t.diagnostic(`late start ${new Date(lateStartT).toISOString()}: ${inside.mismatched} of ${inside.shared} bars differ; last difference at +${lagBars} bars (W=${W})`);
});
