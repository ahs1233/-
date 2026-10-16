// lastgtg B / C traffic light on a closed bar: line-for-line JS copy of
// ../handoff/lamp_core.pinefrag (gtgLampDecision, gtgLampReason) and the inputs of
// ../handoff/lamp_adapter.pinefrag. The obstacle inputs are A's own (../../live/lamp.mjs),
// so B differs from A only where the patch differs. A measure.mjs row is a closed bar, so the
// Pine "held" events of the last confirmed bar are that row's events.

import { obstacleInputs, LAMP_INPUTS } from '../../live/lamp.mjs';

// 0 red, 1 yellow, 2 green. Events never bypass current safety gates.
export function gtgLampDecision(ready, chase, inside, heading, route, accUp, accDn, breaking, rejR, rejS, nearTouch, aware, exhausted, lowFuel, mapped, room) {
  let lamp = 1;
  let reason = 0;
  if (!ready) reason = 10;
  else if (chase) { lamp = 0; reason = 20; }
  else if (inside) { lamp = 0; reason = 21; }
  else if (route !== 0 && heading !== 0 && route !== heading) { lamp = 0; reason = 22; }
  else if (heading === 0) reason = 30;
  else if (route === 0) reason = 31;
  else if (accUp && accDn) reason = 32;
  else if ((accUp && heading < 0) || (accDn && heading > 0)) reason = 33;
  else if (breaking && !(accUp || accDn)) reason = 34;
  else if (rejR || rejS) reason = rejR && rejS ? 35 : rejR ? 36 : 37;
  else if (nearTouch) reason = 40;
  else if (aware) reason = 41;
  else if (exhausted) reason = 42;
  else if (lowFuel) reason = 43;
  else if (!mapped) reason = 44;
  else if (!room) reason = 45;
  else if (heading === route) { lamp = 2; reason = accUp ? 51 : accDn ? 52 : 50; }
  return [lamp, reason];
}

export function gtgLampReason(reason, role) {
  switch (reason) {
    case 10: return 'بيانات غير مكتملة';
    case 20: return 'لا تطارد';
    case 21: return role === 1 ? 'داخل مقاومة' : role === -1 ? 'داخل دعم' : 'داخل منطقة';
    case 22: return 'عكس المسار العام';
    case 30: return 'بدون اتجاه واضح';
    case 31: return 'المسار العام غير واضح';
    case 32: return 'أحداث كسر متعاكسة';
    case 33: return 'الكسر السابق عكس الاتجاه الحالي';
    case 34: return 'كسر يحتاج تأكيد';
    case 35: return 'رفض من الجهتين';
    case 36: return 'رفض من مقاومة';
    case 37: return 'ارتداد من دعم';
    case 40: return role === 1 ? 'مقاومة قريبة' : role === -1 ? 'دعم قريب' : 'منطقة قريبة';
    case 41: return role === 1 ? 'مقاومة أمامه' : role === -1 ? 'دعم أمامه' : 'عائق أمامه';
    case 42: return 'الزخم يضعف';
    case 43: return 'الوقود ضعيف';
    case 44: return 'لم أجد منطقة أمامه';
    case 45: return 'المساحة المقاسة غير كافية';
    case 50: return 'الاتجاه متوافق والمساحة كافية';
    case 51: return 'كسر صاعد مقبول والشروط متحققة';
    case 52: return 'كسر هابط مقبول والشروط متحققة';
    default: return 'أدلة مختلطة';
  }
}

// lamp_adapter.pinefrag on one closed bar (the gtg*Closed snapshot).
export function lampOfBC(row, { mintick = 0.001, I = LAMP_INPUTS } = {}) {
  const x = obstacleInputs(row, { mintick, I });
  const ev = x.ev;
  const ready = row.engineOn !== false && [row.headingScore, row.routeScore, row.speedScore, row.fuelScore, row.htfATR, row.atrEng].every(Number.isFinite);
  const mapped = x.obstacleAvailable && Number.isFinite(x.nearestObstacleAtr)
    && ((x.headingSign > 0 && x.obstacleRole === 1 && x.dest1.lo >= x.close) || (x.headingSign < 0 && x.obstacleRole === -1 && x.dest1.hi <= x.close));
  const room = mapped && x.nearestObstacleAtr * x.atrEng >= I.greenRoomHtfAtr * x.safeHtfAtr;
  const [lamp, reason] = gtgLampDecision(ready, x.noChase, x.priceInsideObstacle, x.headingSign, x.routeSign,
    ev.acceptedUp, ev.acceptedDn, ev.breakingUp || ev.breakingDn, ev.rejectR, ev.rejectS,
    x.obstacleNear || x.candleTouchesObstacle, x.movingTowardResistance || x.movingTowardSupport,
    x.fuelExhaustion, row.fuelScore < I.fuelLowThreshold, mapped, room);
  return {
    lamp, reason, why: gtgLampReason(reason, x.obstacleRole),
    heading: x.headingSign, route: x.routeSign,
    accepted: ev.acceptedUp && ev.acceptedDn ? 2 : ev.acceptedUp ? 1 : ev.acceptedDn ? -1 : 0,
    room: mapped ? x.nearestObstacleAtr * x.atrEng : NaN,
    obstacleRole: x.obstacleRole,
  };
}

// gtgGreenStart / gtgGreenEnd over consecutive closed bars of one timeframe. Feed every bar,
// engine on or not; `engineStep` is engineOn on a confirmed bar (every history bar is confirmed).
// The Pine snapshot starts at lamp 1, heading 0. A uses the same rule on its own lamp.
export class EpisodeTracker {
  constructor() { this.lamp = 1; this.heading = 0; }
  push(engineStep, lamp, heading) {
    const start = engineStep && lamp === 2 && (this.lamp !== 2 || heading !== this.heading);
    const end = engineStep && this.lamp === 2 && lamp !== 2;
    this.lamp = lamp; this.heading = heading;
    return { start, end };
  }
}
