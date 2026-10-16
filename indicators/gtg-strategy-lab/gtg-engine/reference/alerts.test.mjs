// The ten alert conditions (review item R4-C). Contract per alert: validation/ALERT_CONTRACT.md.
// Consumer conditions are verbatim transcriptions (consumers.mjs, pinned by C11); engine
// events are exercised through the reference state machine and selection.
// Run: node --test indicators/gtg-navigator/reference/alerts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SRC, TF, TYP, ST, makeLevel, memberKeyOf, buildZones, selectSlots, emptySlot, newEvents, updateLevel, withSymbol } from './engine.mjs';
import { speedBurstAlert, fuelSurge, headingUp, headingDown, noChaseEvent, engineAlerts } from './consumers.mjs';

// Runs an edge alert over a series of (confirmed, value) pairs; prev = last confirmed value.
function edges(fn, series) {
  let prev = series[0][1];
  return series.map(([confirmed, v], i) => {
    const fired = i > 0 && fn(confirmed, v, prev);
    if (confirmed) prev = v;
    return fired ? 1 : 0;
  });
}

test('A1 threshold-crossing alerts: cross fires once, persistence does not repeat, re-cross fires again', () => {
  const up = [[true, 60], [true, 91], [true, 95], [true, 80], [true, 92]];
  assert.deepEqual(edges(speedBurstAlert, up), [0, 1, 0, 0, 1]);
  assert.deepEqual(edges(fuelSurge, [[true, 50], [true, 70], [true, 88], [true, 60], [true, 75]]), [0, 1, 0, 0, 1]);
  assert.deepEqual(edges(headingUp, [[true, 10], [true, 21], [true, 40], [true, 20], [true, 25]]), [0, 1, 0, 0, 1]);
  assert.deepEqual(edges(headingDown, [[true, -10], [true, -21], [true, -40], [true, -20], [true, -25]]), [0, 1, 0, 0, 1]);
  // Boundaries as written in Pine: speed/fuel use >=, heading uses > / <.
  assert.deepEqual(edges(speedBurstAlert, [[true, 89.9], [true, 90]]), [0, 1]);
  assert.deepEqual(edges(headingUp, [[true, 0], [true, 20]]), [0, 0]);
});

test('A2 confirmed-close gating: intrabar crossings neither fire nor move the reference value', () => {
  assert.deepEqual(edges(speedBurstAlert, [[true, 60], [false, 95], [false, 70], [true, 93]]), [0, 0, 0, 1]);
  assert.deepEqual(edges(headingUp, [[true, 10], [false, 30], [true, 15]]), [0, 0, 0]);
  assert.equal(noChaseEvent(false, true, false), false);
});

test('A3 No Chase is a state-entry alert on the condition itself (obstacle-agnostic by contract)', () => {
  assert.deepEqual(edges(noChaseEvent, [[true, false], [true, true], [true, true], [true, false], [true, true]]), [0, 1, 0, 0, 1]);
});

test('A4 engine alerts are the OR of their up/down flags; Accepted/Flip follow the arm (lifecycle.test B1–B8)', () => {
  const e = newEvents();
  assert.deepEqual(engineAlerts(e), { obstacleBreak: false, obstacleReject: false, breakAccepted: false, flipConfirmed: false });
  assert.equal(engineAlerts({ ...e, breakingDn: true }).obstacleBreak, true);
  assert.equal(engineAlerts({ ...e, rejectS: true }).obstacleReject, true);
  assert.equal(engineAlerts({ ...e, acceptedUp: true, acceptedDn: true }).breakAccepted, true);
});

// Entry-member death: engine fixture through buildZones + selectSlots + updateLevel.
const T0 = 1_700_000_000_000;
const PM = withSymbol(DEFAULTS, { mintick: 0.01 });
const lv = (i, lo, hi, q) => { const l = makeLevel({ key: memberKeyOf(T0 + i * 60_000, SRC.SWING, TF.LOCAL, TYP.HIGH), lo, hi, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: T0 + i * 60_000, s: q, lastTestChartBar: 0 }); l.q = q; return l; };
const ctx = { close: 100.5, atr: 1, atrA1: null, atrA2: null, ringC: [100.5] };
const shownKeys = (slots) => slots.filter((s) => s.active).flatMap((s) => s.lastKeys);
function breakOf(level, slots) {
  const ev = newEvents();
  updateLevel(level, { o: 101.2, h: 101.8, l: 101.1, c: 101.7 }, 101.2, 1, 10, ev, shownKeys(slots).includes(level.key), PM); // close 101.7 > hi + 0.1·ATR, body 0.5 < 0.8·ATR
  return ev;
}

test('A5 entry-member death: the surviving member keeps its events while its zone stays displayed', () => {
  const entry = lv(1, 101.0, 101.3, 80), other = lv(2, 101.1, 101.4, 70);
  let slots = selectSlots(buildZones([entry, other], ctx, PM).zones, [emptySlot(), emptySlot(), emptySlot(), emptySlot()], ctx, PM).next;
  // The entry member dies; the survivor alone still passes Q_enter (70 ≥ 55): zone re-entered.
  slots = selectSlots(buildZones([other], ctx, PM).zones, slots, ctx, PM).next;
  assert.ok(slots[0].active);
  assert.deepEqual(slots[0].lastKeys, [other.key]);
  const ev = breakOf(other, slots);
  assert.ok(ev.breakingUp);
  assert.equal(other.navArmed, true);
});

test('A6 entry-member death with a survivor below Q_enter: the zone loses its slot, so its break is not displayed', () => {
  const entry = lv(1, 101.0, 101.3, 80), other = lv(2, 101.1, 101.4, 50);
  let slots = selectSlots(buildZones([entry, other], ctx, PM).zones, [emptySlot(), emptySlot(), emptySlot(), emptySlot()], ctx, PM).next;
  assert.deepEqual(slots[0].entryKeys.slice().sort(), [entry.key, other.key].sort());
  // Entry member dies; privilege continues through the survivor's own entry key (50 ≥ Q_stay 45).
  slots = selectSlots(buildZones([other], ctx, PM).zones, slots, ctx, PM).next;
  assert.ok(slots[0].active, 'privilege via the surviving entry key keeps the zone');
  // Now a survivor that was never an entry key: the zone falls under Q_enter and leaves the slots.
  const fresh = lv(3, 101.1, 101.4, 50);
  slots = selectSlots(buildZones([fresh], ctx, PM).zones, [emptySlot(), emptySlot(), emptySlot(), emptySlot()], ctx, PM).next;
  assert.equal(slots[0].active, false);
  const ev = breakOf(fresh, slots);
  assert.equal(ev.breakingUp, false);          // not displayed: no Breaking alert (unchanged rule)
  assert.equal(fresh.navArmed, false);         // and no Accepted/Flip later (R4-B)
  assert.equal(fresh.state, ST.BREAKING);      // the level itself still follows its lifecycle
});
