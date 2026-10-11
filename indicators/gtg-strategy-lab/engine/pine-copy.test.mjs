// PC — the Pine "GTG Engine" copy differs from the frozen release only by [MEASURE] parts:
// the header comment, the title, three removed debug marker plots and section 19 exports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8').split('\n');
const frozen = read('../baseline/gtg_navigator_v0.4.7_FINAL_FROZEN.pine');
const copy = read('./gtg_engine_v0.4.7_measure.pine');

test('PC1 copy = frozen outside the [MEASURE] parts', () => {
  const sec19 = copy.findIndex((l) => l.includes('19. [MEASURE]'));
  assert.ok(sec19 > 0);
  const titleIdx = [copy.indexOf('     "GTG Engine v0.4.7 — measurement copy (export only)",'), copy.indexOf('     shorttitle = "GTG Engine m",')];
  assert.ok(titleIdx.every((i) => i > 0));
  const headerComment = copy.slice(1, 6);
  assert.ok(headerComment.every((l) => l.startsWith('//')));
  const removedV = new Set(copy.map((l) => (l.match(/^\/\/ \[MEASURE\] plot "(v_\w+)" removed/) || [])[1]).filter(Boolean));
  assert.equal(removedV.size, 30);
  const expected = frozen
    .filter((l) => !l.startsWith('plot(showObstacleMarkers ? dest'))
    .filter((l) => { const m = l.match(/^plot\(vOn[^"]*"(v_\w+)"/); return !(m && removedV.has(m[1])); })
    .map((l) => (l === '     "GTG Navigator v0.4.7 — Structural Zone Engine",' ? '     "GTG Engine v0.4.7 — measurement copy (export only)",' : l === '     shorttitle = "GTG v0.4.7",' ? '     shorttitle = "GTG Engine m",' : l));
  const got = [copy[0], ...copy.slice(6, sec19 - 1)].filter((l) => !l.includes('[MEASURE]'));
  // trailing blank lines before section 19 are formatting only
  while (got.length && got[got.length - 1] === '') got.pop();
  while (expected.length && expected[expected.length - 1] === '') expected.pop();
  assert.deepEqual(got, expected);
});

test('PC2 section 19 only adds data-window plots gated by validationMode', () => {
  const sec19 = copy.findIndex((l) => l.includes('19. [MEASURE]'));
  const tail = copy.slice(sec19 + 1).filter((l) => l.trim() && !l.startsWith('//'));
  assert.equal(tail[0], 'bool mOn = validationMode');
  const plots = tail.slice(1);
  assert.equal(plots.length, 16);
  for (const l of plots) assert.match(l, /^plot\(mOn \? \w+ : na, "m_\w+", display = display\.data_window, precision = 10\)$/);
});

test('PC3 plot budget: the copy never has more plot() calls than the frozen release (F-005)', () => {
  // TradingView counts some plots more than once (the frozen release is at 62 of 64 by its
  // count while it has 53 plot() calls), so the only sound static rule is "no more than frozen".
  const count = (src) => src.filter((l) => /^\s*plot\(/.test(l)).length;
  assert.ok(count(copy) <= count(frozen), `${count(copy)} > ${count(frozen)}`);
  for (const keep of ['v_hashSlots', 'v_hashState', 'v_eventBits', 'v_obsState', 'v_invTotal', 'v_loR1', 'v_hiS2', 'MA50']) {
    assert.ok(copy.some((l) => /^\s*plot\(/.test(l) && l.includes(`"${keep}"`)), `kept ${keep}`);
  }
});
