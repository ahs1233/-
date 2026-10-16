// Pullback depth after a zigzag move, per timeframe.
//   node structure/pullback_depth.mjs <feeds.json> [fromISO] [toISO]
// Only moves whose start bar lies in [from, to) are counted; earlier bars still warm ATR.
import { readFileSync } from 'node:fs';
import { detectSwings } from './segmentation.mjs';

const [, , inp, fromIso, toIso] = process.argv;
const from = fromIso ? Date.parse(fromIso) : -Infinity;
const to = toIso ? Date.parse(toIso) : Infinity;
const doc = JSON.parse(readFileSync(inp, 'utf8'));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const pct = (x) => (100 * x).toFixed(0) + '%';

for (const [tf, thr] of [['M15', 1.0], ['H1', 1.2], ['H4', 1.5]]) {
  const raw = doc.feeds[tf];
  if (!raw) continue;
  const bars = raw.map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));
  const { swings, atr } = detectSwings(bars, { atrLen: 14, threshold: thr });
  const rows = [];
  for (let i = 2; i < swings.length - 1; i++) {
    const a = swings[i - 2], b = swings[i - 1], c = swings[i], d = swings[i + 1];
    if (a.time < from || a.time >= to) continue;
    const imp = Math.abs(b.price - a.price), pb = Math.abs(c.price - b.price), nxt = Math.abs(d.price - c.price);
    const atrA = atr[a.bar];
    if (!(imp > 0) || !(atrA > 0)) continue;
    rows.push({ impAtr: imp / atrA, depth: pb / imp, resumed: nxt > pb });
  }
  const stats = (rs) => {
    const dep = rs.map((r) => r.depth);
    const partial = rs.filter((r) => r.depth < 1);
    return { n: rs.length, p25: q(dep, 0.25), median: q(dep, 0.5), p75: q(dep, 0.75),
      fullReversal: rs.filter((r) => r.depth >= 1).length / rs.length,
      resumed: partial.filter((r) => r.resumed).length / (partial.length || 1) };
  };
  const large = rows.filter((r) => r.impAtr >= 4);
  console.log(`\n${tf} (zigzag ${thr} ATR) — moves from ${fromIso ?? 'start'} to ${toIso ?? 'end'}`);
  for (const [label, rs] of [['all', rows], ['large >=4 ATR', large]]) {
    if (rs.length < 30) { console.log(`  ${label}: n=${rs.length} (too few)`); continue; }
    const s = stats(rs);
    console.log(`  ${label.padEnd(14)} n=${String(s.n).padStart(6)} | depth p25 ${pct(s.p25)} median ${pct(s.median)} p75 ${pct(s.p75)} | full reversal ${pct(s.fullReversal)} | resumed ${pct(s.resumed)}`);
  }
}
