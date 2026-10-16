// Shared hand-built fixtures for the snapshot tests.
import { SRC, TF, TYP, ST, memberKeyOf } from './engine.mjs';

export const T0 = 1_700_000_000_000;
export const MINTICK = 0.01;
export const key = (i, typ = TYP.HIGH) => memberKeyOf(T0 + i * 60_000, SRC.SWING, TF.LOCAL, typ);

export function baseSnap() {
  const slot = (name, lo, hi, keys, side) => ({ name, active: true, containing: false, side, lo, hi, primaryKey: keys[0], lastKeys: [...keys].sort((a, b) => a - b), entryKeys: [...keys].sort((a, b) => a - b), gateQ: 66, displayQ: 69 });
  const lvl = (i, lo, hi) => ({
    key: key(i), source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: T0 + i * 60_000, price: hi,
    state: ST.ACTIVE, polarity: 1, lo, hi, s: 70, mitigation: 0.1, evidence: 0.5, tests: 1, ageNative: 12, epActive: false, epSide: 0, epMaxDepth: 0,
    breakDir: 0, breakCloses: 0, breakFromFlip: false, backCloses: 0, sinceTest: 4, sinceState: 12, sinceBack: null, navArmed: false,
  });
  const ring = Array.from({ length: 20 }, (_, k) => ({ o: 100 - k * 0.1, h: 100.2 - k * 0.1, l: 99.8 - k * 0.1, c: 100.05 - k * 0.1 }));
  return {
    meta: { symbol: 'TEST:XAUUSD', timeframe: '1', mintick: MINTICK, time: T0 },
    slots: [
      slot('R1', 100, 101, [key(1), key(2), key(3)], 1),
      slot('R2', 103, 103.5, [key(4)], 1),
      slot('S1', 98, 98.5, [key(5, TYP.LOW)], -1),
      { name: 'S2', active: false },
    ],
    levels: [lvl(1, 100, 100.6), lvl(2, 100.2, 101), lvl(3, 100.4, 100.9), lvl(4, 103, 103.5)],
    trackers: { high: { has: true, px: 103.5, since: 30, broken: false }, low: { has: false } },
    ring,
    obstacle: null, // consumer latch not modelled in this fixture
    events: { breakingUp: false, breakingDn: false, acceptedUp: false, acceptedDn: false, rejectR: false, rejectS: false, flipConfirmed: false },
  };
}
