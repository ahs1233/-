// Reference model of the GTG Navigator v0.4.7 Zone Engine.
//
// This file mirrors the algorithms of sections 8–12 of gtg_navigator_v0.4.7.pine
// (level state machine, test episodes, DOZ, component packing, MTF event groups,
// global progressive horizon, slot entry keys) so they can be tested outside
// TradingView. It proves the logic, not the Pine runtime: the Pine file is a
// hand translation of the same steps and is validated separately (G1–G3).

export const SRC = Object.freeze({ SWING: 0, DOZ: 1, ANCHOR: 2 });
export const TF = Object.freeze({ LOCAL: 0, A1: 1, A2: 2 });
export const TYP = Object.freeze({ HIGH: 0, LOW: 1 });
export const ST = Object.freeze({ ACTIVE: 0, BREAKING: 1, BROKEN: 2, FLIP: 3, DEAD: 4 });
export const SIDE = Object.freeze({ BELOW: -1, CONTAIN: 0, ABOVE: 1 });
export const KEY_BASE = 32;
export const EMPTY_KEY = -1;

// Defaults mirror the Pine inputs (G5 first-pass calibration; M1 profile for chart-bar constants).
export const DEFAULTS = Object.freeze({
  qEnter: 55, qStay: 45,
  kLocal: 8, kA1: 2.5, kA2: 2.0, kTact: 6,
  mergeGapK: 0.35, maxWidthK: 1.0,
  mitAlpha: 0.6, rejAtrK: 1.0, breakBufK: 0.10, dispBodyK: 0.80, legEff: 0.55, eventEpsK: 0.15,
  pivotLen: 3, maxAge: [720, 96, 64], flipWindow: 60,
  L_ENTRY: 40, N_LEG: 10, M_ORIGIN: 3, BREAK_WINDOW: 3, RING_LEN: 64,
  LOCAL_CAP: 48, ANCHOR_FEED_MAX: 6, ZONE_CAP: 64, ATR_ENG_LEN: 20,
  useDOZ: true,
});

// Symbol metadata (Pine syminfo.*). There is deliberately no default: every formula
// that Pine floors or rounds with syminfo.mintick requires the real tick of the
// symbol, so a missing value fails loudly instead of silently using 1e-12.
export function withSymbol(P, symbol) {
  const mintick = symbol?.mintick;
  if (!(Number.isFinite(mintick) && mintick > 0)) throw new Error(`symbol metadata missing: mintick must be a positive number, got ${mintick}`);
  return Object.freeze({ ...P, mintick });
}

export function requireMintick(P) {
  const m = P?.mintick;
  if (!(Number.isFinite(m) && m > 0)) throw new Error('symbol metadata missing: mintick (use withSymbol(P, { mintick }))');
  return m;
}

// Input contract (review item R3). Q_enter admits a zone into a slot and Q_stay is the
// lower-or-equal hold threshold of the same hysteresis pair; with Q_stay > Q_enter a
// held zone fails its own hold test and is re-admitted on the next bar (flicker).
// Refused, never clamped (Pine: runtime.error on the first bar).
//
// R3b (consumer inputs, checked when the fields are present): a text that says
// "strong" must never sit on a neutral sign, and the extreme speed colour / Speed
// Burst must never sit on a class below "استثنائية":
//   headingStrong > headingClear, routeStrong > routeClear (strict: the text uses
//   >= strong while the sign uses > clear), speedExtreme >= speedFast (equality only
//   folds the "سريعة" band).
const has = (P, a, b) => typeof P[a] === 'number' && typeof P[b] === 'number';
export function checkParams(P) {
  if (P.qStay > P.qEnter) throw new Error(`Q_stay (${P.qStay}) must not exceed Q_enter (${P.qEnter})`);
  if (has(P, 'headingStrongThreshold', 'headingClearThreshold') && !(P.headingStrongThreshold > P.headingClearThreshold)) throw new Error(`headingStrong (${P.headingStrongThreshold}) must exceed headingClear (${P.headingClearThreshold})`);
  if (has(P, 'routeStrongThreshold', 'routeClearThreshold') && !(P.routeStrongThreshold > P.routeClearThreshold)) throw new Error(`routeStrong (${P.routeStrongThreshold}) must exceed routeClear (${P.routeClearThreshold})`);
  if (has(P, 'speedExtremeThreshold', 'speedFastThreshold') && !(P.speedExtremeThreshold >= P.speedFastThreshold)) throw new Error(`speedExtreme (${P.speedExtremeThreshold}) must not be below speedFast (${P.speedFastThreshold})`);
  return P;
}

// Pine: na(x) ? na : math.max(x, syminfo.mintick)  (pine:571-572)
const floorTickOrNull = (x, mintick) => (x == null ? null : Math.max(x, mintick));

// memberKey = birthTime × KEY_BASE + disc, disc = src·6 + tfRank·2 + typ ∈ [0, 17].
export function memberKeyOf(birthTime, src, tfRank, typ) {
  const disc = src * 6 + tfRank * 2 + typ;
  if (!(disc >= 0 && disc < KEY_BASE)) throw new Error(`memberKey discriminator out of range: ${disc}`);
  const key = birthTime * KEY_BASE + disc;
  if (!Number.isSafeInteger(key)) throw new Error('memberKey exceeds exact integer range');
  return key;
}

