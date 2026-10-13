// runner.mjs
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";

// ../../gtg-strategy-lab/engine/pine-cmp.mjs
var PINE_EPS = 1e-10;
var eq = (a, b) => a === b || typeof a === "number" && typeof b === "number" && Math.abs(a - b) < PINE_EPS;
var ne = (a, b) => !eq(a, b);
var lt = (a, b) => a < b && !eq(a, b);
var gt = (a, b) => a > b && !eq(a, b);
var le = (a, b) => a <= b || eq(a, b);
var ge = (a, b) => a >= b || eq(a, b);

// zone-engine.mjs
var SRC = Object.freeze({ SWING: 0, DOZ: 1, ANCHOR: 2 });
var TF = Object.freeze({ LOCAL: 0, A1: 1, A2: 2 });
var TYP = Object.freeze({ HIGH: 0, LOW: 1 });
var ST = Object.freeze({ ACTIVE: 0, BREAKING: 1, BROKEN: 2, FLIP: 3, DEAD: 4 });
var SIDE = Object.freeze({ BELOW: -1, CONTAIN: 0, ABOVE: 1 });
var KEY_BASE = 32;
var DEFAULTS = Object.freeze({
  qEnter: 55,
  qStay: 45,
  kLocal: 8,
  kA1: 2.5,
  kA2: 2,
  kTact: 6,
  mergeGapK: 0.35,
  maxWidthK: 1,
  mitAlpha: 0.6,
  rejAtrK: 1,
  breakBufK: 0.1,
  dispBodyK: 0.8,
  legEff: 0.55,
  eventEpsK: 0.15,
  pivotLen: 3,
  maxAge: [720, 96, 64],
  flipWindow: 60,
  L_ENTRY: 40,
  N_LEG: 10,
  M_ORIGIN: 3,
  BREAK_WINDOW: 3,
  RING_LEN: 64,
  LOCAL_CAP: 48,
  ANCHOR_FEED_MAX: 6,
  ZONE_CAP: 64,
  ATR_ENG_LEN: 20,
  useDOZ: true
});
function requireMintick(P) {
  const m = P?.mintick;
  if (!(Number.isFinite(m) && gt(m, 0))) throw new Error("symbol metadata missing: mintick (use withSymbol(P, { mintick }))");
  return m;
}
var has = (P, a, b) => eq(typeof P[a], "number") && eq(typeof P[b], "number");
function checkParams(P) {
  if (gt(P.qStay, P.qEnter)) throw new Error(`Q_stay (${P.qStay}) must not exceed Q_enter (${P.qEnter})`);
  if (has(P, "headingStrongThreshold", "headingClearThreshold") && !gt(P.headingStrongThreshold, P.headingClearThreshold)) throw new Error(`headingStrong (${P.headingStrongThreshold}) must exceed headingClear (${P.headingClearThreshold})`);
  if (has(P, "routeStrongThreshold", "routeClearThreshold") && !gt(P.routeStrongThreshold, P.routeClearThreshold)) throw new Error(`routeStrong (${P.routeStrongThreshold}) must exceed routeClear (${P.routeClearThreshold})`);
  if (has(P, "speedExtremeThreshold", "speedFastThreshold") && !ge(P.speedExtremeThreshold, P.speedFastThreshold)) throw new Error(`speedExtreme (${P.speedExtremeThreshold}) must not be below speedFast (${P.speedFastThreshold})`);
  return P;
}
var floorTickOrNull = (x, mintick) => x == null ? null : Math.max(x, mintick);
function memberKeyOf(birthTime, src, tfRank, typ) {
  const disc = src * 6 + tfRank * 2 + typ;
  if (!(ge(disc, 0) && lt(disc, KEY_BASE))) throw new Error(`memberKey discriminator out of range: ${disc}`);
  const key = birthTime * KEY_BASE + disc;
  if (!Number.isSafeInteger(key)) throw new Error("memberKey exceeds exact integer range");
  return key;
}
function makeLevel(f) {
  return {
    key: f.key,
    lo: f.lo,
    hi: f.hi,
    price: f.price ?? (eq(f.typ, TYP.HIGH) ? f.hi : f.lo),
    source: f.source,
    tfRank: f.tfRank,
    typ: f.typ,
    polarity: f.polarity ?? (eq(f.typ, TYP.HIGH) ? 1 : -1),
    birthNativeBar: f.birthNativeBar ?? 0,
    birthTime: f.birthTime,
    birthAtr: f.birthAtr ?? 1,
    s: f.s,
    mitigation: f.mitigation ?? 0,
    evidence: 0,
    tests: 0,
    lastTestChartBar: f.lastTestChartBar ?? 0,
    state: f.state ?? ST.ACTIVE,
    stateChartBar: f.stateChartBar ?? 0,
    breakDir: 0,
    breakCloses: 0,
    breakFromFlip: false,
    backCloses: 0,
    backStartChartBar: null,
    epActive: false,
    epSide: 0,
    epMaxDepth: 0,
    ageNative: f.ageNative ?? 0,
    q: f.q ?? 0,
    navArmed: false
    // R4-B: navigation chain armed at break start while displayed
  };
}
var clamp = (x, a, b) => Math.max(a, Math.min(b, x));
var clamp100 = (x) => clamp(x, 0, 100);
function stateMult(st) {
  return eq(st, ST.ACTIVE) || eq(st, ST.FLIP) ? 1 : eq(st, ST.BREAKING) ? 0.7 : eq(st, ST.BROKEN) ? 0.6 : 0;
}
function levelQuality(lv, P = DEFAULTS) {
  const fresh = 1 - 0.5 * Math.min(1, Math.max(0, lv.ageNative) / Math.max(1, P.maxAge[lv.tfRank]));
  return lv.s * fresh * (1 - Math.min(1, lv.mitigation)) * stateMult(lv.state);
}
function precedes(a, b) {
  if (ne(a.q, b.q)) return gt(a.q, b.q);
  if (ne(a.lo, b.lo)) return lt(a.lo, b.lo);
  if (ne(a.hi, b.hi)) return lt(a.hi, b.hi);
  if (ne(a.birthTime, b.birthTime)) return lt(a.birthTime, b.birthTime);
  if (ne(a.source, b.source)) return lt(a.source, b.source);
  if (ne(a.tfRank, b.tfRank)) return lt(a.tfRank, b.tfRank);
  return lt(a.key, b.key);
}
function runEpisode(lv, h, l, c, pc, atr2, bi, P = DEFAULTS) {
  const width = Math.max(lv.hi - lv.lo, requireMintick(P));
  const touch = ge(h, lv.lo) && le(l, lv.hi);
  let rej = null;
  const lastT = lv.lastTestChartBar ?? bi - P.pivotLen - 1;
  if (!lv.epActive && touch && gt(bi - lastT, P.pivotLen)) {
    lv.epActive = true;
    lv.epSide = gt(pc, lv.hi) ? 1 : lt(pc, lv.lo) ? -1 : gt(lv.polarity, 0) ? -1 : 1;
    lv.epMaxDepth = 0;
    lv.epStartQ = lv.q;
    lv.epStartBar = bi;
  }
  if (lv.epActive) {
    const depth = lt(lv.epSide, 0) ? (h - lv.lo) / width : (lv.hi - l) / width;
    lv.epMaxDepth = Math.max(lv.epMaxDepth, clamp(depth, 0, 1));
    const exitNear = lt(lv.epSide, 0) ? lt(c, lv.lo) : gt(c, lv.hi);
    if (exitNear) {
      const exc = lt(lv.epSide, 0) ? lv.lo - c : c - lv.hi;
      rej = clamp(exc / (P.rejAtrK * atr2), 0, 1);
      lv.mitigation += lv.epMaxDepth * (1 - rej) * P.mitAlpha;
      lv.evidence = Math.min(3, lv.evidence + rej);
      lv.tests += 1;
      lv.lastTestChartBar = bi;
      lv.epActive = false;
    }
  }
  return rej;
}
function acceptBreak(lv, bi, ev) {
  ev.log.push({ k: "accepted", key: lv.key, dir: lv.breakDir, armed: !!lv.navArmed, fromFlip: !!lv.breakFromFlip });
  if (lv.navArmed) {
    if (gt(lv.breakDir, 0)) ev.acceptedUp = true;
    else ev.acceptedDn = true;
  }
  if (lv.breakFromFlip) {
    lv.state = ST.DEAD;
    lv.navArmed = false;
  } else {
    lv.state = ST.BROKEN;
    lv.stateChartBar = bi;
    lv.epActive = false;
    lv.backCloses = 0;
  }
}
function markRejection(lv, rej, ev, inSlot) {
  if (ne(rej, null)) ev.log.push({ k: "test", key: lv.key, rej, side: lv.epSide, inSlot: !!inSlot, state: lv.state, epStartQ: lv.epStartQ, epStartBar: lv.epStartBar });
  if (ne(rej, null) && ge(rej, 0.5) && inSlot) {
    if (lt(lv.epSide, 0)) ev.rejectR = true;
    else ev.rejectS = true;
  }
}
function newEvents() {
  return { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, flipConfirmed: false, rejectR: false, rejectS: false, log: [] };
}
function updateLevel(lv, bar, pc, atr2, bi, ev, inSlot, P = DEFAULTS) {
  const { o, h, l, c } = bar;
  const buf = P.breakBufK * atr2;
  const st = lv.state;
  if (eq(st, ST.ACTIVE) || eq(st, ST.FLIP)) {
    const dir = gt(lv.polarity, 0) ? 1 : -1;
    const beyond = gt(dir, 0) ? gt(c, lv.hi + buf) : lt(c, lv.lo - buf);
    if (beyond) {
      if (lv.epActive) {
        lv.epActive = false;
        lv.tests += 1;
        lv.lastTestChartBar = bi;
      }
      lv.breakDir = dir;
      lv.breakFromFlip = eq(st, ST.FLIP);
      lv.breakCloses = 1;
      lv.stateChartBar = bi;
      lv.state = ST.BREAKING;
      lv.navArmed = inSlot;
      lv.everBreaking = true;
      ev.log.push({ k: "breaking", key: lv.key, dir, inSlot: !!inSlot, fromFlip: lv.breakFromFlip });
      if (inSlot) {
        if (gt(dir, 0)) ev.breakingUp = true;
        else ev.breakingDn = true;
      }
      const strongBody = ge(Math.abs(c - o), P.dispBodyK * atr2) && (gt(dir, 0) ? gt(c, o) : lt(c, o));
      if (strongBody) acceptBreak(lv, bi, ev);
    } else {
      const rej = runEpisode(lv, h, l, c, pc, atr2, bi, P);
      markRejection(lv, rej, ev, inSlot);
      if (ge(lv.mitigation, 1)) {
        lv.state = ST.DEAD;
        lv.navArmed = false;
        ev.log.push({ k: "mitigated", key: lv.key });
      }
    }
  } else if (eq(st, ST.BREAKING)) {
    const dir = lv.breakDir;
    const beyond = gt(dir, 0) ? gt(c, lv.hi + buf) : lt(c, lv.lo - buf);
    const back = gt(dir, 0) ? lt(c, lv.lo) : gt(c, lv.hi);
    if (beyond && gt(bi, lv.stateChartBar)) {
      lv.breakCloses += 1;
      if (ge(lv.breakCloses, 2)) acceptBreak(lv, bi, ev);
    } else if (back) {
      lv.state = lv.breakFromFlip ? ST.FLIP : ST.ACTIVE;
      ev.log.push({ k: "failedAcceptance", key: lv.key, dir, toState: lv.state, armed: !!lv.navArmed });
      lv.tests += 1;
      lv.evidence = Math.min(3, lv.evidence + 0.5);
      lv.lastTestChartBar = bi;
      lv.navArmed = false;
    } else if (ge(bi - lv.stateChartBar, P.BREAK_WINDOW)) {
      lv.state = lv.breakFromFlip ? ST.FLIP : ST.ACTIVE;
      ev.log.push({ k: "breakExpired", key: lv.key, dir, toState: lv.state });
      lv.navArmed = false;
    }
  } else if (eq(st, ST.BROKEN)) {
    const dir = lv.breakDir;
    if (lv.navArmed && gt(bi - lv.stateChartBar, P.flipWindow)) lv.navArmed = false;
    const backBeyond = gt(dir, 0) ? lt(c, lv.lo - buf) : gt(c, lv.hi + buf);
    if (backBeyond) {
      const strongBack = ge(Math.abs(c - o), P.dispBodyK * atr2) && (gt(dir, 0) ? lt(c, o) : gt(c, o));
      if (eq(lv.backCloses, 0) || gt(bi - (lv.backStartChartBar ?? bi), P.BREAK_WINDOW)) {
        lv.backCloses = 1;
        lv.backStartChartBar = bi;
      } else lv.backCloses += 1;
      if (strongBack || ge(lv.backCloses, 2)) {
        lv.state = ST.DEAD;
        lv.navArmed = false;
        ev.log.push({ k: "brokenBack", key: lv.key, dir });
      }
    } else {
      const rej = runEpisode(lv, h, l, c, pc, atr2, bi, P);
      if (ne(rej, null) && ge(rej, 0.5) && eq(lv.epSide, dir) && le(bi - lv.stateChartBar, P.flipWindow)) {
        lv.polarity = -lv.polarity;
        lv.s = Math.min(100, lv.s + 8);
        lv.state = ST.FLIP;
        if (lv.navArmed) ev.flipConfirmed = true;
        ev.log.push({ k: "flip", key: lv.key, dir, rej, armed: !!lv.navArmed, newPolarity: lv.polarity, epStartQ: lv.epStartQ, epStartBar: lv.epStartBar });
        lv.navArmed = false;
      }
      markRejection(lv, rej, ev, inSlot);
      if (ge(lv.mitigation, 1)) {
        lv.state = ST.DEAD;
        lv.navArmed = false;
        ev.log.push({ k: "mitigated", key: lv.key });
      }
    }
  }
  return lv.state;
}
var gapBetween = (aLo, aHi, bLo, bHi) => gt(aLo, bHi) ? aLo - bHi : gt(bLo, aHi) ? bLo - aHi : -1;
function sameEvent(a, b, ctx, P = DEFAULTS) {
  if (eq(a.tfRank, b.tfRank)) return false;
  const [f, c] = lt(a.tfRank, b.tfRank) ? [a, b] : [b, a];
  if (eq(a.source, SRC.DOZ) || eq(b.source, SRC.DOZ) || ne(a.typ, b.typ) || eq(c.tfRank, TF.LOCAL)) return false;
  const cAtr = eq(c.tfRank, TF.A1) ? ctx.atrA1 : ctx.atrA2;
  const cDurMs = (eq(c.tfRank, TF.A1) ? ctx.a1Sec : ctx.a2Sec) * 1e3;
  if (cAtr == null) return false;
  return ge(f.birthTime, c.birthTime) && lt(f.birthTime, c.birthTime + cDurMs) && le(Math.abs(f.price - c.price), P.eventEpsK * cAtr);
}
function packComponent(srt, mz, zones, a, b, mg, maxW, tel, ctx, P) {
  for (; ; ) {
    let best = -1;
    for (let i = a; le(i, b); i++) if (eq(mz[i], -2) && (lt(best, 0) || precedes(srt[i], srt[best]))) best = i;
    if (lt(best, 0)) break;
    const m = srt[best];
    const firstZ = zones.componentStart;
    let blocked = ge(zones.length, P.ZONE_CAP);
    for (let z = firstZ; lt(z, zones.length) && !blocked; z++) {
      if (lt(gapBetween(m.lo, m.hi, zones[z].lo, zones[z].hi), mg)) blocked = true;
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
    for (; ; ) {
      let cand = -1;
      for (let i = a; le(i, b); i++) {
        if (ne(mz[i], -2)) continue;
        const c = srt[i];
        const g = gapBetween(c.lo, c.hi, zn.lo, zn.hi);
        const nlo = Math.min(zn.lo, c.lo);
        const nhi = Math.max(zn.hi, c.hi);
        let ok = le(g, mg) && le(nhi - nlo, zn.wz);
        for (let z = firstZ; lt(z, zi) && ok; z++) if (lt(gapBetween(nlo, nhi, zones[z].lo, zones[z].hi), mg)) ok = false;
        if (ok && (lt(cand, 0) || precedes(c, srt[cand]))) cand = i;
      }
      if (lt(cand, 0)) break;
      zn.lo = Math.min(zn.lo, srt[cand].lo);
      zn.hi = Math.max(zn.hi, srt[cand].hi);
      mz[cand] = zi;
    }
  }
}
function aggregateZone(zn, ctx, P) {
  const ord = zn.members.slice();
  for (let x = 0; lt(x, ord.length - 1); x++) {
    let bp = x;
    for (let y = x + 1; lt(y, ord.length); y++) if (precedes(ord[y], ord[bp])) bp = y;
    if (ne(bp, x)) [ord[x], ord[bp]] = [ord[bp], ord[x]];
  }
  zn.members = ord;
  zn.primary = ord[0];
  zn.hasA1 = ord.some((l) => eq(l.tfRank, TF.A1));
  zn.hasA2 = ord.some((l) => eq(l.tfRank, TF.A2));
  zn.hasFlip = ord.some((l) => eq(l.state, ST.FLIP));
  const memberGroup = [];
  const groups = [];
  for (let j = 0; lt(j, ord.length); j++) {
    let joined = -1;
    for (let k = 0; lt(k, j) && lt(joined, 0); k++) if (sameEvent(ord[j], ord[k], ctx, P)) joined = memberGroup[k];
    if (lt(joined, 0)) {
      joined = groups.length;
      groups.push({ prim: ord[j], tf: /* @__PURE__ */ new Set() });
    }
    memberGroup.push(joined);
    groups[joined].tf.add(ord[j].tfRank);
  }
  let bestG = 0;
  for (const g of groups) {
    const tfc = g.tf.size;
    bestG = Math.max(bestG, g.prim.q + (ge(tfc, 3) ? 12 : eq(tfc, 2) ? 8 : 0));
  }
  const credible = groups.filter((g) => ge(g.prim.q, P.qStay)).length;
  const conf = gt(credible, 1) ? Math.min(12, 12 * (1 - Math.pow(0.5, credible - 1))) : 0;
  zn.groups = groups.length;
  zn.gateQ = Math.min(100, bestG + conf);
  zn.displayQ = zn.gateQ;
}
function buildZones(levels, ctx, P = DEFAULTS) {
  const tel = { suppressed: [] };
  const work = levels.filter((l) => l && ne(l.state, ST.DEAD));
  const srt = work.slice().sort((x, y) => x.lo - y.lo);
  const n = srt.length;
  const mg = P.mergeGapK * ctx.atr;
  const maxW = P.maxWidthK * ctx.atr;
  const mz = new Array(n).fill(-2);
  const zones = [];
  if (gt(n, 0)) {
    let cStart = 0;
    let cHi = srt[0].hi;
    for (let i = 1; le(i, n); i++) {
      const boundary = eq(i, n) ? true : gt(srt[i].lo, cHi + mg);
      if (boundary) {
        zones.componentStart = zones.length;
        packComponent(srt, mz, zones, cStart, i - 1, mg, maxW, tel, ctx, P);
        cStart = i;
        if (lt(i, n)) cHi = srt[i].hi;
      } else cHi = Math.max(cHi, srt[i].hi);
    }
  }
  for (const z of zones) z.members = [];
  for (let i = 0; lt(i, n); i++) if (ge(mz[i], 0)) zones[mz[i]].members.push(srt[i]);
  for (const z of zones) aggregateZone(z, ctx, P);
  const sorted = zones.slice().sort((x, y) => x.lo - y.lo);
  const tol = Math.abs(ctx.close) * 1e-9 + requireMintick(P) * 1e-6;
  const violations = checkBuilderInvariants(sorted, tel.suppressed, n, mg, tol);
  return { zones: sorted, suppressed: tel.suppressed, violations };
}
function checkBuilderInvariants(zones, suppressed, n, mg, tol) {
  const v = [];
  let contributing = 0;
  for (let i = 0; lt(i, zones.length); i++) {
    const z = zones[i];
    contributing += z.members.length;
    if (lt(z.members.length, 1)) v.push("I6_NO_MEMBER");
    if (gt(z.lo, z.hi)) v.push("I1_BOUNDS");
    if (gt(z.hi - z.lo, z.wz + tol)) v.push("I3_WIDTH");
    const ulo = Math.min(...z.members.map((m) => m.lo));
    const uhi = Math.max(...z.members.map((m) => m.hi));
    if (ne(ulo, z.lo) || ne(uhi, z.hi)) v.push("I4_UNION");
    for (const m of z.members) if (lt(m.lo, z.lo - tol) || gt(m.hi, z.hi + tol)) v.push("I5_CORE_OUTSIDE");
    if (gt(i, 0)) {
      if (ge(zones[i - 1].hi, z.lo)) v.push("I1_OVERLAP");
      if (lt(z.lo - zones[i - 1].hi, mg - tol)) v.push("I2_GAP");
    }
  }
  if (ne(contributing + suppressed.length, n)) v.push("I5_ACCOUNTING");
  return v;
}
function emptySlot() {
  return { active: false, containing: false, lo: null, hi: null, side: 0, quality: 0, gateQ: 0, primaryKey: 0, entryKeys: [], lastKeys: [] };
}
function containEntrySide(zn, ringC, P) {
  const kEnd = Math.min(P.L_ENTRY, ringC.length - 1);
  for (let k = 1; le(k, kEnd); k++) {
    if (gt(ringC[k], zn.hi)) return 1;
    if (lt(ringC[k], zn.lo)) return -1;
  }
  return gt(zn.primary.polarity, 0) ? -1 : 1;
}
function selectSlots(zones, slots, ctx, P = DEFAULTS) {
  checkParams(P);
  const close = ctx.close;
  const hLocal = P.kLocal * ctx.atr;
  const reachA1 = ctx.atrA1 == null ? 0 : P.kA1 * ctx.atrA1;
  const reachA2 = ctx.atrA2 == null ? 0 : P.kA2 * ctx.atrA2;
  let containIdx = -1;
  let containCount = 0;
  const v = [];
  zones.forEach((zn, z) => {
    zn.side = gt(zn.lo, close) ? SIDE.ABOVE : lt(zn.hi, close) ? SIDE.BELOW : SIDE.CONTAIN;
    zn.dist = eq(zn.side, SIDE.ABOVE) ? zn.lo - close : eq(zn.side, SIDE.BELOW) ? close - zn.hi : 0;
    zn.privSlot = -1;
    for (let si = 0; lt(si, 4) && lt(zn.privSlot, 0); si++) {
      const ss = slots[si];
      if (ss.active && zn.members.some((m) => ss.entryKeys.includes(m.key))) zn.privSlot = si;
    }
    zn.eligible = gt(zn.members.length, 0) && ge(zn.gateQ, ge(zn.privSlot, 0) ? P.qStay : P.qEnter);
    if (eq(zn.side, SIDE.CONTAIN)) {
      containCount += 1;
      containIdx = z;
    }
  });
  if (gt(containCount, 1)) v.push("I8_MULTI_CONTAIN");
  let rStarUp = hLocal, rStarDn = hLocal, holdUp = 0, holdDn = 0;
  for (const zn of zones) {
    if (!zn.eligible || eq(zn.side, SIDE.CONTAIN)) continue;
    const justified = zn.hasA1 && le(zn.dist, reachA1) || zn.hasA2 && le(zn.dist, reachA2);
    if (eq(zn.side, SIDE.ABOVE)) {
      if (justified) rStarUp = Math.max(rStarUp, zn.dist);
      if (ge(zn.privSlot, 0)) holdUp = Math.max(holdUp, zn.dist);
    } else {
      if (justified) rStarDn = Math.max(rStarDn, zn.dist);
      if (ge(zn.privSlot, 0)) holdDn = Math.max(holdDn, zn.dist);
    }
  }
  const rEffUp = Math.max(rStarUp, Math.min(holdUp, 1.25 * rStarUp));
  const rEffDn = Math.max(rStarDn, Math.min(holdDn, 1.25 * rStarDn));
  let containEntry = 0;
  if (ge(containIdx, 0) && zones[containIdx].eligible) containEntry = containEntrySide(zones[containIdx], ctx.ringC, P);
  const rList = [];
  const sList = [];
  if (lt(containEntry, 0)) rList.push(containIdx);
  if (gt(containEntry, 0)) sList.push(containIdx);
  zones.forEach((zn, z) => {
    if (zn.eligible && eq(zn.side, SIDE.ABOVE) && le(zn.dist, rEffUp)) rList.push(z);
  });
  for (let z = zones.length - 1; ge(z, 0); z--) {
    const zn = zones[z];
    if (zn.eligible && eq(zn.side, SIDE.BELOW) && le(zn.dist, rEffDn)) sList.push(z);
  }
  const pick = [rList[0] ?? -1, rList[1] ?? -1, sList[0] ?? -1, sList[1] ?? -1];
  checkSelectionInvariants(zones, pick, close, rEffUp, rEffDn, containEntry, v);
  const next = pick.map((z, si) => {
    if (lt(z, 0)) return emptySlot();
    const zn = zones[z];
    const keys = zn.members.map((m) => m.key);
    const lastKeys = keys.slice();
    let entryKeys;
    if (ge(zn.privSlot, 0)) entryKeys = slots[zn.privSlot].entryKeys.filter((k) => keys.includes(k));
    else entryKeys = keys.slice();
    return {
      active: true,
      containing: eq(zn.side, SIDE.CONTAIN),
      lo: zn.lo,
      hi: zn.hi,
      side: zn.side,
      quality: zn.displayQ,
      gateQ: zn.gateQ,
      primaryKey: zn.primary.key,
      entryKeys,
      lastKeys,
      zoneIndex: z,
      isRes: lt(si, 2)
    };
  });
  return { next, pick, rEffUp, rEffDn, rStarUp, rStarDn, containEntry, violations: v };
}
function checkSelectionInvariants(zones, pick, close, rEffUp, rEffDn, containEntry, v) {
  const [r1, r2, s1, s2] = pick;
  if (ge(r2, 0) && lt(r1, 0) || ge(s2, 0) && lt(s1, 0)) v.push("I10_ORDER");
  const used = pick.filter((z) => ge(z, 0));
  if (ne(new Set(used).size, used.length)) v.push("I10_DUP_SLOT");
  if (ge(r1, 0) && ge(r2, 0)) {
    const a = zones[r1], b = zones[r2];
    if (!(lt(a.hi, b.lo) && (eq(a.side, SIDE.CONTAIN) || gt(a.lo, close)))) v.push("I9_R_ORDER");
  }
  if (ge(s1, 0) && ge(s2, 0)) {
    const a = zones[s1], b = zones[s2];
    if (!(gt(a.lo, b.hi) && (eq(a.side, SIDE.CONTAIN) || lt(a.hi, close)))) v.push("I9_S_ORDER");
  }
  let maxSelUp = -1, maxSelDn = -1, selUp = 0, selDn = 0;
  zones.forEach((zn, z) => {
    if ((eq(z, r1) || eq(z, r2)) && eq(zn.side, SIDE.ABOVE)) {
      maxSelUp = Math.max(maxSelUp, zn.dist);
      selUp++;
    }
    if ((eq(z, s1) || eq(z, s2)) && eq(zn.side, SIDE.BELOW)) {
      maxSelDn = Math.max(maxSelDn, zn.dist);
      selDn++;
    }
  });
  const capUp = lt(containEntry, 0) ? 1 : 2;
  const capDn = gt(containEntry, 0) ? 1 : 2;
  zones.forEach((zn, z) => {
    if (used.includes(z) || !zn.eligible) return;
    if (eq(zn.side, SIDE.ABOVE) && le(zn.dist, rEffUp)) {
      if (lt(selUp, capUp)) v.push("I12_EMPTY_UP");
      if (lt(zn.dist, maxSelUp)) v.push("I11_SKIP_UP");
    }
    if (eq(zn.side, SIDE.BELOW) && le(zn.dist, rEffDn)) {
      if (lt(selDn, capDn)) v.push("I12_EMPTY_DN");
      if (lt(zn.dist, maxSelDn)) v.push("I11_SKIP_DN");
    }
  });
}
function computeSeries(bars, P = DEFAULTS) {
  const mintick = requireMintick(P);
  const n = bars.length;
  const tr = bars.map((b, i) => eq(i, 0) ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)));
  const atrEng = new Array(n);
  let sum = 0;
  for (let i = 0; lt(i, n); i++) {
    sum += tr[i];
    if (ge(i, P.ATR_ENG_LEN)) sum -= tr[i - P.ATR_ENG_LEN];
    atrEng[i] = Math.max(ge(i, P.ATR_ENG_LEN - 1) ? sum / P.ATR_ENG_LEN : tr[i], mintick);
  }
  const L = P.pivotLen;
  const swingPH = new Array(n).fill(null);
  const swingPL = new Array(n).fill(null);
  for (let i = 2 * L; lt(i, n); i++) {
    const p = i - L;
    let isH = true, isL = true;
    for (let k = 1; le(k, L); k++) {
      if (!(ge(bars[p].h, bars[p - k].h) && gt(bars[p].h, bars[p + k].h))) isH = false;
      if (!(le(bars[p].l, bars[p - k].l) && lt(bars[p].l, bars[p + k].l))) isL = false;
    }
    if (isH) swingPH[i] = bars[p].h;
    if (isL) swingPL[i] = bars[p].l;
  }
  return { atrEng, swingPH, swingPL };
}
function engineWindowFor(P = DEFAULTS, chartSec = 60, a1Sec = 300, a2Sec = 900) {
  const tMax = Math.max(P.maxAge[0], P.maxAge[1] * a1Sec / chartSec, P.maxAge[2] * a2Sec / chartSec);
  return 2 * Math.ceil(tMax) + P.L_ENTRY + P.N_LEG + P.pivotLen + 10;
}
var Engine = class {
  constructor(bars, series, P = DEFAULTS, opts = {}) {
    checkParams(P);
    this.bars = bars;
    this.series = series;
    this.P = P;
    this.startBar = opts.startBar ?? 0;
    this.anchorFeed = opts.anchorFeed ?? null;
    this.a1Sec = opts.a1Sec ?? 300;
    this.a2Sec = opts.a2Sec ?? 900;
    this.local = [];
    this.anchorsA1 = [];
    this.anchorsA2 = [];
    this.slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
    this.ring = [];
    this.lastSwingHigh = { px: null, bar: null, broken: true };
    this.lastSwingLow = { px: null, bar: null, broken: true };
    this.violations = [];
    this.suppressedTotal = 0;
    this.lastZones = [];
  }
  allLevels() {
    return [...this.local, ...this.anchorsA1, ...this.anchorsA2];
  }
  inPrevSlots(k) {
    return this.slots.some((s) => s.active && s.lastKeys.includes(k));
  }
  admitLocal(lv) {
    if (this.local.some((x) => eq(x.key, lv.key))) {
      this.violations.push("DUP_KEY");
      return;
    }
    this.local.push(lv);
  }
  step(i) {
    if (lt(i, this.startBar)) return null;
    const P = this.P, bars = this.bars, b = bars[i];
    const mintick = requireMintick(P);
    const atr2 = this.series.atrEng[i];
    const pc = gt(i, 0) ? bars[i - 1].c : b.c;
    const rawFeed = this.anchorFeed ? this.anchorFeed(i) : { now: [null, null, null], atrA1: null, atrA2: null, items: [] };
    const feed = { ...rawFeed, atrA1: floorTickOrNull(rawFeed.atrA1, mintick), atrA2: floorTickOrNull(rawFeed.atrA2, mintick) };
    const ev = newEvents();
    this.ring.unshift(b);
    if (gt(this.ring.length, P.RING_LEN)) this.ring.pop();
    for (const pool of [this.local, this.anchorsA1, this.anchorsA2]) {
      for (const lv of pool) {
        const nowN = eq(lv.tfRank, TF.LOCAL) ? i : feed.now[lv.tfRank];
        if (nowN != null) {
          lv.ageNative = nowN - lv.birthNativeBar;
          if (lt(lv.ageNative, 0)) this.violations.push("AGE_NEGATIVE");
          if (gt(lv.ageNative, P.maxAge[lv.tfRank])) {
            lv.state = ST.DEAD;
            lv.navArmed = false;
          }
        }
        if (ne(lv.state, ST.DEAD)) updateLevel(lv, b, pc, atr2, i, ev, this.inPrevSlots(lv.key), P);
      }
    }
    this.local = this.local.filter((l) => ne(l.state, ST.DEAD));
    const ringO = this.ring.map((r) => r.o), ringH = this.ring.map((r) => r.h), ringL = this.ring.map((r) => r.l), ringC = this.ring.map((r) => r.c);
    const body = Math.abs(b.c - b.o);
    const sh = this.lastSwingHigh, sl = this.lastSwingLow;
    if (sh.px != null && !sh.broken && gt(b.c, sh.px)) {
      sh.broken = true;
      if (P.useDOZ && le(i - sh.bar, P.maxAge[0]) && gt(b.c, b.o) && ge(body, P.dispBodyK * atr2) && le(pc, sh.px)) {
        const d = dozBuild(true, ringO, ringH, ringL, ringC, atr2, P);
        if (d.ok) this.admitLocal(makeLevel({ key: memberKeyOf(b.t, SRC.DOZ, TF.LOCAL, TYP.LOW), lo: d.lo, hi: d.hi, price: d.lo, source: SRC.DOZ, tfRank: TF.LOCAL, typ: TYP.LOW, polarity: -1, birthNativeBar: i, birthTime: b.t, birthAtr: atr2, s: clamp100(58 + Math.min(30, (body / atr2 - P.dispBodyK) * 30) + (d.fvg ? 6 : 0)), lastTestChartBar: i, stateChartBar: i }));
      }
    }
    if (sl.px != null && !sl.broken && lt(b.c, sl.px)) {
      sl.broken = true;
      if (P.useDOZ && le(i - sl.bar, P.maxAge[0]) && lt(b.c, b.o) && ge(body, P.dispBodyK * atr2) && ge(pc, sl.px)) {
        const d = dozBuild(false, ringO, ringH, ringL, ringC, atr2, P);
        if (d.ok) this.admitLocal(makeLevel({ key: memberKeyOf(b.t, SRC.DOZ, TF.LOCAL, TYP.HIGH), lo: d.lo, hi: d.hi, price: d.hi, source: SRC.DOZ, tfRank: TF.LOCAL, typ: TYP.HIGH, polarity: 1, birthNativeBar: i, birthTime: b.t, birthAtr: atr2, s: clamp100(58 + Math.min(30, (body / atr2 - P.dispBodyK) * 30) + (d.fvg ? 6 : 0)), lastTestChartBar: i, stateChartBar: i }));
      }
    }
    const L = P.pivotLen;
    if (this.series.swingPH[i] != null) {
      const p = i - L, px = this.series.swingPH[i];
      const sAtr = Math.max(this.series.atrEng[p], mintick);
      const bodyTop = Math.max(bars[p].o, bars[p].c);
      const w = Math.max(0.1 * sAtr, Math.min(0.5 * sAtr, px - bodyTop));
      let rightLow = Infinity;
      for (let k = p; le(k, i); k++) rightLow = Math.min(rightLow, bars[k].l);
      this.admitLocal(makeLevel({ key: memberKeyOf(bars[p].t, SRC.SWING, TF.LOCAL, TYP.HIGH), lo: px - w, hi: px, price: px, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthNativeBar: p, birthTime: bars[p].t, birthAtr: sAtr, s: clamp100(45 + Math.min(38, (px - rightLow) / sAtr * 16)), lastTestChartBar: i, stateChartBar: i, ageNative: L }));
      Object.assign(sh, { px, bar: p, broken: false });
    }
    if (this.series.swingPL[i] != null) {
      const p = i - L, px = this.series.swingPL[i];
      const sAtr = Math.max(this.series.atrEng[p], mintick);
      const bodyBot = Math.min(bars[p].o, bars[p].c);
      const w = Math.max(0.1 * sAtr, Math.min(0.5 * sAtr, bodyBot - px));
      let rightHigh = -Infinity;
      for (let k = p; le(k, i); k++) rightHigh = Math.max(rightHigh, bars[k].h);
      this.admitLocal(makeLevel({ key: memberKeyOf(bars[p].t, SRC.SWING, TF.LOCAL, TYP.LOW), lo: px, hi: px + w, price: px, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.LOW, birthNativeBar: p, birthTime: bars[p].t, birthAtr: sAtr, s: clamp100(45 + Math.min(38, (rightHigh - px) / sAtr * 16)), lastTestChartBar: i, stateChartBar: i, ageNative: L }));
      Object.assign(sl, { px, bar: p, broken: false });
    }
    for (const [tf, pool] of [[TF.A1, this.anchorsA1], [TF.A2, this.anchorsA2]]) {
      const items = feed.items.filter((it) => eq(it.tfRank, tf));
      const keys = feedKeysOf(items);
      syncAnchorPool(pool, keys, feed.now[tf] != null, P);
      for (const it of items) upsertAnchor(pool, it, feed.now[tf], eq(tf, TF.A1) ? feed.atrA1 : feed.atrA2, atr2, i, P);
      if (gt(pool.length, P.ANCHOR_FEED_MAX)) this.violations.push("ANCHOR_POOL_SIZE");
    }
    evictOldest(this.local, P.LOCAL_CAP);
    for (const lv of this.allLevels()) lv.q = eq(lv.state, ST.DEAD) ? 0 : levelQuality(lv, P);
    const ctx = { close: b.c, atr: atr2, atrA1: feed.atrA1, atrA2: feed.atrA2, a1Sec: this.a1Sec, a2Sec: this.a2Sec, ringC };
    const built = buildZones(this.allLevels(), ctx, P);
    this.suppressedTotal += built.suppressed.length;
    const sel = selectSlots(built.zones, this.slots, ctx, P);
    this.violations.push(...built.violations, ...sel.violations);
    this.slots = sel.next;
    this.lastZones = built.zones;
    return { events: ev, slots: this.slots, zones: built.zones, sel, ctx };
  }
};
function feedKeysOf(items) {
  return items.filter((it) => it.price != null && it.bt != null).map((it) => memberKeyOf(it.bt, SRC.ANCHOR, it.tfRank, it.typ));
}
function syncAnchorPool(pool, feedKeys, feedOk, P = DEFAULTS) {
  for (let i = pool.length - 1; ge(i, 0); i--) {
    const lv = pool[i];
    const agedOut = eq(lv.state, ST.DEAD) && gt(lv.ageNative, P.maxAge[lv.tfRank]);
    if (agedOut || feedOk && !feedKeys.includes(lv.key)) pool.splice(i, 1);
  }
}
function upsertAnchor(pool, it, nowN, atrA, atr2, i, P = DEFAULTS) {
  if (it.price == null || it.nb == null || it.bt == null || nowN == null || atrA == null) return false;
  const age = nowN - it.nb;
  if (lt(age, 0) || gt(age, P.maxAge[it.tfRank])) return false;
  const k = memberKeyOf(it.bt, SRC.ANCHOR, it.tfRank, it.typ);
  if (pool.some((x) => eq(x.key, k))) return false;
  const w = Math.max(0.15 * atr2, Math.min(0.6 * atr2, 0.1 * atrA));
  pool.push(makeLevel({ key: k, lo: eq(it.typ, TYP.HIGH) ? it.price - w : it.price, hi: eq(it.typ, TYP.HIGH) ? it.price : it.price + w, price: it.price, source: SRC.ANCHOR, tfRank: it.tfRank, typ: it.typ, birthNativeBar: it.nb, birthTime: it.bt, birthAtr: atr2, s: eq(it.tfRank, TF.A1) ? 70 : 78, lastTestChartBar: i, stateChartBar: i, ageNative: age }));
  return true;
}
function evictOldest(pool, cap) {
  while (gt(pool.length, cap)) {
    let oi = 0;
    for (let i = 1; lt(i, pool.length); i++) {
      const a = pool[i], b = pool[oi];
      if (lt(a.birthTime, b.birthTime) || eq(a.birthTime, b.birthTime) && lt(a.key, b.key)) oi = i;
    }
    pool.splice(oi, 1);
  }
}
function dozBuild(bull, rO, rH, rL, rC, atr2, P = DEFAULTS) {
  const n = rC.length;
  if (lt(n, 3)) return { ok: false };
  const legN = Math.min(P.N_LEG, n);
  let s0 = 0;
  let ext = bull ? rL[0] : rH[0];
  for (let k = 1; lt(k, legN); k++) {
    const v = bull ? rL[k] : rH[k];
    if (bull ? le(v, ext) : ge(v, ext)) {
      ext = v;
      s0 = k;
    }
  }
  let path = Math.abs(rC[s0] - ext);
  for (let j = 0; lt(j, s0); j++) path += Math.abs(rC[j] - rC[j + 1]);
  const net = bull ? rC[0] - ext : ext - rC[0];
  const eff = gt(path, 0) ? Math.min(1, net / path) : 0;
  let o = s0;
  const oEnd = Math.min(s0 + P.M_ORIGIN, n - 1);
  for (let k = s0; le(k, oEnd); k++) {
    if (bull ? lt(rC[k], rO[k]) : gt(rC[k], rO[k])) {
      o = k;
      break;
    }
  }
  const rawLo = bull ? rL[o] : Math.min(rO[o], rC[o]);
  const rawHi = bull ? Math.max(rO[o], rC[o]) : rH[o];
  const w = Math.max(0.15 * atr2, Math.min(0.8 * atr2, rawHi - rawLo));
  return {
    ok: ge(eff, P.legEff),
    lo: bull ? rawLo : rawHi - w,
    hi: bull ? rawLo + w : rawHi,
    fvg: bull ? gt(rL[0], rH[2]) : lt(rH[0], rL[2])
  };
}

