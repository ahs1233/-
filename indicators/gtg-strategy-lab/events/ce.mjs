// CE — countertrend leg, E1 test, E2 early rejection (H2), and the exploratory E3/E4 timing
// variants (TRADE_CONTRACT §9.2, §10, §11.2, §12.2, §25).
//
// Written for D = −1 (Short, resistance R1/R2); D = +1 is the mirror (S1/S2).
//   leg       starts at s when headingSign becomes −D (headingSign[s−1] ≠ −D) while Macro
//             (routeSign_H4 = routeSign_H1 = D at t−1) holds; ends at the first bar where
//             headingSign = D or Macro fails (that bar is not in the leg).
//   E1        the first leg bar with high ≥ zone.lo, or zoneDistance(zone, close)/ATR_eng ≤ 0.35,
//             for a zone in R1/R2 at t. Starts the H2 age clock (age 0 at E1).
//   E2        a 'test' record at t with rej ≥ 0.5 and inSlot, from the resistance side, whose
//             memberKey is in the entryKeys of R1/R2 at t — the engine's ev.rejectR (§10).
//             Event = the first E2 at or after E1 in the leg.
//   censored  the leg ends, Macro fails, or a level of the tested zone is accepted against D.
//             Acceptance and E2 on the same bar → ABSTAIN_CONFLICT (§25), no event.
// Rows: one per bar from E1 until the event or the censoring bar (age = t − E1 bar).
import { le } from '../engine/pine-cmp.mjs';

export const NEAR_OBSTACLE_ATR = 0.35;   // nearObstacleAtr (§10 E1)
export const HEADING_CLEAR = 20;         // headingClearThreshold (§4)
export const E4_WINDOW = 10;             // headingEffLen(M5)

export const MACRO_H2 = (p, D) => p.mtf1.H4.routeSign === D && p.mtf1.H1.routeSign === D;

const zoneDistance = (lo, hi, c) => (c < lo ? lo - c : c > hi ? c - hi : 0.0);
const sideSlots = (p, D) => p.slots.filter((s) => s.active && (D < 0 ? s.name === 'R1' || s.name === 'R2' : s.name === 'S1' || s.name === 'S2'));

export function e1Zones(p, D) {
  return sideSlots(p, D).filter((z) => (D < 0 ? p.h >= z.lo : p.l <= z.hi) || le(zoneDistance(z.lo, z.hi, p.c) / p.atrEng, NEAR_OBSTACLE_ATR));
}

// E2 records at bar p for direction D: rejections of the D-side zones (engine semantics).
export function e2Records(p, D) {
  const keys = new Set(sideSlots(p, D).flatMap((z) => z.entryKeys));
  return p.log.filter((r) => r.k === 'test' && r.rej >= 0.5 && r.inSlot && r.side === (D < 0 ? -1 : 1) && keys.has(r.key));
}

export function extractCE(panel, { macro = MACRO_H2 } = {}) {
  const rows = [], episodes = [], e3 = [], e4 = [], abstains = [];
  const legs = new Map(); // D → leg
  for (let t = 1; t < panel.length; t++) {
    const p = panel[t], hs = p.headingSign;
    // continue or end the open legs
    for (const [D, leg] of legs) {
      let end = null;
      if (hs === D) end = 'leg-end';
      else if (!macro(p, D)) end = 'censored:macro';
      if (end) { closeLeg(leg, end, t); legs.delete(D); continue; }
      stepLeg(leg, p, t);
      if (leg.done) legs.delete(D);
    }
    // start new legs (countertrend −D)
    for (const D of [1, -1]) {
      if (hs === -D && panel[t - 1].headingSign !== -D && !legs.has(D) && macro(p, D)) {
        const leg = { id: `CE:${t}:${D}`, D, s: t, e1: null, testedPrimary: new Set(), testedKeys: new Set(), end: null, endT: null, eventT: null, done: false };
        legs.set(D, leg); episodes.push(leg);
        stepLeg(leg, p, t);
        if (leg.done) legs.delete(D);
      }
    }
  }
  for (const leg of legs.values()) if (!leg.end) leg.end = 'open-at-end';
  return { rows, episodes, events: rows.filter((r) => r.isEvent), e3, e4, abstains };

  function closeLeg(leg, end, t) { leg.end = end; leg.endT = t; leg.done = true; }

  function stepLeg(leg, p, t) {
    const D = leg.D;
    if (leg.e1 === null) {
      const z = e1Zones(p, D);
      if (!z.length) return;
      leg.e1 = t;
      for (const zone of z) { leg.testedPrimary.add(zone.primaryKey); zone.entryKeys.forEach((k) => leg.testedKeys.add(k)); }
    } else {
      // the tested zone follows its primary level while it stays displayed
      for (const zone of sideSlots(p, D)) if (leg.testedPrimary.has(zone.primaryKey)) zone.entryKeys.forEach((k) => leg.testedKeys.add(k));
    }
    const age = t - leg.e1;
    // exploratory timing variants (never confirmatory, §19)
    for (const r of p.log) {
      if (r.k === 'failedAcceptance' && r.dir === -D && leg.testedKeys.has(r.key)) e3.push({ family: 'CE-E3', t, time: p.t, D, episode: leg.id, age, key: r.key });
    }
    const hsc = p.headingScore, hPrev = p.prev?.headingScore;
    if (age <= E4_WINDOW && (D < 0 ? hsc < -HEADING_CLEAR && hPrev >= -HEADING_CLEAR : hsc > HEADING_CLEAR && hPrev <= HEADING_CLEAR)) {
      e4.push({ family: 'CE-E4', t, time: p.t, D, episode: leg.id, age });
    }
    const accepted = p.log.some((r) => r.k === 'accepted' && r.dir === -D && leg.testedKeys.has(r.key));
    const e2 = e2Records(p, D);
    if (accepted) {   // censoring bar: neither event nor control
      if (e2.length) abstains.push({ family: 'CE', t, time: p.t, D, episode: leg.id, age, reason: 'ABSTAIN_CONFLICT' });
      closeLeg(leg, e2.length ? 'abstain:conflict' : 'censored:accepted', t);
      return;
    }
    const fire = e2.length > 0;
    rows.push({ family: 'CE', t, time: p.t, D, episode: leg.id, age, isEvent: fire, keys: fire ? e2.map((r) => r.key) : undefined,
      rej: fire ? Math.max(...e2.map((r) => r.rej)) : undefined, zone: fire ? zoneOf(p, D, e2[0].key) : undefined });
    if (fire) { leg.eventT = t; closeLeg(leg, 'event', t); }
  }
}

function zoneOf(p, D, key) {
  const z = sideSlots(p, D).find((s) => s.entryKeys.includes(key));
  return z ? { slot: z.name, primaryKey: z.primaryKey } : null;
}
