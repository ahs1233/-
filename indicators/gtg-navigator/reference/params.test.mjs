// Input contract: Q_stay ≤ Q_enter (review item R3).
// Q_enter admits a zone into a slot; Q_stay is the lower-or-equal hold threshold of
// the same hysteresis pair. With Q_stay > Q_enter a held zone fails its own hold test,
// loses its privilege and is re-admitted by Q_enter on the next bar (flicker).
// Contract: such inputs are refused with a clear message (Pine: runtime.error on the
// first bar); nothing is clamped silently.
// Run: node --test indicators/gtg-navigator/reference/params.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SRC, TF, TYP, makeLevel, memberKeyOf, selectSlots, emptySlot, Engine, computeSeries, syntheticBars, withSymbol } from './engine.mjs';

const T0 = 1_700_000_000_000;

// One fixed zone above price with gateQ = q, run through selectSlots for `bars` bars;
// returns R1.active per bar.
function r1Sequence(qEnter, qStay, q, bars = 6) {
  const P = { ...DEFAULTS, qEnter, qStay };
  const m = makeLevel({ key: memberKeyOf(T0, SRC.SWING, TF.LOCAL, TYP.HIGH), lo: 101, hi: 101.5, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: T0, s: q });
  m.q = q;
  let slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
  const seq = [];
  for (let b = 0; b < bars; b++) {
    const zone = { lo: 101, hi: 101.5, members: [m], primary: m, gateQ: q, displayQ: q, hasA1: false, hasA2: false };
    slots = selectSlots([zone], slots, { close: 100, atr: 1, atrA1: null, atrA2: null, ringC: [100] }, P).next;
    seq.push(slots[0].active);
  }
  return seq;
}

test('Q1 R3 fixture: qEnter=55, qStay=80, gateQ=70 is refused instead of flickering', () => {
  // Baseline behaviour was R1.active = true,false,true,false,true,false.
  assert.throws(() => r1Sequence(55, 80, 70), /Q_stay/);
  assert.throws(() => r1Sequence(55, 55.5, 70), /Q_stay/);
});

test('Q2 valid pairs never alternate: R1 is constant and equals (q ≥ Q_enter)', () => {
  // Independent oracle: with Q_stay ≤ Q_enter and a constant candidate, the zone enters on
  // the first bar iff q ≥ Q_enter, and then holds because q ≥ Q_enter ≥ Q_stay.
  for (const qEnter of [40, 55, 70, 100]) {
    for (const qStay of [qEnter, qEnter - 10, 0]) {
      for (let q = 0; q <= 100; q += 5) {
        const seq = r1Sequence(qEnter, qStay, q);
        const want = q >= qEnter;
        assert.ok(seq.every((x) => x === want), `qEnter=${qEnter} qStay=${qStay} q=${q}: ${seq.join(',')}`);
      }
    }
  }
});

test('Q3 boundary: qStay = qEnter and qStay < qEnter are accepted, defaults are valid', () => {
  assert.doesNotThrow(() => r1Sequence(55, 55, 60));
  assert.doesNotThrow(() => r1Sequence(55, 54.9, 60));
  assert.ok(DEFAULTS.qStay <= DEFAULTS.qEnter);
  assert.deepEqual(r1Sequence(DEFAULTS.qEnter, DEFAULTS.qStay, 70), [true, true, true, true, true, true]);
  assert.deepEqual(r1Sequence(DEFAULTS.qEnter, DEFAULTS.qStay, 50), [false, false, false, false, false, false]);
});

test('Q4 the engine refuses an inverted pair at construction, before any bar', () => {
  const P = withSymbol({ ...DEFAULTS, qEnter: 55, qStay: 80 }, { mintick: 0.01 });
  const bars = syntheticBars(10, 3);
  assert.throws(() => new Engine(bars, computeSeries(bars, P), P), /Q_stay/);
  const ok = withSymbol(DEFAULTS, { mintick: 0.01 });
  assert.doesNotThrow(() => new Engine(bars, computeSeries(bars, ok), ok));
});
