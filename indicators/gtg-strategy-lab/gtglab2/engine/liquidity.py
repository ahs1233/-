"""Causal liquidity-location features for GTGLab2."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _nearest_levels(close: np.ndarray, levels: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    up = np.full(len(close), np.nan)
    down = np.full(len(close), np.nan)
    for i in range(len(close)):
        vals = levels[i]
        vals = vals[np.isfinite(vals)]
        if not len(vals):
            continue
        above = vals[vals > close[i]]
        below = vals[vals < close[i]]
        if len(above):
            up[i] = float(np.min(above))
        if len(below):
            down[i] = float(np.max(below))
    return up, down


def liquidity_map_frame(
    frame: pd.DataFrame,
    session_features: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Map observable prior liquidity references without future bars.

    Required: bh, bl, bc. Optional atr.
    The prior rolling levels are shifted by one bar.
    """
    for col in ("bh", "bl", "bc"):
        if col not in frame.columns:
            raise ValueError(f"missing {col}")
    f = frame.reset_index(drop=True)
    out = pd.DataFrame(index=f.index)
    high = f["bh"].astype(float)
    low = f["bl"].astype(float)
    close = f["bc"].astype(float)

    for n in (24, 72):
        out[f"prior_high_{n}"] = high.shift(1).rolling(n, min_periods=n).max()
        out[f"prior_low_{n}"] = low.shift(1).rolling(n, min_periods=n).min()

    if session_features is not None:
        s = session_features.reset_index(drop=True)
        out["prev_session_high"] = pd.to_numeric(s["prev_session_high"], errors="coerce")
        out["prev_session_low"] = pd.to_numeric(s["prev_session_low"], errors="coerce")
    else:
        out["prev_session_high"] = np.nan
        out["prev_session_low"] = np.nan

    level_cols = [
        "prior_high_24", "prior_low_24", "prior_high_72", "prior_low_72",
        "prev_session_high", "prev_session_low",
    ]
    mat = out[level_cols].to_numpy(dtype=float)
    up, down = _nearest_levels(close.to_numpy(dtype=float), mat)
    out["nearest_upside_liquidity"] = up
    out["nearest_downside_liquidity"] = down

    if "atr" in f.columns:
        atr = f["atr"].astype(float).replace(0.0, np.nan)
        out["upside_distance_atr"] = (out["nearest_upside_liquidity"] - close) / atr
        out["downside_distance_atr"] = (close - out["nearest_downside_liquidity"]) / atr
        for col in level_cols:
            out[f"{col}_distance_atr"] = (out[col] - close) / atr

    return out
