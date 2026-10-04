"""Frozen deterministic Swing/Scalper action contracts for GTGLab2.

All numeric values are inherited from preregistered Sweep/Acceptance v0.1.
No outcome access exists in this module.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from contracts import Side
from invalidation import BreakResolution


class ContractKind(str, Enum):
    SWING_V1 = "SWING_V1"
    SCALPER_V1 = "SCALPER_V1"


class BreakDirection(str, Enum):
    UP = "UP"
    DOWN = "DOWN"


@dataclass(frozen=True)
class ExecutionContract:
    kind: ContractKind
    max_tranches: int
    tranche_r: float
    timeout_h1_bars: int
    fill_delay_h1_bars: int
    target: str
    promotion_eligible: bool

    @property
    def total_r(self) -> float:
        return self.max_tranches * self.tranche_r


SWING_V1 = ExecutionContract(
    kind=ContractKind.SWING_V1,
    max_tranches=5,
    tranche_r=0.20,
    timeout_h1_bars=24,
    fill_delay_h1_bars=1,
    target="STRUCTURAL_CONTINUATION",
    promotion_eligible=False,
)

SCALPER_V1 = ExecutionContract(
    kind=ContractKind.SCALPER_V1,
    max_tranches=5,
    tranche_r=0.20,
    timeout_h1_bars=12,
    fill_delay_h1_bars=1,
    target="FROZEN_RANGE_MIDPOINT",
    promotion_eligible=False,
)


def side_for_break(kind: ContractKind, direction: BreakDirection) -> Side:
    if kind is ContractKind.SWING_V1:
        return Side.LONG if direction is BreakDirection.UP else Side.SHORT
    if kind is ContractKind.SCALPER_V1:
        return Side.SHORT if direction is BreakDirection.UP else Side.LONG
    raise ValueError(kind)


def resolution_required(kind: ContractKind) -> BreakResolution:
    if kind is ContractKind.SWING_V1:
        return BreakResolution.ACCEPTANCE
    if kind is ContractKind.SCALPER_V1:
        return BreakResolution.REJECTION
    raise ValueError(kind)


def mtf_allows(kind: ContractKind, side: Side, mtf_score: float) -> bool:
    """Apply the already preregistered H1/H4/D1 EMA50 sign-score rules."""
    if side is Side.FLAT:
        return False
    if kind is ContractKind.SWING_V1:
        return mtf_score >= 1 if side is Side.LONG else mtf_score <= -1
    if kind is ContractKind.SCALPER_V1:
        return mtf_score >= -1 if side is Side.LONG else mtf_score <= 1
    raise ValueError(kind)


@dataclass(frozen=True)
class SetupEvidence:
    kind: ContractKind
    direction: BreakDirection
    resolution: BreakResolution
    mtf_score: float
    retest_hold: bool = False


def setup_side(e: SetupEvidence) -> Side:
    if e.resolution is not resolution_required(e.kind):
        return Side.FLAT
    side = side_for_break(e.kind, e.direction)
    if e.kind is ContractKind.SWING_V1 and not e.retest_hold:
        return Side.FLAT
    if not mtf_allows(e.kind, side, e.mtf_score):
        return Side.FLAT
    return side


def can_add_tranche(
    contract: ExecutionContract,
    *,
    tranches_filled: int,
    hypothesis_valid: bool,
    new_registered_evidence: bool,
) -> bool:
    if tranches_filled < 0:
        raise ValueError("tranches_filled cannot be negative")
    return bool(
        hypothesis_valid
        and new_registered_evidence
        and tranches_filled < contract.max_tranches
    )


@dataclass(frozen=True)
class SwingInvalidation:
    opposite_trend: bool = False
    two_closes_back_inside: bool = False


def swing_invalidated(e: SwingInvalidation) -> bool:
    return bool(e.opposite_trend or e.two_closes_back_inside)


@dataclass(frozen=True)
class ScalperInvalidation:
    trend_in_original_break_direction: bool = False
    two_closes_outside_again: bool = False


def scalper_invalidated(e: ScalperInvalidation) -> bool:
    return bool(
        e.trend_in_original_break_direction
        or e.two_closes_outside_again
    )
