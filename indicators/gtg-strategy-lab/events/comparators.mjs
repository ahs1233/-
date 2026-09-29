// Comparator levels for H3 (TRADE_CONTRACT §14), all run through the release's own Reaction
// Engine (updateLevel/runEpisode with the same rejAtrK, breakBufK, mitAlpha, pivotLen spacing
// and maxAgeLocal). Writing a different detector is forbidden (§14).
//
//   P1          ta.pivothigh/pivotlow(pivotLen, pivotLen) on the event timeframe (the release's
//               rule: left ≥, right >). Zone [ph − w·ATR_eng, ph] / [pl, pl + w·ATR_eng] with
//               ATR_eng of the confirmation bar; w = median width/ATR_eng of displayed GTG zones
//               in Train (an input here). Available from the close of the confirmation bar
//               (pivot bar + pivotLen): its first reaction bar is the next one. No quality, no
//               merging, no selection. Dies when DEAD or older than maxAgeLocal.
//   P1-rejected P1 levels whose pivot never entered any GTG slot (entryKeys) up to t.
//   P2          PDH/PDL of the previous trading day (§2.2 calendar, 17:00 New York), live for
//               one trading day; and the round numbers just above/below close on the release's
//               autoPsychStep grid. Same zone construction and Reaction Engine.
// Events: rejections (rej ≥ 0.5) with D = the fade direction, as for H3.
import { computeSeries, makeLevel, memberKeyOf, updateLevel, newEvents, SRC, TF, TYP, ST } from '../engine/pinecmp/zone-engine.mjs';

export const autoPsychStep = (p) => (p >= 100000 ? 10000 : p >= 50000 ? 5000 : p >= 10000 ? 1000 : p >= 1000 ? 500 : p >= 100 ? 50 : p >= 10 ? 5 : 1);

// Trading-day id of a UTC instant under the §2.2 calendar (17:00 America/New_York roll).
const nyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const dayCache = new Map();
export function tradingDayId(t) {
  const h = Math.floor(t / 3_600_000);
  let v = dayCache.get(h);
  if (v === undefined) {
    const parts = Object.fromEntries(nyFmt.formatToParts(new Date(h * 3_600_000)).map((x) => [x.type, x.value]));
    const d = Date.UTC(+parts.year, +parts.month - 1, +parts.day) + (+parts.hour >= 17 ? 86_400_000 : 0);
    v = new Date(d).toISOString().slice(0, 10);
    dayCache.set(h, v);
  }
  return v;
}

function reactionStep(levels, bars, j, atrEng, P, onReject, maxAge) {
  const b = bars[j], pc = j > 0 ? bars[j - 1].c : b.c;
  for (const lv of levels) {
    if (lv.state === ST.DEAD || j < lv.fromBar) continue;
    if (j - lv.birthBar > maxAge) { lv.state = ST.DEAD; continue; }
    const ev = newEvents();
    updateLevel(lv, b, pc, atrEng[j], j, ev, true, P);
    for (const r of ev.log) if (r.k === 'test' && r.rej >= 0.5) onReject(lv, r);
  }
}