// ../../gtg-strategy-lab/gtg-engine/reference/engine.mjs
var SRC2 = Object.freeze({ SWING: 0, DOZ: 1, ANCHOR: 2 });
var TF2 = Object.freeze({ LOCAL: 0, A1: 1, A2: 2 });
var TYP2 = Object.freeze({ HIGH: 0, LOW: 1 });
var ST2 = Object.freeze({ ACTIVE: 0, BREAKING: 1, BROKEN: 2, FLIP: 3, DEAD: 4 });
var SIDE2 = Object.freeze({ BELOW: -1, CONTAIN: 0, ABOVE: 1 });
var DEFAULTS2 = Object.freeze({
  qEnter: 55,
  qStay: 45,
  kLocal: 8,
  kA1: 2.5,
  kA2: 2,
  kTact: 6,
  mergeGapK: 0.35,
  maxWidthK: 1,
  mitAlpha: 0.6,
  rejAtrK: 1,
  breakBufK: 0.1,
  dispBodyK: 0.8,
  legEff: 0.55,
  eventEpsK: 0.15,
  pivotLen: 3,
  maxAge: [720, 96, 64],
  flipWindow: 60,
  L_ENTRY: 40,
  N_LEG: 10,
  M_ORIGIN: 3,
  BREAK_WINDOW: 3,
  RING_LEN: 64,
  LOCAL_CAP: 48,
  ANCHOR_FEED_MAX: 6,
  ZONE_CAP: 64,
  ATR_ENG_LEN: 20,
  useDOZ: true
});

