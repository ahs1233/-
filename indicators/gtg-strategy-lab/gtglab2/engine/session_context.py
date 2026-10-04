"""Causal session-narrative features for GTGLab2.

The engine records what the current session has done *so far* and what the
previous completed session left behind. It never uses the final high/low of the
current session before that session is complete.
"""
from __future__ import annotations

from dataclasses import dataclass
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd


TOKYO = ZoneInfo("Asia/Tokyo")
LONDON = ZoneInfo("Europe/London")
NEW_YORK = ZoneInfo("America/New_York")


def _local_hour(ts: pd.Timestamp, zone: ZoneInfo) -> float:
    x = ts.tz_convert(zone)
    return x.hour + x.minute / 60.0 + x.second / 3600.0


def active_sessions(ts) -> tuple[str, ...]:
    """Return active market sessions at a UTC timestamp.

    Reference windows are deliberately explicit and DST-aware:
    Asia/Tokyo 09:00-16:00 local, London 08:00-16:00 local,
    New York 08:00-17:00 local.
    """
    x = pd.Timestamp(ts)
    if x.tzinfo is None:
        x = x.tz_localize("UTC")
    else:
        x = x.tz_convert("UTC")
    out: list[str] = []
    if 9.0 <= _local_hour(x, TOKYO) < 16.0:
        out.append("Asia")
    if 8.0 <= _local_hour(x, LONDON) < 16.0:
        out.append("London")
    if 8.0 <= _local_hour(x, NEW_YORK) < 17.0:
        out.append("NewYork")
    return tuple(out)


def primary_session(ts) -> str:
    active = set(active_sessions(ts))
    if "London" in active and "NewYork" in active:
        return "London_NewYork"
    if "London" in active:
        return "London"
    if "NewYork" in active:
        return "NewYork"
    if "Asia" in active:
        return "Asia"
    return "Off"


def session_narrative_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Create causal current/previous-session narrative features.

    Required columns: t, bo, bh, bl, bc. Optional atr.
    Input must be strictly increasing by t.
    """
    req = ("t", "bo", "bh", "bl", "bc")
    missing = [c for c in req if c not in frame.columns]
    if missing:
        raise ValueError(f"missing columns: {missing}")
    f = frame.copy().reset_index(drop=True)
    if len(f) and (f["t"].diff().dropna() <= 0).any():
        raise ValueError("timestamps must be strictly increasing")

    ts = pd.to_datetime(f["t"].to_numpy(dtype=np.int64), unit="ms", utc=True)
    labels = pd.Series([primary_session(x) for x in ts], index=f.index, dtype="object")
    gap = f["t"].diff().fillna(0).gt(3 * 3_600_000)
    new_run = labels.ne(labels.shift()) | gap
    run_id = new_run.cumsum().astype(int)

    out = pd.DataFrame(index=f.index)
    out["session"] = labels
    out["session_run_id"] = run_id

    grouped = f.groupby(run_id, sort=False)
    out["session_open"] = grouped["bo"].transform("first").astype(float)
    out["session_high_to_now"] = grouped["bh"].cummax().astype(float)
    out["session_low_to_now"] = grouped["bl"].cummin().astype(float)
    out["session_range_to_now"] = out["session_high_to_now"] - out["session_low_to_now"]
    rng = out["session_range_to_now"].replace(0.0, np.nan)
    out["session_close_location"] = (f["bc"].astype(float) - out["session_low_to_now"]) / rng

    summaries = f.assign(_run=run_id, _label=labels).groupby("_run", sort=False).agg(
        prev_session_label=("_label", "first"),
        prev_session_high=("bh", "max"),
        prev_session_low=("bl", "min"),
        prev_session_close=("bc", "last"),
    )
    summaries = summaries.shift(1)
    for col in summaries.columns:
        mapper = summaries[col].to_dict()
        out[col] = run_id.map(mapper)

    out["swept_prev_high"] = out["session_high_to_now"] > out["prev_session_high"]
    out["swept_prev_low"] = out["session_low_to_now"] < out["prev_session_low"]
    out["rejected_prev_high"] = out["swept_prev_high"] & (f["bc"] < out["prev_session_high"])
    out["rejected_prev_low"] = out["swept_prev_low"] & (f["bc"] > out["prev_session_low"])
    out["accepted_above_prev_high"] = out["swept_prev_high"] & (f["bc"] > out["prev_session_high"])
    out["accepted_below_prev_low"] = out["swept_prev_low"] & (f["bc"] < out["prev_session_low"])

    if "atr" in f.columns:
        atr = f["atr"].astype(float).replace(0.0, np.nan)
        out["session_range_atr"] = out["session_range_to_now"] / atr
        out["displacement_from_prev_close_atr"] = (
            f["bc"].astype(float) - out["prev_session_close"]
        ) / atr

    return out
