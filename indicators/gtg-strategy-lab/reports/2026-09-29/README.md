# Real-data gates — 2026-09-29 (official Dukascopy M1, 2026-06-24 → 2026-09-28)

No event outcome, R, ATT or edge statistic is in these files: counts and data diagnostics only.

- **Data integrity** (`data/integrity.py`): **PASS** — 83 days, 94,828 M1 bars, 0 hard errors
  (G1–G5), 0 in-session gaps > 15 min, ASK coverage 100%, no missing weekday; 14 spikes flagged
  as diagnostics (not removed). Short days match the holiday early closes (2026-07-03: 1,019 bars;
  2026-09-07 Labor Day: 1,229).
- **Causality Gate** (`events/causality.mjs`): **PASS, non-vacuous** — future truncation at two
  cuts (inside open H1/H4 bars, HTF rebuilt from pre-cut M5 only) and future perturbation leave
  every row and event before the cut identical; required families fired (TC-H1 76 events, CE 12,
  FLIP-1 388, H3 1,086). These events lie before the §20 warm-up (70 D bars): they prove the code
  path is causal, not that the rows are research-valid.
- Feeds hash (`data/export_feeds.py`, calendar v0.2.2): `0871c14a…`.