// ../../gtg-strategy-lab/gtg-engine/reference/snapshot.mjs
var SLOT_NAMES = Object.freeze(["R1", "R2", "S1", "S2"]);
var LEVELS = Object.freeze(["geometry", "identity", "state", "events"]);
var EVENT_NAMES = Object.freeze(["breakingUp", "breakingDn", "acceptedUp", "acceptedDn", "rejectR", "rejectS", "flipConfirmed"]);

// ../../gtg-strategy-lab/gtg-engine/reference/history.mjs
function htfFeedValues(htf, tfRank, plen = 3, atrLen = 20) {
  const n = htf.length;
  const tr = htf.map((b, j) => j === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - htf[j - 1].c), Math.abs(b.l - htf[j - 1].c)));
  const vals = new Array(n);
  const hs = [], ls = [];
  let sum = 0;
  for (let j = 0; j < n; j++) {
    sum += tr[j];
    if (j >= atrLen) sum -= tr[j - atrLen];
    if (j >= 2 * plen) {
      const p = j - plen;
      let isH = true, isL = true;
      for (let k = 1; k <= plen; k++) {
        if (!(htf[p].h >= htf[p - k].h && htf[p].h > htf[p + k].h)) isH = false;
        if (!(htf[p].l <= htf[p - k].l && htf[p].l < htf[p + k].l)) isL = false;
      }
      if (isH) hs.push({ price: htf[p].h, nb: p, bt: htf[p].t });
      if (isL) ls.push({ price: htf[p].l, nb: p, bt: htf[p].t });
    }
    vals[j] = {
      now: j,
      atr: j >= atrLen - 1 ? sum / atrLen : null,
      items: [...hs.slice(-3).map((x) => ({ ...x, typ: TYP2.HIGH, tfRank })), ...ls.slice(-3).map((x) => ({ ...x, typ: TYP2.LOW, tfRank }))]
    };
  }
  return vals;
}