export function makeLevel(f) {
  return {
    key: f.key, lo: f.lo, hi: f.hi, price: f.price ?? (f.typ === TYP.HIGH ? f.hi : f.lo),
    source: f.source, tfRank: f.tfRank, typ: f.typ,
    polarity: f.polarity ?? (f.typ === TYP.HIGH ? 1 : -1),
    birthNativeBar: f.birthNativeBar ?? 0, birthTime: f.birthTime, birthAtr: f.birthAtr ?? 1,
    s: f.s, mitigation: f.mitigation ?? 0, evidence: 0, tests: 0,
    lastTestChartBar: f.lastTestChartBar ?? 0, state: f.state ?? ST.ACTIVE,
    stateChartBar: f.stateChartBar ?? 0, breakDir: 0, breakCloses: 0, breakFromFlip: false,
    backCloses: 0, backStartChartBar: null, epActive: false, epSide: 0, epMaxDepth: 0,
    ageNative: f.ageNative ?? 0, q: f.q ?? 0,
  };
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clamp100 = (x) => clamp(x, 0, 100);

export function stateMult(st) {
  return st === ST.ACTIVE || st === ST.FLIP ? 1 : st === ST.BREAKING ? 0.7 : st === ST.BROKEN ? 0.6 : 0;
}

export function levelQuality(lv, P = DEFAULTS) {
  const fresh = 1 - 0.5 * Math.min(1, Math.max(0, lv.ageNative) / Math.max(1, P.maxAge[lv.tfRank]));
  return lv.s * fresh * (1 - Math.min(1, lv.mitigation)) * stateMult(lv.state);
}

// Total order: q desc, lo, hi, birthTime, source, tfRank, key.
export function precedes(a, b) {
  if (a.q !== b.q) return a.q > b.q;
  if (a.lo !== b.lo) return a.lo < b.lo;
  if (a.hi !== b.hi) return a.hi < b.hi;
  if (a.birthTime !== b.birthTime) return a.birthTime < b.birthTime;
  if (a.source !== b.source) return a.source < b.source;
  if (a.tfRank !== b.tfRank) return a.tfRank < b.tfRank;
  return a.key < b.key;
}

// ---------------------------------------------------------------------------
// Level state machine + test episodes
// ---------------------------------------------------------------------------

export function runEpisode(lv, h, l, c, pc, atr, bi, P = DEFAULTS) {
  const width = Math.max(lv.hi - lv.lo, requireMintick(P)); // pine:864
  const touch = h >= lv.lo && l <= lv.hi;
  let rej = null;
  const lastT = lv.lastTestChartBar ?? bi - P.pivotLen - 1;
  if (!lv.epActive && touch && bi - lastT > P.pivotLen) {
    lv.epActive = true;
    lv.epSide = pc > lv.hi ? 1 : pc < lv.lo ? -1 : (lv.polarity > 0 ? -1 : 1);
    lv.epMaxDepth = 0;
  }
  if (lv.epActive) {
    const depth = lv.epSide < 0 ? (h - lv.lo) / width : (lv.hi - l) / width;
    lv.epMaxDepth = Math.max(lv.epMaxDepth, clamp(depth, 0, 1));
    const exitNear = lv.epSide < 0 ? c < lv.lo : c > lv.hi;
    if (exitNear) {
      const exc = lv.epSide < 0 ? lv.lo - c : c - lv.hi;
      rej = clamp(exc / (P.rejAtrK * atr), 0, 1);
      lv.mitigation += lv.epMaxDepth * (1 - rej) * P.mitAlpha;
      lv.evidence = Math.min(3, lv.evidence + rej);
      lv.tests += 1;
      lv.lastTestChartBar = bi;
      lv.epActive = false;
    }
  }
  return rej;
}

function acceptBreak(lv, bi, ev, inSlot) {
  if (inSlot) { if (lv.breakDir > 0) ev.acceptedUp = true; else ev.acceptedDn = true; }
  if (lv.breakFromFlip) lv.state = ST.DEAD;
  else { lv.state = ST.BROKEN; lv.stateChartBar = bi; lv.epActive = false; lv.backCloses = 0; }
}

function markRejection(lv, rej, ev, inSlot) {
  if (rej !== null && rej >= 0.5 && inSlot) { if (lv.epSide < 0) ev.rejectR = true; else ev.rejectS = true; }
}

export function newEvents() {
  return { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, flipConfirmed: false, rejectR: false, rejectS: false };
}

export function updateLevel(lv, bar, pc, atr, bi, ev, inSlot, P = DEFAULTS) {
  const { o, h, l, c } = bar;
  const buf = P.breakBufK * atr;
  const st = lv.state;
  if (st === ST.ACTIVE || st === ST.FLIP) {
    const dir = lv.polarity > 0 ? 1 : -1;
    const beyond = dir > 0 ? c > lv.hi + buf : c < lv.lo - buf;
    if (beyond) {
      if (lv.epActive) { lv.epActive = false; lv.tests += 1; lv.lastTestChartBar = bi; }
      lv.breakDir = dir; lv.breakFromFlip = st === ST.FLIP; lv.breakCloses = 1; lv.stateChartBar = bi;
      lv.state = ST.BREAKING;
      if (inSlot) { if (dir > 0) ev.breakingUp = true; else ev.breakingDn = true; }
      const strongBody = Math.abs(c - o) >= P.dispBodyK * atr && (dir > 0 ? c > o : c < o);
      if (strongBody) acceptBreak(lv, bi, ev, inSlot);
    } else {
      const rej = runEpisode(lv, h, l, c, pc, atr, bi, P);
      markRejection(lv, rej, ev, inSlot);
      if (lv.mitigation >= 1) lv.state = ST.DEAD;
    }
  } else if (st === ST.BREAKING) {
    const dir = lv.breakDir;
    const beyond = dir > 0 ? c > lv.hi + buf : c < lv.lo - buf;
    const back = dir > 0 ? c < lv.lo : c > lv.hi;
    if (beyond && bi > lv.stateChartBar) {
      lv.breakCloses += 1;
      if (lv.breakCloses >= 2) acceptBreak(lv, bi, ev, inSlot);
    } else if (back) {
      lv.state = lv.breakFromFlip ? ST.FLIP : ST.ACTIVE;
      lv.tests += 1; lv.evidence = Math.min(3, lv.evidence + 0.5); lv.lastTestChartBar = bi;
    } else if (bi - lv.stateChartBar >= P.BREAK_WINDOW) {
      lv.state = lv.breakFromFlip ? ST.FLIP : ST.ACTIVE;
    }
  } else if (st === ST.BROKEN) {
    const dir = lv.breakDir;
    const backBeyond = dir > 0 ? c < lv.lo - buf : c > lv.hi + buf;
    if (backBeyond) {
      const strongBack = Math.abs(c - o) >= P.dispBodyK * atr && (dir > 0 ? c < o : c > o);
      if (lv.backCloses === 0 || bi - (lv.backStartChartBar ?? bi) > P.BREAK_WINDOW) { lv.backCloses = 1; lv.backStartChartBar = bi; }
      else lv.backCloses += 1;
      if (strongBack || lv.backCloses >= 2) lv.state = ST.DEAD;
    } else {
      const rej = runEpisode(lv, h, l, c, pc, atr, bi, P);
      if (rej !== null && rej >= 0.5 && lv.epSide === dir && bi - lv.stateChartBar <= P.flipWindow) {
        lv.polarity = -lv.polarity; lv.s = Math.min(100, lv.s + 8); lv.state = ST.FLIP;
        if (inSlot) ev.flipConfirmed = true;
      }
      markRejection(lv, rej, ev, inSlot);
    }
  }
  return lv.state;
}

// ---------------------------------------------------------------------------
// Zone builder: sort by lo → components → packing → member lists → aggregation
// ---------------------------------------------------------------------------

const gapBetween = (aLo, aHi, bLo, bHi) => (aLo > bHi ? aLo - bHi : bLo > aHi ? bLo - aHi : -1);

export function sameEvent(a, b, ctx, P = DEFAULTS) {
  if (a.tfRank === b.tfRank) return false;
  const [f, c] = a.tfRank < b.tfRank ? [a, b] : [b, a];
  if (a.source === SRC.DOZ || b.source === SRC.DOZ || a.typ !== b.typ || c.tfRank === TF.LOCAL) return false;
  const cAtr = c.tfRank === TF.A1 ? ctx.atrA1 : ctx.atrA2;
  const cDurMs = (c.tfRank === TF.A1 ? ctx.a1Sec : ctx.a2Sec) * 1000;
  if (cAtr == null) return false;
  return f.birthTime >= c.birthTime && f.birthTime < c.birthTime + cDurMs && Math.abs(f.price - c.price) <= P.eventEpsK * cAtr;
}

function packComponent(srt, mz, zones, a, b, mg, maxW, tel, ctx, P) {
  for (;;) {
    let best = -1;
    for (let i = a; i <= b; i++) if (mz[i] === -2 && (best < 0 || precedes(srt[i], srt[best]))) best = i;
    if (best < 0) break;
    const m = srt[best];
    const firstZ = zones.componentStart;
    let blocked = zones.length >= P.ZONE_CAP;
    for (let z = firstZ; z < zones.length && !blocked; z++) {
      if (gapBetween(m.lo, m.hi, zones[z].lo, zones[z].hi) < mg) blocked = true;
    }
    if (blocked) {
      mz[best] = -1;
      tel.suppressed.push(m);
      continue;
    }
    const zn = { lo: m.lo, hi: m.hi, wz: Math.max(maxW, m.hi - m.lo) };
    const zi = zones.length;
    zones.push(zn);
    mz[best] = zi;
    for (;;) {
      let cand = -1;
      for (let i = a; i <= b; i++) {
        if (mz[i] !== -2) continue;
        const c = srt[i];
        const g = gapBetween(c.lo, c.hi, zn.lo, zn.hi);
        const nlo = Math.min(zn.lo, c.lo);
        const nhi = Math.max(zn.hi, c.hi);
        let ok = g <= mg && nhi - nlo <= zn.wz;
        for (let z = firstZ; z < zi && ok; z++) if (gapBetween(nlo, nhi, zones[z].lo, zones[z].hi) < mg) ok = false;
        if (ok && (cand < 0 || precedes(c, srt[cand]))) cand = i;
      }
      if (cand < 0) break;
      zn.lo = Math.min(zn.lo, srt[cand].lo);
      zn.hi = Math.max(zn.hi, srt[cand].hi);
      mz[cand] = zi;
    }
  }
}

function aggregateZone(zn, ctx, P) {
  const ord = zn.members.slice();
  // selection sort by precedes (mirrors the Pine implementation)
  for (let x = 0; x < ord.length - 1; x++) {
    let bp = x;
    for (let y = x + 1; y < ord.length; y++) if (precedes(ord[y], ord[bp])) bp = y;
    if (bp !== x) [ord[x], ord[bp]] = [ord[bp], ord[x]];
  }
  zn.members = ord;
  zn.primary = ord[0];
  zn.hasA1 = ord.some((l) => l.tfRank === TF.A1);
  zn.hasA2 = ord.some((l) => l.tfRank === TF.A2);
  zn.hasFlip = ord.some((l) => l.state === ST.FLIP);
  const memberGroup = [];
  const groups = []; // { prim, tf: Set }
  for (let j = 0; j < ord.length; j++) {
    let joined = -1;
    for (let k = 0; k < j && joined < 0; k++) if (sameEvent(ord[j], ord[k], ctx, P)) joined = memberGroup[k];
    if (joined < 0) { joined = groups.length; groups.push({ prim: ord[j], tf: new Set() }); }
    memberGroup.push(joined);
    groups[joined].tf.add(ord[j].tfRank);
  }
  let bestG = 0;
  for (const g of groups) {
    const tfc = g.tf.size;
    bestG = Math.max(bestG, g.prim.q + (tfc >= 3 ? 12 : tfc === 2 ? 8 : 0));
  }
  const conf = groups.length > 1 ? Math.min(12, 12 * (1 - Math.pow(0.5, groups.length - 1))) : 0;
  zn.groups = groups.length;
  zn.gateQ = Math.min(100, bestG + conf);
  zn.displayQ = zn.gateQ;
}

// Builds the zone map from live levels. Returns zones sorted by lo, the
// suppressed members and a list of invariant violations (I1–I6).
export function buildZones(levels, ctx, P = DEFAULTS) {
  const tel = { suppressed: [] };
  const work = levels.filter((l) => l && l.state !== ST.DEAD);
  const srt = work.slice().sort((x, y) => x.lo - y.lo); // tie order is irrelevant to components
  const n = srt.length;
  const mg = P.mergeGapK * ctx.atr;
  const maxW = P.maxWidthK * ctx.atr;
  const mz = new Array(n).fill(-2);
  const zones = [];
  if (n > 0) {
    let cStart = 0;
    let cHi = srt[0].hi;
    for (let i = 1; i <= n; i++) {
      const boundary = i === n ? true : srt[i].lo > cHi + mg;
      if (boundary) {
        zones.componentStart = zones.length;
        packComponent(srt, mz, zones, cStart, i - 1, mg, maxW, tel, ctx, P);
        cStart = i;
        if (i < n) cHi = srt[i].hi;
      } else cHi = Math.max(cHi, srt[i].hi);
    }
  }
  for (const z of zones) z.members = [];
  for (let i = 0; i < n; i++) if (mz[i] >= 0) zones[mz[i]].members.push(srt[i]);
  for (const z of zones) aggregateZone(z, ctx, P);
  const sorted = zones.slice().sort((x, y) => x.lo - y.lo);
  // pine:1466  tol = |close|·1e-9 + mintick·1e-6 (invariant checks only)
  const tol = Math.abs(ctx.close) * 1e-9 + requireMintick(P) * 1e-6;
  const violations = checkBuilderInvariants(sorted, tel.suppressed, n, mg, tol);
  return { zones: sorted, suppressed: tel.suppressed, violations };
}

export function checkBuilderInvariants(zones, suppressed, n, mg, tol) {
  const v = [];
  let contributing = 0;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    contributing += z.members.length;
    if (z.members.length < 1) v.push('I6_NO_MEMBER');
    if (z.lo > z.hi) v.push('I1_BOUNDS');
    if (z.hi - z.lo > z.wz + tol) v.push('I3_WIDTH');
    const ulo = Math.min(...z.members.map((m) => m.lo));
    const uhi = Math.max(...z.members.map((m) => m.hi));
    if (ulo !== z.lo || uhi !== z.hi) v.push('I4_UNION');
    for (const m of z.members) if (m.lo < z.lo - tol || m.hi > z.hi + tol) v.push('I5_CORE_OUTSIDE');
    if (i > 0) {
      if (zones[i - 1].hi >= z.lo) v.push('I1_OVERLAP');
      if (z.lo - zones[i - 1].hi < mg - tol) v.push('I2_GAP');
    }
  }
  if (contributing + suppressed.length !== n) v.push('I5_ACCOUNTING');
  return v;
}

