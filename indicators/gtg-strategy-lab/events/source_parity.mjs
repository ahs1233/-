// GTG-state parity between two price sources (OANDA feasibility test, GPT message 42).
// NOT RESEARCH EVIDENCE. The data lies in the Historical Holdout, so only agreement ratios are
// reported — never a count, rate, timing distribution, outcome, power or edge.
//   node source_parity.mjs feedsA.json feedsB.json report.json [mintick] [w]
import { readFileSync, writeFileSync } from 'node:fs';
import { run, FAMILIES } from './causality.mjs';

const activeKeys = (p) => p.slots.filter((s) => s.active).map((s) => `${s.name}:${s.primaryKey}`).sort().join('|');
const STATE = { heading: (p) => p.headingSign, route: (p) => p.routeSign, slots: activeKeys };

export function sourceParity(fa, fb, { mintick, w }) {
  const ra = run(fa, { mintick, w }), rb = run(fb, { mintick, w });
  const byB = new Map(rb.panel.map((p) => [p.t, p]));
  const common = ra.panel.filter((p) => byB.has(p.t) && p.warmed && byB.get(p.t).warmed);
  const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : null);
  const states = Object.fromEntries(Object.entries(STATE).map(([k, g]) => [k, share(common, (p) => g(p) === g(byB.get(p.t)))]));
  const barsA = new Set(ra.panel.map((p) => p.t)), barsB = new Set(rb.panel.map((p) => p.t));
  const events = {};
  for (const [name, get] of FAMILIES) {
    // compare only where both sources have the bar, so a missing minute is not counted twice
    const A = new Set((get(ra) ?? []).map((e) => e.time).filter((t) => barsB.has(t)));
    const B = new Set((get(rb) ?? []).map((e) => e.time).filter((t) => barsA.has(t)));
    const union = new Set([...A, ...B]);
    events[name] = union.size ? [...A].filter((t) => B.has(t)).length / union.size : null;
  }
  return {
    label: 'GTG-state parity — NOT RESEARCH EVIDENCE (ratios only)',
    m5_bar_overlap: share(ra.panel, (p) => byB.has(p.t)),
    state_agreement: states,
    event_jaccard: events,
  };
}

if (process.argv[1] && process.argv[1].endsWith('source_parity.mjs') && process.argv[3]) {
  const load = (p) => Object.fromEntries(Object.entries(JSON.parse(readFileSync(p, 'utf8')).feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))]));
  const rep = sourceParity(load(process.argv[2]), load(process.argv[3]), { mintick: Number(process.argv[5] ?? 0.001), w: Number(process.argv[6] ?? 0.3) });
  writeFileSync(process.argv[4], JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep, null, 1));
}
