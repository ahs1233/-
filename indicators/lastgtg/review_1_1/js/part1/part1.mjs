// Part 1 of ../../TEST_PREREGISTRATION.md v1.1 (green light, A / B / C), in two separate stages:
//   node --max-old-space-size=6000 part1.mjs signals <feedDir> <outDir> [M15,H1,H4,M5]
//     engines and lamps only: per timeframe the signal-period rows (no price after any bar is
//     read), L_tf, the Part 2 block length and the volatility tercile cuts -> prelog.json.
//     Committed BEFORE the score stage runs.
//   node --max-old-space-size=6000 part1.mjs score <feedDir> <outDir> [M15,H1,H4,M5]
//     trades on the M1 BID / ASK feed, baselines, block bootstrap, verdicts -> part1_<tf>.json.
// feedDir: export_history.py output (M1 with the ASK open, last column).
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runTimeframe as runA } from '../../../live/measure.mjs';
import { runTimeframe as runC } from '../measure-c.mjs';
import { DEFAULTS, engineWindowFor } from '../../../live/zone-engine.mjs';
import { lampOf } from '../../../live/lamp.mjs';
import { lampOfBC, EpisodeTracker } from '../lamp-bc.mjs';
import { profileFor, zoneParams } from '../../../../gtg-strategy-lab/engine/profiles.mjs';
import { simulateTrade, lowerBound, OUTCOME_GROUP } from './trade.mjs';
import { SEED, rng, tradingDay, blockLength, trailingMedian, quantile, tercileOf, sessionOf, matchedDraws, blockResamples, dayTotals, resampledMean, interval, mean } from './stats.mjs';

export const START = Date.UTC(2021, 9, 1), END = Date.UTC(2025, 0, 1);
const MINTICK = 0.001, EXPIRY_BARS = 300, N_DRAWS = 200, N_RES = 10_000, PART2_SPAN = 49;
const TF_MS = { M5: 300_000, M15: 900_000, H1: 3_600_000, H4: 14_400_000 };
const PINE_TO_TF = { '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', D: 'D', W: 'W' };
const VERSIONS = ['A', 'B', 'C'];
const COLS = ['i', 't', 'atrEng', 'heading', 'volRatio', 'lampA', 'startA', 'lampB', 'reasonB', 'startB', 'lampC', 'reasonC', 'startC'];

function readCsv(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const head = lines[0].trim().split(',');
  const cols = Object.fromEntries(head.map((h) => [h, []]));
  for (let k = 1; k < lines.length; k++) {
    const s = lines[k]; if (!s) continue;
    const f = s.split(',');
    for (let j = 0; j < head.length; j++) cols[head[j]].push(f[j] === '' || f[j] === undefined ? NaN : Number(f[j]));
  }
  return cols;
}
const feedBars = (dir, tf) => { const c = readCsv(join(dir, `XAUUSD_${tf}.csv`)); return c.t.map((t, i) => ({ t, o: c.o[i], h: c.h[i], l: c.l[i], c: c.c[i], v: c.v[i] })); };

