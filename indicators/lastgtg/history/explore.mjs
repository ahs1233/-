// lastgtg 2025–2026 exploration (after HISTORY_RESULTS.md): which conditions go with better green
// lights? Descriptive only, on data already opened; ideas found here are confirmed elsewhere
// (2021-09 → 2024-12, never read by lastgtg) under a new pre-registration.
//   node --max-old-space-size=2500 explore.mjs <feedDir> <outDir>
// Per green light it records: next-timeframe heading (agree / against / flat), first in the move or a
// repeat (same-direction green in the previous 10 bars), session (UTC hour), room to the zone ahead
// (ATR) and its strength; outcomes: A / B as in HISTORY_PREREGISTRATION, the excursion ratio over
// the next 12 bars (mean favourable / mean adverse move, BID M1), and a zone-target trade (target =
// near edge of the zone ahead, stop = 1 ATR, real spread) in R units.
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTimeframe } from '../live/measure.mjs';
import { DEFAULTS, engineWindowFor } from '../live/zone-engine.mjs';
import { lampOf, LAMP_INPUTS } from '../live/lamp.mjs';
import { profileFor, zoneParams } from '../../gtg-strategy-lab/engine/profiles.mjs';
import { lowerBound, scoreBid, scoreSpread } from './score.mjs';
import { readFeed, START, END } from './history.mjs';

const MINTICK = 0.001, SENSOR_WARM = 1100, EXPIRY = 300, EXC_BARS = 12, REPEAT_BARS = 10;
const PINE_TO_TF = { '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', D: 'D', W: 'W' };
const TFS = ['H4', 'H1', 'M15', 'M5', 'M1'];
const NEXT = { M1: 'M5', M5: 'M15', M15: 'H1', H1: 'H4', H4: null };

function session(t) {
  const h = new Date(t).getUTCHours();
  return h >= 22 || h < 6 ? 'asia' : h < 12 ? 'london' : h < 17 ? 'newyork' : 'late';
}
const strength = (q) => (q == null ? 'none' : q >= LAMP_INPUTS.strongQ ? 'strong' : q >= LAMP_INPUTS.mediumQ ? 'medium' : 'weak');
const roomBucket = (r) => (r == null ? 'none' : r < 1 ? '<1' : r < 2 ? '1-2' : r < 4 ? '2-4' : '4+');

// Zone-target trade with the real spread (long buys ASK sells BID; short sells BID buys ASK).
function scoreZone(m1, from, dir, entryBid, entryAsk, target, atr, exp) {
  const entry = dir > 0 ? entryAsk : entryBid;
  if (!Number.isFinite(entry) || target == null) return null;
  const reward = dir * (target - entry);
  if (reward < 0.1 * atr) return { res: 'no_room', R: null };
  const stop = entry - dir * atr;
  for (let j = from; j < m1.t.length; j++) {
    let hitT, hitS;
    if (dir > 0) { hitT = m1.h[j] >= target; hitS = m1.l[j] <= stop; } else { hitT = m1.al[j] <= target; hitS = m1.ah[j] >= stop; }
    if (hitS) return { res: 'loss', R: -1 };
    if (hitT) return { res: 'win', R: reward / atr };
    if (m1.t[j] >= exp) return { res: 'expired', R: null };
  }
  return { res: 'open', R: null };
}

// Mean favourable and adverse excursion (ATR units) over the next n bars, BID.
function excursion(m1, from, untilT, dir, entry, atr) {
  let fav = 0, adv = 0;
  for (let j = from; j < m1.t.length && m1.t[j] < untilT; j++) {
    fav = Math.max(fav, dir > 0 ? m1.h[j] - entry : entry - m1.l[j]);
    adv = Math.max(adv, dir > 0 ? entry - m1.l[j] : m1.h[j] - entry);
  }
  return [fav / atr, adv / atr];
}

