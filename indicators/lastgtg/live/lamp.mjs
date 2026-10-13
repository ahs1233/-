// lastgtg COMPACT panel on a closed bar: the traffic light and the four zone rows.
// Line-by-line port of lastgtg.pine §13 (obstacle awareness, no-chase), §14 inputs it needs
// and §16 (lamp, zoneLine). It reads one row of measure.mjs runTimeframe (a closed bar), so
// the Pine "held" events (last confirmed bar's events) are simply that row's events.
// Not ported: the "% من الحركة" suffix of the zone rows (needs the §15b zigzag).

export const LAMP_INPUTS = Object.freeze({
  headingClearThreshold: 20, routeClearThreshold: 22,
  speedFastThreshold: 70, speedExtremeThreshold: 90,
  fuelLowThreshold: 25,
  nearObstacleAtr: 0.35, awarenessObstacleAtr: 0.85, noChaseAtr: 0.30, noChaseFuelMax: 65,
  strongQ: 72, mediumQ: 48, greenRoomHtfAtr: 1.0,
});

const zoneDistance = (lo, hi, close) => (close < lo ? lo - close : close > hi ? close - hi : 0);

export function strengthWord(q, fem, I = LAMP_INPUTS) {
  return q >= I.strongQ ? (fem ? 'مهمة' : 'مهم') : q >= I.mediumQ ? (fem ? 'متوسطة' : 'متوسط') : (fem ? 'ضعيفة' : 'ضعيف');
}

// Pine str.tostring(d, d >= 100 ? "0" : d >= 0.1 ? "0.0" : format.mintick)
export function fmtDist(d, mintick = 0.001) {
  if (d >= 100) return String(Math.round(d));
  if (d >= 0.1) return (Math.round(d * 10) / 10).toFixed(1);
  const dec = Math.max(0, Math.round(-Math.log10(mintick)));
  return Number(d.toFixed(dec)).toString();
}

export function zoneDistText(slot, isRes, close, mintick) {
  const d = isRes ? slot.lo - close : close - slot.hi;
  return slot.containing || d <= 0 ? 'السعر عندها' : fmtDist(d, mintick);
}

export function zoneLine(slot, isRes, prefix, close, mintick, I = LAMP_INPUTS) {
  if (!slot || !slot.active) return prefix + (isRes ? 'لا مقاومة قريبة' : 'لا دعم قريب');
  return prefix + (isRes ? 'مقاومة ' : 'دعم ') + strengthWord(slot.displayQ, isRes, I) + ' • ' + zoneDistText(slot, isRes, close, mintick);
}

