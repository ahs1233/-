# GTG Navigator — Mandatory OpenAI/Codex Agent Instructions

Before any TradingView validation, browser automation, Pine runtime verification, Data Window/Table View extraction, or performance measurement:

1. Read `validation/TRADINGVIEW_EXECUTION_RUNBOOK.md` completely.
2. Treat that runbook as a hard execution contract.
3. Microsoft Edge is forbidden for this project unless Ahmed explicitly changes the rule.
4. TradingView must run in one browser only; current allowed browser is Google Chrome.
5. Never start validation before the runbook Preflight Gate is PASS.
6. Never repeat the same failed interaction method a third time.
7. Record every new failure in the runbook with symptom, cause, fix, and prevention before continuing.
8. Do not rerun completed evidence without a concrete technical reason.
9. Keep TradingView runtime evidence distinct from reference tests, CI, and static analysis.

If the environment becomes ambiguous, stop and restore preflight. Do not improvise on a contaminated UI state.
