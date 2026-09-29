// Sections 3–7 of gtg_navigator_v0.4.7.pine (core sensors, Speed, Tactical Heading,
// Macro Route, Fuel), line for line, over a whole bar array. Bars: { t, o, h, l, c, v }.
// Route HTF: request.security(tickerid, resolvedHTF, [close[1], ma50[1], ma200[1],
// ma50[6], atr(14)[1]], lookahead_on) — on a chart bar inside HTF bar k the values are
// those of HTF bars k−1 / k−6 (the last closed one). htfBars are given as delivered by
// the feed (their `t` = open time); nothing here aggregates.
import { INPUTS } from './profiles.mjs';
import { atr as taAtr, clamp100, clampSigned, ema, hist, isNa, maOf, nz, percentrank, sma, trTrue } from './pine-ta.mjs';

// Index of the HTF bar containing each chart bar (last HTF bar with open time ≤ t).
export function containingIndex(chartBars, htfBars) {
  const out = new Array(chartBars.length);
  let k = -1;
  for (let i = 0; i < chartBars.length; i++) {
    while (k + 1 < htfBars.length && htfBars[k + 1].t <= chartBars[i].t) k++;
    out[i] = k;
  }
  return out;
}

function htfRouteInputs(chartBars, htfBars, mintick, I, seed) {
  const c = htfBars.map((b) => b.c);
  const ma50 = maOf(I.maType, c, 50, seed), ma200 = maOf(I.maType, c, 200, seed);
  const atr14 = taAtr(htfBars, 14);
  const kIdx = containingIndex(chartBars, htfBars);
  const at = (arr, j) => (j >= 0 ? arr[j] : NaN);
  return kIdx.map((k) => ({
    htfClose: at(c, k - 1), htfMA50: at(ma50, k - 1), htfMA200: at(ma200, k - 1),
    htfMA50Past: at(ma50, k - 6), htfATR: at(atr14, k - 1), htfIndex: k,
  }));
}

