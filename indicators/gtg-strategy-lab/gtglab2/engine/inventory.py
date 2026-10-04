"""Fixed-risk bidirectional inventory state machine for GTGLab2."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from contracts import Action, PositionBudget, Side, mirror_side


class InventoryStatus(str, Enum):
    READY = "READY"
    ACTIVE = "ACTIVE"
    INVALIDATED = "INVALIDATED"
    FLIP_WAIT = "FLIP_WAIT"
    CLOSED = "CLOSED"


@dataclass(frozen=True)
class Fill:
    price: float
    units: float


@dataclass
class InventoryState:
    side: Side
    budget: PositionBudget
    status: InventoryStatus = InventoryStatus.READY
    fills: list[Fill] = field(default_factory=list)
    desired_flip_side: Side = Side.FLAT

    def __post_init__(self) -> None:
        if self.side not in (Side.LONG, Side.SHORT):
            raise ValueError("inventory side must be LONG or SHORT")

    @property
    def units(self) -> float:
        return sum(f.units for f in self.fills)

    @property
    def remaining_units(self) -> float:
        return max(0.0, self.budget.total_units - self.units)

    @property
    def tranche_units(self) -> float:
        return self.budget.equal_tranche_units

    @property
    def average_price(self) -> float | None:
        if not self.fills:
            return None
        return sum(f.price * f.units for f in self.fills) / self.units

    @property
    def tranche_count(self) -> int:
        return len(self.fills)

    def _assert_can_add(self) -> None:
        if self.status in (
            InventoryStatus.INVALIDATED,
            InventoryStatus.FLIP_WAIT,
            InventoryStatus.CLOSED,
        ):
            raise RuntimeError(f"cannot add while status={self.status.value}")
        if self.tranche_count >= self.budget.tranches:
            raise RuntimeError("registered tranche count exhausted")
        if self.remaining_units + 1e-12 < self.tranche_units:
            raise RuntimeError("fixed total risk budget exhausted")

    def add_tranche(self, price: float) -> Action:
        if price <= 0:
            raise ValueError("price must be positive")
        self._assert_can_add()
        self.fills.append(Fill(float(price), self.tranche_units))
        self.status = InventoryStatus.ACTIVE
        return Action.PROBE if self.tranche_count == 1 else Action.ADD

    def invalidate(self) -> tuple[Action, float]:
        exit_units = self.units
        self.status = InventoryStatus.INVALIDATED
        return Action.EXIT, exit_units

    def enter_flip_wait(self) -> tuple[Action, Side]:
        if self.status is not InventoryStatus.INVALIDATED:
            raise RuntimeError("FLIP_WAIT requires prior invalidation")
        self.desired_flip_side = mirror_side(self.side)
        self.status = InventoryStatus.FLIP_WAIT
        return Action.FLIP_WAIT, self.desired_flip_side

    def close(self) -> None:
        self.fills.clear()
        self.status = InventoryStatus.CLOSED

    def snapshot(self) -> dict:
        return {
            "side": self.side.value,
            "status": self.status.value,
            "tranche_count": self.tranche_count,
            "units": self.units,
            "remaining_units": self.remaining_units,
            "average_price": self.average_price,
            "desired_flip_side": self.desired_flip_side.value,
        }
