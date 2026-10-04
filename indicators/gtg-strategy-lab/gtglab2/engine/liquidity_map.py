"""Causal liquidity-reference map for GTGLab2."""
from __future__ import annotations

import numpy as np
import pandas as pd


def rolling_liquidity_map(
    frame: pd.DataFrame,
    *,
    high_col: str = "high",
    low_col: str = "low",
    close_col: str = "close",
    lookback: int = 24,
    scale: pd.Series | float | None = None,
) -> pd.DataFrame:
    """Map prior rolling highs/lows using only bars before the current row."""
    if lookback <= 0:
        raise ValueError("lookback must be positive")
    for c in (high_col, low_col, close_col):
        if c not in frame:
            raise KeyError(c)

    h = frame[high_col].astype(float)
    l = frame[low_col].astype(float)
    c = frame[close_col].astype(float)

    prior_high = h.shift(1).rolling(lookback, min_periods=1).max()
    prior_low = l.shift(1).rolling(lookback, min_periods=1).min()

    out = pd.DataFrame(index=frame.index)
    out["prior_liquidity_high"] = prior_high
    out["prior_liquidity_low"] = prior_low
    out["distance_to_upside_liquidity"] = prior_high - c
    out["distance_to_downside_liquidity"] = c - prior_low

    if scale is not None:
        if np.isscalar(scale):
            s = float(scale)
            if not np.isfinite(s) or s == 0:
                raise ValueError("scale must be finite and non-zero")
            out["distance_to_upside_liquidity_scaled"] = out["distance_to_upside_liquidity"] / s
            out["distance_to_downside_liquidity_scaled"] = out["distance_to_downside_liquidity"] / s
        else:
            s = pd.Series(scale, index=frame.index, dtype=float)
            s = s.where(np.isfinite(s) & (s != 0))
            out["distance_to_upside_liquidity_scaled"] = out["distance_to_upside_liquidity"] / s
            out["distance_to_downside_liquidity_scaled"] = out["distance_to_downside_liquidity"] / s

    out["swept_prior_high_now"] = h > prior_high
    out["swept_prior_low_now"] = l < prior_low
    out["closed_back_below_prior_high"] = out["swept_prior_high_now"] & (c < prior_high)
    out["closed_back_above_prior_low"] = out["swept_prior_low_now"] & (c > prior_low)
    return out