// ---------------------------------------------------------------------------
// Selection: privilege, eligibility, global horizon, containing zone, slots
// ---------------------------------------------------------------------------

export function emptySlot() {
  return { active: false, containing: false, lo: null, hi: null, side: 0, quality: 0, gateQ: 0, primaryKey: 0, entryKeys: [], lastKeys: [] };
}

function containEntrySide(zn, ringC, P) {
  const kEnd = Math.min(P.L_ENTRY, ringC.length - 1);
  for (let k = 1; k <= kEnd; k++) {
    if (ringC[k] > zn.hi) return 1;
    if (ringC[k] < zn.lo) return -1;
  }
  return zn.primary.polarity > 0 ? -1 : 1;
}

// slots: [R1, R2, S1, S2] from the previous confirmed bar (read-only here).
export function selectSlots(zones, slots, ctx, P = DEFAULTS) {
  checkParams(P);
  const close = ctx.close;
  const hLocal = P.kLocal * ctx.atr;
  const reachA1 = ctx.atrA1 == null ? 0 : P.kA1 * ctx.atrA1;
  const reachA2 = ctx.atrA2 == null ? 0 : P.kA2 * ctx.atrA2;
  let containIdx = -1;
  let containCount = 0;
  const v = [];
  zones.forEach((zn, z) => {
    zn.side = zn.lo > close ? SIDE.ABOVE : zn.hi < close ? SIDE.BELOW : SIDE.CONTAIN;
    zn.dist = zn.side === SIDE.ABOVE ? zn.lo - close : zn.side === SIDE.BELOW ? close - zn.hi : 0;
    zn.privSlot = -1;
    for (let si = 0; si < 4 && zn.privSlot < 0; si++) {
      const ss = slots[si];
      if (ss.active && zn.members.some((m) => ss.entryKeys.includes(m.key))) zn.privSlot = si;
    }
    zn.eligible = zn.members.length > 0 && zn.gateQ >= (zn.privSlot >= 0 ? P.qStay : P.qEnter);
    if (zn.side === SIDE.CONTAIN) { containCount += 1; containIdx = z; }
  });
  if (containCount > 1) v.push('I8_MULTI_CONTAIN');
  let rStarUp = hLocal, rStarDn = hLocal, holdUp = 0, holdDn = 0;
  for (const zn of zones) {
    if (!zn.eligible || zn.side === SIDE.CONTAIN) continue;
    const justified = (zn.hasA1 && zn.dist <= reachA1) || (zn.hasA2 && zn.dist <= reachA2);
    if (zn.side === SIDE.ABOVE) {
      if (justified) rStarUp = Math.max(rStarUp, zn.dist);
      if (zn.privSlot >= 0) holdUp = Math.max(holdUp, zn.dist);
    } else {
      if (justified) rStarDn = Math.max(rStarDn, zn.dist);
      if (zn.privSlot >= 0) holdDn = Math.max(holdDn, zn.dist);
    }
  }
  const rEffUp = Math.max(rStarUp, Math.min(holdUp, 1.25 * rStarUp));
  const rEffDn = Math.max(rStarDn, Math.min(holdDn, 1.25 * rStarDn));
  let containEntry = 0;
  if (containIdx >= 0 && zones[containIdx].eligible) containEntry = containEntrySide(zones[containIdx], ctx.ringC, P);
  const rList = [];
  const sList = [];
  if (containEntry < 0) rList.push(containIdx);
  if (containEntry > 0) sList.push(containIdx);
  zones.forEach((zn, z) => { if (zn.eligible && zn.side === SIDE.ABOVE && zn.dist <= rEffUp) rList.push(z); });
  for (let z = zones.length - 1; z >= 0; z--) {
    const zn = zones[z];
    if (zn.eligible && zn.side === SIDE.BELOW && zn.dist <= rEffDn) sList.push(z);
  }
  const pick = [rList[0] ?? -1, rList[1] ?? -1, sList[0] ?? -1, sList[1] ?? -1];
  checkSelectionInvariants(zones, pick, close, rEffUp, rEffDn, containEntry, v);

  // New slot contents (old entry keys read before anything is written).
  const next = pick.map((z, si) => {
    if (z < 0) return emptySlot();
    const zn = zones[z];
    const keys = zn.members.map((m) => m.key);
    const lastKeys = keys.slice(); // no cap: every member key is kept
    let entryKeys;
    if (zn.privSlot >= 0) entryKeys = slots[zn.privSlot].entryKeys.filter((k) => keys.includes(k));
    else entryKeys = keys.slice();
    return {
      active: true, containing: zn.side === SIDE.CONTAIN, lo: zn.lo, hi: zn.hi, side: zn.side,
      quality: zn.displayQ, gateQ: zn.gateQ, primaryKey: zn.primary.key, entryKeys, lastKeys, zoneIndex: z, isRes: si < 2,
    };
  });
  return { next, pick, rEffUp, rEffDn, rStarUp, rStarDn, containEntry, violations: v };
}

