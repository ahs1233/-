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



def evidence_from_source_votes(source_votes: dict[str, tuple[int, ...]]) -> MicroEvidence:
    """Build frozen evidence while preserving source-family provenance.

    The mapping must contain only source families already deemed ready by the
    collection protocol. Zero votes remain valid neutral evidence.
    """
    if not source_votes:
        return MicroEvidence(ready_families=0, votes=())
    votes: list[int] = []
    for source in sorted(source_votes):
        vals = tuple(source_votes[source])
        if any(v not in (-1, 0, 1) for v in vals):
            raise ValueError(f"invalid vote for source {source}")
        votes.extend(vals)
    return MicroEvidence(ready_families=len(source_votes), votes=tuple(votes))


def classify_source_votes(
    side: Side,
    source_votes: dict[str, tuple[int, ...]],
) -> MicroAlignment:
    return classify_alignment(side, evidence_from_source_votes(source_votes))


def leave_one_source_out_alignments(
    side: Side,
    source_votes: dict[str, tuple[int, ...]],
) -> dict[str, MicroAlignment]:
    """Recompute alignment after removing each source family once."""
    if len(source_votes) < 2:
        raise ValueError("source ablation requires at least two source families")
    out: dict[str, MicroAlignment] = {}
    for removed in sorted(source_votes):
        kept = {
            name: votes
            for name, votes in source_votes.items()
            if name != removed
        }
        out[removed] = classify_source_votes(side, kept)
    return out
