// Strong Obstacle alert contract (review item R4), as a small reference state machine.
//
// Event = entering, on a confirmed close, the state Strong+Near for a specific obstacle.
//   qualifying = available AND strength >= strongQ AND distAtr <= nearObstacleAtr (inclusive)
//   identity   = dest1's slot entryKeys. Two observations are the same obstacle iff their
//                entry-key sets intersect. entryKeys is the engine's own slot identity
//                (Q_stay privilege): a held zone keeps old entry keys ∩ live members, so the
//                token survives primary churn and R1/S1 relabelling; a zone entered afresh
//                takes all its member keys. primaryKey alone is NOT used (fixture O2).
//   event      = qualifying AND (previous confirmed bar not qualifying OR different obstacle)
//   latch      = { state, keys } of the last confirmed bar; unconfirmed executions neither
//                fire nor move the latch.
export const newObstacleLatch = () => ({ state: false, keys: [] });

export function isQualifying(obs, P) {
  return !!obs.available && obs.strength != null && obs.distAtr != null && obs.strength >= P.strongQ && obs.distAtr <= P.nearObstacleAtr;
}

export const sameObstacle = (prevKeys, keys) => prevKeys.some((k) => keys.includes(k));

// obs: { confirmed, available, strength, distAtr, entryKeys }
export function strongObstacleStep(latch, obs, P) {
  if (!obs.confirmed) return { event: false, latch };
  const q = isQualifying(obs, P);
  const event = q && (!latch.state || !sameObstacle(latch.keys, obs.entryKeys));
  return { event, latch: { state: q, keys: q ? [...obs.entryKeys] : [] } };
}

// Baseline rule (pine:2288 at cdf1a8a…aaefe4d), kept only as a negative control:
// nearStrongObstacle = confirmed and strong and dist <= near and (na(dist[1]) or dist[1] > near)
export function baselineStrongObstacle(prevDistAtr, obs, P) {
  return !!obs.confirmed && obs.available && obs.strength >= P.strongQ && obs.distAtr != null && obs.distAtr <= P.nearObstacleAtr
    && (prevDistAtr == null || prevDistAtr > P.nearObstacleAtr);
}

export const OBSTACLE_DEFAULTS = Object.freeze({ strongQ: 72, nearObstacleAtr: 0.35 });
