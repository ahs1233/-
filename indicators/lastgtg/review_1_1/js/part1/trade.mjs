// One Part 1 trade (../../TEST_PREREGISTRATION.md v1.1, "Entry", "Exit", "Result, costs").
// m1: columns of the M1 BID/ASK feed (export_history.py), typed arrays of equal length, t
// ascending (ms, bar open); a missing ASK value is NaN:
//   { t, bo, bh, bl, bc, ao, ah, al, ac }
// sig: { close (ms, signal bar close), tfMs, dir (heading: 1 / -1 / 0), d (atrEng of the signal
//   bar), expiryClose (ms, close of the 300th signal-timeframe bar after the signal bar, or
//   Infinity when the feed has no such bar) }.
// Returns { status, cause?, outcome?, entry, exit, R, spread, entryT, exitT, skipped }:
//   status 'not_executable' (cause heading0 / gap / missing_open), 'unresolved_end', or 'done'
//   with outcome target / stop / both / stop_open / expired. `skipped` counts exit-side minutes
//   with a missing price (not in the contract; reported).
export const M1_MS = 60_000;

export function lowerBound(ts, x) {
  let lo = 0, hi = ts.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < x) lo = m + 1; else hi = m; }
  return lo;
}

export function simulateTrade(m1, sig) {
  const { close, tfMs, dir, d, expiryClose } = sig;
  if (dir === 0) return { status: 'not_executable', cause: 'heading0' };
  const n = m1.t.length;
  const e = lowerBound(m1.t, close);
  if (e >= n) return { status: 'unresolved_end', cause: 'no_m1_after_signal' };
  if (m1.t[e] - close > tfMs) return { status: 'not_executable', cause: 'gap', entryT: m1.t[e] };
  const entry = dir > 0 ? m1.ao[e] : m1.bo[e];
  if (!Number.isFinite(entry)) return { status: 'not_executable', cause: 'missing_open', entryT: m1.t[e] };
  const spread = m1.ao[e] - m1.bo[e];
  const target = entry + dir * d, stop = entry - dir * d;
  // Exit side: a long sells on BID, a short buys back on ASK.
  const O = dir > 0 ? m1.bo : m1.ao, H = dir > 0 ? m1.bh : m1.ah, L = dir > 0 ? m1.bl : m1.al, C = dir > 0 ? m1.bc : m1.ac;
  const done = (outcome, exit, j) => ({ status: 'done', outcome, entry, exit, R: ((exit - entry) * dir) / d, spread, entryT: m1.t[e], exitT: m1.t[j], skipped });
  let skipped = 0;
  for (let j = e; j < n; j++) {
    if (m1.t[j] >= expiryClose) break;
    const o = O[j], h = H[j], l = L[j];
    if (!Number.isFinite(h) || !Number.isFinite(l) || (j > e && !Number.isFinite(o))) { skipped++; continue; }
    if (j > e) {
      // Later minutes: the open first. Beyond the stop exits at the open; beyond the target at the target.
      if (dir > 0 ? o <= stop : o >= stop) return done('stop_open', o, j);
      if (dir > 0 ? o >= target : o <= target) return done('target', target, j);
    }
    const hitS = dir > 0 ? l <= stop : h >= stop;
    const hitT = dir > 0 ? h >= target : l <= target;
    if (hitS && hitT) return done('both', stop, j);
    if (hitS) return done('stop', stop, j);
    if (hitT) return done('target', target, j);
  }
  if (!Number.isFinite(expiryClose) || m1.t[n - 1] + M1_MS < expiryClose) return { status: 'unresolved_end', cause: 'm1_end', entry, spread, entryT: m1.t[e], skipped };
  // Expired: the last M1 close at or before the expiry bar's close, on the exit side.
  let j = lowerBound(m1.t, expiryClose - M1_MS + 1) - 1;
  while (j >= e && !Number.isFinite(C[j])) j--;
  if (j < e) return { status: 'unresolved_end', cause: 'no_exit_price', entry, spread, entryT: m1.t[e], skipped };
  return done('expired', C[j], j);
}

// Outcome groups of the report: target / stop (stop + stop_open) / both / expired.
export const OUTCOME_GROUP = { target: 'target', stop: 'stop', stop_open: 'stop', both: 'both', expired: 'expired' };
