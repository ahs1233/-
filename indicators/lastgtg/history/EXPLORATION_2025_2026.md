# lastgtg green lights 2025–2026 — exploration (descriptive, after HISTORY_RESULTS.md)

Run 2026-10-14 02:17 UTC, `explore.mjs` at `a3e865b`, same feeds as the historical test. These data
were already opened; nothing here is evidence. Ideas are confirmed only on 2021-09 → 2024-12
under a new pre-registration.

Measures: A / B win share (as HISTORY_PREREGISTRATION), e = mean favourable / mean adverse move
over the next 12 bars (BID, ATR units; above 1 = moves more with the light than against it),
zR = mean result in R of a trade with target = near edge of the zone ahead, stop = 1 ATR, real spread.

## What stands out
1. **No zone ahead (open space)** — the only condition that is better on three timeframes:
   - H4 break: A 88% (n 25), e 4.23 — tiny count
   - H1 break: A 65.8% (n 79), e 1.64; H1 aligned: A 58.6% (n 111), e 1.36
   - M15 break: A 55.4% (n 341), e 1.20; M15 aligned: A 57.7% (n 390), e 1.20
   - not on M5 / M1.
   Caution: in 2025 gold kept making new highs, so "no resistance ahead" was mostly a long in a
   rising market. It must hold for shorts too and in other years.
2. **Next-timeframe heading agrees** — modest: M15 break 52.4% (e 1.17) against 45.5% (e 0.84)
   when it disagrees; H1 break e 1.29 against 0.92. Nothing on M5 / M1.
3. **Zone targets do not help**: zR is negative on every timeframe and kind (−0.02 … −0.56). Most
   breaks have the next zone less than 1 ATR away (H1 break: 323 of 642), so the reward is small.
4. **Session, first-in-move / repeat, strength of the zone ahead**: no pattern that holds across
   timeframes.
5. **M1 and M5**: nothing beats the heading baseline; the spread takes A ≈ 48–50% to B ≈ 26–40%.

## Baselines (enter with the heading on any bar)
| TF | A | B | e |
|---|---|---|---|
| H4 | 54.7% | 53.7% | 1.17 |
| H1 | 52.2% | 49.5% | 1.15 |
| M15 | 50.5% | 44.5% | 1.06 |
| M5 | 50.3% | 40.3% | 1.05 |
| M1 (every 10th bar) | 49.0% | 27.1% | 1.03 |
