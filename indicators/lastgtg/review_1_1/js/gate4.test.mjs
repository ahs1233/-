// node --test indicators/lastgtg/review_1_1/js/gate4.test.mjs
// Gate 4 regression: the run-3 TradingView capture (../runs/gate4/capture_20261015_run3) replays
// with no difference on every row of M15, H1 and H4 for A, B and C.
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
const src = join(here, '../runs/gate4/capture_20261015_run3');
const dir = mkdtempSync(join(tmpdir(), 'gate4-'));
const sums = new Map(readFileSync(join(src, 'SHA256SUMS'), 'utf8').trim().split(/\r?\n/).map((l) => { const [h, f] = l.split(/\s+/); return [f, h]; }));
for (const f of readdirSync(src).filter((x) => x.endsWith('.json.gz'))) {
  const buf = gunzipSync(readFileSync(join(src, f)));
  const name = f.slice(0, -3);
  assert.equal(createHash('sha256').update(buf).digest('hex'), sums.get(name), name);
  writeFileSync(join(dir, name), buf);
}

const EXPECT_STARTS = { 15: { A: 162, B: 30, C: 27 }, 60: { A: 263, B: 50, C: 45 }, 240: { A: 235, B: 44, C: 38 } };
for (const res of ['15', '60', '240']) for (const v of ['A', 'B', 'C']) {
  test(`gate 4 ${res} ${v}: Pine = JS on every row`, () => {
    const o = gateCell(dir, res, v);
    assert.equal(o.mismatched, 0, JSON.stringify(o.firstDifferenceByLayer));
    assert.ok(o.starts.equal);
    assert.equal(o.starts.pine, EXPECT_STARTS[res][v]);
    assert.equal(o.htfStart.candidates, 1);
    assert.ok(o.htfStart.sameAsBarRule);
    assert.equal(o.chartBarsDiffering, 0);
    assert.ok(o.pass);
  });
}
