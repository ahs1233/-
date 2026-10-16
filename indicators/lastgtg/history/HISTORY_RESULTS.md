# lastgtg historical green-light test 2025–2026 — results

Run 2026-10-14 01:30–01:45 UTC on the desktop, code `57a7892`, rules `HISTORY_PREREGISTRATION.md`
(committed before the run). Feeds: `export_history.py` from the v0.2.3 canonical store, 2019-06-02 →
2026-09-30 (M1 from 2024-11-01; 2,599,560 in-session minutes). Full output on the desktop in
`C:/Users/alk/gtg-live/history/out/` (`summary.json` sha256 `afad7969944ad882…`, `signals_<tf>.csv`).

## Validity check (passed)
Live-style lamp (bars cut at the bar, engine W bars back) = continuous research run on **100/100**
samples in every timeframe. Diagnostic of the old live runner (HTF read one bar late): 1, 2, 1, 4, 0
of 100 samples differ on M1, M5, M15, H1, H4.

## Results (win share; A = BID as live, B = with the real spread)
`n` = scored records; `low` = lower edge of the Wilson 99.5% interval (A).

| TF | kind | n | A | low | 2025 | 2026 | baseline A | B | baseline B | verdict A / B |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | break | 53,371 | 48.0% | 47.4% | 48.3% | 47.5% | 48.7% | 25.9% | 26.9% | not shown / not shown |
| M1 | aligned | 2,832 | 47.4% | 44.7% | 47.9% | 46.5% | 48.7% | 30.3% | 26.9% | not shown / not shown |
| M5 | break | 8,782 | 49.6% | 48.1% | 50.5% | 48.4% | 50.3% | 39.5% | 40.3% | not shown / not shown |
| M5 | aligned | 853 | 50.6% | 45.9% | 50.0% | 51.7% | 50.3% | 42.4% | 40.3% | not shown / not shown |
| M15 | break | 2,495 | 50.4% | 47.6% | 51.2% | 49.3% | 50.5% | 44.0% | 44.5% | not shown / not shown |
| M15 | aligned | 795 | 52.8% | 47.9% | 53.9% | 51.1% | 50.5% | 46.4% | 44.5% | not shown / not shown |
| H1 | break | 642 | 52.2% | 46.7% | 51.5% | 53.2% | 52.2% | 49.8% | 49.5% | not shown / not shown |
| H1 | aligned | 239 | 56.1% | 47.0% | 59.9% | 50.0% | 52.2% | 51.5% | 49.5% | not shown / not shown |
| H4 | break | 149 | 59.1% | 47.6% | 62.8% | 52.7% | 54.7% | 57.0% | 53.7% | not shown / not shown |
| H4 | aligned | 85 | 48.2% | 33.8% | 55.8% | 36.4% | 54.7% | 47.1% | 53.7% | not shown / not shown |

Baseline = every warmed bar with a heading, entered with the heading (M1 412,013; M5 80,240;
M15 26,663; H1 6,814; H4 1,849 bars). Mean spread at entry 0.65–0.82; mean distance (atrEng):
M1 1.9–2.6, M5 4.5–5.6, M15 7.9–8.6, H1 16.3–16.4, H4 32.7–32.8.

## Verdict
**No cell is `useful`** under the pre-registered rule, before or after costs.
- M1–M15: the green lights win about as often as entering with the heading on any bar; on M1 the
  tie rule and the small distance put both below 50%, and the spread (≈ 0.67 against a distance of
  ≈ 1.9) takes the win share to ≈ 26–30%.
- H1 / H4: the shares are higher (H1 aligned 56%, H4 break 59%), but the baseline is also higher
  (gold rose in 2025: entering with the heading won 54.7% on H4), the counts are small and the
  lower edges are under 50%. Not evidence; these two cells are the only ones worth watching live.
- Nothing in lastgtg is changed because of this table (pre-registration).