function runTf(tf, feeds, m1, states, log) {
  const prof = profileFor(tf);
  const W = engineWindowFor(zoneParams(DEFAULTS, prof, MINTICK), prof.chartSec, prof.a1Sec, prof.a2Sec);
  const all = feeds[tf];
  const ts = Float64Array.from(all, (b) => b.t);
  const chart = all.slice(Math.max(0, lowerBound(ts, START) - (W + SENSOR_WARM + 300)));
  const st = { t: [], heading: [], lamp: [], dir: [] };
  const sig = [], base = [];
  let prev = null;
  const lastGreen = { 1: -1e9, '-1': -1e9 };
  const t0 = Date.now();
  runTimeframe({ tf, bars: chart, htfBars: feeds[prof.htfTf], a1Bars: feeds[PINE_TO_TF[prof.a1Tf]], a2Bars: feeds[PINE_TO_TF[prof.a2Tf]],
    mintick: MINTICK, startBar: 0, keepRows: false, onRow: (r) => {
      if (!r.warmed) { prev = null; return; }
      const lp = lampOf(r, { mintick: MINTICK });
      st.t.push(r.t); st.heading.push(r.headingSign); st.lamp.push(lp.lamp); st.dir.push(lp.greenDir);
      const inP = r.t >= START && r.t < END;
      if (inP && prev && lp.lamp === 2 && lp.greenDir !== 0 && !(prev.lamp === 2 && prev.dir === lp.greenDir)) {
        const d = lp.greenDir, ahead = d > 0 ? lp.zones.R1 : lp.zones.S1;
        const aheadEdge = ahead && ahead.active ? (d > 0 ? ahead.lo : ahead.hi) : null;
        const room = aheadEdge == null ? null : Math.max(0, d * (aheadEdge - r.c)) / r.atrEng;
        sig.push({ t: r.t, c: r.c, atr: r.atrEng, kind: lp.kind, dir: d, repeat: r.i - lastGreen[d] <= REPEAT_BARS,
          aheadEdge, room, aheadQ: ahead && ahead.active ? ahead.displayQ : null, fuel: r.fuelScore, speed: r.speedScore });
      }
      if (lp.lamp === 2 && lp.greenDir !== 0) lastGreen[lp.greenDir] = r.i;
      if (inP && r.headingSign !== 0 && (tf !== 'M1' || r.i % 10 === 0)) base.push({ t: r.t, c: r.c, atr: r.atrEng, dir: r.headingSign });
      prev = { lamp: lp.lamp, dir: lp.greenDir };
    } });
  states[tf] = { t: Float64Array.from(st.t), heading: Int8Array.from(st.heading), lamp: Int8Array.from(st.lamp), dir: Int8Array.from(st.dir), sec: prof.chartSec };
  log(`${tf} engine ${Math.round((Date.now() - t0) / 1000)} s: signals=${sig.length} baseline=${base.length}`);
  return { sig, base, ms: prof.chartSec * 1000 };
}

function outcomes(x, ms, m1) {
  const closeT = x.t + ms, from = lowerBound(m1.t, closeT), exp = x.t + (EXPIRY + 1) * ms;
  const a = scoreBid(m1, from, x.dir, x.c + x.dir * x.atr, x.c - x.dir * x.atr, exp);
  const k = from - 1;
  const entryAsk = k >= 0 && m1.t[k] >= x.t ? m1.ac[k] : NaN;
  const b = scoreSpread(m1, from, x.dir, x.c, entryAsk, x.atr, exp);
  const [fav, adv] = excursion(m1, from, closeT + EXC_BARS * ms, x.dir, x.c, x.atr);
  const z = x.aheadEdge !== undefined ? scoreZone(m1, from, x.dir, x.c, entryAsk, x.aheadEdge, x.atr, exp) : null;
  return { resA: a.res, resB: b.res, fav, adv, zres: z ? z.res : null, zR: z ? z.R : null };
}

