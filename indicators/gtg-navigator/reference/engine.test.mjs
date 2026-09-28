// Reference tests for the v0.4.7 Zone Engine algorithms.
// Run: node --test indicators/gtg-navigator/reference/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, SRC, TF, TYP, ST, KEY_BASE, memberKeyOf, makeLevel, buildZones, selectSlots,
  emptySlot, runEpisode, levelQuality, computeSeries, engineWindowFor, Engine, syntheticBars, checkSelectionInvariants,
  feedKeysOf, syncAnchorPool, upsertAnchor, withSymbol,
} from './engine.mjs';

// Symbol metadata for the synthetic fixtures (XAUUSD-like tick).
const PM = withSymbol(DEFAULTS, { mintick: 0.01 });

const T0 = 1_700_000_000_000;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function lvl({ lo, hi, q, t, src = SRC.SWING, tf = TF.LOCAL, typ = TYP.HIGH, price, state = ST.ACTIVE, polarity }) {
  const l = makeLevel({ key: memberKeyOf(t, src, tf, typ), lo, hi, price, source: src, tfRank: tf, typ, birthTime: t, s: q, state, polarity });
  l.q = q;
  return l;
}

const signature = (built) => JSON.stringify({
  zones: built.zones.map((z) => [z.lo, z.hi, z.members.map((m) => m.key), z.gateQ, z.primary.key]),
  suppressed: built.suppressed.map((m) => m.key).sort((a, b) => a - b),
});

const baseCtx = { close: 100, atr: 1, atrA1: 2, atrA2: 6, a1Sec: 300, a2Sec: 900, ringC: [100] };

test('T0 memberKey: discriminator stays below KEY_BASE and keys are injective', () => {
  const seen = new Set();
  for (const src of [0, 1, 2]) for (const tf of [0, 1, 2]) for (const typ of [0, 1]) {
    const disc = src * 6 + tf * 2 + typ;
    assert.ok(disc >= 0 && disc < KEY_BASE);
    for (const t of [T0, T0 + 60_000]) {
      const k = memberKeyOf(t, src, tf, typ);
      assert.equal(Math.floor(k / KEY_BASE), t);
      assert.equal(k % KEY_BASE, disc);
      assert.ok(!seen.has(k));
      seen.add(k);
    }
  }
  assert.throws(() => memberKeyOf(T0, 5, 2, 1)); // disc = 35 ≥ 32
});

test('T1 candidate permutation: 150 permutations give the same zone map', () => {
  const rnd = rng(11);
  const levels = [];
  for (let i = 0; i < 28; i++) {
    const lo = 95 + Math.floor(rnd() * 40) * 0.25; // coarse grid → ties in lo on purpose
    const w = 0.1 + rnd() * 0.5;
    const tf = i % 7 === 0 ? TF.A2 : i % 5 === 0 ? TF.A1 : TF.LOCAL;
    levels.push(lvl({ lo, hi: lo + w, q: 40 + Math.floor(rnd() * 6) * 8, t: T0 + i * 60_000, tf, src: tf === TF.LOCAL ? (i % 3 === 0 ? SRC.DOZ : SRC.SWING) : SRC.ANCHOR, typ: i % 2 }));
  }
  const ref = buildZones(levels, baseCtx, PM);
  assert.deepEqual(ref.violations, []);
  const refSig = signature(ref);
  const prnd = rng(99);
  for (let p = 0; p < 150; p++) {
    const b = buildZones(shuffled(levels, prnd), baseCtx, PM);
    assert.deepEqual(b.violations, []);
    assert.equal(signature(b), refSig);
  }
});

