"""Typed, outcome-free contracts for GTGLab2."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class MarketState(str, Enum):
    RANGE = "RANGE"
    TRANSITION = "TRANSITION"
    TREND_UP = "TREND_UP"
    TREND_DOWN = "TREND_DOWN"


class Side(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    FLAT = "FLAT"


class StrategyMode(str, Enum):
    RANGE_SCALP = "RANGE_SCALP"
    TREND_SWING = "TREND_SWING"
    NONE = "NONE"


class Action(str, Enum):
    PROBE = "PROBE"
    ADD = "ADD"
    HOLD = "HOLD"
    REDUCE = "REDUCE"
    EXIT = "EXIT"
    FLIP_WAIT = "FLIP_WAIT"


class TimeframeRole(str, Enum):
    MACRO_CONTEXT = "MACRO_CONTEXT"
    STRUCTURAL_CONTEXT = "STRUCTURAL_CONTEXT"
    OPERATIONAL_STATE = "OPERATIONAL_STATE"
    SETUP = "SETUP"
    TRIGGER = "TRIGGER"


TIMEFRAME_ROLES = {
    "D1": TimeframeRole.MACRO_CONTEXT,
    "H4": TimeframeRole.STRUCTURAL_CONTEXT,
    "H1": TimeframeRole.OPERATIONAL_STATE,
    "M15": TimeframeRole.SETUP,
    "M5": TimeframeRole.SETUP,
    "M1": TimeframeRole.TRIGGER,
}


@dataclass(frozen=True)
class PositionBudget:
    total_units: float
    tranches: int

    def __post_init__(self) -> None:
        if self.total_units <= 0:
            raise ValueError("total_units must be > 0")
        if self.tranches <= 0:
            raise ValueError("tranches must be > 0")

    @property
    def equal_tranche_units(self) -> float:
        return self.total_units / self.tranches


@dataclass(frozen=True)
class ContextDecision:
    state: MarketState
    side: Side
    strategy: StrategyMode
    action: Action


def natural_side_for_state(state: MarketState) -> Side:
    if state is MarketState.TREND_UP:
        return Side.LONG
    if state is MarketState.TREND_DOWN:
        return Side.SHORT
    return Side.FLAT


def mirror_side(side: Side) -> Side:
    if side is Side.LONG:
        return Side.SHORT
    if side is Side.SHORT:
        return Side.LONG
    return Side.FLAT


def mirror_state(state: MarketState) -> MarketState:
    if state is MarketState.TREND_UP:
        return MarketState.TREND_DOWN
    if state is MarketState.TREND_DOWN:
        return MarketState.TREND_UP
    return state
