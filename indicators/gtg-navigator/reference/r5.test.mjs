// E41 helper — R5 reload fingerprint (reference/diag.mjs; Pine section 18b "R5=" line).
// The fold is checked against a hand oracle, the text format round-trips, and the
// fingerprint of a fixed 40-bar window is identical across independent loads
// (long warm-up, short warm-up, reload later with a moved history window) and differs
// under three negative controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, withSymbol } from './engine.mjs';
import { hashInts, hashSlots, hashState, eventBits } from './snapshot.mjs';
import { r5Fingerprint, formatR5, parseR5, r5Verdict, formatDiagTable, parseDiagTable } from './diag.mjs';
import { marketBars, runLoad } from './history.mjs';

const P = withSymbol(DEFAULTS, { mintick: 0.01 });

test('R5.1 fold: counts, first/last warmed time, hash folds in bar order (hand oracle)', () => {
  const rows = [
    { time: 100, warmed: false, hashSlots: 9, hashState: 9, eventBits: 9 },
    { time: 160, warmed: true, hashSlots: 11, hashState: 21, eventBits: 0 },
    { time: 220, warmed: true, hashSlots: 12, hashState: 22, eventBits: 129 },
  ];
  assert.deepEqual(r5Fingerprint(rows), {
    n: 2, cold: 1, from: 160, to: 220,
    hSlots: hashInts([11, 12]), hState: hashInts([21, 22]), hEvents: hashInts([0, 129]),
  });
  // Order matters (a fold, not a set).
  assert.notEqual(r5Fingerprint([rows[2], rows[1]]).hSlots, r5Fingerprint(rows).hSlots);
  assert.deepEqual(r5Fingerprint([]), { n: 0, cold: 0, from: null, to: null, hSlots: 0, hState: 0, hEvents: 0 });
});

test('R5.2 text: round trip inside a GTGDIAG cell; R5=na; malformed refused', () => {
  const fp = { n: 40, cold: 0, from: 1790597700000, to: 1790600040000, hSlots: 123, hState: 2147483646, hEvents: 7 };
  const cell = `${formatDiagTable(1790600040000, { EVT: 1, MISMATCH: 0, CAUSAL: 1048576000, INV: 0 })}\n${formatR5(fp)}`;
  assert.deepEqual(parseR5(cell), fp);
  assert.equal(parseDiagTable(cell).EVT, 1); // the existing parser still reads the cell
  assert.equal(parseR5('GTGDIAG v1\nR5=na'), null);
  assert.throws(() => parseR5('R5=1,2,3'));
  assert.throws(() => parseR5('R5=1,0,2,3,4,5,6,7'));
  assert.throws(() => parseR5('GTGDIAG v1\nINV=0'));
});

// Rows of the capture window [fromIdx, toIdx] (market indices) of one load.
function windowRows(M, L, fromIdx, toIdx) {
  const rows = [];
  for (let i = fromIdx; i <= toIdx; i++) {
    const x = L.snaps.get(M[i].t);
    if (!x) continue; // engine not running on this bar: not a capture bar
    rows.push({ time: M[i].t, warmed: x.warmed, hashSlots: hashSlots(x.snap), hashState: hashState(x.snap), eventBits: eventBits(x.snap) });
  }
  return rows;
}

test('R5.3 independent loads agree on a fixed 40-bar window; three negative controls are rejected', (t) => {
  const M = marketBars(9500, 21);
  const [W0, W1] = [8900, 8939];
  const A = runLoad(M, P, { first: 1500, last: 8999, extra: 3000, htfBack: [0, 0] });        // long warm-up
  const B = runLoad(M, P, { first: 1500, last: 8999, extra: 300, htfBack: [5, 2] });         // short warm-up
  const C = runLoad(M, P, { first: 2400, last: 9450, extra: 3000, htfBack: [1, 7] });        // reload later, window moved
  const fps = [A, B, C].map((L) => r5Fingerprint(windowRows(M, L, W0, W1)));
  for (const fp of fps) { assert.equal(fp.n, 40); assert.equal(fp.cold, 0); assert.equal(fp.from, M[W0].t); assert.equal(fp.to, M[W1].t); }
  const v = r5Verdict(fps.map((fp) => parseR5(formatR5(fp))));
  assert.ok(v.pass, v.problems.join('; '));

  // NC1: engine started 100 bars before the window (inside W): cold bars → rejected.
  const cold = runLoad(M, P, { first: 1500, last: 8999, startAt: W0 - 100, keep: 'all' });
  const fpCold = r5Fingerprint(windowRows(M, cold, W0, W1));
  assert.ok(fpCold.cold > 0);
  assert.equal(r5Verdict([fps[0], fpCold]).pass, false);
  // NC2: history-dependent feed (HTF by array position): warmed but different state → rejected.
  const idx = runLoad(M, P, { first: 2777, last: 8999, extra: 3000, feed: 'index' });
  const fpIdx = r5Fingerprint(windowRows(M, idx, W0, W1));
  assert.equal(fpIdx.cold, 0);
  assert.equal(r5Verdict([fps[0], fpIdx]).pass, false);
  // NC3: one event bit different on one bar → hEvents differs → rejected.
  const rows = windowRows(M, A, W0, W1);
  rows[17] = { ...rows[17], eventBits: rows[17].eventBits ^ 1 };
  const fpEv = r5Fingerprint(rows);
  assert.equal(fpEv.hSlots, fps[0].hSlots);
  assert.notEqual(fpEv.hEvents, fps[0].hEvents);
  assert.equal(r5Verdict([fps[0], fpEv]).pass, false);
  t.diagnostic(`${formatR5(fps[0])}; NC1 cold=${fpCold.cold}; NC2 ${formatR5(fpIdx)}`);
});
