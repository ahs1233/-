// Attributes Break Accepted / Flip Confirmed transitions of the current engine to the
// R4-B rule: for every level transition that can fire them, records whether the level
// was armed (new rule) and whether it was displayed at the previous bar (old rule).
// Usage: node events-attribution.mjs [bars] [seed] [mintick]
import { DEFAULTS, ST, Engine, computeSeries, syntheticBars, withSymbol } from '../../reference/engine.mjs';

const [n = 8000, seed = 21, mintick = 0.01] = process.argv.slice(2).map(Number);
const P = withSymbol(DEFAULTS, { mintick });
const bars = syntheticBars(n, seed);
const eng = new Engine(bars, computeSeries(bars, P), P, {});
const cat = { accept: {}, flip: {} };
const add = (kind, armed, shown) => { const k = `armed=${armed ? 1 : 0},shownPrevBar=${shown ? 1 : 0}`; cat[kind][k] = (cat[kind][k] ?? 0) + 1; };
for (let i = 0; i < n; i++) {
  const before = new Map(eng.allLevels().map((l) => [l.key, { st: l.state, armed: l.navArmed, shown: eng.inPrevSlots(l.key), obj: l }]));
  eng.step(i);
  for (const [, b] of before) {
    const l = b.obj, st = l.state;
    const accepted = (b.st === ST.BREAKING && (st === ST.BROKEN || (st === ST.DEAD && l.breakFromFlip && l.breakCloses >= 2)))
      || ((b.st === ST.ACTIVE || b.st === ST.FLIP) && (st === ST.BROKEN || (st === ST.DEAD && l.breakFromFlip)));
    // Arm that governed the event: set on this bar for an immediate (strong body) acceptance.
    if (accepted) add('accept', (b.st === ST.BREAKING ? b.armed : b.shown), b.shown);
    // A flip needs bi − stateChartBar ≤ flipWindow, so the arm before the step is the arm at the flip.
    if (b.st === ST.BROKEN && st === ST.FLIP) add('flip', b.armed, b.shown);
  }
}
console.log(JSON.stringify({ bars: n, seed, mintick, ...cat }));
