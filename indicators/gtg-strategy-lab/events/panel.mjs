// The event panel (TRADE_CONTRACT §3, §6, §7): one row per bar of the event timeframe (M5),
// built only from Measurement Engine rows, with every higher-timeframe value taken from the
// last X bar whose close time ≤ close(t−1) — "at t−1" for covariates and Macro conditions.
//
//   rows      runTimeframe(...).rows of the event timeframe
//   mtf       { M15: rows, H1: rows, H4: rows } — runTimeframe rows of each timeframe
//   durMs     bar duration of each timeframe (an X bar is closed at X.t + durMs[X]; a bar that
//             closes early — a corrected early close — is treated as closing at t + dur,
//             which is later, never earlier: no look-ahead)
export const DUR_MS = Object.freeze({ M1: 60_000, M5: 300_000, M15: 900_000, H1: 3_600_000, H4: 14_400_000 });

const NA_MTF = Object.freeze({ i: -1, t: null, routeSign: 0, headingSign: 0, routeScore: NaN, headingScore: NaN });

// For each target time T[j] (ascending), the index of the last X bar closed by T[j].
export function lastClosedIndex(T, xRows, durMs) {
  const out = new Array(T.length);
  let k = -1;
  for (let j = 0; j < T.length; j++) {
    while (k + 1 < xRows.length && xRows[k + 1].t + durMs <= T[j]) k++;
    out[j] = k;
  }
  return out;
}

const mtfView = (r, i) => (i < 0 ? NA_MTF : {
  i, t: r.t, routeSign: r.routeSign, headingSign: r.headingSign, routeScore: r.routeScore, headingScore: r.headingScore,
});

export function buildPanel(rows, mtf = {}, { tf = 'M5', durMs = DUR_MS } = {}) {
  const dur = durMs[tf];
  // close(t−1) for bar t; for t = 0 nothing is known yet
  const prevClose = rows.map((r, t) => (t > 0 ? rows[t - 1].t + dur : -Infinity));
  const idx = Object.fromEntries(Object.entries(mtf).map(([x, xr]) => [x, lastClosedIndex(prevClose, xr, durMs[x])]));
  return rows.map((r, t) => {
    const p = t > 0 ? rows[t - 1] : null;
    const at1 = Object.fromEntries(Object.entries(mtf).map(([x, xr]) => [x, mtfView(xr[idx[x][t]], idx[x][t])]));
    return {
      i: t, t: r.t, o: r.o, h: r.h, l: r.l, c: r.c,
      atr: r.atr, atrEng: r.atrEng,
      headingSign: r.headingSign, headingScore: r.headingScore, routeSign: r.routeSign,
      slots: r.slots, events: r.events, log: r.log, consumer: r.consumer, engineOn: r.engineOn, warmed: r.warmed,
      prev: p && { headingSign: p.headingSign, headingScore: p.headingScore, routeSign: p.routeSign, speedClass: p.speedClass, atr: p.atr, atrEng: p.atrEng, slots: p.slots },
      mtf1: { [tf]: p ? { i: t - 1, t: p.t, routeSign: p.routeSign, headingSign: p.headingSign, routeScore: p.routeScore, headingScore: p.headingScore } : NA_MTF, ...at1 },
    };
  });
}
