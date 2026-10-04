"""Outcome-free bidirectional strategy-mode mapping for GTGLab2."""
from __future__ import annotations

from enum import Enum

from contracts import MarketState, Side, StrategyMode, natural_side_for_state


class RangeLocation(str, Enum):
    LOWER = "LOWER"
    MIDDLE = "MIDDLE"
    UPPER = "UPPER"


def range_side(location: RangeLocation) -> Side:
    if location is RangeLocation.LOWER:
        return Side.LONG
    if location is RangeLocation.UPPER:
        return Side.SHORT
    return Side.FLAT


def state_strategy(state: MarketState) -> StrategyMode:
    if state is MarketState.RANGE:
        return StrategyMode.RANGE_SCALP
    if state in (MarketState.TREND_UP, MarketState.TREND_DOWN):
        return StrategyMode.TREND_SWING
    return StrategyMode.NONE


def candidate_side(
    state: MarketState,
    *,
    range_location: RangeLocation | None = None,
) -> Side:
    if state is MarketState.RANGE:
        if range_location is None:
            return Side.FLAT
        return range_side(range_location)
    return natural_side_for_state(state)
