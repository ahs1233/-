"""Execution primitives for GTGLab2 using explicit BID/ASK and slippage."""
from __future__ import annotations

from dataclasses import dataclass

from contracts import Side
from inventory import Fill, InventoryState


@dataclass(frozen=True)
class Quote:
    bid: float
    ask: float

    def __post_init__(self) -> None:
        if self.bid <= 0 or self.ask <= 0:
            raise ValueError("quote prices must be positive")
        if self.ask < self.bid:
            raise ValueError("ask must be >= bid")


@dataclass(frozen=True)
class ExecutionConfig:
    slippage_price: float = 0.0

    def __post_init__(self) -> None:
        if self.slippage_price < 0:
            raise ValueError("slippage_price must be >= 0")


def market_entry_price(side: Side, quote: Quote, config: ExecutionConfig) -> float:
    if side is Side.LONG:
        return quote.ask + config.slippage_price
    if side is Side.SHORT:
        return quote.bid - config.slippage_price
    raise ValueError("entry side must be LONG or SHORT")


def market_exit_price(side: Side, quote: Quote, config: ExecutionConfig) -> float:
    if side is Side.LONG:
        return quote.bid - config.slippage_price
    if side is Side.SHORT:
        return quote.ask + config.slippage_price
    raise ValueError("exit side must be LONG or SHORT")


def add_market_tranche(
    inventory: InventoryState,
    quote: Quote,
    config: ExecutionConfig = ExecutionConfig(),
):
    px = market_entry_price(inventory.side, quote, config)
    action = inventory.add_tranche(px)
    return action, px


def pnl_from_fills(
    side: Side,
    fills: list[Fill],
    exit_quote: Quote,
    config: ExecutionConfig = ExecutionConfig(),
) -> dict:
    if not fills:
        return {
            "units": 0.0,
            "average_entry": None,
            "exit_price": None,
            "gross_price_units": 0.0,
        }
    units = sum(f.units for f in fills)
    avg = sum(f.price * f.units for f in fills) / units
    exit_px = market_exit_price(side, exit_quote, config)
    direction = 1.0 if side is Side.LONG else -1.0
    pnl = direction * (exit_px - avg) * units
    return {
        "units": units,
        "average_entry": avg,
        "exit_price": exit_px,
        "gross_price_units": pnl,
    }


def single_entry_round_trip(
    side: Side,
    *,
    units: float,
    entry_quote: Quote,
    exit_quote: Quote,
    config: ExecutionConfig = ExecutionConfig(),
) -> dict:
    if units <= 0:
        raise ValueError("units must be > 0")
    entry = market_entry_price(side, entry_quote, config)
    return pnl_from_fills(side, [Fill(entry, units)], exit_quote, config)
