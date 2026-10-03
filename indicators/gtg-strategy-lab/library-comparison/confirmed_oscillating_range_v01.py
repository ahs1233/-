"""GTG Confirmed Oscillating Range v0.1."""
from __future__ import annotations

import argparse, hashlib, json, sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
from compare import costs
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from range_scalper_v01 import gap_ok, metrics as trade_metrics
from state_transition_engine_v02 import RAW_END

PROTOCOL = HERE / "PROTOCOL_CONFIRMED_OSCILLATING_RANGE_V0_1.md"
EXPECTED_STATE_FILE = "cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772"
EXPECTED_STATE_CONTENT = "c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e"
EXPECTED_MANIFEST = "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"
SPLIT_MS = ms("2021-01-01")
INIT_BARS = 6


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def state_content_hash(s: pd.Series) -> str:
    vals = ["" if pd.isna(x) else str(x) for x in s]
    return hashlib.sha256(("\n".join(vals)).encode()).hexdigest()


def bounds(split: str):
    if split == "library":
        return 0, SPLIT_MS
    if split == "evaluation":
        return SPLIT_MS, ms(RAW_END)
    raise ValueError(split)


def new_episode(i: int, t: int) -> dict:
    return {
        "start_idx": i, "start_time": t, "bars": 0,
        "init_lows": [], "init_highs": [],
        "frozen": False, "valid": True,
        "lower": None, "upper": None, "mid": None, "width": None,
        "first_zone": None, "first_zone_time": None,
        "confirmed": False, "confirmation_idx": None, "confirmation_time": None,
        "traverse": None,
    }


def zone(close: float, ep: dict) -> str | None:
    p = (close - ep["lower"]) / ep["width"]
    if p <= 0.25:
        return "LOWER"
    if p >= 0.75:
        return "UPPER"
    return None


def update_episode(ep: dict, i: int, row: pd.Series) -> tuple[dict, str | None]:
    """Update an already-active RANGE episode at bar i. Returns event."""
    ep["bars"] += 1
    close = float(row.bc)
    if ep["bars"] <= INIT_BARS:
        ep["init_lows"].append(float(row.bl))
        ep["init_highs"].append(float(row.bh))
        if ep["bars"] == INIT_BARS:
            lo = float(min(ep["init_lows"]))
            hi = float(max(ep["init_highs"]))
            if np.isfinite(lo) and np.isfinite(hi) and hi > lo:
                ep["lower"], ep["upper"] = lo, hi
                ep["mid"], ep["width"] = (lo + hi) / 2.0, hi - lo
                ep["frozen"] = True
                return ep, "BOX_FROZEN"
            ep["valid"] = False
            return ep, "INVALID_BOX"
        return ep, None

    if not ep["frozen"] or not ep["valid"]:
        return ep, None

    if close < ep["lower"] or close > ep["upper"]:
        ep["valid"] = False
        return ep, "BOX_INVALIDATED"

    z = zone(close, ep)
    if not ep["confirmed"]:
        if ep["first_zone"] is None and z is not None:
            ep["first_zone"] = z
            ep["first_zone_time"] = int(row.t)
        elif z is not None and z != ep["first_zone"]:
            ep["confirmed"] = True
            ep["confirmation_idx"] = i
            ep["confirmation_time"] = int(row.t)
            ep["traverse"] = ep["first_zone"] + "_TO_" + z
            return ep, "OSCILLATION_CONFIRMED"
    return ep, None


def eligible_signal(ep: dict, i: int, row: pd.Series) -> int:
    if not ep or not ep["frozen"] or not ep["valid"] or not ep["confirmed"]:
        return 0
    if i <= int(ep["confirmation_idx"]):
        return 0
    close, open_ = float(row.bc), float(row.bo)
    if close < ep["lower"] or close > ep["upper"]:
        return 0
    p = (close - ep["lower"]) / ep["width"]
    if p <= 0.25 and close > open_:
        return 1
    if p >= 0.75 and close < open_:
        return -1
    return 0


