// ZE — the Measurement copy of the Zone Engine is observationally equivalent to the
// reference (TRADE_CONTRACT §1.2): same canonical snapshot, hashSlots, hashState and
// event bits on every bar, and the source differs only by [MEASURE]-tagged lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as REF from '../../gtg-navigator/reference/engine.mjs';
import * as LAB from './zone-engine.mjs';
import { canonicalSnapshot, compareSnapshots, hashSlots, hashState, eventBits } from '../../gtg-navigator/reference/snapshot.mjs';
import { marketBars, loadInputs } from '../../gtg-navigator/reference/history.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const P = REF.withSymbol(REF.DEFAULTS, { mintick: 0.01 });

function runBoth(seed, n) {
  const market = marketBars(n, seed);
  const { chart, series, anchorFeed } = loadInputs(market, P, { first: 0, last: n - 1 });
  const opts = { anchorFeed, a1Sec: 300, a2Sec: 900 };
  const ref = new REF.Engine(chart, series, P, opts);
  const lab = new LAB.Engine(chart, series, P, opts);
  let bars = 0, logs = 0;
  for (let i = 0; i < n; i++) {
    const a = ref.step(i), b = lab.step(i);
    const sa = canonicalSnapshot(ref, a, i, { symbol: 'SYN', timeframe: '1' });
    const sb = canonicalSnapshot(lab, b, i, { symbol: 'SYN', timeframe: '1' });
    const d = compareSnapshots(sa, sb, ['state', 'events']);
    assert.deepEqual(d, [], `seed ${seed} bar ${i}: ${JSON.stringify(d.slice(0, 3))}`);
    assert.equal(hashSlots(sa), hashSlots(sb));
    assert.equal(hashState(sa), hashState(sb));
    assert.equal(eventBits(sa), eventBits(sb));
    logs += b.events.log.length;
    bars++;
  }
  return { bars, logs, lab };
}

test('ZE1 lab copy = reference on every bar (3 seeds × 6000 bars, state + events + hashes)', () => {
  let total = 0;
  for (const seed of [3, 11, 29]) {
    const r = runBoth(seed, 6000);
    assert.equal(r.bars, 6000);
    assert.ok(r.logs > 0, 'instrumentation produced records');
    total += r.logs;
  }
  assert.ok(total > 100);
});

test('ZE2 source differs from the reference only by [MEASURE] lines and the header', () => {
  const ref = readFileSync(here('../../gtg-navigator/reference/engine.mjs'), 'utf8').split('\n');
  const lab = readFileSync(here('./zone-engine.mjs'), 'utf8').split('\n');
  const header = lab.findIndex((l) => l.startsWith('// Reference model of the GTG Navigator'));
  assert.ok(header > 0);
  const body = lab.slice(header).filter((l) => !l.includes('[MEASURE]'));
  const refBody = ref.filter((l) => ![
    "  return { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, flipConfirmed: false, rejectR: false, rejectS: false };",
    '      if (lv.mitigation >= 1) { lv.state = ST.DEAD; lv.navArmed = false; }',
    '      if (strongBack || lv.backCloses >= 2) { lv.state = ST.DEAD; lv.navArmed = false; }',
  ].includes(l));
  assert.deepEqual(body, refBody);
  // each replaced reference line survives verbatim as the prefix of its [MEASURE] line
  const measured = lab.filter((l) => l.includes('[MEASURE]')).join('\n');
  assert.match(measured, /rejectS: false, log: \[\] \};/);
  assert.match(measured, /if \(lv\.mitigation >= 1\) \{ lv\.state = ST\.DEAD; lv\.navArmed = false; ev\.log/);
  assert.match(measured, /if \(strongBack \|\| lv\.backCloses >= 2\) \{ lv\.state = ST\.DEAD; lv\.navArmed = false; ev\.log/);
});

test('ZE3 log records carry the fields the contract needs (E2 source, E3, FLIP direction)', () => {
  const kinds = new Set();
  const market = marketBars(4000, 7);
  const { chart, series, anchorFeed } = loadInputs(market, P, { first: 0, last: 3999 });
  const e = new LAB.Engine(chart, series, P, { anchorFeed, a1Sec: 300, a2Sec: 900 });
  for (let i = 0; i < 4000; i++) {
    for (const r of e.step(i).events.log) {
      kinds.add(r.k);
      assert.ok(Number.isSafeInteger(r.key));
      if (r.k === 'test') assert.ok(r.rej >= 0 && r.rej <= 1 && (r.side === 1 || r.side === -1));
      if (r.k === 'failedAcceptance') assert.ok([LAB.ST.ACTIVE, LAB.ST.FLIP].includes(r.toState));
      if (r.k === 'flip') assert.ok(r.dir === 1 || r.dir === -1);
    }
  }
  for (const k of ['test', 'breaking', 'accepted']) assert.ok(kinds.has(k), `saw ${k}`);
});
