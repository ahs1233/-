// Equivalence levels, canonical snapshot and capture format (review item R1).
// Run: node --test indicators/gtg-navigator/reference/snapshot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, TYP, ST, computeSeries, Engine, syntheticBars, withSymbol } from './engine.mjs';
import { canonicalSnapshot, compareSnapshots, hashSlots, hashState, encodeSlots, hashInts } from './snapshot.mjs';
import { formatCapture, parseCapture } from './capture.mjs';

import { T0, MINTICK, key, baseSnap } from './fixtures.mjs';

// Baseline Pine slotDigest (pine:1741-1742 at cdf1a8a), kept only as a negative control.
function legacySlotDigest(slot) {
  if (!slot.active) return 0n;
  const M = 1000000007n;
  const lo = BigInt(Math.round(slot.lo / MINTICK));
  const hi = BigInt(Math.round(slot.hi / MINTICK));
  return (BigInt(slot.primaryKey) % M + (lo % M) * 7n + (hi % M) * 13n) % M;
}

const clone = (x) => structuredClone(x);
const paths = (diffs) => diffs.map((d) => `${d.path}:${d.kind}`);

test('S1 Astra collision: bounds [100,101] vs [100.13,100.93] with the same primary are detected', () => {
  const a = baseSnap();
  const b = clone(a);
  b.slots[0].lo = 100.13; b.slots[0].hi = 100.93;
  // Negative control: the baseline digest cannot tell them apart.
  assert.equal(legacySlotDigest(a.slots[0]), legacySlotDigest(b.slots[0]));
  const d = compareSnapshots(a, b, ['geometry']);
  assert.deepEqual(paths(d), ['slots.R1.lo:raw', 'slots.R1.lo:ticks', 'slots.R1.hi:raw', 'slots.R1.hi:ticks']);
  assert.notEqual(hashSlots(a), hashSlots(b));
});

test('S2 non-primary member key change: invisible to geometry, detected at identity', () => {
  const a = baseSnap();
  const b = clone(a);
  b.slots[0].lastKeys = [key(1), key(2), key(9)].sort((x, y) => x - y);
  assert.equal(legacySlotDigest(a.slots[0]), legacySlotDigest(b.slots[0])); // negative control
  assert.deepEqual(compareSnapshots(a, b, ['geometry']), []);
  assert.deepEqual(paths(compareSnapshots(a, b, ['identity'])), ['slots.R1.lastKeys:exact']);
  assert.notEqual(hashSlots(a), hashSlots(b));
});

test('S3 entry keys and quality changes are identity-level differences', () => {
  const a = baseSnap();
  const e = clone(a); e.slots[0].entryKeys = [key(2)];
  assert.deepEqual(paths(compareSnapshots(a, e, ['identity'])), ['slots.R1.entryKeys:exact']);
  const q = clone(a); q.slots[1].gateQ = 71;
  assert.equal(legacySlotDigest(a.slots[1]), legacySlotDigest(q.slots[1])); // negative control
  assert.deepEqual(paths(compareSnapshots(a, q, ['identity'])), ['slots.R2.gateQ:raw']);
  assert.notEqual(hashSlots(a), hashSlots(q));
});

test('S4 level state change with identical slots: only the state level detects it', () => {
  const a = baseSnap();
  const b = clone(a);
  b.levels[1].state = ST.BREAKING; b.levels[1].breakDir = 1; b.levels[1].breakCloses = 1;
  assert.deepEqual(compareSnapshots(a, b, ['identity']), []);
  assert.equal(hashSlots(a), hashSlots(b));
  assert.deepEqual(paths(compareSnapshots(a, b, ['state'])).sort(), [`levels.${key(2)}.breakCloses:exact`, `levels.${key(2)}.breakDir:exact`, `levels.${key(2)}.state:exact`].sort());
  assert.notEqual(hashState(a), hashState(b));
  const gone = clone(a); gone.levels.pop();
  assert.deepEqual(paths(compareSnapshots(a, gone, ['state'])), ['levels.length:exact', `levels.${key(4)}:missing`]);
});

test('S5 events are their own level', () => {
  const a = baseSnap();
  const b = clone(a); b.events.acceptedUp = true;
  assert.deepEqual(compareSnapshots(a, b, ['state']), []);
  assert.deepEqual(paths(compareSnapshots(a, b, ['events'])), ['events.acceptedUp:exact']);
});

