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


# --- Fixed-R risk-allocation compatibility layer ---
# This is separate from the unit-budget InventoryState above.  It is used to
# prove the risk-envelope invariant independently of contract/lot sizing.

@dataclass(frozen=True)
class RiskPlan:
    total_risk_r: float = 1.0
    tranche_weights: tuple[float, ...] = (0.2, 0.2, 0.2, 0.2, 0.2)

    def __post_init__(self) -> None:
        if self.total_risk_r <= 0:
            raise ValueError("total_risk_r must be > 0")
        if not self.tranche_weights or any(w <= 0 for w in self.tranche_weights):
            raise ValueError("tranche weights must be positive")
        if abs(sum(self.tranche_weights) - 1.0) > 1e-12:
            raise ValueError("tranche weights must sum to 1")

    def risk_for(self, tranche_index: int) -> float:
        return self.total_risk_r * self.tranche_weights[tranche_index]


@dataclass(frozen=True)
class RiskInventoryState:
    side: Side = Side.FLAT
    tranches_filled: int = 0
    risk_committed_r: float = 0.0
    weighted_price_sum: float = 0.0
    weight_sum: float = 0.0
    invalidated: bool = False
    flip_wait: bool = False

    @property
    def average_price(self) -> float | None:
        return None if self.weight_sum <= 0 else self.weighted_price_sum / self.weight_sum


class InventoryEngine:
    """Immutable fixed-R tranche engine; never allows additions after invalidation."""

    def __init__(self, plan: RiskPlan):
        self.plan = plan

    def add(
        self,
        state: RiskInventoryState,
        side: Side,
        price: float,
        *,
        hypothesis_valid: bool,
    ) -> tuple[RiskInventoryState, Action]:
        if side is Side.FLAT:
            raise ValueError("cannot add FLAT")
        if state.invalidated or state.flip_wait or not hypothesis_valid:
            return state, Action.HOLD
        if state.side not in (Side.FLAT, side):
            raise ValueError("cannot add opposite side before exit")
        if state.tranches_filled >= len(self.plan.tranche_weights):
            return state, Action.HOLD
        i = state.tranches_filled
        risk = self.plan.risk_for(i)
        nxt = RiskInventoryState(
            side=side,
            tranches_filled=i + 1,
            risk_committed_r=state.risk_committed_r + risk,
            weighted_price_sum=state.weighted_price_sum + price * risk,
            weight_sum=state.weight_sum + risk,
            invalidated=False,
            flip_wait=False,
        )
        if nxt.risk_committed_r > self.plan.total_risk_r + 1e-12:
            raise AssertionError("risk budget exceeded")
        return nxt, Action.PROBE if i == 0 else Action.ADD

    def invalidate(self, state: RiskInventoryState) -> tuple[RiskInventoryState, Action]:
        return RiskInventoryState(
            side=state.side,
            tranches_filled=state.tranches_filled,
            risk_committed_r=state.risk_committed_r,
            weighted_price_sum=state.weighted_price_sum,
            weight_sum=state.weight_sum,
            invalidated=True,
            flip_wait=state.flip_wait,
        ), Action.EXIT

    def exit_to_flip_wait(self, state: RiskInventoryState) -> tuple[RiskInventoryState, Action]:
        return RiskInventoryState(flip_wait=True), Action.FLIP_WAIT

    def clear_flip_wait(self, state: RiskInventoryState) -> RiskInventoryState:
        return RiskInventoryState() if state.flip_wait else state
