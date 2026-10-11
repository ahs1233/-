// Writes a GTGSNAP v1 capture produced by the JS reference for seeded synthetic bars
// (the same format Pine prints), for testing the comparison tooling.
// Usage: node js-capture.mjs <bars> <seed> <drop> <startIdx> <fromIdx> <toIdx> > out.txt
//   The series is syntheticBars(bars, seed); the first <drop> bars are withheld from
//   this run (a shorter history). Indices are positions in the full series; the
//   engine starts at startIdx in both cases.
import { DEFAULTS, computeSeries, Engine, syntheticBars, withSymbol } from '../../reference/engine.mjs';
import { canonicalSnapshot } from '../../reference/snapshot.mjs';
import { formatCapture } from '../../reference/capture.mjs';

const [n, seed, drop, startIdx, from, to] = process.argv.slice(2).map(Number);
const P = withSymbol(DEFAULTS, { mintick: 0.01 });
const all = syntheticBars(n, seed);
const bars = all.slice(drop);
const eng = new Engine(bars, computeSeries(bars, P), P, { startBar: startIdx - drop });
const out = [];
bars.forEach((b, i) => {
  const r = eng.step(i);
  const gi = i + drop;
  if (r && gi >= from && gi <= to) out.push(formatCapture(canonicalSnapshot(eng, r, i, { symbol: 'SYN:TEST', timeframe: '1' })));
});
process.stdout.write(out.join('\n') + '\n');