// ../../gtg-strategy-lab/engine/profiles.mjs
var INPUTS = Object.freeze({
  maType: "EMA",
  speedSmooth: 3,
  speedAccelLookback: 3,
  speedSlowThreshold: 25,
  speedFastThreshold: 70,
  speedExtremeThreshold: 90,
  headingLookback: 14,
  headingSlopeLookback: 8,
  headingClearThreshold: 20,
  headingStrongThreshold: 60,
  headingDeadZone: 15,
  routeClearThreshold: 22,
  routeStrongThreshold: 62,
  fuelSmooth: 3,
  fuelBaselineLen: 50,
  fuelLowThreshold: 25,
  fuelHighThreshold: 70,
  fuelExtremeThreshold: 90,
  nearObstacleAtr: 0.35,
  awarenessObstacleAtr: 0.85,
  noChaseAtr: 0.3,
  noChaseFuelMax: 65,
  strongQ: 72,
  mediumQ: 48
});
var TF_MIN = Object.freeze({ M1: 1, M5: 5, M15: 15, H1: 60, H4: 240, D: 1440 });
var TF_OF_PINE = Object.freeze({ "1": "M1", "5": "M5", "15": "M15", "60": "H1", "240": "H4", D: "D" });
function profileFor(tf) {
  const m = TF_MIN[tf];
  if (!m || tf === "D") throw new Error(`unsupported lab timeframe ${tf}`);
  const autoHTF = m <= 1 ? "15" : m <= 5 ? "60" : m <= 15 ? "60" : m <= 60 ? "240" : "D";
  const rankLen = m <= 1 ? 1e3 : m <= 5 ? 500 : m <= 15 ? 320 : m <= 60 ? 240 : m <= 240 ? 180 : 160;
  const speedFlowLen = m <= 1 ? 8 : m <= 5 ? 6 : m <= 15 ? 5 : m <= 60 ? 4 : 3;
  const htfWeight = m <= 1 ? 0.7 : m <= 5 ? 0.65 : m <= 15 ? 0.6 : m <= 60 ? 0.55 : 0.45;
  const { headingLookback: hl, headingSlopeLookback: hs } = INPUTS;
  const headingEffLen = m <= 1 ? Math.min(hl, 8) : m <= 5 ? Math.min(hl, 10) : m <= 15 ? Math.min(hl, 12) : hl;
  const headingSlopeEffLen = m <= 1 ? Math.min(hs, 4) : m <= 5 ? Math.min(hs, 5) : m <= 15 ? Math.min(hs, 6) : hs;
  const microLen = m <= 1 ? 3 : m <= 5 ? 3 : m <= 15 ? 4 : m <= 60 ? 5 : 6;
  const profClass = m <= 1 ? 0 : m <= 5 ? 1 : m <= 15 ? 2 : m <= 60 ? 3 : 4;
  const a1Tf = ["5", "15", "60", "240", "D"][profClass];
  const a2Tf = ["15", "60", "240", "D", "W"][profClass];
  const pivotLen = profClass === 0 ? 3 : profClass === 1 ? 4 : 5;
  const maxAgeLocal = [720, 576, 480, 360, 270][profClass];
  const flipWindow = [60, 48, 48, 72, 42][profClass];
  const secOf = (p) => p === "D" ? 86400 : p === "W" ? 604800 : Number(p) * 60;
  return Object.freeze({
    tf,
    minutes: m,
    chartSec: m * 60,
    htfTf: TF_OF_PINE[autoHTF],
    htfSec: secOf(autoHTF),
    rankLen,
    speedFlowLen,
    htfWeight,
    headingEffLen,
    headingSlopeEffLen,
    microLen,
    profClass,
    a1Tf,
    a2Tf,
    a1Sec: secOf(a1Tf),
    a2Sec: secOf(a2Tf),
    pivotLen,
    maxAgeLocal,
    flipWindow
  });
}
function zoneParams(DEFAULTS3, prof, mintick) {
  if (!(Number.isFinite(mintick) && mintick > 0)) throw new Error("mintick required");
  return Object.freeze({ ...DEFAULTS3, pivotLen: prof.pivotLen, maxAge: [prof.maxAgeLocal, 96, 64], flipWindow: prof.flipWindow, mintick });
}

