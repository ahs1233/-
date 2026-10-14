// lastgtg live runner. Reads the JForex feed (gtglast.java), computes the lastgtg panel of
// M1, M5, M15, H1, H4 on every newly closed bar, and writes:
//   state/state.json    the five panels (machine-readable)
//   state/draw.txt      the same, one line per timeframe, for gtglast.java to draw
//   state/panel.txt     the five panels in plain Arabic (for reading)
//   log/panels.csv      one row per timeframe per closed bar
//   log/greens.csv      the green-light ledger (LIVE_PREREGISTRATION.md)
//   state/runner_status.txt  heartbeat
// Read-only on the feed. Usage: node runner.mjs <baseDir>   (default C:/Users/alk/gtg-live)
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { runTimeframe } from './measure.mjs';
import { DEFAULTS, engineWindowFor } from './zone-engine.mjs';
import { profileFor, zoneParams } from '../../gtg-strategy-lab/engine/profiles.mjs';
import { lampOf, dxyText } from './lamp.mjs';
import { withForming } from './forming.mjs';

const BASE = process.argv[2] || 'C:/Users/alk/gtg-live';
const FEED = join(BASE, 'feed'), STATE = join(BASE, 'state'), LOG = join(BASE, 'log');
for (const d of [STATE, LOG]) mkdirSync(d, { recursive: true });
const MINTICK = 0.001;
const TFS = ['M1', 'M5', 'M15', 'H1', 'H4'];
const PINE_TO_TF = { '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', D: 'D', W: 'W' };
const SENSOR_WARM = 1100; // bars before the engine window (ma1000 / rank 1000)
const GREEN_EXPIRY_BARS = 300; // chart bars of the signal's timeframe
const ONCE = process.argv.includes('--once');

function readFeed(name) {
  const p = join(FEED, name + '.csv');
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, 'utf8').split(/\r?\n/);
  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const s = lines[i];
    if (!s) continue;
    const [t, o, h, l, c, v] = s.split(',').map(Number);
    if (!Number.isFinite(t) || !Number.isFinite(c)) continue;
    if (bars.length && t <= bars[bars.length - 1].t) continue; // keep strictly increasing
    bars.push({ t, o, h, l, c, v });
  }
  return bars;
}

const mtime = (name) => { try { return statSync(join(FEED, name + '.csv')).mtimeMs; } catch { return 0; } };
const writeAtomic = (p, s) => { writeFileSync(p + '.tmp', s); renameSync(p + '.tmp', p); };
const fmtT = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const dxyKeyFor = (tf) => (profileFor(tf).minutes >= 60 ? 'DXY_' + tf : 'DXY_H1');

function panelFor(tf, feeds) {
  const prof = profileFor(tf);
  const P = zoneParams(DEFAULTS, prof, MINTICK);
  const W = engineWindowFor(P, prof.chartSec, prof.a1Sec, prof.a2Sec);
  const all = feeds[tf];
  const bars = all.slice(-(W + SENSOR_WARM));
  if (!bars.length || !feeds[prof.htfTf] || !feeds[PINE_TO_TF[prof.a1Tf]] || !feeds[PINE_TO_TF[prof.a2Tf]]) return null;
  const chartT = bars[bars.length - 1].t;
  const htf = withForming(feeds[prof.htfTf], prof.htfSec, chartT);
  const a1 = withForming(feeds[PINE_TO_TF[prof.a1Tf]], prof.a1Sec, chartT);
  const a2 = withForming(feeds[PINE_TO_TF[prof.a2Tf]], prof.a2Sec, chartT);
  // Pine runs the engine on the last W bars only.
  const startBar = Math.max(0, bars.length - 1 - W);
  let last = null;
  runTimeframe({ tf, bars, htfBars: htf, a1Bars: a1, a2Bars: a2, mintick: MINTICK, startBar, keepRows: false, onRow: (r) => { if (r.i === bars.length - 1) last = r; } });
  if (!last || !last.engineOn) return null;
  const lp = lampOf(last, { mintick: MINTICK });
  const dxyBars = feeds[dxyKeyFor(tf)];
  const dxy = dxyText(dxyBars ? dxyBars.map((b) => b.c) : null);
  return { tf, t: last.t, close: last.c, atrEng: last.atrEng, warmed: last.warmed, barCount: bars.length, W, ...lp, dxy, dxyHad: !!dxyBars };
}

// Green-light ledger (LIVE_PREREGISTRATION.md): a new green (lamp turns 2, or turns 2 in the
// other direction) opens a record at the signal bar's close; target / stop = ±1 engine ATR of
// that timeframe; resolved on later M1 bars, first touch wins, both in one M1 bar = loss.
const ledgerPath = join(LOG, 'greens.csv');
const statePath = join(STATE, 'ledger.json');
let ledger = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { seq: 0, open: [], lastLamp: {}, lastBarT: {} };
if (!existsSync(ledgerPath)) appendFileSync(ledgerPath, 'id,tf,kind,dir,signal_bar_utc,entry,atr,target,stop,result,resolved_utc,bars_to_result,why\n');

function openGreen(p) {
  const id = ++ledger.seq;
  const dir = p.greenDir;
  const rec = { id, tf: p.tf, kind: p.kind, dir, t: p.t, closeT: p.t + profileFor(p.tf).chartSec * 1000, entry: p.close, atr: p.atrEng,
    target: p.close + dir * p.atrEng, stop: p.close - dir * p.atrEng, why: p.head, expiresAt: p.t + (GREEN_EXPIRY_BARS + 1) * profileFor(p.tf).chartSec * 1000 };
  ledger.open.push(rec);
  appendFileSync(join(LOG, 'events.log'), `${new Date().toISOString()} GREEN#${id} ${p.tf} ${p.kind} dir=${dir} entry=${p.close} atr=${p.atrEng.toFixed(3)} | ${p.head}\n`);
}