test('T2 connected chain wider than maxWidth: one deterministic packing, invariants hold', () => {
  // mergeGap = 0.25, maxWidth = 1.0 (atr = 1). Chain gaps are 0.1, total width 1.9.
  const A = lvl({ lo: 0.0, hi: 0.4, q: 60, t: T0 + 1 });
  const B = lvl({ lo: 0.5, hi: 0.9, q: 80, t: T0 + 2 });
  const C = lvl({ lo: 1.0, hi: 1.4, q: 70, t: T0 + 3 });
  const D = lvl({ lo: 1.5, hi: 1.9, q: 50, t: T0 + 4 });
  const ctx = { ...baseCtx, close: 10 };
  const prnd = rng(5);
  let first = null;
  for (let p = 0; p < 120; p++) {
    const b = buildZones(shuffled([A, B, C, D], prnd), ctx, PM);
    assert.deepEqual(b.violations, []);
    const sig = signature(b);
    if (first === null) first = sig;
    assert.equal(sig, first);
    // Strongest seed B absorbs the stronger neighbour C; A and D would widen past 1.0
    // and lie within mergeGap of the zone, so they are suppressed (contribute zero).
    assert.equal(b.zones.length, 1);
    assert.equal(b.zones[0].lo, 0.5);
    assert.equal(b.zones[0].hi, 1.4);
    assert.deepEqual(b.zones[0].members.map((m) => m.key), [B.key, C.key]);
    assert.deepEqual(b.suppressed.map((m) => m.key).sort((x, y) => x - y), [A.key, D.key].sort((x, y) => x - y));
  }
});

test('T3 MTF duplicate: M1 swing + M15 pivot of the same event get one MTF bonus, not two bonuses', () => {
  const a2Open = T0; // M15 bar open
  const swing = lvl({ lo: 99.8, hi: 100.0, price: 100.0, q: 60, t: a2Open + 7 * 60_000, tf: TF.LOCAL, src: SRC.SWING });
  const anchor = lvl({ lo: 99.7, hi: 100.05, price: 100.05, q: 70, t: a2Open, tf: TF.A2, src: SRC.ANCHOR });
  const ctx = { ...baseCtx, close: 90 };
  const dup = buildZones([swing, anchor], ctx, PM);
  assert.equal(dup.zones.length, 1);
  assert.equal(dup.zones[0].groups, 1);
  assert.equal(dup.zones[0].gateQ, 70 + 8); // best q + MTF bonus, no confluence bonus
  // Same prices but a different event (swing two hours later): two groups → confluence, no MTF bonus.
  const other = lvl({ lo: 99.8, hi: 100.0, price: 100.0, q: 60, t: a2Open + 120 * 60_000, tf: TF.LOCAL, src: SRC.SWING });
  const distinct = buildZones([other, anchor], ctx, PM);
  assert.equal(distinct.zones[0].groups, 2);
  assert.equal(distinct.zones[0].gateQ, 70 + 6);
  assert.notEqual(dup.zones[0].gateQ, 70 + 8 + 6);
});

test('T4 nearer obstacle: horizon opened by A2 reveals the nearer local zone first', () => {
  const P = withSymbol({ ...DEFAULTS, kLocal: 6 }, { mintick: 0.01 });
  const local = lvl({ lo: 107.0, hi: 107.3, q: 70, t: T0 + 1, tf: TF.LOCAL });
  const a2 = lvl({ lo: 110.0, hi: 110.3, price: 110.3, q: 78, t: T0 + 2, tf: TF.A2, src: SRC.ANCHOR });
  const ctx = { ...baseCtx, close: 100, atr: 1, atrA2: 6 }; // reach(A2) = 2.5 × 6 = 15
  const built = buildZones([local, a2], ctx, P);
  const sel = selectSlots(built.zones, [emptySlot(), emptySlot(), emptySlot(), emptySlot()], ctx, P);
  assert.deepEqual(sel.violations, []);
  const r1 = built.zones[sel.pick[0]];
  const r2 = built.zones[sel.pick[1]];
  assert.equal(r1.lo, 107.0);
  assert.equal(r2.lo, 110.0);
  // The invariant checker itself catches a selection that skips the nearer obstacle.
  const bad = [];
  checkSelectionInvariants(built.zones, [sel.pick[1], -1, -1, -1], ctx.close, sel.rEffUp, sel.rEffDn, 0, bad);
  assert.ok(bad.includes('I11_SKIP_UP'));
  // Without the A2 zone the horizon stays at H_local = 6 and the local zone at 7 is not shown.
  const alone = buildZones([local], ctx, P);
  const sel2 = selectSlots(alone.zones, [emptySlot(), emptySlot(), emptySlot(), emptySlot()], ctx, P);
  assert.equal(sel2.pick[0], -1);
});