// ---------------------------------------------------------------- stage 1: signals (no outcome)
export function signalsTf(tf, feedDir, log) {
  const prof = profileFor(tf);
  const W = engineWindowFor(zoneParams(DEFAULTS, prof, MINTICK), prof.chartSec, prof.a1Sec, prof.a2Sec);
  const all = feedBars(feedDir, tf);
  const chart = all.slice(0, lowerBound(all.map((b) => b.t), END));
  const htf = { htfBars: feedBars(feedDir, prof.htfTf), a1Bars: feedBars(feedDir, PINE_TO_TF[prof.a1Tf]), a2Bars: feedBars(feedDir, PINE_TO_TF[prof.a2Tf]) };
  const n = chart.length;
  const atrEng = new Float64Array(n).fill(NaN), heading = new Int8Array(n), warmed = new Uint8Array(n);
  const st = Object.fromEntries(VERSIONS.map((v) => [v, { lamp: new Int8Array(n), reason: new Int16Array(n), start: new Uint8Array(n) }]));
  const t0 = Date.now();
  for (const [engine, run, versions] of [['A', runA, ['A', 'B']], ['C', runC, ['C']]]) {
    const tr = Object.fromEntries(versions.map((v) => [v, new EpisodeTracker()]));
    run({ tf, mintick: MINTICK, bars: chart, ...htf, startBar: 0, keepRows: false, onRow: (r) => {
      if (engine === 'A') { atrEng[r.i] = r.atrEng; heading[r.i] = r.headingSign; warmed[r.i] = r.warmed ? 1 : 0; }
      for (const v of versions) {
        let lamp, reason;
        if (!r.engineOn) { lamp = 1; reason = 10; }
        else if (v === 'A') { const x = lampOf(r, { mintick: MINTICK }); lamp = x.lamp; reason = 0; }
        else { const x = lampOfBC(r, { mintick: MINTICK }); lamp = x.lamp; reason = x.reason; }
        const ep = tr[v].push(r.engineOn, lamp, r.headingSign);
        st[v].lamp[r.i] = lamp; st[v].reason[r.i] = reason; st[v].start[r.i] = ep.start ? 1 : 0;
      }
    } });
  }
  // Volatility ratio: atrEng / median atrEng of the previous 500 bars; tercile cuts from the
  // warm-up bars (opening before START) that have a ratio.
  const med = trailingMedian(atrEng, 500);
  const volRatio = Float64Array.from(atrEng, (a, i) => a / med[i]);
  const warm = [...volRatio.filter((x, i) => chart[i].t < START && Number.isFinite(x))].sort((a, b) => a - b);
  const cuts = [quantile(warm, 1 / 3), quantile(warm, 2 / 3)];
  const rows = [];
  for (let i = 0; i < n; i++) {
    if (!warmed[i] || chart[i].t < START || chart[i].t >= END) continue;
    rows.push([i, chart[i].t, atrEng[i], heading[i], volRatio[i], st.A.lamp[i], st.A.start[i], st.B.lamp[i], st.B.reason[i], st.B.start[i], st.C.lamp[i], st.C.reason[i], st.C.start[i]]);
  }
  const allT = all.map((b) => b.t);
  const L = blockLength(allT, START, END, EXPIRY_BARS + 1), L2 = blockLength(allT, START, END, PART2_SPAN);
  const firstWarm = chart.find((b, i) => warmed[i]);
  const summary = {
    tf, W, chartBars: n, feedFrom: new Date(all[0].t).toISOString(), firstWarmedBar: firstWarm ? new Date(firstWarm.t).toISOString() : null,
    periodRows: rows.length, firstPeriodRow: rows.length ? new Date(rows[0][1]).toISOString() : null,
    starts: Object.fromEntries(VERSIONS.map((v) => [v, rows.filter((r) => r[COLS.indexOf('start' + v)]).length])),
    headingBars: rows.filter((r) => r[3] !== 0).length,
    L_tf: L.L, L_tf_firstBar: L.firstBarOfLongest, L_tf_sensitivity: 2 * L.L, part2Block: L2.L, part2BlockSensitivity: 2 * L2.L,
    volTercileCuts: cuts, warmupRatios: warm.length, seconds: Math.round((Date.now() - t0) / 1000),
  };
  log(`${tf} signals: ${JSON.stringify(summary)}`);
  return { summary, rows };
}

// ---------------------------------------------------------------- stage 2: score
export function readM1(feedDir) {
  const c = readCsv(join(feedDir, 'XAUUSD_M1.csv'));
  if (!c.ao) throw new Error('M1 feed has no ASK open column (export_history.py with ao)');
  const F = (a) => Float64Array.from(a);
  return { t: F(c.t), bo: F(c.o), bh: F(c.h), bl: F(c.l), bc: F(c.c), ao: F(c.ao), ah: F(c.ah), al: F(c.al), ac: F(c.ac) };
}
const yearOf = (t) => new Date(t).getUTCFullYear();
const periodKey = (t) => (t < Date.UTC(2022, 0, 1) ? '2021Q4' : String(yearOf(t)));

