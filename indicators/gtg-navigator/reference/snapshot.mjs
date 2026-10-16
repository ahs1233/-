// Canonical snapshot of the Zone Engine at one confirmed bar, with explicit
// equivalence levels, a field-by-field comparison under declared tolerances, and an
// auxiliary hash (review item R1).
//
// Levels:
//   geometry — per slot: active, side, containing, lo, hi
//   identity — geometry + primaryKey, sorted lastKeys, sorted entryKeys, gateQ, displayQ
//   state    — identity + every pool record (sorted by key, with its source identity)
//              + DOZ swing trackers + the OHLC ring (age 0 = newest). Together with the
//              slots this is every persistent engine variable a later decision reads
//              (inventory in validation/PINE_JS_PARITY.md §7).
//   events   — the seven engine events (Pine adds the ten alert conditions)
//
// The snapshot contains no absolute bar index: chart-bar fields are stored as ages
// relative to the snapshot bar. Equality is decided by compareSnapshots on raw
// fields. The hash is auxiliary: different hashes prove a difference, equal hashes
// prove nothing.
import { requireMintick } from './engine.mjs';

export const SLOT_NAMES = Object.freeze(['R1', 'R2', 'S1', 'S2']);
export const LEVELS = Object.freeze(['geometry', 'identity', 'state', 'events']);
export const EVENT_NAMES = Object.freeze(['breakingUp', 'breakingDn', 'acceptedUp', 'acceptedDn', 'rejectR', 'rejectS', 'flipConfirmed']);

// Declared tolerances (see validation/PINE_JS_PARITY.md §2).
export const priceTol = (price, mintick) => Math.abs(price) * 1e-9 + mintick * 1e-6;
export const QTY_TOL = 1e-9;