test('T5 identity expiry: Q_stay privilege needs a live entry member', () => {
  const k1 = lvl({ lo: 101, hi: 101.3, q: 50, t: T0 + 1 });
  const k2 = lvl({ lo: 101.1, hi: 101.35, q: 50, t: T0 + 2 });
  const ctx = { ...baseCtx, close: 100 };
  const slotWith = (keys) => ({ ...emptySlot(), active: true, lo: 101, hi: 101.35, entryKeys: keys, lastKeys: keys });
  // q = 50 is between Q_stay (45) and Q_enter (55).
  const withEntry = buildZones([k1, k2], ctx, PM);
  const s1 = selectSlots(withEntry.zones, [slotWith([k1.key]), emptySlot(), emptySlot(), emptySlot()], ctx);
  assert.equal(s1.pick[0], 0);
  assert.deepEqual(s1.next[0].entryKeys, [k1.key]); // carried = old entry keys ∩ live members
  // k1 died: the zone still exists (k2) but has lost its privilege.
  const withoutEntry = buildZones([k2], ctx, PM);
  const s2 = selectSlots(withoutEntry.zones, [slotWith([k1.key]), emptySlot(), emptySlot(), emptySlot()], ctx);
  assert.equal(s2.pick[0], -1);
  // A new entry through Q_enter resets the entry keys to the current members.
  const strong = lvl({ lo: 101.1, hi: 101.35, q: 60, t: T0 + 3 });
  const s3 = selectSlots(buildZones([strong], ctx, PM).zones, [slotWith([k1.key]), emptySlot(), emptySlot(), emptySlot()], ctx);
  assert.deepEqual(s3.next[0].entryKeys, [strong.key]);
});

test('T6 mitigation: deep penetration + weak rejection consumes more than + strong rejection', () => {
  const mk = () => { const l = makeLevel({ key: 1, lo: 100, hi: 101, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: T0, s: 70, lastTestChartBar: 0 }); return l; };
  const weak = mk();
  const strong = mk();
  // Approach from below (prev close 99.5), wick to the far edge (depth 1).
  runEpisode(weak, 101.0, 99.8, 99.95, 99.5, 1.0, 10, PM);   // closes 0.05 below lo → rej 0.05
  runEpisode(strong, 101.0, 98.7, 98.8, 99.5, 1.0, 10, PM);  // closes 1.2 below lo → rej 1.0
  assert.ok(weak.mitigation > strong.mitigation);
  assert.ok(Math.abs(weak.mitigation - 0.6 * 1 * 0.95) < 1e-12);
  assert.equal(strong.mitigation, 0);
  assert.ok(strong.evidence > weak.evidence);
  assert.equal(weak.tests, 1);
  assert.equal(strong.tests, 1);
  assert.ok(levelQuality({ ...weak, q: 0 }) < levelQuality({ ...strong, q: 0 }));
});

