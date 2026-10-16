// ME — Measurement Engine end-to-end on synthetic XAU-like data (no feed needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars, htfBarsOf, loadInputs } from '../gtg-engine/reference/history.mjs';
import * as REF from '../gtg-engine/reference/engine.mjs';
import { runTimeframe, anchorFeedOf } from './measure.mjs';
import { computeSensors } from './sensors.mjs';
import { profileFor } from './profiles.mjs';

const MINTICK = 0.01;
const N = 5000;

function makeInputs(seed, n = N) {
  const m = marketBars(n, seed).map((b, i) => ({ ...b, v: 50 + ((i * 7919 + seed * 104729) % 97) }));
  const all = [m[0].t, m[m.length - 1].t];
  return {
    bars: m,
    htfBars: htfBarsOf(m, 900, ...all),   // M1 → route HTF M15
    a1Bars: htfBarsOf(m, 300, ...all),    // A1 = M5
    a2Bars: htfBarsOf(m, 900, ...all),    // A2 = M15
  };
}

const cache = new Map();
function run(seed, n = N) {
  const k = `${seed}:${n}`;
  if (!cache.has(k)) cache.set(k, runTimeframe({ tf: 'M1', mintick: MINTICK, ...makeInputs(seed, n) }));
  return cache.get(k);
}

test('ME1 zone events equal the reference Engine fed with the reference time feed', () => {
  const inp = makeInputs(5);
  const P = REF.withSymbol(REF.DEFAULTS, { mintick: MINTICK });
  const { chart, series, anchorFeed } = loadInputs(inp.bars, P, { first: 0, last: N - 1 });
  const ref = new REF.Engine(chart, series, P, { anchorFeed, a1Sec: 300, a2Sec: 900 });
  const lab = run(5).rows;
  let events = 0;
  for (let i = 0; i < N; i++) {
    const e = ref.step(i).events;
    for (const k of Object.keys(lab[i].events)) assert.equal(lab[i].events[k], e[k], `bar ${i} ${k}`);
    const slotsRef = ref.slots.map((s) => (s.active ? [s.lo, s.hi, s.gateQ, s.primaryKey] : null));
    const slotsLab = lab[i].slots.map((s) => (s.active ? [s.lo, s.hi, s.gateQ, s.primaryKey] : null));
    assert.deepEqual(slotsLab, slotsRef, `slots bar ${i}`);
    events += Object.values(e).filter((x) => x === true).length;
  }
  assert.ok(events > 50, `enough engine events to be meaningful (${events})`);
});

test('ME2 causality: a run on a prefix reproduces every row of the full run', () => {
  const full = run(9).rows;
  const cut = 3100;
  const inp = makeInputs(9);
  const lastT = inp.bars[cut - 1].t;
  const pre = runTimeframe({
    tf: 'M1', mintick: MINTICK, bars: inp.bars.slice(0, cut),
    htfBars: inp.htfBars.filter((b) => b.t <= lastT), a1Bars: inp.a1Bars.filter((b) => b.t <= lastT), a2Bars: inp.a2Bars.filter((b) => b.t <= lastT),
  }).rows;
  // A still-forming HTF bar is present in both runs, but only closed HTF bars (k−1) are
  // ever read, so every value must match exactly.
  for (let i = 0; i < cut; i++) assert.deepEqual(pre[i], full[i], `row ${i}`);
});

test('ME3 route HTF values come from the previous closed HTF bar only', () => {
  const inp = makeInputs(13);
  const S = computeSensors(inp.bars, inp.htfBars, profileFor('M1'), MINTICK);
  for (let i = 0; i < inp.bars.length; i += 37) {
    const k = S.htf[i].htfIndex;
    assert.ok(inp.htfBars[k].t <= inp.bars[i].t);
    if (k >= 1) assert.equal(S.htf[i].htfClose, inp.htfBars[k - 1].c);
    else assert.ok(Number.isNaN(S.htf[i].htfClose));
  }
});

test('ME4 sensor ranges, signs and hashes are well-formed', () => {
  const rows = run(21).rows;
  for (const r of rows) {
    assert.ok(r.routeScore >= -100 && r.routeScore <= 100 || Number.isNaN(r.routeScore));
    assert.ok(r.headingScore >= -100 && r.headingScore <= 100 || Number.isNaN(r.headingScore));
    assert.ok(r.speedScore >= 0 && r.speedScore <= 100, `speed ${r.speedScore}`);
    assert.ok(r.fuelScore >= 0 && r.fuelScore <= 100, `fuel ${r.fuelScore}`);
    assert.ok([-1, 0, 1].includes(r.headingSign) && [-1, 0, 1].includes(r.routeSign) && [-1, 0, 1].includes(r.tacticalSign));
    assert.ok(r.hashes && Number.isInteger(r.hashes.hashSlots) && Number.isInteger(r.hashes.hashState));
    assert.equal(r.hashes.eventBits % 128, r.consumer.engineEventBits);
  }
  const late = rows.slice(-1000);
  assert.ok(late.some((r) => r.headingSign === 1) && late.some((r) => r.headingSign === -1));
  assert.ok(late.every((r) => r.volumeAvailable));
});

test('ME5 every engine rejection is attributed to a displayed slot of the right side', () => {
  let n = 0;
  for (const seed of [5, 9, 21]) {
    for (const r of run(seed).rows) {
      for (const [flag, side, pre] of [['rejectR', -1, 'R'], ['rejectS', 1, 'S']]) {
        if (!r.events[flag]) continue;
        const recs = r.log.filter((x) => x.k === 'test' && x.rej >= 0.5 && x.inSlot && x.side === side);
        assert.ok(recs.length > 0, `${flag} at ${r.i} has a matching log record`);
        assert.ok(recs.some((x) => x.slotsBefore.length > 0), `${flag} at ${r.i}: source slot known`);
        n++;
        void pre;
      }
    }
  }
  assert.ok(n > 5, `rejections observed: ${n}`);
});

test('ME6 flip / failed-acceptance records carry direction and origin', () => {
  let flips = 0, fa = 0;
  for (const seed of [5, 9, 21]) {
    for (const r of run(seed).rows) {
      for (const x of r.log) {
        assert.ok(x.origin === 'R' || x.origin === 'S');
        if (x.k === 'flip') { flips++; assert.ok(x.dir === 1 || x.dir === -1); }
        if (x.k === 'failedAcceptance') fa++;
      }
      if (r.events.flipConfirmed) assert.ok(r.log.some((x) => x.k === 'flip' && x.armed));
    }
  }
  assert.ok(fa > 0, 'failed acceptances observed');
  void flips;
});

test('ME7 start bar: rows before startBar carry sensors but no engine state', () => {
  const inp = makeInputs(5, 1500);
  const res = runTimeframe({ tf: 'M1', mintick: MINTICK, ...inp, startBar: 700 });
  assert.ok(res.rows.slice(0, 700).every((r) => !r.engineOn && r.hashes === null && r.slots.every((s) => !s.active)));
  assert.ok(res.rows.slice(700).every((r) => r.engineOn));
  assert.ok(Number.isFinite(res.rows[699].headingScore));
  void anchorFeedOf;
});
