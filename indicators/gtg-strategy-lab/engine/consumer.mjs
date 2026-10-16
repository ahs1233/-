// Sections 12 (slot adapter: displayQ), 13 (obstacle awareness) and 17 (the ten alerts)
// of gtg_navigator_v0.4.7.pine, one confirmed bar at a time.
import { strongObstacleStep, newObstacleLatch } from '../gtg-engine/reference/obstacle.mjs';
import { INPUTS } from './profiles.mjs';

// Pine 1497–1500: displayQ = min(100, gateQ + 4·maConf + 3·psychConf). psychConf needs
// syminfo.type == "crypto" (false for XAUUSD); includeMA200/includeMA1000 default true.
export function displayQOf(slot, ma200, ma1000, { isCrypto = false, close = NaN } = {}) {
  if (!slot.active) return slot.quality;
  const maConf = (ma200 >= slot.lo && ma200 <= slot.hi) || (ma1000 >= slot.lo && ma1000 <= slot.hi);
  let psychConf = false;
  if (isCrypto) {
    const p = close;
    const step = p >= 100000 ? 10000 : p >= 50000 ? 5000 : p >= 10000 ? 1000 : p >= 1000 ? 500 : p >= 100 ? 50 : p >= 10 ? 5 : 1;
    psychConf = Math.ceil(slot.lo / step) * step <= slot.hi;
  }
  return Math.min(100, slot.gateQ + (maConf ? 4 : 0) + (psychConf ? 3 : 0));
}

const zoneDistance = (lo, hi, c) => (c < lo ? lo - c : c > hi ? c - hi : 0.0);

export function newConsumerState() {
  return { latch: newObstacleLatch(), prevNoChase: false, prevSpeed: NaN, prevFuel: NaN, prevHeading: NaN };
}