// ../../gtg-strategy-lab/engine/pine-ta.mjs
var isNa = (x) => x === null || x === void 0 || Number.isNaN(x);
var nz = (x, y = 0) => isNa(x) ? y : x;
var clamp1002 = (v) => Math.max(0, Math.min(100, v));
var clampSigned = (v) => Math.max(-1, Math.min(1, v));
var hist = (arr, i, k) => i - k >= 0 ? arr[i - k] : NaN;
function sma(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  for (let i = len - 1; i < n; i++) {
    let s = 0, bad = false;
    for (let k = i - len + 1; k <= i; k++) {
      if (isNa(src[k])) {
        bad = true;
        break;
      }
      s += src[k];
    }
    out[i] = bad ? NaN : s / len;
  }
  return out;
}
function ema(src, len, seed = "sma") {
  const n = src.length, out = new Array(n).fill(NaN);
  const a = 2 / (len + 1);
  const seedSma = seed === "sma" ? sma(src, len) : null;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? out[i - 1] : NaN;
    if (isNa(prev)) out[i] = seed === "sma" ? seedSma[i] : src[i];
    else out[i] = a * src[i] + (1 - a) * nz(prev);
  }
  return out;
}
function rma(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  const a = 1 / len;
  const s = sma(src, len);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? out[i - 1] : NaN;
    out[i] = isNa(prev) ? s[i] : a * src[i] + (1 - a) * nz(prev);
  }
  return out;
}
function wma(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  const norm = len * (len + 1) / 2;
  for (let i = len - 1; i < n; i++) {
    let s = 0, bad = false;
    for (let k = 0; k < len; k++) {
      const v = src[i - k];
      if (isNa(v)) {
        bad = true;
        break;
      }
      s += v * (len - k);
    }
    out[i] = bad ? NaN : s / norm;
  }
  return out;
}
function trTrue(bars) {
  return bars.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)));
}
var atr = (bars, len) => rma(trTrue(bars), len);
function percentrank(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  for (let i = len; i < n; i++) {
    const cur = src[i];
    if (isNa(cur)) continue;
    let c = 0;
    for (let k = 1; k <= len; k++) if (src[i - k] <= cur) c++;
    out[i] = c / len * 100;
  }
  return out;
}
function maOf(type, src, len, seed) {
  if (type === "EMA") return ema(src, len, seed);
  if (type === "SMA") return sma(src, len);
  return wma(src, len);
}

// ../../gtg-strategy-lab/engine/pinecmp/sensors.mjs
function containingIndex(chartBars, htfBars) {
  const out = new Array(chartBars.length);
  let k = -1;
  for (let i = 0; lt(i, chartBars.length); i++) {
    while (lt(k + 1, htfBars.length) && le(htfBars[k + 1].t, chartBars[i].t)) k++;
    out[i] = k;
  }
  return out;
}
function htfRouteInputs(chartBars, htfBars, mintick, I, seed) {
  const c = htfBars.map((b) => b.c);
  const ma50 = maOf(I.maType, c, 50, seed), ma200 = maOf(I.maType, c, 200, seed);
  const atr14 = atr(htfBars, 14);
  const kIdx = containingIndex(chartBars, htfBars);
  const at = (arr, j) => ge(j, 0) ? arr[j] : NaN;
  return kIdx.map((k) => ({
    htfClose: at(c, k - 1),
    htfMA50: at(ma50, k - 1),
    htfMA200: at(ma200, k - 1),
    htfMA50Past: at(ma50, k - 6),
    htfATR: at(atr14, k - 1),
    htfIndex: k
  }));
}
function computeSensors(bars, htfBars, prof, mintick, { inputs = INPUTS, emaSeed = "sma", htfInputs = null } = {}) {
  const I = inputs, n = bars.length, seed = emaSeed;
  const close = bars.map((b) => b.c), open = bars.map((b) => b.o), high = bars.map((b) => b.h), low = bars.map((b) => b.l);
  const volume = bars.map((b) => b.v == null ? NaN : b.v);
  const MA = (len) => maOf(I.maType, close, len, seed);
  const ma14 = MA(14), ma22 = MA(22), ma50 = MA(50), ma200 = MA(200), ma1000 = MA(1e3);
  const atr2 = atr(bars, 14);
  const safeAtr = atr2.map((a) => Math.max(a, mintick));
  const prevClose = close.map((c, i) => nz(hist(close, i, 1), c));
  const trueRange = bars.map((b, i) => Math.max(b.h - b.l, Math.max(Math.abs(b.h - prevClose[i]), Math.abs(b.l - prevClose[i]))));
  const bodySize = bars.map((b) => Math.abs(b.c - b.o));
  const bodyAtr = bodySize.map((x, i) => x / safeAtr[i]);
  const H = htfInputs ? htfInputs.map((x) => ({ ...x, htfIndex: -1 })) : htfRouteInputs(bars, htfBars, mintick, I, seed);
  const closeStep = close.map((c, i) => Math.abs(c - prevClose[i]));
  const barTravel = closeStep.map((s, i) => 0.7 * s + 0.3 * trueRange[i]);
  const instantSpeedRaw = ema(barTravel, I.speedSmooth, seed);
  const flowSpeedRaw = ema(instantSpeedRaw, prof.speedFlowLen, seed);
  const instantSpeedRankRaw = percentrank(instantSpeedRaw, prof.rankLen);
  const flowSpeedRankRaw = percentrank(flowSpeedRaw, prof.rankLen);
  const flowFallbackBase = ema(flowSpeedRaw, Math.min(prof.rankLen, 50), seed);
  const speedScore = new Array(n), instantSpeedScore = new Array(n), speedAcceleration = new Array(n);
  for (let i = 0; lt(i, n); i++) {
    const fb = gt(flowFallbackBase[i], 0) ? clamp1002(50 * flowSpeedRaw[i] / flowFallbackBase[i]) : 50;
    speedScore[i] = nz(flowSpeedRankRaw[i], fb);
    instantSpeedScore[i] = nz(instantSpeedRankRaw[i], speedScore[i]);
    speedAcceleration[i] = speedScore[i] - nz(hist(speedScore, i, I.speedAccelLookback), speedScore[i]);
  }
  const L = prof.headingEffLen, S = prof.headingSlopeEffLen, M = prof.microLen;
  const absStep = closeStep;
  const pathTravelSma = sma(absStep, L);
  const localEma = ema(close, 14, seed), fastEma = ema(close, 5, seed);
  const signedEfficiency = new Array(n), headingScore = new Array(n), headingSign = new Array(n);
  const tacticalSign = new Array(n), microMoveNorm = new Array(n);
  for (let i = 0; lt(i, n); i++) {
    const pathTravel = pathTravelSma[i] * L;
    const net = close[i] - hist(close, i, L);
    signedEfficiency[i] = gt(pathTravel, 0) ? clampSigned(net / pathTravel) : 0;
    const localSlope = clampSigned((localEma[i] - hist(localEma, i, S)) / (safeAtr[i] * S) * 2.5);
    const micro = clampSigned((close[i] - hist(close, i, M)) / (safeAtr[i] * M) * 3);
    microMoveNorm[i] = micro;
    const maStructure = gt(ma14[i], ma22[i]) && gt(ma22[i], ma50[i]) ? 1 : lt(ma14[i], ma22[i]) && lt(ma22[i], ma50[i]) ? -1 : gt(ma14[i], ma50[i]) ? 0.35 : lt(ma14[i], ma50[i]) ? -0.35 : 0;
    const vec = 0.38 * signedEfficiency[i] + 0.24 * localSlope + 0.23 * micro + 0.15 * maStructure;
    const hsc = 100 * clampSigned(vec);
    headingScore[i] = hsc;
    const strength = Math.abs(hsc);
    const hSign = gt(hsc, I.headingClearThreshold) ? 1 : lt(hsc, -I.headingClearThreshold) ? -1 : 0;
    headingSign[i] = hSign;
    const microSign = gt(micro, 0.18) ? 1 : lt(micro, -0.18) ? -1 : 0;
    tacticalSign[i] = ne(hSign, 0) ? hSign : gt(strength, I.headingDeadZone) ? gt(hsc, 0) ? 1 : -1 : gt(Math.abs(micro), 0.32) ? microSign : 0;
  }
  const routeScore = new Array(n), routeSign = new Array(n);
  for (let i = 0; lt(i, n); i++) {
    const h = H[i];
    const safeHtfAtr = Math.max(h.htfATR, mintick);
    const htfStructure = gt(h.htfClose, h.htfMA50) && gt(h.htfMA50, h.htfMA200) ? 1 : lt(h.htfClose, h.htfMA50) && lt(h.htfMA50, h.htfMA200) ? -1 : gt(h.htfClose, h.htfMA200) ? 0.45 : lt(h.htfClose, h.htfMA200) ? -0.45 : 0;
    const htfSlope = clampSigned((h.htfMA50 - h.htfMA50Past) / (safeHtfAtr * 5) * 2.5);
    const htfRouteVector = 0.7 * htfStructure + 0.3 * htfSlope;
    const curStructure = gt(close[i], ma50[i]) && gt(ma50[i], ma200[i]) ? 1 : lt(close[i], ma50[i]) && lt(ma50[i], ma200[i]) ? -1 : gt(close[i], ma200[i]) ? 0.45 : lt(close[i], ma200[i]) ? -0.45 : 0;
    const curSlope = clampSigned((ma50[i] - hist(ma50, i, 5)) / (safeAtr[i] * 5) * 2.5);
    const currentRouteVector = 0.7 * curStructure + 0.3 * curSlope;
    const routeVector = prof.htfWeight * htfRouteVector + (1 - prof.htfWeight) * currentRouteVector;
    routeScore[i] = 100 * clampSigned(routeVector);
    routeSign[i] = gt(routeScore[i], I.routeClearThreshold) ? 1 : lt(routeScore[i], -I.routeClearThreshold) ? -1 : 0;
  }
  const volumeBaseline = sma(volume, I.fuelBaselineLen);
  const rangeBaseline = ema(trueRange, I.fuelBaselineLen, seed);
  const barDirection = close.map((c, i) => gt(c, prevClose[i]) ? 1 : lt(c, prevClose[i]) ? -1 : 0);
  const persistenceEma = ema(barDirection, 5, seed);
  const fuelRaw = new Array(n), volumeAvailable = new Array(n);
  for (let i = 0; lt(i, n); i++) {
    const va = !isNa(volume[i]) && !isNa(volumeBaseline[i]) && gt(volumeBaseline[i], 0) && gt(volume[i], 0);
    volumeAvailable[i] = va;
    const volumeRelative = va ? volume[i] / volumeBaseline[i] : 1;
    const rangeRelative = gt(rangeBaseline[i], 0) ? trueRange[i] / rangeBaseline[i] : 1;
    const persistence = Math.abs(persistenceEma[i]);
    fuelRaw[i] = va ? 0.4 * Math.min(volumeRelative, 3) + 0.15 * Math.min(rangeRelative, 3) + 0.2 * Math.min(bodyAtr[i], 2) + 0.15 * persistence + 0.1 * Math.abs(signedEfficiency[i]) : 0.25 * Math.min(rangeRelative, 3) + 0.3 * Math.min(bodyAtr[i], 2) + 0.25 * persistence + 0.2 * Math.abs(signedEfficiency[i]);
  }
  const fuelRawSmooth = ema(fuelRaw, I.fuelSmooth, seed);
  const fuelRankRaw = percentrank(fuelRawSmooth, prof.rankLen);
  const fuelFallbackBase = ema(fuelRawSmooth, Math.min(prof.rankLen, 50), seed);
  const fuelScore = new Array(n), fuelAcceleration = new Array(n);
  for (let i = 0; lt(i, n); i++) {
    const fb = gt(fuelFallbackBase[i], 0) ? clamp1002(50 * fuelRawSmooth[i] / fuelFallbackBase[i]) : 50;
    fuelScore[i] = nz(fuelRankRaw[i], fb);
    fuelAcceleration[i] = fuelScore[i] - nz(hist(fuelScore, i, I.speedAccelLookback), fuelScore[i]);
  }
  const speedClass = speedScore.map((s) => lt(s, I.speedSlowThreshold) ? 0 : lt(s, I.speedFastThreshold) ? 1 : lt(s, I.speedExtremeThreshold) ? 2 : 3);
  const fuelClass = fuelScore.map((f) => lt(f, I.fuelLowThreshold) ? 0 : lt(f, I.fuelHighThreshold) ? 1 : lt(f, I.fuelExtremeThreshold) ? 2 : 3);
  const fuelExhaustion = speedScore.map((s, i) => ge(s, 55) && ge(fuelScore[i], 40) && lt(fuelAcceleration[i], -6));
  return {
    n,
    ma14,
    ma22,
    ma50,
    ma200,
    ma1000,
    atr: atr2,
    safeAtr,
    trueRange: trTrue(bars),
    prevClose,
    htf: H,
    instantSpeedRaw,
    flowSpeedRaw,
    speedScore,
    instantSpeedScore,
    speedAcceleration,
    speedClass,
    signedEfficiency,
    microMoveNorm,
    headingScore,
    headingSign,
    tacticalSign,
    routeScore,
    routeSign,
    volumeAvailable,
    fuelRaw,
    fuelScore,
    fuelAcceleration,
    fuelClass,
    fuelExhaustion
  };
}

