// I13 identity continuity (review message 53). The Strong Obstacle identity uses entry-key
// intersection, which is only safe over time because selection guarantees:
//   a held slot (Q_stay privilege) has next.entryKeys = prev.entryKeys ∩ currentMembers
//   (it only shrinks, never gains a key); when the intersection is empty the privilege
//   ends, and a zone that re-enters through Q_enter takes all its current keys as a fresh
//   identity. An active slot never has empty entry keys.
// These tests pin that property; selection itself is not changed.
// Run: node --test indicators/gtg-navigator/reference/identity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SRC, TF, TYP, makeLevel, memberKeyOf, buildZones, selectSlots, emptySlot, withSymbol, Engine, computeSeries, syntheticBars } from './engine.mjs';
import { OBSTACLE_DEFAULTS as OP, newObstacleLatch, strongObstacleStep } from './obstacle.mjs';

const T0 = 1_700_000_000_000;
const PM = withSymbol(DEFAULTS, { mintick: 0.01 });
const lv = (i, lo, hi, q) => { const l = makeLevel({ key: memberKeyOf(T0 + i * 60_000, SRC.SWING, TF.LOCAL, TYP.HIGH), lo, hi, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: T0 + i * 60_000, s: q }); l.q = q; return l; };
const ctx = { close: 100.9, atr: 1, atrA1: null, atrA2: null, ringC: [100.9] };
const empty4 = () => [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
const step = (levels, slots) => selectSlots(buildZones(levels, ctx, PM).zones, slots, ctx, PM).next;
const set = (keys) => [...keys].sort((a, b) => a - b);

test('I13.1–I13.3 entry keys shrink while held, restart fresh after the intersection breaks; Strong Obstacle follows', () => {
  const A = lv(1, 101.0, 101.3, 80), B = lv(2, 101.05, 101.35, 78), C = lv(3, 101.1, 101.4, 76), D = lv(4, 101.15, 101.45, 74);
  const s1 = step([A, B], empty4());
  assert.deepEqual(set(s1[0].entryKeys), set([A.key, B.key]));
  // A dies, C appears in the same zone: held through B → entry [B] only, never [B, C].
  const s2 = step([B, C], s1);
  assert.deepEqual(s2[0].entryKeys, [B.key]);
  assert.deepEqual(set(s2[0].lastKeys), set([B.key, C.key]));
  // B dies, D appears: no entry key survives → no privilege; the zone passes Q_enter → fresh [C, D].
  const s3 = step([C, D], s2);
  assert.ok(s3[0].active);
  assert.deepEqual(set(s3[0].entryKeys), set([C.key, D.key]));
  // Strong Obstacle over the same three bars (strong + near throughout): continuation, then a new obstacle.
  let latch = newObstacleLatch();
  const events = [s1, s2, s3].map((s) => {
    const r = strongObstacleStep(latch, { confirmed: true, available: true, strength: s[0].quality, distAtr: (s[0].lo - ctx.close) / ctx.atr, entryKeys: s[0].entryKeys }, OP);
    latch = r.latch;
    return r.event ? 1 : 0;
  });
  assert.deepEqual(events, [1, 0, 1]);
});

test('I13.2b broken intersection below Q_enter: the zone is dropped, not held', () => {
  // C, D: gateQ = 44 + confluence 6 (two event groups) = 50, between Q_stay 45 and Q_enter 55.
  const A = lv(1, 101.0, 101.3, 80), B = lv(2, 101.05, 101.35, 78), C = lv(3, 101.1, 101.4, 44), D = lv(4, 101.15, 101.45, 42);
  const s2 = step([B, C], step([A, B], empty4()));
  assert.deepEqual(s2[0].entryKeys, [B.key]);
  const z = buildZones([C, D], ctx, PM).zones;
  assert.ok(z.length === 1 && z[0].gateQ >= PM.qStay && z[0].gateQ < PM.qEnter, `gateQ ${z[0]?.gateQ}`);
  const s3 = step([C, D], s2); // no surviving entry key → no privilege → Q_enter applies
  assert.equal(s3[0].active, false);
});

test('I13.5 merge: two held slots merging into one zone keep one slot identity and gain no key', () => {
  const a1 = lv(1, 101.0, 101.2, 80), b1 = lv(2, 101.7, 101.9, 70);
  const s1 = step([a1, b1], empty4());
  assert.deepEqual(s1[0].entryKeys, [a1.key]);
  assert.deepEqual(s1[1].entryKeys, [b1.key]);
  a1.hi = 101.5; // gap 0.2 ≤ mergeGap: one component, width 0.9 ≤ maxWidth → one zone {a1, b1}
  const s2 = step([a1, b1], s1);
  assert.ok(s2[0].active && !s2[1].active);
  assert.deepEqual(set(s2[0].lastKeys), set([a1.key, b1.key]));
  assert.deepEqual(s2[0].entryKeys, [a1.key]); // privilege from R1 (first slot with a hit); b1 not added
});

test('I13.5b split and primary churn: each part keeps a subset of the held identity', () => {
  const a1 = lv(1, 101.0, 101.3, 80), a2 = lv(2, 101.2, 101.6, 78);
  const s1 = step([a1, a2], empty4());
  assert.deepEqual(set(s1[0].entryKeys), set([a1.key, a2.key]));
  a1.q = 70; // primary churn inside the zone
  const s2 = step([a1, a2], s1);
  assert.equal(s2[0].primaryKey, a2.key);
  assert.deepEqual(set(s2[0].entryKeys), set([a1.key, a2.key]));
  a2.lo = 101.8; a2.hi = 102.1; // split: gap 0.5 > mergeGap → two zones
  const s3 = step([a1, a2], s2);
  const held = s3.filter((s) => s.active);
  assert.equal(held.length, 2);
  for (const s of held) {
    assert.equal(s.entryKeys.length, 1);
    assert.ok(s1[0].entryKeys.includes(s.entryKeys[0]));
  }
});

test('I13.4 property over engine runs: non-empty entry keys, ⊆ lastKeys, and either shrink-only or fresh', () => {
  let checked = 0;
  for (const seed of [21, 7, 5]) {
    const bars = syntheticBars(4000, seed);
    const eng = new Engine(bars, computeSeries(bars, PM), PM, {});
    let prev = eng.slots;
    for (let i = 0; i < bars.length; i++) {
      eng.step(i);
      const prevEntries = prev.filter((s) => s.active).map((s) => s.entryKeys);
      const prevAll = new Set(prevEntries.flat());
      for (const s of eng.slots) {
        if (!s.active) continue;
        checked++;
        assert.ok(s.entryKeys.length > 0, `empty entry keys at bar ${i} (seed ${seed})`);
        assert.ok(s.entryKeys.every((k) => s.lastKeys.includes(k)), `entry ⊄ last at bar ${i}`);
        const held = s.entryKeys.some((k) => prevAll.has(k));
        if (held) assert.ok(prevEntries.some((e) => s.entryKeys.every((k) => e.includes(k))), `held slot gained a key at bar ${i} (seed ${seed})`);
        else assert.ok(s.entryKeys.every((k) => !prevAll.has(k)), `fresh entry reused a key at bar ${i}`);
      }
      prev = eng.slots;
    }
  }
  assert.ok(checked > 10000, `slot-bars checked: ${checked}`);
});
