# GTGLab2 — Historical Clean Stage 1 v0.1

Status: TRAIN REPRODUCED / VALIDATION OPENED ONCE / HISTORICAL HOLDOUT SEALED
Date: 2026-10-04

## Clean snapshot

- snapshot id: `GTGLAB2-HIST-CLEAN-V1`
- root: `C:\Users\alk\gtg-lab-data-historical-clean-v1`
- source: Dukascopy JForex API/IHistory
- days/files: 2,672
- compressed bytes: 91,025,473
- range: 2018-03-01 through T_FREEZE on 2026-09-30
- source manifest SHA256: `ced0c8a3f0c1066e7379ac5783d1d8cfadfb71bbbdbe067c5b833acef0a7e649`
- clean manifest SHA256: `d99c2dfc73292d27ad6e4a9fdadf9e285ad27f139c52c0b540ac66c8087a1c16`
- all 2,672 copied files verified against their registered SHA256 before copy
- copied files are read-only
- no Pristine OOS is included

## Stage 1 structure

Two parallel tracks are now explicit:

### A. Clean Historical Track
Immutable data snapshot used for reproducible strategy evaluation.

Authoritative split:
- first valid: 2021-09-08T17:00:00Z
- Train end: 2024-03-20T15:20:24.500Z
- Validation start: 2024-03-20T19:20:24.500Z
- Validation end: 2025-03-25T01:04:34.300Z
- Historical Holdout start: 2025-03-25T05:04:34.300Z
- Historical Holdout remains sealed.

### B. Development Track
Existing working data/code path remains active for strategy development and forward collection.
Changes made after this Validation run create a new candidate version; this Validation cannot be reused as fresh confirmation for a modified candidate.

## Train reproducibility

State Engine v0.2 was rebuilt from the clean snapshot.

Result:
- all sanity screens PASS
- RANGE occupancy ~55.13%
- TRANSITION ~6.93%
- TREND_UP ~20.55%
- TREND_DOWN ~17.39%
- primary range-transition events: 456

Sweep/Acceptance strategy was rerun on clean Train.

Reproducibility:
- old and clean episode tables: 6,252 rows each
- columns identical
- DataFrame equality: TRUE
- maximum absolute numeric difference: 0.0

This proves the clean snapshot reproduces the prior Train result.

## Validation hard gate

Before Validation outcomes:
- protocol committed at `1f9edcc`
- raw read capped at 2025-03-25T01:00:00Z
- Train state prefix parity: PASS
- rows compared: 34,816
- max continuous float difference: 3.55e-15
- Historical Holdout read: FALSE
- Pristine OOS decoded: FALSE
- microstructure outcomes read: FALSE

Validation episodes:
- BASE: 109
- CONTEXT: 75

## Validation result

### Full BASE, C1
Single:
- mean: -0.1473R/trade

Staged:
- mean: +0.0056R/trade
- but mean PnL per used R remains negative

The complete mixed strategy is therefore not validated as a single combined system.

### Acceptance -> Retest with Context

This is the surviving Swing research path.

C1:
- SINGLE: n=40, mean +0.7283R, total +29.13R
- STAGED: n=40, mean +0.4002R, total +16.01R

C2:
- SINGLE: n=40, mean +0.6906R, total +27.62R
- STAGED: n=40, mean +0.3714R, total +14.86R

C2 SINGLE direction split:
- LONG: n=31, mean +0.7259R
- SHORT: n=9, mean +0.5692R

C2 SINGLE time split:
- Validation early: n=24, mean +0.7519R
- Validation late: n=16, mean +0.5987R

Robustness, C2 SINGLE:
- profit factor ~1.99
- average win +3.47R
- average loss -1.16R
- median -0.64R
- win rate 40%
- drop largest winner: mean remains +0.55R
- drop top 3 winners: mean remains +0.27R

Interpretation:
- the mean edge is not explained by one trade,
- the payoff is strongly positively skewed,
- the negative median means most trades still lose,
- SHORT evidence is positive but small-sample,
- this is promising historical Validation evidence, not final proof.

### Rejection / Range Fade
Remains negative in Validation and stays non-promotable.

## Current decision

1. Continue development around Swing Acceptance -> Retest -> Continuation.
2. Keep Rejection/Scalper as a reference/diagnostic track, not a promotion candidate.
3. Improve staged construction on Train; current SINGLE implementation has stronger validation expectancy.
4. Do not reopen or use Historical Holdout yet.
5. Keep live/forward collection running blind in parallel.
6. Stage 2 live strategy execution remains blocked until Stage 1 is completed and a final historical candidate is frozen.
