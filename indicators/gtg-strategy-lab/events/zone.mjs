// Zone reactions (H3), Flip (H4) and the H4 comparator (TRADE_CONTRACT §9.3, §11.3, §11.4).
//
// Event unit = (bar, slot, D): several levels of one zone that react on the same bar are one
// event (§9.3). The slot is the displayed slot the engine used (`inSlot`, i.e. the slots in
// force when the bar opened: log slotsBefore); a level in no slot gets slot 'none'.
//   H3        'test' with rej ≥ 0.5 and inSlot (the engine's rejectR/rejectS); D = the fade
//             direction (resistance → −1, support → +1).
//   FLIP-1    'flip' (BROKEN → FLIP_CONFIRMED); D = the break direction (the level's new role).
//             primary = armed flips (the release's flipConfirmed, navArmed at break start);
//             unarmed flips are kept with armed = false for reporting.
//   FLIP-2    the first later rejection (rej ≥ 0.5) of a level already in ST_FLIP (secondary).
//   H4 comparator  a rejection (rej ≥ 0.5, inSlot) from a level ACTIVE at t with
//             everBreaking = false at t (never broke up to t; the future is not used).
// Covariates come from bar t−1 or from the start of the test episode (§7): Q = epStartQ.
import { ST } from '../engine/zone-engine.mjs';

const dirOfSide = (side) => (side < 0 ? -1 : 1);
const slotOf = (r) => (r.slotsBefore?.[0]?.slot ?? r.slotsAfter?.[0]?.slot ?? 'none');
export const qBucket = (q) => (q == null || Number.isNaN(q) ? null : q < 48 ? '<48' : q < 72 ? '48-72' : '>=72');

function unitize(list) {
  const byKey = new Map();
  for (const e of list) {
    const k = `${e.t}|${e.slot}|${e.D}`;
    const u = byKey.get(k);
    if (!u) byKey.set(k, { ...e, keys: [e.key], members: 1 });
    else { u.keys.push(e.key); u.members++; u.rej = Math.max(u.rej ?? 0, e.rej ?? 0); u.armed = u.armed || e.armed; }
  }
  return [...byKey.values()].map(({ key, ...u }) => ({ ...u, keys: u.keys.sort((a, b) => a - b) }));
}

// zone width / ATR_eng, both at t−1 (§7)
function widthAtPrev(p, slot) {
  const z = p.prev?.slots?.find((s) => s.name === slot && s.active);
  return z && p.prev.atrEng > 0 ? (z.hi - z.lo) / p.prev.atrEng : null;
}

export function extractZoneEvents(panel) {
  const h3 = [], flip1 = [], flip2 = [], cmp = [];
  const flippedAt = new Map(), flip2Done = new Set();
  for (let t = 1; t < panel.length; t++) {
    const p = panel[t];
    for (const r of p.log) {
      const base = { t, time: p.t, key: r.key, slot: slotOf(r), levelAge: r.ageNative, tfRank: r.tfRank, source: r.source,
        role: r.origin, q0: r.epStartQ ?? null, qBucket: qBucket(r.epStartQ), width: null };
      if (r.k === 'flip') {
        flippedAt.set(r.key, t);
        flip1.push({ ...base, family: 'FLIP-1', D: r.dir, rej: r.rej, armed: r.armed });
        continue;
      }
      if (r.k !== 'test' || !(r.rej >= 0.5)) continue;
      const D = dirOfSide(r.side);
      if (r.inSlot) h3.push({ ...base, family: 'H3', D, rej: r.rej, width: widthAtPrev(p, base.slot) });
      if (r.state === ST.FLIP && flippedAt.has(r.key) && flippedAt.get(r.key) < t && !flip2Done.has(r.key)) {
        flip2Done.add(r.key);
        flip2.push({ ...base, family: 'FLIP-2', D, rej: r.rej });
      }
      if (r.inSlot && r.state === ST.ACTIVE && r.everBreaking === false) cmp.push({ ...base, family: 'H4-cmp', D, rej: r.rej });
    }
  }
  const fl1 = unitize(flip1);
  return {
    h3: unitize(h3),
    flip1: fl1.filter((e) => e.armed),
    flip1Unarmed: fl1.filter((e) => !e.armed),
    flip2: unitize(flip2),
    h4Comparator: unitize(cmp),
  };
}