// I9–I12, recounted independently of the list construction (mirrors the Pine checks).
export function checkSelectionInvariants(zones, pick, close, rEffUp, rEffDn, containEntry, v) {
  const [r1, r2, s1, s2] = pick;
  if ((r2 >= 0 && r1 < 0) || (s2 >= 0 && s1 < 0)) v.push('I10_ORDER');
  const used = pick.filter((z) => z >= 0);
  if (new Set(used).size !== used.length) v.push('I10_DUP_SLOT');
  if (r1 >= 0 && r2 >= 0) {
    const a = zones[r1], b = zones[r2];
    if (!(a.hi < b.lo && (a.side === SIDE.CONTAIN || a.lo > close))) v.push('I9_R_ORDER');
  }
  if (s1 >= 0 && s2 >= 0) {
    const a = zones[s1], b = zones[s2];
    if (!(a.lo > b.hi && (a.side === SIDE.CONTAIN || a.hi < close))) v.push('I9_S_ORDER');
  }
  let maxSelUp = -1, maxSelDn = -1, selUp = 0, selDn = 0;
  zones.forEach((zn, z) => {
    if ((z === r1 || z === r2) && zn.side === SIDE.ABOVE) { maxSelUp = Math.max(maxSelUp, zn.dist); selUp++; }
    if ((z === s1 || z === s2) && zn.side === SIDE.BELOW) { maxSelDn = Math.max(maxSelDn, zn.dist); selDn++; }
  });
  const capUp = containEntry < 0 ? 1 : 2;
  const capDn = containEntry > 0 ? 1 : 2;
  zones.forEach((zn, z) => {
    if (used.includes(z) || !zn.eligible) return;
    if (zn.side === SIDE.ABOVE && zn.dist <= rEffUp) {
      if (selUp < capUp) v.push('I12_EMPTY_UP');
      if (zn.dist < maxSelUp) v.push('I11_SKIP_UP');
    }
    if (zn.side === SIDE.BELOW && zn.dist <= rEffDn) {
      if (selDn < capDn) v.push('I12_EMPTY_DN');
      if (zn.dist < maxSelDn) v.push('I11_SKIP_DN');
    }
  });
}

