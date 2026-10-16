// node --test indicators/lastgtg/live/lamp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { lampOf, fmtDist, zoneLine, dxyText } from './lamp.mjs';

const off = { active: false };
const zone = (lo, hi, q = 80, containing = false) => ({ active: true, lo, hi, displayQ: q, containing });
const noEv = { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, rejectR: false, rejectS: false, flipConfirmed: false };
const row = (over = {}) => ({
  c: 100, h: 100.5, l: 99.5, atrEng: 1, htfATR: 3,
  headingSign: 1, routeSign: 1, speedScore: 50, instantSpeedScore: 50, fuelScore: 50, fuelAcceleration: 0,
  slots: [zone(110, 111), zone(120, 121), zone(90, 91), zone(80, 81)], events: noEv, ...over,
});

test('aligned with room ahead is green "الاتجاه متوافق"', () => {
  const p = lampOf(row());
  assert.equal(p.lamp, 2); assert.equal(p.why, 'الاتجاه متوافق'); assert.equal(p.kind, 'aligned'); assert.equal(p.greenDir, 1);
});

test('room check: obstacle closer than 1 HTF ATR turns it yellow "مقاومة أمامه"', () => {
  const p = lampOf(row({ slots: [zone(102, 103), zone(120, 121), zone(90, 91), zone(80, 81)] }));
  assert.equal(p.lamp, 1); assert.equal(p.why, 'مقاومة أمامه');
});

test('accepted break is green before everything else (no room check)', () => {
  const p = lampOf(row({ events: { ...noEv, acceptedDn: true }, slots: [zone(110, 111), off, zone(99.8, 99.9), off] }));
  assert.equal(p.lamp, 2); assert.equal(p.why, 'كسر مؤكد'); assert.equal(p.kind, 'break'); assert.equal(p.greenDir, -1);
});

test('inside the heading-side zone is red', () => {
  const p = lampOf(row({ slots: [zone(99, 101, 80, true), off, zone(90, 91), off] }));
  assert.equal(p.lamp, 0); assert.equal(p.why, 'داخل مقاومة');
});

test('heading against route is red', () => {
  const p = lampOf(row({ headingSign: -1 }));
  assert.equal(p.lamp, 0); assert.equal(p.why, 'عكس المسار العام');
});

test('no heading is yellow "بدون اتجاه واضح"', () => {
  const p = lampOf(row({ headingSign: 0, routeSign: 0 }));
  assert.equal(p.lamp, 1); assert.equal(p.why, 'بدون اتجاه واضح'); assert.equal(p.dirText, 'متردد');
});

test('zone rows and number format follow the Pine text', () => {
  assert.equal(fmtDist(224.4), '224'); assert.equal(fmtDist(11.66), '11.7'); assert.equal(fmtDist(0.035), '0.035');
  assert.equal(zoneLine(zone(110, 111, 80), true, '', 100, 0.001), 'مقاومة مهمة • 10.0');
  assert.equal(zoneLine(zone(90, 91, 50), false, 'بعد الكسر • ', 100, 0.001), 'بعد الكسر • دعم متوسط • 9.0');
  assert.equal(zoneLine(off, true, 'بعد الاختراق • ', 100, 0.001), 'بعد الاختراق • لا مقاومة قريبة');
  assert.equal(zoneLine(zone(95, 105, 30, true), false, '', 100, 0.001), 'دعم ضعيف • السعر عندها');
});

test('dollar row', () => {
  assert.equal(dxyText(null), 'الدولار • غير متاح');
  assert.equal(dxyText(Array.from({ length: 80 }, (_, i) => 100 + i)), 'الدولار صاعد • ضغط على الذهب');
  assert.equal(dxyText(Array.from({ length: 80 }, (_, i) => 200 - i)), 'الدولار هابط • يدعم الذهب');
});