const sortedKeys = (keys) => [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const since = (bi, x) => (x == null ? null : bi - x);

export function snapshotSlot(name, s) {
  if (!s.active) return { name, active: false };
  return {
    name, active: true, containing: !!s.containing, side: s.side, lo: s.lo, hi: s.hi,
    primaryKey: s.primaryKey, lastKeys: sortedKeys(s.lastKeys), entryKeys: sortedKeys(s.entryKeys),
    gateQ: s.gateQ, displayQ: s.quality,
  };
}

// birthNativeBar is omitted (absolute index; ageNative is its relative form) and
// birthAtr is omitted (written at admission, never read afterwards).
export function snapshotLevel(lv, bi) {
  return {
    key: lv.key, source: lv.source, tfRank: lv.tfRank, typ: lv.typ, birthTime: lv.birthTime, price: lv.price,
    state: lv.state, polarity: lv.polarity, lo: lv.lo, hi: lv.hi, s: lv.s,
    mitigation: lv.mitigation, evidence: lv.evidence, tests: lv.tests, ageNative: lv.ageNative,
    epActive: !!lv.epActive, epSide: lv.epSide, epMaxDepth: lv.epMaxDepth,
    breakDir: lv.breakDir, breakCloses: lv.breakCloses, breakFromFlip: !!lv.breakFromFlip, backCloses: lv.backCloses,
    sinceTest: since(bi, lv.lastTestChartBar), sinceState: since(bi, lv.stateChartBar), sinceBack: since(bi, lv.backStartChartBar),
    navArmed: !!lv.navArmed,
  };
}

const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
const snapshotTracker = (t, bi) => (t.px == null ? { has: false } : { has: true, px: t.px, since: since(bi, t.bar), broken: !!t.broken });

// engine: reference Engine after step(bi); result: the object step(bi) returned.
// obstacleLatch: the consumer's Strong Obstacle latch { state, keys } after this bar, or
// null when the consumer layer is not modelled (JS engine-only runs).
export function canonicalSnapshot(engine, result, bi, meta, obstacleLatch = null) {
  const mintick = requireMintick(engine.P);
  return {
    meta: { symbol: meta?.symbol ?? null, timeframe: meta?.timeframe ?? null, mintick, time: engine.bars[bi].t },
    slots: engine.slots.map((s, i) => snapshotSlot(SLOT_NAMES[i], s)),
    levels: engine.allLevels().map((lv) => snapshotLevel(lv, bi)).sort(byKey),
    trackers: { high: snapshotTracker(engine.lastSwingHigh, bi), low: snapshotTracker(engine.lastSwingLow, bi) },
    ring: engine.ring.map((r) => ({ o: r.o, h: r.h, l: r.l, c: r.c })), // index = age, 0 = newest
    obstacle: obstacleLatch ? { state: !!obstacleLatch.state, keys: sortedKeys(obstacleLatch.keys) } : null,
    events: Object.fromEntries(EVENT_NAMES.map((k) => [k, !!result.events[k]])),
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

const ticksOf = (x, mintick) => Math.round(x / mintick);

function cmpPrice(path, a, b, mintick, out) {
  if (a == null || b == null) { if (a !== b) out.push({ path, kind: 'exact', a, b }); return; }
  if (Math.abs(a - b) > Math.max(priceTol(a, mintick), priceTol(b, mintick))) out.push({ path, kind: 'raw', a, b });
  if (ticksOf(a, mintick) !== ticksOf(b, mintick)) out.push({ path, kind: 'ticks', a: ticksOf(a, mintick), b: ticksOf(b, mintick) });
}
function cmpQty(path, a, b, out) {
  if (a == null || b == null) { if (a !== b) out.push({ path, kind: 'exact', a, b }); return; }
  if (Math.abs(a - b) > QTY_TOL) out.push({ path, kind: 'raw', a, b });
}
function cmpExact(path, a, b, out) {
  if (a !== b) out.push({ path, kind: 'exact', a, b });
}
function cmpKeys(path, a, b, out) {
  if (a.length !== b.length || a.some((k, i) => k !== b[i])) out.push({ path, kind: 'exact', a: a.join(','), b: b.join(',') });
}

const LEVEL_PRICE = ['lo', 'hi', 'price'];
const LEVEL_QTY = ['s', 'mitigation', 'evidence', 'epMaxDepth'];
const LEVEL_EXACT = ['navArmed', 'source', 'tfRank', 'typ', 'birthTime', 'state', 'polarity', 'tests', 'ageNative', 'epActive', 'epSide', 'breakDir', 'breakCloses', 'breakFromFlip', 'backCloses', 'sinceTest', 'sinceState', 'sinceBack'];

// Returns the list of differences at the requested levels (empty list = equal).
export function compareSnapshots(a, b, levels = ['state', 'events']) {
  const want = new Set(levels);
  if (want.has('state')) want.add('identity');
  if (want.has('identity')) want.add('geometry');
  const out = [];
  cmpExact('meta.time', a.meta.time, b.meta.time, out);
  cmpExact('meta.mintick', a.meta.mintick, b.meta.mintick, out);
  cmpExact('meta.symbol', a.meta.symbol, b.meta.symbol, out);
  cmpExact('meta.timeframe', a.meta.timeframe, b.meta.timeframe, out);
  const mintick = a.meta.mintick;
  if (want.has('geometry')) {
    for (let i = 0; i < 4; i++) {
      const x = a.slots[i], y = b.slots[i], p = `slots.${SLOT_NAMES[i]}`;
      cmpExact(`${p}.active`, x.active, y.active, out);
      if (!x.active || !y.active) continue;
      cmpExact(`${p}.side`, x.side, y.side, out);
      cmpExact(`${p}.containing`, x.containing, y.containing, out);
      cmpPrice(`${p}.lo`, x.lo, y.lo, mintick, out);
      cmpPrice(`${p}.hi`, x.hi, y.hi, mintick, out);
      if (want.has('identity')) {
        cmpExact(`${p}.primaryKey`, x.primaryKey, y.primaryKey, out);
        cmpKeys(`${p}.lastKeys`, x.lastKeys, y.lastKeys, out);
        cmpKeys(`${p}.entryKeys`, x.entryKeys, y.entryKeys, out);
        cmpQty(`${p}.gateQ`, x.gateQ, y.gateQ, out);
        cmpQty(`${p}.displayQ`, x.displayQ, y.displayQ, out);
      }
    }
  }
  if (want.has('state')) {
    // Group by key so that a repeated key (itself an invariant violation) can never be
    // hidden: record counts per key must match before records are compared pairwise.
    const group = (levels) => {
      const g = new Map();
      for (const l of levels) { if (!g.has(l.key)) g.set(l.key, []); g.get(l.key).push(l); }
      for (const v of g.values()) v.sort((x, y) => { const sx = JSON.stringify(x), sy = JSON.stringify(y); return sx < sy ? -1 : sx > sy ? 1 : 0; });
      return g;
    };
    if (a.levels.length !== b.levels.length) out.push({ path: 'levels.length', kind: 'exact', a: a.levels.length, b: b.levels.length });
    const ga = group(a.levels), gb = group(b.levels);
    const allKeys = [...new Set([...ga.keys(), ...gb.keys()])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    for (const k of allKeys) {
      const xa = ga.get(k) ?? [], xb = gb.get(k) ?? [];
      if (xa.length === 0 || xb.length === 0) { out.push({ path: `levels.${k}`, kind: 'missing', a: xa.length ? 'present' : 'absent', b: xb.length ? 'present' : 'absent' }); continue; }
      if (xa.length !== xb.length) { out.push({ path: `levels.${k}`, kind: 'multiplicity', a: xa.length, b: xb.length }); continue; }
      for (let r = 0; r < xa.length; r++) {
        const la = xa[r], lb = xb[r], p = xa.length > 1 ? `levels.${k}#${r}` : `levels.${k}`;
        for (const f of LEVEL_PRICE) cmpPrice(`${p}.${f}`, la[f], lb[f], mintick, out);
        for (const f of LEVEL_QTY) cmpQty(`${p}.${f}`, la[f], lb[f], out);
        for (const f of LEVEL_EXACT) cmpExact(`${p}.${f}`, la[f], lb[f], out);
      }
    }
    for (const side of ['high', 'low']) {
      const x = a.trackers[side], y = b.trackers[side], p = `trackers.${side}`;
      cmpExact(`${p}.has`, x.has, y.has, out);
      if (x.has && y.has) { cmpPrice(`${p}.px`, x.px, y.px, mintick, out); cmpExact(`${p}.since`, x.since, y.since, out); cmpExact(`${p}.broken`, x.broken, y.broken, out); }
    }
    const ra = a.ring ?? [], rb = b.ring ?? [];
    cmpExact('ring.length', ra.length, rb.length, out);
    for (let k = 0; k < Math.min(ra.length, rb.length); k++) for (const f of ['o', 'h', 'l', 'c']) cmpPrice(`ring.${k}.${f}`, ra[k][f], rb[k][f], mintick, out);
    const oa = a.obstacle ?? null, ob = b.obstacle ?? null;
    if ((oa === null) !== (ob === null)) out.push({ path: 'obstacle', kind: 'exact', a: oa ? 'latch' : 'not modelled', b: ob ? 'latch' : 'not modelled' });
    else if (oa) { cmpExact('obstacle.state', oa.state, ob.state, out); cmpKeys('obstacle.keys', oa.keys, ob.keys, out); }
  }
  if (want.has('events')) {
    for (const k of Object.keys({ ...a.events, ...b.events })) cmpExact(`events.${k}`, !!a.events[k], !!b.events[k], out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Auxiliary hash — the same integer encoding and arithmetic as Pine (section 12a)
// ---------------------------------------------------------------------------

// Pine evaluates this integer arithmetic in float64 (E20, measured on a real capture: the
// exact BigInt version disagreed on all 60 bars; this version reproduces Pine's values).
// r * r reaches ~4.6e18 > 2^53, so the product is rounded exactly as Pine rounds it.
// Keep the operator order of Pine section 12a: ((r * r) % P) * 3.
export const HASH_P = 2147483647; // 2^31 − 1 (prime)
const HASH_B = 1000003;
const HASH_K = 131071;

function hashMix(x) {
  const r = ((x % HASH_P) + HASH_P) % HASH_P;
  return (r * r % HASH_P * 3 + r * HASH_K + 1) % HASH_P;
}
const hashStep = (h, x) => (h * HASH_B + hashMix(x)) % HASH_P;
const q100 = (x) => Math.round(x * 100);
const q6 = (x) => Math.round(x * 1e6);
const b01 = (x) => (x ? 1 : 0);
const orNeg = (x) => (x == null ? -1 : x);

// Integer encodings (documented in PINE_JS_PARITY.md §7). Pine must emit the same.
export function encodeSlots(snap) {
  const t = snap.meta.mintick;
  const e = [1];
  for (const s of snap.slots) {
    if (!s.active) { e.push(0); continue; }
    e.push(1, b01(s.containing), s.side, Math.round(s.lo / t), Math.round(s.hi / t), s.primaryKey, q100(s.gateQ), q100(s.displayQ));
    e.push(s.lastKeys.length, ...s.lastKeys, s.entryKeys.length, ...s.entryKeys);
  }
  return e;
}

export function encodeState(snap) {
  const t = snap.meta.mintick;
  const e = [2, snap.levels.length];
  for (const l of snap.levels) {
    e.push(l.key, l.source, l.tfRank, l.typ, l.birthTime, Math.round(l.price / t), l.state, l.polarity, Math.round(l.lo / t), Math.round(l.hi / t), q6(l.s), q6(l.mitigation), q6(l.evidence),
      l.tests, l.ageNative, b01(l.epActive), l.epSide, q6(l.epMaxDepth), l.breakDir, l.breakCloses, b01(l.breakFromFlip),
      l.backCloses, orNeg(l.sinceTest), orNeg(l.sinceState), orNeg(l.sinceBack), b01(l.navArmed));
  }
  for (const side of ['high', 'low']) {
    const k = snap.trackers[side];
    if (k.has) e.push(1, Math.round(k.px / t), k.since, b01(k.broken)); else e.push(0);
  }
  const ring = snap.ring ?? [];
  e.push(ring.length);
  for (const r of ring) e.push(Math.round(r.o / t), Math.round(r.h / t), Math.round(r.l / t), Math.round(r.c / t));
  const o = snap.obstacle ?? null;
  if (o === null) e.push(-1); else e.push(b01(o.state), o.keys.length, ...o.keys);
  return e;
}

export function hashInts(ints) {
  let h = 0;
  for (const x of ints) h = hashStep(h, x);
  return h;
}

export const hashSlots = (snap) => hashInts(encodeSlots(snap));
export const hashState = (snap) => hashInts(encodeState(snap));
export const eventBits = (snap) => EVENT_NAMES.reduce((acc, k, i) => acc + (snap.events[k] ? 2 ** i : 0), 0);
