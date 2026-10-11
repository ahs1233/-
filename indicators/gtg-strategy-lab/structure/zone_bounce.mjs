// What happens after price enters the expected pullback zone (Train data, exploratory).
//   node structure/zone_bounce.mjs <feeds.json> [fromISO] [toISO]
// Setup: strong zigzag move A→B (|B−A| ≥ 4 ATR at A). Known only from B's confirmation bar.
// Entry: limit at level e of the move (0.45 or 0.60), on bars after confirmation; a bar that
// opens past e fills at its open, past 0.80 the setup is skipped; a new extreme beyond B
// before the fill cancels it; no fill within MAX_WAIT bars cancels it.
// Exit: stop at A (100%); target at level t; first touch wins, a bar touching both counts as
// the stop, the entry bar can only stop out. No exit within HORIZON bars → close at its close.
import { readFileSync } from 'node:fs';
import { detectSwings } from './segmentation.mjs';

const [, , inp, fromIso, toIso] = process.argv;
const from = fromIso ? Date.parse(fromIso) : -Infinity;
const to = toIso ? Date.parse(toIso) : Infinity;
const COST = Number(process.env.COST ?? 0.30), MAX_WAIT = 30, HORIZON = 100;
const doc = JSON.parse(readFileSync(inp, 'utf8'));
const pct = (x) => (100 * x).toFixed(0) + '%';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };

function trade(bars, cb, dir, A, B, M, e, t) {
  const lvl = (f) => B - dir * f * M;
  const entryLvl = lvl(e), skipLvl = lvl(0.80), stop = A, target = lvl(t);
  const beyond = (x, y) => dir > 0 ? x > y : x < y;   // x is further in the move's direction than y
  let j = -1, entry = NaN;
  for (let k = cb + 1; k < Math.min(bars.length, cb + 1 + MAX_WAIT); k++) {
    const b = bars[k], fav = dir > 0 ? b.h : b.l, adv = dir > 0 ? b.l : b.h;
    if (beyond(fav, B)) return null;
    if (beyond(adv, entryLvl)) continue;                 // not reached the entry level yet
    if (beyond(entryLvl, b.o)) { if (beyond(skipLvl, b.o)) return null; entry = b.o; } else entry = entryLvl;
    j = k; break;
  }
  if (j < 0) return null;
  let mfe = 0;
  for (let k = j; k < Math.min(bars.length, j + HORIZON); k++) {
    const b = bars[k], fav = dir > 0 ? b.h : b.l, adv = dir > 0 ? b.l : b.h;
    if (!beyond(adv, stop)) return { win: false, pnl: -Math.abs(entry - stop) - COST, risk: Math.abs(entry - stop), mfe };
    if (k > j && (beyond(fav, target) || fav === target)) return { win: true, pnl: Math.abs(target - entry) - COST, risk: Math.abs(entry - stop), mfe: Math.abs(target - entry) };
    if (k > j) mfe = Math.max(mfe, dir * (fav - entry));
  }
  const last = bars[Math.min(bars.length, j + HORIZON) - 1];
  return { win: null, pnl: dir * (last.c - entry) - COST, risk: Math.abs(entry - stop), mfe };
}

for (const [tf, thr] of [['M5', 1.0], ['M15', 1.0], ['H1', 1.2]]) {
  const bars = doc.feeds[tf].map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));
  const { swings, atr } = detectSwings(bars, { atrLen: 14, threshold: thr });
  const setups = [];
  for (let i = 1; i < swings.length; i++) {
    const a = swings[i - 1], b = swings[i];
    if (a.time < from || a.time >= to) continue;
    const M = Math.abs(b.price - a.price);
    if (!(atr[a.bar] > 0) || M < 4 * atr[a.bar]) continue;
    setups.push({ cb: b.confirmBar, dir: b.price > a.price ? 1 : -1, A: a.price, B: b.price, M });
  }
  console.log(`\n=== ${tf}: ${setups.length} strong-move setups (median move ${q(setups.map((s) => s.M), .5).toFixed(1)}$), cost ${COST}$ per trade ===`);
  for (const e of [0.45, 0.60]) {
    for (const t of [0.30, 0.15, 0.0]) {
      const rs = setups.map((s) => trade(bars, s.cb, s.dir, s.A, s.B, s.M, e, t)).filter(Boolean);
      const wins = rs.filter((r) => r.win === true).length, losses = rs.filter((r) => r.win === false).length, open = rs.length - wins - losses;
      const net = rs.reduce((x, r) => x + r.pnl, 0) / rs.length;
      const netR = rs.reduce((x, r) => x + r.pnl / r.risk, 0) / rs.length;
      console.log(`  entry ${pct(e)} → target ${pct(t).padStart(3)} | trades ${String(rs.length).padStart(5)} (fill ${pct(rs.length / setups.length)}) | target first ${pct(wins / rs.length)} stop first ${pct(losses / rs.length)} timeout ${pct(open / rs.length)} | avg net ${net >= 0 ? '+' : ''}${net.toFixed(2)}$ = ${netR >= 0 ? '+' : ''}${netR.toFixed(2)}R | median risk ${q(rs.map((r) => r.risk), .5).toFixed(1)}$`);
    }
  }
}
