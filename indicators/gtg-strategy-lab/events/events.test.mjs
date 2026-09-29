// EV — Event Engine definitions on hand-built panels; CG — the Causality Gate on the full
// pipeline (future truncation and future perturbation). Synthetic data only (message 22 §8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketBars } from '../gtg-engine/reference/history.mjs';
import { extractTC, extractH5 } from './tc.mjs';
import { extractCE } from './ce.mjs';
import { extractZoneEvents } from './zone.mjs';
import { outcome } from './outcomes.mjs';
import { lastClosedIndex, buildPanel, DUR_MS } from './panel.mjs';
import { runEventPipeline } from './pipeline.mjs';
import { tradingDayId } from './comparators.mjs';
import { ST } from '../engine/zone-engine.mjs';

// ---------- hand-built panels ----------
const mtf = (route, heading = 0) => ({ M5: { routeSign: route, headingSign: heading }, M15: { routeSign: route, headingSign: heading }, H1: { routeSign: route, headingSign: heading }, H4: { routeSign: route, headingSign: heading } });
const P = (hs, { route = 1, heading = 0, extra = {} } = {}) => hs.map((h, i) => ({ i, t: i * 300_000, headingSign: h, headingScore: h * 30, mtf1: mtf(route, heading), slots: [], log: [], ...extra, prev: null }));

test('EV1 TC: start, age, one trigger per episode, censoring by age and Macro', () => {
  // +1 then leaves (start at 2), comes back at age 3 → event
  const r = extractTC(P([1, 1, 0, 0, -1, 1, 1, 0]), { macro: 'H1' });
  assert.deepEqual(r.events.map((e) => [e.t, e.D, e.age]), [[5, 1, 3]]);
  assert.deepEqual(r.rows.filter((x) => x.episode === r.events[0].episode).map((x) => [x.age, x.isEvent]), [[1, false], [2, false], [3, true]]);
  // a second episode starts at 7 (heading 1 → 0) and stays open to the end
  assert.equal(r.episodes.length, 2);
  // age > 10 → censored, rows stay controls
  const long = extractTC(P([1, 0, ...Array(12).fill(0), 1]), { macro: 'H1' });
  assert.equal(long.events.length, 0);
  assert.equal(long.episodes[0].end, 'censored:age');
  assert.equal(long.rows.length, 10);
  // Macro against D → no episode for D = +1 (route −1); D = −1 never starts here
  assert.equal(extractTC(P([1, 0, 1], { route: -1 }), { macro: 'H1' }).episodes.length, 0);
});

test('EV1b TC Macro fails mid-episode → censored at that bar, no trigger after it', () => {
  const p = P([1, 0, 0, 1]);
  p[3].mtf1 = mtf(0);
  const r = extractTC(p, { macro: 'H1' });
  assert.equal(r.events.length, 0);
  assert.equal(r.episodes[0].end, 'censored:macro');
});

test('EV1c H5: single-TF events, treated = MTF-Heading aligned at t−1', () => {
  const p = P([-1, 0, -1, 1, 0, 1], { route: 0 });
  p[2].mtf1 = mtf(0, -1);
  const r = extractH5(p);
  assert.deepEqual(r.events.map((e) => [e.t, e.D, e.treated]), [[2, -1, true], [5, 1, false]]);
});

const slot = (name, lo, hi, keys, primaryKey = keys[0]) => ({ name, active: true, lo, hi, entryKeys: keys, primaryKey });
function cePanel(n) {
  return Array.from({ length: n }, (_, i) => ({ i, t: i * 300_000, h: 99, l: 97, c: 98, atrEng: 1, headingSign: 0, headingScore: 0,
    mtf1: mtf(-1), slots: [slot('R1', 100, 101, [7]), slot('S1', 90, 91, [8])], log: [], prev: { headingScore: 0 } }));
}

test('EV2 CE (Short): leg → E1 (distance ≤ 0.35 ATR or touch) → first E2 from the zone', () => {
  const p = cePanel(8);
  p[1].headingSign = 1;                                            // countertrend leg for D = −1
  for (let i = 2; i < 8; i++) p[i].headingSign = 1;
  p[3].c = 99.7; p[3].h = 99.8;                                    // 0.30 ATR from R1.lo → E1
  p[5].log = [{ k: 'test', key: 7, rej: 0.6, side: -1, inSlot: true, slotsBefore: [{ slot: 'R1', entry: true }] }];
  const r = extractCE(p);
  assert.equal(r.episodes[0].e1, 3);
  assert.deepEqual(r.events.map((e) => [e.t, e.D, e.age]), [[5, -1, 2]]);
  assert.deepEqual(r.rows.map((x) => [x.age, x.isEvent]), [[0, false], [1, false], [2, true]]);
});

