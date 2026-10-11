// PF — every constant in profiles.mjs is re-read from the frozen Pine file (blob 0c7cbe3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { INPUTS, profileFor } from './profiles.mjs';

const PINE_PATH = fileURLToPath(new URL('../baseline/gtg_navigator_v0.4.7_FINAL_FROZEN.pine', import.meta.url));
const pineBuf = readFileSync(PINE_PATH);
const pine = pineBuf.toString('utf8');

test('PF0 frozen Pine file is blob 0c7cbe3', () => {
  const blob = createHash('sha1').update(`blob ${pineBuf.length}\0`).update(pineBuf).digest('hex');
  assert.equal(blob, '0c7cbe366668fba20c9bc128448f908ce9314041');
});

test('PF1 input defaults equal the Pine input() defaults', () => {
  for (const [name, val] of Object.entries(INPUTS)) {
    const m = pine.match(new RegExp(`^${name} = input\\.(?:float|int|string)\\(("?[\\w.]+"?)`, 'm'));
    assert.ok(m, `input ${name} not found in Pine`);
    const pv = m[1].startsWith('"') ? m[1].slice(1, -1) : Number(m[1]);
    assert.equal(pv, val, name);
  }
});

test('PF2 per-timeframe profile ternaries are present verbatim in Pine', () => {
  const snippets = [
    'result := m <= 1 ? "15" :\n             m <= 5 ? "60" :\n             m <= 15 ? "60" :\n             m <= 60 ? "240" :\n             m <= 240 ? "D" : "D"',
    'result := m <= 1 ? 1000 :\n             m <= 5 ? 500 :\n             m <= 15 ? 320 :\n             m <= 60 ? 240 :\n             m <= 240 ? 180 : 160',
    'result := m <= 1 ? 8 :\n             m <= 5 ? 6 :\n             m <= 15 ? 5 :\n             m <= 60 ? 4 : 3',
    'result := m <= 1 ? 0.70 :\n             m <= 5 ? 0.65 :\n             m <= 15 ? 0.60 :\n             m <= 60 ? 0.55 :\n             m <= 240 ? 0.45 : 0.45',
    'headingEffLen := hm <= 1 ? math.min(headingLookback, 8) : hm <= 5 ? math.min(headingLookback, 10) : hm <= 15 ? math.min(headingLookback, 12) : headingLookback',
    'headingSlopeEffLen := hm <= 1 ? math.min(headingSlopeLookback, 4) : hm <= 5 ? math.min(headingSlopeLookback, 5) : hm <= 15 ? math.min(headingSlopeLookback, 6) : headingSlopeLookback',
    'microLen := hm <= 1 ? 3 : hm <= 5 ? 3 : hm <= 15 ? 4 : hm <= 60 ? 5 : 6',
    'int profClass = timeframe.isintraday ? (tfMin <= 1 ? 0 : tfMin <= 5 ? 1 : tfMin <= 15 ? 2 : tfMin <= 60 ? 3 : 4)',
    'string a1Tf = profClass == 0 ? "5" : profClass == 1 ? "15" : profClass == 2 ? "60" : profClass == 3 ? "240" : profClass == 4 ? "D"',
    'string a2Tf = profClass == 0 ? "15" : profClass == 1 ? "60" : profClass == 2 ? "240" : profClass == 3 ? "D" : profClass == 4 ? "W"',
    'int pivotLen = profClass == 0 ? 3 : profClass == 1 ? 4 : 5',
    'int maxAgeLocal = profClass == 0 ? 720 : profClass == 1 ? 576 : profClass == 2 ? 480 : profClass == 3 ? 360 : profClass == 4 ? 270',
    'int flipWindow = profClass == 0 ? 60 : profClass == 1 ? 48 : profClass == 2 ? 48 : profClass == 3 ? 72 : profClass == 4 ? 42',
    'int maxAgeA1 = 96', 'int maxAgeA2 = 64',
  ];
  for (const s of snippets) assert.ok(pine.includes(s), `missing in Pine: ${s.slice(0, 70)}`);
});

