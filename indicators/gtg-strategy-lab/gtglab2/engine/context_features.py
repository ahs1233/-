"""Causal raw context features for GTGLab2 Phase 1."""
from __future__ import annotations

from collections.abc import Iterable

import numpy as np
import pandas as pd

EMA_LENGTHS = (9, 21, 50, 200, 1000)


def session_bucket_utc(ts) -> str:
    """Compatibility bucket matching the inherited State Engine v0.2."""
    stamp = pd.Timestamp(ts)
    if stamp.tzinfo is None:
        stamp = stamp.tz_localize("UTC")
    else:
        stamp = stamp.tz_convert("UTC")
    h = stamp.hour
    if h <= 6:
        return "Asia"
    if h <= 12:
        return "London"
    if h <= 20:
        return "New York"
    return "Late"


def ema_series(close: pd.Series, length: int) -> pd.Series:
    if length <= 0:
        raise ValueError("EMA length must be positive")
    return close.astype(float).ewm(span=length, adjust=False).mean()


def _safe_normalize(x: pd.Series, scale: pd.Series | float | None) -> pd.Series:
    if scale is None:
        return x
    if np.isscalar(scale):
        s = float(scale)
        if not np.isfinite(s) or s == 0:
            raise ValueError("scale must be finite and non-zero")
        return x / s
    z = pd.Series(scale, index=x.index, dtype=float)
    z = z.where(np.isfinite(z) & (z != 0))
    return x / z


def ma_geometry_frame(
    close: pd.Series,
    *,
    scale: pd.Series | float | None = None,
    lengths: Iterable[int] = EMA_LENGTHS,
) -> pd.DataFrame:
    """Compute raw MA geometry using present/past prices only."""
    c = pd.Series(close, dtype=float).copy()
    lens = tuple(int(v) for v in lengths)
    if not lens or any(v <= 0 for v in lens):
        raise ValueError("lengths must contain positive integers")

    out = pd.DataFrame(index=c.index)
    out["close"] = c

    emas: dict[int, pd.Series] = {}
    for n in lens:
        e = ema_series(c, n)
        emas[n] = e
        out[f"ema_{n}"] = e
        out[f"price_minus_ema_{n}"] = _safe_normalize(c - e, scale)
        out[f"ema_{n}_slope1"] = _safe_normalize(e.diff(), scale)

    adjacent = list(zip(lens[:-1], lens[1:]))
    for a, b in adjacent:
        out[f"ema_{a}_minus_{b}"] = _safe_normalize(emas[a] - emas[b], scale)

    arr = np.column_stack([emas[n].to_numpy(dtype=float) for n in lens])
    pair_signs = [
        np.sign((emas[a] - emas[b]).to_numpy(dtype=float))
        for a, b in adjacent
    ]
    out["ema_stack_score"] = (
        np.sum(np.column_stack(pair_signs), axis=1) if pair_signs else 0.0
    )
    dispersion = np.nanmax(arr, axis=1) - np.nanmin(arr, axis=1)
    out["ema_family_dispersion"] = _safe_normalize(
        pd.Series(dispersion, index=c.index), scale
    )
    return out