function resolveGreens(m1) {
  const still = [];
  for (const g of ledger.open) {
    let res = null, rt = null;
    for (const b of m1) {
      if (b.t < g.closeT) continue; // M1 bars that open after the signal bar closed
      const hitT = g.dir > 0 ? b.h >= g.target : b.l <= g.target;
      const hitS = g.dir > 0 ? b.l <= g.stop : b.h >= g.stop;
      if (hitT && hitS) { res = 'loss_both'; rt = b.t; break; }
      if (hitS) { res = 'loss'; rt = b.t; break; }
      if (hitT) { res = 'win'; rt = b.t; break; }
      if (b.t >= g.expiresAt) { res = 'expired'; rt = b.t; break; }
    }
    if (!res) { still.push(g); continue; }
    const barsTo = Math.round((rt - g.closeT) / (profileFor(g.tf).chartSec * 1000));
    appendFileSync(ledgerPath, [g.id, g.tf, g.kind, g.dir, fmtT(g.t), g.entry, g.atr.toFixed(3), g.target.toFixed(3), g.stop.toFixed(3), res, fmtT(rt), barsTo, '"' + g.why + '"'].join(',') + '\n');
    appendFileSync(join(LOG, 'events.log'), `${new Date().toISOString()} RESULT#${g.id} ${g.tf} ${res}\n`);
  }
  ledger.open = still;
}

const panels = {};
const seen = {};

function tick() {
  const names = ['XAUUSD_M1', 'XAUUSD_M5', 'XAUUSD_M15', 'XAUUSD_H1', 'XAUUSD_H4', 'XAUUSD_D', 'XAUUSD_W', 'DXY_H1', 'DXY_H4'];
  const sig = names.map(mtime).join(',');
  if (seen.sig === sig) return false;
  seen.sig = sig;
  const feeds = {};
  for (const n of names) { const b = readFeed(n); if (b) feeds[n.startsWith('XAUUSD_') ? n.slice(7) : n] = b; }
  if (!feeds.M1) return false;
  let changed = false;
  for (const tf of TFS) {
    if (!feeds[tf] || !feeds[tf].length) continue;
    const lastT = feeds[tf][feeds[tf].length - 1].t;
    // Same bar already computed; recompute only if the dollar file appeared since (start-up race).
    if (ledger.lastBarT[tf] === lastT && panels[tf] && (panels[tf].dxyHad || !feeds[dxyKeyFor(tf)])) continue;
    let p;
    try { p = panelFor(tf, feeds); } catch (e) { appendFileSync(join(LOG, 'errors.log'), `${new Date().toISOString()} ${tf} ${e.stack}\n`); continue; }
    if (!p) continue;
    panels[tf] = p;
    changed = true;
    if (ledger.lastBarT[tf] === lastT) continue; // bar already logged (runner restart)
    const prev = ledger.lastLamp[tf];
    const isNewGreen = p.lamp === 2 && p.greenDir !== 0 && ledger.lastBarT[tf] !== undefined && !(prev && prev.lamp === 2 && prev.dir === p.greenDir);
    if (isNewGreen) openGreen(p);
    ledger.lastLamp[tf] = { lamp: p.lamp, dir: p.greenDir };
    ledger.lastBarT[tf] = lastT;
    appendFileSync(join(LOG, 'panels.csv'), [fmtT(p.t), tf, p.close, p.lamp, '"' + p.head + '"', ...p.rows.map((r) => '"' + r + '"'), '"' + p.dxy + '"'].join(',') + '\n');
  }
  resolveGreens(feeds.M1);
  writeAtomic(statePath, JSON.stringify(ledger));
  if (changed) {
    const out = TFS.filter((tf) => panels[tf]).map((tf) => panels[tf]);
    writeAtomic(join(STATE, 'state.json'), JSON.stringify({ updated: new Date().toISOString(), panels: out.map(({ zones, ...rest }) => ({ ...rest, zones: Object.fromEntries(Object.entries(zones).map(([k, z]) => [k, z.active ? { lo: z.lo, hi: z.hi, q: z.displayQ, containing: z.containing } : null])) })), openGreens: ledger.open }, null, 1));
    const zz = (z) => (z.active ? [z.lo, z.hi] : ['', '']);
    writeAtomic(join(STATE, 'draw.txt'), out.map((p) => [p.tf, p.lamp, p.head, ...p.rows, p.dxy, ...zz(p.zones.R1), ...zz(p.zones.R2), ...zz(p.zones.S1), ...zz(p.zones.S2)].join('|')).join('\n') + '\n');
    const lampWord = (l) => (l === 2 ? 'أخضر' : l === 1 ? 'أصفر' : 'أحمر');
    writeAtomic(join(STATE, 'panel.txt'), out.map((p) => `${p.tf} ${fmtT(p.t)} سعر ${p.close} | ${lampWord(p.lamp)} ${p.head}\n  ${p.rows.join('\n  ')}\n  ${p.dxy}`).join('\n') + '\n');
  }
  return changed;
}

function heartbeat(extra = '') {
  writeAtomic(join(STATE, 'runner_status.txt'), `${new Date().toISOString()} pid=${process.pid} open=${ledger.open.length} ${extra}\n`);
}

if (ONCE) { tick(); heartbeat('once'); }
else {
  const loop = () => { try { tick(); heartbeat(); } catch (e) { appendFileSync(join(LOG, 'errors.log'), `${new Date().toISOString()} ${e.stack}\n`); } };
  loop();
  setInterval(loop, 5000);
}
