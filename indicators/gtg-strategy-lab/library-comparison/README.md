# GTG Lab — library comparison
Exploratory integration pilot, separated from frozen Navigator and v0.2.3 event study.

## What is reused
- Existing GTG Lab: store reader, BID/ASK data, session calendar and aggregation.
- STUMPY: MASS subsequence distance, restricted to the past Jan-Feb bank.
- tslearn: DTW reranking of independent shape candidates.
- Kronos: upstream inference implementation and pretrained mini/tokenizer weights, pinned revisions.
- Original glue: online directional-change confirmation state, safe data window, causal adapters, shared scoring and reporting.

No full backtesting framework migration. No pretrained model is claimed to provide a verified edge.
The seven-year dataset is not reread wholesale. This pilot is restricted to Jan-Mar 2022 inside existing Train.

## Reproduce on the current Windows device
Repository worktree: C:\Users\alk\gtg-lab-library-comparison
Canonical data: C:\Users\alk\gtg-lab-data-jforex

1. Use a dedicated Python 3.12 virtual environment.
2. Install requirements-lock.txt; CPU torch wheels require https://download.pytorch.org/whl/cpu as an additional package index.
3. Clone https://github.com/shiyu-coder/Kronos.git outside tracked source to .research-vendor/Kronos and checkout 67b630e67f6a18c9e9be918d9b4337c960db1e9a.
4. Run test_compare.py with the virtual environment Python.
5. Run compare.py --root C:\Users\alk\gtg-lab-data-jforex --out <NEW-output-directory> --vendor C:\Users\alk\gtg-lab-library-comparison\.research-vendor\Kronos

The output directory must be new. Existing reports are never overwritten.
Hugging Face is used only to download public model files; market data is not uploaded.
The run records source-file hashes, model revisions, environment versions and per-anchor predictions.

## Scope and interpretation
See PROTOCOL.md committed before data analysis.
Scalp: M5 to 15-minute horizon. Swing: H1 to 4-hour horizon.
These are research proxies, not complete deployed scalp/swing strategies.
March is a development probe within Train, not official Validation/Holdout.
Kronos may have seen these dates during pretraining; its row is integration evidence only.
Do not tune to these 24 anchors, claim profitability, open Holdout, or modify the original protocol based on this pilot.
Cold JIT/setup timings are not latency benchmarks.
Neighbor outcome median is an empirical forecast, not a calibrated probability.
Close-only directional changes intentionally ignore intrabar event ordering.
Partial aggregates are discarded; feature windows may span scheduled closures.

## Upstream sources and licenses
Dependencies remain separately installed; no third-party source is copied into GTG.
- STUMPY: https://github.com/stumpy-dev/stumpy
- tslearn: https://github.com/tslearn-team/tslearn
- Kronos: https://github.com/shiyu-coder/Kronos (repository MIT; keep upstream notices with any redistribution)
The frozen lock records the actual versions used. Model snapshots/revisions are recorded in each successful run.
