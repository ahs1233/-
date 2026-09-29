#!/usr/bin/env node
// Tick Audit Fuel decision check (TRADE_CONTRACT v0.2.1 §2.3): the same M1 bars with two
// volume series (official vs tick-derived). Compares fuelClass, fuelSurge and
// fuelExhaustion on the bars after the M1 Fuel warm-up (rankLen = 1000).
//   node fuel-compare.mjs official.json tickvol.json   → JSON on stdout
import { readFileSync } from 'node:fs';
import { computeSensors } from './pinecmp/sensors.mjs';  // Pine comparisons (F-007)
import { profileFor, INPUTS } from './profiles.mjs';

export function fuelCompare(a, b, mintick = 0.001) {
  const prof = profileFor('M1');
  const sa = computeSensors(a, [], prof, mintick), sb = computeSensors(b, [], prof, mintick);
  const warm = prof.rankLen + INPUTS.fuelBaselineLen;
  let compared = 0, mismatches = 0, first = null;
  const surge = (s, i) => s.fuelScore[i] >= INPUTS.fuelHighThreshold && s.fuelScore[i - 1] < INPUTS.fuelHighThreshold;
  for (let i = warm; i < a.length; i++) {
    compared++;
    const da = [sa.fuelClass[i], surge(sa, i), sa.fuelExhaustion[i]];
    const db = [sb.fuelClass[i], surge(sb, i), sb.fuelExhaustion[i]];
    if (da.some((x, k) => x !== db[k])) { mismatches++; first ??= { i, t: a[i].t, official: da, tick: db }; }
  }
  return { warmup: warm, compared, mismatches, first };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fuel-compare.mjs')) {
  const [pa, pb] = process.argv.slice(2);
  if (pa && pb) {
    const a = JSON.parse(readFileSync(pa, 'utf8'));
    const b = JSON.parse(readFileSync(pb, 'utf8')).map((x) => ({ ...x, v: x.v ?? NaN }));
    process.stdout.write(JSON.stringify(fuelCompare(a, b)));
  }
}
