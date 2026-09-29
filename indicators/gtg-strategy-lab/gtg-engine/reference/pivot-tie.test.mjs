// E16 — pivot tie rule. TradingView measurement (validation/artifacts/tv-e16-pivot-tie-probe.txt,
// XAUUSD M1, 8256 bars, 118 high ties, 80 low ties): ta.pivothigh / ta.pivotlow use
// "centre >= every older neighbour and > every newer neighbour" (lows: <=, <); 0 mismatches.
// The reference must follow the same rule in computeSeries and in the HTF anchor feed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, computeSeries, withSymbol } from './engine.mjs';
import { htfFeedValues } from './history.mjs';

const P = withSymbol(DEFAULTS, { mintick: 0.01 });
const L = P.pivotLen; // 3
const mk = (hs, ls) => hs.map((h, i) => ({ t: i * 60_000, o: (h + ls[i]) / 2, h, l: ls[i], c: (h + ls[i]) / 2 }));

// Two equal highs at index 3 and 4; lows flat. Pine: the newer of the two (index 4) is the pivot.
const HI = [1, 2, 3, 5, 5, 4, 3, 2, 1, 1, 1];
// Two equal lows at index 3 and 4; highs flat. Pine: the newer of the two (index 4) is the pivot.
const LO = [9, 8, 7, 5, 5, 6, 7, 8, 9, 9, 9];

test('E16 chart pivots: an equal older neighbour is allowed, an equal newer one is not', () => {
  const h = computeSeries(mk(HI, HI.map((x) => x - 10)), P);
  assert.equal(h.swingPH[3 + L], null, 'index 3 ties with the newer bar 4: not a pivot');
  assert.equal(h.swingPH[4 + L], 5, 'index 4 ties with the older bar 3: pivot');
  const l = computeSeries(mk(LO.map((x) => x + 10), LO), P);
  assert.equal(l.swingPL[3 + L], null);
  assert.equal(l.swingPL[4 + L], 5);
});

test('E16 HTF anchor pivots follow the same rule', () => {
  const bars = mk(HI, HI.map((x) => x - 10));
  const v = htfFeedValues(bars, 1, L);
  const highs = v[v.length - 1].items.filter((x) => x.typ !== undefined && x.price === 5);
  assert.deepEqual(highs.map((x) => x.nb), [4]);
  const barsL = mk(LO.map((x) => x + 10), LO);
  const vl = htfFeedValues(barsL, 1, L);
  const lows = vl[vl.length - 1].items.filter((x) => x.price === 5);
  assert.deepEqual(lows.map((x) => x.nb), [4]);
});