// ../../gtg-strategy-lab/engine/pinecmp/obstacle.mjs
var newObstacleLatch = () => ({ state: false, keys: [] });
function isQualifying(obs, P) {
  return !!obs.available && obs.strength != null && obs.distAtr != null && ge(obs.strength, P.strongQ) && le(obs.distAtr, P.nearObstacleAtr);
}
var sameObstacle = (prevKeys, keys) => prevKeys.some((k) => keys.includes(k));
function strongObstacleStep(latch, obs, P) {
  if (!obs.confirmed) return { event: false, latch };
  const q = isQualifying(obs, P);
  const event = q && (!latch.state || !sameObstacle(latch.keys, obs.entryKeys));
  return { event, latch: { state: q, keys: q ? [...obs.entryKeys] : [] } };
}
var OBSTACLE_DEFAULTS = Object.freeze({ strongQ: 72, nearObstacleAtr: 0.35 });

// ../../gtg-strategy-lab/engine/pinecmp/consumer.mjs
function displayQOf(slot, ma200, ma1000, { isCrypto = false, close = NaN } = {}) {
  if (!slot.active) return slot.quality;
  const maConf = ge(ma200, slot.lo) && le(ma200, slot.hi) || ge(ma1000, slot.lo) && le(ma1000, slot.hi);
  let psychConf = false;
  if (isCrypto) {
    const p = close;
    const step = ge(p, 1e5) ? 1e4 : ge(p, 5e4) ? 5e3 : ge(p, 1e4) ? 1e3 : ge(p, 1e3) ? 500 : ge(p, 100) ? 50 : ge(p, 10) ? 5 : 1;
    psychConf = le(Math.ceil(slot.lo / step) * step, slot.hi);
  }
  return Math.min(100, slot.gateQ + (maConf ? 4 : 0) + (psychConf ? 3 : 0));
}
var zoneDistance = (lo, hi, c) => lt(c, lo) ? lo - c : gt(c, hi) ? c - hi : 0;
function newConsumerState() {
  return { latch: newObstacleLatch(), prevNoChase: false, prevSpeed: NaN, prevFuel: NaN, prevHeading: NaN };
}
function consumerStep(st, bar, slots, ev, s, atrEng, I = INPUTS) {
  const [R1, R2, S1, S2] = slots;
  const c = bar.c;
  const lo = (x) => x.active ? x.lo : NaN, hi = (x) => x.active ? x.hi : NaN, q = (x) => x.active ? x.quality : NaN;
  const mapDirectionSign = ne(s.tacticalSign, 0) ? s.tacticalSign : s.routeSign;
  const containR = R1.active && R1.containing, containS = S1.active && S1.containing;
  const res1Dist = R1.active ? zoneDistance(R1.lo, R1.hi, c) / atrEng : 99;
  const sup1Dist = S1.active ? zoneDistance(S1.lo, S1.hi, c) / atrEng : 99;
  const primaryUp = containR ? true : containS ? false : gt(mapDirectionSign, 0) || eq(mapDirectionSign, 0) && le(res1Dist, sup1Dist);
  const d1 = primaryUp ? R1 : S1;
  const dest1Low = lo(d1), dest1High = hi(d1), dest1Strength = q(d1);
  const obstacleAvailable = !Number.isNaN(dest1Low) && !Number.isNaN(dest1High);
  const nearestObstacleAtr = !Number.isNaN(dest1Low) ? zoneDistance(dest1Low, dest1High, c) / atrEng : NaN;
  const nearestObstacleStrong = !Number.isNaN(dest1Strength) && ge(dest1Strength, I.strongQ);
  const obstacleRole = !obstacleAvailable ? 0 : primaryUp ? 1 : -1;
  const priceInsideObstacle = obstacleAvailable && ge(c, dest1Low) && le(c, dest1High);
  const candleTouchesObstacle = obstacleAvailable && ge(bar.h, dest1Low) && le(bar.l, dest1High);
  const obstacleNear = obstacleAvailable && !Number.isNaN(nearestObstacleAtr) && le(nearestObstacleAtr, I.nearObstacleAtr);
  const fuelNotSupportingChase = lt(s.fuelAcceleration, -3) || lt(s.fuelScore, I.noChaseFuelMax) || lt(s.fuelScore + 18, s.speedScore);
  const speedHotForChase = ge(s.speedScore, Math.max(60, I.speedFastThreshold - 10)) || ge(s.instantSpeedScore, I.speedExtremeThreshold);
  const obstacleEngagedForChase = obstacleAvailable && (le(nearestObstacleAtr, I.noChaseAtr) || priceInsideObstacle || candleTouchesObstacle);
  const noChaseUp = gt(s.tacticalSign, 0) && eq(obstacleRole, 1) && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChaseDown = lt(s.tacticalSign, 0) && eq(obstacleRole, -1) && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChase = noChaseUp || noChaseDown;
  const speedBurst = ge(s.speedScore, I.speedExtremeThreshold) && lt(st.prevSpeed, I.speedExtremeThreshold);
  const fuelSurge = ge(s.fuelScore, I.fuelHighThreshold) && lt(st.prevFuel, I.fuelHighThreshold);
  const headingUp = gt(s.headingScore, I.headingClearThreshold) && le(st.prevHeading, I.headingClearThreshold);
  const headingDown = lt(s.headingScore, -I.headingClearThreshold) && ge(st.prevHeading, -I.headingClearThreshold);
  const dest1EntryKeys = primaryUp ? R1.entryKeys : S1.entryKeys;
  const latchBefore = st.latch;
  const obs = {
    confirmed: true,
    available: obstacleAvailable,
    strength: Number.isNaN(dest1Strength) ? null : dest1Strength,
    distAtr: Number.isNaN(nearestObstacleAtr) ? null : nearestObstacleAtr,
    entryKeys: dest1EntryKeys
  };
  const so = strongObstacleStep(latchBefore, obs, { strongQ: I.strongQ, nearObstacleAtr: I.nearObstacleAtr });
  const strongObsNow = so.latch.state;
  const strongObsSame = latchBefore.keys.some((k) => dest1EntryKeys.includes(k));
  const nearStrongObstacle = so.event;
  const noChaseEvent = noChase && !st.prevNoChase;
  const obstacleBreakEvent = ev.breakingUp || ev.breakingDn;
  const obstacleRejectEvent = ev.rejectR || ev.rejectS;
  const breakAcceptedEvent = ev.acceptedUp || ev.acceptedDn;
  const flipConfirmedEvent = ev.flipConfirmed;
  const engineEventBits = (ev.breakingUp ? 1 : 0) + (ev.breakingDn ? 2 : 0) + (ev.acceptedUp ? 4 : 0) + (ev.acceptedDn ? 8 : 0) + (ev.rejectR ? 16 : 0) + (ev.rejectS ? 32 : 0) + (ev.flipConfirmed ? 64 : 0);
  const alertBits = (speedBurst ? 1 : 0) + (fuelSurge ? 2 : 0) + (headingUp ? 4 : 0) + (headingDown ? 8 : 0) + (nearStrongObstacle ? 16 : 0) + (noChaseEvent ? 32 : 0) + (obstacleBreakEvent ? 64 : 0) + (obstacleRejectEvent ? 128 : 0) + (breakAcceptedEvent ? 256 : 0) + (flipConfirmedEvent ? 512 : 0);
  const obsState = (strongObsNow ? 1 : 0) + (latchBefore.state ? 2 : 0) + (strongObsSame ? 4 : 0) + (nearStrongObstacle ? 8 : 0);
  st.latch = so.latch;
  st.prevNoChase = noChase;
  st.prevSpeed = s.speedScore;
  st.prevFuel = s.fuelScore;
  st.prevHeading = s.headingScore;
  return {
    primaryUp,
    dest1Low,
    dest1High,
    dest1Strength,
    nearestObstacleAtr,
    nearestObstacleStrong,
    obstacleRole,
    priceInsideObstacle,
    candleTouchesObstacle,
    obstacleNear,
    noChaseUp,
    noChaseDown,
    noChase,
    speedBurst,
    fuelSurge,
    headingUp,
    headingDown,
    nearStrongObstacle,
    noChaseEvent,
    obstacleBreakEvent,
    obstacleRejectEvent,
    breakAcceptedEvent,
    flipConfirmedEvent,
    eventBits: engineEventBits + alertBits * 128,
    alertBits,
    engineEventBits,
    obsState,
    latch: { state: so.latch.state, keys: so.latch.keys.slice() }
  };
}