// ---------------------------------------------------------------------------
// Full engine over a bar series (local swings + DOZ + optional anchor feed)
// ---------------------------------------------------------------------------

export function computeSeries(bars, P = DEFAULTS) {
  const mintick = requireMintick(P);
  const n = bars.length;
  const tr = bars.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c))));
  const atrEng = new Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += tr[i];
    if (i >= P.ATR_ENG_LEN) sum -= tr[i - P.ATR_ENG_LEN];
    // pine:532  atrEng = max(nz(sma(tr(true), ATR_ENG_LEN), tr(true)), mintick)
    atrEng[i] = Math.max(i >= P.ATR_ENG_LEN - 1 ? sum / P.ATR_ENG_LEN : tr[i], mintick);
  }
  const L = P.pivotLen;
  const swingPH = new Array(n).fill(null);
  const swingPL = new Array(n).fill(null);
  for (let i = 2 * L; i < n; i++) {
    const p = i - L;
    let isH = true, isL = true;
    for (let k = 1; k <= L; k++) {
      if (!(bars[p].h > bars[p - k].h && bars[p].h >= bars[p + k].h)) isH = false;
      if (!(bars[p].l < bars[p - k].l && bars[p].l <= bars[p + k].l)) isL = false;
    }
    if (isH) swingPH[i] = bars[p].h;
    if (isL) swingPL[i] = bars[p].l;
  }
  return { atrEng, swingPH, swingPL };
}