test('EV2b CE: weak rejection, wrong side or foreign key is not E2; acceptance censors; conflict abstains', () => {
  const p = cePanel(7);
  for (let i = 1; i < 7; i++) p[i].headingSign = 1;
  p[1].h = 100.2;                                                   // touch → E1 at 1
  p[2].log = [{ k: 'test', key: 7, rej: 0.4, side: -1, inSlot: true }, { k: 'test', key: 7, rej: 0.9, side: 1, inSlot: true }, { k: 'test', key: 9, rej: 0.9, side: -1, inSlot: true }];
  p[3].log = [{ k: 'accepted', key: 7, dir: 1 }];
  const r = extractCE(p);
  assert.equal(r.events.length, 0);
  assert.equal(r.episodes[0].end, 'censored:accepted');
  const q = cePanel(4);
  for (let i = 1; i < 4; i++) q[i].headingSign = 1;
  q[1].h = 100.2;
  q[2].log = [{ k: 'accepted', key: 7, dir: 1 }, { k: 'test', key: 7, rej: 0.8, side: -1, inSlot: true }];
  const c = extractCE(q);
  assert.equal(c.events.length, 0);
  assert.equal(c.abstains[0].reason, 'ABSTAIN_CONFLICT');
});

test('EV2c CE: Macro H4 = H1 = D is required; the leg ends when heading returns to D', () => {
  const p = cePanel(5);
  for (let i = 1; i < 5; i++) p[i].headingSign = 1;
  for (const x of p) x.mtf1 = mtf(1);                              // route up: no Short CE
  assert.equal(extractCE(p).episodes.filter((e) => e.D === -1).length, 0);
  const q = cePanel(5);
  q[1].headingSign = 1; q[2].headingSign = -1; q[3].headingSign = 1;
  q[3].h = 100.5;                                                   // E1 would be here, but the leg ended at 2
  const r = extractCE(q);
  assert.equal(r.episodes[0].end, 'leg-end');
  assert.equal(r.episodes[0].e1, null);
});

test('EV3 zone events: H3 units, armed FLIP-1, FLIP-2 after the flip, H4 comparator needs everBreaking = false', () => {
  const p = Array.from({ length: 6 }, (_, i) => ({ i, t: i, atrEng: 1, log: [], prev: { slots: [slot('R1', 100, 101, [1, 2])] } }));
  const rec = (k, key, extra) => ({ k, key, slotsBefore: [{ slot: 'R1', entry: true }], ageNative: 10, epStartQ: 60, ...extra });
  p[1].log = [rec('test', 1, { rej: 0.7, side: -1, inSlot: true, state: ST.ACTIVE, everBreaking: false }), rec('test', 2, { rej: 0.5, side: -1, inSlot: true, state: ST.ACTIVE, everBreaking: true })];
  p[2].log = [rec('flip', 3, { dir: 1, rej: 0.8, armed: true }), rec('test', 3, { rej: 0.8, side: 1, inSlot: false, state: ST.FLIP })];
  p[3].log = [rec('flip', 4, { dir: -1, rej: 0.6, armed: false })];
  p[4].log = [rec('test', 3, { rej: 0.55, side: 1, inSlot: false, state: ST.FLIP })];
  p[5].log = [rec('test', 3, { rej: 0.9, side: 1, inSlot: false, state: ST.FLIP })];
  const z = extractZoneEvents(p);
  assert.deepEqual(z.h3.map((e) => [e.t, e.D, e.keys, e.members, e.width]), [[1, -1, [1, 2], 2, 1]]);
  assert.deepEqual(z.flip1.map((e) => [e.t, e.D, e.qBucket]), [[2, 1, '48-72']]);
  assert.equal(z.flip1Unarmed.length, 1);
  assert.deepEqual(z.flip2.map((e) => e.t), [4]);                  // first later rejection only
  assert.deepEqual(z.h4Comparator.map((e) => e.keys), [[1]]);        // key 2 had broken before
});

