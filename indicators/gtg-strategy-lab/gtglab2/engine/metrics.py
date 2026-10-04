"""Episode-level execution metrics for GTGLab2."""
from __future__ import annotations

import numpy as np


def summarize_episode_returns(values) -> dict:
    x = np.asarray(list(values), dtype=float)
    if x.size == 0:
        return {
            "n": 0,
            "mean": None,
            "median": None,
            "win_rate": None,
            "profit_factor": None,
            "max_drawdown": None,
        }

    gains = x[x > 0].sum()
    losses = -x[x < 0].sum()
    equity = np.cumsum(x)
    peak = np.maximum.accumulate(np.r_[0.0, equity])
    dd = peak[1:] - equity
    pf = None if losses == 0 else float(gains / losses)

    return {
        "n": int(x.size),
        "mean": float(x.mean()),
        "median": float(np.median(x)),
        "win_rate": float(np.mean(x > 0)),
        "profit_factor": pf,
        "max_drawdown": float(dd.max(initial=0.0)),
    }


def scaled_vs_single(scaled_pnl: float, single_pnl: float) -> dict:
    return {
        "scaled_pnl": float(scaled_pnl),
        "single_pnl": float(single_pnl),
        "incremental_pnl": float(scaled_pnl - single_pnl),
    }
