// Structure Discovery Engine v0.1 — swing detection, leg classification, structure state.
// Ex-post segmentation for labels/ground truth; online (causal) uses confirmBar only.
// No lookahead: online mode uses information known at confirmBar, never before.
import { atr as computeAtr, ema } from '../engine/pine-ta.mjs';

// --- Swing Point Detection ---
// ATR-based zigzag: a swing is confirmed when price reverses by threshold × ATR.
// Returns alternating H / L points. Each carries the ex-post bar (the actual extreme)
// and the confirmBar (the first bar where the reversal threshold was met).
export function detectSwings(bars, { atrLen = 14, threshold = 1.0 } = {}) {
  const n = bars.length;
  const atrArr = computeAtr(bars, atrLen);
  const swings = [];
  let start = 0;
  while (start < n && (!Number.isFinite(atrArr[start]) || atrArr[start] <= 0)) start++;
  if (start >= n - 1) return { swings, atr: atrArr };

  let dir = 0, hi = bars[start].h, lo = bars[start].l, hiBar = start, loBar = start;
  for (let i = start + 1; i < n; i++) {
    const a = atrArr[i];
    if (!Number.isFinite(a) || a <= 0) continue;
    if (dir === 0) {
      if (bars[i].h > hi) { hi = bars[i].h; hiBar = i; }
      if (bars[i].l < lo) { lo = bars[i].l; loBar = i; }
      if (hi - bars[i].l >= threshold * atrArr[hiBar]) {
        swings.push({ side: 'H', bar: hiBar, time: bars[hiBar].t, price: hi, confirmBar: i, confirmTime: bars[i].t });
        lo = bars[i].l; loBar = i; dir = -1;
      } else if (bars[i].h - lo >= threshold * atrArr[loBar]) {
        swings.push({ side: 'L', bar: loBar, time: bars[loBar].t, price: lo, confirmBar: i, confirmTime: bars[i].t });
        hi = bars[i].h; hiBar = i; dir = 1;
      }
    } else if (dir === 1) {
      if (bars[i].h > hi) { hi = bars[i].h; hiBar = i; }
      if (hi - bars[i].l >= threshold * atrArr[hiBar]) {
        swings.push({ side: 'H', bar: hiBar, time: bars[hiBar].t, price: hi, confirmBar: i, confirmTime: bars[i].t });
        lo = bars[i].l; loBar = i; dir = -1;
      }
    } else {
      if (bars[i].l < lo) { lo = bars[i].l; loBar = i; }
      if (bars[i].h - lo >= threshold * atrArr[loBar]) {
        swings.push({ side: 'L', bar: loBar, time: bars[loBar].t, price: lo, confirmBar: i, confirmTime: bars[i].t });
        hi = bars[i].h; hiBar = i; dir = 1;
      }
    }
  }
  return { swings, atr: atrArr };
}

// --- Structure State ---
// Classify each swing relative to its predecessor of the same side.
// HH = Higher High, LH = Lower High, HL = Higher Low, LL = Lower Low.
// Detect BOS (Break of Structure) and CHoCH (Change of Character).
export function classifySwings(swings) {
  let lastH = null, lastL = null, trend = 0;
  for (const s of swings) {
    if (s.side === 'H') {
      if (lastH) {
        s.label = s.price > lastH.price ? 'HH' : s.price < lastH.price ? 'LH' : 'EH';
      } else { s.label = 'HH'; }
      lastH = s;
    } else {
      if (lastL) {
        s.label = s.price > lastL.price ? 'HL' : s.price < lastL.price ? 'LL' : 'EL';
      } else { s.label = 'HL'; }
      lastL = s;
    }
  }
  // trend and BOS/CHoCH
  let prevTrend = 0;
  for (let i = 1; i < swings.length; i++) {
    const s = swings[i], p = swings[i - 1];
    if (s.label === 'HH' || s.label === 'HL') {
      trend = 1;
    } else if (s.label === 'LH' || s.label === 'LL') {
      trend = -1;
    }
    if (trend !== 0 && prevTrend !== 0 && trend !== prevTrend) {
      s.choch = true;
    } else if (trend !== 0 && trend === prevTrend) {
      s.bos = true;
    }
    if (trend !== 0) prevTrend = trend;
    s.trend = trend;
  }
  return swings;
}

