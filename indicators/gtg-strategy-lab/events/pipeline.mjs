// Event pipeline: Measurement Engine rows per timeframe → the M5 panel → every event family.
// Inputs are bars as the data layer delivers them (calendar of §2.2); nothing here aggregates.
//   feeds = { M5, M15, H1, H4, D, W }: arrays of { t, o, h, l, c, v } (BID; t = bar open, ms)
import { runTimeframe } from '../engine/measure.mjs';
import { profileFor, zoneParams } from '../engine/profiles.mjs';
import { DEFAULTS } from '../engine/pinecmp/zone-engine.mjs';
import { buildPanel } from './panel.mjs';
import { extractTC, extractH5 } from './tc.mjs';
import { extractCE } from './ce.mjs';
import { extractZoneEvents } from './zone.mjs';
import { extractP0, extractP1, extractP2 } from './comparators.mjs';

// route HTF / A1 / A2 per timeframe (profiles.mjs): M5 → H1/M15/H1, M15 → H1/H1/H4, H1 → H4/H4/D, H4 → D/D/W
const INPUTS_OF = { M5: ['H1', 'M15', 'H1'], M15: ['H1', 'H1', 'H4'], H1: ['H4', 'H4', 'D'], H4: ['D', 'D', 'W'] };

export function runRows(tf, feeds, mintick) {
  const [htf, a1, a2] = INPUTS_OF[tf];
  return runTimeframe({ tf, bars: feeds[tf], htfBars: feeds[htf], a1Bars: feeds[a1], a2Bars: feeds[a2], mintick }).rows;
}

export function runEventPipeline(feeds, { mintick, w }) {
  const rows = runRows('M5', feeds, mintick);
  const mtf = { M15: runRows('M15', feeds, mintick), H1: runRows('H1', feeds, mintick), H4: runRows('H4', feeds, mintick) };
  const panel = buildPanel(rows, mtf, { tf: 'M5' });
  const P = zoneParams(DEFAULTS, profileFor('M5'), mintick);
  const gtgSlotKeys = panel.map((p) => p.slots.filter((s) => s.active).flatMap((s) => s.entryKeys));
  return {
    panel,
    tcH1: extractTC(panel, { macro: 'H1' }),
    h5: extractH5(panel),
    ce: extractCE(panel),
    zone: extractZoneEvents(panel),
    p1: extractP1(feeds.M5, P, { w, gtgSlotKeys }),
    p2: extractP2(feeds.M5, P, { w }),
    p0: extractP0(feeds.M5, panel, P),
  };
}
