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

test('C2 hashLevel field order equals encodeLevels (snapshot.mjs)', () => {
  // Same order as encodeLevels: key, state, polarity, lo/hi ticks, s, mitigation, evidence,
  // tests, ageNative, epActive, epSide, epMaxDepth, breakDir, breakCloses, breakFromFlip,
  // backCloses, sinceTest, sinceState, sinceBack.
  assert.deepEqual(stepArgs(fnBody('hashLevel')), [
    'lv.key', 'lv.state', 'lv.polarity', 'toTicks(lv.lo)', 'toTicks(lv.hi)', 'q6(lv.s)', 'q6(lv.mitigation)', 'q6(lv.evidence)',
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
  assert.doesNotMatch(pine, /slotDigest|CHECKSUM_MOD|slotChecksum/);
});

test('C5 plot budget and export names', () => {
  const plots = pine.match(/^\s*(plot|plotshape|plotchar|plotarrow|plotcandle|plotbar|bgcolor|barcolor|fill|hline)\(/gm) || [];
  assert.ok(plots.length <= 64, `plot-type outputs: ${plots.length}`);
  for (const name of ['v_hashSlots', 'v_hashLevels', 'v_eventBits', 'v_loR1', 'v_hiR1', 'v_loR2', 'v_hiR2', 'v_loS1', 'v_hiS1', 'v_loS2', 'v_hiS2']) {
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
