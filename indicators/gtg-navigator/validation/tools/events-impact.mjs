// Before/after impact on engine events: runs two engine.mjs versions on the same seeded
// synthetic bars (defaults) and counts, per event type, the bars where the flag differs.
// Slot maps are compared too (they must not differ for an event-only change).
// Usage: node events-impact.mjs <before/engine.mjs> <after/engine.mjs> [bars] [seed] [mintick]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [beforePath, afterPath, nArg = '8000', seedArg = '21', tickArg = '0.01'] = process.argv.slice(2);
const before = await import(pathToFileURL(resolve(beforePath)).href);
const after = await import(pathToFileURL(resolve(afterPath)).href);
const n = Number(nArg), seed = Number(seedArg), mintick = Number(tickArg);
const bars = after.syntheticBars(n, seed);
const EV = ['breakingUp', 'breakingDn', 'acceptedUp', 'acceptedDn', 'rejectR', 'rejectS', 'flipConfirmed'];
const sig = (slots) => JSON.stringify(slots.map((s) => (s.active ? [s.lo, s.hi, s.side, s.entryKeys, s.lastKeys] : null)));
const run = (mod) => {
  const P = mod.withSymbol(mod.DEFAULTS, { mintick });
  const e = new mod.Engine(bars, mod.computeSeries(bars, P), P, {});
  return bars.map((_, i) => { const r = e.step(i); return { sig: sig(e.slots), ev: r.events }; });
};
const a = run(before), b = run(after);
const out = { bars: n, seed, mintick, slotMapDiffBars: 0 };
for (const k of EV) out[k] = { before: 0, after: 0, onlyBefore: 0, onlyAfter: 0 };
for (let i = 0; i < n; i++) {
  if (a[i].sig !== b[i].sig) out.slotMapDiffBars++;
  for (const k of EV) {
    const x = !!a[i].ev[k], y = !!b[i].ev[k];
    out[k].before += x; out[k].after += y;
    if (x && !y) out[k].onlyBefore++;
    if (y && !x) out[k].onlyAfter++;
  }
}
console.log(JSON.stringify(out));
