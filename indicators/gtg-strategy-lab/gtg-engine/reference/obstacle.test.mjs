// Strong Obstacle alert contract (review item R4-A). Oracle: the transition table of
// the contract (message 51), written case by case below; the baseline distance-crossing
// rule is kept as a negative control and must fail the cases it was blind to.
// Run: node --test indicators/gtg-navigator/reference/obstacle.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SRC, TF, TYP, makeLevel, memberKeyOf, buildZones, selectSlots, emptySlot, withSymbol } from './engine.mjs';
import { OBSTACLE_DEFAULTS as P, newObstacleLatch, strongObstacleStep, baselineStrongObstacle, sameObstacle } from './obstacle.mjs';

const A = [101, 102], B = [201, 202];
const o = (strength, distAtr, entryKeys = A, extra = {}) => ({ confirmed: true, available: true, strength, distAtr, entryKeys, ...extra });
const FAR = o(80, 1.5), WEAK_NEAR = o(60, 0.2), STRONG_NEAR = o(80, 0.2), NONE = { confirmed: true, available: false, strength: null, distAtr: null, entryKeys: [] };

// Runs the contract and the baseline over a sequence; returns the event bits of each.
function run(seq) {
  let latch = newObstacleLatch();
  let prevDist = null;
  const contract = [], baseline = [];
  for (const obs of seq) {
    const r = strongObstacleStep(latch, obs, P);
    contract.push(r.event);
    latch = r.latch;
    baseline.push(baselineStrongObstacle(prevDist, obs, P));
    if (obs.confirmed) prevDist = obs.available ? obs.distAtr : null;
  }
  return { contract, baseline };
}

test('O1 far → strong+near is an event (both rules)', () => {
  const r = run([FAR, STRONG_NEAR]);
  assert.deepEqual(r.contract, [false, true]);
  assert.deepEqual(r.baseline, [false, true]);
});

test('O2 weak+near → strong+near for the same obstacle is an event (baseline misses it: R4)', () => {
  const r = run([WEAK_NEAR, STRONG_NEAR]);
  assert.deepEqual(r.contract, [false, true]);
  assert.deepEqual(r.baseline, [false, false]); // negative control: the original defect
});

test('O3 strong+near A → strong+near B (different obstacle) is an event (baseline misses it)', () => {
  const r = run([STRONG_NEAR, o(85, 0.1, B)]);
  assert.deepEqual(r.contract, [true, true]);
  assert.deepEqual(r.baseline, [true, false]);
});

test('O4 strong+near A persisting: no repeat, whatever the distance or quality inside the state', () => {
  const r = run([STRONG_NEAR, o(90, 0.3), o(72, 0.05), o(75, 0.35), o(99, 0)]);
  assert.deepEqual(r.contract, [true, false, false, false, false]);
});

test('O5 exit then re-entry is a new event (by distance, by quality, by unavailability)', () => {
  assert.deepEqual(run([STRONG_NEAR, FAR, STRONG_NEAR]).contract, [true, false, true]);
  const q = run([STRONG_NEAR, WEAK_NEAR, STRONG_NEAR]);
  assert.deepEqual(q.contract, [true, false, true]);
  assert.deepEqual(q.baseline, [true, false, false]); // baseline misses the quality re-entry
  assert.deepEqual(run([STRONG_NEAR, NONE, STRONG_NEAR]).contract, [true, false, true]);
});

test('O6 intrabar: unconfirmed executions never fire and never move the latch', () => {
  const r = run([FAR, { ...STRONG_NEAR, confirmed: false }, { ...WEAK_NEAR, confirmed: false }, STRONG_NEAR]);
  assert.deepEqual(r.contract, [false, false, false, true]);
  const s = run([STRONG_NEAR, { ...FAR, confirmed: false }, STRONG_NEAR]);
  assert.deepEqual(s.contract, [true, false, false]); // intrabar exit is not an exit
});

test('O7 boundaries are inclusive: strength = strongQ and distance = nearObstacleAtr qualify', () => {
  assert.deepEqual(run([FAR, o(P.strongQ, P.nearObstacleAtr)]).contract, [false, true]);
  assert.deepEqual(run([FAR, o(P.strongQ - 1e-9, P.nearObstacleAtr)]).contract, [false, false]);
  assert.deepEqual(run([FAR, o(P.strongQ, P.nearObstacleAtr + 1e-9)]).contract, [false, false]);
});

// Engine fixtures: real zones through buildZones + selectSlots.
const T0 = 1_700_000_000_000;
const PM = withSymbol(DEFAULTS, { mintick: 0.01 });
const lv = (i, lo, hi, q) => { const l = makeLevel({ key: memberKeyOf(T0 + i * 60_000, SRC.SWING, TF.LOCAL, TYP.HIGH), lo, hi, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: T0 + i * 60_000, s: q }); l.q = q; return l; };

test('O8 primary churn inside one zone: primaryKey changes, entryKeys identity does not (token choice)', () => {
  const m1 = lv(1, 101.0, 101.3, 80), m2 = lv(2, 101.1, 101.4, 78);
  const ctx = { close: 100.9, atr: 1, atrA1: null, atrA2: null, ringC: [100.9] };
  let slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
  slots = selectSlots(buildZones([m1, m2], ctx, PM).zones, slots, ctx, PM).next;
  const bar1 = slots[0];
  m1.q = 74; // m1 decays below m2: same zone, same members, primary switches to m2
  slots = selectSlots(buildZones([m1, m2], ctx, PM).zones, slots, ctx, PM).next;
  const bar2 = slots[0];
  assert.equal(bar1.primaryKey, m1.key);
  assert.equal(bar2.primaryKey, m2.key);             // churn happens in the real engine
  assert.deepEqual(bar2.entryKeys.slice().sort(), bar1.entryKeys.slice().sort());
  assert.ok(bar1.quality >= P.strongQ && bar2.quality >= P.strongQ);
  const dist = (bar) => (bar.lo - ctx.close) / ctx.atr; // 0.1 ATR: near
  // Contract token (entryKeys): one event, no spam.
  const seq = [bar1, bar2].map((b) => o(b.quality, dist(b), b.entryKeys));
  assert.deepEqual(run(seq).contract, [true, false]);
  // A primaryKey token would fire again on pure churn (the reason it is not used).
  const pk = [bar1, bar2].map((b) => o(b.quality, dist(b), [b.primaryKey]));
  assert.deepEqual(run(pk).contract, [true, true]);
});

test('O9 label change only (R1 → S1) keeps the identity: no new event', () => {
  const m = lv(3, 101.0, 101.3, 85);
  const above = { close: 100.9, atr: 1, atrA1: null, atrA2: null, ringC: [100.9] };
  const below = { close: 101.4, atr: 1, atrA1: null, atrA2: null, ringC: [101.4, 100.9] };
  let slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
  slots = selectSlots(buildZones([m], above, PM).zones, slots, above, PM).next;
  const asR1 = slots[0];
  slots = selectSlots(buildZones([m], below, PM).zones, slots, below, PM).next;
  const asS1 = slots[2];
  assert.ok(asR1.active && asS1.active && !slots[0].active);
  assert.ok(sameObstacle(asR1.entryKeys, asS1.entryKeys));
  const seq = [o(asR1.quality, 0.1, asR1.entryKeys), o(asS1.quality, 0.1, asS1.entryKeys)];
  assert.deepEqual(run(seq).contract, [true, false]);
});
