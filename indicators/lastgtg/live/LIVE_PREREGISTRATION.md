# lastgtg live green-light ledger — pre-registration

Written 2026-10-13, before the live runner produced any record. Not changed after results.

## What is counted

A **green light** is a closed bar of M1, M5, M15, H1 or H4 on which the lastgtg COMPACT lamp
(lamp.mjs = lastgtg.pine §16) is green, while on the previous closed bar of the same timeframe
it was not green, or was green in the other direction. Two kinds, recorded separately:

- `break`: green from an accepted break ("اختراق مؤكد" / "كسر مؤكد"). Direction = the break side.
- `aligned`: green "الاتجاه متوافق". Direction = heading.

The first bar after the runner starts never opens a record (no previous bar to compare).

## How a record is scored

- Entry = close of the signal bar (BID, Dukascopy via JForex).
- Distance = 1 × the engine ATR of that timeframe on the signal bar (`atrEng`).
- Target = entry + direction × distance; stop = entry − direction × distance.
- Scored on the M1 bars that open after the signal bar closes. First touch wins.
  Target and stop inside the same M1 bar = loss (`loss_both`).
- No touch within 300 bars of the signal's timeframe = `expired` (not a win).
- Spread and costs are not included.

## What would count as useful

With symmetric target and stop, a random entry wins about half the time. A kind of green light
is useful only if, after at least 40 resolved records of that kind, its win share is clearly
above 50% (lower edge of the 95% interval above 50%). Fewer than 40 records: no verdict.

## Known differences from the TradingView indicator

- Prices are Dukascopy BID (JForex), not OANDA; zones can sit a little differently.
- The panel is computed on closed bars only; on TradingView it also updates inside the open bar.
- Zone rows do not show the "% من الحركة" suffix.
- The dollar row uses Dukascopy's dollar index when the platform offers it; otherwise it reads
  "الدولار • غير متاح".

## Correction 2026-10-14 (records 1–39)
Until 2026-10-14 01:16 UTC (`aaac5a2`) the runner read the route HTF and anchor bars one closed
bar too early (the feeds hold closed bars only; the engine looks for the bar that contains the
chart bar). Records with id ≤ 39 were opened under that bug and are reported apart from the rest;
the scoring rule above did not change.

## Note 2026-10-14 (records 55–59, account change)
- 03:05 UTC: the JForex demo account was blocked; only sporadic ticks reached the feed after that.
  Records 55 and 56 were resolved on those sporadic ticks and are flagged as suspect.
- 09:42 UTC the desktop restarted; 13:49 UTC the strategy was started again on a new demo account
  (same code, same files). On start it rewrites the closed-bar history, so record 57 (M5, opened
  03:00) was resolved on the full M1 history (win 03:17); it stays in the ledger.
- The runner then opened records 58 and 59 on the last closed bars of the catch-up data:
  - 59 (H1, signal bar 12:00) was resolved at 13:02, before it was recorded (13:49) — **excluded**.
  - 58 (M15, signal bar 13:30) was recorded about 5 minutes after its bar closed, at a stale entry
    price — **flagged**, reported apart.
- Records from 60 on are opened in real time again.