test('EV4 outcomes: R_h, MFE/MAE, side-aware C1/C2, censoring at the boundary', () => {
  const bars = [0, 1, 2, 3].map((k) => ({ bo: 100 + k, bh: 101 + k, bl: 99 + k, bc: 100.5 + k, ao: 100.2 + k, ac: 100.7 + k }));
  const L = outcome(bars, 0, 1, 2, 2);
  assert.equal(L.R, (102.5 - 101) / 2);
  assert.equal(L.mfe, (103 - 101) / 2);
  assert.ok(Math.abs(L.R_C1 - ((102.5 - 0.1) - (101 + 0.2 + 0.1)) / 2) < 1e-12);
  assert.ok(Math.abs(L.R_C2 - ((102.5 - 0.2) - (101 + 0.4 + 0.2)) / 2) < 1e-12);
  const S = outcome(bars, 0, -1, 2, 2);
  assert.ok(Math.abs(S.R_C1 - -((102.7 + 0.1) - (101 - 0.1)) / 2) < 1e-12);
  assert.equal(outcome(bars, 2, 1, 2, 1).censored, true);
  assert.equal(outcome(bars, 0, 1, 2, 1, { boundary: 1 }).censored, true);
  assert.equal(outcome([{ ...bars[0] }, { ...bars[1], ao: null }, bars[2]], 0, 1, 2, 1).C1_unavailable, true);
});

test('EV5 panel: an X value is used only once its bar has closed by close(t−1)', () => {
  const x = [{ t: 0 }, { t: 900_000 }, { t: 1_800_000 }];
  // targets: 899_999 (bar 0 not closed), 900_000 (bar 0 closed), 2_699_999 (bar 1 closed, bar 2 not)
  assert.deepEqual(lastClosedIndex([899_999, 900_000, 2_699_999], x, 900_000), [-1, 0, 1]);
  const rows = Array.from({ length: 6 }, (_, i) => ({ t: i * 300_000, headingSign: 0, routeSign: 0, slots: [], log: [] }));
  const m15 = [0, 1].map((k) => ({ t: k * 900_000, routeSign: k ? -1 : 1, headingSign: 0 }));
  const panel = buildPanel(rows, { M15: m15, H1: [], H4: [] });
  // close(t−1) = t·300_000; M15 bar 0 closes at 900_000 → first visible at t = 3; bar 1 at t = 6 (none here)
  assert.deepEqual(panel.map((p) => p.mtf1.M15.i), [-1, -1, -1, 0, 0, 0]);
});

test('EV6 trading day id rolls at 17:00 New York, DST included', () => {
  assert.equal(tradingDayId(Date.UTC(2026, 6, 15, 20, 59)), '2026-07-15');   // 16:59 EDT
  assert.equal(tradingDayId(Date.UTC(2026, 6, 15, 21, 0)), '2026-07-16');    // 17:00 EDT
  assert.equal(tradingDayId(Date.UTC(2026, 0, 15, 21, 30)), '2026-01-15');   // 16:30 EST
  assert.equal(tradingDayId(Date.UTC(2026, 0, 15, 22, 0)), '2026-01-16');    // 17:00 EST
});