export function engineWindowFor(P = DEFAULTS, chartSec = 60, a1Sec = 300, a2Sec = 900) {
  const tMax = Math.max(P.maxAge[0], P.maxAge[1] * a1Sec / chartSec, P.maxAge[2] * a2Sec / chartSec);
  return 2 * Math.ceil(tMax) + P.L_ENTRY + P.N_LEG + P.pivotLen + 10;
}

export class Engine {
  constructor(bars, series, P = DEFAULTS, opts = {}) {
    checkParams(P);
    this.bars = bars; this.series = series; this.P = P;
    this.startBar = opts.startBar ?? 0;
    this.anchorFeed = opts.anchorFeed ?? null; // (i) => { now: [null, a1Now, a2Now], atrA1, atrA2, items: [...] }
    this.a1Sec = opts.a1Sec ?? 300; this.a2Sec = opts.a2Sec ?? 900;
    this.local = []; this.anchorsA1 = []; this.anchorsA2 = [];
    this.slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
    this.ring = [];
    this.lastSwingHigh = { px: null, bar: null, broken: true };
    this.lastSwingLow = { px: null, bar: null, broken: true };
    this.violations = [];
    this.suppressedTotal = 0;
    this.lastZones = [];
  }

  allLevels() { return [...this.local, ...this.anchorsA1, ...this.anchorsA2]; }

  inPrevSlots(k) { return this.slots.some((s) => s.active && s.lastKeys.includes(k)); }

  admitLocal(lv) {
    if (this.local.some((x) => x.key === lv.key)) { this.violations.push('DUP_KEY'); return; }
    this.local.push(lv);
  }

