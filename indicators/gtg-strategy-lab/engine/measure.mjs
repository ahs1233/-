// GTG Measurement Engine — one timeframe, one bar series (TRADE_CONTRACT §1.2, §6).
//
// Inputs are bars exactly as a feed delivers them (no aggregation in here):
//   bars      chart bars { t, o, h, l, c, v } (BID on the Research Feed)
//   htfBars   bars of the route HTF (profile.htfTf: M1→M15, M5→H1, M15→H1, H1→H4, H4→D)
//   a1Bars    bars of anchor A1, a2Bars bars of anchor A2 (profile.a1Tf / a2Tf)
// Every HTF value used at chart bar i comes from the last HTF bar that closed before the
// HTF bar containing bar i (Pine: expr[1] with lookahead_on).
//
// startBar: the first bar on which the Zone Engine runs. Pine runs it on the last
// W (+ studyExtraBars) bars only; research runs it from bar 0 (the determinism window
// makes the state at a warmed bar independent of the start, reference tests T7/R5).
import { DEFAULTS, Engine, computeSeries, engineWindowFor, ST, TYP } from './zone-engine.mjs';
import { htfFeedValues } from '../../gtg-navigator/reference/history.mjs';
import { canonicalSnapshot, hashSlots, hashState } from '../../gtg-navigator/reference/snapshot.mjs';
import { profileFor, zoneParams, INPUTS } from './profiles.mjs';
import { computeSensors, containingIndex } from './sensors.mjs';
import { consumerStep, displayQOf, newConsumerState } from './consumer.mjs';

export const SLOT_NAMES = ['R1', 'R2', 'S1', 'S2'];

// Pine anchorFeed(ANCHOR_PIVOT_LEN = 3) through request.security(…, lookahead_on): the
// values of the HTF bar before the one containing chart bar i.
export function anchorFeedOf(chart, a1Bars, a2Bars) {
  const v1 = htfFeedValues(a1Bars, 1), v2 = htfFeedValues(a2Bars, 2);
  const k1 = containingIndex(chart, a1Bars), k2 = containingIndex(chart, a2Bars);
  const none = { now: null, atr: null, items: [] };
  return (i) => {
    const a = k1[i] - 1 >= 0 ? v1[k1[i] - 1] : none;
    const b = k2[i] - 1 >= 0 ? v2[k2[i] - 1] : none;
    return { now: [null, a.now, b.now], atrA1: a.atr, atrA2: b.atr, items: [...a.items, ...b.items] };
  };
}

const slotView = (s, name) => (s.active
  ? { name, active: true, lo: s.lo, hi: s.hi, gateQ: s.gateQ, displayQ: s.quality, containing: !!s.containing, side: s.side, primaryKey: s.primaryKey, entryKeys: s.entryKeys.slice(), lastKeys: s.lastKeys.slice() }
  : { name, active: false });

function slotsHolding(slots, key) {
  const out = [];
  slots.forEach((s, i) => {
    if (!s.active) return;
    if (s.lastKeys.includes(key)) out.push({ slot: SLOT_NAMES[i], entry: s.entryKeys.includes(key) });
  });
  return out;
}

