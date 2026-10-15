// Part 2 of ../../TEST_PREREGISTRATION.md v1.1: do zone scores separate better zones from worse
// ones (independent of the lamp)? Bars only (no M1).
//   node --max-old-space-size=6000 part2.mjs <feedDir> <outDir> [M15,H1,H4]
// outDir must hold prelog.json (Part 2 block lengths, logged before any result).
// Populations: engine A/B and engine C. Identity: slot entry keys (zones sharing an entry key are
// one zone). Snapshot: bounds, strength and atrEng on the last closed bar before the touch bar.
// Touch: first closed bar whose range overlaps the snapshot while the previous close was outside.
// Outcome on the touch bar and the next 47 closes: reaction (a close >= 1 atrEng beyond the near
// edge, on the side price came from) before break (a close beyond the far edge + breakBufK·atrEng);
// else neither. Control: P1 naive pivots of the same pivotLen, width w·atrEng (w = median displayed
// width / atrEng over the warm-up bars), available from the close of the confirmation bar, living
// maxAge[local] bars.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTimeframe as runA } from '../../../live/measure.mjs';
import { runTimeframe as runC } from '../measure-c.mjs';
import * as EA from '../../../live/zone-engine.mjs';
import * as EC from '../zone-engine-c.mjs';
import { profileFor, zoneParams } from '../../../../gtg-strategy-lab/engine/profiles.mjs';
import { lowerBound } from './trade.mjs';
import { SEED, tradingDay, blockResamples, interval, quantile } from './stats.mjs';
import { START, END } from './part1.mjs';

const MINTICK = 0.001, WINDOW = 48, N_RES = 10_000, MEDIUM_Q = 48, STRONG_Q = 72, MIN_TOUCHES = 50;
const WARM_FROM = Date.UTC(2019, 5, 1);
const PINE_TO_TF = { '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', D: 'D', W: 'W' };
const GROUPS = ['weak', 'medium', 'important', 'control'];
export const groupOf = (q) => (q >= STRONG_Q ? 'important' : q >= MEDIUM_Q ? 'medium' : 'weak');

function readBars(dir, tf) {
  const lines = readFileSync(join(dir, `XAUUSD_${tf}.csv`), 'utf8').split('\n');
  const out = [];
  for (let k = 1; k < lines.length; k++) { const s = lines[k]; if (!s) continue; const f = s.split(','); out.push({ t: +f[0], o: +f[1], h: +f[2], l: +f[3], c: +f[4], v: +f[5] }); }
  return out;
}

class UnionFind {
  constructor() { this.p = new Map(); this.touched = new Map(); }
  find(x) { if (!this.p.has(x)) this.p.set(x, x); let r = x; while (this.p.get(r) !== r) r = this.p.get(r); while (this.p.get(x) !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; } return r; }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra === rb) return ra; this.p.set(rb, ra); if (this.touched.get(rb)) this.touched.set(ra, true); return ra; }
}

// Outcome of a frozen zone touched at bar i (closes c[i .. i+WINDOW-1]).
export function outcomeOf(c, i, z, breakBufK) {
  const fromAbove = z.side > 0;
  for (let j = i; j < Math.min(c.length, i + WINDOW); j++) {
    if (fromAbove) {
      if (c[j] < z.lo - breakBufK * z.atr) return 'break';
      if (c[j] >= z.hi + z.atr) return 'reaction';
    } else {
      if (c[j] > z.hi + breakBufK * z.atr) return 'break';
      if (c[j] <= z.lo - z.atr) return 'reaction';
    }
  }
  return i + WINDOW <= c.length ? 'neither' : 'unresolved_end';
}

