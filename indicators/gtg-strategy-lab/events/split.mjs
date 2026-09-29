// Historical split, embargo, excluded windows and walk-forward folds (TRADE_CONTRACT §20, §21).
//
//   first valid  the first M5 bar at which every timeframe used (M5, M15, H1, H4, and D for
//                Route H4) has passed max(engineWindow, rankLen, 200) closed bars (D: 200)
//   by time      Train = first 50% of [firstValid, T_freeze), Validation = next 20%,
//                Historical Holdout = last 30%
//   embargo      48 M5 bars (4 h) on each side of each boundary: a row whose bar lies within
//                it belongs to no segment (its label could cross the boundary, §3 censoring
//                handles the horizon itself)
//   excluded     GTG development-capture days (UTC): 2024-01-05, 2026-09-27 … 2026-09-29
//   walk-forward K = 5 equal consecutive segments of the development period (Train + Val)
// Feature warm-up reads the past across boundaries and is never deleted (§20).
import { profileFor, zoneParams } from '../engine/profiles.mjs';
import { DEFAULTS, engineWindowFor } from '../engine/zone-engine.mjs';

export const EMBARGO_BARS = 48;
export const M5_MS = 300_000;
export const EXCLUDED_UTC_DAYS = Object.freeze(['2024-01-05', '2026-09-27', '2026-09-28', '2026-09-29']);
const DUR = { M5: 300_000, M15: 900_000, H1: 3_600_000, H4: 14_400_000, D: 86_400_000 };

export function warmupBars(tf, mintick) {
  if (tf === 'D') return 200;
  const prof = profileFor(tf);
  return Math.max(engineWindowFor(zoneParams(DEFAULTS, prof, mintick), prof.chartSec, prof.a1Sec, prof.a2Sec), prof.rankLen, 200);
}

// feeds: { M5, M15, H1, H4, D } bars (t = open, ms). Returns the first valid M5 bar time.
export function firstValidTime(feeds, mintick) {
  let ready = -Infinity;
  const need = {};
  for (const tf of ['M5', 'M15', 'H1', 'H4', 'D']) {
    const n = (need[tf] = warmupBars(tf, mintick));
    if (feeds[tf].length < n) return { t: null, need, reason: `${tf}: ${feeds[tf].length} < ${n} bars` };
    ready = Math.max(ready, feeds[tf][n - 1].t + DUR[tf]);   // close time of the n-th bar
  }
  const first = feeds.M5.find((b) => b.t >= ready);
  return { t: first ? first.t : null, need };
}

export function makeSplit(firstValid, tFreeze, { embargoMs = EMBARGO_BARS * M5_MS, excluded = EXCLUDED_UTC_DAYS, K = 5 } = {}) {
  if (!(firstValid < tFreeze)) throw new Error('split: first valid time must precede T_freeze');
  const span = tFreeze - firstValid;
  const b1 = firstValid + Math.floor((span * 5) / 10), b2 = firstValid + Math.floor((span * 7) / 10);   // integer ms, no float drift
  const ex = new Set(excluded);
  const foldLen = (b2 - firstValid) / K;
  const segmentOf = (t) => {
    if (t < firstValid || t >= tFreeze) return 'outside';
    if (ex.has(new Date(t).toISOString().slice(0, 10))) return 'excluded';
    for (const b of [b1, b2]) if (t >= b - embargoMs && t < b + embargoMs) return 'embargo';
    return t < b1 ? 'train' : t < b2 ? 'validation' : 'holdout';
  };
  const foldOf = (t) => (t >= firstValid && t < b2 && segmentOf(t) !== 'excluded' && segmentOf(t) !== 'embargo' ? Math.min(K - 1, Math.floor((t - firstValid) / foldLen)) : null);
  return { firstValid, tFreeze, boundaries: [b1, b2], embargoMs, segmentOf, foldOf };
}

// The Holdout is locked: nothing may read a holdout row until the registered final step.
export function assertNotHoldout(rows, split) {
  const bad = rows.filter((r) => split.segmentOf(r.time) === 'holdout');
  if (bad.length) throw new Error(`HOLDOUT LOCKED: ${bad.length} holdout rows passed to a pre-holdout step`);
  return rows;
}
