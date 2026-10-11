// Pullback anatomy on small timeframes (Train data only).
//   node structure/ltf_reversal.mjs <feeds.json>
import { readFileSync } from 'node:fs';
import { detectSwings } from './segmentation.mjs';

const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const pct = (x) => (100 * x).toFixed(0) + '%';
// UTC hour of the move's end (the turning point the pullback starts from).
const session = (t) => { const h = new Date(t).getUTCHours(); return h >= 13 && h < 17 ? 'London+NY 13-17' : h >= 7 && h < 13 ? 'London 07-13' : h >= 17 && h < 21 ? 'NY 17-21' : 'Asia/off 21-07'; };

for (const [tf, thr, mins] of [['M5', 1.0, 5], ['M15', 1.0, 15]]) {
  const bars = doc.feeds[tf].map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));
  const { swings, atr } = detectSwings(bars, { atrLen: 14, threshold: thr });
  const rows = [];
  for (let i = 2; i < swings.length - 1; i++) {
    const a = swings[i - 2], b = swings[i - 1], c = swings[i], d = swings[i + 1];
    const imp = Math.abs(b.price - a.price), pb = Math.abs(c.price - b.price), nxt = Math.abs(d.price - c.price);
    const atrA = atr[a.bar];
    if (!(imp > 0) || !(atrA > 0)) continue;
    rows.push({ impAtr: imp / atrA, depth: pb / imp, resumed: nxt > pb, impUsd: imp, pbUsd: pb,
      pbMin: (c.bar - b.bar) * mins, sess: session(b.time) });
  }
  const line = (label, rs) => {
    if (rs.length < 50) return console.log(`  ${label.padEnd(18)} n=${rs.length} (too few)`);
    const dep = rs.map((r) => r.depth), part = rs.filter((r) => r.depth < 1);
    console.log(`  ${label.padEnd(18)} n=${String(rs.length).padStart(6)} | depth ${pct(q(dep, .25))}-${pct(q(dep, .75))} median ${pct(q(dep, .5))} | full rev ${pct(rs.filter((r) => r.depth >= 1).length / rs.length)} | resumed ${pct(part.filter((r) => r.resumed).length / (part.length || 1))} | move ${q(rs.map((r) => r.impUsd), .5).toFixed(1)}$ pullback ${q(rs.map((r) => r.pbUsd), .5).toFixed(1)}$ | pullback lasts ${q(rs.map((r) => r.pbMin), .5)}-${q(rs.map((r) => r.pbMin), .75)} min (median-p75)`);
  };
  console.log(`\n=== ${tf} (zigzag ${thr} ATR) ===\nby move strength:`);
  for (const [lo, hi] of [[2, 3], [3, 4], [4, 6], [6, 99]]) line(`${lo}-${hi > 50 ? '+' : hi} ATR`, rows.filter((r) => r.impAtr >= lo && r.impAtr < hi));
  const strong = rows.filter((r) => r.impAtr >= 4);
  console.log('strong moves (>=4 ATR) by session of the turning point:');
  for (const s of ['Asia/off 21-07', 'London 07-13', 'London+NY 13-17', 'NY 17-21']) line(s, strong.filter((r) => r.sess === s));
  const bands = [[0, .382], [.382, .5], [.5, .618], [.618, .786], [.786, 1], [1, 99]];
  console.log('  strong-move depth bands: ' + bands.map(([lo, hi]) => `${hi > 9 ? '>=100%' : pct(lo) + '-' + pct(hi)} ${pct(strong.filter((r) => r.depth >= lo && r.depth < hi).length / strong.length)}`).join(' | '));
}
