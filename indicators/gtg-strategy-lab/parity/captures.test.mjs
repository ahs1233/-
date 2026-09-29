// PG8 — the committed TradingView captures replay to PASS (Parity Gate evidence, 2026-09-29).
// Any change to the Measurement Engine that breaks parity with TradingView fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseTvCsv } from './tv-csv.mjs';
import { compareExport, compareCopyToFrozen } from './compare.mjs';

const dir = (f) => fileURLToPath(new URL(`./captures/2026-09-29/${f}`, import.meta.url));
const sums = Object.fromEntries(readFileSync(dir('SHA256SUMS'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/).reverse()));
const load = (name) => {
  const raw = gunzipSync(readFileSync(dir(`${name}.gz`)));
  assert.equal(createHash('sha256').update(raw).digest('hex'), sums[name], `${name} hash`);
  return parseTvCsv(raw.toString('utf8'));
};

// OANDA:XAUUSD, syminfo.mintick 0.001; studyExtraBars as set on the chart for each capture.
for (const [tf, extra, rows] of [['M1', 2003, 9306], ['M5', 2001, 5976]]) {
  test(`PG8 ${tf} capture: replay PASS with 0 mismatches (seed sma) and copy = frozen`, () => {
    const copy = load(`copy_${tf}.csv`);
    const r = compareExport(copy, { tf, mintick: 0.001, studyExtraBars: extra });
    assert.equal(r.bars, rows);
    assert.equal(r.verdict, 'PASS', JSON.stringify(r.runs.sma.fields));
    assert.equal(r.emaSeed, 'sma');
    assert.equal(r.runs.sma.mismatched, 0);
    assert.equal(r.pineFirstEngineRow, r.jsStartBar);
    const f = compareCopyToFrozen(copy, load(`frozen_${tf}.csv`));
    assert.equal(f.verdict, 'PASS');
    assert.equal(f.mismatched, 0);
  });
}
