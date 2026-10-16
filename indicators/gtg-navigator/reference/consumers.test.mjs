// Input contracts R3b: headingStrong > headingClear, routeStrong > routeClear,
// speedExtreme ≥ speedFast. Each inverted pair makes the HUD text/colour/alert
// contradict the sign or class computed from the same score. Contract: refused with a
// clear message (Pine: runtime.error on the first bar), never clamped.
// Oracle: the consistency rules below, stated from the meaning of the outputs.
// Run: node --test indicators/gtg-navigator/reference/consumers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSUMER_DEFAULTS, speedView, headingView, routeView, textDirection } from './consumers.mjs';

const C = (over) => ({ ...CONSUMER_DEFAULTS, ...over });

// Consistency rules (the oracle):
//   heading/route: a text that claims a direction (strong or clear) implies the same sign.
//   speed: the extreme colour or a Speed Burst implies the class "استثنائية", and the
//          fast colour implies the class "سريعة".
const directionConsistent = (v) => textDirection(v.text) === 0 || textDirection(v.text) === v.sign;
const speedConsistent = (v) => ((v.color === 'orange' || v.burst) ? v.cls === 'استثنائية' : true) && (v.color === 'yellow' ? v.cls === 'سريعة' : true);

test('K1 heading: clear > strong, and clear = strong, are refused (text "strong" with sign 0)', () => {
  // Inverted: score 42 with clear 45 / strong 40 → baseline text "↑ صاعد بقوة", sign 0.
  assert.throws(() => headingView(42, C({ headingClearThreshold: 45, headingStrongThreshold: 40 })), /headingStrong/);
  // Equal: score 40 with clear = strong = 40 → text uses >= strong, sign uses > clear.
  assert.throws(() => headingView(40, C({ headingClearThreshold: 40, headingStrongThreshold: 40 })), /headingStrong/);
});

test('K2 route: clear > strong, and clear = strong, are refused (text "strong" with sign 0)', () => {
  assert.throws(() => routeView(43, C({ routeClearThreshold: 45, routeStrongThreshold: 40 })), /routeStrong/);
  assert.throws(() => routeView(-40, C({ routeClearThreshold: 40, routeStrongThreshold: 40 })), /routeStrong/);
});

test('K3 speed: extreme < fast is refused (extreme colour and Speed Burst while the class is "طبيعية")', () => {
  // score 80 with fast 90 / extreme 75 → baseline class "طبيعية", colour orange, burst from 70.
  assert.throws(() => speedView(80, 70, C({ speedFastThreshold: 90, speedExtremeThreshold: 75 })), /speedExtreme/);
});

test('K4 valid configurations are consistent at every score (grid, boundaries included)', () => {
  const headingCfgs = [[20, 60], [44, 45], [5, 90], [45, 46]];
  const routeCfgs = [[22, 62], [44, 45], [5, 90]];
  const speedCfgs = [[25, 70, 90], [25, 80, 80], [45, 90, 90], [5, 50, 99]];
  for (let s = -100; s <= 100; s += 0.5) {
    for (const [clear, strong] of headingCfgs) {
      const v = headingView(s, C({ headingClearThreshold: clear, headingStrongThreshold: strong }));
      assert.ok(directionConsistent(v), `heading ${clear}/${strong} score ${s}: ${v.text} sign ${v.sign}`);
    }
    for (const [clear, strong] of routeCfgs) {
      const v = routeView(s, C({ routeClearThreshold: clear, routeStrongThreshold: strong }));
      assert.ok(directionConsistent(v), `route ${clear}/${strong} score ${s}: ${v.text} sign ${v.sign}`);
    }
  }
  for (let s = 0; s <= 100; s += 0.5) {
    for (const [slow, fast, extreme] of speedCfgs) {
      for (const prev of [0, s - 0.5, s]) {
        const v = speedView(s, prev, C({ speedSlowThreshold: slow, speedFastThreshold: fast, speedExtremeThreshold: extreme }));
        assert.ok(speedConsistent(v), `speed ${slow}/${fast}/${extreme} score ${s}: ${JSON.stringify(v)}`);
      }
    }
  }
});

test('K5 defaults are valid, and equality is allowed only for speed', () => {
  assert.doesNotThrow(() => headingView(0));
  assert.doesNotThrow(() => routeView(0));
  assert.doesNotThrow(() => speedView(0, 0));
  assert.deepEqual(speedView(80, 79, C({ speedFastThreshold: 80, speedExtremeThreshold: 80 })), { cls: 'استثنائية', color: 'orange', burst: true });
  assert.deepEqual(speedView(79, 70, C({ speedFastThreshold: 80, speedExtremeThreshold: 80 })), { cls: 'طبيعية', color: 'white', burst: false });
});

test('K6 negative control: the consistency oracle rejects the outputs recorded before the fix', () => {
  // Outputs recorded on 466ec8b (artifact r3b-consumers-prefix-466ec8b.txt).
  assert.equal(directionConsistent({ sign: 0, text: '↑ صاعد بقوة' }), false);
  assert.equal(directionConsistent({ sign: 0, text: '↓ هابط بقوة' }), false);
  assert.equal(speedConsistent({ cls: 'طبيعية', color: 'orange', burst: true }), false);
});
