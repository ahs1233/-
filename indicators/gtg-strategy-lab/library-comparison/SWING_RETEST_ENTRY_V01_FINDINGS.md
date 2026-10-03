# GTG Swing Retest Entry v0.1 — Findings

Date: 2026-10-03
Scope: development diagnostic after frozen Trend confirmation.
Validation/Historical Holdout remained closed.

## Rule
After TREND_UP/TREND_DOWN confirmation:
- search next 6 complete H1 trading bars,
- retest tolerance = 0.50 ATR_ref around original broken range boundary,
- require directional rejection close,
- first qualifying rejection wins,
- cancel on deep close back through boundary,
- enter next open,
- no stop/target/re-entry.

No threshold was changed after outcomes.

## Coverage
Library:
- confirmed trends 234
- retest entries 114
- coverage 48.72%

Evaluation:
- confirmed trends 280
- retest entries 121
- coverage 43.21%
- up entries 61
- down entries 60
- median retest delay 2 bars

Evaluation no-entry reasons:
- NO_RETEST_WITHIN_6: 101
- INVALIDATED_BEFORE_RETEST: 44
- HARD_GAP: 14
- RETEST_ENTRY: 121

## Evaluation economics

### h=4
- mature trades 114
- directional accuracy 45.61%
- C0 -0.062
- C1 -0.237
- C2 -0.413
- C1 win rate 42.11%

Immediate confirmed comparator C1 was -0.076.
The retest rule is worse at h=4.

### h=12
- mature trades 100
- directional accuracy 49.0%
- C0 +0.082
- C1 -0.097
- C2 -0.275
- C1 win rate 42.0%

### h=24
- mature trades 96
- directional accuracy 48.96%
- C0 +0.154
- C1 -0.018
- C2 -0.190
- C1 win rate 45.83%

Immediate confirmed h24 C1 was +0.045.
The registered primary screen therefore FAILS.

## h24 direction diagnostic
Up:
- n=51
- C1 -0.237
- C2 -0.405

Down:
- n=45
- C1 +0.229
- C2 +0.053

This reverses the direction asymmetry observed in immediate-confirmation entries.
It is descriptive only and must not be promoted into a direction-specific retest rule from this sample.

## Retest-delay diagnostic
h24:
- delay 1: n=43, C1 -0.819
- delay 2-3: n=40, C1 +1.031, C2 +0.861
- delay 4-6: n=13, C1 -0.597

The 2-3 bar subgroup is striking but was not a preregistered selection rule.
It may motivate a separately registered representation later, but the 2-3 window may NOT be adopted or tuned from this evaluation.

The same 2-3 subgroup was also positive at h12:
- n=42
- C1 +0.451
- C2 +0.278

But library/evaluation subgroup stability was not preregistered as a candidate test, so no edge claim is made.

## Year stability h24
- 2021 n=34: C1 +0.502, C2 +0.328
- 2022 n=36: C1 -0.410, C2 -0.596
- 2023 n=25: C1 -0.138, C2 -0.289

Not stable across years.

## Registered h24 screen
FAIL:
- active >=60: PASS
- coverage >=20%: PASS
- C0 >0: PASS
- C1 >0: FAIL
- C2 >=0: FAIL
- C1 win rate >50%: FAIL
- C1 > immediate-confirmed h24: FAIL
- up/down >=20: PASS

## Interpretation
A simple geometric retest of the old range boundary is not a robust Swing entry rule.

The failure is informative:
- entering at confirmation is too early / cost-fragile,
- waiting for any retest within 6 bars is too broad,
- not every retest is a useful pullback,
- timing relative to the trend lifecycle appears important.

The next planned test is Trend Lifecycle:
- enter after causal Trend confirmation,
- hold while the frozen Trend state persists,
- exit only after the Trend state ends causally,
- no arbitrary 4/12/24 holding duration.

## Decision
- Preserve State Engine v0.2.
- Preserve TRANSITION stand-down logic.
- Reject Retest Entry v0.1 as the generic Swing entry layer.
- Do not tune tolerance, search window, direction, or retest-delay subgroup on this evaluation.
- Continue to frozen Trend Lifecycle diagnostic.
- Historical Holdout remains closed.