// htfInputs (optional): per-chart-bar route HTF values as exported by the Pine copy
// (m_htfClose, m_htfMA50, m_htfMA200, m_htfMA50Past, m_htfATR). Used by the Parity Gate,
// where the HTF history before the chart's first bar is not available to JS.
export function computeSensors(bars, htfBars, prof, mintick, { inputs = INPUTS, emaSeed = 'sma', htfInputs = null } = {}) {
  const I = inputs, n = bars.length, seed = emaSeed;
  const close = bars.map((b) => b.c), open = bars.map((b) => b.o), high = bars.map((b) => b.h), low = bars.map((b) => b.l);
  const volume = bars.map((b) => (b.v == null ? NaN : b.v));
  const MA = (len) => maOf(I.maType, close, len, seed);

  // 3. Core sensors
  const ma14 = MA(14), ma22 = MA(22), ma50 = MA(50), ma200 = MA(200), ma1000 = MA(1000);
  const atr = taAtr(bars, 14);
  const safeAtr = atr.map((a) => Math.max(a, mintick));
  const prevClose = close.map((c, i) => nz(hist(close, i, 1), c));
  const trueRange = bars.map((b, i) => Math.max(b.h - b.l, Math.max(Math.abs(b.h - prevClose[i]), Math.abs(b.l - prevClose[i]))));
  const bodySize = bars.map((b) => Math.abs(b.c - b.o));
  const bodyAtr = bodySize.map((x, i) => x / safeAtr[i]);
  const H = htfInputs ? htfInputs.map((x) => ({ ...x, htfIndex: -1 })) : htfRouteInputs(bars, htfBars, mintick, I, seed);

  // 4. Speed
  const closeStep = close.map((c, i) => Math.abs(c - prevClose[i]));
  const barTravel = closeStep.map((s, i) => 0.70 * s + 0.30 * trueRange[i]);
  const instantSpeedRaw = ema(barTravel, I.speedSmooth, seed);
  const flowSpeedRaw = ema(instantSpeedRaw, prof.speedFlowLen, seed);
  const instantSpeedRankRaw = percentrank(instantSpeedRaw, prof.rankLen);
  const flowSpeedRankRaw = percentrank(flowSpeedRaw, prof.rankLen);
  const flowFallbackBase = ema(flowSpeedRaw, Math.min(prof.rankLen, 50), seed);
  const speedScore = new Array(n), instantSpeedScore = new Array(n), speedAcceleration = new Array(n);
  for (let i = 0; i < n; i++) {
    const fb = flowFallbackBase[i] > 0 ? clamp100(50.0 * flowSpeedRaw[i] / flowFallbackBase[i]) : 50.0;
    speedScore[i] = nz(flowSpeedRankRaw[i], fb);
    instantSpeedScore[i] = nz(instantSpeedRankRaw[i], speedScore[i]);
    speedAcceleration[i] = speedScore[i] - nz(hist(speedScore, i, I.speedAccelLookback), speedScore[i]);
  }

  // 5. Tactical heading
  const L = prof.headingEffLen, S = prof.headingSlopeEffLen, M = prof.microLen;
  const absStep = closeStep;
  const pathTravelSma = sma(absStep, L);
  const localEma = ema(close, 14, seed), fastEma = ema(close, 5, seed);
  const signedEfficiency = new Array(n), headingScore = new Array(n), headingSign = new Array(n);
  const tacticalSign = new Array(n), microMoveNorm = new Array(n);
  for (let i = 0; i < n; i++) {
    const pathTravel = pathTravelSma[i] * L;
    const net = close[i] - hist(close, i, L);
    signedEfficiency[i] = pathTravel > 0 ? clampSigned(net / pathTravel) : 0.0;
    const localSlope = clampSigned(((localEma[i] - hist(localEma, i, S)) / (safeAtr[i] * S)) * 2.5);
    const micro = clampSigned(((close[i] - hist(close, i, M)) / (safeAtr[i] * M)) * 3.0);
    microMoveNorm[i] = micro;
    const maStructure = ma14[i] > ma22[i] && ma22[i] > ma50[i] ? 1.0
      : ma14[i] < ma22[i] && ma22[i] < ma50[i] ? -1.0
        : ma14[i] > ma50[i] ? 0.35 : ma14[i] < ma50[i] ? -0.35 : 0.0;
    const vec = 0.38 * signedEfficiency[i] + 0.24 * localSlope + 0.23 * micro + 0.15 * maStructure;
    const hsc = 100.0 * clampSigned(vec);
    headingScore[i] = hsc;
    const strength = Math.abs(hsc);
    const hSign = hsc > I.headingClearThreshold ? 1 : hsc < -I.headingClearThreshold ? -1 : 0;
    headingSign[i] = hSign;
    const microSign = micro > 0.18 ? 1 : micro < -0.18 ? -1 : 0;
    tacticalSign[i] = hSign !== 0 ? hSign : strength > I.headingDeadZone ? (hsc > 0 ? 1 : -1) : (Math.abs(micro) > 0.32 ? microSign : 0);
  }

  // 6. Macro route
  const routeScore = new Array(n), routeSign = new Array(n);
  for (let i = 0; i < n; i++) {
    const h = H[i];
    const safeHtfAtr = Math.max(h.htfATR, mintick);
    const htfStructure = h.htfClose > h.htfMA50 && h.htfMA50 > h.htfMA200 ? 1.0
      : h.htfClose < h.htfMA50 && h.htfMA50 < h.htfMA200 ? -1.0
        : h.htfClose > h.htfMA200 ? 0.45 : h.htfClose < h.htfMA200 ? -0.45 : 0.0;
    const htfSlope = clampSigned(((h.htfMA50 - h.htfMA50Past) / (safeHtfAtr * 5.0)) * 2.5);
    const htfRouteVector = 0.70 * htfStructure + 0.30 * htfSlope;
    const curStructure = close[i] > ma50[i] && ma50[i] > ma200[i] ? 1.0
      : close[i] < ma50[i] && ma50[i] < ma200[i] ? -1.0
        : close[i] > ma200[i] ? 0.45 : close[i] < ma200[i] ? -0.45 : 0.0;
    const curSlope = clampSigned(((ma50[i] - hist(ma50, i, 5)) / (safeAtr[i] * 5.0)) * 2.5);
    const currentRouteVector = 0.70 * curStructure + 0.30 * curSlope;
    const routeVector = prof.htfWeight * htfRouteVector + (1.0 - prof.htfWeight) * currentRouteVector;
    routeScore[i] = 100.0 * clampSigned(routeVector);
    routeSign[i] = routeScore[i] > I.routeClearThreshold ? 1 : routeScore[i] < -I.routeClearThreshold ? -1 : 0;
  }

  // 7. Fuel
  const volumeBaseline = sma(volume, I.fuelBaselineLen);
  const rangeBaseline = ema(trueRange, I.fuelBaselineLen, seed);
  const barDirection = close.map((c, i) => (c > prevClose[i] ? 1.0 : c < prevClose[i] ? -1.0 : 0.0));
  const persistenceEma = ema(barDirection, 5, seed);
  const fuelRaw = new Array(n), volumeAvailable = new Array(n);
  for (let i = 0; i < n; i++) {
    const va = !isNa(volume[i]) && !isNa(volumeBaseline[i]) && volumeBaseline[i] > 0 && volume[i] > 0;
    volumeAvailable[i] = va;
    const volumeRelative = va ? volume[i] / volumeBaseline[i] : 1.0;
    const rangeRelative = rangeBaseline[i] > 0 ? trueRange[i] / rangeBaseline[i] : 1.0;
    const persistence = Math.abs(persistenceEma[i]);
    fuelRaw[i] = va
      ? 0.40 * Math.min(volumeRelative, 3.0) + 0.15 * Math.min(rangeRelative, 3.0) + 0.20 * Math.min(bodyAtr[i], 2.0) + 0.15 * persistence + 0.10 * Math.abs(signedEfficiency[i])
      : 0.25 * Math.min(rangeRelative, 3.0) + 0.30 * Math.min(bodyAtr[i], 2.0) + 0.25 * persistence + 0.20 * Math.abs(signedEfficiency[i]);
  }
  const fuelRawSmooth = ema(fuelRaw, I.fuelSmooth, seed);
  const fuelRankRaw = percentrank(fuelRawSmooth, prof.rankLen);
  const fuelFallbackBase = ema(fuelRawSmooth, Math.min(prof.rankLen, 50), seed);
  const fuelScore = new Array(n), fuelAcceleration = new Array(n);
  for (let i = 0; i < n; i++) {
    const fb = fuelFallbackBase[i] > 0 ? clamp100(50.0 * fuelRawSmooth[i] / fuelFallbackBase[i]) : 50.0;
    fuelScore[i] = nz(fuelRankRaw[i], fb);
    fuelAcceleration[i] = fuelScore[i] - nz(hist(fuelScore, i, I.speedAccelLookback), fuelScore[i]);
  }

  const speedClass = speedScore.map((s) => (s < I.speedSlowThreshold ? 0 : s < I.speedFastThreshold ? 1 : s < I.speedExtremeThreshold ? 2 : 3));
  const fuelClass = fuelScore.map((f) => (f < I.fuelLowThreshold ? 0 : f < I.fuelHighThreshold ? 1 : f < I.fuelExtremeThreshold ? 2 : 3));
  const fuelExhaustion = speedScore.map((s, i) => s >= 55 && fuelScore[i] >= 40 && fuelAcceleration[i] < -6);

  return {
    n, ma14, ma22, ma50, ma200, ma1000, atr, safeAtr, trueRange: trTrue(bars), prevClose,
    htf: H,
    instantSpeedRaw, flowSpeedRaw, speedScore, instantSpeedScore, speedAcceleration, speedClass,
    signedEfficiency, microMoveNorm, headingScore, headingSign, tacticalSign,
    routeScore, routeSign,
    volumeAvailable, fuelRaw, fuelScore, fuelAcceleration, fuelClass, fuelExhaustion,
  };
}
