// H1–H5 event/control rows on real data for the Train-only Power Gate (TRADE_CONTRACT §9–§14,
// §16–§17, §20). One continuous pipeline run; Train rows only (the Holdout lock is asserted);
// R_12 on BID from BidOpen[t+1] to BidClose[t+12] / ATR[t], censored at the end of Train.
//   H1  TC-H1 risk set (events + open-episode controls at the same age)
//   H2  CE risk set (age since E1)
//   H3  GTG rejections (inSlot, rej ≥ 0.5) vs P1 naive online pivots through the same Reaction
//       Engine; w = median width/ATR_eng of the displayed GTG zones on Train bars (§14)
//   H4  FLIP-1 (armed) vs rejections from ACTIVE, never-broken levels
//   H5  Single-TF TC events: MTF-Heading aligned (event) vs not aligned (control)
// Level-age quartiles and zone-width terciles come from Train on the combined population (§12.1).
// No ATT, expectancy or verdict is computed here.
import { runRows } from './pipeline.mjs';
import { buildPanel } from './panel.mjs';
import { extractTC, extractH5 } from './tc.mjs';
import { extractCE } from './ce.mjs';
import { extractZoneEvents } from './zone.mjs';
import { extractP1 } from './comparators.mjs';
import { outcome } from './outcomes.mjs';
import { atrRank, covariatesOf, withClusters } from './covariates.mjs';
import { assertNotHoldout } from './split.mjs';
import { quantileEdges } from '../stats/cem.mjs';
import { profileFor, zoneParams } from '../engine/profiles.mjs';
import { DEFAULTS } from '../engine/pinecmp/zone-engine.mjs';
import { tradingDayId } from './comparators.mjs';

export const H = ['H1', 'H2', 'H3', 'H4', 'H5'];
export const HORIZON = 12;

const median = (v) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

// median width/ATR_eng over every (bar, displayed slot) of the Train bars
export function displayedWidthMedian(panel, inTrain) {
  const v = [];
  for (const p of panel) if (inTrain(p.t) && p.atrEng > 0) for (const s of p.slots) if (s.active) v.push((s.hi - s.lo) / p.atrEng);
  return median(v);
}

export function jaccardTimes(a, b) {
  const A = new Set(a.map((e) => e.time)), B = new Set(b.map((e) => e.time));
  const u = new Set([...A, ...B]);
  return u.size ? [...A].filter((x) => B.has(x)).length / u.size : null;
}

export function buildHypotheses(feeds, { mintick, split }) {
  const inTrain = (t) => split.segmentOf(t) === 'train';
  const m5 = runRows('M5', feeds, mintick);
  const mtf = { M15: runRows('M15', feeds, mintick), H1: runRows('H1', feeds, mintick), H4: runRows('H4', feeds, mintick) };
  const panel = buildPanel(m5, mtf, { tf: 'M5' });
  const tc = extractTC(panel, { macro: 'H1' });
  const h5 = extractH5(panel);
  const ce = extractCE(panel);
  const zone = extractZoneEvents(panel);
  const w = displayedWidthMedian(panel, inTrain);
  const P = zoneParams(DEFAULTS, profileFor('M5'), mintick);
  const gtgSlotKeys = panel.map((p) => p.slots.filter((s) => s.active).flatMap((s) => s.entryKeys));
  const p1 = extractP1(feeds.M5, P, { w, gtgSlotKeys });

  const bars = feeds.M5.map((b) => ({ bo: b.o, bh: b.h, bl: b.l, bc: b.c, ao: null, ac: null }));
  let boundary = -1;
  for (let i = 0; i < feeds.M5.length && feeds.M5[i].t < split.boundaries[0]; i++) boundary = i;
  const raw = {
    H1: tc.rows,
    H2: ce.rows,
    H3: [...zone.h3.map((e) => ({ ...e, isEvent: true })), ...p1.events.map((e) => ({ ...e, isEvent: false }))],
    H4: [...zone.flip1.map((e) => ({ ...e, isEvent: true })), ...zone.h4Comparator.map((e) => ({ ...e, isEvent: false }))],
    H5: h5.events.map((e) => ({ ...e, isEvent: e.treated })),
  };
  const train = Object.fromEntries(H.map((h) => [h, assertNotHoldout(raw[h].filter((r) => inTrain(r.time)), split)]));
  const edges = {
    H3: { levelAgeEdges: quantileEdges(train.H3.map((r) => r.levelAge), 4), widthEdges: quantileEdges(train.H3.map((r) => r.width), 3) },
    H4: { levelAgeEdges: quantileEdges(train.H4.map((r) => r.levelAge), 4) },
  };
  const rank = atrRank(panel);
  const rows = {};
  for (const h of H) {
    const withR = train[h].map((r) => {
      const o = outcome(bars, r.t, r.D, HORIZON, panel[r.t].atr, { boundary });
      const cov = covariatesOf(h, r, panel, rank, edges[h] ?? {});
      return { t: r.t, time: r.time, D: r.D, isEvent: !!r.isEvent, episode: r.episode, family: r.family, slot: r.slot,
        R: o.censored ? NaN : o.R, stratum: cov.stratum };
    });
    rows[h] = withClusters(withR, panel);
  }
  const trainDays = [...new Set(panel.filter((p) => inTrain(p.t)).map((p) => tradingDayId(p.t)))].sort();
  return {
    rows, trainDays, w, edges,
    jaccardTcCe: jaccardTimes(train.H1.filter((r) => r.isEvent), train.H2.filter((r) => r.isEvent)),
    trainYears: (split.boundaries[0] - split.firstValid) / (365.25 * 86_400_000),
  };
}