// measure.mjs
var SLOT_NAMES2 = ["R1", "R2", "S1", "S2"];
function anchorFeedOf(chart, a1Bars, a2Bars) {
  const v1 = htfFeedValues(a1Bars, 1), v2 = htfFeedValues(a2Bars, 2);
  const k1 = containingIndex(chart, a1Bars), k2 = containingIndex(chart, a2Bars);
  const none = { now: null, atr: null, items: [] };
  return (i) => {
    const a = k1[i] - 1 >= 0 ? v1[k1[i] - 1] : none;
    const b = k2[i] - 1 >= 0 ? v2[k2[i] - 1] : none;
    return { now: [null, a.now, b.now], atrA1: a.atr, atrA2: b.atr, items: [...a.items, ...b.items] };
  };
}
var slotView = (s, name) => s.active ? { name, active: true, lo: s.lo, hi: s.hi, gateQ: s.gateQ, displayQ: s.quality, containing: !!s.containing, side: s.side, primaryKey: s.primaryKey, entryKeys: s.entryKeys.slice(), lastKeys: s.lastKeys.slice() } : { name, active: false };
function slotsHolding(slots, key) {
  const out = [];
  slots.forEach((s, i) => {
    if (!s.active) return;
    if (s.lastKeys.includes(key)) out.push({ slot: SLOT_NAMES2[i], entry: s.entryKeys.includes(key) });
  });
  return out;
}
function runTimeframe({ tf, bars, htfBars = [], a1Bars, a2Bars, mintick, startBar = 0, emaSeed = "sma", htfInputs = null, symbol = "XAUUSD", onRow = null, keepRows = true }) {
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
    const slots = eng.slots.map((s2) => ({ ...s2, quality: displayQOf(s2, S.ma200[i], S.ma1000[i]) }));
    const ev = engineOn ? r.events : { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, flipConfirmed: false, rejectR: false, rejectS: false, log: [] };
    const s = {
      tacticalSign: S.tacticalSign[i],
      routeSign: S.routeSign[i],
      headingScore: S.headingScore[i],
      speedScore: S.speedScore[i],
      instantSpeedScore: S.instantSpeedScore[i],
      fuelScore: S.fuelScore[i],
      fuelAcceleration: S.fuelAcceleration[i]
    };
    const atrEng = series.atrEng[i];
    const con = consumerStep(cst, bars[i], slots, ev, s, atrEng);
    const hashes = null;
    const levelsByKey = new Map(eng.allLevels().map((lv) => [lv.key, lv]));
    const log = ev.log.map((x) => {
      const lv = levelsByKey.get(x.key);
      return {
        ...x,
        origin: x.key % 32 % 2 === TYP.HIGH ? "R" : "S",
        // disc = src·6 + tfRank·2 + typ
        slotsBefore: slotsHolding(prevSlots, x.key),
        slotsAfter: slotsHolding(slots, x.key),
        stateAfter: lv ? lv.state : ST.DEAD,
        everBreaking: lv ? !!lv.everBreaking : null,
        ageNative: lv ? lv.ageNative : null,
        tfRank: lv ? lv.tfRank : null,
        source: lv ? lv.source : null,
        q: lv ? lv.q : null
      };
    });
    const hk = S.htf[i].htfIndex;
    const row = {
      i,
      t: bars[i].t,
      engineOn,
      warmed: engineOn && i >= startBar + W,
      o: bars[i].o,
      h: bars[i].h,
      l: bars[i].l,
      c: bars[i].c,
      v: bars[i].v,
      atr: S.safeAtr[i],
      atrEng,
      ma14: S.ma14[i],
      ma22: S.ma22[i],
      ma50: S.ma50[i],
      ma200: S.ma200[i],
      ma1000: S.ma1000[i],
      routeScore: S.routeScore[i],
      routeSign: S.routeSign[i],
      headingScore: S.headingScore[i],
      headingSign: S.headingSign[i],
      tacticalSign: S.tacticalSign[i],
      speedScore: S.speedScore[i],
      instantSpeedScore: S.instantSpeedScore[i],
      speedAcceleration: S.speedAcceleration[i],
      speedClass: S.speedClass[i],
      fuelScore: S.fuelScore[i],
      fuelAcceleration: S.fuelAcceleration[i],
      fuelClass: S.fuelClass[i],
      fuelExhaustion: S.fuelExhaustion[i],
      volumeAvailable: S.volumeAvailable[i],
      htfLastClosedT: hk - 1 >= 0 ? htfBars[hk - 1].t : null,
      // null when htfInputs are given
      htfClose: S.htf[i].htfClose,
      htfMA50: S.htf[i].htfMA50,
      htfMA200: S.htf[i].htfMA200,
      htfMA50Past: S.htf[i].htfMA50Past,
      htfATR: S.htf[i].htfATR,
      slots: slots.map((x, k) => slotView(x, SLOT_NAMES2[k])),
      events: { breakingUp: ev.breakingUp, breakingDn: ev.breakingDn, acceptedUp: ev.acceptedUp, acceptedDn: ev.acceptedDn, rejectR: ev.rejectR, rejectS: ev.rejectS, flipConfirmed: ev.flipConfirmed },
      log,
      consumer: con,
      hashes
    };
    if (onRow) onRow(row);
    if (rows) rows.push(row);
    prevSlots = slots;
  }
  return { prof, P, W, rows, violations: eng.violations };
}

// lamp.mjs
var LAMP_INPUTS = Object.freeze({
  headingClearThreshold: 20,
  routeClearThreshold: 22,
  speedFastThreshold: 70,
  speedExtremeThreshold: 90,
  fuelLowThreshold: 25,
  nearObstacleAtr: 0.35,
  awarenessObstacleAtr: 0.85,
  noChaseAtr: 0.3,
  noChaseFuelMax: 65,
  strongQ: 72,
  mediumQ: 48,
  greenRoomHtfAtr: 1
});
var zoneDistance2 = (lo, hi, close) => close < lo ? lo - close : close > hi ? close - hi : 0;
function strengthWord(q, fem, I = LAMP_INPUTS) {
  return q >= I.strongQ ? fem ? "\u0645\u0647\u0645\u0629" : "\u0645\u0647\u0645" : q >= I.mediumQ ? fem ? "\u0645\u062A\u0648\u0633\u0637\u0629" : "\u0645\u062A\u0648\u0633\u0637" : fem ? "\u0636\u0639\u064A\u0641\u0629" : "\u0636\u0639\u064A\u0641";
}
function fmtDist(d, mintick = 1e-3) {
  if (d >= 100) return String(Math.round(d));
  if (d >= 0.1) return (Math.round(d * 10) / 10).toFixed(1);
  const dec = Math.max(0, Math.round(-Math.log10(mintick)));
  return Number(d.toFixed(dec)).toString();
}
function zoneDistText(slot, isRes, close, mintick) {
  const d = isRes ? slot.lo - close : close - slot.hi;
  return slot.containing || d <= 0 ? "\u0627\u0644\u0633\u0639\u0631 \u0639\u0646\u062F\u0647\u0627" : fmtDist(d, mintick);
}
function zoneLine(slot, isRes, prefix, close, mintick, I = LAMP_INPUTS) {
  if (!slot || !slot.active) return prefix + (isRes ? "\u0644\u0627 \u0645\u0642\u0627\u0648\u0645\u0629 \u0642\u0631\u064A\u0628\u0629" : "\u0644\u0627 \u062F\u0639\u0645 \u0642\u0631\u064A\u0628");
  return prefix + (isRes ? "\u0645\u0642\u0627\u0648\u0645\u0629 " : "\u062F\u0639\u0645 ") + strengthWord(slot.displayQ, isRes, I) + " \u2022 " + zoneDistText(slot, isRes, close, mintick);
}
function lampOf(row, { mintick = 1e-3, I = LAMP_INPUTS } = {}) {
  const [R1, R2, S1, S2] = row.slots;
  const close = row.c, high = row.h, low = row.l, atrEng = row.atrEng;
  const headingSign = row.headingSign, routeSign = row.routeSign;
  const { speedScore, instantSpeedScore, fuelScore, fuelAcceleration } = row;
  const ev = row.events;
  const safeHtfAtr = Math.max(row.htfATR ?? NaN, mintick);
  const mapDirectionSign = headingSign !== 0 ? headingSign : routeSign;
  const containR = R1.active && R1.containing;
  const containS = S1.active && S1.containing;
  const res1Dist = R1.active ? zoneDistance2(R1.lo, R1.hi, close) / atrEng : 99;
  const sup1Dist = S1.active ? zoneDistance2(S1.lo, S1.hi, close) / atrEng : 99;
  const primaryUp = containR ? true : containS ? false : mapDirectionSign > 0 || mapDirectionSign === 0 && res1Dist <= sup1Dist;
  const dest1 = primaryUp ? R1 : S1;
  const obstacleAvailable = !!dest1.active;
  const nearestObstacleAtr = obstacleAvailable ? zoneDistance2(dest1.lo, dest1.hi, close) / atrEng : NaN;
  const obstacleRole = !obstacleAvailable ? 0 : primaryUp ? 1 : -1;
  const priceInsideObstacle = obstacleAvailable && close >= dest1.lo && close <= dest1.hi;
  const candleTouchesObstacle = obstacleAvailable && high >= dest1.lo && low <= dest1.hi;
  const obstacleNear = obstacleAvailable && Number.isFinite(nearestObstacleAtr) && nearestObstacleAtr <= I.nearObstacleAtr;
  const fuelNotSupportingChase = fuelAcceleration < -3 || fuelScore < I.noChaseFuelMax || fuelScore + 18 < speedScore;
  const speedHotForChase = speedScore >= Math.max(60, I.speedFastThreshold - 10) || instantSpeedScore >= I.speedExtremeThreshold;
  const obstacleEngagedForChase = obstacleAvailable && (nearestObstacleAtr <= I.noChaseAtr || priceInsideObstacle || candleTouchesObstacle);
  const noChaseUp = headingSign > 0 && obstacleRole === 1 && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChaseDown = headingSign < 0 && obstacleRole === -1 && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChase = noChaseUp || noChaseDown;
  const fuelExhaustion = speedScore >= 55 && fuelScore >= 40 && fuelAcceleration < -6;
  const obstacleInAwarenessRange = obstacleAvailable && Number.isFinite(nearestObstacleAtr) && nearestObstacleAtr <= I.awarenessObstacleAtr;
  const movingTowardResistance = headingSign > 0 && obstacleRole === 1 && obstacleInAwarenessRange;
  const movingTowardSupport = headingSign < 0 && obstacleRole === -1 && obstacleInAwarenessRange;
  let lamp = 1, why = "\u0623\u062F\u0644\u0629 \u0645\u062E\u062A\u0644\u0637\u0629", kind = null;
  if (ev.acceptedUp || ev.acceptedDn) {
    why = ev.acceptedUp ? "\u0627\u062E\u062A\u0631\u0627\u0642 \u0645\u0624\u0643\u062F" : "\u0643\u0633\u0631 \u0645\u0624\u0643\u062F";
    lamp = 2;
    kind = "break";
  } else if (noChase) {
    why = "\u0644\u0627 \u062A\u0637\u0627\u0631\u062F";
    lamp = 0;
  } else if (priceInsideObstacle) {
    why = obstacleRole === 1 ? "\u062F\u0627\u062E\u0644 \u0645\u0642\u0627\u0648\u0645\u0629" : obstacleRole === -1 ? "\u062F\u0627\u062E\u0644 \u062F\u0639\u0645" : "\u062F\u0627\u062E\u0644 \u0645\u0646\u0637\u0642\u0629";
    lamp = 0;
  } else if (routeSign !== 0 && headingSign !== 0 && routeSign !== headingSign) {
    why = "\u0639\u0643\u0633 \u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0639\u0627\u0645";
    lamp = 0;
  } else if (ev.breakingUp || ev.breakingDn) why = "\u0643\u0633\u0631 \u064A\u062D\u062A\u0627\u062C \u062A\u0623\u0643\u064A\u062F";
  else if (ev.rejectR || ev.rejectS) why = ev.rejectR ? "\u0631\u0641\u0636 \u0645\u0646 \u0645\u0642\u0627\u0648\u0645\u0629" : "\u0627\u0631\u062A\u062F\u0627\u062F \u0645\u0646 \u062F\u0639\u0645";
  else if (obstacleNear || candleTouchesObstacle) why = obstacleRole === 1 ? "\u0645\u0642\u0627\u0648\u0645\u0629 \u0642\u0631\u064A\u0628\u0629" : obstacleRole === -1 ? "\u062F\u0639\u0645 \u0642\u0631\u064A\u0628" : "\u0645\u0646\u0637\u0642\u0629 \u0642\u0631\u064A\u0628\u0629";
  else if (movingTowardResistance || movingTowardSupport) why = movingTowardResistance ? "\u0645\u0642\u0627\u0648\u0645\u0629 \u0623\u0645\u0627\u0645\u0647" : "\u062F\u0639\u0645 \u0623\u0645\u0627\u0645\u0647";
  else if (fuelExhaustion) why = "\u0627\u0644\u0632\u062E\u0645 \u064A\u0636\u0639\u0641";
  else if (headingSign === 0) why = "\u0628\u062F\u0648\u0646 \u0627\u062A\u062C\u0627\u0647 \u0648\u0627\u0636\u062D";
  else if (routeSign === 0) why = "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0639\u0627\u0645 \u063A\u064A\u0631 \u0648\u0627\u0636\u062D";
  else if (fuelScore < I.fuelLowThreshold) why = "\u0627\u0644\u0648\u0642\u0648\u062F \u0636\u0639\u064A\u0641";
  else if (headingSign === routeSign && obstacleAvailable && nearestObstacleAtr * atrEng < I.greenRoomHtfAtr * safeHtfAtr) why = obstacleRole === 1 ? "\u0645\u0642\u0627\u0648\u0645\u0629 \u0623\u0645\u0627\u0645\u0647" : "\u062F\u0639\u0645 \u0623\u0645\u0627\u0645\u0647";
  else if (headingSign === routeSign) {
    why = "\u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0645\u062A\u0648\u0627\u0641\u0642";
    lamp = 2;
    kind = "aligned";
  }
  const dirText = headingSign > 0 ? "\u0635\u0627\u0639\u062F" : headingSign < 0 ? "\u0647\u0627\u0628\u0637" : "\u0645\u062A\u0631\u062F\u062F";
  const greenDir = kind === "break" ? ev.acceptedUp ? 1 : -1 : kind === "aligned" ? headingSign : 0;
  return {
    lamp,
    why,
    kind,
    greenDir,
    dirText,
    head: dirText + " \u2022 " + why,
    rows: [
      zoneLine(R1, true, "", close, mintick, I),
      zoneLine(R2, true, "\u0628\u0639\u062F \u0627\u0644\u0627\u062E\u062A\u0631\u0627\u0642 \u2022 ", close, mintick, I),
      zoneLine(S1, false, "", close, mintick, I),
      zoneLine(S2, false, "\u0628\u0639\u062F \u0627\u0644\u0643\u0633\u0631 \u2022 ", close, mintick, I)
    ],
    zones: { R1, R2, S1, S2 },
    nearestObstacleAtr,
    obstacleRole
  };
}
function dxyText(closes) {
  if (!closes || closes.length < 50) return "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u2022 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D";
  const ema2 = (len) => {
    const a = 2 / (len + 1);
    let e = closes.slice(0, len).reduce((s2, x) => s2 + x, 0) / len;
    for (let i = len; i < closes.length; i++) e = a * closes[i] + (1 - a) * e;
    return e;
  };
  const c = closes[closes.length - 1], f = ema2(20), s = ema2(50);
  return c > f && f > s ? "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0635\u0627\u0639\u062F \u2022 \u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0630\u0647\u0628" : c < f && f < s ? "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0647\u0627\u0628\u0637 \u2022 \u064A\u062F\u0639\u0645 \u0627\u0644\u0630\u0647\u0628" : "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0645\u062A\u0631\u062F\u062F";
}

