"""GTG Chronos-2 DC Gate v0.1 — zero-shot external-model gate."""
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
import torch
import importlib.metadata as metadata

HERE = Path(__file__).resolve().parent
from dc_resumption_h4_validation_v01 import load_h1_capped, RAW_CAP_MS, HOLDOUT_START_MS, VAL_END_MS
from dc_resumption_atr_bracket_v01 import metrics as bracket_metrics
from chronos import Chronos2Pipeline

MODEL_REVISION = "254b5357164a84326913b0695216f690752ac55d"
MODEL_WEIGHTS_SHA256 = "ddcda3c7508bf2528087723e98a20707cc04b7f370ae275a9fd88078ddba4f42"
CONTEXT = 256
HORIZON = 4
QUANTILES = [0.1, 0.5, 0.9]
ACTIONS = ("LONG", "SHORT")


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def save_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, allow_nan=False) + "\n")


def gate_allow(direction: int, current_close: float, median_h4: float) -> bool:
    if direction == 1:
        return median_h4 > current_close
    if direction == -1:
        return median_h4 < current_close
    raise ValueError("direction must be +/-1")


def build_signal_rows(train_signals: list[dict], val_signals: list[dict], f: pd.DataFrame):
    t = f.t.to_numpy(dtype=np.int64)
    t_to_i = {int(v): i for i, v in enumerate(t)}
    rows = []
    censor = Counter()
    for source, src in (("TRAIN", train_signals), ("VALIDATION", val_signals)):
        for r in src:
            if r.get("status") != "DC_RESUMPTION_ENTRY":
                continue
            s = int(r["signal_idx"])
            if s < 0 or s >= len(f):
                censor["BAD_INDEX"] += 1
                continue
            signal_time = int(t[s])
            if signal_time >= HOLDOUT_START_MS:
                raise ValueError("Historical Holdout read attempt")
            if s < CONTEXT - 1:
                censor["INSUFFICIENT_CONTEXT"] += 1
                continue
            context = f.bc.iloc[s-CONTEXT+1:s+1].to_numpy(dtype=np.float32)
            if len(context) != CONTEXT or not np.all(np.isfinite(context)):
                censor["BAD_CONTEXT"] += 1
                continue
            rows.append({
                "source": source,
                "event_id": int(r["event_id"]),
                "signal_idx": s,
                "signal_time": signal_time,
                "direction": int(r["direction"]),
                "current_close": float(f.bc.iloc[s]),
                "atr_ref": float(f.atr.iloc[s]),
                "context": context,
            })
    rows.sort(key=lambda x: (x["signal_time"], x["event_id"]))
    return rows, dict(censor)


