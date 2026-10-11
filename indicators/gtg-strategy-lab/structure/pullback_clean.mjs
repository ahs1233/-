// Pullback depth after strong moves, split by whether the move's turning point and the
// pullback's extreme fall on the same candle (intrabar order unknown) or on different ones.
//   node structure/pullback_clean.mjs <feeds.json> [fromISO] [toISO]
// Only moves whose start lies in [from, to) are counted; earlier bars still warm ATR.
import { readFileSync } from 'node:fs';
import { detectSwings } from './segmentation.mjs';

const [, , inp, fromIso, toIso] = process.argv;
const from = fromIso ? Date.parse(fromIso) : -Infinity;
const to = toIso ? Date.parse(toIso) : Infinity;
const doc = JSON.parse(readFileSync(inp, 'utf8'));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const pct = (x) => (100 * x).toFixed(0) + '%';

for (const [tf, thr, mins] of [['M5', 1.0, 5], ['M15', 1.0, 15], ['H1', 1.2, 60], ['H4', 1.5, 240]]) {
  if (!doc.feeds[tf]) continue;
  const bars = doc.feeds[tf].map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));
  const { swings, atr } = detectSwings(bars, { atrLen: 14, threshold: thr });
  const rows = [];
  for (let i = 2; i < swings.length - 1; i++) {
    const a = swings[i - 2], b = swings[i - 1], c = swings[i], d = swings[i + 1];
    if (a.time < from || a.time >= to) continue;
    const imp = Math.abs(b.price - a.price), pb = Math.abs(c.price - b.price), nxt = Math.abs(d.price - c.price);
    if (!(imp > 0) || !(atr[a.bar] > 0) || imp / atr[a.bar] < 4) continue;
    rows.push({ depth: pb / imp, resumed: nxt > pb, gap: c.bar - b.bar });
  }
  const st = (rs) => {
    if (rs.length < 30) return `n=${rs.length} (too few)`;
    const dep = rs.map((r) => r.depth), part = rs.filter((r) => r.depth < 1);
    return `n=${String(rs.length).padStart(5)} | depth p25 ${pct(q(dep, .25))} median ${pct(q(dep, .5))} p75 ${pct(q(dep, .75))} | full reversal ${pct(rs.filter((r) => r.depth >= 1).length / rs.length)} | resumed ${pct(part.filter((r) => r.resumed).length / (part.length || 1))}`;
  };
  const same = rows.filter((r) => r.gap === 0), clean = rows.filter((r) => r.gap > 0);
  console.log(`\n${tf} (zigzag ${thr} ATR) strong moves ${rows.length}, same-candle share ${pct(same.length / (rows.length || 1))}`);
  console.log(`  clean       ${st(clean)}`);
  console.log(`  same candle ${st(same)}`);
}
