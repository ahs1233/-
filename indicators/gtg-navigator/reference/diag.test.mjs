// Rolling diagnostics: exact packing, decoder guards, and the rolling model against a
// brute-force oracle that recomputes every window from scratch.
// Run: node --test indicators/gtg-navigator/reference/diag.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAG_WIN, DIAG_BASE, INV_BASE, MASKS, LAYOUT, pack, unpack, packInv, decodeDiag, diagSeries, parseDiagTable, formatDiagTable } from './diag.mjs';

test('D1 exact round trip at the bounds (0 and 1000) and packed values stay below 2^53', () => {
  for (const fields of [[0, 0, 0, 0, 0], [1000, 1000, 1000, 1000, 1000], [1, 0, 1000, 7, 999], [1000, 0, 0, 0, 1]]) {
    const v = pack(fields);
    assert.ok(v <= Number.MAX_SAFE_INTEGER);
    assert.deepEqual(unpack(v, 5), fields);
  }
  const max = pack([1000, 1000, 1000, 1000, 1000]);
  assert.equal(max, 1000 * (1 + 1024 + 1024 ** 2 + 1024 ** 3 + 1024 ** 4));
  assert.ok(max < 2 ** 50);
  assert.deepEqual(unpack(pack([12, 34, 1000]), 3), [12, 34, 1000]);
});

test('D2 field order is part of the contract: a swapped layout decodes to different counts (negative control)', () => {
  const v = pack([110, 90, 70, 27, 131]);
  const d = decodeDiag({ EVT: v });
  assert.deepEqual([d.breakBars, d.acceptBars, d.rejectBars, d.flipBars, d.strongObstacleAlerts], [110, 90, 70, 27, 131]);
  const swapped = pack([90, 110, 70, 27, 131]);
  assert.notEqual(swapped, v);
  assert.notDeepEqual(unpack(swapped, 5), [110, 90, 70, 27, 131]);
  assert.deepEqual(Object.keys(LAYOUT), ['EVT', 'MISMATCH', 'CAUSAL', 'INV']);
});

test('D3 the decoder rejects values that cannot be exact reads', () => {
  assert.throws(() => unpack(1.5, 5), /exact/);
  assert.throws(() => unpack(pack([1001 - 1, 0, 0, 0, 0]) + 1, 5), /exceeds the window/); // field 0 = 1000 + 1
  assert.throws(() => unpack(DIAG_BASE ** 5, 5), /more than 5 fields/);
  assert.throws(() => pack([1024, 0]), /outside/);
});

// ---- rolling model vs brute force ------------------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randomRows(n, seed) {
  const r = rng(seed); const rows = []; let tot = 0, crit = 0;
  for (let i = 0; i < n; i++) {
    const engineStep = i >= 50;
    let ev = 0;
    if (engineStep) {
      if (r() < 0.10) ev |= r() < 0.5 ? 1 : 2;
      if (r() < 0.08) ev |= r() < 0.5 ? 4 : 8;
      if (r() < 0.07) ev |= 16;
      if (r() < 0.03) ev |= 64;
      if (r() < 0.12) ev |= 2048;
      // Alert bits normally mirror the engine bits; flip a few to create mismatches.
      if (ev & 3) ev |= 8192; if (ev & 12) ev |= 32768; if (ev & 48) ev |= 16384; if (ev & 64) ev |= 65536;
      if (r() < 0.01) ev ^= 8192;
      if (r() < 0.01) ev ^= 65536;
    }
    const obsState = engineStep ? (((ev & 2048) !== 0) !== (r() < 0.01) ? 8 : 0) + (r() < 0.5 ? 1 : 0) : 0;
    if (engineStep && r() < 0.005) { tot += 1 + Math.floor(r() * 3); if (r() < 0.5) crit += 1; }
    rows.push({ confirmed: i < n - 1 || seed % 2 === 0, engineStep, warmed: engineStep && i >= 300, eventBits: ev, obsState, violationsTotal: tot, violationsCritical: crit });
  }
  return rows;
}
// Oracle: recompute the window ending at confirmed row t directly from the rows.
function oracle(rows, t) {
  const idx = [];
  for (let i = t; i >= 0 && idx.length < DIAG_WIN; i--) if (rows[i].confirmed) idx.push(i);
  const c = new Array(13).fill(0);
  const engineHas = (i, m) => rows[i].engineStep && (rows[i].eventBits & m) !== 0;
  for (const i of idx) {
    const r = rows[i]; if (!r.warmed) continue;
    const ev = r.eventBits;
    const brk = engineHas(i, 3), acc = engineHas(i, 12), rej = engineHas(i, 48), flp = engineHas(i, 64);
    const fl = [brk, acc, rej, flp, (ev & 2048) !== 0, brk !== ((ev & 8192) !== 0), acc !== ((ev & 32768) !== 0), rej !== ((ev & 16384) !== 0), flp !== ((ev & 65536) !== 0), ((r.obsState & 8) !== 0) !== ((ev & 2048) !== 0),
      acc && ![0, 1, 2, 3].some((k) => i - k >= 0 && engineHas(i - k, 3)),
      flp && !Array.from({ length: 61 }, (_, k) => k).some((k) => i - k >= 0 && engineHas(i - k, 12)),
      true];
    fl.forEach((b, k) => { c[k] += b ? 1 : 0; });
  }
  // Oracle for invariants: the maximum of the cumulative counters over the window rows.
  const maxTot = Math.max(0, ...idx.map((i) => rows[i].violationsTotal));
  const maxCrit = Math.max(0, ...idx.map((i) => rows[i].violationsCritical));
  return { EVT: pack(c.slice(0, 5)), MISMATCH: pack(c.slice(5, 10)), CAUSAL: pack([c[10], c[11], c[12]]), INV: maxTot + maxCrit * INV_BASE };
}