// runner.mjs
var BASE = process.argv[2] || "C:/Users/alk/gtg-live";
var FEED = join(BASE, "feed");
var STATE = join(BASE, "state");
var LOG = join(BASE, "log");
for (const d of [STATE, LOG]) mkdirSync(d, { recursive: true });
var MINTICK = 1e-3;
var TFS = ["M1", "M5", "M15", "H1", "H4"];
var PINE_TO_TF = { "5": "M5", "15": "M15", "60": "H1", "240": "H4", D: "D", W: "W" };
var SENSOR_WARM = 1100;
var GREEN_EXPIRY_BARS = 300;
var ONCE = process.argv.includes("--once");
function readFeed(name) {
  const p = join(FEED, name + ".csv");
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").split(/\r?\n/);
  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const s = lines[i];
    if (!s) continue;
    const [t, o, h, l, c, v] = s.split(",").map(Number);
    if (!Number.isFinite(t) || !Number.isFinite(c)) continue;
    if (bars.length && t <= bars[bars.length - 1].t) continue;
    bars.push({ t, o, h, l, c, v });
  }
  return bars;
}
var mtime = (name) => {
  try {
    return statSync(join(FEED, name + ".csv")).mtimeMs;
  } catch {
    return 0;
  }
};
var writeAtomic = (p, s) => {
  writeFileSync(p + ".tmp", s);
  renameSync(p + ".tmp", p);
};
var fmtT = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
function panelFor(tf, feeds) {
  const prof = profileFor(tf);
  const P = zoneParams(DEFAULTS, prof, MINTICK);
  const W = engineWindowFor(P, prof.chartSec, prof.a1Sec, prof.a2Sec);
  const all = feeds[tf];
  const bars = all.slice(-(W + SENSOR_WARM));
  const htf = feeds[prof.htfTf], a1 = feeds[PINE_TO_TF[prof.a1Tf]], a2 = feeds[PINE_TO_TF[prof.a2Tf]];
  if (!bars.length || !htf || !a1 || !a2) return null;
  const startBar = Math.max(0, bars.length - 1 - W);
  let last = null;
  runTimeframe({ tf, bars, htfBars: htf, a1Bars: a1, a2Bars: a2, mintick: MINTICK, startBar, keepRows: false, onRow: (r) => {
    if (r.i === bars.length - 1) last = r;
  } });
  if (!last || !last.engineOn) return null;
  const lp = lampOf(last, { mintick: MINTICK });
  const dxyBars = feeds[prof.minutes >= 60 ? "DXY_" + tf : "DXY_H1"];
  const dxy = dxyText(dxyBars ? dxyBars.map((b) => b.c) : null);
  return { tf, t: last.t, close: last.c, atrEng: last.atrEng, warmed: last.warmed, barCount: bars.length, W, ...lp, dxy };
}
var ledgerPath = join(LOG, "greens.csv");
var statePath = join(STATE, "ledger.json");
var ledger = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { seq: 0, open: [], lastLamp: {}, lastBarT: {} };
if (!existsSync(ledgerPath)) appendFileSync(ledgerPath, "id,tf,kind,dir,signal_bar_utc,entry,atr,target,stop,result,resolved_utc,bars_to_result,why\n");
function openGreen(p) {
  const id = ++ledger.seq;
  const dir = p.greenDir;
  const rec = {
    id,
    tf: p.tf,
    kind: p.kind,
    dir,
    t: p.t,
    closeT: p.t + profileFor(p.tf).chartSec * 1e3,
    entry: p.close,
    atr: p.atrEng,
    target: p.close + dir * p.atrEng,
    stop: p.close - dir * p.atrEng,
    why: p.head,
    expiresAt: p.t + (GREEN_EXPIRY_BARS + 1) * profileFor(p.tf).chartSec * 1e3
  };
  ledger.open.push(rec);
  appendFileSync(join(LOG, "events.log"), `${(/* @__PURE__ */ new Date()).toISOString()} GREEN#${id} ${p.tf} ${p.kind} dir=${dir} entry=${p.close} atr=${p.atrEng.toFixed(3)} | ${p.head}
`);
}
function resolveGreens(m1) {
  const still = [];
  for (const g of ledger.open) {
    let res = null, rt = null;
    for (const b of m1) {
      if (b.t < g.closeT) continue;
      const hitT = g.dir > 0 ? b.h >= g.target : b.l <= g.target;
      const hitS = g.dir > 0 ? b.l <= g.stop : b.h >= g.stop;
      if (hitT && hitS) {
        res = "loss_both";
        rt = b.t;
        break;
      }
      if (hitS) {
        res = "loss";
        rt = b.t;
        break;
      }
      if (hitT) {
        res = "win";
        rt = b.t;
        break;
      }
      if (b.t >= g.expiresAt) {
        res = "expired";
        rt = b.t;
        break;
      }
    }
    if (!res) {
      still.push(g);
      continue;
    }
    const barsTo = Math.round((rt - g.closeT) / (profileFor(g.tf).chartSec * 1e3));
    appendFileSync(ledgerPath, [g.id, g.tf, g.kind, g.dir, fmtT(g.t), g.entry, g.atr.toFixed(3), g.target.toFixed(3), g.stop.toFixed(3), res, fmtT(rt), barsTo, '"' + g.why + '"'].join(",") + "\n");
    appendFileSync(join(LOG, "events.log"), `${(/* @__PURE__ */ new Date()).toISOString()} RESULT#${g.id} ${g.tf} ${res}
`);
  }
  ledger.open = still;
}
var panels = {};
var seen = {};
function tick() {
  const names = ["XAUUSD_M1", "XAUUSD_M5", "XAUUSD_M15", "XAUUSD_H1", "XAUUSD_H4", "XAUUSD_D", "XAUUSD_W", "DXY_H1", "DXY_H4"];
  const sig = names.map(mtime).join(",");
  if (seen.sig === sig) return false;
  seen.sig = sig;
  const feeds = {};
  for (const n of names) {
    const b = readFeed(n);
    if (b) feeds[n.startsWith("XAUUSD_") ? n.slice(7) : n] = b;
  }
  if (!feeds.M1) return false;
  let changed = false;
  for (const tf of TFS) {
    if (!feeds[tf] || !feeds[tf].length) continue;
    const lastT = feeds[tf][feeds[tf].length - 1].t;
    if (ledger.lastBarT[tf] === lastT && panels[tf]) continue;
    let p;
    try {
      p = panelFor(tf, feeds);
    } catch (e) {
      appendFileSync(join(LOG, "errors.log"), `${(/* @__PURE__ */ new Date()).toISOString()} ${tf} ${e.stack}
`);
      continue;
    }
    if (!p) continue;
    panels[tf] = p;
    changed = true;
    if (ledger.lastBarT[tf] === lastT) continue;
    const prev = ledger.lastLamp[tf];
    const isNewGreen = p.lamp === 2 && p.greenDir !== 0 && ledger.lastBarT[tf] !== void 0 && !(prev && prev.lamp === 2 && prev.dir === p.greenDir);
    if (isNewGreen) openGreen(p);
    ledger.lastLamp[tf] = { lamp: p.lamp, dir: p.greenDir };
    ledger.lastBarT[tf] = lastT;
    appendFileSync(join(LOG, "panels.csv"), [fmtT(p.t), tf, p.close, p.lamp, '"' + p.head + '"', ...p.rows.map((r) => '"' + r + '"'), '"' + p.dxy + '"'].join(",") + "\n");
  }
  resolveGreens(feeds.M1);
  writeAtomic(statePath, JSON.stringify(ledger));
  if (changed) {
    const out = TFS.filter((tf) => panels[tf]).map((tf) => panels[tf]);
    writeAtomic(join(STATE, "state.json"), JSON.stringify({ updated: (/* @__PURE__ */ new Date()).toISOString(), panels: out.map(({ zones, ...rest }) => ({ ...rest, zones: Object.fromEntries(Object.entries(zones).map(([k, z]) => [k, z.active ? { lo: z.lo, hi: z.hi, q: z.displayQ, containing: z.containing } : null])) })), openGreens: ledger.open }, null, 1));
    const zz = (z) => z.active ? [z.lo, z.hi] : ["", ""];
    writeAtomic(join(STATE, "draw.txt"), out.map((p) => [p.tf, p.lamp, p.head, ...p.rows, p.dxy, ...zz(p.zones.R1), ...zz(p.zones.R2), ...zz(p.zones.S1), ...zz(p.zones.S2)].join("|")).join("\n") + "\n");
    const lampWord = (l) => l === 2 ? "\u0623\u062E\u0636\u0631" : l === 1 ? "\u0623\u0635\u0641\u0631" : "\u0623\u062D\u0645\u0631";
    writeAtomic(join(STATE, "panel.txt"), out.map((p) => `${p.tf} ${fmtT(p.t)} \u0633\u0639\u0631 ${p.close} | ${lampWord(p.lamp)} ${p.head}
  ${p.rows.join("\n  ")}
  ${p.dxy}`).join("\n") + "\n");
  }
  return changed;
}
function heartbeat(extra = "") {
  writeAtomic(join(STATE, "runner_status.txt"), `${(/* @__PURE__ */ new Date()).toISOString()} pid=${process.pid} open=${ledger.open.length} ${extra}
`);
}
if (ONCE) {
  tick();
  heartbeat("once");
} else {
  const loop = () => {
    try {
      tick();
      heartbeat();
    } catch (e) {
      appendFileSync(join(LOG, "errors.log"), `${(/* @__PURE__ */ new Date()).toISOString()} ${e.stack}
`);
    }
  };
  loop();
  setInterval(loop, 5e3);
}
