// Power Gate — Train only (GPT messages 57–58). Input: feeds cut at the Train end (export_feeds
// --until), so no Validation or Holdout bar reaches this process (guard below).
//   node --max-old-space-size=12000 power_run.mjs feeds_train.json report.json <firstValidISO> <tFreezeISO> [mintick]
import { readFileSync, writeFileSync } from 'node:fs';
import { makeSplit } from './split.mjs';
import { buildHypotheses } from './hypotheses.mjs';
import { powerTrain } from '../stats/power_train.mjs';

// Holdout length in trading days from the calendar alone (Mon–Fri UTC dates in [b2, T_freeze))
export function holdoutTradingDays(split) {
  let n = 0;
  for (let d = Date.UTC(...isoParts(split.boundaries[1])); d < split.tFreeze; d += 86_400_000) {
    const wd = new Date(d).getUTCDay();
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}
const isoParts = (t) => { const x = new Date(t); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; };

if (process.argv[1] && process.argv[1].endsWith('power_run.mjs') && process.argv[6]) {
  const [, , inp, out, fv, tf, mt] = process.argv;
  const doc = JSON.parse(readFileSync(inp, 'utf8'));
  const feeds = Object.fromEntries(Object.entries(doc.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))]));
  const split = makeSplit(Date.parse(fv), Date.parse(tf));
  const lastBar = feeds.M5.at(-1).t;
  // guard (GPT message 58): the last bar must end at or before the Train boundary
  if (lastBar + 300_000 > split.boundaries[0]) throw new Error(`feeds cross the Train boundary (${new Date(lastBar).toISOString()}): refuse to run`);
  for (const tf of Object.keys(feeds)) if (feeds[tf].at(-1).t >= split.boundaries[0]) throw new Error(`${tf} has a bar opening after the Train boundary: refuse to run`);
  console.log(`guard PASS: last M5 bar ${new Date(lastBar).toISOString()} ends ≤ Train end ${new Date(split.boundaries[0]).toISOString()}`);
  const t0 = Date.now();
  const hyp = buildHypotheses(feeds, { mintick: Number(mt ?? 0.001), split });
  const t1 = Date.now();
  console.log(`rows built in ${Math.round((t1 - t0) / 1000)} s`);
  const rep = powerTrain(hyp, { nDays: holdoutTradingDays(split) });
  rep.split = { firstValid: new Date(split.firstValid).toISOString(), trainEnd: new Date(split.boundaries[0]).toISOString(), tFreeze: new Date(split.tFreeze).toISOString() };
  rep.input = { feeds_sha256: doc.meta?.feeds_sha256, lastBar: new Date(lastBar).toISOString() };
  rep.seconds = { rows: Math.round((t1 - t0) / 1000), power: Math.round((Date.now() - t1) / 1000) };
  writeFileSync(out, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep, null, 1));
}
