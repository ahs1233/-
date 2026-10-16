// node --test indicators/lastgtg/review_1_1/js/bc.test.mjs
// Gate 2 of ../TEST_PREREGISTRATION.md: the JS B/C lamp equals the Pine fragment on every case,
// the JS C engine passes Astra's break cases, and C is generated from the live engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gtgLampDecision, lampOfBC, EpisodeTracker } from './lamp-bc.mjs';
import { lampOf } from '../../live/lamp.mjs';
import * as A from '../../live/zone-engine.mjs';
import * as C from './zone-engine-c.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('JS lamp = Pine fragment (handoff translation) on all 147,456 cases, lamp and reason', () => {
  const pine = execFileSync('python3', ['-I', join(here, 'dump_pine_lamp.py')], { encoding: 'utf8', maxBuffer: 64 << 20 }).trimEnd().split('\n');
  const variable = ['ready', 'chase', 'inside', 'accUp', 'accDn', 'breaking', 'rejR', 'rejS', 'nearTouch', 'aware', 'exhausted', 'lowFuel', 'mapped', 'room'];
  let k = 0;
  for (let m = 0; m < 1 << variable.length; m++) {
    const d = {};
    variable.forEach((n, j) => { d[n] = ((m >> (variable.length - 1 - j)) & 1) === 1; }); // itertools.product order
    for (const h of [-1, 0, 1]) for (const r of [-1, 0, 1]) {
      const [lamp, reason] = gtgLampDecision(d.ready, d.chase, d.inside, h, r, d.accUp, d.accDn, d.breaking, d.rejR, d.rejS, d.nearTouch, d.aware, d.exhausted, d.lowFuel, d.mapped, d.room);
      assert.equal(`${lamp},${reason}`, pine[k], `case ${k}`);
      k++;
    }
  }
  assert.equal(k, 147456);
  assert.equal(pine.length, 147456);
});

// --- lampOfBC on rows (same row shape as live/lamp.test.mjs) ---
const off = { active: false };
const zone = (lo, hi, q = 80, containing = false) => ({ active: true, lo, hi, displayQ: q, containing });
const noEv = { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, rejectR: false, rejectS: false, flipConfirmed: false };
const row = (over = {}) => ({
  engineOn: true, c: 100, h: 100.5, l: 99.5, atrEng: 1, htfATR: 3,
  headingScore: 50, routeScore: 50, headingSign: 1, routeSign: 1,
  speedScore: 50, instantSpeedScore: 50, fuelScore: 50, fuelAcceleration: 0,
  slots: [zone(110, 111), zone(120, 121), zone(90, 91), zone(80, 81)], events: noEv, ...over,
});

test('B: aligned with measured room is green 50', () => {
  const p = lampOfBC(row());
  assert.deepEqual([p.lamp, p.reason], [2, 50]);
  assert.equal(p.room, 10);
});

test('B: no zone ahead is yellow 44, where A is green', () => {
  const r = row({ slots: [off, off, zone(90, 91), off] });
  assert.deepEqual([lampOfBC(r).lamp, lampOfBC(r).reason], [1, 44]);
  assert.equal(lampOf(r).lamp, 2);
});

test('B: an accepted break no longer bypasses the warnings', () => {
  // A: green "كسر مؤكد" right under resistance; B: the near zone keeps it yellow.
  const r = row({ events: { ...noEv, acceptedUp: true }, slots: [zone(100.2, 100.8), zone(120, 121), zone(90, 91), off] });
  assert.equal(lampOf(r).kind, 'break');
  const p = lampOfBC(r);
  assert.notEqual(p.lamp, 2);
  assert.equal(p.accepted, 1);
});

test('B: accepted break with every check passed is green 51 / 52', () => {
  assert.deepEqual([lampOfBC(row({ events: { ...noEv, acceptedUp: true } })).reason], [51]);
  const dn = row({ headingSign: -1, routeSign: -1, events: { ...noEv, acceptedDn: true } });
  assert.deepEqual([lampOfBC(dn).lamp, lampOfBC(dn).reason], [2, 52]);
});

test('B: opposite accepted break is yellow 33; both sides 32; engine off is 10', () => {
  assert.equal(lampOfBC(row({ events: { ...noEv, acceptedDn: true } })).reason, 33);
  assert.equal(lampOfBC(row({ events: { ...noEv, acceptedUp: true, acceptedDn: true } })).reason, 32);
  assert.equal(lampOfBC(row({ engineOn: false })).reason, 10);
});