function stats(recs) {
  const n = recs.length;
  if (!n) return { n: 0 };
  const sc = (key) => { let w = 0, m = 0; for (const r of recs) { if (r[key] === 'open_at_end' || r[key] === 'no_ask') continue; m++; if (r[key] === 'win') w++; } return m ? w / m : null; };
  let fav = 0, adv = 0;
  for (const r of recs) { fav += r.fav; adv += r.adv; }
  const zr = recs.filter((r) => r.zR != null);
  const zSum = zr.reduce((s, r) => s + r.zR, 0);
  return { n, winA: sc('resA'), winB: sc('resB'), eRatio: adv ? fav / adv : null, zoneTrades: zr.length, zoneMeanR: zr.length ? zSum / zr.length : null,
    zoneWin: zr.length ? zr.filter((r) => r.zR > 0).length / zr.length : null, zoneNoRoom: recs.filter((r) => r.zres === 'no_room').length };
}

if (process.argv[1] && process.argv[1].endsWith('explore.mjs')) {
  const [, , feedDir, outDir] = process.argv;
  mkdirSync(outDir, { recursive: true });
  const log = (m) => { const s = `${new Date().toISOString()} ${m}`; console.log(s); appendFileSync(join(outDir, 'explore.log'), s + '\n'); };
  const feeds = {};
  let m1 = null;
  for (const tf of ['M1', 'M5', 'M15', 'H1', 'H4', 'D', 'W']) {
    const { bars, ask } = readFeed(join(feedDir, `XAUUSD_${tf}.csv`));
    feeds[tf] = bars;
    if (tf === 'M1') m1 = { t: Float64Array.from(bars, (b) => b.t), h: Float64Array.from(bars, (b) => b.h), l: Float64Array.from(bars, (b) => b.l), ah: Float64Array.from(ask.ah), al: Float64Array.from(ask.al), ac: Float64Array.from(ask.ac) };
  }
  log('feeds read');
  const states = {}, runs = {};
  for (const tf of TFS) runs[tf] = runTf(tf, feeds, m1, states, log);
  const out = { period: [new Date(START).toISOString(), new Date(END).toISOString()], tfs: {} };
  for (const tf of TFS) {
    const { sig, base, ms } = runs[tf];
    const nx = NEXT[tf] ? states[NEXT[tf]] : null;
    const recs = sig.map((s) => {
      let htf = 'n/a';
      if (nx) {
        const k = lowerBound(nx.t, s.t + ms - nx.sec * 1000 + 1) - 1; // last next-TF bar closed by the signal close
        htf = k < 0 ? 'n/a' : nx.heading[k] === 0 ? 'flat' : nx.heading[k] === s.dir ? 'agree' : 'against';
      }
      return { ...s, htf, session: session(s.t), roomB: roomBucket(s.room), aheadS: strength(s.aheadQ), ...outcomes(s, ms, m1) };
    });
    const baseRecs = base.map((s) => ({ ...s, ...outcomes(s, ms, m1) }));
    const T = { baseline: stats(baseRecs) };
    for (const kind of ['break', 'aligned', 'all']) {
      const R = kind === 'all' ? recs : recs.filter((r) => r.kind === kind);
      const g = { all: stats(R) };
      for (const [name, key, vals] of [['htf', 'htf', ['agree', 'against', 'flat']], ['move', 'repeat', [false, true]], ['session', 'session', ['asia', 'london', 'newyork', 'late']],
        ['room', 'roomB', ['<1', '1-2', '2-4', '4+', 'none']], ['ahead', 'aheadS', ['strong', 'medium', 'weak', 'none']]]) {
        g[name] = Object.fromEntries(vals.map((v) => [String(v), stats(R.filter((r) => r[key] === v))]));
      }
      T[kind] = g;
    }
    out.tfs[tf] = T;
    log(`${tf} scored`);
    writeFileSync(join(outDir, 'explore.json'), JSON.stringify(out, null, 1));
  }
  log('done');
}
