"""GTGLab2 Sweep / Acceptance Execution v0.1.

Preregistered before first run in PROTOCOL_SWEEP_ACCEPTANCE_V01.md.
Development-only; event formation is causal and does not use transition outcome
labels from transition_library.jsonl.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
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

from contracts import Side
from doctrine_reference_v01 import RAW_END, SLIPPAGE, prepare_context
from execution import CostModel, entry_fill, exit_fill, pnl_points
from regime_atlas_v01 import load_h1


SPLIT_MS = int(pd.Timestamp("2021-01-01T00:00:00Z").timestamp() * 1000)
STATE_COLUMNS = [
    "t", "state", "position24", "prior24_upper", "prior24_lower",
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def discover_breaks(f: pd.DataFrame) -> tuple[list[dict], dict]:
    events = []
    counts = Counter()
    for i in range(1, len(f) - 12):
        p = f.iloc[i - 1]
        r = f.iloc[i]
        if p.state != "RANGE" or r.state != "TRANSITION":
            continue
        upper = float(r.prior24_upper)
        lower = float(r.prior24_lower)
        if not (np.isfinite(upper) and np.isfinite(lower) and upper > lower):
            continue
        up = bool(r.bh > upper)
        down = bool(r.bl < lower)
        if up and down:
            counts["ambiguous_two_sided"] += 1
            continue
        if not up and not down:
            counts["transition_without_boundary_cross"] += 1
            continue
        break_dir = 1 if up else -1
        counts["boundary_breaks"] += 1

        resolution = None
        resolution_idx = None
        # Event bar itself can already be a sweep/reclaim.
        for j in range(i, min(len(f), i + 4)):
            q = f.iloc[j]
            if break_dir == 1:
                if q.bc <= upper:
                    resolution, resolution_idx = "REJECTION", j
                    break
                if j > i and f.bc.iloc[j - 1] > upper and q.bc > upper:
                    resolution, resolution_idx = "ACCEPTANCE", j
                    break
            else:
                if q.bc >= lower:
                    resolution, resolution_idx = "REJECTION", j
                    break
                if j > i and f.bc.iloc[j - 1] < lower and q.bc < lower:
                    resolution, resolution_idx = "ACCEPTANCE", j
                    break

        if resolution is None:
            counts["unresolved_4h"] += 1
            continue
        counts[resolution.lower()] += 1

        if resolution == "REJECTION":
            signal_idx = resolution_idx
            side = Side.SHORT if break_dir == 1 else Side.LONG
        else:
            signal_idx = None
            side = Side.LONG if break_dir == 1 else Side.SHORT
            for j in range(resolution_idx + 1, min(len(f) - 1, resolution_idx + 7)):
                q = f.iloc[j]
                if break_dir == 1:
                    held = q.bl <= upper and q.bc > upper
                else:
                    held = q.bh >= lower and q.bc < lower
                if held:
                    signal_idx = j
                    break
            if signal_idx is None:
                counts["acceptance_without_retest"] += 1
                continue
            counts["acceptance_with_retest"] += 1

        events.append({
            "break_idx": i,
            "break_t": int(r.t),
            "break_dir": break_dir,
            "resolution": resolution,
            "resolution_idx": int(resolution_idx),
            "signal_idx": int(signal_idx),
            "side": side,
            "upper": upper,
            "lower": lower,
            "midpoint": (upper + lower) / 2.0,
        })
    return events, dict(counts)


def context_allows(f: pd.DataFrame, ev: dict) -> bool:
    score = float(f.mtf_alignment_score.iloc[ev["signal_idx"]])
    if ev["resolution"] == "REJECTION":
        if ev["side"] is Side.SHORT:
            return score <= 1
        return score >= -1
    if ev["side"] is Side.LONG:
        return score >= 1
    return score <= -1


def build_episode(f: pd.DataFrame, ev: dict) -> dict | None:
    signal_idx = ev["signal_idx"]
    entry_idx = signal_idx + 1
    if entry_idx >= len(f) - 1:
        return None
    mode = ev["resolution"]
    side = ev["side"]
    max_hold = 12 if mode == "REJECTION" else 24
    last_signal = min(len(f) - 2, entry_idx + max_hold - 1)
    exit_signal = last_signal
    exit_kind = "TIMEOUT"

    for j in range(entry_idx, last_signal + 1):
        r = f.iloc[j]
        p = f.iloc[j - 1]
        if mode == "REJECTION":
            if ev["break_dir"] == 1:
                invalid = r.state == "TREND_UP" or (r.bc > ev["upper"] and p.bc > ev["upper"])
                target = r.bc <= ev["midpoint"]
            else:
                invalid = r.state == "TREND_DOWN" or (r.bc < ev["lower"] and p.bc < ev["lower"])
                target = r.bc >= ev["midpoint"]
            if invalid:
                exit_signal, exit_kind = j, "INVALIDATION"
                break
            if target:
                exit_signal, exit_kind = j, "TARGET"
                break
        else:
            if ev["break_dir"] == 1:
                invalid = r.state == "TREND_DOWN" or (r.bc <= ev["upper"] and p.bc <= ev["upper"])
            else:
                invalid = r.state == "TREND_UP" or (r.bc >= ev["lower"] and p.bc >= ev["lower"])
            if invalid:
                exit_signal, exit_kind = j, "INVALIDATION"
                break

    exit_idx = exit_signal + 1
    if exit_idx >= len(f):
        return None
    return {
        **ev,
        "entry_idx": entry_idx,
        "exit_signal_idx": exit_signal,
        "exit_idx": exit_idx,
        "exit_kind": exit_kind,
        "block": "EARLY" if ev["break_t"] < SPLIT_MS else "LATE",
    }


def staged_trigger(f: pd.DataFrame, ep: dict, j: int) -> bool:
    r = f.iloc[j]
    p = f.iloc[j - 1]
    side = ep["side"]

    if ep["resolution"] == "REJECTION":
        if side is Side.SHORT:
            boundary = r.bh >= ep["upper"] and r.bc < ep["upper"]
            ema9 = np.isfinite(r.ema_9) and np.isfinite(p.ema_9) and r.bc < r.ema_9 and p.bc >= p.ema_9
            cont = r.bc < p.bc and r.bl < p.bl
        else:
            boundary = r.bl <= ep["lower"] and r.bc > ep["lower"]
            ema9 = np.isfinite(r.ema_9) and np.isfinite(p.ema_9) and r.bc > r.ema_9 and p.bc <= p.ema_9
            cont = r.bc > p.bc and r.bh > p.bh
        return bool(boundary or ema9 or cont)

    if side is Side.LONG:
        boundary = r.bl <= ep["upper"] and r.bc > ep["upper"]
        ema = (
            (np.isfinite(r.ema_9) and r.bc > r.ema_9)
            or (np.isfinite(r.ema_21) and r.bc > r.ema_21)
        )
        cont = r.bc > p.bc and r.bh > p.bh
    else:
        boundary = r.bh >= ep["lower"] and r.bc < ep["lower"]
        ema = (
            (np.isfinite(r.ema_9) and r.bc < r.ema_9)
            or (np.isfinite(r.ema_21) and r.bc < r.ema_21)
        )
        cont = r.bc < p.bc and r.bl < p.bl
    return bool(boundary or (ema and cont))


def fill_pnl(f: pd.DataFrame, ep: dict, policy: str, bps: float) -> dict:
    costs = CostModel(slippage_bps=bps, fee_bps=0.0)
    side = ep["side"]
    fills: list[tuple[float, float, float]] = []

    def add(fill_idx: int, signal_idx: int, weight: float):
        atr = float(f.atr.iloc[signal_idx])
        if not np.isfinite(atr) or atr <= 0:
            return
        bar = f.iloc[fill_idx].to_dict()
        if not np.isfinite(bar.get("ao", np.nan)) or not np.isfinite(bar.get("bo", np.nan)):
            return
        fills.append((entry_fill(bar, side, costs), weight / atr, weight))

    if policy == "SINGLE":
        add(ep["entry_idx"], ep["signal_idx"], 1.0)
    else:
        add(ep["entry_idx"], ep["signal_idx"], 0.2)
        for j in range(ep["entry_idx"], ep["exit_signal_idx"]):
            if len(fills) >= 5:
                break
            if staged_trigger(f, ep, j):
                add(j + 1, j, 0.2)

    if not fills:
        return {"mature": False}
    xb = f.iloc[ep["exit_idx"]].to_dict()
    if not np.isfinite(xb.get("ao", np.nan)) or not np.isfinite(xb.get("bo", np.nan)):
        return {"mature": False}
    x = exit_fill(xb, side, costs)
    pnl = sum(units * pnl_points(px, x, side) for px, units, _ in fills)
    risk_used = sum(w for _, _, w in fills)
    return {
        "mature": True,
        "pnl_r": float(pnl),
        "tranches": len(fills),
        "risk_weight_used": float(risk_used),
    }


def select_nonoverlap(f: pd.DataFrame, events: list[dict], variant: str) -> list[dict]:
    out = []
    next_free = 0
    eid = 0
    for ev in events:
        if ev["signal_idx"] < next_free:
            continue
        if variant == "CONTEXT" and not context_allows(f, ev):
            continue
        ep = build_episode(f, ev)
        if ep is None:
            continue
        ep["episode_id"] = eid
        ep["variant"] = variant
        out.append(ep)
        eid += 1
        next_free = ep["exit_idx"]
    return out


def max_drawdown(vals) -> float:
    if not vals:
        return 0.0
    c = np.cumsum(np.asarray(vals, dtype=float))
    peak = np.maximum.accumulate(np.r_[0.0, c])[:-1]
    return float(np.min(c - peak))


def summarize(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    v = np.asarray([r["pnl_r"] for r in rows], dtype=float)
    norm = np.asarray([r["pnl_r"] / r["risk_weight_used"] for r in rows], dtype=float)
    return {
        "n": len(rows),
        "pnl_r_mean": float(v.mean()),
        "pnl_r_median": float(np.median(v)),
        "pnl_r_total": float(v.sum()),
        "win_rate": float(np.mean(v > 0)),
        "max_drawdown_r": max_drawdown(v.tolist()),
        "avg_tranches": float(np.mean([r["tranches"] for r in rows])),
        "avg_risk_weight_used": float(np.mean([r["risk_weight_used"] for r in rows])),
        "mean_pnl_per_used_r": float(norm.mean()),
        "median_pnl_per_used_r": float(np.median(norm)),
        "exit_kind_counts": dict(Counter(r["exit_kind"] for r in rows)),
    }


def breakdown(rows: list[dict]) -> dict:
    out = {"overall": summarize(rows)}
    for k in ("resolution", "direction", "block"):
        out[f"by_{k}"] = {
            str(v): summarize([r for r in rows if r[k] == v])
            for v in sorted({r[k] for r in rows})
        }
    return out


def run(root: Path, state_run: Path, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    protocol = HERE / "PROTOCOL_SWEEP_ACCEPTANCE_V01.md"
    state_path = state_run / "state_sequence.csv.gz"
    h1, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    state = pd.read_csv(state_path)
    f = prepare_context(h1, state)
    events, discovery = discover_breaks(f)

    rows = []
    pair = {}
    episode_counts = {}
    for variant in ("BASE", "CONTEXT"):
        eps = select_nonoverlap(f, events, variant)
        episode_counts[variant] = len(eps)
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
                        "break_t": ep["break_t"],
                        "exit_kind": ep["exit_kind"],
                        **res,
                    }
                    rows.append(row)
                    got[policy] = row
                if len(got) == 2:
                    d = got["STAGED"]["pnl_r"] - got["SINGLE"]["pnl_r"]
                    diffs.append(d)
                    beats.append(d > 0)
            pair[f"{variant}_{cost}"] = {
                "paired_n": len(diffs),
                "staged_minus_single_mean_r": float(np.mean(diffs)) if diffs else None,
                "staged_minus_single_median_r": float(np.median(diffs)) if diffs else None,
                "staged_beats_single_rate": float(np.mean(beats)) if beats else None,
            }

    d = pd.DataFrame(rows)
    d.to_csv(out / "episode_results.csv.gz", index=False, compression="gzip")
    report = {
        "scope": "GTGLab2 Sweep / Acceptance v0.1 development-only",
        "protocol_sha256": sha(protocol),
        "state_sequence_sha256": sha(state_path),
        "historical_holdout_read": False,
        "pristine_forward_oos_decoded": False,
        "microstructure_outcomes_read": False,
        "quality": quality,
        "discovery": discovery,
        "raw_tradeable_events": len(events),
        "episode_counts": episode_counts,
        "pairing": pair,
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
    (out / "summary.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    r = run(Path(a.root), Path(a.state_run), Path(a.out))
    compact = {
        "discovery": r["discovery"],
        "episode_counts": r["episode_counts"],
        "pairing": r["pairing"],
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
