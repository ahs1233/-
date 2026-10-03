"""GTG Chronos-2 DC Gate v0.1.

Zero-shot external foundation-model direction gate applied to the frozen
DC Resumption + 1ATR bracket trade set. Opened history only.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent

from dc_resumption_h4_validation_v01 import load_h1_capped, RAW_CAP_MS

PROTOCOL = HERE / "PROTOCOL_CHRONOS2_DC_GATE_V0_1.md"
CONTEXT = 256
HORIZON = 4
QUANTILES = [0.1, 0.5, 0.9]
REVISION = "254b5357164a84326913b0695216f690752ac55d"
EXPECTED_CONFIG_SHA = "ef1143bfdc9c0376d9a056eefca46cb4b1ec3d0ffacd541ff56feb40fb708031"
EXPECTED_MODEL_SHA = "ddcda3c7508bf2528087723e98a20707cc04b7f370ae275a9fd88078ddba4f42"
CHRONOS_SITE = Path(r"C:\Users\alk\gtg-lab-library-comparison\.venv-chronos2\Lib\site-packages")


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


def gate_allow(direction: int, current: float, q50_h4: float) -> bool:
    if direction == 1:
        return q50_h4 > current
    if direction == -1:
        return q50_h4 < current
    raise ValueError("direction must be +/-1")


def summarize(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    return {
        "n": len(rows),
        "long_n": sum(int(r["direction"]) == 1 for r in rows),
        "short_n": sum(int(r["direction"]) == -1 for r in rows),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
        "c1_win_rate": float(np.mean([r["c1"] > 0 for r in rows])),
        "c1_total": float(np.sum([r["c1"] for r in rows])),
        "forecast_aligned_atr_mean": float(np.mean([r["forecast_aligned_atr"] for r in rows])),
        "exit_reason_counts": dict(Counter(r["exit_reason"] for r in rows)),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--trades", required=True)
    ap.add_argument("--source-summary", required=True)
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--batch-size", type=int, default=16)
    a = ap.parse_args()

    root = Path(a.root)
    trade_path = Path(a.trades)
    source_summary_path = Path(a.source_summary)
    model_dir = Path(a.model_dir)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    cfg = model_dir / "config.json"
    weights = model_dir / "model.safetensors"
    if sha(cfg) != EXPECTED_CONFIG_SHA:
        raise ValueError("Chronos-2 config hash changed")
    if sha(weights) != EXPECTED_MODEL_SHA:
        raise ValueError("Chronos-2 model hash changed")

    base = load_jsonl(trade_path)
    if len(base) != 109:
        raise ValueError(f"expected 109 frozen base trades, got {len(base)}")

    f, quality = load_h1_capped(root, RAW_CAP_MS, out / "input_manifest.json")
    t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}

    eligible = []
    ineligible = []
    contexts = []
    for tr in base:
        st = int(tr["signal_time"])
        i = t_to_i.get(st)
        if i is None:
            ineligible.append({**tr, "chronos_status": "SIGNAL_TIME_MISSING"})
            continue
        if i < CONTEXT - 1:
            ineligible.append({**tr, "chronos_status": "INSUFFICIENT_CONTEXT"})
            continue
        x = f.bc.iloc[i-CONTEXT+1:i+1].to_numpy(dtype=np.float32)
        if len(x) != CONTEXT or not np.all(np.isfinite(x)):
            ineligible.append({**tr, "chronos_status": "BAD_CONTEXT"})
            continue
        atr = float(f.atr.iloc[i])
        current = float(f.bc.iloc[i])
        if not np.isfinite(atr) or atr <= 0 or not np.isfinite(current):
            ineligible.append({**tr, "chronos_status": "BAD_REFERENCE"})
            continue
        contexts.append(x.reshape(1, CONTEXT))
        eligible.append({
            **tr,
            "h1_index": int(i),
            "current_bid_close": current,
            "signal_atr": atr,
        })

    # Import the known-good research torch first, then expose Chronos package deps.
    import torch
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
    sys.path.insert(0, str(CHRONOS_SITE))
    from chronos import Chronos2Pipeline

    chronos_version = importlib.metadata.version("chronos-forecasting")
    if chronos_version != "2.3.2":
        raise ValueError(f"wrong chronos version {chronos_version}")

    pipe = Chronos2Pipeline.from_pretrained(
        str(model_dir),
        device_map="cpu",
        dtype=torch.float32,
        local_files_only=True,
    )

    X = np.stack(contexts).astype(np.float32)  # (n, 1, 256)
    qs, means = pipe.predict_quantiles(
        X,
        prediction_length=HORIZON,
        quantile_levels=QUANTILES,
        batch_size=a.batch_size,
    )
    if len(qs) != len(eligible):
        raise ValueError("forecast count mismatch")

    forecast_rows = []
    guarded = []
    rejected = []
    for tr, q, mean in zip(eligible, qs, means):
        arr = q.detach().cpu().numpy()
        marr = mean.detach().cpu().numpy()
        # Per item shape: (1 variate, horizon, quantile)
        if arr.shape != (1, HORIZON, len(QUANTILES)):
            raise ValueError(f"unexpected quantile shape {arr.shape}")
        q10 = float(arr[0, HORIZON-1, 0])
        q50 = float(arr[0, HORIZON-1, 1])
        q90 = float(arr[0, HORIZON-1, 2])
        mean4 = float(marr[0, HORIZON-1])
        current = float(tr["current_bid_close"])
        atr = float(tr["signal_atr"])
        direction = int(tr["direction"])
        allow = gate_allow(direction, current, q50)
        raw_disp = (q50 - current) / atr
        aligned = direction * raw_disp
        row = {
            **tr,
            "chronos_status": "ALLOW" if allow else "REJECT",
            "chronos_q10_h4": q10,
            "chronos_q50_h4": q50,
            "chronos_q90_h4": q90,
            "chronos_mean_h4": mean4,
            "forecast_raw_atr": float(raw_disp),
            "forecast_aligned_atr": float(aligned),
        }
        forecast_rows.append(row)
        (guarded if allow else rejected).append(row)

    save_jsonl(out / "chronos_forecasts.jsonl", forecast_rows)
    save_jsonl(out / "guarded_trades.jsonl", guarded)
    save_jsonl(out / "rejected_trades.jsonl", rejected)
    save_jsonl(out / "ineligible.jsonl", ineligible)

    by_period = {}
    for p in ("LIBRARY_2018_2020", "TRAIN_2021_2024", "VALIDATION_2024_2025"):
        by_period[p] = summarize([r for r in guarded if r["period"] == p])

    by_year = {}
    for y in sorted({int(r["year"]) for r in guarded}):
        by_year[str(y)] = summarize([r for r in guarded if int(r["year"]) == y])

    overall = summarize(guarded)
    source = json.loads(source_summary_path.read_text(encoding="utf-8"))
    source_overall = source["overall"]

    eligible_years = [v for v in by_year.values() if v.get("n", 0) >= 3]
    nonneg_years = sum(v["c1_mean_per_trade"] >= 0 for v in eligible_years)
    max_year_share = max((v["n"] for v in by_year.values()), default=0) / max(1, overall.get("n", 0))

    screen = {
        "eligible_guarded_trades_ge_40": overall.get("n", 0) >= 40,
        "long_ge_10": overall.get("long_n", 0) >= 10,
        "short_ge_10": overall.get("short_n", 0) >= 10,
        "combined_c1_positive": overall.get("c1_mean_per_trade", -999) > 0,
        "combined_c2_nonnegative": overall.get("c2_mean_per_trade", -999) >= 0,
        "c1_win_gt_0_50": overall.get("c1_win_rate", 0) > 0.50,
        "library_c1_nonnegative": by_period["LIBRARY_2018_2020"].get("c1_mean_per_trade", -999) >= 0,
        "train_2021_2024_c1_nonnegative": by_period["TRAIN_2021_2024"].get("c1_mean_per_trade", -999) >= 0,
        "validation_c1_nonnegative": by_period["VALIDATION_2024_2025"].get("c1_mean_per_trade", -999) >= 0,
        "guarded_c1_better_than_unguarded": overall.get("c1_mean_per_trade", -999) > 0.10129141966124279,
        "guarded_c2_better_than_unguarded": overall.get("c2_mean_per_trade", -999) > -0.07195092753991844,
        "four_years_nonnegative_c1": nonneg_years >= 4,
        "no_year_over_40pct": max_year_share <= 0.40,
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Chronos-2 DC Gate v0.1 opened-history development",
        "chronos": {
            "package_version": chronos_version,
            "model": "amazon/chronos-2",
            "revision": REVISION,
            "config_sha256": sha(cfg),
            "model_sha256": sha(weights),
            "context": CONTEXT,
            "prediction_length": HORIZON,
            "quantiles": QUANTILES,
            "batch_size": a.batch_size,
            "zero_shot": True,
        },
        "quality": quality,
        "base_trades": len(base),
        "chronos_eligible": len(eligible),
        "allowed": len(guarded),
        "rejected": len(rejected),
        "ineligible": len(ineligible),
        "direction_agreement_rate": len(guarded) / len(eligible) if eligible else None,
        "overall": overall,
        "by_period": by_period,
        "by_direction": {
            "long": summarize([r for r in guarded if int(r["direction"]) == 1]),
            "short": summarize([r for r in guarded if int(r["direction"]) == -1]),
        },
        "by_year": by_year,
        "unguarded_reference": source_overall,
        "registered_screen": screen,
        "integrity": {
            "zero_shot": True,
            "input_close_only": True,
            "context_exact_256": True,
            "horizon_exact_4": True,
            "gate_direction_sign_only": True,
            "base_bracket_unchanged": True,
            "historical_holdout_read": False,
            "pristine_forward_oos_decoded": False,
        },
    }
    (out / "summary.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({
        "eligible": len(eligible),
        "allowed": len(guarded),
        "rejected": len(rejected),
        "overall": overall,
        "by_period": by_period,
        "screen": screen,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
