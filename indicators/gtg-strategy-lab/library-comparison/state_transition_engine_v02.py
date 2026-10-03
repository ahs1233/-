"""GTG State + Transition Engine v0.2.

Causal finite-state map:
RANGE -> TRANSITION -> TREND_UP / TREND_DOWN / RANGE

Preregistered in PROTOCOL_STATE_TRANSITION_ENGINE_V0_2.md.
Trading-time continuity accepts adjacent complete H1 bars separated by <=3 wall-clock hours.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as md
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
from regime_atlas_v01 import load_h1, efficiency
from multiscale_symbolic_v01 import multiscale_matrix, ms

PROTOCOL = HERE / "PROTOCOL_STATE_TRANSITION_ENGINE_V0_2.md"
RAW_END = "2024-03-20"
SPLIT = "2021-01-01"
STEP = 3_600_000
MAX_CONTIG_GAP = 3 * STEP
BASE = 0.005
HORIZONS = (1, 4, 12, 24)
STATE_NAMES = ("RANGE", "TRANSITION", "TREND_UP", "TREND_DOWN")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def session_utc(t_ms: int) -> str:
    h = pd.to_datetime(t_ms, unit="ms", utc=True).hour
    if h <= 6:
        return "Asia"
    if h <= 12:
        return "London"
    if h <= 20:
        return "New York"
    return "Late"


def state_features(f: pd.DataFrame) -> pd.DataFrame:
    base, names, _ = multiscale_matrix(f, BASE)
    pos = {n: i for i, n in enumerate(names)}

    dirs = np.column_stack([
        base[:, pos["dc0p5_dir"]],
        base[:, pos["dc1p0_dir"]],
        base[:, pos["dc2p0_dir"]],
        base[:, pos["dc4p0_dir"]],
    ])
    c = f.bc.to_numpy(dtype=float)
    atr = f.atr.to_numpy(dtype=float)

    drift12 = base[:, pos["drift12"]].astype(float)
    spread_atr = base[:, pos["spread_atr"]].astype(float)

    drift24 = np.full(len(f), np.nan, dtype=float)
    drift48 = np.full(len(f), np.nan, dtype=float)
    drift24[24:] = (c[24:] - c[:-24]) / atr[24:]
    drift48[48:] = (c[48:] - c[:-48]) / atr[48:]

    eff24 = efficiency(c, 24)
    eff48 = efficiency(c, 48)

    atr_week = pd.Series(atr).rolling(168, min_periods=168).median().to_numpy()
    atr_week_ratio = atr / atr_week

    bh = pd.Series(f.bh.to_numpy(dtype=float))
    bl = pd.Series(f.bl.to_numpy(dtype=float))
    upper = bh.shift(1).rolling(24, min_periods=24).max().to_numpy()
    lower = bl.shift(1).rolling(24, min_periods=24).min().to_numpy()
    width = upper - lower
    width_atr = width / atr

    position = np.full(len(f), np.nan, dtype=float)
    good_width = np.isfinite(width) & (width > 0)
    position[good_width] = (c[good_width] - lower[good_width]) / width[good_width]

    breakout_up_atr = (c - upper) / atr
    breakout_down_atr = (lower - c) / atr

    out = pd.DataFrame({
        "t": f.t.to_numpy(dtype=np.int64),
        "close": c,
        "atr": atr,
        "dc0p5_dir": dirs[:, 0],
        "dc1p0_dir": dirs[:, 1],
        "dc2p0_dir": dirs[:, 2],
        "dc4p0_dir": dirs[:, 3],
        "dc_up_count": np.sum(dirs == 1, axis=1),
        "dc_down_count": np.sum(dirs == -1, axis=1),
        "drift12": drift12,
        "drift24": drift24,
        "drift48": drift48,
        "efficiency24": eff24,
        "efficiency48": eff48,
        "spread_atr": spread_atr,
        "atr_week_ratio": atr_week_ratio,
        "prior24_upper": upper,
        "prior24_lower": lower,
        "prior24_width_atr": width_atr,
        "position24": position,
        "breakout_up_atr": breakout_up_atr,
        "breakout_down_atr": breakout_down_atr,
    })

    essentials = [
        "atr", "drift12", "drift24", "drift48",
        "efficiency24", "efficiency48", "spread_atr",
        "atr_week_ratio", "prior24_upper", "prior24_lower",
        "prior24_width_atr", "position24",
        "breakout_up_atr", "breakout_down_atr",
        "dc0p5_dir", "dc1p0_dir", "dc2p0_dir", "dc4p0_dir",
    ]
    out["valid"] = np.all(np.isfinite(out[essentials].to_numpy(dtype=float)), axis=1)
    return out


def add_cores(x: pd.DataFrame) -> pd.DataFrame:
    x = x.copy()
    range_votes = (
        (x.efficiency24 <= 0.35).astype(int)
        + (x.efficiency48 <= 0.35).astype(int)
        + (x.drift24.abs() <= 1.50).astype(int)
        + (x.drift48.abs() <= 3.00).astype(int)
    )
    x["range_votes"] = range_votes
    x["range_core"] = range_votes >= 3
    x["trend_up_core"] = (
        (x.dc_up_count >= 3)
        & (x.drift24 >= 1.00)
        & (x.efficiency24 >= 0.35)
    )
    x["trend_down_core"] = (
        (x.dc_down_count >= 3)
        & (x.drift24 <= -1.00)
        & (x.efficiency24 >= 0.35)
    )
    x["breakout_up"] = x.breakout_up_atr >= 0.10
    x["breakout_down"] = x.breakout_down_atr >= 0.10
    if bool((x.breakout_up & x.breakout_down).any()):
        raise AssertionError("simultaneous breakout up/down")
    return x


def _initial_state(r) -> tuple[str, int]:
    if bool(r.range_core):
        return "RANGE", 0
    if bool(r.trend_up_core):
        return "TREND_UP", 1
    if bool(r.trend_down_core):
        return "TREND_DOWN", -1
    return "TRANSITION", 0


def _inside(close: float, lower: float, upper: float) -> bool:
    return bool(lower <= close <= upper)


def _new_range_event(r, i: int, direction: int, trigger: str, range_age: int) -> dict:
    return {
        "event_id": None,
        "start_idx": int(i),
        "time": int(r.t),
        "candidate_direction": int(direction),
        "trigger_type": trigger,
        "source_state": "RANGE",
        "range_age": int(range_age),
        "primary": bool(range_age >= 6),
        "frozen_upper": float(r.prior24_upper),
        "frozen_lower": float(r.prior24_lower),
        "prior24_width_atr": float(r.prior24_width_atr),
        "position24": float(np.clip(r.position24, 0.0, 1.0)),
        "dc0p5_dir": int(r.dc0p5_dir),
        "dc1p0_dir": int(r.dc1p0_dir),
        "dc2p0_dir": int(r.dc2p0_dir),
        "dc4p0_dir": int(r.dc4p0_dir),
        "dc_up_count": int(r.dc_up_count),
        "dc_down_count": int(r.dc_down_count),
        "drift12": float(r.drift12),
        "drift24": float(r.drift24),
        "drift48": float(r.drift48),
        "efficiency24": float(r.efficiency24),
        "efficiency48": float(r.efficiency48),
        "spread_atr": float(r.spread_atr),
        "atr_week_ratio": float(r.atr_week_ratio),
        "session_utc": session_utc(int(r.t)),
        "fsm_resolution": None,
        "resolution_delay_bars": None,
        "resolution_time": None,
    }


def run_fsm(x: pd.DataFrame) -> tuple[list[str | None], list[dict], dict]:
    n = len(x)
    states: list[str | None] = [None] * n
    events: list[dict] = []
    transition_meta: dict | None = None

    prev_valid_i = None
    prev_state = None
    range_age = 0
    range_core_streak = 0

    gap_resets = 0
    max_transition_age_seen = 0

    def resolve_event(meta, resolution, i, age):
        if meta and meta.get("event_index") is not None:
            e = events[meta["event_index"]]
            if e["fsm_resolution"] is None:
                e["fsm_resolution"] = resolution
                e["resolution_delay_bars"] = int(max(0, age - 1))
                e["resolution_time"] = int(x.t.iloc[i])

    def start_transition(i, source, direction, trigger=None, source_range_age=0):
        nonlocal transition_meta
        r = x.iloc[i]
        event_index = None
        upper = lower = None
        if source == "RANGE":
            ev = _new_range_event(r, i, direction, trigger, source_range_age)
            ev["event_id"] = len(events)
            event_index = len(events)
            events.append(ev)
            upper = float(r.prior24_upper)
            lower = float(r.prior24_lower)

        transition_meta = {
            "source": source,
            "direction": int(direction),
            "start_i": int(i),
            "prev_close": float(r.close),
            "upper": upper,
            "lower": lower,
            "event_index": event_index,
            "target_core_streak": 0,
            "range_streak": 0,
            "up_streak": 0,
            "down_streak": 0,
        }

    for i in range(n):
        r = x.iloc[i]
        if not bool(r.valid):
            continue

        contiguous = (
            prev_valid_i is not None
            and 0 < int(r.t) - int(x.t.iloc[prev_valid_i]) <= MAX_CONTIG_GAP
        )

        if prev_valid_i is not None and not contiguous:
            if prev_state == "TRANSITION" and transition_meta is not None:
                age = i - transition_meta["start_i"]
                if transition_meta.get("event_index") is not None:
                    e = events[transition_meta["event_index"]]
                    if e["fsm_resolution"] is None:
                        e["fsm_resolution"] = "UNRESOLVED_GAP"
                        e["resolution_delay_bars"] = None
                        e["resolution_time"] = None
            gap_resets += 1
            prev_state = None
            transition_meta = None
            range_age = 0
            range_core_streak = 0

        if prev_state is None:
            state, direction = _initial_state(r)
            states[i] = state
            if state == "RANGE":
                range_age = 1
            elif state == "TRANSITION":
                start_transition(i, "INIT", direction)
            prev_state = state
            prev_valid_i = i
            continue

        if prev_state == "RANGE":
            trigger = None
            direction = 0
            if bool(r.breakout_up):
                trigger, direction = "BREAKOUT", 1
            elif bool(r.breakout_down):
                trigger, direction = "BREAKOUT", -1
            elif bool(r.trend_up_core):
                trigger, direction = "TREND_CORE", 1
            elif bool(r.trend_down_core):
                trigger, direction = "TREND_CORE", -1

            if trigger is None:
                states[i] = "RANGE"
                range_age += 1
            else:
                states[i] = "TRANSITION"
                start_transition(i, "RANGE", direction, trigger, range_age)
                range_age = 0

        elif prev_state == "TRANSITION":
            meta = transition_meta
            if meta is None:
                raise AssertionError("transition state without metadata")
            age = i - meta["start_i"] + 1
            max_transition_age_seen = max(max_transition_age_seen, age)

            resolved = None

            if meta["source"] == "RANGE":
                upper, lower = meta["upper"], meta["lower"]
                prev_close = meta["prev_close"]
                d = meta["direction"]

                if d == 1:
                    confirmed = (
                        prev_close > upper
                        and float(r.close) > upper
                        and int(r.dc_up_count) >= 3
                        and float(r.drift24) > 0
                    )
                elif d == -1:
                    confirmed = (
                        prev_close < lower
                        and float(r.close) < lower
                        and int(r.dc_down_count) >= 3
                        and float(r.drift24) < 0
                    )
                else:
                    confirmed = False

                back_inside = (
                    _inside(prev_close, lower, upper)
                    and _inside(float(r.close), lower, upper)
                )

                if confirmed:
                    resolved = "TREND_UP" if d == 1 else "TREND_DOWN"
                elif back_inside:
                    resolved = "RANGE"
                elif age >= 4:
                    if bool(r.trend_up_core):
                        resolved = "TREND_UP"
                    elif bool(r.trend_down_core):
                        resolved = "TREND_DOWN"
                    else:
                        resolved = "RANGE"

            else:
                # INIT or TREND_REVERSAL transition.
                if bool(r.trend_up_core):
                    meta["up_streak"] += 1
                else:
                    meta["up_streak"] = 0
                if bool(r.trend_down_core):
                    meta["down_streak"] += 1
                else:
                    meta["down_streak"] = 0
                if bool(r.range_core):
                    meta["range_streak"] += 1
                else:
                    meta["range_streak"] = 0

                d = meta["direction"]
                if d == 1 and meta["up_streak"] >= 2:
                    resolved = "TREND_UP"
                elif d == -1 and meta["down_streak"] >= 2:
                    resolved = "TREND_DOWN"
                elif d == 0 and meta["up_streak"] >= 2:
                    resolved = "TREND_UP"
                elif d == 0 and meta["down_streak"] >= 2:
                    resolved = "TREND_DOWN"
                elif meta["range_streak"] >= 2:
                    resolved = "RANGE"
                elif age >= 4:
                    if bool(r.trend_up_core):
                        resolved = "TREND_UP"
                    elif bool(r.trend_down_core):
                        resolved = "TREND_DOWN"
                    else:
                        resolved = "RANGE"

            if resolved is None:
                states[i] = "TRANSITION"
                meta["prev_close"] = float(r.close)
            else:
                states[i] = resolved
                resolve_event(meta, resolved, i, age)
                transition_meta = None
                if resolved == "RANGE":
                    range_age = 1
                    range_core_streak = 0
                else:
                    range_age = 0
                    range_core_streak = 0

        elif prev_state == "TREND_UP":
            if bool(r.trend_down_core):
                states[i] = "TRANSITION"
                start_transition(i, "TREND_REVERSAL", -1)
                range_core_streak = 0
            else:
                range_core_streak = range_core_streak + 1 if bool(r.range_core) else 0
                if range_core_streak >= 3:
                    states[i] = "RANGE"
                    range_age = 1
                    range_core_streak = 0
                else:
                    states[i] = "TREND_UP"

        elif prev_state == "TREND_DOWN":
            if bool(r.trend_up_core):
                states[i] = "TRANSITION"
                start_transition(i, "TREND_REVERSAL", 1)
                range_core_streak = 0
            else:
                range_core_streak = range_core_streak + 1 if bool(r.range_core) else 0
                if range_core_streak >= 3:
                    states[i] = "RANGE"
                    range_age = 1
                    range_core_streak = 0
                else:
                    states[i] = "TREND_DOWN"

        else:
            raise AssertionError(f"unknown previous state {prev_state}")

        prev_state = states[i]
        prev_valid_i = i

    if prev_state == "TRANSITION" and transition_meta is not None:
        if transition_meta.get("event_index") is not None:
            e = events[transition_meta["event_index"]]
            if e["fsm_resolution"] is None:
                e["fsm_resolution"] = "UNRESOLVED_DATA_END"

    diagnostics = {
        "gap_resets": int(gap_resets),
        "max_transition_age_seen": int(max_transition_age_seen),
    }
    return states, events, diagnostics


def add_outcomes(events: list[dict], f: pd.DataFrame) -> list[dict]:
    t = f.t.to_numpy(dtype=np.int64)
    c = f.bc.to_numpy(dtype=float)
    hi = f.bh.to_numpy(dtype=float)
    lo = f.bl.to_numpy(dtype=float)
    atr = f.atr.to_numpy(dtype=float)

    for e in events:
        i = int(e["start_idx"])
        d = int(e["candidate_direction"])
        e["split"] = "library" if int(e["time"]) < ms(SPLIT) else "evaluation"

        for h in HORIZONS:
            key = f"h{h}"
            mature = (
                i + h < len(f)
                and int(t[i + h]) < ms(RAW_END)
                and np.all((np.diff(t[i:i+h+1]) > 0) & (np.diff(t[i:i+h+1]) <= MAX_CONTIG_GAP))
                and np.isfinite(atr[i])
                and atr[i] > 0
            )
            e[f"{key}_mature"] = bool(mature)
            if not mature:
                continue

            displacement = float((c[i+h] - c[i]) / atr[i])
            signed = float(d * displacement)

            future_hi = float(np.max(hi[i+1:i+h+1]))
            future_lo = float(np.min(lo[i+1:i+h+1]))
            if d == 1:
                mfe = (future_hi - c[i]) / atr[i]
                mae = (c[i] - future_lo) / atr[i]
                beyond = bool(c[i+h] > e["frozen_upper"])
            else:
                mfe = (c[i] - future_lo) / atr[i]
                mae = (future_hi - c[i]) / atr[i]
                beyond = bool(c[i+h] < e["frozen_lower"])

            path_close = c[i+1:i+h+1]
            returned = bool(np.any(
                (path_close >= e["frozen_lower"])
                & (path_close <= e["frozen_upper"])
            ))

            e[f"{key}_displacement_atr"] = displacement
            e[f"{key}_signed_displacement_atr"] = signed
            e[f"{key}_mfe_atr"] = float(mfe)
            e[f"{key}_mae_atr"] = float(mae)
            e[f"{key}_close_beyond_boundary"] = beyond
            e[f"{key}_returned_inside"] = returned
            e[f"{key}_elapsed_wall_hours"] = float((t[i+h] - t[i]) / STEP)

        if e.get("h12_mature"):
            e["direction_12h"] = int(np.sign(e["h12_displacement_atr"]))
        else:
            e["direction_12h"] = None
        if e.get("h24_mature"):
            e["direction_24h"] = int(np.sign(e["h24_displacement_atr"]))
        else:
            e["direction_24h"] = None
    return events


def run_segments(x: pd.DataFrame) -> list[dict]:
    rows = []
    state = None
    start_i = prev_i = None
    for i in range(len(x)):
        s = x.state.iloc[i]
        if pd.isna(s):
            continue
        if (
            state is None
            or s != state
            or prev_i is None
            or not (0 < int(x.t.iloc[i]) - int(x.t.iloc[prev_i]) <= MAX_CONTIG_GAP)
        ):
            if state is not None:
                rows.append({
                    "state": state,
                    "start_time": int(x.t.iloc[start_i]),
                    "end_time": int(x.t.iloc[prev_i]),
                    "bars": int(prev_i - start_i + 1),
                })
            state = s
            start_i = i
        prev_i = i

    if state is not None:
        rows.append({
            "state": state,
            "start_time": int(x.t.iloc[start_i]),
            "end_time": int(x.t.iloc[prev_i]),
            "bars": int(prev_i - start_i + 1),
        })
    return rows


def transition_matrix(x: pd.DataFrame) -> dict:
    counts = {s: Counter() for s in STATE_NAMES}
    for i in range(1, len(x)):
        a, b = x.state.iloc[i-1], x.state.iloc[i]
        if pd.isna(a) or pd.isna(b):
            continue
        if not (0 < int(x.t.iloc[i]) - int(x.t.iloc[i-1]) <= MAX_CONTIG_GAP):
            continue
        counts[a][b] += 1

    out = {}
    for a in STATE_NAMES:
        total = sum(counts[a].values())
        out[a] = {
            b: (counts[a][b] / total if total else None)
            for b in STATE_NAMES
        }
    return out


def _state_summary(x: pd.DataFrame, start: str, end: str) -> dict:
    mask = (x.t >= ms(start)) & (x.t < ms(end)) & x.state.notna()
    z = x.loc[mask].copy()
    if z.empty:
        return {}

    occ = z.state.value_counts(normalize=True).to_dict()
    segments = run_segments(z)
    by_state = {}
    for s in STATE_NAMES:
        lens = [r["bars"] for r in segments if r["state"] == s]
        part = z[z.state == s]
        by_state[s] = {
            "occupancy": float(occ.get(s, 0.0)),
            "bars": int(len(part)),
            "runs": int(len(lens)),
            "run_median_bars": float(np.median(lens)) if lens else None,
            "run_mean_bars": float(np.mean(lens)) if lens else None,
            "median_efficiency24": float(part.efficiency24.median()) if len(part) else None,
            "median_drift24": float(part.drift24.median()) if len(part) else None,
            "median_drift48": float(part.drift48.median()) if len(part) else None,
        }

    return {
        "bars": int(len(z)),
        "states": by_state,
        "transition_matrix": transition_matrix(z),
    }


def _event_summary(events: list[dict], split: str) -> dict:
    ev = [e for e in events if e["primary"] and e["split"] == split]
    mature24 = [e for e in ev if e.get("h24_mature")]
    direction_counts = Counter(e["candidate_direction"] for e in ev)
    resolution_counts = Counter(e["fsm_resolution"] for e in ev)
    ages = [e["range_age"] for e in ev]

    horizons = {}
    for h in HORIZONS:
        rows = [e for e in ev if e.get(f"h{h}_mature")]
        signed = [e[f"h{h}_signed_displacement_atr"] for e in rows]
        horizons[str(h)] = {
            "n": len(rows),
            "signed_displacement_mean": float(np.mean(signed)) if signed else None,
            "signed_displacement_median": float(np.median(signed)) if signed else None,
            "signed_positive_fraction": float(np.mean(np.asarray(signed) > 0)) if signed else None,
            "mean_mfe_atr": float(np.mean([e[f"h{h}_mfe_atr"] for e in rows])) if rows else None,
            "mean_mae_atr": float(np.mean([e[f"h{h}_mae_atr"] for e in rows])) if rows else None,
            "close_beyond_boundary_fraction": float(np.mean([
                e[f"h{h}_close_beyond_boundary"] for e in rows
            ])) if rows else None,
            "returned_inside_fraction": float(np.mean([
                e[f"h{h}_returned_inside"] for e in rows
            ])) if rows else None,
            "mean_elapsed_wall_hours": float(np.mean([
                e[f"h{h}_elapsed_wall_hours"] for e in rows
            ])) if rows else None,
        }

    return {
        "primary_events": len(ev),
        "mature_24bar_events": len(mature24),
        "candidate_direction_counts": {
            "up": int(direction_counts.get(1, 0)),
            "down": int(direction_counts.get(-1, 0)),
        },
        "resolution_counts": dict(resolution_counts),
        "range_age_median": float(np.median(ages)) if ages else None,
        "range_age_mean": float(np.mean(ages)) if ages else None,
        "horizons": horizons,
    }


def build_summary(x: pd.DataFrame, events: list[dict], fsm_diag: dict) -> dict:
    library_state = _state_summary(x, "2018-03-01", SPLIT)
    eval_state = _state_summary(x, SPLIT, RAW_END)
    library_events = _event_summary(events, "library")
    eval_events = _event_summary(events, "evaluation")

    eval_primary = [
        e for e in events
        if e["primary"] and e["split"] == "evaluation" and e.get("h24_mature")
    ]
    year_counts = Counter(
        pd.to_datetime(e["time"], unit="ms", utc=True).year for e in eval_primary
    )
    max_year_share = (
        max(year_counts.values()) / len(eval_primary)
        if eval_primary and year_counts else None
    )

    es = eval_state.get("states", {})
    sanity = {
        "range_efficiency_lower_than_trends": bool(
            es
            and es["RANGE"]["median_efficiency24"] is not None
            and es["TREND_UP"]["median_efficiency24"] is not None
            and es["TREND_DOWN"]["median_efficiency24"] is not None
            and es["RANGE"]["median_efficiency24"] < es["TREND_UP"]["median_efficiency24"]
            and es["RANGE"]["median_efficiency24"] < es["TREND_DOWN"]["median_efficiency24"]
        ),
        "trend_drift_signs_correct": bool(
            es
            and es["TREND_UP"]["median_drift24"] > 0
            and es["TREND_DOWN"]["median_drift24"] < 0
        ),
        "transitions_exist_both_splits": bool(
            library_events["primary_events"] > 0
            and eval_events["primary_events"] > 0
        ),
        "evaluation_mature_transitions_ge_100": len(eval_primary) >= 100,
        "evaluation_has_both_directions": bool(
            any(e["candidate_direction"] == 1 for e in eval_primary)
            and any(e["candidate_direction"] == -1 for e in eval_primary)
        ),
        "no_year_over_60pct": bool(
            max_year_share is not None and max_year_share <= 0.60
        ),
        "library_mature_transitions_ge_100": bool(
            library_events["mature_24bar_events"] >= 100
        ),
    }

    return {
        "scope": "GTG State + Transition Engine v0.2 Train-only",
        "validation_read": False,
        "holdout_read": False,
        "fsm_diagnostics": fsm_diag,
        "library_state": library_state,
        "evaluation_state": eval_state,
        "library_transitions": library_events,
        "evaluation_transitions": eval_events,
        "evaluation_transition_year_counts": {
            str(k): int(v) for k, v in sorted(year_counts.items())
        },
        "evaluation_max_year_share": max_year_share,
        "sanity_screens": sanity,
        "sanity_pass_all": bool(all(sanity.values())),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    root = Path(args.root)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=False)

    versions = {}
    for name in ("numpy", "pandas", "scikit-learn"):
        try:
            versions[name] = md.version(name)
        except Exception:
            pass
    (out / "environment.json").write_text(
        json.dumps({
            "python": sys.version,
            "packages": versions,
            "protocol_sha256": sha(PROTOCOL),
            "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "validation_read": False,
            "holdout_read": False,
        }, indent=2),
        encoding="utf-8",
    )

    f, quality = load_h1(root, RAW_END, out / "input_manifest.json")
    feat = add_cores(state_features(f))

    # Prefix-invariance safety check before outcomes.
    cut = min(len(f) - 1, max(1000, len(f) // 2))
    pref = add_cores(state_features(f.iloc[:cut+1].copy()))
    cols = [c for c in feat.columns if c not in ("valid", "range_core", "trend_up_core",
                                                  "trend_down_core", "breakout_up", "breakout_down")]
    np.testing.assert_allclose(
        pref[cols].to_numpy(dtype=float),
        feat[cols].iloc[:cut+1].to_numpy(dtype=float),
        rtol=0.0,
        atol=0.0,
        equal_nan=True,
    )

    states, events, fsm_diag = run_fsm(feat)
    feat["state"] = states

    # State assignment is complete before any outcome is attached.
    frozen_state_hash = hashlib.sha256(
        ("\n".join("" if s is None else s for s in states)).encode()
    ).hexdigest()
    (out / "state_freeze.json").write_text(
        json.dumps({
            "state_sequence_sha256": frozen_state_hash,
            "state_rows": int(sum(s is not None for s in states)),
            "range_transition_events": int(len(events)),
            "frozen_utc": datetime.now(timezone.utc).isoformat(),
            "outcomes_opened": False,
        }, indent=2),
        encoding="utf-8",
    )

    state_cols = [
        "t", "state", "close", "atr",
        "dc0p5_dir", "dc1p0_dir", "dc2p0_dir", "dc4p0_dir",
        "dc_up_count", "dc_down_count",
        "drift12", "drift24", "drift48",
        "efficiency24", "efficiency48", "spread_atr", "atr_week_ratio",
        "prior24_upper", "prior24_lower", "prior24_width_atr", "position24",
        "breakout_up_atr", "breakout_down_atr",
        "range_votes", "range_core", "trend_up_core", "trend_down_core",
        "breakout_up", "breakout_down",
    ]
    feat[state_cols].to_csv(out / "state_sequence.csv.gz", index=False, compression="gzip")

    freeze = json.loads((out / "state_freeze.json").read_text(encoding="utf-8"))
    freeze["outcomes_opened"] = True
    freeze["outcomes_opened_utc"] = datetime.now(timezone.utc).isoformat()
    (out / "state_freeze.json").write_text(json.dumps(freeze, indent=2), encoding="utf-8")

    events = add_outcomes(events, f)
    with (out / "transition_library.jsonl").open("w", encoding="utf-8") as fh:
        for e in events:
            fh.write(json.dumps(e, allow_nan=False) + "\n")

    summary = build_summary(feat, events, fsm_diag)
    summary["quality"] = quality
    summary["integrity"] = {
        "raw_date_gate": "PASS",
        "complete_h1_aggregation": "PASS",
        "feature_prefix_invariance": "PASS",
        "state_sequence_frozen_before_outcomes": "PASS",
        "outcome_paths_require_trading_gap_le_3h": "PASS",
        "validation_read": False,
        "holdout_read": False,
    }
    (out / "summary.json").write_text(
        json.dumps(summary, indent=2, allow_nan=False),
        encoding="utf-8",
    )

    print(json.dumps({
        "sanity_screens": summary["sanity_screens"],
        "sanity_pass_all": summary["sanity_pass_all"],
        "evaluation_states": summary["evaluation_state"]["states"],
        "evaluation_transitions": summary["evaluation_transitions"],
        "fsm_diagnostics": summary["fsm_diagnostics"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