test('S6 declared tolerance: float noise passes, sub-tick raw differences are reported, not rounded away', () => {
  const a = baseSnap();
  const noise = clone(a); noise.slots[0].lo = 100 + 1e-12;
  assert.deepEqual(compareSnapshots(a, noise, ['geometry']), []);
  const subTick = clone(a); subTick.slots[0].lo = 100.004; // 0.4 tick: same tick index, different raw price
  assert.deepEqual(paths(compareSnapshots(a, subTick, ['geometry'])), ['slots.R1.lo:raw']);
  const oneTick = clone(a); oneTick.slots[0].lo = 100.01;
  assert.deepEqual(paths(compareSnapshots(a, oneTick, ['geometry'])), ['slots.R1.lo:raw', 'slots.R1.lo:ticks']);
});

test('S7 canonical order: member key order in the slot does not change the snapshot', async () => {
  const { snapshotSlot } = await import('./snapshot.mjs');
  const s = { active: true, containing: false, side: 1, lo: 1, hi: 2, primaryKey: key(3), lastKeys: [key(3), key(1), key(2)], entryKeys: [key(2), key(3)], gateQ: 60, quality: 60 };
  const t = { ...s, lastKeys: [key(2), key(3), key(1)], entryKeys: [key(3), key(2)] };
  assert.deepEqual(snapshotSlot('R1', s), snapshotSlot('R1', t));
});

test('S8 snapshot is independent of the absolute bar index (history prepended before the engine start)', () => {
  const P = withSymbol(DEFAULTS, { mintick: MINTICK });
  const all = syntheticBars(4200, 5);
  const extra = 700;
  const short = all.slice(extra); // same bars, 700 fewer before them
  const startT = all[1500].t;
  const run = (bars) => {
    const eng = new Engine(bars, computeSeries(bars, P), P, { startBar: bars.findIndex((b) => b.t === startT) });
    const snaps = new Map();
    const absTest = new Map();
    bars.forEach((b, i) => {
      const r = eng.step(i);
      if (r) { snaps.set(b.t, canonicalSnapshot(eng, r, i, { symbol: 'SYN', timeframe: '1' })); absTest.set(b.t, eng.local[0]?.lastTestChartBar ?? null); }
    });
    return { snaps, absTest };
  };
  const L = run(all), S = run(short);
  let compared = 0, absDiffer = 0, withLevels = 0;
  for (const [t, a] of L.snaps) {
    const b = S.snaps.get(t);
    assert.ok(b, `missing snapshot at ${t}`);
    const d = compareSnapshots(a, b, ['state', 'events']);
    assert.deepEqual(d, [], `diff at ${t}: ${JSON.stringify(d.slice(0, 3))}`);
    assert.equal(hashState(a), hashState(b));
    compared++;
    if (a.levels.length) withLevels++;
    if (L.absTest.get(t) != null && L.absTest.get(t) !== S.absTest.get(t)) absDiffer++;
  }
  assert.ok(compared > 2000 && withLevels > compared * 0.9, `compared ${compared}, with levels ${withLevels}`);
  // Negative control: the absolute chart-bar fields do differ between the two runs.
  assert.ok(absDiffer > 0, 'absolute bar indices should differ by the prepended length');
});

test('S9 capture text round-trips and reports truncation', () => {
  const a = baseSnap();
  const text = formatCapture(a, 16);
  const parsed = parseCapture(text.split('\n').map((l) => `2023-11-14 22:13:20 ${l}`).join('\n')).get(T0);
  assert.ok(parsed.complete, parsed.problems.join('; '));
  assert.deepEqual(compareSnapshots(a, parsed.snapshot, ['state', 'events']), []);
  assert.equal(parsed.alertBits, 16);
  assert.equal(parsed.declared.hashSlots, hashSlots(a));
  assert.equal(parsed.declared.hashState, hashState(a));
  const cut = text.split('\n').filter((l) => !l.includes('|LVL|')).join('\n');
  const bad = parseCapture(cut).get(T0);
  assert.ok(!bad.complete && bad.problems.some((p) => p.includes('LVL')));
});

test('S10 hash encoding is pinned: regression guard for the Pine↔JS encoding contract (values taken from this implementation, not an oracle)', () => {
  const a = baseSnap();
  assert.deepEqual(encodeSlots(a).slice(0, 9), [1, 1, 0, 1, 10000, 10100, key(1), 6600, 6900]);
  assert.equal(hashSlots(a), 480443048);
  assert.equal(hashState(a), 38480016);
});

test('S11 hash arithmetic matches an independent implementation (Python int, vectors below)', () => {
  // h = fold(h·1000003 + mix(x)) mod (2^31 − 1), mix(x) = (r²·3 + r·131071 + 1) mod p, r = x mod p ≥ 0.
  // Expected values computed separately in Python with arbitrary-precision ints.
  assert.equal(hashInts([0]), 1);
  assert.equal(hashInts([1]), 131075);
  assert.equal(hashInts([1, 2, 3]), 1198590854);
  assert.equal(hashInts([-5]), 2146828368);
  assert.equal(hashInts([54400000000000]), 362018686);
});