export function part2Tf(tf, feedDir, block, log) {
  const prof = profileFor(tf);
  const all = readBars(feedDir, tf);
  const allC = all.map((b) => b.c), allT = all.map((b) => b.t);
  const chart = all.slice(0, lowerBound(allT, END));
  const htf = { htfBars: readBars(feedDir, prof.htfTf), a1Bars: readBars(feedDir, PINE_TO_TF[prof.a1Tf]), a2Bars: readBars(feedDir, PINE_TO_TF[prof.a2Tf]) };
  const out = {};
  for (const [pop, run, E] of [['AB', runA, EA], ['C', runC, EC]]) {
    const P = zoneParams(E.DEFAULTS, prof, MINTICK);
    const series = E.computeSeries(chart, P);
    const uf = new UnionFind();
    const touches = [];
    let prevSlots = null, prevAtr = NaN;
    const widths = [];
    run({ tf, mintick: MINTICK, bars: chart, ...htf, startBar: 0, keepRows: false, onRow: (r) => {
      const i = r.i, bar = chart[i];
      if (bar.t >= WARM_FROM && bar.t < START) for (const s of r.slots) if (s.active) widths.push((s.hi - s.lo) / r.atrEng);
      // Touch check of bar i against the zones held at bar i-1 (snapshot).
      // A zone's first touch is its only one: touches before the period use it up too.
      if (prevSlots && bar.t < END) {
        const pc = chart[i - 1].c;
        for (const s of prevSlots) {
          const root = uf.find(s.entryKeys[0]);
          if (uf.touched.get(root)) continue;
          if (!(bar.h >= s.lo && bar.l <= s.hi) || (pc >= s.lo && pc <= s.hi)) continue;
          uf.touched.set(root, true);
          if (!(r.warmed && bar.t >= START)) continue;
          const z = { lo: s.lo, hi: s.hi, q: s.displayQ, atr: prevAtr, side: pc > s.hi ? 1 : -1 };
          touches.push({ i, t: bar.t, group: groupOf(z.q), q: z.q, outcome: outcomeOf(allC, i, z, P.breakBufK) });
        }
      }
      const act = r.slots.filter((s) => s.active && s.entryKeys.length);
      for (const s of act) for (let k = 1; k < s.entryKeys.length; k++) uf.union(s.entryKeys[0], s.entryKeys[k]);
      prevSlots = act; prevAtr = r.atrEng;
    } });
    // Control: P1 pivots.
    widths.sort((a, b) => a - b);
    const w = quantile(widths, 0.5), life = P.maxAge[0];
    const pivots = [];
    for (let i = 0; i < chart.length; i++) {
      if (series.swingPH[i] != null) pivots.push({ from: i, hi: series.swingPH[i], lo: series.swingPH[i] - w * series.atrEng[i], touched: false });
      if (series.swingPL[i] != null) pivots.push({ from: i, lo: series.swingPL[i], hi: series.swingPL[i] + w * series.atrEng[i], touched: false });
    }
    // warmed flag of the population's engine for the control's period rows: same window rule.
    const W = EA.engineWindowFor(zoneParams(EA.DEFAULTS, prof, MINTICK), prof.chartSec, prof.a1Sec, prof.a2Sec);
    for (const z of pivots) {
      for (let i = z.from + 1; i < chart.length && i <= z.from + life; i++) {
        const bar = chart[i], pc = chart[i - 1].c;
        if (!(bar.h >= z.lo && bar.l <= z.hi) || (pc >= z.lo && pc <= z.hi)) continue;
        if (i >= W && bar.t >= START && bar.t < END) {
          const zz = { lo: z.lo, hi: z.hi, atr: series.atrEng[i - 1], side: pc > z.hi ? 1 : -1 };
          touches.push({ i, t: bar.t, group: 'control', q: NaN, outcome: outcomeOf(allC, i, zz, P.breakBufK) });
        }
        break; // first touch only
      }
    }
    out[pop] = { w, touches };
  }
  // Statistics per population.
  const res = {};
  const periodDays = [...new Set(chart.filter((b) => b.t >= START).map((b) => tradingDay(b.t)))].sort((a, b) => a - b);
  const pos = new Map(periodDays.map((d, j) => [d, j]));
  for (const [pop, { w, touches }] of Object.entries(out)) {
    const g = {};
    const tally = (list) => { const n = { reaction: 0, break: 0, neither: 0, unresolved_end: 0 }; for (const x of list) n[x.outcome]++; return { ...n, touches: list.length, reactionShare: n.reaction / (n.reaction + n.break), neitherShare: n.neither / (list.length - n.unresolved_end) }; };
    for (const k of GROUPS) {
      const list = touches.filter((x) => x.group === k);
      g[k] = { ...tally(list), byYear: Object.fromEntries(['2022', '2023', '2024'].map((y) => [y, tally(list.filter((x) => String(new Date(x.t).getUTCFullYear()) === y))])) };
    }
    const tot = Object.fromEntries(GROUPS.map((k) => {
      const r = new Float64Array(periodDays.length), b = new Float64Array(periodDays.length);
      for (const x of touches) if (x.group === k) { const d = pos.get(tradingDay(x.t)); if (x.outcome === 'reaction') r[d]++; else if (x.outcome === 'break') b[d]++; }
      return [k, { r, b }];
    }));
    const share = (k, smp) => { let r = 0, b = 0; for (const d of smp) { r += tot[k].r[d]; b += tot[k].b[d]; } return r / (r + b); };
    const boot = {};
    for (const [label, L] of [['L', block], ['L2', 2 * block]]) {
      const iw = [], ic = [];
      for (const smp of blockResamples(periodDays.length, L, N_RES, SEED)) { const imp = share('important', smp); iw.push(imp - share('weak', smp)); ic.push(imp - share('control', smp)); }
      boot[label] = { L, importantMinusWeak95: interval(iw, 0.95), importantMinusControl95: interval(ic, 0.95) };
    }
    const enough = GROUPS.every((k) => g[k].touches >= MIN_TOUCHES);
    const yearsSame = ['2022', '2023', '2024'].every((y) => g.important.byYear[y].reactionShare - g.weak.byYear[y].reactionShare > 0 && g.important.byYear[y].reactionShare - g.control.byYear[y].reactionShare > 0);
    const separates = enough && boot.L.importantMinusWeak95[0] > 0 && boot.L.importantMinusControl95[0] > 0 && yearsSame;
    res[pop] = { controlWidthAtr: w, groups: g, bootstrap: boot, enough, yearsSameSign: yearsSame, separates: enough ? separates : 'inconclusive' };
    log(`${tf} ${pop}: ` + GROUPS.map((k) => `${k} ${g[k].touches} r${g[k].reactionShare.toFixed(3)}`).join(' | ') + ` → ${res[pop].separates}`);
  }
  return res;
}

if (process.argv[1] && process.argv[1].endsWith('part2.mjs')) {
  const [, , feedDir, outDir, tfArg = 'M15,H1,H4'] = process.argv;
  mkdirSync(outDir, { recursive: true });
  const log = (m) => { const s = `${new Date().toISOString()} ${m}`; console.log(s); appendFileSync(join(outDir, 'part2.log'), s + '\n'); };
  const pre = JSON.parse(readFileSync(join(outDir, 'prelog.json'), 'utf8'));
  const all = {};
  for (const tf of tfArg.split(',')) { all[tf] = part2Tf(tf, feedDir, pre[tf].part2Block, log); writeFileSync(join(outDir, 'part2.json'), JSON.stringify(all, null, 1)); }
  for (const pop of ['AB', 'C']) {
    const ok = Object.values(all).filter((r) => r[pop].separates === true).length;
    log(`${pop}: scores separate zones on ${ok} of ${Object.keys(all).length} timeframes → ${ok >= 2 ? 'scores separate zones' : 'not shown'}`);
  }
}