// Closed-bar HTF feed (lookahead_on + [1] semantics): at chart bar i inside HTF bar j,
// the feed reports HTF bar j − 1: last three confirmed pivots, finite ATR, bar index.
function htfFeedFactory(bars, factor, tfRank, plen = 3, atrLen = 20) {
  const htf = [];
  for (let i = 0; i < bars.length; i += factor) {
    const seg = bars.slice(i, i + factor);
    if (seg.length < factor) break;
    htf.push({ t: seg[0].t, o: seg[0].o, h: Math.max(...seg.map((b) => b.h)), l: Math.min(...seg.map((b) => b.l)), c: seg[seg.length - 1].c });
  }
  const tr = htf.map((b, j) => (j === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - htf[j - 1].c), Math.abs(b.l - htf[j - 1].c))));
  const atr = htf.map((_, j) => (j >= atrLen - 1 ? tr.slice(j - atrLen + 1, j + 1).reduce((a, b) => a + b, 0) / atrLen : null));
  const highs = [], lows = []; // confirmed pivots with confirmation index
  for (let j = 2 * plen; j < htf.length; j++) {
    const p = j - plen;
    let isH = true, isL = true;
    for (let k = 1; k <= plen; k++) {
      if (!(htf[p].h >= htf[p - k].h && htf[p].h > htf[p + k].h)) isH = false;
      if (!(htf[p].l <= htf[p - k].l && htf[p].l < htf[p + k].l)) isL = false;
    }
    if (isH) highs.push({ conf: j, price: htf[p].h, nb: p, bt: htf[p].t });
    if (isL) lows.push({ conf: j, price: htf[p].l, nb: p, bt: htf[p].t });
  }
  return (i) => {
    const j = Math.floor(i / factor) - 1; // last closed HTF bar
    if (j < 0 || j >= htf.length) return { now: null, atr: null, items: [] };
    const hs = highs.filter((x) => x.conf <= j).slice(-3);
    const ls = lows.filter((x) => x.conf <= j).slice(-3);
    const items = [...hs.map((x) => ({ ...x, typ: TYP.HIGH, tfRank })), ...ls.map((x) => ({ ...x, typ: TYP.LOW, tfRank }))];
    return { now: j, atr: atr[j], items };
  };
}

function signatureSlots(slots) {
  return JSON.stringify(slots.map((s) => (s.active ? [s.lo, s.hi, s.side, s.entryKeys, s.lastKeys] : null)));
}

test('T7 reload determinism: same trailing W bars → same map (local + DOZ + A1/A2 anchors)', () => {
  const P = PM;
  const bars = syntheticBars(8000, 21);
  const series = computeSeries(bars, P);
  const f1 = htfFeedFactory(bars, 5, TF.A1);
  const f2 = htfFeedFactory(bars, 15, TF.A2);
  const anchorFeed = (i) => {
    const a = f1(i), b = f2(i);
    return { now: [null, a.now, b.now], atrA1: a.atr, atrA2: b.atr, items: [...a.items, ...b.items] };
  };
  const W = engineWindowFor(P, 60, 300, 900);
  const startB = 2600;
  const A = new Engine(bars, series, P, { startBar: 0, anchorFeed });
  const B = new Engine(bars, series, P, { startBar: startB, anchorFeed });
  let compared = 0, mismatches = 0, withZones = 0, dozSeen = 0, anchorSeen = 0, suppressed = 0;
  for (let i = 0; i < bars.length; i++) {
    A.step(i);
    B.step(i);
    if (A.local.some((l) => l.source === SRC.DOZ)) dozSeen++;
    if (A.anchorsA1.length + A.anchorsA2.length > 0) anchorSeen++;
    if (i >= startB + W) {
      compared++;
      if (signatureSlots(A.slots) !== signatureSlots(B.slots) || signature({ zones: A.lastZones, suppressed: [] }) !== signature({ zones: B.lastZones, suppressed: [] })) mismatches++;
      if (A.slots.some((s) => s.active)) withZones++;
    }
  }
  suppressed = A.suppressedTotal;
  assert.ok(compared > 1000, `compared ${compared}`);
  assert.equal(mismatches, 0);
  assert.deepEqual(A.violations, []);
  assert.deepEqual(B.violations, []);
  // Sanity: the run actually exercised slots, DOZ and anchors.
  assert.ok(withZones > compared * 0.5, `bars with an active slot: ${withZones}/${compared}`);
  assert.ok(dozSeen > 0, 'no DOZ was ever admitted');
  assert.ok(anchorSeen > 0, 'no anchor was ever admitted');
  test.diagnostic?.(`W=${W} compared=${compared} withZones=${withZones} suppressedTotal=${suppressed}`);
});