test('D4 rolling model equals the brute-force oracle (random series, several end points)', () => {
  for (const seed of [3, 4]) {
    const rows = randomRows(2600, seed);
    const series = diagSeries(rows);
    const lastConfirmed = rows.map((r, i) => (r.confirmed ? i : -1)).filter((i) => i >= 0);
    for (const t of [lastConfirmed[400], lastConfirmed[999], lastConfirmed[1000], lastConfirmed[1777], lastConfirmed.at(-1)]) {
      assert.deepEqual(series[t], oracle(rows, t), `seed ${seed} row ${t}`);
    }
    const d = decodeDiag(series[lastConfirmed.at(-1)]);
    assert.ok(d.warmedConfirmedCount <= DIAG_WIN && d.breakBars > 0 && d.breakAlertMismatch > 0);
  }
});

test('D5 open bar: an unconfirmed row is never counted and its output is na', () => {
  const rows = randomRows(1200, 6).map((r) => ({ ...r, confirmed: true }));
  const before = diagSeries(rows).at(-1);
  const open = { ...rows.at(-1), confirmed: false, eventBits: 3 | 2048 | 8192, obsState: 8 };
  const withOpen = diagSeries([...rows, open]);
  assert.equal(withOpen.at(-1), null);
  assert.deepEqual(withOpen.at(-2), before);
});

test('D6 lookbacks match the analyzer: accept needs a break in [i−3, i]; flip needs an accept in [i−60, i]', () => {
  const base = (ev = 0) => ({ confirmed: true, engineStep: true, warmed: true, eventBits: ev, obsState: 0, violationsTotal: 0, violationsCritical: 0 });
  const seq = (gap, first, second) => [base(first), ...Array.from({ length: gap - 1 }, () => base()), base(second)];
  const causal = (rows) => decodeDiag(diagSeries(rows).at(-1));
  assert.equal(causal(seq(3, 1 | 8192, 4 | 32768)).acceptWithoutBreakWithin3Bars, 0);
  assert.equal(causal(seq(4, 1 | 8192, 4 | 32768)).acceptWithoutBreakWithin3Bars, 1);
  assert.equal(causal(seq(60, 4 | 32768, 64 | 65536)).flipWithoutAcceptedWithin60Bars, 0);
  assert.equal(causal(seq(61, 4 | 32768, 64 | 65536)).flipWithoutAcceptedWithin60Bars, 1);
});