export function runTimeframe({ tf, bars, htfBars = [], a1Bars, a2Bars, mintick, startBar = 0, emaSeed = 'first', htfInputs = null, symbol = 'XAUUSD', onRow = null, keepRows = true }) {
  const prof = profileFor(tf);
  const P = zoneParams(DEFAULTS, prof, mintick);
  const S = computeSensors(bars, htfBars, prof, mintick, { emaSeed, htfInputs });
  const series = computeSeries(bars, P);
  const eng = new Engine(bars, series, P, { startBar, anchorFeed: anchorFeedOf(bars, a1Bars, a2Bars), a1Sec: prof.a1Sec, a2Sec: prof.a2Sec });
  const W = engineWindowFor(P, prof.chartSec, prof.a1Sec, prof.a2Sec);
  const cst = newConsumerState();
  const rows = keepRows ? [] : null;
  let prevSlots = eng.slots.map((s) => ({ ...s }));

  for (let i = 0; i < bars.length; i++) {
    const r = eng.step(i);
    const engineOn = r !== null;
    const slots = eng.slots.map((s) => ({ ...s, quality: displayQOf(s, S.ma200[i], S.ma1000[i]) }));
    const ev = engineOn ? r.events : { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, flipConfirmed: false, rejectR: false, rejectS: false, log: [] };
    const s = {
      tacticalSign: S.tacticalSign[i], routeSign: S.routeSign[i], headingScore: S.headingScore[i],
      speedScore: S.speedScore[i], instantSpeedScore: S.instantSpeedScore[i], fuelScore: S.fuelScore[i], fuelAcceleration: S.fuelAcceleration[i],
    };
    const atrEng = series.atrEng[i];
    const con = consumerStep(cst, bars[i], slots, ev, s, atrEng);

    let hashes = null;
    if (engineOn) {
      const view = { P: eng.P, bars, slots, allLevels: () => eng.allLevels(), lastSwingHigh: eng.lastSwingHigh, lastSwingLow: eng.lastSwingLow, ring: eng.ring };
      const snap = canonicalSnapshot(view, r, i, { symbol, timeframe: tf }, con.latch);
      hashes = { hashSlots: hashSlots(snap), hashState: hashState(snap), eventBits: con.eventBits };
    }
    const levelsByKey = new Map(eng.allLevels().map((lv) => [lv.key, lv]));
    const log = ev.log.map((x) => {
      const lv = levelsByKey.get(x.key);
      return {
        ...x,
        origin: (x.key % 32) % 2 === TYP.HIGH ? 'R' : 'S', // disc = src·6 + tfRank·2 + typ
        slotsBefore: slotsHolding(prevSlots, x.key), slotsAfter: slotsHolding(slots, x.key),
        stateAfter: lv ? lv.state : ST.DEAD, everBreaking: lv ? !!lv.everBreaking : null,
        ageNative: lv ? lv.ageNative : null, tfRank: lv ? lv.tfRank : null, source: lv ? lv.source : null, q: lv ? lv.q : null,
      };
    });
    const hk = S.htf[i].htfIndex;
    const row = {
      i, t: bars[i].t, engineOn, warmed: engineOn && i >= startBar + W,
      o: bars[i].o, h: bars[i].h, l: bars[i].l, c: bars[i].c, v: bars[i].v,
      atr: S.safeAtr[i], atrEng,
      ma14: S.ma14[i], ma22: S.ma22[i], ma50: S.ma50[i], ma200: S.ma200[i], ma1000: S.ma1000[i],
      routeScore: S.routeScore[i], routeSign: S.routeSign[i], headingScore: S.headingScore[i], headingSign: S.headingSign[i], tacticalSign: S.tacticalSign[i],
      speedScore: S.speedScore[i], instantSpeedScore: S.instantSpeedScore[i], speedAcceleration: S.speedAcceleration[i], speedClass: S.speedClass[i],
      fuelScore: S.fuelScore[i], fuelAcceleration: S.fuelAcceleration[i], fuelClass: S.fuelClass[i], fuelExhaustion: S.fuelExhaustion[i], volumeAvailable: S.volumeAvailable[i],
      htfLastClosedT: hk - 1 >= 0 ? htfBars[hk - 1].t : null, // null when htfInputs are given
      htfClose: S.htf[i].htfClose, htfMA50: S.htf[i].htfMA50, htfMA200: S.htf[i].htfMA200, htfMA50Past: S.htf[i].htfMA50Past, htfATR: S.htf[i].htfATR,
      slots: slots.map((x, k) => slotView(x, SLOT_NAMES[k])),
      events: { breakingUp: ev.breakingUp, breakingDn: ev.breakingDn, acceptedUp: ev.acceptedUp, acceptedDn: ev.acceptedDn, rejectR: ev.rejectR, rejectS: ev.rejectS, flipConfirmed: ev.flipConfirmed },
      log, consumer: con, hashes,
    };
    if (onRow) onRow(row);
    if (rows) rows.push(row);
    prevSlots = slots;
  }
  return { prof, P, W, rows, violations: eng.violations };
}

export { INPUTS };
