"""Multi-timeframe context adapters for GTGLab2.

This layer is descriptive: it aligns latest *completed* higher-timeframe bars
with decision timestamps and exposes raw directional geometry.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


TF_MS = {
    "M1": 60_000,
    "M5": 5 * 60_000,
    "M15": 15 * 60_000,
    "H1": 60 * 60_000,
    "H4": 4 * 60 * 60_000,
    "D1": 24 * 60 * 60_000,
}


def latest_completed_asof(
    decision_t: pd.Series | np.ndarray,
    tf_frame: pd.DataFrame,
    timeframe: str,
    value_columns: list[str],
) -> pd.DataFrame:
    """As-of join to the latest completed bar, never the still-open bar."""
    if timeframe not in TF_MS:
        raise ValueError(f"unsupported timeframe {timeframe}")
    for c in ["t", *value_columns]:
        if c not in tf_frame.columns:
            raise ValueError(f"missing {c}")
    d = pd.DataFrame({"decision_t": np.asarray(decision_t, dtype=np.int64)})
    src = tf_frame[["t", *value_columns]].copy().sort_values("t")
    src["available_t"] = src["t"].astype(np.int64) + TF_MS[timeframe]
    src = src.drop(columns=["t"])
    joined = pd.merge_asof(
        d.sort_values("decision_t"),
        src.sort_values("available_t"),
        left_on="decision_t",
        right_on="available_t",
        direction="backward",
        allow_exact_matches=True,
    )
    return joined.sort_index()


def raw_alignment_score(signals: dict[str, pd.Series]) -> pd.Series:
    """Sum raw directional signs across timeframes.

    Inputs are expected to be already-causal quantities such as EMA slope or
    close-minus-EMA. No trading threshold is applied.
    """
    if not signals:
        raise ValueError("signals is empty")
    index = next(iter(signals.values())).index
    score = pd.Series(0.0, index=index)
    for _, s in signals.items():
        z = pd.Series(s, index=index, dtype=float)
        score = score + np.sign(z.fillna(0.0))
    return score
