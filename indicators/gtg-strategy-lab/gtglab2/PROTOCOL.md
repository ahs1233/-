# GTGLab2 — Recording and Research Protocol

## 1. Every action leaves a record

For every meaningful action:
1. append an event to `EVENTS.jsonl`,
2. add a human-readable entry to `WORKLOG.md`,
3. update `CURRENT_STATE.md` if the state changed,
4. update `DECISIONS.md` if a decision changed,
5. update `EXPERIMENTS.md` if an experiment was run,
6. commit the documentation with the related code whenever practical.

## 2. Never erase failed research

A failed hypothesis remains in the record with:
- hypothesis,
- data interval,
- method,
- metrics,
- verdict,
- reason for closure.

Do not silently recycle a failed candidate under a new name.

## 3. Research locks

Do not:
- open Historical Holdout early,
- decode Pristine Price OOS before protocol permits it,
- tune microstructure features after seeing their future outcomes,
- change success criteria after seeing results,
- backfill missing forward microstructure as if it had been observed live.

Collection gaps must be recorded as gaps.

## 4. Baseline vs treatment

Future microstructure testing must compare:
- baseline: State Engine / registered strategy without microstructure,
- treatment: same baseline plus registered microstructure evidence.

The research question is incremental value, not whether a feature can be made to correlate with the past.

## 5. Time dependence

Minute snapshots are temporally correlated.

Future inference must use:
- time blocks,
- transition episodes,
- purged/walk-forward splits,
- clustered or block-bootstrap uncertainty when appropriate.

Rows must not be treated as IID observations.

## 6. Project boundaries

GTGLab2 is the research/trading-system laboratory.

GTG Navigator Pine indicator is separate unless an explicit integration decision is recorded.

## 7. Canonical name

From 2026-10-04 onward this track is called **GTGLab2**.