// slots: [R1, R2, S1, S2] after this bar's write (quality = displayQ). ev: engine events.
// s: sensor values at this bar. Returns the consumer row and advances `st`.
export function consumerStep(st, bar, slots, ev, s, atrEng, I = INPUTS) {
  const [R1, R2, S1, S2] = slots;
  const c = bar.c;
  const lo = (x) => (x.active ? x.lo : NaN), hi = (x) => (x.active ? x.hi : NaN), q = (x) => (x.active ? x.quality : NaN);
  const mapDirectionSign = s.tacticalSign !== 0 ? s.tacticalSign : s.routeSign;
  const containR = R1.active && R1.containing, containS = S1.active && S1.containing;
  const res1Dist = R1.active ? zoneDistance(R1.lo, R1.hi, c) / atrEng : 99.0;
  const sup1Dist = S1.active ? zoneDistance(S1.lo, S1.hi, c) / atrEng : 99.0;
  const primaryUp = containR ? true : containS ? false : (mapDirectionSign > 0 || (mapDirectionSign === 0 && res1Dist <= sup1Dist));
  const d1 = primaryUp ? R1 : S1;
  const dest1Low = lo(d1), dest1High = hi(d1), dest1Strength = q(d1);
  const obstacleAvailable = !Number.isNaN(dest1Low) && !Number.isNaN(dest1High);
  const nearestObstacleAtr = !Number.isNaN(dest1Low) ? zoneDistance(dest1Low, dest1High, c) / atrEng : NaN;
  const nearestObstacleStrong = !Number.isNaN(dest1Strength) && dest1Strength >= I.strongQ;
  // roleType text is "مقاومة • …" for R slots and "دعم • …" for S slots; no source/tag word
  // contains the other side's keywords, so the role is the slot side.
  const obstacleRole = !obstacleAvailable ? 0 : primaryUp ? 1 : -1;
  const priceInsideObstacle = obstacleAvailable && c >= dest1Low && c <= dest1High;
  const candleTouchesObstacle = obstacleAvailable && bar.h >= dest1Low && bar.l <= dest1High;
  const obstacleNear = obstacleAvailable && !Number.isNaN(nearestObstacleAtr) && nearestObstacleAtr <= I.nearObstacleAtr;

  const fuelNotSupportingChase = s.fuelAcceleration < -3 || s.fuelScore < I.noChaseFuelMax || s.fuelScore + 18 < s.speedScore;
  const speedHotForChase = s.speedScore >= Math.max(60.0, I.speedFastThreshold - 10.0) || s.instantSpeedScore >= I.speedExtremeThreshold;
  const obstacleEngagedForChase = obstacleAvailable && (nearestObstacleAtr <= I.noChaseAtr || priceInsideObstacle || candleTouchesObstacle);
  const noChaseUp = s.tacticalSign > 0 && obstacleRole === 1 && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChaseDown = s.tacticalSign < 0 && obstacleRole === -1 && obstacleEngagedForChase && speedHotForChase && fuelNotSupportingChase;
  const noChase = noChaseUp || noChaseDown;

  // 17. alerts (every lab bar is a confirmed bar)
  const speedBurst = s.speedScore >= I.speedExtremeThreshold && st.prevSpeed < I.speedExtremeThreshold;
  const fuelSurge = s.fuelScore >= I.fuelHighThreshold && st.prevFuel < I.fuelHighThreshold;
  const headingUp = s.headingScore > I.headingClearThreshold && st.prevHeading <= I.headingClearThreshold;
  const headingDown = s.headingScore < -I.headingClearThreshold && st.prevHeading >= -I.headingClearThreshold;
  const dest1EntryKeys = primaryUp ? R1.entryKeys : S1.entryKeys;
  const latchBefore = st.latch;
  const obs = { confirmed: true, available: obstacleAvailable, strength: Number.isNaN(dest1Strength) ? null : dest1Strength,
    distAtr: Number.isNaN(nearestObstacleAtr) ? null : nearestObstacleAtr, entryKeys: dest1EntryKeys };
  const so = strongObstacleStep(latchBefore, obs, { strongQ: I.strongQ, nearObstacleAtr: I.nearObstacleAtr });
  const strongObsNow = so.latch.state;
  const strongObsSame = latchBefore.keys.some((k) => dest1EntryKeys.includes(k));
  const nearStrongObstacle = so.event;
  const noChaseEvent = noChase && !st.prevNoChase;
  const obstacleBreakEvent = ev.breakingUp || ev.breakingDn;
  const obstacleRejectEvent = ev.rejectR || ev.rejectS;
  const breakAcceptedEvent = ev.acceptedUp || ev.acceptedDn;
  const flipConfirmedEvent = ev.flipConfirmed;
  const engineEventBits = (ev.breakingUp ? 1 : 0) + (ev.breakingDn ? 2 : 0) + (ev.acceptedUp ? 4 : 0) + (ev.acceptedDn ? 8 : 0)
    + (ev.rejectR ? 16 : 0) + (ev.rejectS ? 32 : 0) + (ev.flipConfirmed ? 64 : 0);
  const alertBits = (speedBurst ? 1 : 0) + (fuelSurge ? 2 : 0) + (headingUp ? 4 : 0) + (headingDown ? 8 : 0) + (nearStrongObstacle ? 16 : 0)
    + (noChaseEvent ? 32 : 0) + (obstacleBreakEvent ? 64 : 0) + (obstacleRejectEvent ? 128 : 0) + (breakAcceptedEvent ? 256 : 0) + (flipConfirmedEvent ? 512 : 0);
  const obsState = (strongObsNow ? 1 : 0) + (latchBefore.state ? 2 : 0) + (strongObsSame ? 4 : 0) + (nearStrongObstacle ? 8 : 0);

  st.latch = so.latch;
  st.prevNoChase = noChase;
  st.prevSpeed = s.speedScore; st.prevFuel = s.fuelScore; st.prevHeading = s.headingScore;

  return {
    primaryUp, dest1Low, dest1High, dest1Strength, nearestObstacleAtr, nearestObstacleStrong, obstacleRole,
    priceInsideObstacle, candleTouchesObstacle, obstacleNear, noChaseUp, noChaseDown, noChase,
    speedBurst, fuelSurge, headingUp, headingDown, nearStrongObstacle, noChaseEvent,
    obstacleBreakEvent, obstacleRejectEvent, breakAcceptedEvent, flipConfirmedEvent,
    eventBits: engineEventBits + alertBits * 128, alertBits, engineEventBits, obsState,
    latch: { state: so.latch.state, keys: so.latch.keys.slice() },
  };
}
