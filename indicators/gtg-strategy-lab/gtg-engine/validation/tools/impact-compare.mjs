// Before/after impact of a reference change: runs two engine.mjs versions on the
// same seeded synthetic bars and counts bars whose slot maps differ.
// Usage: node impact-compare.mjs <before/engine.mjs> <after/engine.mjs> [bars] [seed] [mintick]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [beforePath, afterPath, nArg = '8000', seedArg = '21', tickArg = '0.01'] = process.argv.slice(2);
const before = await import(pathToFileURL(resolve(beforePath)).href);
const after = await import(pathToFileURL(resolve(afterPath)).href);
const n = Number(nArg), seed = Number(seedArg), mintick = Number(tickArg);
const bars = after.syntheticBars(n, seed);
const withTick = (mod) => (mod.withSymbol ? mod.withSymbol(mod.DEFAULTS, { mintick }) : mod.DEFAULTS);
const sig = (slots) => JSON.stringify(slots.map((s) => (s.active ? [s.lo, s.hi, s.side, s.entryKeys, s.lastKeys] : null)));
const run = (mod) => {
  const P = withTick(mod);
  const e = new mod.Engine(bars, mod.computeSeries(bars, P), P, {});
  return bars.map((_, i) => { e.step(i); return sig(e.slots); });
};
const a = run(before), b = run(after);
let diff = 0, first = -1;
for (let i = 0; i < n; i++) if (a[i] !== b[i]) { diff++; if (first < 0) first = i; }
console.log(JSON.stringify({ bars: n, seed, mintick, differingBars: diff, firstDifferingBar: first }));
