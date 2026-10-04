"""Outcome-agnostic episode/time-block evaluation helpers for GTGLab2."""
from __future__ import annotations

from dataclasses import dataclass
from collections import Counter
from typing import Iterable

from action_contracts import ExecutionContract


H1_MS = 3_600_000


@dataclass(frozen=True, order=True)
class Episode:
    start_ms: int
    end_ms: int
    side: str = ""
    session: str = ""
    regime: str = ""
    candidate: str = ""

    def __post_init__(self) -> None:
        if self.end_ms < self.start_ms:
            raise ValueError("episode end before start")


@dataclass(frozen=True)
class TimeBlock:
    start_ms: int
    end_ms: int

    def __post_init__(self) -> None:
        if self.end_ms < self.start_ms:
            raise ValueError("block end before start")


def purge_ms_for_contract(contract: ExecutionContract) -> int:
    return (contract.timeout_h1_bars + contract.fill_delay_h1_bars) * H1_MS


def _inside(ep: Episode, block: TimeBlock) -> bool:
    return ep.start_ms >= block.start_ms and ep.end_ms <= block.end_ms


def purged_train_test(
    episodes: Iterable[Episode],
    *,
    train: TimeBlock,
    test: TimeBlock,
    purge_ms: int,
) -> tuple[list[Episode], list[Episode]]:
    """Return chronological train/test episodes with a pre-test purge."""
    if purge_ms < 0:
        raise ValueError("purge_ms cannot be negative")
    if train.end_ms >= test.start_ms:
        raise ValueError("train block must end before test block starts")

    eps = sorted(episodes)
    test_eps = [e for e in eps if _inside(e, test)]
    purge_cut = test.start_ms - purge_ms
    train_eps = [
        e for e in eps
        if _inside(e, train) and e.end_ms < purge_cut
    ]
    return train_eps, test_eps


def cluster_overlapping_episodes(episodes: Iterable[Episode]) -> list[TimeBlock]:
    """Merge overlapping/touching episodes into dependency clusters."""
    eps = sorted(episodes)
    if not eps:
        return []
    out: list[TimeBlock] = []
    cur_start = eps[0].start_ms
    cur_end = eps[0].end_ms
    for e in eps[1:]:
        if e.start_ms <= cur_end:
            cur_end = max(cur_end, e.end_ms)
        else:
            out.append(TimeBlock(cur_start, cur_end))
            cur_start, cur_end = e.start_ms, e.end_ms
    out.append(TimeBlock(cur_start, cur_end))
    return out


def coverage_report(episodes: Iterable[Episode]) -> dict:
    eps = list(episodes)
    clusters = cluster_overlapping_episodes(eps)
    return {
        "episodes": len(eps),
        "dependency_clusters": len(clusters),
        "by_side": dict(Counter(e.side for e in eps if e.side)),
        "by_session": dict(Counter(e.session for e in eps if e.session)),
        "by_regime": dict(Counter(e.regime for e in eps if e.regime)),
        "by_candidate": dict(Counter(e.candidate for e in eps if e.candidate)),
    }


def leave_one_source_out(sources: Iterable[str]) -> dict[str, tuple[str, ...]]:
    """Frozen leave-one-source-family-out ablation map."""
    uniq = tuple(sorted(set(sources)))
    if len(uniq) < 2:
        raise ValueError("at least two source families required")
    return {
        removed: tuple(s for s in uniq if s != removed)
        for removed in uniq
    }


def assert_no_episode_overlap(train: Iterable[Episode], test: Iterable[Episode]) -> None:
    for a in train:
        for b in test:
            if a.start_ms <= b.end_ms and b.start_ms <= a.end_ms:
                raise AssertionError(f"train/test episode overlap: {a} vs {b}")
