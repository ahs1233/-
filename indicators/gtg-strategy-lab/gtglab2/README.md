# GTGLab2

GTGLab2 is the canonical research track for the current gold-trading laboratory.

## Identity

- Project name: **GTGLab2**
- Git branch: `research/gtglab2`
- Asset focus: XAU / gold
- Architecture: **State → Transition → Strategy**
- Execution tracks: **Swing** and **Scalper**
- Current phase: forward evidence collection and research hardening
- GTG Navigator Pine indicator is a separate project and must not be mixed with GTGLab2.

## Core principle

GTGLab2 does not treat trading as raw next-price prediction.

The system must first understand:
1. current market state,
2. whether a transition is occurring,
3. which strategy is permitted by that state,
4. whether timing evidence is strong enough to enter.

## Canonical documentation

This directory is the permanent guide for the project.

- `CURRENT_STATE.md` — current operational/research state.
- `HISTORY_BASELINE.md` — inherited GTGLab history that GTGLab2 starts from.
- `WORKLOG.md` — chronological work performed.
- `DECISIONS.md` — decisions and why they were made.
- `EXPERIMENTS.md` — experiments, results, failures, and verdicts.
- `PROTOCOL.md` — rules that protect research validity.
- `BLOCKERS.md` — prioritized blockers, why they matter, and the condition to close each one.
- `ULTRA_PLAN_V01.md` — active gated implementation roadmap.
- `ARTIFACT_INDEX.md` — map to important code/data/protocol artifacts.
- `EVENTS.jsonl` — append-only machine-readable event ledger.
- `tools/record_event.py` — helper for recording future work.

## Documentation rule

Every meaningful GTGLab2 action must leave evidence.

At minimum, record:
- timestamp,
- action,
- reason,
- result,
- affected files/systems,
- tests or verification,
- commit when available.

Failures are retained. They are evidence, not deleted history.

## Research locks

Until explicitly unlocked by registered protocol:
- Historical Holdout remains locked.
- Pristine Price OOS remains undecoded.
- Microstructure must not be tuned against known future trading outcomes.

## Active implementation

Phase 1 foundation lives under `engine/` and starts the bidirectional Long/Short architecture, timeframe roles, inherited session compatibility, and causal moving-average geometry.
