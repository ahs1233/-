"""Explicit GTGLab2 risk guard.

This module is policy infrastructure, not a fitted strategy. Limits are supplied
by the caller; there are intentionally no hidden production defaults.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RiskLimits:
    max_trade_r: float
    max_session_loss_r: float
    max_daily_loss_r: float
    max_consecutive_losses: int
    max_active_r: float

    def __post_init__(self) -> None:
        if min(self.max_trade_r, self.max_session_loss_r, self.max_daily_loss_r, self.max_active_r) <= 0:
            raise ValueError("risk limits must be positive")
        if self.max_consecutive_losses <= 0:
            raise ValueError("max_consecutive_losses must be positive")


@dataclass(frozen=True)
class RiskState:
    session_realized_r: float = 0.0
    daily_realized_r: float = 0.0
    consecutive_losses: int = 0
    active_r: float = 0.0


@dataclass(frozen=True)
class RiskDecision:
    allowed: bool
    reasons: tuple[str, ...]


def can_open(state: RiskState, limits: RiskLimits, planned_trade_r: float) -> RiskDecision:
    reasons: list[str] = []
    if planned_trade_r <= 0:
        reasons.append("planned_trade_r_nonpositive")
    if planned_trade_r > limits.max_trade_r:
        reasons.append("trade_r_limit")
    if state.active_r + max(0.0, planned_trade_r) > limits.max_active_r:
        reasons.append("active_r_limit")
    if state.session_realized_r <= -limits.max_session_loss_r:
        reasons.append("session_loss_guard")
    if state.daily_realized_r <= -limits.max_daily_loss_r:
        reasons.append("daily_loss_guard")
    if state.consecutive_losses >= limits.max_consecutive_losses:
        reasons.append("consecutive_loss_guard")
    return RiskDecision(not reasons, tuple(reasons))


def apply_close(state: RiskState, realized_r: float, released_active_r: float) -> RiskState:
    if released_active_r < 0 or released_active_r > state.active_r + 1e-12:
        raise ValueError("invalid released_active_r")
    return RiskState(
        session_realized_r=state.session_realized_r + realized_r,
        daily_realized_r=state.daily_realized_r + realized_r,
        consecutive_losses=(state.consecutive_losses + 1 if realized_r < 0 else 0),
        active_r=max(0.0, state.active_r - released_active_r),
    )


def reserve(state: RiskState, planned_r: float) -> RiskState:
    if planned_r < 0:
        raise ValueError("planned_r cannot be negative")
    return RiskState(
        session_realized_r=state.session_realized_r,
        daily_realized_r=state.daily_realized_r,
        consecutive_losses=state.consecutive_losses,
        active_r=state.active_r + planned_r,
    )