def run_split(split: str, f: pd.DataFrame, states: dict[int, str]):
    start_t, end_t = bounds(split)
    t = f.t.to_numpy(dtype=np.int64)
    indices = np.where((t >= start_t) & (t < end_t))[0]
    if len(indices) == 0:
        raise ValueError("empty split")
    start_i, end_i = int(indices[0]), int(indices[-1]) + 1

    ep = None
    active = None
    prev_i = None
    episode_rows, trades, signal_rows = [], [], []
    counters = Counter()
    next_ep_id = 0

    def close_episode(reason: str, at_i: int):
        nonlocal ep
        if ep is not None:
            episode_rows.append({
                "split": split, "episode_id": ep["episode_id"],
                "start_time": ep["start_time"],
                "end_time": int(t[at_i]) if 0 <= at_i < len(t) else None,
                "bars": ep["bars"], "frozen": ep["frozen"],
                "valid_at_end": ep["valid"],
                "confirmed": ep["confirmed"],
                "confirmation_time": ep["confirmation_time"],
                "traverse": ep["traverse"], "end_reason": reason,
            })
        ep = None

    i = start_i
    while i < end_i:
        ti = int(t[i])
        st = states.get(ti)
        continuous = prev_i is not None and gap_ok(t[prev_i], ti)

        # Hard gap: active trade is censored and episode resets.
        if prev_i is not None and not continuous:
            if active is not None:
                active["status"] = "CENSORED_HARD_GAP"
                signal_rows.append(active)
                counters["censored_hard_gap"] += 1
                active = None
            close_episode("HARD_GAP", prev_i)
            prev_i = None

        # Update/start episode only while state is RANGE.
        if st != "RANGE":
            # active trade gets causal STATE_EXIT signal at this close.
            if active is not None and i >= active["entry_idx"]:
                active["exit_signal_idx"] = i
                active["exit_reason"] = "STATE_EXIT"
            close_episode("STATE_EXIT", i)
        else:
            if ep is None:
                next_ep_id += 1
                ep = new_episode(i, ti)
                ep["episode_id"] = next_ep_id
                counters["range_episodes"] += 1
            ep, event = update_episode(ep, i, f.iloc[i])
            if event == "BOX_FROZEN":
                counters["boxes_frozen"] += 1
            elif event == "OSCILLATION_CONFIRMED":
                counters["confirmed_episodes"] += 1
            elif event == "BOX_INVALIDATED":
                counters["invalidated_episodes"] += 1
                if not ep["confirmed"]:
                    counters["invalidated_before_confirmation"] += 1
                if active is not None and i >= active["entry_idx"]:
                    active["exit_signal_idx"] = i
                    active["exit_reason"] = "BOX_INVALIDATION"

        # Active position: evaluate target before fallback exit if not already signaled.
        if active is not None and i >= active["entry_idx"]:
            if active.get("exit_signal_idx") is None:
                close = float(f.bc.iloc[i])
                target = close >= active["mid"] if active["direction"] == 1 else close <= active["mid"]
                box_bad = close < active["lower"] or close > active["upper"]
                state_bad = st != "RANGE"
                if target:
                    active["exit_signal_idx"] = i
                    active["exit_reason"] = "TARGET_AND_STATE_EXIT" if state_bad else "TARGET"
                elif box_bad:
                    active["exit_signal_idx"] = i
                    active["exit_reason"] = "BOX_AND_STATE_EXIT" if state_bad else "BOX_INVALIDATION"
                elif state_bad:
                    active["exit_signal_idx"] = i
                    active["exit_reason"] = "STATE_EXIT"

            if active.get("exit_signal_idx") == i:
                exit_i = i + 1
                if exit_i >= end_i or int(t[exit_i]) >= end_t:
                    active["status"] = "CENSORED_SPLIT_END"
                    signal_rows.append(active)
                    counters["censored_split_end"] += 1
                    active = None
                elif not gap_ok(t[i], t[exit_i]):
                    active["status"] = "CENSORED_HARD_GAP"
                    signal_rows.append(active)
                    counters["censored_hard_gap"] += 1
                    active = None
                else:
                    d = active["direction"]
                    atr = active["atr_ref"]
                    cc = costs(
                        d,
                        float(f.bo.iloc[active["entry_idx"]]), float(f.ao.iloc[active["entry_idx"]]),
                        float(f.bo.iloc[exit_i]), float(f.ao.iloc[exit_i]),
                        atr,
                    )
                    entry_mid = (float(f.bo.iloc[active["entry_idx"]]) + float(f.ao.iloc[active["entry_idx"]])) / 2
                    exit_mid = (float(f.bo.iloc[exit_i]) + float(f.ao.iloc[exit_i])) / 2
                    k0, k1 = active["entry_idx"], i
                    hi = float(f.bh.iloc[k0:k1+1].max())
                    lo = float(f.bl.iloc[k0:k1+1].min())
                    if d == 1:
                        mfe, mae = (hi-entry_mid)/atr, (entry_mid-lo)/atr
                    else:
                        mfe, mae = (entry_mid-lo)/atr, (hi-entry_mid)/atr
                    rec = {
                        **active, "status": "COMPLETED",
                        "exit_time": int(t[exit_i]),
                        "year": int(pd.to_datetime(active["signal_time"], unit="ms", utc=True).year),
                        "duration_bars": int(i - active["entry_idx"] + 1),
                        "directional_correct": bool(d*(exit_mid-entry_mid) > 0),
                        "mfe_atr": float(mfe), "mae_atr": float(mae),
                        "c0": float(cc["c0"]), "c1": float(cc["c1"]), "c2": float(cc["c2"]),
                    }
                    trades.append(rec)
                    signal_rows.append(rec)
                    counters["completed_trades"] += 1
                    active = None
                    # execution at next open; skip entry generation on exit-signal bar.
                    prev_i = i
                    i += 1
                    continue

        # Generate new entry only if flat, state RANGE, confirmed valid episode.
        if active is None and st == "RANGE" and ep is not None:
            d = eligible_signal(ep, i, f.iloc[i])
            if d != 0:
                counters["flat_eligible_signals"] += 1
                entry_i = i + 1
                if entry_i >= end_i or int(t[entry_i]) >= end_t:
                    counters["censored_split_end"] += 1
                elif not gap_ok(t[i], t[entry_i]):
                    counters["censored_entry_gap"] += 1
                else:
                    atr = float(f.atr.iloc[i])
                    if np.isfinite(atr) and atr > 0:
                        active = {
                            "split": split, "episode_id": ep["episode_id"],
                            "signal_idx": i, "signal_time": ti,
                            "entry_idx": entry_i, "entry_time": int(t[entry_i]),
                            "direction": d, "atr_ref": atr,
                            "lower": ep["lower"], "upper": ep["upper"], "mid": ep["mid"],
                            "confirmation_time": ep["confirmation_time"],
                            "traverse": ep["traverse"],
                            "exit_signal_idx": None, "exit_reason": None,
                        }
                        counters["entered_trades"] += 1

        prev_i = i
        i += 1

    if active is not None:
        active["status"] = "CENSORED_SPLIT_END"
        signal_rows.append(active)
        counters["censored_split_end"] += 1
    if ep is not None:
        close_episode("SPLIT_END", end_i - 1)

    overall = trade_metrics(trades)
    by_dir = {
        "long": trade_metrics([r for r in trades if r["direction"] == 1]),
        "short": trade_metrics([r for r in trades if r["direction"] == -1]),
    }
    by_year = {}
    for y in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == y]
        by_year[str(y)] = trade_metrics(rr) if len(rr) >= 20 else {"n": len(rr)}
    by_traverse = {}
    for tr in ("LOWER_TO_UPPER", "UPPER_TO_LOWER"):
        rr = [r for r in trades if r["traverse"] == tr]
        by_traverse[tr] = trade_metrics(rr)

    confirms = [e for e in episode_rows if e["confirmed"]]
    report = {
        "range_episodes": counters["range_episodes"],
        "boxes_frozen": counters["boxes_frozen"],
        "confirmed_oscillating_episodes": counters["confirmed_episodes"],
        "confirmation_rate_vs_boxes": (
            counters["confirmed_episodes"]/counters["boxes_frozen"] if counters["boxes_frozen"] else None
        ),
        "invalidated_before_confirmation": counters["invalidated_before_confirmation"],
        "flat_eligible_signals": counters["flat_eligible_signals"],
        "entered_trades": counters["entered_trades"],
        "completed_trades": counters["completed_trades"],
        "censored_counts": {
            k: int(v) for k,v in counters.items() if k.startswith("censored_")
        },
        "overall": overall, "by_direction": by_dir, "by_year": by_year,
        "by_confirmation_traverse": by_traverse,
    }
    return report, trades, episode_rows, signal_rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--state-run", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    root, state_run, out = Path(a.root), Path(a.state_run), Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    if sha(state_run/"state_sequence.csv.gz") != EXPECTED_STATE_FILE:
        raise ValueError("state file hash changed")
    if sha(state_run/"input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("manifest hash changed")
    state = pd.read_csv(state_run/"state_sequence.csv.gz")
    if state_content_hash(state.state) != EXPECTED_STATE_CONTENT:
        raise ValueError("state content changed")
    states = {int(r.t): str(r.state) for r in state.itertuples(index=False)}

    (out/"environment.json").write_text(json.dumps({
        "python": sys.version, "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "init_range_bars": INIT_BARS,
        "validation_read": False, "holdout_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1(root, RAW_END, out/"input_manifest.json")
    if json.loads((out/"input_manifest.json").read_text()) != json.loads((state_run/"input_manifest.json").read_text()):
        raise ValueError("raw manifest mismatch")

    reports, all_trades, all_eps, all_signals = {}, [], [], []
    for split in ("library", "evaluation"):
        rep, tr, eps, sig = run_split(split, f, states)
        reports[split] = rep
        all_trades += tr; all_eps += eps; all_signals += sig

    for name, rows in (("trades.jsonl", all_trades), ("episodes.jsonl", all_eps), ("signals.jsonl", all_signals)):
        with (out/name).open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, allow_nan=False) + "\n")

    lib, ev = reports["library"], reports["evaluation"]
    ev_years = ev["by_year"]
    positive_years = sum(
        1 for y in ("2021","2022","2023")
        if ev_years.get(y,{}).get("n",0) >= 20 and ev_years[y].get("c1_mean_per_trade",-999)>0
    )
    full_counts = [ev_years[y]["n"] for y in ("2021","2022","2023") if y in ev_years]
    share = max(full_counts)/sum(full_counts) if full_counts and sum(full_counts) else None
    screen = {
        "library_confirmed_episodes_ge_50": lib["confirmed_oscillating_episodes"] >= 50,
        "evaluation_confirmed_episodes_ge_50": ev["confirmed_oscillating_episodes"] >= 50,
        "evaluation_trades_ge_100": ev["overall"].get("n",0) >= 100,
        "evaluation_long_ge_40": ev["by_direction"]["long"].get("n",0) >= 40,
        "evaluation_short_ge_40": ev["by_direction"]["short"].get("n",0) >= 40,
        "library_c1_positive": lib["overall"].get("c1_mean_per_trade",-999)>0,
        "evaluation_c1_positive": ev["overall"].get("c1_mean_per_trade",-999)>0,
        "library_c2_nonnegative": lib["overall"].get("c2_mean_per_trade",-999)>=0,
        "evaluation_c2_nonnegative": ev["overall"].get("c2_mean_per_trade",-999)>=0,
        "library_c1_win_gt_0_50": lib["overall"].get("c1_win_rate",0)>0.50,
        "evaluation_c1_win_gt_0_50": ev["overall"].get("c1_win_rate",0)>0.50,
        "evaluation_c1_better_than_v01": ev["overall"].get("c1_mean_per_trade",-999)>-0.1811011018983893,
        "two_full_years_positive_c1": positive_years>=2,
        "no_full_year_over_60pct": share is not None and share<=0.60,
    }
    screen["pass"] = bool(all(screen.values()))
    report = {
        "scope":"GTG Confirmed Oscillating Range v0.1 development diagnostic",
        "validation_read":False,"holdout_read":False,"quality":quality,
        "reports":reports,"registered_screen":screen,
        "integrity":{
            "state_file_hash_unchanged":"PASS","state_content_hash_unchanged":"PASS",
            "source_manifest_unchanged":"PASS","first_six_range_bars_box":"PASS",
            "box_never_rolls":"PASS","full_traverse_before_entry":"PASS",
            "confirmation_bar_not_tradable":"PASS","one_active_trade":"PASS",
            "causal_next_open_execution":"PASS","no_hard_gap_bridge":"PASS",
            "split_boundary_not_crossed":"PASS","validation_read":False,"holdout_read":False,
        },
        "evidence_status":"DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION",
    }
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({"library":lib,"evaluation":ev,"screen":screen},indent=2),flush=True)


if __name__ == "__main__":
    main()
