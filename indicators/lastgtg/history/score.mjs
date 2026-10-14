// Outcome of one green light on M1 bars (HISTORY_PREREGISTRATION.md, LIVE_PREREGISTRATION.md).
// m1: columns { t, h, l, ah, al, ac } (arrays, same length, t ascending; ask NaN when absent).

// First index whose t >= x (binary search).
export function lowerBound(ts, x) {
  let lo = 0, hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// Scoring A (as runner.mjs resolveGreens): BID, target/stop around the signal close.
export function scoreBid(m1, from, dir, target, stop, expiresAt) {
  for (let j = from; j < m1.t.length; j++) {
    const hitT = dir > 0 ? m1.h[j] >= target : m1.l[j] <= target;
    const hitS = dir > 0 ? m1.l[j] <= stop : m1.h[j] >= stop;
    if (hitT && hitS) return { res: 'loss_both', j };
    if (hitS) return { res: 'loss', j };
    if (hitT) return { res: 'win', j };
    if (m1.t[j] >= expiresAt) return { res: 'expired', j };
  }
  return { res: 'open_at_end', j: -1 };
}

// Scoring B: a long buys at ASK (entryAsk) and sells on BID; a short sells at BID (entryBid)
// and buys back on ASK. Target / stop = entry ± dist.
export function scoreSpread(m1, from, dir, entryBid, entryAsk, dist, expiresAt) {
  const entry = dir > 0 ? entryAsk : entryBid;
  if (!Number.isFinite(entry)) return { res: 'no_ask', j: -1, entry };
  const target = entry + dir * dist, stop = entry - dir * dist;
  for (let j = from; j < m1.t.length; j++) {
    let hitT, hitS;
    if (dir > 0) { hitT = m1.h[j] >= target; hitS = m1.l[j] <= stop; }
    else {
      if (!Number.isFinite(m1.ah[j]) || !Number.isFinite(m1.al[j])) return { res: 'no_ask', j, entry };
      hitT = m1.al[j] <= target; hitS = m1.ah[j] >= stop;
    }
    if (hitT && hitS) return { res: 'loss_both', j, entry };
    if (hitS) return { res: 'loss', j, entry };
    if (hitT) return { res: 'win', j, entry };
    if (m1.t[j] >= expiresAt) return { res: 'expired', j, entry };
  }
  return { res: 'open_at_end', j: -1, entry };
}

// Wilson score interval for k successes out of n at normal quantile z.
export function wilson(k, n, z) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [c - h, c + h];
}
export const Z_995 = 2.807033768; // two-sided 99.5%

// Tally of outcomes; win share = wins / (wins + losses + loss_both + expired).
export function tally(results) {
  const c = { win: 0, loss: 0, loss_both: 0, expired: 0, open_at_end: 0, no_ask: 0 };
  for (const r of results) c[r] = (c[r] || 0) + 1;
  const n = c.win + c.loss + c.loss_both + c.expired;
  return { ...c, n, share: n ? c.win / n : NaN };
}
