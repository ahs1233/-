"""Causal multi-timeframe aggregation and alignment for GTGLab2."""
from __future__ import annotations

import pandas as pd

TIMEFRAME_RULES = {
    "M5": "5min",
    "M15": "15min",
    "H1": "1h",
    "H4": "4h",
    "D1": "1D",
}


def aggregate_completed_bars(
    frame: pd.DataFrame,
    *,
    rule: str,
    time_col: str = "time",
    open_col: str = "open",
    high_col: str = "high",
    low_col: str = "low",
    close_col: str = "close",
) -> pd.DataFrame:
    """Aggregate bars and timestamp each aggregate when it becomes available."""
    req = [time_col, open_col, high_col, low_col, close_col]
    missing = [c for c in req if c not in frame]
    if missing:
        raise KeyError(f"missing columns: {missing}")

    x = frame[req].copy()
    x[time_col] = pd.to_datetime(x[time_col], utc=True)
    x = x.sort_values(time_col).set_index(time_col)

    agg = x.resample(rule, label="left", closed="left").agg(
        {open_col: "first", high_col: "max", low_col: "min", close_col: "last"}
    )
    agg = agg.dropna(subset=[open_col, high_col, low_col, close_col]).reset_index()
    agg["bar_start"] = agg[time_col]
    agg["available_at"] = agg["bar_start"] + pd.Timedelta(rule)
    return agg.drop(columns=[time_col])


def align_completed_timeframes(
    decision_times,
    base_frame: pd.DataFrame,
    *,
    time_col: str = "time",
    rules: dict[str, str] | None = None,
) -> pd.DataFrame:
    """Attach latest completed bar from each requested timeframe."""
    rules = TIMEFRAME_RULES if rules is None else rules
    out = pd.DataFrame({"decision_time": pd.to_datetime(decision_times, utc=True)})
    out = out.sort_values("decision_time").reset_index(drop=True)

    for name, rule in rules.items():
        bars = aggregate_completed_bars(base_frame, rule=rule, time_col=time_col)
        bars = bars.rename(
            columns={
                "bar_start": f"{name}_bar_start",
                "available_at": f"{name}_available_at",
                "open": f"{name}_open",
                "high": f"{name}_high",
                "low": f"{name}_low",
                "close": f"{name}_close",
            }
        )
        out = pd.merge_asof(
            out.sort_values("decision_time"),
            bars.sort_values(f"{name}_available_at"),
            left_on="decision_time",
            right_on=f"{name}_available_at",
            direction="backward",
            allow_exact_matches=True,
        )
    return out
