// Transcription of the consumer classifications that R3b's input contracts protect.
// These are copies of single Pine lines (not a model of sections 13–17). Each function
// names its Pine source, and pine-contract.test.mjs (C11) fails if that Pine text
// changes, so the transcription can never silently drift.
import { checkParams } from './engine.mjs';

// Pine input defaults (gtg_navigator_v0.4.7.pine, groups Speed / Heading / Route).
export const CONSUMER_DEFAULTS = Object.freeze({
  speedSlowThreshold: 25, speedFastThreshold: 70, speedExtremeThreshold: 90,
  headingClearThreshold: 20, headingStrongThreshold: 60, headingDeadZone: 15,
  routeClearThreshold: 22, routeStrongThreshold: 62,
});

// pine: string speedClass = speedScore < speedSlowThreshold ? "بطيئة" : speedScore < speedFastThreshold ? "طبيعية" : speedScore < speedExtremeThreshold ? "سريعة" : "استثنائية"
// pine: color speedColor = speedScore >= speedExtremeThreshold ? color.orange : speedScore >= speedFastThreshold ? color.yellow : color.white
// pine: speedBurst = barstate.isconfirmed and speedScore >= speedExtremeThreshold and speedScore[1] < speedExtremeThreshold
export function speedView(score, prevScore, C = CONSUMER_DEFAULTS) {
  checkParams(C);
  const cls = score < C.speedSlowThreshold ? 'بطيئة' : score < C.speedFastThreshold ? 'طبيعية' : score < C.speedExtremeThreshold ? 'سريعة' : 'استثنائية';
  const color = score >= C.speedExtremeThreshold ? 'orange' : score >= C.speedFastThreshold ? 'yellow' : 'white';
  const burst = score >= C.speedExtremeThreshold && prevScore < C.speedExtremeThreshold;
  return { cls, color, burst };
}

// pine: int headingSign = headingScore > headingClearThreshold ? 1 : headingScore < -headingClearThreshold ? -1 : 0
// pine: string headingText = headingScore >= headingStrongThreshold ? "↑ صاعد بقوة" : headingScore > headingClearThreshold ? "↗ صاعد" :
//       headingScore <= -headingStrongThreshold ? "↓ هابط بقوة" : headingScore < -headingClearThreshold ? "↘ هابط" :
//       headingStrength <= headingDeadZone ? "→ غير حاسم" : headingScore > 0 ? "↗ ميل صاعد ضعيف" : "↘ ميل هابط ضعيف"
export function headingView(score, C = CONSUMER_DEFAULTS) {
  checkParams(C);
  const sign = score > C.headingClearThreshold ? 1 : score < -C.headingClearThreshold ? -1 : 0;
  const text = score >= C.headingStrongThreshold ? '↑ صاعد بقوة' : score > C.headingClearThreshold ? '↗ صاعد'
    : score <= -C.headingStrongThreshold ? '↓ هابط بقوة' : score < -C.headingClearThreshold ? '↘ هابط'
      : Math.abs(score) <= C.headingDeadZone ? '→ غير حاسم' : score > 0 ? '↗ ميل صاعد ضعيف' : '↘ ميل هابط ضعيف';
  return { sign, text };
}

// pine: int routeSign = routeScore > routeClearThreshold ? 1 : routeScore < -routeClearThreshold ? -1 : 0
// pine: string routeText = routeScore >= routeStrongThreshold ? "↑ صاعد بقوة" : routeScore > routeClearThreshold ? "↗ صاعد" :
//       routeScore <= -routeStrongThreshold ? "↓ هابط بقوة" : routeScore < -routeClearThreshold ? "↘ هابط" : "→ غير حاسم"
export function routeView(score, C = CONSUMER_DEFAULTS) {
  checkParams(C);
  const sign = score > C.routeClearThreshold ? 1 : score < -C.routeClearThreshold ? -1 : 0;
  const text = score >= C.routeStrongThreshold ? '↑ صاعد بقوة' : score > C.routeClearThreshold ? '↗ صاعد'
    : score <= -C.routeStrongThreshold ? '↓ هابط بقوة' : score < -C.routeClearThreshold ? '↘ هابط' : '→ غير حاسم';
  return { sign, text };
}

// Direction a text claims: +1 up, −1 down, 0 undecided / weak lean.
export const textDirection = (text) => (text.startsWith('↑') || text === '↗ صاعد' ? 1 : text.startsWith('↓') || text === '↘ هابط' ? -1 : 0);

export const CONSUMER_DEFAULTS_FUEL = Object.freeze({ fuelLowThreshold: 25, fuelHighThreshold: 70, fuelExtremeThreshold: 90 });

// --- The remaining alert conditions (R4-C), transcribed verbatim; pinned by C11. ---
// pine: fuelSurge = barstate.isconfirmed and fuelScore >= fuelHighThreshold and fuelScore[1] < fuelHighThreshold
export const fuelSurge = (confirmed, fuel, prevFuel, C = CONSUMER_DEFAULTS_FUEL) => confirmed && fuel >= C.fuelHighThreshold && prevFuel < C.fuelHighThreshold;
// pine: headingUp = barstate.isconfirmed and headingScore > headingClearThreshold and headingScore[1] <= headingClearThreshold
export const headingUp = (confirmed, h, prevH, C = CONSUMER_DEFAULTS) => confirmed && h > C.headingClearThreshold && prevH <= C.headingClearThreshold;
// pine: headingDown = barstate.isconfirmed and headingScore < -headingClearThreshold and headingScore[1] >= -headingClearThreshold
export const headingDown = (confirmed, h, prevH, C = CONSUMER_DEFAULTS) => confirmed && h < -C.headingClearThreshold && prevH >= -C.headingClearThreshold;
// pine: speedBurst (see speedView), with the confirmed gate made explicit.
export const speedBurstAlert = (confirmed, s, prevS, C = CONSUMER_DEFAULTS) => confirmed && speedView(s, prevS, C).burst;
// pine: noChaseEvent = barstate.isconfirmed and noChase and not noChase[1]
export const noChaseEvent = (confirmed, noChase, prevNoChase) => confirmed && noChase && !prevNoChase;
// pine: obstacleBreakEvent = breakResistance or breakSupport (= ev.breakingUp or ev.breakingDn), and alike
export const engineAlerts = (ev) => ({
  obstacleBreak: ev.breakingUp || ev.breakingDn,
  obstacleReject: ev.rejectR || ev.rejectS,
  breakAccepted: ev.acceptedUp || ev.acceptedDn,
  flipConfirmed: ev.flipConfirmed,
});
