// Event provenance across a level's break lifecycle (review item R4-B).
// Contract (message 51): a navigation chain is armed when a level goes ACTIVE/FLIP →
// BREAKING while it was a member of a displayed slot at the previous confirmed bar.
// Break Accepted and Flip Confirmed follow the arm, not the current slot membership;
// the arm is cleared on return to ACTIVE/FLIP, window expiry without acceptance, flip,
// death, or the end of flipWindow. A level that was hidden when the chain started
// never produces Accepted/Flip later. Breaking and Rejection keep the per-bar rule.
// Run: node --test indicators/gtg-navigator/reference/lifecycle.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SRC, TF, TYP, ST, makeLevel, newEvents, updateLevel, withSymbol } from './engine.mjs';

const P = withSymbol(DEFAULTS, { mintick: 0.01 });
const ATR = 1;
// Resistance [100, 101]; break buffer 0.1 → a close above 101.1 is beyond.
const res = (state = ST.ACTIVE) => makeLevel({ key: 1, lo: 100, hi: 101, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: 0, s: 70, state, lastTestChartBar: 0 });
function step(lv, bi, bar, pc, inSlot) {
  const ev = newEvents();
  updateLevel(lv, bar, pc, ATR, bi, ev, inSlot, P);
  return ev;
}
const weakUp = (c) => ({ o: c - 0.3, h: c + 0.1, l: c - 0.4, c });      // body 0.3 < 0.8·ATR
const breakChain = (lv, inStart) => { const e = step(lv, 10, weakUp(101.3), 101.0, inStart); assert.equal(lv.state, ST.BREAKING); return e; };

test('B1 accepted after slot loss: armed at break start ⇒ Break Accepted even when no longer displayed', () => {
  const lv = res();
  assert.ok(breakChain(lv, true).breakingUp);
  const e = step(lv, 11, weakUp(101.4), 101.3, false);
  assert.equal(lv.state, ST.BROKEN);
  assert.ok(e.acceptedUp, 'accepted event lost after slot loss');
});

test('B2 flip after slot loss: armed chain ⇒ Flip Confirmed inside flipWindow, then the arm clears', () => {
  const lv = res();
  breakChain(lv, true);
  step(lv, 11, weakUp(101.4), 101.3, false);
  // Retest from above at bar 13: touches the zone and closes 0.6 above hi → rej 0.6.
  const e = step(lv, 13, { o: 101.5, h: 101.6, l: 100.8, c: 101.7 }, 101.5, false);
  assert.equal(lv.state, ST.FLIP);
  assert.ok(e.flipConfirmed, 'flip event lost after slot loss');
  assert.equal(lv.navArmed, false);
});

test('B3 hidden at break start ⇒ no Accepted and no Flip later, even if displayed by then', () => {
  const lv = res();
  assert.equal(breakChain(lv, false).breakingUp, false);
  const a = step(lv, 11, weakUp(101.4), 101.3, true);
  assert.equal(lv.state, ST.BROKEN);
  assert.equal(a.acceptedUp, false, 'hidden chain produced Break Accepted');
  const f = step(lv, 13, { o: 101.5, h: 101.6, l: 100.8, c: 101.7 }, 101.5, true);
  assert.equal(lv.state, ST.FLIP);
  assert.equal(f.flipConfirmed, false, 'hidden chain produced Flip Confirmed');
});

test('B4 arm clears on return to ACTIVE (close back) and on BREAK_WINDOW expiry', () => {
  const back = res();
  breakChain(back, true);
  step(back, 11, { o: 101, h: 101.1, l: 99.7, c: 99.8 }, 101.3, true);
  assert.equal(back.state, ST.ACTIVE);
  assert.equal(back.navArmed, false);
  const expire = res();
  breakChain(expire, true);
  for (let bi = 11; bi <= 13; bi++) step(expire, bi, { o: 100.9, h: 101.05, l: 100.8, c: 101.0 }, 101.0, true);
  assert.equal(expire.state, ST.ACTIVE);
  assert.equal(expire.navArmed, false);
});

test('B5 arm survives in BROKEN within flipWindow and clears when flipWindow ends', () => {
  const lv = res();
  breakChain(lv, true);
  step(lv, 11, weakUp(101.4), 101.3, true);
  assert.equal(lv.navArmed, true);
  // Quiet bars far above the zone (no touch, no close back below lo − buffer).
  step(lv, 11 + P.flipWindow, { o: 103, h: 103.2, l: 102.8, c: 103 }, 103, false);
  assert.equal(lv.navArmed, true);
  step(lv, 12 + P.flipWindow, { o: 103, h: 103.2, l: 102.8, c: 103 }, 103, false);
  assert.equal(lv.navArmed, false);
});

test('B6 death clears the arm (acceptance back to the original side)', () => {
  const lv = res();
  breakChain(lv, true);
  step(lv, 11, weakUp(101.4), 101.3, true);
  step(lv, 12, { o: 100.2, h: 100.3, l: 99.0, c: 99.1 }, 101.4, false); // strong close back below lo − buffer
  assert.equal(lv.state, ST.DEAD);
  assert.equal(lv.navArmed, false);
});

test('B7 break of a FLIP level accepted to DEAD: Accepted if armed, then the arm clears', () => {
  const lv = res(ST.FLIP);
  assert.ok(breakChain(lv, true).breakingUp);
  const e = step(lv, 11, weakUp(101.4), 101.3, false);
  assert.equal(lv.state, ST.DEAD);
  assert.ok(e.acceptedUp);
  assert.equal(lv.navArmed, false);
});

test('B8 unchanged rules: Breaking and Rejection still use the per-bar displayed filter', () => {
  const lv = res();
  assert.equal(breakChain(lv, false).breakingUp, false);
  const armed = res();
  assert.ok(breakChain(armed, true).breakingUp);
  // Rejection from below while displayed / hidden.
  const r1 = res(), r2 = res();
  const rejBar = { o: 100.2, h: 100.9, l: 99.0, c: 99.2 };
  assert.ok(step(r1, 10, rejBar, 99.5, true).rejectR);
  assert.equal(step(r2, 10, rejBar, 99.5, false).rejectR, false);
});
