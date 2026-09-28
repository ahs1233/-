// Canonical snapshot of the Zone Engine at one confirmed bar, with explicit
// equivalence levels, a field-by-field comparison under declared tolerances, and an
// auxiliary hash (review item R1).
//
// Levels:
//   geometry — per slot: active, side, containing, lo, hi
//   identity — geometry + primaryKey, sorted lastKeys, sorted entryKeys, gateQ, displayQ
//   state    — identity + every pool record (sorted by key) + DOZ swing trackers
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

export function snapshotLevel(lv, bi) {
  return {
    key: lv.key, state: lv.state, polarity: lv.polarity, lo: lv.lo, hi: lv.hi, s: lv.s,
    mitigation: lv.mitigation, evidence: lv.evidence, tests: lv.tests, ageNative: lv.ageNative,
    epActive: !!lv.epActive, epSide: lv.epSide, epMaxDepth: lv.epMaxDepth,
    breakDir: lv.breakDir, breakCloses: lv.breakCloses, breakFromFlip: !!lv.breakFromFlip, backCloses: lv.backCloses,
    sinceTest: since(bi, lv.lastTestChartBar), sinceState: since(bi, lv.stateChartBar), sinceBack: since(bi, lv.backStartChartBar),
  };
}

const snapshotTracker = (t, bi) => (t.px == null ? { has: false } : { has: true, px: t.px, since: since(bi, t.bar), broken: !!t.broken });

// engine: reference Engine after step(bi); result: the object step(bi) returned.
export function canonicalSnapshot(engine, result, bi, meta) {
  const mintick = requireMintick(engine.P);
  return {
    meta: { symbol: meta?.symbol ?? null, timeframe: meta?.timeframe ?? null, mintick, time: engine.bars[bi].t },
    slots: engine.slots.map((s, i) => snapshotSlot(SLOT_NAMES[i], s)),
    levels: engine.allLevels().map((lv) => snapshotLevel(lv, bi)).sort((a, b) => (a.key < b.key ? -1 : 1)),
    trackers: { high: snapshotTracker(engine.lastSwingHigh, bi), low: snapshotTracker(engine.lastSwingLow, bi) },
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

const LEVEL_PRICE = ['lo', 'hi'];
const LEVEL_QTY = ['s', 'mitigation', 'evidence', 'epMaxDepth'];
const LEVEL_EXACT = ['state', 'polarity', 'tests', 'ageNative', 'epActive', 'epSide', 'breakDir', 'breakCloses', 'breakFromFlip', 'backCloses', 'sinceTest', 'sinceState', 'sinceBack'];

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
    const mb = new Map(b.levels.map((l) => [l.key, l]));
    const ma = new Map(a.levels.map((l) => [l.key, l]));
    for (const la of a.levels) {
      const lb = mb.get(la.key);
      if (!lb) { out.push({ path: `levels.${la.key}`, kind: 'missing', a: 'present', b: 'absent' }); continue; }
      for (const f of LEVEL_PRICE) cmpPrice(`levels.${la.key}.${f}`, la[f], lb[f], mintick, out);
      for (const f of LEVEL_QTY) cmpQty(`levels.${la.key}.${f}`, la[f], lb[f], out);
      for (const f of LEVEL_EXACT) cmpExact(`levels.${la.key}.${f}`, la[f], lb[f], out);
    }
    for (const lb of b.levels) if (!ma.has(lb.key)) out.push({ path: `levels.${lb.key}`, kind: 'missing', a: 'absent', b: 'present' });
    for (const side of ['high', 'low']) {
      const x = a.trackers[side], y = b.trackers[side], p = `trackers.${side}`;
      cmpExact(`${p}.has`, x.has, y.has, out);
      if (x.has && y.has) { cmpPrice(`${p}.px`, x.px, y.px, mintick, out); cmpExact(`${p}.since`, x.since, y.since, out); cmpExact(`${p}.broken`, x.broken, y.broken, out); }
    }
  }
  if (want.has('events')) {
    for (const k of Object.keys({ ...a.events, ...b.events })) cmpExact(`events.${k}`, !!a.events[k], !!b.events[k], out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Auxiliary hash — the same integer encoding and arithmetic as Pine (section 12a)
// ---------------------------------------------------------------------------

export const HASH_P = 2147483647n; // 2^31 − 1 (prime)
const HASH_B = 1000003n;
const HASH_K = 131071n;

function hashMix(x) {
  const r = ((x % HASH_P) + HASH_P) % HASH_P;
  return (r * r % HASH_P * 3n + r * HASH_K + 1n) % HASH_P;
}
const hashStep = (h, x) => (h * HASH_B + hashMix(BigInt(x))) % HASH_P;
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

export function encodeLevels(snap) {
  const t = snap.meta.mintick;
  const e = [2, snap.levels.length];
  for (const l of snap.levels) {
    e.push(l.key, l.state, l.polarity, Math.round(l.lo / t), Math.round(l.hi / t), q6(l.s), q6(l.mitigation), q6(l.evidence),
      l.tests, l.ageNative, b01(l.epActive), l.epSide, q6(l.epMaxDepth), l.breakDir, l.breakCloses, b01(l.breakFromFlip),
      l.backCloses, orNeg(l.sinceTest), orNeg(l.sinceState), orNeg(l.sinceBack));
  }
  for (const side of ['high', 'low']) {
    const k = snap.trackers[side];
    if (k.has) e.push(1, Math.round(k.px / t), k.since, b01(k.broken)); else e.push(0);
  }
  return e;
}

export function hashInts(ints) {
  let h = 0n;
  for (const x of ints) h = hashStep(h, x);
  return Number(h);
}

export const hashSlots = (snap) => hashInts(encodeSlots(snap));
export const hashLevels = (snap) => hashInts(encodeLevels(snap));
export const eventBits = (snap) => EVENT_NAMES.reduce((acc, k, i) => acc + (snap.events[k] ? 2 ** i : 0), 0);
