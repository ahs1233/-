// Structure Discovery v0.1 — Pilot on Train-only data.
// Runs structure analysis on M5 (Scalper) and H4 (Swing), outputs concrete examples.
//   node structure/pilot.mjs <feeds_json> <output_json>
import { readFileSync, writeFileSync } from 'node:fs';
import { structureAnalysis } from './segmentation.mjs';

const iso = (t) => new Date(t).toISOString();
const fmt = (x, d = 2) => typeof x === 'number' ? Math.round(x * 10 ** d) / 10 ** d : x;

function sessionOf(t) {
  const d = new Date(t);
  const utcH = d.getUTCHours();
  if (utcH >= 13 && utcH < 21) return 'NY';
  if (utcH >= 7 && utcH < 16) return 'LON';
  if (utcH >= 0 && utcH < 8) return 'ASIA';
  return 'OFF';
}

function windowExamples(legs, bars, label, windowStart, windowEnd) {
  const inWindow = legs.filter((l) => l.from.time >= windowStart && l.to.time <= windowEnd);
  if (!inWindow.length) return null;
  return {
    label,
    window: { from: iso(windowStart), to: iso(windowEnd) },
    legCount: inWindow.length,
    legs: inWindow.map((l) => ({
      id: l.id,
      type: l.type,
      structureEvent: l.structureEvent || null,
      direction: l.direction > 0 ? 'BULL' : 'BEAR',
      from: { time: iso(l.from.time), price: fmt(l.from.price), label: l.from.label },
      to: { time: iso(l.to.time), price: fmt(l.to.price), label: l.to.label },
      distanceAtr: fmt(l.distanceAtr),
      duration: l.duration + ' bars',
      durationHours: fmt(l.durationMs / 3_600_000, 1),
      retracement: fmt(l.retracement * 100, 1) + '%',
      pathEfficiency: fmt(l.pathEfficiency),
      velocity: fmt(l.velocity, 3),
      mfe: fmt(l.mfe) + ' ATR',
      mae: fmt(l.mae) + ' ATR',
      atrStart: fmt(l.atrStart),
      atrEnd: fmt(l.atrEnd),
      atrChange: fmt(l.atrChange * 100, 1) + '%',
      session: sessionOf(l.from.time),
    })),
    summary: {
      types: Object.fromEntries([...new Set(inWindow.map((l) => l.type))].map((t) => [t, inWindow.filter((l) => l.type === t).length])),
      avgDistanceAtr: fmt(inWindow.reduce((a, l) => a + l.distanceAtr, 0) / inWindow.length),
      avgPathEfficiency: fmt(inWindow.reduce((a, l) => a + l.pathEfficiency, 0) / inWindow.length),
      avgDurationBars: Math.round(inWindow.reduce((a, l) => a + l.duration, 0) / inWindow.length),
      structureEvents: inWindow.filter((l) => l.structureEvent).map((l) => ({ bar: l.to.bar, type: l.structureEvent, at: iso(l.to.time), price: fmt(l.to.price) })),
    },
  };
}

function globalStats(legs) {
  const types = {};
  let totalDist = 0, totalEff = 0, totalDur = 0;
  for (const l of legs) {
    types[l.type] = (types[l.type] || 0) + 1;
    totalDist += l.distanceAtr;
    totalEff += l.pathEfficiency;
    totalDur += l.duration;
  }
  const n = legs.length || 1;
  return {
    totalLegs: legs.length,
    typeDistribution: types,
    avgDistanceAtr: fmt(totalDist / n),
    avgPathEfficiency: fmt(totalEff / n),
    avgDurationBars: Math.round(totalDur / n),
    structureBreaks: legs.filter((l) => l.structureEvent === 'CHoCH').length,
    continuations: legs.filter((l) => l.structureEvent === 'BOS').length,
  };
}

