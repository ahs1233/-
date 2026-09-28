// Text form of a canonical snapshot ("GTGSNAP v2"), as printed by the Pine
// diagnostic capture (log.info, section 18 of gtg_navigator_v0.4.7.pine) and by
// formatCapture below. parseCapture turns copied Pine Logs text back into
// snapshots for compareSnapshots. Lines may carry any prefix (the Pine Logs pane
// adds its own timestamp); everything before "GTGSNAP|" is ignored.
//
//   GTGSNAP|v2|<time>|META|<tickerid>|<timeframe>|<mintick>
//   GTGSNAP|v2|<time>|SLOT|<name>|0
//   GTGSNAP|v2|<time>|SLOT|<name>|1|<containing>|<side>|<lo>|<hi>|<primaryKey>|<gateQ>|<displayQ>|<lastKeys,>|<entryKeys,>
//   GTGSNAP|v2|<time>|LVL|<key>|<source>|<tfRank>|<typ>|<birthTime>|<price>|<state>|<polarity>|<lo>|<hi>|<s>|<mitigation>|<evidence>|<tests>|<ageNative>|<epActive>|<epSide>|<epMaxDepth>|<breakDir>|<breakCloses>|<breakFromFlip>|<backCloses>|<sinceTest>|<sinceState>|<sinceBack>
//   GTGSNAP|v2|<time>|TRK|<hasH>|<hPx>|<hSince>|<hBroken>|<hasL>|<lPx>|<lSince>|<lBroken>
//   GTGSNAP|v2|<time>|RING|<firstAge>|<ringSize>|<o,h,l,c;o,h,l,c;…>     (RING_CHUNK bars per line, age 0 = newest)
//   GTGSNAP|v2|<time>|EV|<engineBits>|<alertBits>
//   GTGSNAP|v2|<time>|END|<nLevels>|<hashSlots>|<hashState>
// Numbers: integers in full; floats with up to 10 decimals; na → "na"; booleans 1/0.
// A bar is complete only when META, four SLOT lines, TRK, every RING chunk, EV and
// END are present and the LVL count equals the one declared by END. A bar missing
// entirely cannot be seen by the parser: coverage is checked by compare-captures.
import { SLOT_NAMES, EVENT_NAMES, hashSlots, hashState, eventBits } from './snapshot.mjs';

export const CAPTURE_VERSION = 'v2';
export const RING_CHUNK = 16;

const f10 = (x) => (x == null ? 'na' : String(Number(x.toFixed(10))));
const iv = (x) => (x == null ? 'na' : String(x));
const bv = (x) => (x ? '1' : '0');
const num = (s) => (s === 'na' ? null : Number(s));
const keys = (s) => (s === '' ? [] : s.split(',').map(Number));

export function formatCapture(snap, alertBits = 0) {
  const pre = `GTGSNAP|${CAPTURE_VERSION}|${snap.meta.time}|`;
  const lines = [`${pre}META|${snap.meta.symbol ?? 'na'}|${snap.meta.timeframe ?? 'na'}|${f10(snap.meta.mintick)}`];
  for (const s of snap.slots) {
    if (!s.active) { lines.push(`${pre}SLOT|${s.name}|0`); continue; }
    lines.push(`${pre}SLOT|${s.name}|1|${bv(s.containing)}|${s.side}|${f10(s.lo)}|${f10(s.hi)}|${s.primaryKey}|${f10(s.gateQ)}|${f10(s.displayQ)}|${s.lastKeys.join(',')}|${s.entryKeys.join(',')}`);
  }
  for (const l of snap.levels) {
    lines.push(`${pre}LVL|${l.key}|${l.source}|${l.tfRank}|${l.typ}|${l.birthTime}|${f10(l.price)}|${l.state}|${l.polarity}|${f10(l.lo)}|${f10(l.hi)}|${f10(l.s)}|${f10(l.mitigation)}|${f10(l.evidence)}|${l.tests}|${l.ageNative}|${bv(l.epActive)}|${l.epSide}|${f10(l.epMaxDepth)}|${l.breakDir}|${l.breakCloses}|${bv(l.breakFromFlip)}|${l.backCloses}|${iv(l.sinceTest)}|${iv(l.sinceState)}|${iv(l.sinceBack)}`);
  }
  const tr = (k) => (k.has ? `1|${f10(k.px)}|${k.since}|${bv(k.broken)}` : '0|na|na|0');
  lines.push(`${pre}TRK|${tr(snap.trackers.high)}|${tr(snap.trackers.low)}`);
  const ring = snap.ring ?? [];
  for (let a = 0; a < ring.length; a += RING_CHUNK) {
    const part = ring.slice(a, a + RING_CHUNK).map((r) => [r.o, r.h, r.l, r.c].map(f10).join(',')).join(';');
    lines.push(`${pre}RING|${a}|${ring.length}|${part}`);
  }
  if (ring.length === 0) lines.push(`${pre}RING|0|0|`);
  lines.push(`${pre}EV|${eventBits(snap)}|${alertBits}`);
  lines.push(`${pre}END|${snap.levels.length}|${hashSlots(snap)}|${hashState(snap)}`);
  return lines.join('\n');
}

