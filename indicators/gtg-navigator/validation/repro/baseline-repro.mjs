// Reproduction of review findings R1–R4 on the baseline reference (cdf1a8a).
// Run from the repository root at the baseline commit:
//   node indicators/gtg-navigator/validation/repro/baseline-repro.mjs
// R1 and R4 are transcriptions of Pine lines (named below), not Pine executions.
// R2 and R3 call the JS reference as it existed at the baseline.
import { DEFAULTS, SRC, TF, TYP, ST, makeLevel, memberKeyOf, runEpisode, selectSlots, emptySlot } from '../../reference/engine.mjs';

const out = [];
const log = (s) => { out.push(s); console.log(s); };

// R1 — transcription of slotDigest, gtg_navigator_v0.4.7.pine:1741-1742 (baseline).
{
  const M = 1000000007n;
  const tick = 0.01;
  const digest = (primaryKey, lo, hi) => {
    const loT = BigInt(Math.round(lo / tick));
    const hiT = BigInt(Math.round(hi / tick));
    return (BigInt(primaryKey) % M + (loT % M) * 7n + (hiT % M) * 13n) % M;
  };
  const pk = memberKeyOf(1_700_000_000_000, SRC.SWING, TF.LOCAL, TYP.HIGH);
  const a = digest(pk, 100.00, 101.00);
  const b = digest(pk, 100.13, 100.93);
  log(`R1 bounds [100,101] digest=${a}; bounds [100.13,100.93] digest=${b}; collision=${a === b}`);
  log('R1 slotDigest inputs are primaryKey, lo, hi only: member keys, entry keys, quality and level states are not inputs.');
}

// R2 — Astra fixture through the baseline runEpisode, against a hand oracle of the Pine formula.
{
  const lv = makeLevel({ key: 1, lo: 99.999, hi: 100, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: 0, s: 60, lastTestChartBar: 0 });
  const rej = runEpisode(lv, 100, 99.98, 99.98, 99.98, 0.1, 10, DEFAULTS);
  // Pine (line 864): width = max(hi − lo, mintick) = max(0.001, 0.01) = 0.01
  // epSide = −1 (prev close below lo); depth = (high − lo)/width = 0.001/0.01 = 0.1
  // rej = (lo − close)/(rejAtrK·ATR) = 0.019/0.1 = 0.19; mitigation = 0.1·(1 − 0.19)·0.6 = 0.0486
  const pineOracle = 0.1 * (1 - 0.19) * 0.6;
  log(`R2 JS mitigation=${lv.mitigation.toFixed(6)} rej=${rej.toFixed(6)}; Pine-formula oracle=${pineOracle.toFixed(6)}; ratio=${(lv.mitigation / pineOracle).toFixed(3)}`);
  log('R2 JS floors: runEpisode width 1e-12 (engine.mjs:80), Engine ATR 1e-12 (engine.mjs:495,538,547); Pine floors: syminfo.mintick (pine:532,571-572,864,1154,1162).');
}

// R3 — qEnter=55, qStay=80, one fixed zone with gateQ 70 above price, six bars.
{
  const P = { ...DEFAULTS, qEnter: 55, qStay: 80 };
  const m = makeLevel({ key: memberKeyOf(1_700_000_000_000, SRC.SWING, TF.LOCAL, TYP.HIGH), lo: 101, hi: 101.5, source: SRC.SWING, tfRank: TF.LOCAL, typ: TYP.HIGH, birthTime: 1_700_000_000_000, s: 70 });
  m.q = 70;
  let slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
  const seq = [];
  for (let bar = 0; bar < 6; bar++) {
    const zone = { lo: 101, hi: 101.5, members: [m], primary: m, gateQ: 70, displayQ: 70, hasA1: false, hasA2: false };
    const sel = selectSlots([zone], slots, { close: 100, atr: 1, atrA1: null, atrA2: null, ringC: [100] }, P);
    slots = sel.next;
    seq.push(slots[0].active);
  }
  log(`R3 R1.active over 6 bars = ${seq.join(',')}`);
}

// R4 — transcription of nearStrongObstacle, gtg_navigator_v0.4.7.pine:2169 (baseline).
{
  const strongQ = 72, nearObstacleAtr = 0.35;
  const fires = (prev, cur) => cur.q >= strongQ && cur.d <= nearObstacleAtr && (prev.d == null || prev.d > nearObstacleAtr);
  const prev = { q: 60, d: 0.20 }, cur = { q: 80, d: 0.20 };
  log(`R4 quality 60→80 at constant distance 0.20 ATR: alert=${fires(prev, cur)} (condition tests only the distance crossing)`);
}

export const lines = out;
