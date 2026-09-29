// PG8 — the committed TradingView captures replay to PASS (Parity Gate evidence, 2026-09-29).
// Any change to the Measurement Engine that breaks parity with TradingView fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseTvCsv } from './tv-csv.mjs';
import { compareExport, compareCopyToFrozen, feedKeysFor, feedFromTvBars } from './compare.mjs';

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

// PG9 — MTF parity (message 18): feed mode, where JS computes the route HTF values and both
// anchors from the feed's own HTF bars; m_htf* are compared, not injected.
const mdir = (f) => fileURLToPath(new URL(`./captures/2026-09-29-mtf/${f}`, import.meta.url));
const msums = Object.fromEntries(readFileSync(mdir('SHA256SUMS'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/).reverse()));
const mload = (name) => {
  const raw = gunzipSync(readFileSync(mdir(`${name}.gz`)));
  assert.equal(createHash('sha256').update(raw).digest('hex'), msums[name], `${name} hash`);
  return raw.toString('utf8');
};
const feedFor = (tf) => Object.fromEntries([...new Set(Object.values(feedKeysFor(tf)))].map((res) => [res, feedFromTvBars(JSON.parse(mload(`bars_${res}.json`)))]));
const HTF_COLS = ['m_htfClose', 'm_htfMA50', 'm_htfMA200', 'm_htfMA50Past', 'm_htfATR'];

for (const [tf, extra, rows, copyOf, frozenOf, htfBasis] of [
  ['M1', 2003, 9306, () => load('copy_M1.csv'), () => load('frozen_M1.csv'), 'unique'],
  ['M5', 2001, 5976, () => load('copy_M5.csv'), () => load('frozen_M5.csv'), 'full-history'],
  ['M15', 2005, 5935, () => parseTvCsv(mload('copy_M15.csv')), () => parseTvCsv(mload('frozen_M15.csv')), 'full-history'],
  ['H1', 2006, 10311, () => parseTvCsv(mload('copy_H1.csv')), () => parseTvCsv(mload('frozen_H1.csv')), 'unique'],
  ['H4', 2007, 5792, () => parseTvCsv(mload('copy_H4.csv')), () => parseTvCsv(mload('frozen_H4.csv')), 'full-history'],
]) {
  test(`PG9 ${tf} MTF parity: route HTF + anchors from the feed's own bars, 0 mismatches`, () => {
    const copy = copyOf();
    const r = compareExport(copy, { tf, mintick: 0.001, studyExtraBars: extra, feed: feedFor(tf) });
    assert.equal(r.mode, 'feed');
    assert.equal(r.bars, rows);
    assert.equal(r.htfStart.basis, htfBasis);
    assert.equal(r.verdict, 'PASS', JSON.stringify(Object.fromEntries(Object.entries(r.runs.sma.fields).filter(([, f]) => f.mismatched))));
    assert.equal(r.emaSeed, 'sma');
    for (const c of HTF_COLS) assert.ok(r.runs.sma.fields[c]?.compared > 0.9 * rows, `${c} compared`);
    assert.ok(r.runs.sma.fields.v_hashSlots.compared > 0);
    assert.equal(compareCopyToFrozen(copy, frozenOf()).mismatched, 0);
  });
}
