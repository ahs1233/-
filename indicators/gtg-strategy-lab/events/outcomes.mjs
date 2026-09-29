// Outcomes of an event or control row at bar t (TRADE_CONTRACT §3, §8). Code only: nothing in
// the lab computes these on real data before the gates allow it (§31).
//
//   R_h      = D × (BidClose[t+h] − BidOpen[t+1]) / ATR[t]                    (C0, Δ_info)
//   MFE/MAE  from BidOpen[t+1] over t+1..t+h, in ATR[t], with and against D
//   C1       Long:  AskOpen[t+1] + s_in  →  BidClose[t+h] − s_out
//            Short: BidOpen[t+1] − s_in  →  AskClose[t+h] + s_out
//            s = 0.5 × contemporaneous spread (entry: spread at open t+1, exit: at close t+h);
//            commission 0. C2 = spread ×2 and slippage ×2. No real ASK → C1_unavailable.
//   censored when t+h is past the data or past `boundary` (a split end, §20) — that horizon only.
// Bars: { bo, bh, bl, bc, ao, ac } (BID and ASK); atr = the Pine safeAtr at t.
export function outcome(bars, t, D, h, atr, { boundary = bars.length - 1 } = {}) {
  const last = Math.min(bars.length - 1, boundary);
  if (t + h > last || t + 1 > last) return { h, censored: true };
  const entryBid = bars[t + 1].bo, exitBid = bars[t + h].bc;
  let up = -Infinity, dn = Infinity;
  for (let k = t + 1; k <= t + h; k++) { up = Math.max(up, bars[k].bh); dn = Math.min(dn, bars[k].bl); }
  const R = D * (exitBid - entryBid) / atr;
  const mfe = (D > 0 ? up - entryBid : entryBid - dn) / atr;
  const mae = (D > 0 ? entryBid - dn : up - entryBid) / atr;
  const cost = (k) => {
    const aIn = bars[t + 1].ao, aOut = bars[t + h].ac;
    if (aIn == null || aOut == null) return null;
    const spIn = aIn - bars[t + 1].bo, spOut = aOut - bars[t + h].bc;
    const sIn = 0.5 * spIn * k, sOut = 0.5 * spOut * k;
    const entry = D > 0 ? bars[t + 1].bo + spIn * k + sIn : bars[t + 1].bo - sIn;
    const exit = D > 0 ? bars[t + h].bc - sOut : bars[t + h].bc + spOut * k + sOut;
    return D * (exit - entry) / atr;
  };
  const c1 = cost(1), c2 = cost(2);
  return { h, censored: false, R, mfe, mae, R_C1: c1, R_C2: c2, C1_unavailable: c1 === null };
}