test('episode start: a new green, or a heading change while green; not every green bar', () => {
  const t = new EpisodeTracker();
  const seq = [[1, 0], [2, 1], [2, 1], [2, -1], [1, -1], [2, -1]];
  const starts = seq.map(([l, h], i) => (t.push(true, l, h).start ? i : null)).filter((i) => i !== null);
  assert.deepEqual(starts, [1, 3, 5]); // same as handoff test_share_and_episode
  const u = new EpisodeTracker();
  assert.equal(u.push(false, 2, 1).start, false); // engine off: never a start
});

// --- C engine: the 20 break cases of handoff/test_patch.py, on the real updateLevel ---
function breakingLevel(E, direction, flip) {
  const lv = E.makeLevel({ key: 1, lo: 100, hi: 101, source: 0, tfRank: 0, typ: direction > 0 ? 0 : 1, s: 50, state: E.ST.BREAKING, stateChartBar: 10 });
  lv.breakDir = direction; lv.breakCloses = 1; lv.breakFromFlip = flip; lv.navArmed = true;
  return lv;
}
const bar = (c) => ({ o: c, h: c, l: c, c });
const step = (E, lv, c, bi) => { const ev = E.newEvents(); E.updateLevel(lv, bar(c), c, 1, bi, ev, true); return ev; };
const accepted = (ev) => ev.acceptedUp || ev.acceptedDn;

for (const direction of [1, -1]) for (const flip of [false, true]) {
  const beyond = direction > 0 ? 102 : 99, back = direction > 0 ? 99 : 102, inside = 100.5;
  const back0 = flip ? C.ST.FLIP : C.ST.ACTIVE;
  test(`C break cases dir ${direction} from ${flip ? 'FLIP' : 'ACTIVE'}`, () => {
    const a = breakingLevel(C, direction, flip); assert.ok(accepted(step(C, a, beyond, 11)));
    assert.equal(a.state, flip ? C.ST.DEAD : C.ST.BROKEN);
    const b = breakingLevel(C, direction, flip);
    assert.ok(!accepted(step(C, b, inside, 11))); assert.ok(!accepted(step(C, b, beyond, 12))); assert.equal(b.breakCloses, 1);
    assert.ok(!accepted(step(C, b, beyond, 13))); assert.equal(b.state, back0);
    const c = breakingLevel(C, direction, flip); assert.ok(!accepted(step(C, c, beyond, 13))); assert.equal(c.navArmed, false);
    const d = breakingLevel(C, direction, flip); assert.ok(!accepted(step(C, d, back, 11)));
    assert.equal(d.tests, 1); assert.equal(d.navArmed, false); assert.equal(d.state, back0);
    const e = breakingLevel(C, direction, flip); assert.ok(!accepted(step(C, e, beyond, 10)));
  });
}

test('A/B engine accepts a strong-body first close; C only arms BREAKING', () => {
  for (const E of [A, C]) {
    const lv = E.makeLevel({ key: 1, lo: 100, hi: 101, source: 0, tfRank: 0, typ: 0, s: 50 });
    const ev = E.newEvents();
    E.updateLevel(lv, { o: 100.2, h: 102.6, l: 100.1, c: 102.5 }, 100.2, 1, 20, ev, true);
    if (E === A) { assert.ok(ev.acceptedUp); assert.equal(lv.state, A.ST.BROKEN); }
    else { assert.ok(!ev.acceptedUp); assert.equal(lv.state, C.ST.BREAKING); assert.ok(ev.breakingUp); }
  }
});

test('C engine is generated from the live engine as it is now', () => {
  const gen = readFileSync(join(here, 'zone-engine-c.mjs'), 'utf8');
  const sha = gen.split('\n')[0].match(/sha256 ([0-9a-f]{64})/)[1];
  const liveSrc = readFileSync(join(here, '../../live/zone-engine.mjs'), 'utf8');
  assert.equal(createHash('sha256').update(liveSrc).digest('hex'), sha, 'live engine changed: run build-c.mjs again');
  assert.ok(gen.includes('[C] the first close only arms BREAKING'));
});
