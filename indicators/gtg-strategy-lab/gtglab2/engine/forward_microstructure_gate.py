"""Frozen outcome-free microstructure vote gate for GTGLab2.

This module can classify contemporaneous evidence, but contains no market
outcome access and no fitted magnitude threshold.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from contracts import Side


class MicroAlignment(str, Enum):
    INSUFFICIENT = "INSUFFICIENT"
    MIXED = "MIXED"
    ALIGNED = "ALIGNED"
    OPPOSED = "OPPOSED"


@dataclass(frozen=True)
class MicroEvidence:
    ready_families: int
    votes: tuple[int, ...]

    def __post_init__(self) -> None:
        if self.ready_families < 0:
            raise ValueError("ready_families cannot be negative")
        if any(v not in (-1, 0, 1) for v in self.votes):
            raise ValueError("votes must be -1, 0, or +1")


def classify_alignment(side: Side, evidence: MicroEvidence) -> MicroAlignment:
    if side is Side.FLAT:
        raise ValueError("side must be LONG or SHORT")
    if evidence.ready_families < 2:
        return MicroAlignment.INSUFFICIENT
    nonzero = [v for v in evidence.votes if v]
    if not nonzero:
        return MicroAlignment.INSUFFICIENT
    s = sum(nonzero)
    if s == 0:
        return MicroAlignment.MIXED
    directional = 1 if side is Side.LONG else -1
    return MicroAlignment.ALIGNED if s * directional > 0 else MicroAlignment.OPPOSED


def treatment_action(side: Side, evidence: MicroEvidence) -> str:
    a = classify_alignment(side, evidence)
    if a is MicroAlignment.ALIGNED:
        return "TAKE"
    if a is MicroAlignment.OPPOSED:
        return "SKIP"
    return "BASELINE_UNCHANGED"
