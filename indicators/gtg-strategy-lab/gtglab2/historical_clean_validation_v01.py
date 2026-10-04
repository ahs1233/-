"""GTGLab2 Historical Clean Validation v0.1.

Preregistered in PROTOCOL_HISTORICAL_CLEAN_VALIDATION_V01.md before outcomes.
Reads Validation only; Historical Holdout is hard-locked by load_h1_capped().
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ENGINE = HERE / "engine"
LIB = HERE.parent / "library-comparison"
DATA = HERE.parent / "data"
for p in (HERE, ENGINE, LIB, DATA):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from dc_resumption_h4_validation_v01 import (
    FIRST_VALID_MS,
    TRAIN_END_MS,
    VAL_START_MS,
    VAL_END_MS,
    HOLDOUT_START_MS,
    RAW_CAP_MS,
    load_h1_capped,
    prefix_parity,
)
from state_transition_engine_v02 import add_cores, run_fsm, state_features
from doctrine_reference_v01 import SLIPPAGE, prepare_context
from sweep_acceptance_v01 import (
    discover_breaks,
    context_allows,
    build_episode,
    fill_pnl,
    breakdown,
)

PROTOCOL = HERE / "PROTOCOL_HISTORICAL_CLEAN_VALIDATION_V01.md"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _select_validation_episodes(
    f: pd.DataFrame,
    events: list[dict],
    variant: str,
) -> tuple[list[dict], dict]:
    out: list[dict] = []
    next_free = 0
    censored = Counter()
    midpoint = VAL_START_MS + (VAL_END_MS - VAL_START_MS) // 2

    for ev in events:
        sig_i = int(ev["signal_idx"])
        sig_t = int(f.t.iloc[sig_i])
        if not (VAL_START_MS <= sig_t < VAL_END_MS):
            continue
        if sig_i < next_free:
            censored["overlap"] += 1
            continue
        if variant == "CONTEXT" and not context_allows(f, ev):
            censored["context_blocked"] += 1
            continue

        ep = build_episode(f, ev)
        if ep is None:
            censored["no_complete_episode"] += 1
            continue

        max_hold = 12 if ev["resolution"] == "REJECTION" else 24
        expected_timeout_signal = int(ep["entry_idx"]) + max_hold - 1
        if ep["exit_kind"] == "TIMEOUT" and int(ep["exit_signal_idx"]) < expected_timeout_signal:
            censored["timeout_censored_at_validation_end"] += 1
            continue

        exit_t = int(f.t.iloc[int(ep["exit_idx"])])
        if exit_t >= VAL_END_MS or exit_t >= HOLDOUT_START_MS:
            censored["exit_not_mature_before_validation_end"] += 1
            continue

        ep["episode_id"] = len(out)
        ep["variant"] = variant
        ep["block"] = "VAL_EARLY" if sig_t < midpoint else "VAL_LATE"
        ep["signal_t"] = sig_t
        ep["exit_t"] = exit_t
        out.append(ep)
        next_free = int(ep["exit_idx"])

    return out, dict(censored)


def run(root: Path, train_state_run: Path, out: Path) -> dict:
    if out.exists():
        raise FileExistsError(out)
    out.mkdir(parents=True)
    if RAW_CAP_MS >= HOLDOUT_START_MS:
        raise AssertionError("HOLDOUT LOCK: raw cap reaches holdout")

    (out / "environment.json").write_text(
        json.dumps(
            {
                "created_utc": datetime.now(timezone.utc).isoformat(),
                "protocol_sha256": sha(PROTOCOL),
                "first_valid_ms": FIRST_VALID_MS,
                "train_end_ms": TRAIN_END_MS,
                "validation_start_ms": VAL_START_MS,
                "validation_end_ms": VAL_END_MS,
                "holdout_start_ms": HOLDOUT_START_MS,
                "raw_cap_ms": RAW_CAP_MS,
                "validation_read": True,
                "historical_holdout_read": False,
                "pristine_oos_read": False,
                "microstructure_outcomes_read": False,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    h1, quality = load_h1_capped(root, RAW_CAP_MS, out / "validation_input_manifest.json")
    if int(h1.t.max()) >= HOLDOUT_START_MS:
        raise AssertionError("HOLDOUT LOCK: H1 includes holdout")

    feat = add_cores(state_features(h1))
    states, _, fsm_diag = run_fsm(feat)
    feat["state"] = states

    train_state = train_state_run / "state_sequence.csv.gz"
    parity = prefix_parity(feat, train_state)
    (out / "prefix_parity.json").write_text(json.dumps(parity, indent=2), encoding="utf-8")

    state_cols = list(pd.read_csv(train_state, nrows=1).columns)
    state = feat[state_cols].copy()
    f = prepare_context(h1, state)
    if int(f.t.max()) >= HOLDOUT_START_MS:
        raise AssertionError("HOLDOUT LOCK after context build")

    events, discovery = discover_breaks(f)

    rows: list[dict] = []
    episode_counts = {}
    censored_by_variant = {}
    pairing = {}

    for variant in ("BASE", "CONTEXT"):
        eps, censored = _select_validation_episodes(f, events, variant)
        episode_counts[variant] = len(eps)
        censored_by_variant[variant] = censored

        for cost, bps in SLIPPAGE.items():
            diffs = []
            beats = []
            for ep in eps:
                got = {}
                for policy in ("SINGLE", "STAGED"):
                    res = fill_pnl(f, ep, policy, bps)
                    if not res.get("mature"):
                        continue
                    row = {
                        "episode_id": ep["episode_id"],
                        "variant": variant,
                        "cost": cost,
                        "policy": policy,
                        "resolution": ep["resolution"],
                        "direction": ep["side"].value,
                        "block": ep["block"],
                        "break_t": int(ep["break_t"]),
                        "signal_t": int(ep["signal_t"]),
                        "exit_t": int(ep["exit_t"]),
                        "exit_kind": ep["exit_kind"],
                        **res,
                    }
                    rows.append(row)
                    got[policy] = row
                if len(got) == 2:
                    d = got["STAGED"]["pnl_r"] - got["SINGLE"]["pnl_r"]
                    diffs.append(d)
                    beats.append(d > 0)

            pairing[f"{variant}_{cost}"] = {
                "paired_n": len(diffs),
                "staged_minus_single_mean_r": float(np.mean(diffs)) if diffs else None,
                "staged_minus_single_median_r": float(np.median(diffs)) if diffs else None,
                "staged_beats_single_rate": float(np.mean(beats)) if beats else None,
            }

    d = pd.DataFrame(rows)
    d.to_csv(out / "validation_episode_results.csv.gz", index=False, compression="gzip")

    report = {
        "scope": "GTGLab2 Historical Clean Validation v0.1",
        "protocol_sha256": sha(PROTOCOL),
        "train_state_content_parity": parity,
        "historical_holdout_read": False,
        "pristine_forward_oos_decoded": False,
        "microstructure_outcomes_read": False,
        "quality": quality,
        "fsm_diagnostics": fsm_diag,
        "discovery_all_pre_holdout": discovery,
        "validation_episode_counts": episode_counts,
        "censored": censored_by_variant,
        "pairing": pairing,
        "results": {},
    }

    for variant in ("BASE", "CONTEXT"):
        report["results"][variant] = {}
        for cost in SLIPPAGE:
            report["results"][variant][cost] = {}
            s = d[(d.variant == variant) & (d.cost == cost)]
            for policy in ("SINGLE", "STAGED"):
                report["results"][variant][cost][policy] = breakdown(
                    s[s.policy == policy].to_dict("records")
                )

    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    return report


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--train-state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    r = run(Path(a.root), Path(a.train_state_run), Path(a.out))
    compact = {
        "prefix_parity": r["train_state_content_parity"],
        "validation_episode_counts": r["validation_episode_counts"],
        "censored": r["censored"],
        "BASE_C1": r["results"]["BASE"]["C1"],
        "CONTEXT_C1": r["results"]["CONTEXT"]["C1"],
        "locks": {
            "historical_holdout_read": r["historical_holdout_read"],
            "pristine_forward_oos_decoded": r["pristine_forward_oos_decoded"],
            "microstructure_outcomes_read": r["microstructure_outcomes_read"],
        },
    }
    print(json.dumps(compact, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