test('PF3 profiles derived for the five lab timeframes', () => {
  const exp = {
    M1: { htfTf: 'M15', rankLen: 1000, speedFlowLen: 8, htfWeight: 0.70, headingEffLen: 8, a1Tf: '5', a2Tf: '15', pivotLen: 3, maxAgeLocal: 720, flipWindow: 60 },
    M5: { htfTf: 'H1', rankLen: 500, speedFlowLen: 6, htfWeight: 0.65, headingEffLen: 10, a1Tf: '15', a2Tf: '60', pivotLen: 4, maxAgeLocal: 576, flipWindow: 48 },
    M15: { htfTf: 'H1', rankLen: 320, speedFlowLen: 5, htfWeight: 0.60, headingEffLen: 12, a1Tf: '60', a2Tf: '240', pivotLen: 5, maxAgeLocal: 480, flipWindow: 48 },
    H1: { htfTf: 'H4', rankLen: 240, speedFlowLen: 4, htfWeight: 0.55, headingEffLen: 14, a1Tf: '240', a2Tf: 'D', pivotLen: 5, maxAgeLocal: 360, flipWindow: 72 },
    H4: { htfTf: 'D', rankLen: 180, speedFlowLen: 3, htfWeight: 0.45, headingEffLen: 14, a1Tf: 'D', a2Tf: 'W', pivotLen: 5, maxAgeLocal: 270, flipWindow: 42 },
  };
  for (const [tf, e] of Object.entries(exp)) {
    const p = profileFor(tf);
    for (const [k, v] of Object.entries(e)) assert.equal(p[k], v, `${tf}.${k}`);
  }
  assert.throws(() => profileFor('D'));
});

test('PF4 sensor formulas used by sensors.mjs are present verbatim in Pine', () => {
  const lines = [
    'barTravel = 0.70 * closeStep + 0.30 * trueRange',
    'flowFallback = flowFallbackBase > 0 ? clamp100(50.0 * flowSpeedRaw / flowFallbackBase) : 50.0',
    'localSlopeNorm := clampSigned(localSlopeNorm * 2.5)',
    'microMoveNorm := clampSigned(microMoveNorm * 3.0)',
    '     0.38 * signedEfficiency +\n     0.24 * localSlopeNorm +\n     0.23 * microMoveNorm +\n     0.15 * maStructure',
    'int tacticalSign = headingSign != 0 ? headingSign : headingStrength > headingDeadZone ? (headingScore > 0 ? 1 : -1) : (math.abs(microMoveNorm) > 0.32 ? microSign : 0)',
    'htfRouteVector = 0.70 * htfStructure + 0.30 * htfMA50SlopeNorm',
    'currentRouteVector = 0.70 * currentStructure + 0.30 * currentMA50SlopeNorm',
    '[close[1], getMA(close, 50)[1], getMA(close, 200)[1], getMA(close, 50)[6], ta.atr(14)[1]]',
    '     0.40 * math.min(volumeRelative, 3.0) +\n     0.15 * math.min(rangeRelative, 3.0) +\n     0.20 * math.min(bodyAtr, 2.0) +\n     0.15 * persistence +\n     0.10 * math.abs(signedEfficiency) :',
    '     0.25 * math.min(rangeRelative, 3.0) +\n     0.30 * math.min(bodyAtr, 2.0) +\n     0.25 * persistence +\n     0.20 * math.abs(signedEfficiency)',
    'fuelAcceleration = fuelScore - nz(fuelScore[speedAccelLookback], fuelScore)',
    'bool fuelExhaustion = speedScore >= 55 and fuelScore >= 40 and fuelAcceleration < -6',
    'bool fuelNotSupportingChase = fuelAcceleration < -3 or fuelScore < noChaseFuelMax or fuelScore + 18 < speedScore',
    'bool speedHotForChase = speedScore >= math.max(60.0, speedFastThreshold - 10.0) or instantSpeedScore >= speedExtremeThreshold',
    'zn.displayQ := math.min(100.0, zn.gateQ + (maConf ? 4.0 : 0.0) + (psychConf ? 3.0 : 0.0))',
    'plot(engineStep ? engineEventBits + alertBits * 128 : na, "v_eventBits"',
  ];
  for (const s of lines) assert.ok(pine.includes(s), `missing in Pine: ${s.slice(0, 70)}`);
});
