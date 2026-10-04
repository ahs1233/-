"""GTGLab2 Doctrine Reference Experiment v0.1.

Preregistered in PROTOCOL_DOCTRINE_REFERENCE_V01.md.
Development-only; no Historical Holdout, Pristine Forward OOS, or forward
microstructure outcomes are read.
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
LAB = HERE.parent
LIB = LAB / "library-comparison"
DATA = LAB / "data"
ENGINE = HERE / "engine"
for p in (LIB, DATA, ENGINE):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import bars
from context_features import ma_geometry_frame
from contracts import Side
from execution import CostModel, entry_fill, exit_fill, pnl_points
from mtf_context import latest_completed_asof
from regime_atlas_v01 import load_h1
from session_context import session_narrative_frame


RAW_END = "2024-03-20"
SPLIT_MS = int(pd.Timestamp("2021-01-01T00:00:00Z").timestamp() * 1000)
STATE_COLUMNS = ["t", "state", "position24", "prior24_upper", "prior24_lower"]
SLIPPAGE = {"C0": 0.0, "C1": 0.5, "C2": 1.0}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atr14(frame: pd.DataFrame) -> pd.Series:
    c = frame["bc"].to_numpy(dtype=float)
    h = frame["bh"].to_numpy(dtype=float)
    l = frame["bl"].to_numpy(dtype=float)
    prev = np.r_[c[0], c[:-1]]
    tr = np.maximum(h - l, np.maximum(np.abs(h - prev), np.abs(l - prev)))
    return pd.Series(tr, index=frame.index).rolling(14, min_periods=14).mean()


def aggregate_from_h1(h1: pd.DataFrame, tf: str) -> pd.DataFrame:
    cols = ["t", "bo", "bh", "bl", "bc", "ao", "ah", "al", "ac", "v", "n", "src"]
    rows = bars.aggregate(h1[cols].to_dict("records"), tf)
    out = pd.DataFrame(rows)
    out["atr"] = atr14(out)
    return out


def prepare_context(h1: pd.DataFrame, state: pd.DataFrame) -> pd.DataFrame:
    f = h1.merge(state[STATE_COLUMNS], on="t", how="left", validate="one_to_one")
    ma = ma_geometry_frame(f["bc"], scale=f["atr"], lengths=(9, 21, 50, 200))
    for c in ma.columns:
        if c != "close":
            f[c] = ma[c].to_numpy()

    sess = session_narrative_frame(f[["t", "bo", "bh", "bl", "bc", "atr"]])
    for c in sess.columns:
        f[f"session_{c}" if c == "session" else c] = sess[c].to_numpy()

    h4 = aggregate_from_h1(h1, "H4")
    d1 = aggregate_from_h1(h1, "D")
    h4ma = ma_geometry_frame(h4["bc"], lengths=(50,))
    d1ma = ma_geometry_frame(d1["bc"], lengths=(50,))
    h4["ema50_slope_raw"] = h4ma["ema_50_slope1"].to_numpy()
    d1["ema50_slope_raw"] = d1ma["ema_50_slope1"].to_numpy()

    a4 = latest_completed_asof(f["t"], h4, "H4", ["ema50_slope_raw"])
    ad = latest_completed_asof(f["t"], d1, "D1", ["ema50_slope_raw"])
    f["h4_ema50_slope"] = a4["ema50_slope_raw"].to_numpy()
    f["d1_ema50_slope"] = ad["ema50_slope_raw"].to_numpy()
    h1s = np.sign(f["ema_50_slope1"].fillna(0).to_numpy(dtype=float))
    h4s = np.sign(f["h4_ema50_slope"].fillna(0).to_numpy(dtype=float))
    d1s = np.sign(f["d1_ema50_slope"].fillna(0).to_numpy(dtype=float))
    f["mtf_alignment_score"] = h1s + h4s + d1s
    return f


def base_candidate(r) -> tuple[str, Side] | None:
    state = r.state
    if state == "RANGE" and np.isfinite(r.position24):
        if r.position24 <= 0.20:
            return "RANGE", Side.LONG
        if r.position24 >= 0.80:
            return "RANGE", Side.SHORT
    if state == "TREND_UP":
        vals = (r.bc, r.ema_21, r.ema_50, r.ema_50_slope1)
        if all(np.isfinite(v) for v in vals):
            if r.bc <= r.ema_21 and r.bc >= r.ema_50 and r.ema_21 > r.ema_50 and r.ema_50_slope1 > 0:
                return "TREND", Side.LONG
    if state == "TREND_DOWN":
        vals = (r.bc, r.ema_21, r.ema_50, r.ema_50_slope1)
        if all(np.isfinite(v) for v in vals):
            if r.bc >= r.ema_21 and r.bc <= r.ema_50 and r.ema_21 < r.ema_50 and r.ema_50_slope1 < 0:
                return "TREND", Side.SHORT
    return None


def context_allows(r, mode: str, side: Side) -> bool:
    score = float(r.mtf_alignment_score)
    if mode == "RANGE":
        if side is Side.LONG:
            accepted = bool(r.accepted_below_prev_low) if pd.notna(r.accepted_below_prev_low) else False
            return (not accepted) and score >= -1
        accepted = bool(r.accepted_above_prev_high) if pd.notna(r.accepted_above_prev_high) else False
        return (not accepted) and score <= 1
    if side is Side.LONG:
        return score >= 1
    return score <= -1


def episode_exit(f: pd.DataFrame, i: int, mode: str, side: Side) -> dict | None:
    entry_idx = i + 1
    if entry_idx >= len(f) - 1:
        return None
    if mode == "RANGE":
        lower = float(f.prior24_lower.iloc[i])
        upper = float(f.prior24_upper.iloc[i])
        if not (np.isfinite(lower) and np.isfinite(upper) and upper > lower):
            return None
        midpoint = (lower + upper) / 2.0
        max_hold = 12
    else:
        lower = upper = midpoint = np.nan
        max_hold = 24

    last_signal = min(len(f) - 2, entry_idx + max_hold - 1)
    exit_kind = "TIMEOUT"
    signal_idx = last_signal

    for j in range(entry_idx, last_signal + 1):
        r = f.iloc[j]
        prev = f.iloc[j - 1]
        if mode == "RANGE":
            if side is Side.LONG:
                invalid = r.state == "TREND_DOWN" or (r.bc < lower and prev.bc < lower)
                target = r.bc >= midpoint
            else:
                invalid = r.state == "TREND_UP" or (r.bc > upper and prev.bc > upper)
                target = r.bc <= midpoint
            if invalid:
                signal_idx, exit_kind = j, "INVALIDATION"
                break
            if target:
                signal_idx, exit_kind = j, "TARGET"
                break
        else:
            if side is Side.LONG:
                invalid = r.state == "TREND_DOWN" or (np.isfinite(r.ema_50) and r.bc < r.ema_50)
            else:
                invalid = r.state == "TREND_UP" or (np.isfinite(r.ema_50) and r.bc > r.ema_50)
            if invalid:
                signal_idx, exit_kind = j, "INVALIDATION"
                break

    exit_idx = signal_idx + 1
    if exit_idx >= len(f):
        return None
    return {
        "candidate_idx": i,
        "entry_idx": entry_idx,
        "exit_signal_idx": signal_idx,
        "exit_idx": exit_idx,
        "exit_kind": exit_kind,
        "mode": mode,
        "side": side,
        "lower": lower,
        "upper": upper,
        "midpoint": midpoint,
    }


def staged_trigger(f: pd.DataFrame, ep: dict, j: int) -> bool:
    r = f.iloc[j]
    p = f.iloc[j - 1]
    side = ep["side"]
    mode = ep["mode"]

    if mode == "RANGE":
        if side is Side.LONG:
            sweep = r.bl < ep["lower"] and r.bc >= ep["lower"]
            ma_reclaim = np.isfinite(r.ema_9) and np.isfinite(p.ema_9) and r.bc > r.ema_9 and p.bc <= p.ema_9
            session_reject = bool(r.rejected_prev_low) if pd.notna(r.rejected_prev_low) else False
            continuation = np.isfinite(r.ema_9) and r.bc > p.bc and r.bc > r.ema_9
            return bool(sweep or ma_reclaim or session_reject or continuation)
        sweep = r.bh > ep["upper"] and r.bc <= ep["upper"]
        ma_reclaim = np.isfinite(r.ema_9) and np.isfinite(p.ema_9) and r.bc < r.ema_9 and p.bc >= p.ema_9
        session_reject = bool(r.rejected_prev_high) if pd.notna(r.rejected_prev_high) else False
        continuation = np.isfinite(r.ema_9) and r.bc < p.bc and r.bc < r.ema_9
        return bool(sweep or ma_reclaim or session_reject or continuation)

    if side is Side.LONG:
        ema21_reclaim = np.isfinite(r.ema_21) and r.bl <= r.ema_21 and r.bc > r.ema_21
        ema9_reclaim = np.isfinite(r.ema_9) and np.isfinite(p.ema_9) and r.bc > r.ema_9 and p.bc <= p.ema_9
        continuation = r.bh > p.bh and r.bc > p.bc
        return bool(ema21_reclaim or ema9_reclaim or continuation)
    ema21_reclaim = np.isfinite(r.ema_21) and r.bh >= r.ema_21 and r.bc < r.ema_21
    ema9_reclaim = np.isfinite(r.ema_9) and np.isfinite(p.ema_9) and r.bc < r.ema_9 and p.bc >= p.ema_9
    continuation = r.bl < p.bl and r.bc < p.bc
    return bool(ema21_reclaim or ema9_reclaim or continuation)


def fill_pnl(f: pd.DataFrame, ep: dict, policy: str, slippage_bps: float) -> dict:
    costs = CostModel(slippage_bps=slippage_bps, fee_bps=0)
    side = ep["side"]
    candidate = f.iloc[ep["candidate_idx"]]
    fills: list[tuple[float, float, int]] = []

    def add_fill(fill_idx: int, signal_idx: int, weight: float):
        atr = float(f.atr.iloc[signal_idx])
        if not np.isfinite(atr) or atr <= 0:
            return
        bar = f.iloc[fill_idx].to_dict()
        if not np.isfinite(bar.get("ao", np.nan)) or not np.isfinite(bar.get("bo", np.nan)):
            return
        px = entry_fill(bar, side, costs)
        fills.append((px, weight / atr, fill_idx))

    if policy == "SINGLE":
        add_fill(ep["entry_idx"], ep["candidate_idx"], 1.0)
    elif policy == "STAGED":
        add_fill(ep["entry_idx"], ep["candidate_idx"], 0.2)
        for j in range(ep["entry_idx"], ep["exit_signal_idx"]):
            if len(fills) >= 5:
                break
            if staged_trigger(f, ep, j):
                add_fill(j + 1, j, 0.2)
    else:
        raise ValueError(policy)

    if not fills:
        return {"mature": False}

    exit_bar = f.iloc[ep["exit_idx"]].to_dict()
    if not np.isfinite(exit_bar.get("ao", np.nan)) or not np.isfinite(exit_bar.get("bo", np.nan)):
        return {"mature": False}
    x = exit_fill(exit_bar, side, costs)
    total = sum(units * pnl_points(px, x, side) for px, units, _ in fills)
    risk_weight = 1.0 if policy == "SINGLE" else 0.2 * len(fills)
    avg_px = sum(px * units for px, units, _ in fills) / sum(units for _, units, _ in fills)
    return {
        "mature": True,
        "pnl_r": float(total),
        "tranches": len(fills),
        "risk_weight_used": float(risk_weight),
        "average_entry": float(avg_px),
        "exit_fill": float(x),
    }


def enumerate_episodes(f: pd.DataFrame, variant: str) -> list[dict]:
    episodes = []
    i = 80
    eid = 0
    while i < len(f) - 2:
        r = f.iloc[i]
        cand = base_candidate(r)
        if cand is None:
            i += 1
            continue
        mode, side = cand
        if variant == "CONTEXT" and not context_allows(r, mode, side):
            i += 1
            continue
        ep = episode_exit(f, i, mode, side)
        if ep is None:
            i += 1
            continue
        ep["episode_id"] = eid
        ep["decision_t"] = int(r.t)
        ep["block"] = "EARLY" if int(r.t) < SPLIT_MS else "LATE"
        ep["variant"] = variant
        episodes.append(ep)
        eid += 1
        i = max(i + 1, ep["exit_idx"])
    return episodes


def max_drawdown(vals: list[float]) -> float:
    if not vals:
        return 0.0
    c = np.cumsum(np.asarray(vals, dtype=float))
    peak = np.maximum.accumulate(np.r_[0.0, c])[:-1]
    dd = c - peak
    return float(np.min(dd))


def summarize(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    vals = np.asarray([r["pnl_r"] for r in rows], dtype=float)
    return {
        "n": int(len(rows)),
        "pnl_r_mean": float(np.mean(vals)),
        "pnl_r_median": float(np.median(vals)),
        "pnl_r_total": float(np.sum(vals)),
        "win_rate": float(np.mean(vals > 0)),
        "max_drawdown_r": max_drawdown(vals.tolist()),
        "avg_tranches": float(np.mean([r["tranches"] for r in rows])),
        "avg_risk_weight_used": float(np.mean([r["risk_weight_used"] for r in rows])),
        "exit_kind_counts": dict(Counter(r["exit_kind"] for r in rows)),
    }


def breakdown(rows: list[dict]) -> dict:
    out = {"overall": summarize(rows)}
    for key in ("mode", "direction", "block"):
        out[f"by_{key}"] = {}
        for val in sorted({r[key] for r in rows}):
            out[f"by_{key}"][str(val)] = summarize([r for r in rows if r[key] == val])
    return out


def run(root: Path, state_run: Path, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    protocol = HERE / "PROTOCOL_DOCTRINE_REFERENCE_V01.md"
    state_path = state_run / "state_sequence.csv.gz"

    h1, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    state = pd.read_csv(state_path)
    f = prepare_context(h1, state)

    all_rows = []
    pairing = {}
    for variant in ("BASE", "CONTEXT"):
        episodes = enumerate_episodes(f, variant)
        for cost_name, bps in SLIPPAGE.items():
            pair_diffs = []
            staged_beats = []
            for ep in episodes:
                per = {}
                for policy in ("SINGLE", "STAGED"):
                    res = fill_pnl(f, ep, policy, bps)
                    if not res.get("mature"):
                        continue
                    row = {
                        "episode_id": ep["episode_id"],
                        "variant": variant,
                        "cost": cost_name,
                        "slippage_bps": bps,
                        "policy": policy,
                        "mode": ep["mode"],
                        "direction": ep["side"].value,
                        "block": ep["block"],
                        "decision_t": ep["decision_t"],
                        "exit_kind": ep["exit_kind"],
                        **res,
                    }
                    all_rows.append(row)
                    per[policy] = row
                if "SINGLE" in per and "STAGED" in per:
                    d = per["STAGED"]["pnl_r"] - per["SINGLE"]["pnl_r"]
                    pair_diffs.append(d)
                    staged_beats.append(d > 0)
            pairing[f"{variant}_{cost_name}"] = {
                "paired_n": len(pair_diffs),
                "staged_minus_single_mean_r": float(np.mean(pair_diffs)) if pair_diffs else None,
                "staged_minus_single_median_r": float(np.median(pair_diffs)) if pair_diffs else None,
                "staged_beats_single_rate": float(np.mean(staged_beats)) if staged_beats else None,
            }

    rows_df = pd.DataFrame(all_rows)
    rows_df.to_csv(out / "episode_results.csv.gz", index=False, compression="gzip")

    report = {
        "scope": "GTGLab2 Doctrine Reference v0.1 development-only",
        "protocol_sha256": sha(protocol),
        "state_sequence_sha256": sha(state_path),
        "historical_holdout_read": False,
        "pristine_forward_oos_decoded": False,
        "microstructure_outcomes_read": False,
        "quality": quality,
        "rows": int(len(rows_df)),
        "pairing": pairing,
        "results": {},
    }
    if len(rows_df):
        for variant in ("BASE", "CONTEXT"):
            report["results"][variant] = {}
            for cost_name in SLIPPAGE:
                report["results"][variant][cost_name] = {}
                subset = rows_df[(rows_df.variant == variant) & (rows_df.cost == cost_name)]
                for policy in ("SINGLE", "STAGED"):
                    rr = subset[subset.policy == policy].to_dict("records")
                    report["results"][variant][cost_name][policy] = breakdown(rr)

    (out / "summary.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    report = run(Path(a.root), Path(a.state_run), Path(a.out))
    compact = {
        "rows": report["rows"],
        "pairing": report["pairing"],
        "base_c1": report["results"].get("BASE", {}).get("C1", {}),
        "context_c1": report["results"].get("CONTEXT", {}).get("C1", {}),
        "locks": {
            "historical_holdout_read": report["historical_holdout_read"],
            "pristine_forward_oos_decoded": report["pristine_forward_oos_decoded"],
            "microstructure_outcomes_read": report["microstructure_outcomes_read"],
        },
    }
    print(json.dumps(compact, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
