# PROTOCOL — Pine v0.4 Regime Filter

Date: 2026-10-04

Purpose:
Build a causal market-regime discriminator for GTGLab2 after v0.3 failed in 2023 but performed strongly in 2024-2025.

Discovery:
- Structural comparison used 2023 vs 2024 signal-time features only.
- 2025 was inspected only after candidate family ranking as pseudo-validation for this new filter.
- Pristine Forward OOS remains untouched.

Frozen v0.4 regime rule before exact integrated rerun:
1. Existing v0.3 Strict MTF remains:
   - LONG requires MTF score +3.
   - SHORT requires MTF score -3.
2. Directional EMA structure:
   - LONG: (EMA50 - EMA200) / ATR14 >= 1.5
   - SHORT: (EMA200 - EMA50) / ATR14 >= 1.5
3. Volatility regime:
   - ATR14 >= rolling median(ATR14, 120 H1 bars)
4. Acceptance/Retest and v0.2 exits remain unchanged.
5. Dynamic risk overlay remains OFF.

Interpretation:
The rule requires both established medium-term trend separation and non-compressed short-term volatility. It does not use calendar year or future outcomes.

Test:
Run integrated strategy logic from 2023-01-01 through available 2026-09-30 data.
The primary comparison is 2023-2025; 2026 is a secondary robustness read.