  step(i) {
    if (i < this.startBar) return null;
    const P = this.P, bars = this.bars, b = bars[i];
    const mintick = requireMintick(P);
    const atr = this.series.atrEng[i]; // already floored at mintick by computeSeries
    const pc = i > 0 ? bars[i - 1].c : b.c;
    const rawFeed = this.anchorFeed ? this.anchorFeed(i) : { now: [null, null, null], atrA1: null, atrA2: null, items: [] };
    const feed = { ...rawFeed, atrA1: floorTickOrNull(rawFeed.atrA1, mintick), atrA2: floorTickOrNull(rawFeed.atrA2, mintick) };
    const ev = newEvents();
    this.ring.unshift(b); if (this.ring.length > P.RING_LEN) this.ring.pop();

    // Phase 1: aging + state machine
    for (const pool of [this.local, this.anchorsA1, this.anchorsA2]) {
      for (const lv of pool) {
        const nowN = lv.tfRank === TF.LOCAL ? i : feed.now[lv.tfRank];
        if (nowN != null) {
          lv.ageNative = nowN - lv.birthNativeBar;
          if (lv.ageNative < 0) this.violations.push('AGE_NEGATIVE');
          if (lv.ageNative > P.maxAge[lv.tfRank]) lv.state = ST.DEAD;
        }
        if (lv.state !== ST.DEAD) updateLevel(lv, b, pc, atr, i, ev, this.inPrevSlots(lv.key), P);
      }
    }
    this.local = this.local.filter((l) => l.state !== ST.DEAD);

    // DOZ
    const ringO = this.ring.map((r) => r.o), ringH = this.ring.map((r) => r.h), ringL = this.ring.map((r) => r.l), ringC = this.ring.map((r) => r.c);
    const body = Math.abs(b.c - b.o);
    const sh = this.lastSwingHigh, sl = this.lastSwingLow;
    if (sh.px != null && !sh.broken && b.c > sh.px) {
      sh.broken = true;
      if (P.useDOZ && i - sh.bar <= P.maxAge[0] && b.c > b.o && body >= P.dispBodyK * atr && pc <= sh.px) {
        const d = dozBuild(true, ringO, ringH, ringL, ringC, atr, P);
        if (d.ok) this.admitLocal(makeLevel({ key: memberKeyOf(b.t, SRC.DOZ, TF.LOCAL, TYP.LOW), lo: d.lo, hi: d.hi, price: d.lo, source: SRC.DOZ, tfRank: TF.LOCAL, typ: TYP.LOW, polarity: -1, birthNativeBar: i, birthTime: b.t, birthAtr: atr, s: clamp100(58 + Math.min(30, (body / atr - P.dispBodyK) * 30) + (d.fvg ? 6 : 0)), lastTestChartBar: i, stateChartBar: i }));
      }
    }
    if (sl.px != null && !sl.broken && b.c < sl.px) {
      sl.broken = true;
      if (P.useDOZ && i - sl.bar <= P.maxAge[0] && b.c < b.o && body >= P.dispBodyK * atr && pc >= sl.px) {
        const d = dozBuild(false, ringO, ringH, ringL, ringC, atr, P);
        if (d.ok) this.admitLocal(makeLevel({ key: memberKeyOf(b.t, SRC.DOZ, TF.LOCAL, TYP.HIGH), lo: d.lo, hi: d.hi, price: d.hi, source: SRC.DOZ, tfRank: TF.LOCAL, typ: TYP.HIGH, polarity: 1, birthNativeBar: i, birthTime: b.t, birthAtr: atr, s: clamp100(58 + Math.min(30, (body / atr - P.dispBodyK) * 30) + (d.fvg ? 6 : 0)), lastTestChartBar: i, stateChartBar: i }));
      }
    }

    // SWING admissions
    const L = P.pivotLen;
    if (this.series.swingPH[i] != null) {
      const p = i - L, px = this.series.swingPH[i];
      const sAtr = Math.max(this.series.atrEng[p], mintick); // pine:1154,1162
      const bodyTop = Math.max(bars[p].o, bars[p].c);
      const w = Math.max(0.10 * sAtr, Math.min(0.50 * sAtr, px - bodyTop));
      let rightLow = Infinity; for (let k = p; k <= i; k++) rightLow = Math.min(rightLow, bars[k].l);
      this.admitLocal(makeLevel({ key: memberKeyOf(bars[p].t, SRC.SWING, TF.LOCAL, TYP.HIGH), lo: px - w, hi: px, price: px, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthNativeBar: p, birthTime: bars[p].t, birthAtr: sAtr, s: clamp100(45 + Math.min(38, (px - rightLow) / sAtr * 16)), lastTestChartBar: i, stateChartBar: i, ageNative: L }));
      Object.assign(sh, { px, bar: p, broken: false });
    }
    if (this.series.swingPL[i] != null) {
      const p = i - L, px = this.series.swingPL[i];
      const sAtr = Math.max(this.series.atrEng[p], mintick); // pine:1154,1162
      const bodyBot = Math.min(bars[p].o, bars[p].c);
      const w = Math.max(0.10 * sAtr, Math.min(0.50 * sAtr, bodyBot - px));
      let rightHigh = -Infinity; for (let k = p; k <= i; k++) rightHigh = Math.max(rightHigh, bars[k].h);
      this.admitLocal(makeLevel({ key: memberKeyOf(bars[p].t, SRC.SWING, TF.LOCAL, TYP.LOW), lo: px, hi: px + w, price: px, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.LOW, birthNativeBar: p, birthTime: bars[p].t, birthAtr: sAtr, s: clamp100(45 + Math.min(38, (rightHigh - px) / sAtr * 16)), lastTestChartBar: i, stateChartBar: i, ageNative: L }));
      Object.assign(sl, { px, bar: p, broken: false });
    }

    // ANCHOR lifecycle: feed keys → sync → upsert (per timeframe, bounded by the feed)
    for (const [tf, pool] of [[TF.A1, this.anchorsA1], [TF.A2, this.anchorsA2]]) {
      const items = feed.items.filter((it) => it.tfRank === tf);
      const keys = feedKeysOf(items);
      syncAnchorPool(pool, keys, feed.now[tf] != null, P);
      for (const it of items) upsertAnchor(pool, it, feed.now[tf], tf === TF.A1 ? feed.atrA1 : feed.atrA2, atr, i, P);
      if (pool.length > P.ANCHOR_FEED_MAX) this.violations.push('ANCHOR_POOL_SIZE');
    }
    evictOldest(this.local, P.LOCAL_CAP);
    for (const lv of this.allLevels()) lv.q = lv.state === ST.DEAD ? 0 : levelQuality(lv, P);

    // Phase 2 + 3
    const ctx = { close: b.c, atr, atrA1: feed.atrA1, atrA2: feed.atrA2, a1Sec: this.a1Sec, a2Sec: this.a2Sec, ringC };
    const built = buildZones(this.allLevels(), ctx, P);
    this.suppressedTotal += built.suppressed.length;
    const sel = selectSlots(built.zones, this.slots, ctx, P);
    this.violations.push(...built.violations, ...sel.violations);
    this.slots = sel.next;
    this.lastZones = built.zones;
    return { events: ev, slots: this.slots, zones: built.zones, sel, ctx };
  }
}

