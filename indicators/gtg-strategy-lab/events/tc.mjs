// TC episodes and the E4-TC event (TRADE_CONTRACT §9.1, §10, §11.1, §11.5, §12.2).
//
//   start s   headingSign[s−1] = D and headingSign[s] ≠ D, while Macro holds (evaluated on
//             the values at s−1, §7). Age 0 at s; the episode cannot fire at s.
//   open t    Macro holds (values at t−1) and age = t − s ≤ headingEffLen(M5) = 10.
//   event     the first t with headingSign[t] = D (one trigger per episode).
//   censored  Macro fails or age exceeds 10 before a trigger; its bars stay controls.
// Risk-set rows (§12.2): one row per open episode per bar, age ≥ 1. isEvent marks the
// trigger; a control is an open episode with no trigger at that bar, whatever it does later.
// Nothing here reads a bar after t.
export const TC_MAX_AGE = 10; // headingEffLen(M5) (§4)

export const MACRO = Object.freeze({
  // H1: routeSign_H4 = routeSign_H1 = routeSign_M15 = D at t−1 (MTF-Route)
  H1: (p, D) => p.mtf1.H4.routeSign === D && p.mtf1.H1.routeSign === D && p.mtf1.M15.routeSign === D,
  // H5 base population: Single-TF TC, no Macro condition
  none: () => true,
});

// H5 treatment: headingSign_M15 = headingSign_H1 = headingSign_H4 = D at t−1 (MTF-Heading)
export const mtfHeadingAligned = (p, D) => p.mtf1.M15.headingSign === D && p.mtf1.H1.headingSign === D && p.mtf1.H4.headingSign === D;

export function extractTC(panel, { macro = 'H1', maxAge = TC_MAX_AGE, family = macro === 'H1' ? 'TC-H1' : 'TC-single' } = {}) {
  const ok = MACRO[macro];
  if (!ok) throw new Error(`unknown Macro ${macro}`);
  const rows = [], episodes = [];
  const open = new Map(); // D → episode
  for (let t = 1; t < panel.length; t++) {
    const p = panel[t], hs = p.headingSign;
    for (const [D, ep] of open) {
      const age = t - ep.s;
      let end = null;
      if (!ok(p, D)) end = 'censored:macro';
      else if (age > maxAge) end = 'censored:age';
      else {
        const fire = hs === D;
        rows.push({ family, t, time: p.t, D, episode: ep.id, age, isEvent: fire });
        if (fire) { end = 'event'; ep.eventT = t; }
      }
      if (end) { ep.end = end; ep.endT = t; open.delete(D); }
    }
    const hsPrev = panel[t - 1].headingSign;
    for (const D of [1, -1]) {
      if (hsPrev === D && hs !== D && !open.has(D) && ok(p, D)) {
        const ep = { id: `${family}:${t}:${D}`, family, s: t, D, end: null, endT: null, eventT: null };
        open.set(D, ep); episodes.push(ep);
      }
    }
  }
  for (const ep of open.values()) ep.end = 'open-at-end';
  return { rows, episodes, events: rows.filter((r) => r.isEvent) };
}

// H5: the Single-TF TC events, split by MTF-Heading alignment at t−1 (treated vs not).
export function extractH5(panel) {
  const { events, episodes } = extractTC(panel, { macro: 'none', family: 'TC-single' });
  return { episodes, events: events.map((e) => ({ ...e, family: 'H5', treated: mtfHeadingAligned(panel[e.t], e.D) })) };
}
