"""Causal session-to-session narrative features for GTGLab2."""
from __future__ import annotations

import numpy as np
import pandas as pd

from context_features import session_bucket_utc


def _ensure_utc(ts: pd.Series) -> pd.Series:
    x = pd.to_datetime(ts, utc=True)
    return pd.Series(x, index=ts.index)


def add_session_identity(frame: pd.DataFrame, time_col: str = "time") -> pd.DataFrame:
    if time_col not in frame:
        raise KeyError(time_col)
    out = frame.copy()
    t = _ensure_utc(out[time_col])
    out[time_col] = t
    out["session_bucket"] = [session_bucket_utc(v) for v in t]
    out["session_instance"] = (
        pd.Series(out["session_bucket"], index=out.index).ne(
            pd.Series(out["session_bucket"], index=out.index).shift()
        )
    ).cumsum().astype(int)
    return out


def session_narrative_frame(
    frame: pd.DataFrame,
    *,
    time_col: str = "time",
    open_col: str = "open",
    high_col: str = "high",
    low_col: str = "low",
    close_col: str = "close",
) -> pd.DataFrame:
    """Build causal current-session and previous-completed-session evidence."""
    req = [time_col, open_col, high_col, low_col, close_col]
    missing = [c for c in req if c not in frame]
    if missing:
        raise KeyError(f"missing columns: {missing}")

    out = add_session_identity(frame, time_col=time_col)
    sid = out["session_instance"]

    out["session_open"] = out.groupby(sid)[open_col].transform("first")
    out["session_high_so_far"] = out.groupby(sid)[high_col].cummax()
    out["session_low_so_far"] = out.groupby(sid)[low_col].cummin()
    out["session_close_now"] = out[close_col].astype(float)
    out["session_range_so_far"] = out["session_high_so_far"] - out["session_low_so_far"]

    completed = (
        out.groupby("session_instance", sort=True)
        .agg(
            completed_bucket=("session_bucket", "first"),
            prev_session_open=(open_col, "first"),
            prev_session_high=(high_col, "max"),
            prev_session_low=(low_col, "min"),
            prev_session_close=(close_col, "last"),
        )
        .reset_index()
    )
    completed["session_instance"] = completed["session_instance"] + 1
    completed = completed.drop(columns=["completed_bucket"])
    out = out.merge(completed, on="session_instance", how="left", sort=False)

    out["swept_prev_high"] = (
        out["prev_session_high"].notna()
        & (out["session_high_so_far"] > out["prev_session_high"])
    )
    out["swept_prev_low"] = (
        out["prev_session_low"].notna()
        & (out["session_low_so_far"] < out["prev_session_low"])
    )
    out["reclaimed_below_prev_high"] = (
        out["swept_prev_high"] & (out[close_col] < out["prev_session_high"])
    )
    out["reclaimed_above_prev_low"] = (
        out["swept_prev_low"] & (out[close_col] > out["prev_session_low"])
    )
    out["accepted_above_prev_high_now"] = (
        out["prev_session_high"].notna() & (out[close_col] > out["prev_session_high"])
    )
    out["accepted_below_prev_low_now"] = (
        out["prev_session_low"].notna() & (out[close_col] < out["prev_session_low"])
    )

    width = out["session_range_so_far"].replace(0, np.nan)
    out["close_location_in_session"] = (
        (out[close_col] - out["session_low_so_far"]) / width
    ).clip(0.0, 1.0)
    out["displacement_from_prev_close"] = out[close_col] - out["prev_session_close"]
    return out
