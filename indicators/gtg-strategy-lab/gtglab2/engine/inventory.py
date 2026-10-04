"""Fixed-risk staged inventory state machine for GTGLab2."""
from __future__ import annotations

from dataclasses import dataclass, replace

from contracts import Action, Side


@dataclass(frozen=True)
class RiskPlan:
    total_risk_r: float = 1.0
    tranche_weights: tuple[float, ...] = (0.2, 0.2, 0.2, 0.2, 0.2)

    def __post_init__(self) -> None:
        if self.total_risk_r <= 0:
            raise ValueError("total_risk_r must be > 0")
        if not self.tranche_weights:
            raise ValueError("at least one tranche required")
        if any(w <= 0 for w in self.tranche_weights):
            raise ValueError("tranche weights must be > 0")
        if abs(sum(self.tranche_weights) - 1.0) > 1e-12:
            raise ValueError("tranche weights must sum to 1")

    def risk_for(self, tranche_index: int) -> float:
        return self.total_risk_r * self.tranche_weights[tranche_index]


@dataclass(frozen=True)
class InventoryState:
    side: Side = Side.FLAT
    tranches_filled: int = 0
    risk_committed_r: float = 0.0
    weighted_price_sum: float = 0.0
    weight_sum: float = 0.0
    invalidated: bool = False
    flip_wait: bool = False

    @property
    def average_price(self) -> float | None:
        if self.weight_sum <= 0:
            return None
        return self.weighted_price_sum / self.weight_sum


class InventoryEngine:
    def __init__(self, plan: RiskPlan):
        self.plan = plan

    def add(self, state: InventoryState, side: Side, price: float, *, hypothesis_valid: bool) -> tuple[InventoryState, Action]:
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
        next_state = replace(
            state,
            side=side,
            tranches_filled=i + 1,
            risk_committed_r=state.risk_committed_r + risk,
            weighted_price_sum=state.weighted_price_sum + price * risk,
            weight_sum=state.weight_sum + risk,
        )
        if next_state.risk_committed_r > self.plan.total_risk_r + 1e-12:
            raise AssertionError("risk budget exceeded")
        return next_state, Action.PROBE if i == 0 else Action.ADD

    def invalidate(self, state: InventoryState) -> tuple[InventoryState, Action]:
        return replace(state, invalidated=True), Action.EXIT

    def exit_to_flip_wait(self, state: InventoryState) -> tuple[InventoryState, Action]:
        flat = InventoryState(invalidated=False, flip_wait=True)
        return flat, Action.FLIP_WAIT

    def clear_flip_wait(self, state: InventoryState) -> InventoryState:
        if not state.flip_wait:
            return state
        return InventoryState()
