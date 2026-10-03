"""GTG DC Resumption ATR Bracket v0.1 — opened-history development only."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE.parent / "data"
sys.path.insert(0, str(DATA_DIR))

from store import read_day
from compare import costs
from dc_resumption_h4_validation_v01 import (
    load_h1_capped, RAW_CAP_MS, HOLDOUT_START_MS, VAL_START_MS, VAL_END_MS,
    STEP, MAX_CONTIG_GAP,
)

PROTOCOL = HERE / "PROTOCOL_DC_RESUMPTION_ATR_BRACKET_V0_1.md"
M1_STEP = 60_000
TRAIN_2021_MS = int(pd.Timestamp("2021-01-01T00:00:00Z").timestamp() * 1000)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    out = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                out.append(json.loads(line))
    return out


def save_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")


def period_name(signal_time: int) -> str:
    if signal_time < TRAIN_2021_MS:
        return "LIBRARY_2018_2020"
    if signal_time < VAL_START_MS:
        return "TRAIN_2021_2024"
    if signal_time < VAL_END_MS:
        return "VALIDATION_2024_2025"
    return "OUTSIDE"


def day_strings(start_ms: int, end_ms: int):
    d = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc).date()
    e = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc).date()
    while d <= e:
        yield d.strftime("%Y-%m-%d")
        d += timedelta(days=1)


class M1Cache:
    def __init__(self, root: Path):
        self.root = root
        self.cache: dict[str, list[dict]] = {}

    def day(self, ds: str) -> list[dict]:
        if ds not in self.cache:
            dt = datetime.fromisoformat(ds)
            p = self.root / "m1" / f"{dt:%Y/%m}" / f"{ds}.csv.gz"
            self.cache[ds] = read_day(p) if p.exists() else []
        return self.cache[ds]

    def window(self, start_ms: int, end_ms_inclusive: int) -> list[dict]:
        rows = []
        for ds in day_strings(start_ms, end_ms_inclusive):
            rows.extend(self.day(ds))
        rows = [r for r in rows if start_ms <= int(r["t"]) <= end_ms_inclusive]
        rows.sort(key=lambda r: int(r["t"]))
        return rows


def barrier_levels(direction: int, entry_bo: float, entry_ao: float, atr: float):
    if direction == 1:
        ref = entry_ao
        return ref + atr, ref - atr
    if direction == -1:
        ref = entry_bo
        return ref - atr, ref + atr
    raise ValueError("direction must be +/-1")


def trigger_on_bar(direction: int, bar: dict, tp: float, sl: float) -> str | None:
    if direction == 1:
        hit_tp = float(bar["bh"]) >= tp
        hit_sl = float(bar["bl"]) <= sl
    else:
        hit_tp = float(bar["al"]) <= tp
        hit_sl = float(bar["ah"]) >= sl
    if hit_tp and hit_sl:
        return "AMBIGUOUS_BOTH"
    if hit_sl:
        return "SL"
    if hit_tp:
        return "TP"
    return None


def scan_barrier(
    direction: int,
    entry_bo: float,
    entry_ao: float,
    atr: float,
    m1_rows: list[dict],
    timeout_end_ms: int,
):
    tp, sl = barrier_levels(direction, entry_bo, entry_ao, atr)
    by_t = {int(r["t"]): r for r in m1_rows}

    for bar in m1_rows:
        t = int(bar["t"])
        if t >= timeout_end_ms:
            break
        reason = trigger_on_bar(direction, bar, tp, sl)
        if reason is None:
            continue
        nx = by_t.get(t + M1_STEP)
        if nx is None:
            return {"status": "CENSOR_NEXT_MINUTE_MISSING", "trigger_time": t, "trigger": reason}
        resolved = "SL_AMBIGUOUS" if reason == "AMBIGUOUS_BOTH" else reason
        return {
            "status": "BARRIER",
            "trigger": resolved,
            "trigger_time": t,
            "exit_time": t + M1_STEP,
            "exit_bo": float(nx["bo"]),
            "exit_ao": float(nx["ao"]),
            "tp_level": float(tp),
            "sl_level": float(sl),
        }
    return {"status": "TIMEOUT", "tp_level": float(tp), "sl_level": float(sl)}


def metrics(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    return {
        "n": len(rows),
        "long_n": sum(r["direction"] == 1 for r in rows),
        "short_n": sum(r["direction"] == -1 for r in rows),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
        "c1_win_rate": float(np.mean([r["c1"] > 0 for r in rows])),
        "c1_total": float(np.sum([r["c1"] for r in rows])),
        "holding_minutes_median": float(np.median([r["holding_minutes"] for r in rows])),
        "holding_minutes_mean": float(np.mean([r["holding_minutes"] for r in rows])),
        "exit_reason_counts": dict(Counter(r["exit_reason"] for r in rows)),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--train-signals", required=True)
    ap.add_argument("--validation-signals", required=True)
    ap.add_argument("--extended-state", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    train_sig_path = Path(a.train_signals)
    val_sig_path = Path(a.validation_signals)
    ext_state_path = Path(a.extended_state)

    env = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": sha(Path(__file__)),
        "train_signals_sha256": sha(train_sig_path),
        "validation_signals_sha256": sha(val_sig_path),
        "extended_state_sha256": sha(ext_state_path),
        "raw_cap_ms": RAW_CAP_MS,
        "holdout_start_ms": HOLDOUT_START_MS,
        "forward_oos_decoded": False,
        "historical_holdout_read": False,
    }
    (out / "environment.json").write_text(json.dumps(env, indent=2), encoding="utf-8")

    f, quality = load_h1_capped(root, RAW_CAP_MS, out / "input_manifest.json")
    ext = pd.read_csv(ext_state_path)
    if len(f) != len(ext) or not np.array_equal(
        f.t.to_numpy(dtype=np.int64), ext.t.to_numpy(dtype=np.int64)
    ):
        raise ValueError("extended state/H1 index mismatch")

    signals = []
    for source, path in (("TRAIN", train_sig_path), ("VALIDATION", val_sig_path)):
        for r in load_jsonl(path):
            if r.get("status") != "DC_RESUMPTION_ENTRY":
                continue
            s = int(r["signal_idx"])
            if s < 0 or s >= len(f):
                raise ValueError("bad signal index")
            signal_time = int(f.t.iloc[s])
            if signal_time >= HOLDOUT_START_MS:
                raise ValueError("HOLDOUT LOCK")
            signals.append({
                **r,
                "source": source,
                "signal_time": signal_time,
                "period": period_name(signal_time),
            })
    signals.sort(key=lambda r: (r["signal_time"], r.get("event_id", -1)))

    cache = M1Cache(root)
    trades = []
    censored = []
    for sig in signals:
        s = int(sig["signal_idx"])
        entry_i = int(sig.get("entry_idx", s + 1))
        exit_i = s + 4
        direction = int(sig["direction"])

        if entry_i != s + 1 or exit_i >= len(f):
            censored.append({**sig, "censor": "INDEX"})
            continue

        tt = f.t.to_numpy(dtype=np.int64)
        gaps = np.diff(tt[s:exit_i + 1])
        if np.any(gaps <= 0) or np.any(gaps > MAX_CONTIG_GAP):
            censored.append({**sig, "censor": "H1_GAP"})
            continue

        timeout_end = int(tt[exit_i]) + STEP
        if timeout_end > VAL_END_MS:
            censored.append({**sig, "censor": "AFTER_OPENED_HISTORY"})
            continue

        atr = float(f.atr.iloc[s])
        if not np.isfinite(atr) or atr <= 0:
            censored.append({**sig, "censor": "ATR"})
            continue

        entry_time = int(tt[entry_i])
        entry_bo = float(f.bo.iloc[entry_i])
        entry_ao = float(f.ao.iloc[entry_i])

        m1_rows = cache.window(entry_time, timeout_end)
        res = scan_barrier(direction, entry_bo, entry_ao, atr, m1_rows, timeout_end)
        if res["status"] == "CENSOR_NEXT_MINUTE_MISSING":
            censored.append({**sig, "censor": res["status"], "trigger_time": res["trigger_time"]})
            continue

        if res["status"] == "BARRIER":
            exit_time = int(res["exit_time"])
            exit_bo = float(res["exit_bo"])
            exit_ao = float(res["exit_ao"])
            reason = str(res["trigger"])
        else:
            exit_time = timeout_end
            exit_bo = float(f.bc.iloc[exit_i])
            exit_ao = float(f.ac.iloc[exit_i])
            reason = "TIMEOUT"

        cc = costs(direction, entry_bo, entry_ao, exit_bo, exit_ao, atr)
        trades.append({
            "event_id": int(sig.get("event_id", -1)),
            "source": sig["source"],
            "period": sig["period"],
            "signal_time": int(sig["signal_time"]),
            "entry_time": entry_time,
            "exit_time": exit_time,
            "year": int(pd.to_datetime(sig["signal_time"], unit="ms", utc=True).year),
            "direction": direction,
            "atr_ref": atr,
            "exit_reason": reason,
            "holding_minutes": float((exit_time - entry_time) / M1_STEP),
            "c0": float(cc["c0"]),
            "c1": float(cc["c1"]),
            "c2": float(cc["c2"]),
        })

    save_jsonl(out / "trades.jsonl", trades)
    save_jsonl(out / "censored.jsonl", censored)

    periods = {}
    for name in ("LIBRARY_2018_2020", "TRAIN_2021_2024", "VALIDATION_2024_2025"):
        periods[name] = metrics([r for r in trades if r["period"] == name])

    by_direction = {
        "long": metrics([r for r in trades if r["direction"] == 1]),
        "short": metrics([r for r in trades if r["direction"] == -1]),
    }

    by_year = {}
    for y in sorted({r["year"] for r in trades}):
        rr = [r for r in trades if r["year"] == y]
        by_year[str(y)] = metrics(rr)

    overall = metrics(trades)
    eligible_years = [
        v for v in by_year.values() if v.get("n", 0) >= 5
    ]
    nonneg_years = sum(v["c1_mean_per_trade"] >= 0 for v in eligible_years)
    max_share = max((v["n"] for v in by_year.values()), default=0) / max(1, len(trades))

    screen = {
        "total_ge_80": overall.get("n", 0) >= 80,
        "long_ge_20": by_direction["long"].get("n", 0) >= 20,
        "short_ge_20": by_direction["short"].get("n", 0) >= 20,
        "combined_c1_positive": overall.get("c1_mean_per_trade", -999) > 0,
        "combined_c2_nonnegative": overall.get("c2_mean_per_trade", -999) >= 0,
        "c1_win_gt_0_50": overall.get("c1_win_rate", 0) > 0.50,
        "library_c1_nonnegative": periods["LIBRARY_2018_2020"].get("c1_mean_per_trade", -999) >= 0,
        "train_2021_2024_c1_nonnegative": periods["TRAIN_2021_2024"].get("c1_mean_per_trade", -999) >= 0,
        "validation_c1_nonnegative": periods["VALIDATION_2024_2025"].get("c1_mean_per_trade", -999) >= 0,
        "four_years_nonnegative_c1": nonneg_years >= 4,
        "no_year_over_35pct": max_share <= 0.35,
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG DC Resumption ATR Bracket v0.1 opened-history development",
        "quality": quality,
        "signals_total": len(signals),
        "eligible_trades": len(trades),
        "censored_n": len(censored),
        "censor_counts": dict(Counter(r["censor"] for r in censored)),
        "overall": overall,
        "by_period": periods,
        "by_direction": by_direction,
        "by_year": by_year,
        "registered_screen": screen,
        "integrity": {
            "tp_atr": 1.0,
            "sl_atr": 1.0,
            "timeout_h1": 4,
            "ambiguous_same_minute": "SL",
            "barrier_exit": "NEXT_M1_OPEN",
            "historical_holdout_read": False,
            "forward_oos_decoded": False,
        },
    }
    (out / "summary.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "overall": overall,
        "by_period": periods,
        "by_direction": by_direction,
        "screen": screen,
        "censor_counts": report["censor_counts"],
    }, indent=2))


if __name__ == "__main__":
    main()
