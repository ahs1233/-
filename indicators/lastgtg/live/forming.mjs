// The live feeds hold closed bars only, but the engine (like Pine's request.security with
// expr[1] + lookahead_on) finds the higher-timeframe bar that CONTAINS the chart bar and then
// reads the one before it. Without the forming bar that lookup lands one closed bar too early.
// withForming appends a placeholder for the forming bar (only its open time is read: every value
// the engine uses comes from bars before it).
export function withForming(bars, sec, chartT) {
  if (!bars || !bars.length) return bars;
  const last = bars[bars.length - 1];
  const t = last.t + sec * 1000;
  if (t > chartT) return bars; // the chart bar still lies inside the last closed bar
  return [...bars, { t, o: last.c, h: last.c, l: last.c, c: last.c, v: 0 }];
}