test('D7 window edge and warm-up: an event 1000 confirmed bars back is outside; unwarmed bars never count', () => {
  const quiet = { confirmed: true, engineStep: true, warmed: true, eventBits: 0, obsState: 0, violationsTotal: 0, violationsCritical: 0 };
  const hit = { ...quiet, eventBits: 1 | 8192 };
  const inside = [hit, ...Array.from({ length: DIAG_WIN - 1 }, () => quiet)];
  assert.equal(decodeDiag(diagSeries(inside).at(-1)).breakBars, 1);
  const outside = [hit, ...Array.from({ length: DIAG_WIN }, () => quiet)];
  assert.equal(decodeDiag(diagSeries(outside).at(-1)).breakBars, 0);
  const cold = [{ ...hit, warmed: false }, ...Array.from({ length: 10 }, () => quiet)];
  const d = decodeDiag(diagSeries(cold).at(-1));
  assert.equal(d.breakBars, 0);
  assert.equal(d.warmedConfirmedCount, 10);
  assert.deepEqual(Object.values(MASKS), [3, 8192, 12, 32768, 48, 16384, 64, 65536, 2048, 8]);
});

test('D8 INV: cumulative maximum, exact base 2^26, overflow is na (not clamped), and the pre-window counterexample', () => {
  const M = INV_BASE - 1;
  for (const [t, c] of [[0, 0], [1, 0], [M, M], [5, 2]]) {
    const v = packInv(t, c);
    assert.ok(Number.isSafeInteger(v) && v < 2 ** 52);
    assert.deepEqual(decodeDiag({ INV: v }), { maxInvTotal1000: t, maxInvCritical1000: c });
  }
  assert.equal(packInv(M, M), 2 ** 52 - 1);
  // Overflow: no clamp, no modulo — the value is withheld (Pine plots na).
  assert.equal(packInv(INV_BASE, 0), null);
  assert.equal(packInv(0, INV_BASE), null);
  assert.equal(packInv(-1, 0), null);
  assert.throws(() => decodeDiag({ INV: 2 ** 52 }), /more than 2 fields/);
  // Counterexample (message 59): a violation before the window must still read as 1.
  const quiet = { confirmed: true, engineStep: true, warmed: true, eventBits: 0, obsState: 0 };
  const rows = [
    ...Array.from({ length: 10 }, () => ({ ...quiet, violationsTotal: 0, violationsCritical: 0 })),
    { ...quiet, violationsTotal: 1, violationsCritical: 1 },
    ...Array.from({ length: DIAG_WIN + 500 }, () => ({ ...quiet, violationsTotal: 1, violationsCritical: 1 })),
  ];
  const d = decodeDiag(diagSeries(rows).at(-1));
  assert.equal(d.maxInvTotal1000, 1);
  assert.equal(d.maxInvCritical1000, 1);
  // Negative control: the previous 'new violation bars in the window' metric reads 0 here.
  const windowRows = rows.slice(-DIAG_WIN);
  const newViolationBars = windowRows.filter((r, i) => r.violationsTotal > (i === 0 ? rows[rows.length - DIAG_WIN - 1].violationsTotal : windowRows[i - 1].violationsTotal)).length;
  assert.equal(newViolationBars, 0);
});

test('D9 table text: exact round trip, INV=na on overflow, and malformed cells are refused', () => {
  const v = { EVT: pack([110, 90, 70, 27, 131]), MISMATCH: 0, CAUSAL: pack([0, 0, 999]), INV: packInv(0, 0) };
  const text = formatDiagTable(1_790_000_000_000, v);
  assert.equal(text.split('\n')[0], 'GTGDIAG v1');
  const p = parseDiagTable(text);
  assert.deepEqual(p, { bar: 1_790_000_000_000, ...v });
  assert.deepEqual(parseDiagTable(text.replace(/\n/g, ' ')), p); // pasted on one line
  const d = decodeDiag(p);
  assert.equal(d.breakBars, 110);
  assert.equal(d.warmedConfirmedCount, 999);
  const over = parseDiagTable(formatDiagTable(1, { ...v, INV: packInv(INV_BASE, 0) }));
  assert.equal(over.INV, null);
  assert.throws(() => parseDiagTable('EVT=1'), /GTGDIAG/);
  assert.throws(() => parseDiagTable('GTGDIAG v1\nBAR=1\nEVT=1\nMISMATCH=0\nINV=0'), /CAUSAL/);
});