// row: one measure.mjs row. Returns the panel and the inputs that decided it.
export function lampOf(row, { mintick = 0.001, I = LAMP_INPUTS } = {}) {
  const [R1, R2, S1, S2] = row.slots;
  const close = row.c, high = row.h, low = row.l, atrEng = row.atrEng;
  const headingSign = row.headingSign, routeSign = row.routeSign;
  const { speedScore, instantSpeedScore, fuelScore, fuelAcceleration } = row;
  const ev = row.events;
  const safeHtfAtr = Math.max(row.htfATR ?? NaN, mintick);

  // §13 destination choice
  const mapDirectionSign = headingSign !== 0 ? headingSign : routeSign;
  const containR = R1.active && R1.containing;
  const containS = S1.active && S1.containing;
  const res1Dist = R1.active ? zoneDistance(R1.lo, R1.hi, close) / atrEng : 99.0;
  const sup1Dist = S1.active ? zoneDistance(S1.lo, S1.hi, close) / atrEng : 99.0;
  const primaryUp = containR ? true : containS ? false : (mapDirectionSign > 0 || (mapDirectionSign === 0 && res1Dist <= sup1Dist));
  const dest1 = primaryUp ? R1 : S1;
  const obstacleAvailable = !!dest1.active;
  const nearestObstacleAtr = obstacleAvailable ? zoneDistance(dest1.lo, dest1.hi, close) / atrEng : NaN;
  // dest1Type is the slot's role text: R slots read "مقاومة …", S slots "دعم …".
  const obstacleRole = !obstacleAvailable ? 0 : primaryUp ? 1 : -1;

  const priceInsideObstacle = obstacleAvailable && close >= dest1.lo && close <= dest1.hi;
  const candleTouchesObstacle = obstacleAvailable && high >= dest1.lo && low <= dest1.hi;
  const obstacleNear = obstacleAvailable && Number.isFinite(nearestObstacleAtr) && nearestObstacleAtr <= I.nearObstacleAtr;

  const fuelNotSupportingChase = fuelAcceleration < -3 || fuelScore < I.noChaseFuelMax || fuelScore + 18 < speedScore;
  const speedHotForChase = speedScore >= Math.max(60.0, I.speedFastThreshold - 10.0) || instantSpeedScore >= I.speedExtremeThreshold;
  const obstacleEngagedForChase = obstacleAvailable && (nearestObstacleAtr <= I.noChaseAtr || priceInsideObstacle || candleTouchesObstacle);
  const noChaseUp = headingSign > 0 && obstacleRole === 1 && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChaseDown = headingSign < 0 && obstacleRole === -1 && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChase = noChaseUp || noChaseDown;

  const fuelExhaustion = speedScore >= 55 && fuelScore >= 40 && fuelAcceleration < -6;
  const obstacleInAwarenessRange = obstacleAvailable && Number.isFinite(nearestObstacleAtr) && nearestObstacleAtr <= I.awarenessObstacleAtr;
  const movingTowardResistance = headingSign > 0 && obstacleRole === 1 && obstacleInAwarenessRange;
  const movingTowardSupport = headingSign < 0 && obstacleRole === -1 && obstacleInAwarenessRange;

  // §16 lamp: 2 green, 1 yellow, 0 red. kind tells which rule made it green.
  let lamp = 1, why = 'أدلة مختلطة', kind = null;
  if (ev.acceptedUp || ev.acceptedDn) { why = ev.acceptedUp ? 'اختراق مؤكد' : 'كسر مؤكد'; lamp = 2; kind = 'break'; }
  else if (noChase) { why = 'لا تطارد'; lamp = 0; }
  else if (priceInsideObstacle) { why = obstacleRole === 1 ? 'داخل مقاومة' : obstacleRole === -1 ? 'داخل دعم' : 'داخل منطقة'; lamp = 0; }
  else if (routeSign !== 0 && headingSign !== 0 && routeSign !== headingSign) { why = 'عكس المسار العام'; lamp = 0; }
  else if (ev.breakingUp || ev.breakingDn) why = 'كسر يحتاج تأكيد';
  else if (ev.rejectR || ev.rejectS) why = ev.rejectR ? 'رفض من مقاومة' : 'ارتداد من دعم';
  else if (obstacleNear || candleTouchesObstacle) why = obstacleRole === 1 ? 'مقاومة قريبة' : obstacleRole === -1 ? 'دعم قريب' : 'منطقة قريبة';
  else if (movingTowardResistance || movingTowardSupport) why = movingTowardResistance ? 'مقاومة أمامه' : 'دعم أمامه';
  else if (fuelExhaustion) why = 'الزخم يضعف';
  else if (headingSign === 0) why = 'بدون اتجاه واضح';
  else if (routeSign === 0) why = 'المسار العام غير واضح';
  else if (fuelScore < I.fuelLowThreshold) why = 'الوقود ضعيف';
  else if (headingSign === routeSign && obstacleAvailable && nearestObstacleAtr * atrEng < I.greenRoomHtfAtr * safeHtfAtr) why = obstacleRole === 1 ? 'مقاومة أمامه' : 'دعم أمامه';
  else if (headingSign === routeSign) { why = 'الاتجاه متوافق'; lamp = 2; kind = 'aligned'; }
  const dirText = headingSign > 0 ? 'صاعد' : headingSign < 0 ? 'هابط' : 'متردد';
  // Direction of a green light: the accepted break's side, otherwise the heading.
  const greenDir = kind === 'break' ? (ev.acceptedUp ? 1 : -1) : kind === 'aligned' ? headingSign : 0;

  return {
    lamp, why, kind, greenDir, dirText,
    head: dirText + ' • ' + why,
    rows: [
      zoneLine(R1, true, '', close, mintick, I),
      zoneLine(R2, true, 'بعد الاختراق • ', close, mintick, I),
      zoneLine(S1, false, '', close, mintick, I),
      zoneLine(S2, false, 'بعد الكسر • ', close, mintick, I),
    ],
    zones: { R1, R2, S1, S2 },
    nearestObstacleAtr, obstacleRole,
  };
}

// Pine dxyText on confirmed bars: EMA20 / EMA50 of the dollar index closes.
export function dxyText(closes) {
  if (!closes || closes.length < 50) return 'الدولار • غير متاح';
  const ema = (len) => { const a = 2 / (len + 1); let e = closes.slice(0, len).reduce((s, x) => s + x, 0) / len; for (let i = len; i < closes.length; i++) e = a * closes[i] + (1 - a) * e; return e; };
  const c = closes[closes.length - 1], f = ema(20), s = ema(50);
  return c > f && f > s ? 'الدولار صاعد • ضغط على الذهب' : c < f && f < s ? 'الدولار هابط • يدعم الذهب' : 'الدولار متردد';
}
