// R5 — independent history loads for the reload/determinism tests.
//
// A "market" is one timestamped M1 stream with session gaps (daily break and weekend,
// XAU-like). A "load" is what one chart instance sees: a contiguous slice of the market.
// Everything the engine consumes is rebuilt from the load alone, never shared between
// loads:
//   - the chart series (finite-memory ATR, pivots) from the load's own bars;
//   - the A1/A2 anchor feeds from HTF bars aggregated by *time bucket* from the market,
//     starting at the load's own HTF history start (Pine requests HTF data separately,
//     so its HTF history need not start where the chart's does);
//   - the engine start, from the end of the load as in Pine:
//       engineOn = bar_index >= last_bar_index − (engineWindow + studyExtraBars).
// A bar is warmed once the engine has run more than W bars on it (Pine 18b:
// tel.engineBars > engineWindow), i.e. index ≥ start + W.
//
// HTF semantics follow the Pine call
//   request.security(tickerid, tf, anchorFeed(plen), lookahead = barmerge.lookahead_on)
// where anchorFeed returns every value with [1]: on a chart bar inside HTF bar k the
// feed is HTF bar k−1 (the last closed one), its bar_index, its SMA(TR, 20) and the last
// three pivots confirmed on or before it. HTF bars exist only for buckets with data.
import { TYP, computeSeries, Engine, engineWindowFor, syntheticBars } from './engine.mjs';
import { canonicalSnapshot } from './snapshot.mjs';

export const MIN_MS = 60_000;
export const A1_SEC = 300;
export const A2_SEC = 900;

// Open minute for the XAU-like session (UTC): closed Fri 21:00 → Sun 22:00 and every
// day 21:00–22:00.
export function sessionOpen(t) {
  const d = new Date(t);
  const wd = d.getUTCDay(), h = d.getUTCHours();
  if (wd === 6) return false;
  if (wd === 5 && h >= 21) return false;
  if (wd === 0 && h < 22) return false;
  if (h === 21) return false;
  return true;
}

// n open M1 bars from t0 (inclusive, first open minute at or after t0). Prices are the
// seeded synthetic process; only the timestamps follow the session calendar.
export function marketBars(n, seed, t0 = Date.UTC(2024, 0, 1)) {
  const px = syntheticBars(n, seed);
  const out = new Array(n);
  let t = Math.ceil(t0 / MIN_MS) * MIN_MS;
  for (let i = 0; i < n; i++) {
    while (!sessionOpen(t)) t += MIN_MS;
    out[i] = { t, o: px[i].o, h: px[i].h, l: px[i].l, c: px[i].c };
    t += MIN_MS;
  }
  return out;
}

export const bucketOf = (t, sec) => Math.floor(t / (sec * 1000)) * sec * 1000;

// HTF bars from market bars with fromTime ≤ t ≤ toTime, one per non-empty bucket; the
// bar time is the bucket start (Pine: HTF `time` is the HTF bar's open time).
export function htfBarsOf(market, sec, fromTime, toTime) {
  const out = [];
  for (const b of market) {
    if (b.t < fromTime || b.t > toTime) continue;
    const bt = bucketOf(b.t, sec);
    const last = out[out.length - 1];
    if (last && last.t === bt) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; }
    else out.push({ t: bt, o: b.o, h: b.h, l: b.l, c: b.c });
  }
  return out;
}

// Per-HTF-bar feed values (what anchorFeed computes before the [1] offset).
export function htfFeedValues(htf, tfRank, plen = 3, atrLen = 20) {
  const n = htf.length;
  const tr = htf.map((b, j) => (j === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - htf[j - 1].c), Math.abs(b.l - htf[j - 1].c))));
  const vals = new Array(n);
  const hs = [], ls = [];
  let sum = 0;
  for (let j = 0; j < n; j++) {
    sum += tr[j];
    if (j >= atrLen) sum -= tr[j - atrLen];
    if (j >= 2 * plen) {
      const p = j - plen;
      let isH = true, isL = true;
      for (let k = 1; k <= plen; k++) {
        if (!(htf[p].h > htf[p - k].h && htf[p].h >= htf[p + k].h)) isH = false;
        if (!(htf[p].l < htf[p - k].l && htf[p].l <= htf[p + k].l)) isL = false;
      }
      if (isH) hs.push({ price: htf[p].h, nb: p, bt: htf[p].t });
      if (isL) ls.push({ price: htf[p].l, nb: p, bt: htf[p].t });
    }
    vals[j] = {
      now: j,
      atr: j >= atrLen - 1 ? sum / atrLen : null,
      items: [...hs.slice(-3).map((x) => ({ ...x, typ: TYP.HIGH, tfRank })), ...ls.slice(-3).map((x) => ({ ...x, typ: TYP.LOW, tfRank }))],
    };
  }
  return vals;
}