export function scoreTf(tf, feedDir, sigDir, m1, log) {
  const tfMs = TF_MS[tf];
  const feedT = readCsv(join(feedDir, `XAUUSD_${tf}.csv`)).t;
  const s = readCsv(join(sigDir, `signals_${tf}.csv`));
  const pre = JSON.parse(readFileSync(join(sigDir, 'prelog.json'), 'utf8'))[tf];
  const n = s.t.length;
  // One trade per period row (direction = heading): a version's start is the trade of its bar.
  const trades = new Array(n);
  for (let k = 0; k < n; k++) {
    const i = s.i[k];
    const expiryClose = i + EXPIRY_BARS < feedT.length ? feedT[i + EXPIRY_BARS] + tfMs : Infinity;
    const close = s.t[k] + tfMs;
    trades[k] = { k, t: s.t[k], close, d: s.atrEng[k], dir: s.heading[k], ...simulateTrade(m1, { close, tfMs, dir: s.heading[k], d: s.atrEng[k], expiryClose }) };
    const x = trades[k];
    x.period = periodKey(x.t); x.session = sessionOf(close); x.tercile = tercileOf(s.volRatio[k], pre.volTercileCuts);
    x.stratum = `${x.dir}|${yearOf(x.t)}|${x.session}|${x.tercile}`;
    if (x.status === 'done') x.day = tradingDay(x.entryT);
  }
  const done = trades.filter((x) => x.status === 'done');
  const spreads = done.map((x) => x.spread).filter(Number.isFinite).sort((a, b) => a - b);
  const sTf = quantile(spreads, 0.5);
  for (const x of done) x.Rs = x.R - sTf / x.d;
  // Day universe: trading days of the period's bars and of every entry, in order.
  const daySet = new Set(s.t.map(tradingDay));
  for (const x of done) daySet.add(x.day);
  const days = [...daySet].sort((a, b) => a - b), pos = new Map(days.map((d, j) => [d, j]));
  const item = (x, key = 'R') => ({ day: pos.get(x.day), R: x[key] });

  const series = { base: trades.filter((x) => x.dir !== 0) };
  for (const v of VERSIONS) series[v] = trades.filter((x) => s['start' + v][x.k] === 1);
  const describe = (list) => {
    const ok = list.filter((x) => x.status === 'done');
    const ne = {}; for (const x of list) if (x.status === 'not_executable') ne[x.cause] = (ne[x.cause] ?? 0) + 1;
    const out = { starts: list.length, notExecutable: ne, unresolvedEnd: list.filter((x) => x.status === 'unresolved_end').length, executable: ok.length,
      outcomes: { target: 0, stop: 0, both: 0, expired: 0 }, winShare: ok.length ? ok.filter((x) => x.R > 0).length / ok.length : NaN,
      meanR: mean(ok.map((x) => x.R)), meanRstress: mean(ok.map((x) => x.Rs)), byPeriod: {}, skippedMinutes: ok.reduce((a, x) => a + x.skipped, 0) };
    for (const x of ok) out.outcomes[OUTCOME_GROUP[x.outcome]]++;
    for (const p of ['2021Q4', '2022', '2023', '2024']) { const r = ok.filter((x) => x.period === p); out.byPeriod[p] = { n: r.length, meanR: mean(r.map((x) => x.R)) }; }
    return out;
  };
  const rep = Object.fromEntries(Object.entries(series).map(([k, l]) => [k, describe(l)]));

  // Matched baseline: 200 draws per version within direction × year × session × tercile.
  const pool = new Map();
  for (const x of series.base) if (x.status === 'done') { if (!pool.has(x.stratum)) pool.set(x.stratum, []); pool.get(x.stratum).push(x.k); }
  const matched = {};
  for (const v of VERSIONS) {
    const strata = series[v].filter((x) => x.status === 'done').map((x) => x.stratum);
    const draws = matchedDraws(strata, pool, N_DRAWS, SEED);
    const totals = draws.map((d) => dayTotals(d.map((k) => item(trades[k])), days.length));
    matched[v] = { draws, totals, meanR: mean(draws.map((d) => mean(d.map((k) => trades[k].R)))) };
    rep[v].matchedMeanR = matched[v].meanR;
  }
  rep.base.sTf = sTf;

  // Block bootstrap, L_tf and 2·L_tf; the same resampled days for every series.
  const tot = Object.fromEntries(Object.entries(series).map(([k, l]) => [k, dayTotals(l.filter((x) => x.status === 'done').map((x) => item(x)), days.length)]));
  const boot = {};
  for (const [label, L] of [['L', pre.L_tf], ['L2', 2 * pre.L_tf]]) {
    const res = blockResamples(days.length, L, N_RES, SEED);
    const pick = rng(SEED + 1);
    const m = { base: [], A: [], B: [], C: [], mA: [], mB: [], mC: [] };
    for (const smp of res) {
      for (const k of ['base', ...VERSIONS]) m[k].push(resampledMean(tot[k], smp));
      for (const v of VERSIONS) m['m' + v].push(resampledMean(matched[v].totals[Math.floor(pick() * N_DRAWS)], smp));
    }
    const diff = (a, b) => a.map((x, j) => x - b[j]);
    boot[label] = { L, nDays: days.length,
      meanR995: Object.fromEntries(VERSIONS.map((v) => [v, interval(m[v], 0.995)])),
      minusMatched95: Object.fromEntries(VERSIONS.map((v) => [v, interval(diff(m[v], m['m' + v]), 0.95)])),
      BminusA95: interval(diff(m.B, m.A), 0.95), CminusB95: interval(diff(m.C, m.B), 0.95),
      base95: interval(m.base, 0.95) };
  }
  // Verdicts (M15, H1, H4 decide; M5 diagnostic).
  const word = (iv) => (iv[0] > 0 ? 'better' : iv[1] < 0 ? 'worse' : 'no difference shown');
  const verdicts = { BvsA: { diff: rep.B.meanR - rep.A.meanR, ci95: boot.L.BminusA95, word: word(boot.L.BminusA95) },
    CvsB: { diff: rep.C.meanR - rep.B.meanR, ci95: boot.L.CminusB95, word: word(boot.L.CminusB95) }, candidate: {} };
  for (const v of VERSIONS) {
    const r = rep[v];
    const c = {
      c1_atLeast100: r.executable >= 100,
      c2_meanR995LowerAbove0: boot.L.meanR995[v][0] > 0,
      c3_minusMatched95LowerAbove0: boot.L.minusMatched95[v][0] > 0,
      c4_eachYearAbove0: ['2022', '2023', '2024'].every((p) => r.byPeriod[p].n > 0 && r.byPeriod[p].meanR > 0),
      c5_stressAbove0: r.meanRstress > 0,
      c6_holdsWith2L: boot.L2.meanR995[v][0] > 0 && boot.L2.minusMatched95[v][0] > 0,
    };
    verdicts.candidate[v] = { ...c, candidate: Object.values(c).every(Boolean) };
  }
  // A starts that B / C drop, by B / C reason code at that bar.
  const drops = {};
  for (const v of ['B', 'C']) {
    const by = {};
    for (const x of series.A) if (s['start' + v][x.k] !== 1) { const code = s['reason' + v][x.k]; by[code] = (by[code] ?? 0) + 1; }
    drops[v] = { dropped: Object.values(by).reduce((a, b) => a + b, 0), ofAStarts: series.A.length, byReason: by };
  }
  const out = { tf, decides: tf !== 'M5', sTf, L_tf: pre.L_tf, report: rep, bootstrap: boot, verdicts, drops };
  log(`${tf} score: A ${rep.A.executable} meanR ${rep.A.meanR.toFixed(4)} | B ${rep.B.executable} ${rep.B.meanR.toFixed(4)} | C ${rep.C.executable} ${rep.C.meanR.toFixed(4)} | base ${rep.base.executable} ${rep.base.meanR.toFixed(4)}`);
  return { out, trades };
}