if (process.argv[1]?.endsWith('pilot.mjs')) {
  const [, , inp, out] = process.argv;
  if (!inp) { console.error('Usage: node pilot.mjs <feeds.json> <output.json>'); process.exit(1); }

  console.log('Loading feeds...');
  const doc = JSON.parse(readFileSync(inp, 'utf8'));
  const parse = (v) => v.map(([t, o, h, l, c, vol]) => ({ t, o, h, l, c, v: vol }));
  const feeds = Object.fromEntries(Object.entries(doc.feeds).map(([k, v]) => [k, parse(v)]));

  // --- Scalper Brain (M5) ---
  console.log(`M5: ${feeds.M5.length} bars`);
  const m5 = structureAnalysis(feeds.M5, { atrLen: 14, threshold: 1.0 });
  console.log(`M5 swings: ${m5.swings.length}, legs: ${m5.legs.length}`);

  // Scalper example windows (specific weeks with interesting structure)
  const scalperExamples = [
    // Gold rally week March 2022 (Ukraine invasion aftermath)
    windowExamples(m5.legs, feeds.M5, 'Scalper: Impulse Rally (Mar 2022)',
      Date.parse('2022-03-07T00:00:00Z'), Date.parse('2022-03-11T23:59:59Z')),
    // Range-bound week Aug 2023
    windowExamples(m5.legs, feeds.M5, 'Scalper: Range Consolidation (Aug 2023)',
      Date.parse('2023-08-14T00:00:00Z'), Date.parse('2023-08-18T23:59:59Z')),
    // Breakout week Oct 2023
    windowExamples(m5.legs, feeds.M5, 'Scalper: Breakout & Expansion (Oct 2023)',
      Date.parse('2023-10-23T00:00:00Z'), Date.parse('2023-10-27T23:59:59Z')),
    // Trend day Feb 2024
    windowExamples(m5.legs, feeds.M5, 'Scalper: Trend Day (Feb 2024)',
      Date.parse('2024-02-12T00:00:00Z'), Date.parse('2024-02-16T23:59:59Z')),
    // Reversal week Dec 2023
    windowExamples(m5.legs, feeds.M5, 'Scalper: Reversal Structure (Dec 2023)',
      Date.parse('2023-12-04T00:00:00Z'), Date.parse('2023-12-08T23:59:59Z')),
  ].filter(Boolean);

  // --- Swing Brain (H4) ---
  console.log(`H4: ${feeds.H4.length} bars`);
  const h4 = structureAnalysis(feeds.H4, { atrLen: 14, threshold: 1.5 });
  console.log(`H4 swings: ${h4.swings.length}, legs: ${h4.legs.length}`);

  // Swing example windows (multi-month periods)
  const swingExamples = [
    // 2022 Q1: Major rally
    windowExamples(h4.legs, feeds.H4, 'Swing: War Rally & Reversal (Q1-Q2 2022)',
      Date.parse('2022-01-01T00:00:00Z'), Date.parse('2022-07-01T00:00:00Z')),
    // 2022 Q4 - 2023 Q1: Bottom and recovery
    windowExamples(h4.legs, feeds.H4, 'Swing: Bottom Formation & Recovery (Q4 2022 - Q1 2023)',
      Date.parse('2022-09-01T00:00:00Z'), Date.parse('2023-04-01T00:00:00Z')),
    // 2023 Q4: Major rally
    windowExamples(h4.legs, feeds.H4, 'Swing: Oct-Dec 2023 Rally',
      Date.parse('2023-09-01T00:00:00Z'), Date.parse('2024-01-01T00:00:00Z')),
    // 2024 Q1: continuation into Train end
    windowExamples(h4.legs, feeds.H4, 'Swing: 2024 Q1 Continuation',
      Date.parse('2024-01-01T00:00:00Z'), Date.parse('2024-03-21T00:00:00Z')),
  ].filter(Boolean);

  // --- H1 for intermediate context ---
  console.log(`H1: ${feeds.H1.length} bars`);
  const h1 = structureAnalysis(feeds.H1, { atrLen: 14, threshold: 1.2 });
  console.log(`H1 swings: ${h1.swings.length}, legs: ${h1.legs.length}`);

  // --- D for macro context ---
  let dResult = null;
  if (feeds.D && feeds.D.length > 30) {
    console.log(`D: ${feeds.D.length} bars`);
    dResult = structureAnalysis(feeds.D, { atrLen: 14, threshold: 2.0 });
    console.log(`D swings: ${dResult.swings.length}, legs: ${dResult.legs.length}`);
  }

  // --- Build Report ---
  const report = {
    version: 'Structure Discovery v0.1',
    dataSource: 'JForex IHistory BID, XAUUSD, Train-only (2018-03-01 to 2024-03-20)',
    feedsSha256: doc.meta?.feeds_sha256,
    parameters: {
      M5: { atrLen: 14, threshold: 1.0 },
      H1: { atrLen: 14, threshold: 1.2 },
      H4: { atrLen: 14, threshold: 1.5 },
      D: { atrLen: 14, threshold: 2.0 },
    },
    globalStats: {
      M5: globalStats(m5.legs),
      H1: globalStats(h1.legs),
      H4: globalStats(h4.legs),
      D: dResult ? globalStats(dResult.legs) : null,
    },
    scalperExamples,
    swingExamples,
    gtgComponentUsage: {
      reused: [
        'pine-ta.mjs: ATR(14) Wilder smoothing — same ATR used in zone engine and sensors',
        'pine-ta.mjs: EMA — same MA implementation as sensors.mjs (ma14/22/50/200/1000)',
        'zone-engine.mjs: pivot detection concept (pivotLen=3) — we generalize with ATR-threshold zigzag',
        'zone-engine.mjs: DOZ path efficiency (legEff=0.55) — we reuse 0.55 for impulse classification',
        'cem.mjs: sessionBin(t) — same session classification (NY/LON/ASIA/OFF)',
        'sensors.mjs: heading/route scores — available for HTF context overlay',
        'sensors.mjs: fuel/speed scores — available for volume/velocity overlay',
        'outcomes.mjs: MFE/MAE calculation — we compute equivalent per-leg MFE/MAE',
      ],
      newComponents: [
        'ATR-threshold zigzag swing detection (replaces fixed-lookback pivotLen)',
        'HH/HL/LH/LL classification per swing point',
        'BOS (Break of Structure) and CHoCH (Change of Character) detection',
        'Leg type classification: impulse/pullback/correction/reversal/range/choppy',
        'Per-leg metadata: retracement%, path efficiency, velocity, acceleration',
        'Compression/expansion detection via ATR ratio',
        'Multi-TF structural alignment (Scalper M5 + Swing H4/D)',
        'Path outcome measurement framework (v0.2: target/invalidation first-exit)',
      ],
    },
    causalSpec: {
      exPost: 'Swing points use future bars for confirmation (ground truth labeling). A swing high at bar i is placed at the exact extreme, even though it was not knowable until confirmBar j. Ex-post segmentation is ONLY for building the Structure Atlas and training labels.',
      online: 'Online mode uses confirmBar: a swing is not visible to the engine until the reversal threshold is met. All downstream analysis (leg type, trend state, BOS/CHoCH) is gated by confirmBar. No bar before confirmBar may use this swing point. This ensures zero lookahead.',
      confirmDelay: 'The confirmation delay is inherent to the threshold: a 1.0 ATR threshold on M5 means the swing is known ~1 ATR after the extreme. Smaller thresholds detect faster but produce more noise; larger thresholds are more robust but introduce lag.',
    },
  };

  writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(`Report written to ${out}`);
  console.log('\n--- Global Stats ---');
  for (const tf of ['M5', 'H1', 'H4', 'D']) {
    const s = report.globalStats[tf];
    if (!s) continue;
    console.log(`${tf}: ${s.totalLegs} legs | avg ${s.avgDistanceAtr} ATR | eff ${s.avgPathEfficiency} | ${s.avgDurationBars} bars/leg | CHoCH: ${s.structureBreaks} | BOS: ${s.continuations}`);
    console.log(`  types: ${JSON.stringify(s.typeDistribution)}`);
  }
}
