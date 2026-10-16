// Frozen v0.4.7 inputs and per-timeframe profiles, transcribed from
// gtg_navigator_v0.4.7.pine (blob 0c7cbe3). profiles.test.mjs re-reads the frozen Pine
// file and fails if any value here drifts from it.

export const INPUTS = Object.freeze({
  maType: 'EMA',
  speedSmooth: 3, speedAccelLookback: 3,
  speedSlowThreshold: 25, speedFastThreshold: 70, speedExtremeThreshold: 90,
  headingLookback: 14, headingSlopeLookback: 8,
  headingClearThreshold: 20, headingStrongThreshold: 60, headingDeadZone: 15,
  routeClearThreshold: 22, routeStrongThreshold: 62,
  fuelSmooth: 3, fuelBaselineLen: 50,
  fuelLowThreshold: 25, fuelHighThreshold: 70, fuelExtremeThreshold: 90,
  nearObstacleAtr: 0.35, awarenessObstacleAtr: 0.85, noChaseAtr: 0.30, noChaseFuelMax: 65,
  strongQ: 72, mediumQ: 48,
});

export const TF_MIN = Object.freeze({ M1: 1, M5: 5, M15: 15, H1: 60, H4: 240, D: 1440 });
const TF_OF_PINE = Object.freeze({ '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', D: 'D' });

// Intraday profiles only: the lab runs M1..H4 (TRADE_CONTRACT §19, message 5).
export function profileFor(tf) {
  const m = TF_MIN[tf];
  if (!m || tf === 'D') throw new Error(`unsupported lab timeframe ${tf}`);
  const autoHTF = m <= 1 ? '15' : m <= 5 ? '60' : m <= 15 ? '60' : m <= 60 ? '240' : 'D';
  const rankLen = m <= 1 ? 1000 : m <= 5 ? 500 : m <= 15 ? 320 : m <= 60 ? 240 : m <= 240 ? 180 : 160;
  const speedFlowLen = m <= 1 ? 8 : m <= 5 ? 6 : m <= 15 ? 5 : m <= 60 ? 4 : 3;
  const htfWeight = m <= 1 ? 0.70 : m <= 5 ? 0.65 : m <= 15 ? 0.60 : m <= 60 ? 0.55 : 0.45;
  const { headingLookback: hl, headingSlopeLookback: hs } = INPUTS;
  const headingEffLen = m <= 1 ? Math.min(hl, 8) : m <= 5 ? Math.min(hl, 10) : m <= 15 ? Math.min(hl, 12) : hl;
  const headingSlopeEffLen = m <= 1 ? Math.min(hs, 4) : m <= 5 ? Math.min(hs, 5) : m <= 15 ? Math.min(hs, 6) : hs;
  const microLen = m <= 1 ? 3 : m <= 5 ? 3 : m <= 15 ? 4 : m <= 60 ? 5 : 6;
  const profClass = m <= 1 ? 0 : m <= 5 ? 1 : m <= 15 ? 2 : m <= 60 ? 3 : 4;
  const a1Tf = ['5', '15', '60', '240', 'D'][profClass];
  const a2Tf = ['15', '60', '240', 'D', 'W'][profClass];
  const pivotLen = profClass === 0 ? 3 : profClass === 1 ? 4 : 5;
  const maxAgeLocal = [720, 576, 480, 360, 270][profClass];
  const flipWindow = [60, 48, 48, 72, 42][profClass];
  const secOf = (p) => (p === 'D' ? 86400 : p === 'W' ? 604800 : Number(p) * 60);
  return Object.freeze({
    tf, minutes: m, chartSec: m * 60,
    htfTf: TF_OF_PINE[autoHTF], htfSec: secOf(autoHTF),
    rankLen, speedFlowLen, htfWeight, headingEffLen, headingSlopeEffLen, microLen,
    profClass, a1Tf, a2Tf, a1Sec: secOf(a1Tf), a2Sec: secOf(a2Tf), pivotLen, maxAgeLocal, flipWindow,
  });
}

// Zone-engine parameters for a timeframe (reference DEFAULTS carry the M1 profile).
export function zoneParams(DEFAULTS, prof, mintick) {
  if (!(Number.isFinite(mintick) && mintick > 0)) throw new Error('mintick required');
  return Object.freeze({ ...DEFAULTS, pivotLen: prof.pivotLen, maxAge: [prof.maxAgeLocal, 96, 64], flipWindow: prof.flipWindow, mintick });
}