// Anchor lifecycle follows the feed: a record lives while its key is one of the
// feed's current keys; a DEAD record stays as a tombstone for exactly that period.
export function feedKeysOf(items) {
  return items.filter((it) => it.price != null && it.bt != null).map((it) => memberKeyOf(it.bt, SRC.ANCHOR, it.tfRank, it.typ));
}

export function syncAnchorPool(pool, feedKeys, feedOk, P = DEFAULTS) {
  for (let i = pool.length - 1; i >= 0; i--) {
    const lv = pool[i];
    const agedOut = lv.state === ST.DEAD && lv.ageNative > P.maxAge[lv.tfRank];
    if (agedOut || (feedOk && !feedKeys.includes(lv.key))) pool.splice(i, 1);
  }
}

export function upsertAnchor(pool, it, nowN, atrA, atr, i, P = DEFAULTS) {
  if (it.price == null || it.nb == null || it.bt == null || nowN == null || atrA == null) return false;
  const age = nowN - it.nb;
  if (age < 0 || age > P.maxAge[it.tfRank]) return false;
  const k = memberKeyOf(it.bt, SRC.ANCHOR, it.tfRank, it.typ);
  if (pool.some((x) => x.key === k)) return false;
  const w = Math.max(0.15 * atr, Math.min(0.60 * atr, 0.10 * atrA));
  pool.push(makeLevel({ key: k, lo: it.typ === TYP.HIGH ? it.price - w : it.price, hi: it.typ === TYP.HIGH ? it.price : it.price + w, price: it.price, source: SRC.ANCHOR, tfRank: it.tfRank, typ: it.typ, birthNativeBar: it.nb, birthTime: it.bt, birthAtr: atr, s: it.tfRank === TF.A1 ? 70 : 78, lastTestChartBar: i, stateChartBar: i, ageNative: age }));
  return true;
}

function evictOldest(pool, cap) {
  while (pool.length > cap) {
    let oi = 0;
    for (let i = 1; i < pool.length; i++) {
      const a = pool[i], b = pool[oi];
      if (a.birthTime < b.birthTime || (a.birthTime === b.birthTime && a.key < b.key)) oi = i;
    }
    pool.splice(oi, 1);
  }
}

export function dozBuild(bull, rO, rH, rL, rC, atr, P = DEFAULTS) {
  const n = rC.length;
  if (n < 3) return { ok: false };
  const legN = Math.min(P.N_LEG, n);
  let s0 = 0;
  let ext = bull ? rL[0] : rH[0];
  for (let k = 1; k < legN; k++) {
    const v = bull ? rL[k] : rH[k];
    if (bull ? v <= ext : v >= ext) { ext = v; s0 = k; }
  }
  let path = 0;
  const pathEnd = Math.min(Math.max(s0, 1), n - 1);
  for (let j = 0; j < pathEnd; j++) path += Math.abs(rC[j] - rC[j + 1]);
  const net = bull ? rC[0] - ext : ext - rC[0];
  const eff = path > 0 ? Math.min(1, net / path) : 0;
  let o = s0;
  const oEnd = Math.min(s0 + P.M_ORIGIN, n - 1);
  for (let k = s0; k <= oEnd; k++) { if (bull ? rC[k] < rO[k] : rC[k] > rO[k]) { o = k; break; } }
  const rawLo = bull ? rL[o] : Math.min(rO[o], rC[o]);
  const rawHi = bull ? Math.max(rO[o], rC[o]) : rH[o];
  const w = Math.max(0.15 * atr, Math.min(0.80 * atr, rawHi - rawLo));
  return {
    ok: eff >= P.legEff,
    lo: bull ? rawLo : rawHi - w,
    hi: bull ? rawLo + w : rawHi,
    fvg: bull ? rL[0] > rH[2] : rH[0] < rL[2],
  };
}

// Deterministic synthetic OHLC (seeded) for tests.
export function syntheticBars(n, seed = 7, t0 = 1_700_000_000_000, stepMs = 60_000) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const bars = [];
  let px = 2000;
  let vol = 1.0;
  let drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 200 === 0) { vol = 0.6 + rnd() * 1.4; drift = (rnd() - 0.5) * 0.6; }
    const o = px;
    const c = o + drift + (rnd() - 0.5) * 4 * vol;
    const h = Math.max(o, c) + rnd() * 1.5 * vol;
    const l = Math.min(o, c) - rnd() * 1.5 * vol;
    bars.push({ t: t0 + i * stepMs, o, h, l, c });
    px = c;
  }
  return bars;
}
