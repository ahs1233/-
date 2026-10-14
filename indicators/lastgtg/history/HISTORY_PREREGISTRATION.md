# lastgtg historical green-light test 2025–2026 — pre-registration

Written 2026-10-14, before any historical lastgtg row was computed. Not changed after results.
The live ledger rule (`../live/LIVE_PREREGISTRATION.md`) is applied unchanged to past data, plus a
baseline, a cost column and a stricter verdict for the many cells.

## Data
- v0.2.3 canonical Dukascopy XAU/USD M1 store on the desktop (`C:/Users/alk/gtg-lab-data-jforex`,
  JForex IHistory export, Data Integrity PASS), BID for signals and scoring, ASK for the cost column.
- Bars: the lab's frozen calendar (`gtg-strategy-lab/data/bars.py aggregate`, the TradingView /
  OANDA session calendar, in-session minutes only), produced day by day by `export_history.py`
  (same rules as `aggregate`, checked by `test_export_history.py`).
- Note: live JForex H4/D/W bars are UTC-aligned; these follow the TradingView calendar the
  indicator was built on. M1–H1 are identical in both.

## Period
- Signals: closed bars of M1, M5, M15, H1, H4 whose open time is in
  **[2025-01-01 00:00 UTC, 2026-09-26 00:00 UTC)** (2026-09-27…29 are excluded lab days; the store
  ends 2026-09-30 13:39).
- Scoring may use M1 bars up to the end of the store. A record still unresolved there is
  `open_at_end` and leaves every denominator.
- Earlier bars are read only as warm-up.

### The lab Holdout
This period covers the end of the lab Validation (2025-01-01 → 2025-03-24) and the whole lab
Historical Holdout (2025-03-24 → 2026-09-29) of `gtg-strategy-lab` (TRADE_CONTRACT §20). The user
chose on 2026-10-14 to use it for this test. From this run on, that Holdout is no longer untouched
for any indicator built on the GTG engine. The indicator has no memory and learns nothing from
these data; the risk is only human tuning. So **nothing in lastgtg is changed because of these
results**; any later change is judged only on other data (2021-09 → 2024-12, or new live data).

## Indicator
Unchanged lastgtg live modules (`../live/zone-engine.mjs`, `measure.mjs`, `lamp.mjs`, lab profiles),
same mintick 0.001, same per-timeframe profiles (HTF / anchors) as the live runner.
The engine runs continuously over each timeframe (research mode, determinism window); a row is
used only when `warmed`. **Validity check** before any result: for up to 50 signal bars and 50
random bars per timeframe (seed 20261014), the live-style computation (bars cut at the bar,
engine started W bars back, HTF / anchor bars opening at or before the bar, as `runner.mjs` since
`aaac5a2`) must give the same lamp, kind and direction. More than 2% differing in any timeframe
stops the run; the verdict is not read. The same samples are also computed with closed HTF bars
only (the live runner before `aaac5a2`, which read HTF values one bar late) and the count is
reported as a diagnostic of that bug; it does not affect the verdict.

## Signal (as live)
A green light is a closed bar on which the lamp is green while on the previous closed bar of the
same timeframe it was not green, or green in the other direction. Kinds: `break` (accepted break),
`aligned` ("الاتجاه متوافق"). Direction: the break side, otherwise the heading.

## Scoring
**A (primary, as live, BID):** entry = signal bar close; distance = 1 × `atrEng` of that bar;
target = entry + dir·distance, stop = entry − dir·distance; M1 BID bars opening at or after the
signal bar's close; first touch wins; both in one M1 bar = `loss_both`; no touch before
signal open + 301 × timeframe = `expired` (not a win).

**B (cost column, real spread):** a long buys at the ASK close of the last M1 bar of the signal bar
and sells on BID (target: BID high ≥ target; stop: BID low ≤ stop); a short sells at the BID close
and buys back on ASK (target: ASK low ≤ target; stop: ASK high ≥ stop); target/stop = that entry ±
distance. Same tie, expiry and end rules. No commission or swap.

**Baseline (per timeframe):** every warmed closed bar in the period whose heading is not zero,
direction = heading, scored with A and B. It is what "enter with the heading on any bar" gives
under the same rule (the tie rule makes it fall below 50%).

## Measures
Per timeframe × kind (10 cells) and per baseline: wins, losses, loss_both, expired, open_at_end;
win share = wins / (wins + losses + loss_both + expired); the same for 2025 and 2026 apart;
the Wilson 99.5% interval (95% shared over the 10 cells).

## Verdict (per cell, A and B separately)
`useful` only if all hold:
1. at least 40 scored records;
2. lower edge of the Wilson 99.5% interval above 50%;
3. win share above the baseline win share of the same timeframe;
4. win share above 50% in 2025 and in 2026 separately.

Otherwise `not shown` (or `too few` when under 40). Records close together are not independent
(one move gives several greens), so a `useful` cell is a lead for the live test, not proof.