// Returns Map<time, { snapshot, alertBits, declared: { nLevels, hashSlots, hashState }, complete, problems }>.
export function parseCapture(text) {
  const byTime = new Map();
  const get = (t) => {
    if (!byTime.has(t)) byTime.set(t, { meta: null, slots: [], levels: [], trk: null, ring: new Map(), ringSize: null, ev: null, end: null, dup: [] });
    return byTime.get(t);
  };
  for (const raw of text.split(/\r?\n/)) {
    const at = raw.indexOf('GTGSNAP|');
    if (at < 0) continue;
    const f = raw.slice(at).trim().split('|');
    if (f[1] !== CAPTURE_VERSION) throw new Error(`unsupported capture version: ${f[1]} (expected ${CAPTURE_VERSION})`);
    const r = get(Number(f[2]));
    const kind = f[3], v = f.slice(4);
    if (kind === 'META') { if (r.meta) r.dup.push('META'); r.meta = { symbol: v[0] === 'na' ? null : v[0], timeframe: v[1] === 'na' ? null : v[1], mintick: num(v[2]) }; }
    else if (kind === 'SLOT') {
      r.slots.push(v[1] === '0' ? { name: v[0], active: false } : {
        name: v[0], active: true, containing: v[2] === '1', side: Number(v[3]), lo: num(v[4]), hi: num(v[5]), primaryKey: Number(v[6]),
        gateQ: num(v[7]), displayQ: num(v[8]), lastKeys: keys(v[9]), entryKeys: keys(v[10]),
      });
    } else if (kind === 'LVL') {
      r.levels.push({
        key: Number(v[0]), source: Number(v[1]), tfRank: Number(v[2]), typ: Number(v[3]), birthTime: Number(v[4]), price: num(v[5]),
        state: Number(v[6]), polarity: Number(v[7]), lo: num(v[8]), hi: num(v[9]), s: num(v[10]), mitigation: num(v[11]), evidence: num(v[12]),
        tests: Number(v[13]), ageNative: Number(v[14]), epActive: v[15] === '1', epSide: Number(v[16]), epMaxDepth: num(v[17]), breakDir: Number(v[18]),
        breakCloses: Number(v[19]), breakFromFlip: v[20] === '1', backCloses: Number(v[21]), sinceTest: num(v[22]), sinceState: num(v[23]), sinceBack: num(v[24]),
      });
    } else if (kind === 'TRK') {
      const t = (o) => (v[o] === '1' ? { has: true, px: num(v[o + 1]), since: num(v[o + 2]), broken: v[o + 3] === '1' } : { has: false });
      if (r.trk) r.dup.push('TRK');
      r.trk = { high: t(0), low: t(4) };
    } else if (kind === 'RING') {
      const first = Number(v[0]);
      if (r.ringSize != null && r.ringSize !== Number(v[1])) r.dup.push('RING size');
      r.ringSize = Number(v[1]);
      if (r.ring.has(first)) r.dup.push(`RING ${first}`);
      r.ring.set(first, v[2] === '' ? [] : v[2].split(';').map((q) => { const [o, h, l, c] = q.split(',').map(num); return { o, h, l, c }; }));
    } else if (kind === 'EV') { if (r.ev) r.dup.push('EV'); r.ev = { engineBits: Number(v[0]), alertBits: Number(v[1]) }; }
    else if (kind === 'END') { if (r.end) r.dup.push('END'); r.end = { nLevels: Number(v[0]), hashSlots: Number(v[1]), hashState: Number(v[2]) }; }
  }
  const out = new Map();
  for (const [time, r] of byTime) {
    const problems = [];
    if (!r.meta) problems.push('META missing');
    if (r.slots.length !== 4 || r.slots.some((s, i) => s.name !== SLOT_NAMES[i])) problems.push(`SLOT lines: ${r.slots.map((s) => s.name).join(',')}`);
    if (!r.trk) problems.push('TRK missing');
    if (!r.ev) problems.push('EV missing');
    if (!r.end) problems.push('END missing');
    else if (r.end.nLevels !== r.levels.length) problems.push(`LVL lines ${r.levels.length} ≠ declared ${r.end.nLevels}`);
    if (r.dup.length) problems.push(`duplicate lines: ${r.dup.join(',')}`);
    const ring = [];
    if (r.ringSize == null) problems.push('RING missing');
    else {
      for (let a = 0; a < r.ringSize; a += RING_CHUNK) {
        const part = r.ring.get(a);
        if (!part) { problems.push(`RING chunk ${a} missing`); break; }
        ring.push(...part);
      }
      if (ring.length !== r.ringSize && !problems.some((p) => p.startsWith('RING'))) problems.push(`RING bars ${ring.length} ≠ declared ${r.ringSize}`);
    }
    const levels = r.levels.slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const snapshot = {
      meta: { ...(r.meta ?? { symbol: null, timeframe: null, mintick: null }), time },
      slots: r.slots, levels, trackers: r.trk ?? { high: { has: false }, low: { has: false } }, ring,
      events: Object.fromEntries(EVENT_NAMES.map((k, i) => [k, !!(r.ev && (r.ev.engineBits >> i) & 1)])),
    };
    out.set(time, { snapshot, alertBits: r.ev?.alertBits ?? null, declared: r.end, complete: problems.length === 0, problems });
  }
  return out;
}