// ---------- Causality Gate on the full pipeline ----------
const agg = (m1, sec) => {
  const out = [];
  for (const b of m1) {
    const t = Math.floor(b.t / (sec * 1000)) * sec * 1000, last = out[out.length - 1];
    if (last && last.t === t) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; last.v += b.v; }
    else out.push({ t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
};
const feedsOf = (m1) => ({ M5: agg(m1, 300), M15: agg(m1, 900), H1: agg(m1, 3600), H4: agg(m1, 14400), D: agg(m1, 86400), W: agg(m1, 604800) });
function m1Of(n, seed) {
  // XAU-like scale; the generator's own price path, volume from a fixed hash
  return marketBars(n, seed).map((b, i) => ({ t: b.t, o: b.o * 20, h: b.h * 20, l: b.l * 20, c: b.c * 20, v: 50 + ((i * 7919 + seed * 104729) % 97) }));
}
const strip = (o) => JSON.parse(JSON.stringify(o));
// 29 synthetic days give no routeSign_H4 (it needs 200 D bars), so the Macro families would be
// vacuous here: the gate also runs CE with the Macro disabled (TC without Macro is H5's base).
const withAny = (r) => Object.assign(r, { ceAny: extractCE(r.panel, { macro: () => true }) });
const before = (list, T) => strip(list.filter((e) => e.t < T));

function assertCausal(full, cut, T, label) {
  assert.deepEqual(strip(cut.panel.slice(0, T)), strip(full.panel.slice(0, T)), `${label}: panel rows`);
  for (const [name, get] of [
    ['TC-H1 rows', (r) => r.tcH1.rows], ['H5 events', (r) => r.h5.events], ['CE rows', (r) => r.ce.rows],
    ['CE rows (Macro off)', (r) => r.ceAny.rows], ['CE E3 (Macro off)', (r) => r.ceAny.e3], ['CE E4 (Macro off)', (r) => r.ceAny.e4], ['CE abstains (Macro off)', (r) => r.ceAny.abstains],
    ['H3', (r) => r.zone.h3], ['FLIP-1', (r) => r.zone.flip1], ['FLIP-2', (r) => r.zone.flip2], ['H4 comparator', (r) => r.zone.h4Comparator],
    ['P1', (r) => r.p1.events], ['P1-rejected', (r) => r.p1.p1Rejected], ['P2', (r) => r.p2.events],
  ]) assert.deepEqual(before(get(cut), T), before(get(full), T), `${label}: ${name}`);
}

const N = 42_000;
let FULL = null;
const run = (m1) => withAny(runEventPipeline(feedsOf(m1), { mintick: 0.01, w: 0.3 }));
const full = () => (FULL ??= (() => { const m1 = m1Of(N, 11); return { m1, r: run(m1) }; })());

test('CG0 the synthetic pipeline produces every event family (the gate is not vacuous)', () => {
  const { r } = full();
  const counts = { h5: r.h5.events.length, ceRows: r.ceAny.rows.length, ceEvents: r.ceAny.events.length, h3: r.zone.h3.length, flip1: r.zone.flip1.length + r.zone.flip1Unarmed.length, cmp: r.zone.h4Comparator.length, p1: r.p1.events.length, p2: r.p2.events.length };
  for (const [k, v] of Object.entries(counts)) assert.ok(v > 0, `${k} = 0 (${JSON.stringify(counts)})`);
});

test('CG1 future truncation invariant: cutting the data at bar T changes nothing before T', () => {
  const { m1, r } = full();
  for (const frac of [0.55, 0.8]) {
    // cut on an M5 boundary that is inside an open H1/H4 bar (partial HTF bars must never leak)
    let k = Math.floor(m1.length * frac);
    while (m1[k].t % 300_000 !== 0 || m1[k].t % 3_600_000 === 0) k++;
    const cut = run(m1.slice(0, k));
    const T = cut.panel.length;                                     // every M5 bar of the cut run is complete
    assert.ok(T > 1000);
    assertCausal(r, cut, T, `cut ${frac}`);
  }
});

test('CG2 future perturbation invariant: rewriting every bar after T changes nothing before T', () => {
  const { m1, r } = full();
  let k = Math.floor(m1.length * 0.7);
  while (m1[k].t % 300_000 !== 0) k++;
  const alt = m1.map((b, i) => (i < k ? b : { ...b, o: b.o * 1.03, h: b.h * 1.05, l: b.l * 1.01, c: b.c * 1.02, v: b.v * 3 }));
  const other = run(alt);
  const T = r.panel.findIndex((p) => p.t >= m1[k].t);
  assertCausal(r, other, T, 'perturbed');
  // and the perturbation did change the future (control)
  assert.notDeepEqual(strip(other.panel.slice(T, T + 50).map((p) => p.c)), strip(r.panel.slice(T, T + 50).map((p) => p.c)));
});

test('CG3 negative control: a deliberately leaky extractor (reads bar t+1) is caught by the gate', () => {
  const { m1, r } = full();
  let k = Math.floor(m1.length * 0.6);
  while (m1[k].t % 300_000 !== 0) k++;
  const cut = run(m1.slice(0, k));
  const leaky = (panel) => panel.flatMap((p, t) => (panel[t + 1] && panel[t + 1].c > p.c ? [{ t }] : []));
  const T = cut.panel.length;
  assert.throws(() => assert.deepEqual(before(leaky(cut.panel), T), before(leaky(r.panel), T)));
});
