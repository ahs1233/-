// Coverage negative controls requested in review (message 45): repeated keys, the
// OHLC ring, explicit source identity, and whole bars missing from a capture.
// Run: node --test indicators/gtg-navigator/reference/snapshot-coverage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, SRC, TF, TYP, makeLevel, memberKeyOf, selectSlots, emptySlot } from './engine.mjs';
import { compareSnapshots } from './snapshot.mjs';
import { formatCapture } from './capture.mjs';
import { T0, key, baseSnap } from './fixtures.mjs';

const clone = (x) => structuredClone(x);
const paths = (diffs) => diffs.map((d) => `${d.path}:${d.kind}`);

test('S12 repeated key: two identical records against one is a state difference (multiplicity)', () => {
  const a = baseSnap();
  const b = clone(a);
  a.levels.push(clone(a.levels[1])); // same key and fields twice
  const d = paths(compareSnapshots(a, b, ['state']));
  assert.ok(d.includes(`levels.${key(2)}:multiplicity`), d.join(' '));
  assert.ok(d.includes('levels.length:exact'), d.join(' '));
  // Same multiplicity on both sides is not a difference.
  const c = clone(a);
  assert.deepEqual(compareSnapshots(a, c, ['state']), []);
});

test('S13 ring: a different OHLC ring is detected at state, and it changes the next selection', () => {
  const a = baseSnap();
  const b = clone(a);
  b.ring[5].c = a.ring[5].c + 0.5;
  assert.deepEqual(compareSnapshots(a, b, ['identity', 'events']), []);
  assert.deepEqual(paths(compareSnapshots(a, b, ['state'])), ['ring.5.c:raw', 'ring.5.c:ticks']);
  const short = clone(a); short.ring.pop();
  assert.ok(paths(compareSnapshots(a, short, ['state'])).includes('ring.length:exact'));

  // Behavioural oracle (spec: containing zone goes to R1 when entered from below, to S1
  // when entered from above, judged by the first close outside the zone in ringC).
  const m = makeLevel({ key: memberKeyOf(T0, SRC.SWING, TF.LOCAL, TYP.HIGH), lo: 99.5, hi: 100.5, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: T0, s: 70 });
  m.q = 70;
  const zone = () => ({ lo: 99.5, hi: 100.5, members: [m], primary: m, gateQ: 70, displayQ: 70, hasA1: false, hasA2: false });
  const empty = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
  const ctx = (ringC) => ({ close: 100, atr: 1, atrA1: null, atrA2: null, ringC });
  const fromBelow = selectSlots([zone()], empty, ctx([100, 99.2]), DEFAULTS);
  const fromAbove = selectSlots([zone()], empty, ctx([100, 100.8]), DEFAULTS);
  assert.equal(fromBelow.pick[0], 0); // R1
  assert.equal(fromBelow.pick[2], -1);
  assert.equal(fromAbove.pick[2], 0); // S1
  assert.equal(fromAbove.pick[0], -1);
});

test('S15 source identity: each identity field alone is a state difference', () => {
  const a = baseSnap();
  const cases = [
    ['source', SRC.DOZ, ['source:exact']],
    ['tfRank', TF.A1, ['tfRank:exact']],
    ['typ', TYP.LOW, ['typ:exact']],
    ['birthTime', a.levels[0].birthTime + 60_000, ['birthTime:exact']],
    ['price', a.levels[0].price + 0.01, ['price:raw', 'price:ticks']],
  ];
  for (const [field, value, kinds] of cases) {
    const b = clone(a);
    b.levels[0][field] = value;
    assert.deepEqual(paths(compareSnapshots(a, b, ['state'])), kinds.map((k) => `levels.${key(1)}.${k}`), field);
    assert.deepEqual(compareSnapshots(a, b, ['identity']), [], `${field} must not leak into identity`);
  }
});

test('S14 compare-captures: a whole missing bar fails (two files strict, and single file with an expectation)', () => {
  const tool = fileURLToPath(new URL('../validation/tools/compare-captures.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'gtgcap-'));
  const bar = (i) => { const s = baseSnap(); s.meta.time = T0 + i * 60_000; return formatCapture(s); };
  const full = [0, 1, 2].map(bar).join('\n');
  const noMiddle = [0, 2].map(bar).join('\n');
  const lvlCut = [0, 1, 2].map(bar).join('\n').split('\n').filter((l, i, arr) => !(l.includes(`|${T0 + 60_000}|LVL|`) && arr.indexOf(l) === i)).join('\n');
  const A = join(dir, 'A.txt'), B = join(dir, 'B.txt'), C = join(dir, 'C.txt');
  writeFileSync(A, full); writeFileSync(B, noMiddle); writeFileSync(C, lvlCut);
  const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' });

  assert.equal(run(A, A).status, 0);
  const strict = run(A, B);
  assert.equal(strict.status, 1, strict.stdout);
  assert.match(strict.stdout, /ONLY_A \d+/);
  assert.equal(run(A, B, '--intersection-ok').status, 0); // explicit opt-in only

  const expect = ['--expect-from', String(T0), '--expect-to', String(T0 + 120_000), '--step-ms', '60000'];
  assert.equal(run(A, ...expect).status, 0);
  const missing = run(B, ...expect);
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /MISSING BAR/);
  const partial = run(C, ...expect);
  assert.equal(partial.status, 1);
  assert.match(partial.stdout, /INCOMPLETE BAR/);
  assert.doesNotMatch(partial.stdout, /MISSING BAR/);
});

test('S16 new continuation state (R4): the arm and the Strong Obstacle latch are state-level differences', async () => {
  const { formatCapture: fmt, parseCapture: parse } = await import('./capture.mjs');
  const { hashState } = await import('./snapshot.mjs');
  const a = baseSnap();
  const armed = clone(a); armed.levels[2].navArmed = true;
  assert.deepEqual(paths(compareSnapshots(a, armed, ['state'])), [`levels.${key(3)}.navArmed:exact`]);
  assert.notEqual(hashState(a), hashState(armed));
  const latched = clone(a); latched.obstacle = { state: true, keys: [key(1), key(2)] };
  const other = clone(latched); other.obstacle.keys = [key(4)];
  assert.deepEqual(paths(compareSnapshots(a, latched, ['state'])), ['obstacle:exact']);
  assert.deepEqual(paths(compareSnapshots(latched, other, ['state'])), ['obstacle.keys:exact']);
  assert.deepEqual(compareSnapshots(latched, other, ['identity', 'events']), []);
  assert.notEqual(hashState(latched), hashState(other));
  // Round trip through the v3 capture, with and without a modelled latch.
  for (const s of [a, armed, latched]) {
    const r = parse(fmt(s, 16, s.obstacle ? { available: true, strength: 80, distAtr: 0.2, qualifying: true, same: false, event: true } : null)).get(s.meta.time);
    assert.ok(r.complete, r.problems.join('; '));
    assert.deepEqual(compareSnapshots(s, r.snapshot, ['state', 'events']), []);
    assert.equal(r.declared.hashState, hashState(s));
  }
});