// P1 and P1-rejected. `gtgKeysUpTo(t)` → Set of memberKeys seen in any GTG slot's entryKeys at ≤ t.
export function extractP1(bars, P, { w, maxAge = P.maxAge[0], gtgSlotKeys = null } = {}) {
  if (!(w > 0)) throw new Error('P1 needs w (median width/ATR_eng of displayed GTG zones in Train)');
  const { atrEng, swingPH, swingPL } = computeSeries(bars, P);
  const L = P.pivotLen, levels = [], events = [];
  const seen = new Set();
  for (let j = 0; j < bars.length; j++) {
    if (gtgSlotKeys) for (const k of gtgSlotKeys[j] ?? []) seen.add(k);
    reactionStep(levels, bars, j, atrEng, P, (lv, r) => {
      const D = r.side < 0 ? -1 : 1;
      events.push({ family: 'P1', t: j, time: bars[j].t, D, rej: r.rej, key: lv.key, levelAge: j - lv.birthBar, pivotBar: lv.birthBar,
        availableFrom: lv.availableFrom, rejectedByGtg: gtgSlotKeys ? !seen.has(lv.key) : null });
    }, maxAge);
    // confirmations at j become levels from j + 1 (availableFromTimestamp = close of bar j)
    for (const [px, typ] of [[swingPH[j], TYP.HIGH], [swingPL[j], TYP.LOW]]) {
      if (px == null) continue;
      const p = j - L, a = atrEng[j];
      const lo = typ === TYP.HIGH ? px - w * a : px, hi = typ === TYP.HIGH ? px : px + w * a;
      const lv = makeLevel({ key: memberKeyOf(bars[p].t, SRC.SWING, TF.LOCAL, typ), lo, hi, price: px, source: SRC.SWING, tfRank: TF.LOCAL, typ,
        birthNativeBar: p, birthTime: bars[p].t, birthAtr: a, s: 0, lastTestChartBar: j, stateChartBar: j });
      Object.assign(lv, { birthBar: p, fromBar: j + 1, availableFrom: bars[j].t, comparator: 'P1' });
      levels.push(lv);
    }
  }
  return { events, p1Rejected: gtgSlotKeys ? events.filter((e) => e.rejectedByGtg) : null, levels: levels.length };
}

// P2: PDH/PDL of the previous trading day + round numbers around close.
export function extractP2(bars, P, { w, maxAge = P.maxAge[0] } = {}) {
  if (!(w > 0)) throw new Error('P2 needs w');
  const { atrEng } = computeSeries(bars, P);
  const levels = [], events = [];
  let day = null, dHi = -Infinity, dLo = Infinity, prevHi = null, prevLo = null, pd = [];
  const rounds = new Map();
  const mk = (px, typ, j, tag) => {
    const a = atrEng[j];
    const lv = makeLevel({ key: j * 64 + levels.length % 64, lo: typ === TYP.HIGH ? px - w * a : px, hi: typ === TYP.HIGH ? px : px + w * a, price: px,
      source: SRC.SWING, tfRank: TF.LOCAL, typ, birthTime: bars[j].t, s: 0, lastTestChartBar: j - P.pivotLen - 1, stateChartBar: j });
    Object.assign(lv, { birthBar: j, fromBar: j, comparator: tag });
    levels.push(lv);
    return lv;
  };
  for (let j = 0; j < bars.length; j++) {
    const b = bars[j], id = tradingDayId(b.t);
    if (id !== day) {
      if (day !== null) { prevHi = dHi; prevLo = dLo; }
      day = id; dHi = -Infinity; dLo = Infinity;
      for (const lv of pd) lv.state = ST.DEAD;
      pd = prevHi === null ? [] : [mk(prevHi, TYP.HIGH, j, 'PDH'), mk(prevLo, TYP.LOW, j, 'PDL')];
    }
    const pc = j > 0 ? bars[j - 1].c : b.c, step = autoPsychStep(pc);
    for (const [n, typ] of [[Math.ceil(pc / step) * step, TYP.HIGH], [Math.floor(pc / step) * step, TYP.LOW]]) {
      const k = `${n}|${typ}`;
      if (!rounds.has(k) || rounds.get(k).state === ST.DEAD) rounds.set(k, mk(n, typ, j, 'ROUND'));
    }
    reactionStep(levels, bars, j, atrEng, P, (lv, r) => {
      events.push({ family: 'P2', subtype: lv.comparator, t: j, time: b.t, D: r.side < 0 ? -1 : 1, rej: r.rej, levelAge: j - lv.birthBar });
    }, maxAge);
    dHi = Math.max(dHi, b.h); dLo = Math.min(dLo, b.l);   // today's range, known at close(j)
  }
  return { events };
}