test('T7b a start inside the window can differ, which is why W is required', () => {
  const P = PM;
  const bars = syntheticBars(5000, 21);
  const series = computeSeries(bars, P);
  const A = new Engine(bars, series, P, { startBar: 0 });
  const B = new Engine(bars, series, P, { startBar: 3000 });
  let early = 0, diff = 0;
  for (let i = 0; i < bars.length; i++) {
    A.step(i); B.step(i);
    if (i >= 3000 && i < 3100) { early++; if (signatureSlots(A.slots) !== signatureSlots(B.slots)) diff++; }
  }
  assert.ok(early === 100);
  assert.ok(diff > 0, 'expected divergence immediately after a late start (warm-up is real)');
});

test('T8 anchor lifecycle follows the feed: no live eviction, tombstones only while in feed', () => {
  const P = PM;
  const a2Item = { price: 105, nb: 100, bt: T0, typ: TYP.HIGH, tfRank: TF.A2 };
  const poolA2 = [];
  const poolA1 = [];
  upsertAnchor(poolA2, a2Item, 110, 6, 1, 0, P);
  const record = poolA2[0];
  record.mitigation = 0.4; record.tests = 3;
  // A1 churns out many new pivots; A2's record is untouched (separate pools, no capacity race).
  for (let c = 0; c < 50; c++) {
    const items = [0, 1, 2].map((k) => ({ price: 100 + c + k, nb: 1000 + 3 * c + k, bt: T0 + (c * 3 + k + 1) * 300_000, typ: TYP.LOW, tfRank: TF.A1 }));
    syncAnchorPool(poolA1, feedKeysOf(items), true, P);
    for (const it of items) upsertAnchor(poolA1, it, 1000 + 3 * c + 3, 2, 1, c, P);
    assert.ok(poolA1.length <= P.ANCHOR_FEED_MAX);
    syncAnchorPool(poolA2, feedKeysOf([a2Item]), true, P);
    upsertAnchor(poolA2, a2Item, 110, 6, 1, c, P);
    assert.equal(poolA2.length, 1);
    assert.equal(poolA2[0], record); // same object: state preserved
  }
  assert.equal(record.tests, 3);
  // A DEAD record still in the feed is a tombstone: not re-admitted fresh.
  record.state = ST.DEAD;
  syncAnchorPool(poolA2, feedKeysOf([a2Item]), true, P);
  upsertAnchor(poolA2, a2Item, 110, 6, 1, 60, P);
  assert.equal(poolA2.length, 1);
  assert.equal(poolA2[0].state, ST.DEAD);
  // Once the key leaves the feed the record is removed.
  syncAnchorPool(poolA2, feedKeysOf([]), true, P);
  assert.equal(poolA2.length, 0);
  // Feed unavailable (na): nothing is removed.
  upsertAnchor(poolA2, a2Item, 110, 6, 1, 70, P);
  syncAnchorPool(poolA2, [], false, P);
  assert.equal(poolA2.length, 1);
});

test('T9 zones with more than 6 members: privilege and last keys are never truncated', () => {
  const ctx = { ...baseCtx, close: 100, atr: 1 };
  // Eight overlapping members inside one zone; the 8th in precedes order is weakest.
  const members = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => lvl({ lo: 101 + i * 0.01, hi: 101.3 + i * 0.01, q: 70 - i, t: T0 + i * 60_000 }));
  const built = buildZones(members, ctx, PM);
  assert.equal(built.zones.length, 1);
  assert.equal(built.zones[0].members.length, 8);
  const sel = selectSlots(built.zones, [emptySlot(), emptySlot(), emptySlot(), emptySlot()], ctx);
  assert.equal(sel.next[0].lastKeys.length, 8);
  assert.equal(sel.next[0].entryKeys.length, 8);
  // Only the weakest (8th) entry member survives, with q between Q_stay and Q_enter.
  const survivor = members[7];
  survivor.q = 50; survivor.s = 50;
  const later = buildZones([survivor], ctx, PM);
  const sel2 = selectSlots(later.zones, sel.next, ctx);
  assert.equal(sel2.pick[0], 0); // privilege kept through the 8th key
  assert.deepEqual(sel2.next[0].entryKeys, [survivor.key]);
});
