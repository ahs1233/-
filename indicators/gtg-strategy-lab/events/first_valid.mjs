// firstValidTime on real feeds (TRADE_CONTRACT §20; v0.2.3 dataset). Prices only: no event,
// outcome or count is computed.
//   node first_valid.mjs feeds.json [mintick]  → JSON { firstValid, need, bars, researchStart, warmupCoversResearchStart }
import { readFileSync } from 'node:fs';
import { firstValidTime } from './split.mjs';

export const RESEARCH_START = Date.UTC(2021, 8, 29);   // research window start (GPT message 32)

export function firstValidReport(feeds, mintick) {
  const r = firstValidTime(feeds, mintick);
  return {
    firstValid: r.t === null ? null : new Date(r.t).toISOString(),
    need: r.need,
    reason: r.reason ?? null,
    bars: Object.fromEntries(Object.entries(feeds).map(([k, v]) => [k, v.length])),
    researchStart: new Date(RESEARCH_START).toISOString(),
    warmupCoversResearchStart: r.t !== null && r.t <= RESEARCH_START,
  };
}

if (process.argv[1] && process.argv[1].endsWith('first_valid.mjs') && process.argv[2]) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const feeds = Object.fromEntries(Object.entries(doc.feeds).map(([k, v]) => [k, v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }))]));
  console.log(JSON.stringify(firstValidReport(feeds, Number(process.argv[3] ?? 0.001)), null, 1));
}
