"""Acceptance/rejection and invalidation contracts for GTGLab2."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class BreakResolution(str, Enum):
    UNRESOLVED = "UNRESOLVED"
    REJECTION = "REJECTION"
    ACCEPTANCE = "ACCEPTANCE"


@dataclass(frozen=True)
class BreakEvidence:
    crossed_boundary: bool = False
    reclaimed_boundary: bool = False
    persisted_outside: bool = False
    failed_reclaim: bool = False
    structural_followthrough: bool = False


def resolve_break(e: BreakEvidence) -> BreakResolution:
    if not e.crossed_boundary:
        return BreakResolution.UNRESOLVED
    if e.reclaimed_boundary and not e.structural_followthrough:
        return BreakResolution.REJECTION
    if e.persisted_outside and e.failed_reclaim and e.structural_followthrough:
        return BreakResolution.ACCEPTANCE
    return BreakResolution.UNRESOLVED


@dataclass(frozen=True)
class InvalidationEvidence:
    opposite_acceptance: bool = False
    structural_invalid: bool = False
    mtf_against: bool = False
    time_expired: bool = False
    flow_against: bool = False


def invalidation_reasons(e: InvalidationEvidence) -> tuple[str, ...]:
    reasons = []
    if e.opposite_acceptance:
        reasons.append("opposite_acceptance")
    if e.structural_invalid:
        reasons.append("structural_invalid")
    if e.mtf_against:
        reasons.append("mtf_against")
    if e.time_expired:
        reasons.append("time_expired")
    if e.flow_against:
        reasons.append("flow_against")
    return tuple(reasons)


def is_invalidated(e: InvalidationEvidence) -> bool:
    """Architecture rule: structural/opposite/MTF evidence is hard invalidation.

    Time/flow evidence is recorded but is not promoted to a hard rule until a
    preregistered thresholded experiment is frozen.
    """
    return bool(e.opposite_acceptance or e.structural_invalid or e.mtf_against)