def summarize(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    return bracket_metrics(rows)


def by_period(rows: list[dict]) -> dict:
    names = ("LIBRARY_2018_2020", "TRAIN_2021_2024", "VALIDATION_2024_2025")
    return {name: summarize([r for r in rows if r["period"] == name]) for name in names}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--train-signals", required=True)
    ap.add_argument("--validation-signals", required=True)
    ap.add_argument("--base-trades", required=True)
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--batch-size", type=int, default=32)
    a = ap.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)
    model_dir = Path(a.model_dir)
    weights = model_dir / "model.safetensors"
    config = model_dir / "config.json"
    if not weights.exists() or not config.exists():
        raise FileNotFoundError("local Chronos-2 model files missing")
    actual_model_sha = sha(weights)
    if actual_model_sha != MODEL_WEIGHTS_SHA256:
        raise ValueError(f"Chronos-2 weight hash mismatch: {actual_model_sha}")

    env = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "python": sys.version,
        "torch": torch.__version__,
        "chronos_forecasting": metadata.version("chronos-forecasting"),
        "transformers": metadata.version("transformers"),
        "model_revision": MODEL_REVISION,
        "model_weights_sha256": actual_model_sha,
        "config_sha256": sha(config),
        "context": CONTEXT,
        "horizon": HORIZON,
        "quantiles": QUANTILES,
        "batch_size": a.batch_size,
        "zero_shot": True,
        "historical_holdout_read": False,
        "pristine_forward_oos_decoded": False,
    }
    (out / "environment.json").write_text(json.dumps(env, indent=2), encoding="utf-8")

    f, quality = load_h1_capped(Path(a.root), RAW_CAP_MS, out / "input_manifest.json")
    train_signals = load_jsonl(Path(a.train_signals))
    val_signals = load_jsonl(Path(a.validation_signals))
    signals, signal_censor = build_signal_rows(train_signals, val_signals, f)

    contexts = [r.pop("context") for r in signals]
    pipe = Chronos2Pipeline.from_pretrained(
        str(model_dir),
        device_map="cpu",
        dtype=torch.float32,
    )
    quantiles, _ = pipe.predict_quantiles(
        contexts,
        prediction_length=HORIZON,
        quantile_levels=QUANTILES,
        batch_size=a.batch_size,
        context_length=CONTEXT,
        cross_learning=False,
    )

    forecast_rows = []
    for r, q in zip(signals, quantiles):
        # q shape: (1, horizon, n_quantiles)
        vals = q[0, HORIZON - 1, :].detach().cpu().numpy().astype(float)
        q10, q50, q90 = map(float, vals)
        current = float(r["current_close"])
        atr = float(r["atr_ref"])
        allowed = gate_allow(int(r["direction"]), current, q50)
        forecast_rows.append({
            **r,
            "q10_h4": q10,
            "q50_h4": q50,
            "q90_h4": q90,
            "forecast_disp_atr_q10": (q10-current)/atr,
            "forecast_disp_atr_q50": (q50-current)/atr,
            "forecast_disp_atr_q90": (q90-current)/atr,
            "gate_allow": bool(allowed),
        })

    save_jsonl(out / "forecasts.jsonl", forecast_rows)
    pred_map = {(r["source"], int(r["event_id"])): r for r in forecast_rows}

    base = load_jsonl(Path(a.base_trades))
    guarded = []
    rejected = []
    missing = []
    for tr in base:
        key = (str(tr["source"]), int(tr["event_id"]))
        pr = pred_map.get(key)
        if pr is None:
            missing.append(tr)
            continue
        rec = {
            **tr,
            "chronos_q10_h4": pr["q10_h4"],
            "chronos_q50_h4": pr["q50_h4"],
            "chronos_q90_h4": pr["q90_h4"],
            "chronos_disp_atr_q50": pr["forecast_disp_atr_q50"],
        }
        if pr["gate_allow"]:
            guarded.append(rec)
        else:
            rejected.append(rec)

    save_jsonl(out / "guarded_trades.jsonl", guarded)
    save_jsonl(out / "rejected_trades.jsonl", rejected)

    overall = summarize(guarded)
    periods = by_period(guarded)
    directions = {
        "long": summarize([r for r in guarded if int(r["direction"]) == 1]),
        "short": summarize([r for r in guarded if int(r["direction"]) == -1]),
    }
    years = {}
    for y in sorted({int(r["year"]) for r in guarded}):
        years[str(y)] = summarize([r for r in guarded if int(r["year"]) == y])

    eligible_years = [v for v in years.values() if v.get("n", 0) >= 3]
    nonneg_years = sum(v["c1_mean_per_trade"] >= 0 for v in eligible_years)
    max_year_share = max((v["n"] for v in years.values()), default=0) / max(1, len(guarded))

    screen = {
        "guarded_trades_ge_40": overall.get("n", 0) >= 40,
        "long_ge_10": directions["long"].get("n", 0) >= 10,
        "short_ge_10": directions["short"].get("n", 0) >= 10,
        "combined_c1_positive": overall.get("c1_mean_per_trade", -999) > 0,
        "combined_c2_nonnegative": overall.get("c2_mean_per_trade", -999) >= 0,
        "c1_win_gt_0_50": overall.get("c1_win_rate", 0) > 0.50,
        "library_c1_nonnegative": periods["LIBRARY_2018_2020"].get("c1_mean_per_trade", -999) >= 0,
        "train_c1_nonnegative": periods["TRAIN_2021_2024"].get("c1_mean_per_trade", -999) >= 0,
        "validation_c1_nonnegative": periods["VALIDATION_2024_2025"].get("c1_mean_per_trade", -999) >= 0,
        "c1_better_than_unguarded": overall.get("c1_mean_per_trade", -999) > 0.10129141966124279,
        "c2_better_than_unguarded": overall.get("c2_mean_per_trade", -999) > -0.07195092753991844,
        "four_years_nonnegative_c1": nonneg_years >= 4,
        "no_year_over_40pct": max_year_share <= 0.40,
    }
    screen["pass"] = bool(all(screen.values()))

    all_signal_allowed = sum(r["gate_allow"] for r in forecast_rows)
    report = {
        "scope": "GTG Chronos-2 DC Gate v0.1 zero-shot opened-history development",
        "quality": quality,
        "forecast_signals": len(forecast_rows),
        "signal_censor": signal_censor,
        "gate_allowed_signals": int(all_signal_allowed),
        "gate_rejected_signals": int(len(forecast_rows)-all_signal_allowed),
        "direction_agreement_rate": float(all_signal_allowed/len(forecast_rows)) if forecast_rows else None,
        "base_trades_n": len(base),
        "guarded_trades_n": len(guarded),
        "rejected_base_trades_n": len(rejected),
        "missing_prediction_for_base_trade_n": len(missing),
        "overall": overall,
        "by_period": periods,
        "by_direction": directions,
        "by_year": years,
        "registered_screen": screen,
        "integrity": {
            "model_revision": MODEL_REVISION,
            "weights_sha256_match": True,
            "zero_shot": True,
            "context_exact_256": True,
            "horizon_exact_4": True,
            "gate_rule": "median_h4_sign_only",
            "base_bracket_unchanged": True,
            "historical_holdout_read": False,
            "pristine_forward_oos_decoded": False,
        },
    }
    (out / "summary.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({
        "forecast_signals": report["forecast_signals"],
        "allowed": report["gate_allowed_signals"],
        "guarded": report["guarded_trades_n"],
        "overall": overall,
        "by_period": periods,
        "by_direction": directions,
        "screen": screen,
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
