// node --test indicators/lastgtg/review_1_1/js/gate4_full.test.mjs
// Gate 4 run 4 (copies without calc_bars_count, 5,000 chart bars): the TradingView capture
// ../runs/gate4/capture_20261016_run4full replays with no difference on every row of M15 and H4
// (row 0 is Pine's first bar). On H1 TradingView computed on bars before the first exported row,
// so the first rows cannot be replayed; only sensors differ there, and from 2025-10-15 05:00 every
// value matches, every engine row and every green start included.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateCell } from './gate4.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../runs/gate4/capture_20261016_run4full');
const dir = mkdtempSync(join(tmpdir(), 'gate4full-'));
const sums = new Map(readFileSync(join(src, 'SHA256SUMS'), 'utf8').trim().split(/\r?\n/).map((l) => { const [h, f] = l.split(/\s+/); return [f, h]; }));
for (const f of readdirSync(src).filter((x) => x.endsWith('.json.gz'))) {
  const buf = gunzipSync(readFileSync(join(src, f)));
  const name = f.slice(0, -3);
  assert.equal(createHash('sha256').update(buf).digest('hex'), sums.get(name), name);
  writeFileSync(join(dir, name), buf);
}

const EXPECT_STARTS = { 15: { A: 162, B: 30, C: 27 }, 60: { A: 272, B: 56, C: 47 }, 240: { A: 458, B: 95, C: 87 } };
for (const res of ['15', '60', '240']) for (const v of ['A', 'B', 'C']) {
  test(`gate 4 run 4 ${res} ${v}`, () => {
    const o = gateCell(dir, res, v);
    assert.equal(o.variant, 'full');
    assert.ok(o.starts.equal);
    assert.equal(o.starts.pine, EXPECT_STARTS[res][v]);
    assert.equal(o.chartBarsDiffering, 0);
    if (res === '60') {
      assert.equal(o.firstRowIsFirstComputedBar, false);
      assert.equal(o.agreeFrom.t, '2025-10-15T05:00:00.000Z');
      assert.ok(o.agreeFrom.beforeEngineStart);
      assert.ok(Object.values(o.fields).every((f) => f.layer === 1 || f.mismatched === 0));
    } else {
      assert.ok(o.firstRowIsFirstComputedBar);
      assert.equal(o.mismatched, 0, JSON.stringify(o.firstDifferenceByLayer));
      assert.ok(o.pass);
    }
  });
}
