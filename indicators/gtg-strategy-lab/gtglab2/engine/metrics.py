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



from dataclasses import dataclass
from collections import defaultdict


@dataclass(frozen=True)
class EpisodeOutcome:
    """Normalized executable episode outcome.

    mae_r and mfe_r are non-negative magnitudes measured in R.
    pnl_r already reflects the requested cost tier.
    """

    episode_id: str
    pnl_r: float
    mae_r: float
    mfe_r: float
    used_r: float
    side: str = ""
    session: str = ""
    time_to_invalidation_bars: int | None = None

    def __post_init__(self) -> None:
        if self.mae_r < 0 or self.mfe_r < 0:
            raise ValueError("mae_r/mfe_r must be non-negative magnitudes")
        if self.used_r < 0:
            raise ValueError("used_r cannot be negative")
        if self.time_to_invalidation_bars is not None and self.time_to_invalidation_bars < 0:
            raise ValueError("time_to_invalidation_bars cannot be negative")


def _mean_by(items: list[EpisodeOutcome], attr: str) -> dict[str, float]:
    groups: dict[str, list[float]] = defaultdict(list)
    for x in items:
        key = str(getattr(x, attr) or "")
        if key:
            groups[key].append(float(x.pnl_r))
    return {k: float(np.mean(v)) for k, v in sorted(groups.items())}


def summarize_execution_episodes(items) -> dict:
    rows = list(items)
    base = summarize_episode_returns(x.pnl_r for x in rows)
    if not rows:
        return {
            **base,
            "mean_mae_r": None,
            "mean_mfe_r": None,
            "mean_used_r": None,
            "pnl_per_used_r": None,
            "mean_time_to_invalidation_bars": None,
            "by_side_mean_pnl_r": {},
            "by_session_mean_pnl_r": {},
        }

    used = sum(x.used_r for x in rows)
    invalidation = [
        x.time_to_invalidation_bars
        for x in rows
        if x.time_to_invalidation_bars is not None
    ]
    return {
        **base,
        "mean_mae_r": float(np.mean([x.mae_r for x in rows])),
        "mean_mfe_r": float(np.mean([x.mfe_r for x in rows])),
        "mean_used_r": float(np.mean([x.used_r for x in rows])),
        "pnl_per_used_r": None if used <= 0 else float(sum(x.pnl_r for x in rows) / used),
        "mean_time_to_invalidation_bars": (
            None if not invalidation else float(np.mean(invalidation))
        ),
        "by_side_mean_pnl_r": _mean_by(rows, "side"),
        "by_session_mean_pnl_r": _mean_by(rows, "session"),
    }


def paired_incremental_summary(baseline, treatment) -> dict:
    """Compare two policies only on exactly shared episode IDs."""
    b = list(baseline)
    t = list(treatment)
    bm = {x.episode_id: x for x in b}
    tm = {x.episode_id: x for x in t}
    if len(bm) != len(b) or len(tm) != len(t):
        raise ValueError("episode_id must be unique within each policy")
    ids = sorted(set(bm) & set(tm))
    if not ids:
        return {
            "paired_n": 0,
            "mean_incremental_pnl_r": None,
            "median_incremental_pnl_r": None,
            "treatment_better_fraction": None,
        }
    diff = np.asarray([tm[i].pnl_r - bm[i].pnl_r for i in ids], dtype=float)
    return {
        "paired_n": int(len(ids)),
        "mean_incremental_pnl_r": float(diff.mean()),
        "median_incremental_pnl_r": float(np.median(diff)),
        "treatment_better_fraction": float(np.mean(diff > 0)),
    }
