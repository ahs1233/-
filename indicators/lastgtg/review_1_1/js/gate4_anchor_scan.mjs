// Exploration (run 4, not part of the gate): replay one cell with the anchor histories started
// a1 / a2 bars earlier (negative) or later than the run-3 count rule, on the limit variant's rule.
//   node gate4_anchor_scan.mjs <captureDir> <res> <v> <a1 shifts csv> <a2 shifts csv>
// Run 4, H4: a2 (weekly) 0 → 3,262 / 3,361 / 3,274 differences (A / B / C), −80 → 15, −82 … −3400 → 0.
import { gateCell } from './gate4.mjs';
const [, , dir, res, v, s1 = '0', s2 = '0'] = process.argv;
for (const a1 of s1.split(',').map(Number)) for (const a2 of s2.split(',').map(Number)) {
  const o = gateCell(dir, res, v, { a1Shift: a1, a2Shift: a2, countRule: true });
  console.log(`a1 ${a1} a2 ${a2}: mismatched ${o.mismatched} first layer ${o.firstLayer} ${JSON.stringify(o.firstDifferenceByLayer[o.firstLayer] ?? null)} starts ${o.starts.pine}/${o.starts.js} agreeFrom ${JSON.stringify(o.agreeFrom)}`);
}