// --- Leg Construction ---
// A leg runs between consecutive swing points.
export function buildLegs(swings, bars, atrArr) {
  const legs = [];
  for (let i = 0; i < swings.length - 1; i++) {
    const a = swings[i], b = swings[i + 1];
    const direction = b.price > a.price ? 1 : -1;
    const distance = Math.abs(b.price - a.price);
    const atrAtStart = atrArr[a.bar] || 1;
    const duration = b.bar - a.bar;
    const durationMs = b.time - a.time;

    let path = 0, mfe = 0, mae = 0;
    for (let j = a.bar; j <= b.bar; j++) {
      if (j > a.bar) path += Math.abs(bars[j].c - bars[j - 1].c);
      const excursion = direction > 0
        ? (bars[j].h - a.price) / atrAtStart
        : (a.price - bars[j].l) / atrAtStart;
      const adverse = direction > 0
        ? (a.price - bars[j].l) / atrAtStart
        : (bars[j].h - a.price) / atrAtStart;
      if (excursion > mfe) mfe = excursion;
      if (adverse > mae) mae = adverse;
    }
    const pathEfficiency = path > 0 ? distance / path : 1;
    const velocity = duration > 0 ? (distance / atrAtStart) / duration : 0;
    const prevLeg = legs.length > 0 ? legs[legs.length - 1] : null;
    const retracement = prevLeg ? distance / Math.abs(swings[i].price - swings[i - 1].price) : 0;
    const acceleration = prevLeg ? velocity - prevLeg.velocity : 0;

    // MA positions at start
    const maPos = (maArr, bar) => {
      if (!maArr || !Number.isFinite(maArr[bar])) return null;
      return bars[bar].c > maArr[bar] ? 'above' : bars[bar].c < maArr[bar] ? 'below' : 'at';
    };

    // ATR change during leg
    const atrEnd = atrArr[b.bar] || atrAtStart;
    const atrChange = (atrEnd - atrAtStart) / atrAtStart;

    legs.push({
      id: i, from: a, to: b, direction, distance,
      distanceAtr: distance / atrAtStart,
      duration, durationMs,
      retracement: Math.min(retracement, 10),
      pathEfficiency: Math.round(pathEfficiency * 1000) / 1000,
      velocity: Math.round(velocity * 1000) / 1000,
      acceleration: Math.round(acceleration * 1000) / 1000,
      mfe: Math.round(mfe * 100) / 100,
      mae: Math.round(mae * 100) / 100,
      atrStart: Math.round(atrAtStart * 100) / 100,
      atrEnd: Math.round(atrEnd * 100) / 100,
      atrChange: Math.round(atrChange * 1000) / 1000,
    });
  }
  return legs;
}

// --- Leg Type Classification ---
export function classifyLegs(legs) {
  for (const leg of legs) {
    const { pathEfficiency, distanceAtr, retracement, direction, from, to } = leg;
    const prevTrend = from.trend || 0;
    const withTrend = (direction === prevTrend);

    if (pathEfficiency >= 0.55 && distanceAtr >= 1.5) {
      leg.type = withTrend ? 'impulse' : 'reversal_impulse';
    } else if (retracement > 0 && retracement <= 1.0 && !withTrend) {
      leg.type = retracement <= 0.236 ? 'shallow_pullback' : retracement <= 0.618 ? 'pullback' : 'deep_pullback';
    } else if (distanceAtr < 0.5) {
      leg.type = 'range';
    } else if (pathEfficiency < 0.35) {
      leg.type = 'choppy';
    } else {
      leg.type = withTrend ? 'continuation' : 'correction';
    }

    if (to.choch) leg.structureEvent = 'CHoCH';
    else if (to.bos) leg.structureEvent = 'BOS';
  }
  return legs;
}

// --- Compression / Expansion Detection ---
export function compressionExpansion(atrArr, { window = 20 } = {}) {
  const result = new Array(atrArr.length).fill(null);
  for (let i = window * 2; i < atrArr.length; i++) {
    const recent = atrArr.slice(i - window, i);
    const prior = atrArr.slice(i - window * 2, i - window);
    const rMean = recent.reduce((a, b) => a + b, 0) / window;
    const pMean = prior.reduce((a, b) => a + b, 0) / window;
    if (pMean > 0) {
      const ratio = rMean / pMean;
      result[i] = ratio < 0.85 ? 'compression' : ratio > 1.15 ? 'expansion' : 'neutral';
    }
  }
  return result;
}

// --- Full Pipeline ---
export function structureAnalysis(bars, opts = {}) {
  const { atrLen = 14, threshold = 1.0 } = opts;
  const { swings, atr } = detectSwings(bars, { atrLen, threshold });
  classifySwings(swings);
  const legs = buildLegs(swings, bars, atr);
  classifyLegs(legs);
  const ce = compressionExpansion(atr, { window: opts.ceWindow || 20 });
  return { swings, legs, atr, compressionExpansion: ce };
}