// (i) → feed for chart bar i. lookahead = true is a deliberate defect for the negative
// control (uses the HTF bar that is still forming).
export function timeFeed(chart, htf, sec, tfRank, { lookahead = false } = {}) {
  const vals = htfFeedValues(htf, tfRank);
  const idx = new Map(htf.map((b, j) => [b.t, j]));
  const none = { now: null, atr: null, items: [] };
  return (i) => {
    const k = idx.get(bucketOf(chart[i].t, sec));
    if (k == null) throw new Error(`no HTF bar for chart bar ${i}`);
    const j = lookahead ? k : k - 1;
    return j < 0 ? none : vals[j];
  };
}

// Negative-control feed: HTF bars built by array position on the load (every `factor`
// chart bars), as the earlier T7 fixture did. Depends on where the load starts.
export function indexFeed(chart, factor, tfRank) {
  const htf = [];
  for (let i = 0; i + factor <= chart.length; i += factor) {
    const seg = chart.slice(i, i + factor);
    htf.push({ t: seg[0].t, o: seg[0].o, h: Math.max(...seg.map((b) => b.h)), l: Math.min(...seg.map((b) => b.l)), c: seg[seg.length - 1].c });
  }
  const vals = htfFeedValues(htf, tfRank);
  return (i) => { const j = Math.floor(i / factor) - 1; return j < 0 || j >= vals.length ? { now: null, atr: null, items: [] } : vals[j]; };
}

const combine = (f1, f2) => (i) => {
  const a = f1(i), b = f2(i);
  return { now: [null, a.now, b.now], atrA1: a.atr, atrA2: b.atr, items: [...a.items, ...b.items] };
};

// The engine inputs of one load, built from the load (and the market's HTF data) alone.
//   first, last : market indices of the load (inclusive)
//   htfBack     : [a1, a2] HTF bars of HTF history before the load's first bucket
//   feed        : 'time' (default) | 'lookahead' | 'index' (negative controls)
export function loadInputs(market, P, { first, last, htfBack = [0, 0], feed = 'time' } = {}) {
  const chart = market.slice(first, last + 1);
  const series = computeSeries(chart, P);
  const toT = chart[chart.length - 1].t;
  let anchorFeed;
  if (feed === 'index') anchorFeed = combine(indexFeed(chart, 5, 1), indexFeed(chart, 15, 2));
  else {
    const from1 = bucketOf(chart[0].t, A1_SEC) - htfBack[0] * A1_SEC * 1000;
    const from2 = bucketOf(chart[0].t, A2_SEC) - htfBack[1] * A2_SEC * 1000;
    const la = feed === 'lookahead';
    anchorFeed = combine(
      timeFeed(chart, htfBarsOf(market, A1_SEC, from1, toT), A1_SEC, 1, { lookahead: la }),
      timeFeed(chart, htfBarsOf(market, A2_SEC, from2, toT), A2_SEC, 2, { lookahead: la }),
    );
  }
  return { chart, series, anchorFeed };
}

// Builds and runs one load (options of loadInputs, plus):
//   extra   : studyExtraBars
//   startAt : market index to start the engine at, overriding the Pine rule (a live
//             continuation whose start was fixed when an earlier, shorter load opened)
//   keep    : 'all' keeps unwarmed snapshots too (warm-up negative control)
// Returns { first, last, start (market index), W, snaps: Map<time, { snap, warmed }>, violations }.
export function runLoad(market, P, opts = {}) {
  const { first, extra = 0, startAt = null, keep = null } = opts;
  const { chart, series, anchorFeed } = loadInputs(market, P, opts);
  const W = engineWindowFor(P, 60, A1_SEC, A2_SEC);
  const lastIdx = chart.length - 1;
  const start = startAt != null ? startAt - first : Math.max(0, lastIdx - (W + extra));
  const eng = new Engine(chart, series, P, { startBar: start, anchorFeed, a1Sec: A1_SEC, a2Sec: A2_SEC });
  const snaps = new Map();
  for (let i = start; i < chart.length; i++) {
    const r = eng.step(i);
    const warmed = i >= start + W;
    if (keep === 'all' || warmed) snaps.set(chart[i].t, { snap: canonicalSnapshot(eng, r, i, { symbol: 'SYN:XAU', timeframe: '1' }), warmed });
  }
  return { first, last: opts.last, start: start + first, W, snaps, violations: eng.violations };
}
