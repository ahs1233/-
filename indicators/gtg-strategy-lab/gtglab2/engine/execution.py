"""Bid/ask execution primitives for GTGLab2."""
from __future__ import annotations

from dataclasses import dataclass

from contracts import Side


@dataclass(frozen=True)
class CostModel:
    slippage_bps: float = 0.0
    fee_bps: float = 0.0

    def __post_init__(self) -> None:
        if self.slippage_bps < 0 or self.fee_bps < 0:
            raise ValueError("costs cannot be negative")


def _slip(px: float, bps: float) -> float:
    return px * bps / 10_000.0


def entry_fill(bar: dict, side: Side, costs: CostModel) -> float:
    if side is Side.LONG:
        px = float(bar["ao"])
        return px + _slip(px, costs.slippage_bps)
    if side is Side.SHORT:
        px = float(bar["bo"])
        return px - _slip(px, costs.slippage_bps)
    raise ValueError("entry side must be LONG or SHORT")


def exit_fill(bar: dict, side: Side, costs: CostModel) -> float:
    if side is Side.LONG:
        px = float(bar["bo"])
        return px - _slip(px, costs.slippage_bps)
    if side is Side.SHORT:
        px = float(bar["ao"])
        return px + _slip(px, costs.slippage_bps)
    raise ValueError("exit side must be LONG or SHORT")


def pnl_points(entry: float, exit_: float, side: Side) -> float:
    if side is Side.LONG:
        return exit_ - entry
    if side is Side.SHORT:
        return entry - exit_
    raise ValueError("side must be LONG or SHORT")


def net_pnl_points(entry: float, exit_: float, side: Side, costs: CostModel) -> float:
    gross = pnl_points(entry, exit_, side)
    fee = (entry + exit_) * costs.fee_bps / 10_000.0
    return gross - fee
