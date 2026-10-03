# Event Library v0.2 — preregistered Train-only replication

Registered 2026-10-03 before reading/scoring any price outside the completed Jan-Mar 2022 pilot.
Purpose: test whether event-conditioned historical pattern retrieval generalizes across a much larger Train-only period without changing the pilot thresholds/horizons to fit its outcomes.

- Parent evidence: pilot-002 at commit a67cbb7. Pilot outcomes may motivate compute allocation, but no threshold, horizon, context length, K, DTW radius, cost formula, or direction rule is tuned here.
- Data: canonical JForex BID/ASK M1 only.
- Absolute read gate: 2018-03-01 <= date < 2024-03-20. This ends before the frozen Train boundary and never reads Validation/Holdout.
- Fixed historical bank: 2018-03-01 <= t < 2022-01-01.
- Probe: 2022-04-01 <= t < 2024-03-20. Jan-Mar 2022 is a deliberate gap because March was already inspected in pilot-002.
- Tracks unchanged: scalp M5 / h=3 / DC=0.001; swing H1 / h=4 / DC=0.005.
- Context unchanged: 96 closed bars. ATR unchanged: simple rolling 14-bar true range.
- Probe anchors: 120 deterministic, evenly spaced eligible anchors per track, selected from timestamps/availability only; no returns or labels used for selection. Future horizon must be contiguous and anchor outcome windows must not overlap.
- Candidate event = a causal Directional Change confirmation bar only, with 96-bar context and fully matured h-bar label.
- Direction filter: candidate confirmed direction must equal query DC direction.
- Shape representation: individually z-normalized 96-bar log-close windows.
- Stage 1 retrieval: scikit-learn NearestNeighbors, Euclidean distance, deterministic brute-force, retrieve up to 200 nearest event windows.
- Independence filter: retain at most 20 candidates separated by >=96 bars from each other.
- Stage 2 rerank: tslearn DTW, Sakoe-Chiba radius=4; prediction = median future displacement/ATR of best 5. Fewer than 5 independent candidates => abstain.
- Variants registered before probe read:
  1. event_fixed: candidates only from the fixed 2018-2021 bank.
  2. event_expanding: fixed bank plus eligible event candidates strictly before the query whose labels are fully matured before the query.
- Baselines unchanged: flat, last-12-bar drift extrapolated h/12, confirmed DC direction times h/12.
- Execution/costs unchanged from v0.1: hypothetical entry at open t+1 and fixed-horizon exit; C0/C1/C2 formulas identical.
- Kronos is not rerun in v0.2: pilot integration is already proven, pretraining contamination is unknown, and this phase tests the event-library hypothesis rather than pretrained-model inference.
- Metrics: MAE ATR, active coverage, directional accuracy, C0/C1/C2 mean ATR/opportunity and C1/trade, win rate. Report all candidates.
- Safety tests before full run: date gate; prefix-causal DC; event confirmation not backdated; fixed-bank bounds; expanding-bank maturity/no-future; independent-neighbor spacing; complete aggregation; side-aware cost arithmetic.
- No Validation/Holdout opening, no profitability claim, no parameter tuning after seeing probe outcomes.
- Acceptance: reproducible run, safety checks PASS, complete saved predictions/manifests/environment. Any economic result remains Train-development evidence only.
