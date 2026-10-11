# GTG Strategy Lab — Frozen Baseline

This baseline is immutable for Strategy Lab comparisons.

- Production release: GTG Navigator v0.4.7
- Final HEAD: `0a77819d7a4bf29fe64a07b2233109707a10ca8b` (committed 2026-09-29T04:53:27Z)
- Final Pine blob: `0c7cbe366668fba20c9bc128448f908ce9314041`
- Source: `indicators/gtg-navigator/gtg_navigator_v0.4.7.pine`
- Frozen copy: `indicators/gtg-strategy-lab/baseline/gtg_navigator_v0.4.7_FINAL_FROZEN.pine`
- Lines: 2619 (checked with `wc -l` against the frozen copy; the earlier value "7" was wrong)
- Blob check: `git hash-object` on the source and on the frozen copy both give `0c7cbe36…`
- Release verdict: FINAL RELEASE VERIFIED
- Test baseline: 116/116 (`node --test indicators/gtg-navigator/reference/*.test.mjs`, re-run 2026-09-29 before the Trade Contract freeze: 116 pass, 0 fail)
- Rule: do not modify this frozen file. Build experiments beside it and compare against it.
