#!/usr/bin/env node
// Parity Gate CLI (TRADE_CONTRACT §1.3). See PARITY_RUNBOOK.md.
//   node compare-tv-export.mjs --csv <GTG Engine m export.csv> --tf M5 --mintick 0.01 \
//        [--extra <studyExtraBars>] [--frozen <GTG v0.4.7 export.csv>] [--out report.json]
//        [--feed <dir with bars_<resolution>.json from tv_bars>]   (MTF parity, feed mode)
// Exit code 0 only when every requested comparison is PASS.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTvCsv } from './tv-csv.mjs';
import { compareExport, compareCopyToFrozen, feedKeysFor, feedFromTvBars } from './compare.mjs';

function loadFeed(dir, tf) {
  const out = {};
  for (const res of new Set(Object.values(feedKeysFor(tf)))) out[res] = feedFromTvBars(JSON.parse(readFileSync(`${dir}/bars_${res}.json`, 'utf8')));
  return out;
}

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.csv || !args.tf || !args.mintick) {
  console.error('usage: --csv FILE --tf M1|M5 --mintick X [--extra N] [--frozen FILE] [--out FILE]');
  process.exit(2);
}
const copy = parseTvCsv(readFileSync(args.csv, 'utf8'));
const feed = args.feed ? loadFeed(args.feed, args.tf) : null;
const report = { replay: compareExport(copy, { tf: args.tf, mintick: Number(args.mintick), studyExtraBars: Number(args.extra ?? 0), feed }) };
if (args.frozen) report.copyVsFrozen = compareCopyToFrozen(copy, parseTvCsv(readFileSync(args.frozen, 'utf8')));

const r = report.replay;
console.log(`replay: ${r.verdict}  (mode ${r.mode}, bars ${r.bars}, W ${r.W}, JS engine start ${r.jsStartBar}, Pine first engine row ${r.pineFirstEngineRow}, ema seed ${r.emaSeed})`);
for (const [seed, run] of Object.entries(r.runs)) {
  console.log(`  seed=${seed}: ${run.mismatched} mismatches`);
  for (const [f, s] of Object.entries(run.fields)) if (s.mismatched) console.log(`    ${f}: ${s.mismatched}/${s.compared}, first at bar ${s.first.bar} (pine ${s.first.pine}, js ${s.first.js})`);
}
if (r.lowPrecision.length) console.log(`  export precision too low for: ${r.lowPrecision.join(', ')}`);
if (report.copyVsFrozen) console.log(`copy vs frozen: ${report.copyVsFrozen.verdict} (${report.copyVsFrozen.compared} values, ${report.copyVsFrozen.mismatched} mismatches)`);
if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2));
const ok = r.verdict === 'PASS' && (!report.copyVsFrozen || report.copyVsFrozen.verdict === 'PASS');
process.exit(ok ? 0 : 1);