if (process.argv[1] && process.argv[1].endsWith('part1.mjs')) {
  const [, , stage, feedDir, outDir, tfArg = 'M15,H1,H4,M5'] = process.argv;
  mkdirSync(outDir, { recursive: true });
  const log = (m) => { const s = `${new Date().toISOString()} ${m}`; console.log(s); appendFileSync(join(outDir, `${stage}.log`), s + '\n'); };
  const tfs = tfArg.split(',');
  if (stage === 'signals') {
    const prelog = existsSync(join(outDir, 'prelog.json')) ? JSON.parse(readFileSync(join(outDir, 'prelog.json'), 'utf8')) : {};
    for (const tf of tfs) {
      const { summary, rows } = signalsTf(tf, feedDir, log);
      writeFileSync(join(outDir, `signals_${tf}.csv`), [COLS.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n');
      prelog[tf] = summary;
      writeFileSync(join(outDir, 'prelog.json'), JSON.stringify(prelog, null, 1));
    }
  } else if (stage === 'score') {
    const m1 = readM1(feedDir);
    log(`M1: ${m1.t.length} bars ${new Date(m1.t[0]).toISOString()} → ${new Date(m1.t[m1.t.length - 1]).toISOString()}, ASK open missing ${m1.ao.filter((x) => !Number.isFinite(x)).length}`);
    for (const tf of tfs) {
      const { out, trades } = scoreTf(tf, feedDir, outDir, m1, log);
      writeFileSync(join(outDir, `part1_${tf}.json`), JSON.stringify(out, null, 1));
      writeFileSync(join(outDir, `trades_${tf}.csv`), ['k,t,dir,d,status,cause,outcome,entry,exit,R,spread,entryT,exitT,stratum', ...trades.map((x) => [x.k, x.t, x.dir, x.d, x.status, x.cause ?? '', x.outcome ?? '', x.entry ?? '', x.exit ?? '', x.R ?? '', x.spread ?? '', x.entryT ?? '', x.exitT ?? '', x.stratum].join(','))].join('\n') + '\n');
    }
  } else throw new Error('stage: signals | score');
}
