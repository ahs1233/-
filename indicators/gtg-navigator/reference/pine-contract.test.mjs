// Static contract checks on the Pine source. They read gtg_navigator_v0.4.7.pine as
// text; they do not compile or run Pine (compile/runtime evidence comes only from
// TradingView). Run: node --test indicators/gtg-navigator/reference/pine-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HASH_P } from './snapshot.mjs';

const dir = fileURLToPath(new URL('..', import.meta.url));
const pine = readFileSync(`${dir}/gtg_navigator_v0.4.7.pine`, 'utf8');
const gitBlob = (buf) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');

// Body of a top-level Pine function: lines after "name(" up to the next non-indented line.
function fnBody(name) {
  const lines = pine.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${name}(`));
  assert.ok(i >= 0, `function ${name} not found`);
  const body = [];
  for (let j = i + 1; j < lines.length && (lines[j].startsWith(' ') || lines[j] === ''); j++) body.push(lines[j]);
  return body;
}
const stepArgs = (body) => body.map((l) => l.match(/hashStep\(h0?, (.+)\)\s*$/)).filter(Boolean).map((m) => m[1]);

test('C1 hash constants match the JS reference', () => {
  assert.match(pine, new RegExp(`^HASH_P = ${HASH_P}$`, 'm'));
  assert.match(pine, /^HASH_B = 1000003$/m);
  assert.match(pine, /^HASH_K = 131071$/m);
});

test('C2 hashLevel field order equals the per-level part of encodeState (snapshot.mjs)', () => {
  // Same order as encodeState: key, source, tfRank, typ, birthTime, price ticks, state,
  // polarity, lo/hi ticks, s, mitigation, evidence, tests, ageNative, epActive, epSide,
  // epMaxDepth, breakDir, breakCloses, breakFromFlip, backCloses, sinceTest, sinceState, sinceBack.
  assert.deepEqual(stepArgs(fnBody('hashLevel')), [
    'lv.key', 'lv.source', 'lv.tfRank', 'lv.typ', 'lv.birthTime', 'toTicks(lv.price)', 'lv.state', 'lv.polarity', 'toTicks(lv.lo)', 'toTicks(lv.hi)', 'q6(lv.s)', 'q6(lv.mitigation)', 'q6(lv.evidence)',
    'lv.tests', 'lv.ageNative', 'lv.epActive ? 1 : 0', 'lv.epSide', 'q6(lv.epMaxDepth)', 'lv.breakDir', 'lv.breakCloses',
    'lv.breakFromFlip ? 1 : 0', 'lv.backCloses', 'sinceOr(lv.lastTestChartBar)', 'sinceOr(lv.stateChartBar)', 'sinceOr(lv.backStartChartBar)',
  ]);
});

test('C3 hashSlot field order equals encodeSlots (snapshot.mjs)', () => {
  assert.deepEqual(stepArgs(fnBody('hashSlot')), [
    '0', '1', 'ss.containing ? 1 : 0', 'ss.side', 'toTicks(ss.lo)', 'toTicks(ss.hi)', 'ss.primaryKey',
    'math.round(ss.gateQ * 100)', 'math.round(ss.quality * 100)',
  ]);
  const body = fnBody('hashSlot').join('\n');
  assert.match(body, /hashKeyList\(h, lastK, scratch\)[\s\S]*hashKeyList\(h, entryK, scratch\)/);
});

test('C4 the linear slotDigest and cumulative checksum are gone', () => {
  assert.doesNotMatch(pine, /slotDigest|CHECKSUM_MOD|slotChecksum|hashLevels/);
});

test('C8 hashState folds trackers then the OHLC ring (age order), as encodeState does', () => {
  const block = pine.slice(pine.indexOf('hl := hashTracker(hl, lastSwingHighPx'), pine.indexOf('tel.hashState := hl'));
  const order = ['hashTracker(hl, lastSwingHighPx', 'hashTracker(hl, lastSwingLowPx', 'hashStep(hl, nRing)',
    'toTicks(array.get(ringO, k))', 'toTicks(array.get(ringH, k))', 'toTicks(array.get(ringL, k))', 'toTicks(array.get(ringC, k))'];
  let at = -1;
  for (const s of order) { const i = block.indexOf(s); assert.ok(i > at, `${s} missing or out of order`); at = i; }
});

test('C9 capture prints GTGSNAP v2 with the identity fields and RING lines', () => {
  assert.match(pine, /"GTGSNAP\|v2\|"/);
  assert.match(pine, /"LVL\|" \+ fi\(lv\.key\) \+ "\|" \+ fi\(lv\.source\) \+ "\|" \+ fi\(lv\.tfRank\) \+ "\|" \+ fi\(lv\.typ\) \+ "\|" \+ fi\(lv\.birthTime\) \+ "\|" \+ f10\(lv\.price\)/);
  assert.match(pine, /^RING_CHUNK = 16$/m);
});

test('C5 plot budget and export names', () => {
  const plots = pine.match(/^\s*(plot|plotshape|plotchar|plotarrow|plotcandle|plotbar|bgcolor|barcolor|fill|hline)\(/gm) || [];
  assert.ok(plots.length <= 64, `plot-type outputs: ${plots.length}`);
  for (const name of ['v_hashSlots', 'v_hashState', 'v_eventBits', 'v_loR1', 'v_hiR1', 'v_loR2', 'v_hiR2', 'v_loS1', 'v_hiS1', 'v_loS2', 'v_hiS2']) {
    assert.ok(pine.includes(`"${name}"`), `missing export ${name}`);
  }
});

test('C6 R2 anchors: Pine floors that the reference mirrors are still present', () => {
  assert.match(pine, /float width = math\.max\(lv\.hi - lv\.lo, syminfo\.mintick\)/);
  assert.match(pine, /atrEng = math\.max\(nz\(ta\.sma\(ta\.tr\(true\), ATR_ENG_LEN\), ta\.tr\(true\)\), syminfo\.mintick\)/);
  assert.match(pine, /float atrA1 = na\(a1AtrRaw\) \? na : math\.max\(a1AtrRaw, syminfo\.mintick\)/);
});

test('C7 legacy v0.4.6 file is unchanged', () => {
  const legacy = readFileSync(`${dir}/gtg_navigator_v0.4.6.pine`);
  assert.equal(gitBlob(legacy), '3dab279af76fc0dbf65fb2bcc1498b32f613c117');
});

test('C10 R3 guard: Pine refuses Q_stay > Q_enter on the first bar with runtime.error', () => {
  assert.match(pine, /^if barstate\.isfirst and qStay > qEnter\n    runtime\.error\("GTG Navigator: Q_stay/m);
  // The inputs themselves keep their ranges: the contract is the relation, not a clamp.
  assert.match(pine, /^qStay = input\.float\(45\.0, /m);
  assert.match(pine, /^qEnter = input\.float\(55\.0, /m);
});

test('C11 consumers.mjs transcribes these Pine lines verbatim (fails if Pine changes them)', () => {
  const lines = [
    'string speedClass = speedScore < speedSlowThreshold ? "بطيئة" : speedScore < speedFastThreshold ? "طبيعية" : speedScore < speedExtremeThreshold ? "سريعة" : "استثنائية"',
    'color speedColor = speedScore >= speedExtremeThreshold ? color.orange : speedScore >= speedFastThreshold ? color.yellow : color.white',
    'speedBurst = barstate.isconfirmed and speedScore >= speedExtremeThreshold and speedScore[1] < speedExtremeThreshold',
    'int headingSign = headingScore > headingClearThreshold ? 1 : headingScore < -headingClearThreshold ? -1 : 0',
    'string headingText = headingScore >= headingStrongThreshold ? "↑ صاعد بقوة" :\n     headingScore > headingClearThreshold ? "↗ صاعد" :\n     headingScore <= -headingStrongThreshold ? "↓ هابط بقوة" :\n     headingScore < -headingClearThreshold ? "↘ هابط" :\n     headingStrength <= headingDeadZone ? "→ غير حاسم" :\n     headingScore > 0 ? "↗ ميل صاعد ضعيف" : "↘ ميل هابط ضعيف"',
    'headingStrength = math.abs(headingScore)',
    'int routeSign = routeScore > routeClearThreshold ? 1 : routeScore < -routeClearThreshold ? -1 : 0',
    'string routeText = routeScore >= routeStrongThreshold ? "↑ صاعد بقوة" :\n     routeScore > routeClearThreshold ? "↗ صاعد" :\n     routeScore <= -routeStrongThreshold ? "↓ هابط بقوة" :\n     routeScore < -routeClearThreshold ? "↘ هابط" : "→ غير حاسم"',
  ];
  for (const l of lines) assert.ok(pine.includes(l), `Pine line changed or missing: ${l.slice(0, 60)}…`);
});

test('C12 R3b guards: Pine refuses the three inverted pairs on the first bar with runtime.error', () => {
  assert.match(pine, /^if barstate\.isfirst and headingStrongThreshold <= headingClearThreshold\n    runtime\.error\(/m);
  assert.match(pine, /^if barstate\.isfirst and routeStrongThreshold <= routeClearThreshold\n    runtime\.error\(/m);
  assert.match(pine, /^if barstate\.isfirst and speedExtremeThreshold < speedFastThreshold\n    runtime\.error\(/m);
  // No clamp: the inputs keep their declared defaults.
  for (const d of ['speedFastThreshold = input.float(70.0,', 'speedExtremeThreshold = input.float(90.0,', 'headingClearThreshold = input.float(20.0,', 'headingStrongThreshold = input.float(60.0,', 'routeClearThreshold = input.float(22.0,', 'routeStrongThreshold = input.float(62.0,']) assert.ok(pine.includes(d), d);
});

