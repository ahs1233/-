"""GTG Raw Sequence Utility v0.1.

Fixed 1D-CNN temporal utility model over 48 causal H1 bars.
Exploratory Train-development only.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import random
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

HERE = Path(__file__).resolve().parent

from regime_atlas_v01 import load_h1
from state_transition_engine_v02 import MAX_CONTIG_GAP
from joint_state_strategy_utility_v01 import (
    ACTIONS,
    RAW_END,
    RAW_END_MS,
    SPLIT_MS,
    action_outcome,
    load_state_full,
    load_state_prefix,
    permitted_actions,
    state_map,
    summarize_trades,
    by_year_summary,
    by_branch_summary,
)

PROTOCOL = HERE / "PROTOCOL_RAW_SEQUENCE_UTILITY_V0_1.md"

EXPECTED_STATE_FILE = "cf550d9fa2619b2a012a8b3da5f64b19d5cee27773b9c660eca25d5b068f3772"
EXPECTED_MANIFEST = "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"
EXPECTED_SOURCE_FREEZE = "5671d7872d36769784d2540e9a90485c33b359e1da4b44769a79a557c8553dda"
EXPECTED_SOURCE_EVAL = "f467c07e88f41b664ba4bacf67aa4708ffe06da220ea1606969def5bfd0a5dac"
EXPECTED_SOURCE_SUMMARY = "a36588efd58246617b3fb76e5ea91dc40a61050351caac8d9811f80b89a59e29"

WINDOW = 48
NUMERIC_CHANNELS = 6
CHANNELS = 10
ACTION_TO_IDX = {a: i for i, a in enumerate(ACTIONS)}
STATE_TO_IDX = {"RANGE": 0, "TRANSITION": 1, "TREND_UP": 2, "TREND_DOWN": 3}
SEED = 20261003
EPOCHS = 20
BATCH = 256


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def set_deterministic():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    try:
        torch.use_deterministic_algorithms(True)
    except Exception:
        pass
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))


class SequenceUtilityCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv1d(CHANNELS, 16, kernel_size=5, padding=2)
        self.conv2 = nn.Conv1d(16, 32, kernel_size=5, padding=2)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.fc1 = nn.Linear(32 + len(ACTIONS), 32)
        self.fc2 = nn.Linear(32, 1)

    def forward(self, seq, action_onehot):
        z = torch.relu(self.conv1(seq))
        z = torch.relu(self.conv2(z))
        z = self.pool(z).squeeze(-1)
        z = torch.cat([z, action_onehot], dim=1)
        z = torch.relu(self.fc1(z))
        return self.fc2(z).squeeze(1)


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


def verify_source(source_run: Path, state_run: Path, require_eval: bool = False):
    if sha(state_run / "state_sequence.csv.gz") != EXPECTED_STATE_FILE:
        raise ValueError("state file hash changed")
    if sha(state_run / "input_manifest.json") != EXPECTED_MANIFEST:
        raise ValueError("state manifest hash changed")
    if sha(source_run / "freeze.json") != EXPECTED_SOURCE_FREEZE:
        raise ValueError("source utility freeze hash changed")
    if require_eval:
        if sha(source_run / "evaluation_action_predictions.jsonl") != EXPECTED_SOURCE_EVAL:
            raise ValueError("source evaluation predictions hash changed")
        if sha(source_run / "summary.json") != EXPECTED_SOURCE_SUMMARY:
            raise ValueError("source summary hash changed")


def action_onehot(action: str) -> np.ndarray:
    z = np.zeros(len(ACTIONS), dtype=np.float32)
    z[ACTION_TO_IDX[action]] = 1.0
    return z


def build_time_index(f: pd.DataFrame) -> dict[int, int]:
    return {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}


def sequence_window(
    decision_time: int,
    f: pd.DataFrame,
    smap: dict[int, dict],
    t_to_i: dict[int, int],
) -> np.ndarray | None:
    i = t_to_i.get(int(decision_time))
    if i is None or i < WINDOW - 1:
        return None
    lo = i - WINDOW + 1
    ts = f.t.iloc[lo:i+1].to_numpy(dtype=np.int64)
    d = np.diff(ts)
    if np.any(d <= 0) or np.any(d > MAX_CONTIG_GAP):
        return None

    atr_ref = float(f.atr.iloc[i])
    close_ref = float(f.bc.iloc[i])
    if not np.isfinite(atr_ref) or atr_ref <= 0 or not np.isfinite(close_ref):
        return None

    out = np.zeros((CHANNELS, WINDOW), dtype=np.float32)
    for k, j in enumerate(range(lo, i + 1)):
        tj = int(f.t.iloc[j])
        sr = smap.get(tj)
        if sr is None:
            return None
        state = str(sr["state"])
        if state not in STATE_TO_IDX:
            return None
        atr_j = float(f.atr.iloc[j])
        spread = float(sr.get("spread_atr", np.nan))
        vals = [
            (float(f.bo.iloc[j]) - close_ref) / atr_ref,
            (float(f.bh.iloc[j]) - close_ref) / atr_ref,
            (float(f.bl.iloc[j]) - close_ref) / atr_ref,
            (float(f.bc.iloc[j]) - close_ref) / atr_ref,
            spread,
            atr_j / atr_ref,
        ]
        if not np.all(np.isfinite(vals)):
            return None
        out[:NUMERIC_CHANNELS, k] = np.asarray(vals, dtype=np.float32)
        out[NUMERIC_CHANNELS + STATE_TO_IDX[state], k] = 1.0
    return out


def read_fit_targets(source_run: Path) -> list[dict]:
    freeze = json.loads((source_run / "freeze.json").read_text(encoding="utf-8"))
    rows = []
    for action in ACTIONS:
        p = source_run / f"training_{action.lower()}.jsonl"
        expected = freeze["training_hashes"][action]
        if sha(p) != expected:
            raise ValueError(f"source training hash changed: {action}")
        for r in load_jsonl(p):
            if int(r["decision_time"]) >= SPLIT_MS:
                raise ValueError("fit target at/after split")
            rows.append({
                "decision_time": int(r["decision_time"]),
                "state": str(r["state"]),
                "action": action,
                "target": float(r["c1_target"]),
            })
    rows.sort(key=lambda r: (r["decision_time"], ACTION_TO_IDX[r["action"]]))
    return rows


def build_dataset(
    targets: list[dict],
    f: pd.DataFrame,
    state_df: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[dict], Counter]:
    smap = state_map(state_df)
    t_to_i = build_time_index(f)
    seqs, acts, ys, meta = [], [], [], []
    censor = Counter()
    for r in targets:
        seq = sequence_window(r["decision_time"], f, smap, t_to_i)
        if seq is None:
            censor["NO_CONTIGUOUS_WINDOW"] += 1
            continue
        seqs.append(seq)
        acts.append(action_onehot(r["action"]))
        ys.append(float(r["target"]))
        meta.append(r)
    if not seqs:
        raise ValueError("no eligible sequence samples")
    return (
        np.stack(seqs).astype(np.float32),
        np.stack(acts).astype(np.float32),
        np.asarray(ys, dtype=np.float32),
        meta,
        censor,
    )


def normalize_fit(X: np.ndarray):
    vals = X[:, :NUMERIC_CHANNELS, :]
    means = vals.mean(axis=(0, 2))
    stds = vals.std(axis=(0, 2))
    stds = np.where(stds < 1e-8, 1.0, stds)
    Z = X.copy()
    for c in range(NUMERIC_CHANNELS):
        Z[:, c, :] = (Z[:, c, :] - means[c]) / stds[c]
    return Z, means.astype(np.float32), stds.astype(np.float32)


def normalize_apply(X: np.ndarray, means: np.ndarray, stds: np.ndarray):
    Z = X.copy()
    for c in range(NUMERIC_CHANNELS):
        Z[:, c, :] = (Z[:, c, :] - means[c]) / stds[c]
    return Z


def fit_command(a):
    set_deterministic()
    root = Path(a.root)
    state_run = Path(a.state_run)
    source_run = Path(a.source_run)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    verify_source(source_run, state_run, require_eval=False)

    (out / "environment_fit.json").write_text(json.dumps({
        "python": sys.version,
        "torch": torch.__version__,
        "protocol_sha256": sha(PROTOCOL),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "seed": SEED,
        "epochs": EPOCHS,
        "batch_size": BATCH,
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1(root, "2021-01-01", out / "input_manifest_fit.json")
    state_df = load_state_prefix(state_run / "state_sequence.csv.gz", SPLIT_MS)
    targets = read_fit_targets(source_run)
    X, A, y, meta, censor = build_dataset(targets, f, state_df)
    X, means, stds = normalize_fit(X)

    ds = TensorDataset(
        torch.from_numpy(X),
        torch.from_numpy(A),
        torch.from_numpy(y),
    )
    gen = torch.Generator()
    gen.manual_seed(SEED)
    loader = DataLoader(ds, batch_size=BATCH, shuffle=True, generator=gen, num_workers=0)

    model = SequenceUtilityCNN()
    opt = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=0.0001)
    loss_fn = nn.MSELoss()
    epoch_loss = []
    model.train()
    for epoch in range(EPOCHS):
        total = 0.0
        n = 0
        for xb, ab, yb in loader:
            opt.zero_grad(set_to_none=True)
            pred = model(xb, ab)
            loss = loss_fn(pred, yb)
            loss.backward()
            opt.step()
            total += float(loss.detach()) * len(yb)
            n += len(yb)
        epoch_loss.append(total / max(1, n))
        print(json.dumps({"epoch": epoch + 1, "mse": epoch_loss[-1]}), flush=True)

    bundle = {
        "model_state": model.state_dict(),
        "numeric_means": means,
        "numeric_stds": stds,
        "actions": list(ACTIONS),
        "window": WINDOW,
        "channels": CHANNELS,
        "seed": SEED,
        "epochs": EPOCHS,
    }
    torch.save(bundle, out / "frozen_sequence_model.pt")

    sample_rows = [{
        "decision_time": int(r["decision_time"]),
        "state": r["state"],
        "action": r["action"],
        "target": float(r["target"]),
    } for r in meta]
    save_jsonl(out / "training_sequence_samples.jsonl", sample_rows)

    action_counts = Counter(r["action"] for r in meta)
    freeze = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "evaluation_opened": False,
        "model_sha256": sha(out / "frozen_sequence_model.pt"),
        "training_samples_sha256": sha(out / "training_sequence_samples.jsonl"),
        "source_utility_freeze_sha256": EXPECTED_SOURCE_FREEZE,
        "state_file_sha256": EXPECTED_STATE_FILE,
        "manifest_sha256": EXPECTED_MANIFEST,
        "window": WINDOW,
        "channels": CHANNELS,
        "numeric_means": means.tolist(),
        "numeric_stds": stds.tolist(),
        "training_n": int(len(meta)),
        "training_action_counts": dict(action_counts),
        "censor": dict(censor),
        "quality": quality,
        "epoch_mse": epoch_loss,
        "validation_read": False,
        "holdout_read": False,
    }
    (out / "freeze.json").write_text(json.dumps(freeze, indent=2), encoding="utf-8")
    print(json.dumps({
        "training_n": len(meta),
        "action_counts": dict(action_counts),
        "censor": dict(censor),
        "final_mse": epoch_loss[-1],
        "model_sha256": freeze["model_sha256"],
    }, indent=2), flush=True)


def verify_freeze(out: Path):
    freeze = json.loads((out / "freeze.json").read_text(encoding="utf-8"))
    if sha(out / "frozen_sequence_model.pt") != freeze["model_sha256"]:
        raise ValueError("sequence model hash changed")
    if sha(out / "training_sequence_samples.jsonl") != freeze["training_samples_sha256"]:
        raise ValueError("training sequence hash changed")
    return freeze


def open_evaluation_command(a):
    out = Path(a.out)
    freeze = verify_freeze(out)
    if freeze.get("evaluation_opened"):
        raise ValueError("evaluation already opened")
    freeze["evaluation_opened"] = True
    freeze["evaluation_opened_utc"] = datetime.now(timezone.utc).isoformat()
    (out / "freeze.json").write_text(json.dumps(freeze, indent=2), encoding="utf-8")
    print(json.dumps({
        "evaluation_opened": True,
        "evaluation_opened_utc": freeze["evaluation_opened_utc"],
        "model_sha256": freeze["model_sha256"],
    }, indent=2), flush=True)


def load_model_bundle(path: Path):
    bundle = torch.load(path, map_location="cpu", weights_only=False)
    model = SequenceUtilityCNN()
    model.load_state_dict(bundle["model_state"])
    model.eval()
    return model, np.asarray(bundle["numeric_means"], dtype=np.float32), np.asarray(bundle["numeric_stds"], dtype=np.float32)


def regression_metrics(y: np.ndarray, p: np.ndarray):
    if len(y) == 0:
        return {"n": 0}
    corr = None
    if len(y) > 1 and np.std(y) > 0 and np.std(p) > 0:
        corr = float(np.corrcoef(y, p)[0, 1])
    return {
        "n": int(len(y)),
        "target_mean_c1": float(np.mean(y)),
        "prediction_mean": float(np.mean(p)),
        "mae": float(np.mean(np.abs(y - p))),
        "rmse": float(np.sqrt(np.mean((y - p) ** 2))),
        "pearson_corr": corr,
        "c1_positive_sign_accuracy": float(np.mean((p > 0) == (y > 0))),
        "predicted_positive_fraction": float(np.mean(p > 0)),
        "realized_mean_c1_predicted_positive": float(np.mean(y[p > 0])) if np.any(p > 0) else None,
        "realized_c1_win_predicted_positive": float(np.mean(y[p > 0] > 0)) if np.any(p > 0) else None,
    }


def predict_batches(model, X, A, batch=512):
    out = []
    with torch.no_grad():
        for i in range(0, len(X), batch):
            xb = torch.from_numpy(X[i:i+batch])
            ab = torch.from_numpy(A[i:i+batch])
            out.append(model(xb, ab).numpy())
    return np.concatenate(out) if out else np.asarray([], dtype=np.float32)


def simulate_policy(
    f: pd.DataFrame,
    state_df: pd.DataFrame,
    pred_lookup: dict[tuple[int, str], float],
):
    smap = state_map(state_df)
    t = f.t.to_numpy(dtype=np.int64)
    start_i = int(np.searchsorted(t, SPLIT_MS, side="left"))
    end_i = int(np.searchsorted(t, RAW_END_MS, side="left"))
    i = start_i
    trades, decisions = [], []
    counts = Counter()
    while i < end_i:
        ti = int(t[i])
        sr = smap.get(ti)
        if sr is None:
            i += 1
            continue
        state = str(sr["state"])
        counts["decision_opportunities"] += 1
        counts[f"opportunity_{state}"] += 1
        chosen = None
        preds = {}
        for action in permitted_actions(state):
            key = (ti, action)
            if key in pred_lookup:
                preds[action] = float(pred_lookup[key])
        if preds:
            best = max(preds, key=lambda a: preds[a])
            if preds[best] > 0:
                chosen = best

        decisions.append({
            "decision_time": ti,
            "state": state,
            "predictions": preds,
            "chosen_action": chosen or "FLAT",
        })
        if chosen is None:
            counts["flat_decisions"] += 1
            i += 1
            continue

        out = action_outcome(chosen, i, f, smap, RAW_END_MS)
        if not out["mature"]:
            counts[f"censored_{out['reason']}"] += 1
            i += 1
            continue
        rec = {
            **out,
            "decision_time": ti,
            "entry_state": state,
            "year": int(pd.to_datetime(ti, unit="ms", utc=True).year),
            "predicted_c1": float(preds[chosen]),
        }
        trades.append(rec)
        counts["trades"] += 1
        counts[f"trade_{state}"] += 1
        i = max(i + 1, int(out["exit_idx"]))
    return trades, decisions, dict(counts)


def evaluate_command(a):
    set_deterministic()
    root = Path(a.root)
    state_run = Path(a.state_run)
    source_run = Path(a.source_run)
    out = Path(a.out)

    verify_source(source_run, state_run, require_eval=True)
    freeze = verify_freeze(out)
    if not freeze.get("evaluation_opened"):
        raise ValueError("evaluation not opened")

    (out / "environment_evaluate.json").write_text(json.dumps({
        "python": sys.version,
        "torch": torch.__version__,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "model_sha256": freeze["model_sha256"],
        "validation_read": False,
        "holdout_read": False,
    }, indent=2), encoding="utf-8")

    f, quality = load_h1(root, RAW_END, out / "input_manifest_evaluate.json")
    state_df = load_state_full(state_run / "state_sequence.csv.gz")
    smap = state_map(state_df)
    t_to_i = build_time_index(f)

    source_rows = load_jsonl(source_run / "evaluation_action_predictions.jsonl")
    seqs, acts, ys, meta = [], [], [], []
    censor = Counter()
    for r in source_rows:
        action = str(r["action"])
        dt = int(r["decision_time"])
        seq = sequence_window(dt, f, smap, t_to_i)
        if seq is None:
            censor["NO_CONTIGUOUS_WINDOW"] += 1
            continue
        seqs.append(seq)
        acts.append(action_onehot(action))
        ys.append(float(r["realized_c1"]))
        meta.append({
            "decision_time": dt,
            "state": str(r["state"]),
            "action": action,
            "realized_c1": float(r["realized_c1"]),
        })

    X = np.stack(seqs).astype(np.float32)
    A = np.stack(acts).astype(np.float32)
    y = np.asarray(ys, dtype=np.float32)

    model, means, stds = load_model_bundle(out / "frozen_sequence_model.pt")
    Xn = normalize_apply(X, means, stds)
    pred = predict_batches(model, Xn, A)

    rows = []
    for r, p in zip(meta, pred):
        rows.append({**r, "predicted_c1": float(p)})
    save_jsonl(out / "evaluation_sequence_predictions.jsonl", rows)

    by_action = {}
    for action in ACTIONS:
        mask = np.asarray([r["action"] == action for r in meta])
        by_action[action] = regression_metrics(y[mask], pred[mask])

    aggregate = regression_metrics(y, pred)
    lookup = {(r["decision_time"], r["action"]): r["predicted_c1"] for r in rows}
    trades, decisions, counts = simulate_policy(f, state_df, lookup)
    save_jsonl(out / "sequence_policy_trades.jsonl", trades)
    save_jsonl(out / "sequence_policy_decisions.jsonl", decisions)

    overall = summarize_trades(trades)
    opps = counts.get("decision_opportunities", 0)
    overall["c1_mean_per_decision_opportunity"] = overall.get("c1_total", 0.0) / opps if opps else None
    by_branch = by_branch_summary(trades)
    by_year = by_year_summary(trades)
    pos_years = sum(
        1 for yy in ("2021", "2022", "2023")
        if by_year.get(yy, {}).get("n", 0) >= 20
        and by_year[yy].get("c1_mean_per_trade", -999) > 0
    )

    source_summary = json.loads((source_run / "summary.json").read_text(encoding="utf-8"))
    static_overall = source_summary["learned_policy"]["overall"]

    screen = {
        "evaluation_candidates_ge_10000": len(rows) >= 10000,
        "aggregate_corr_gt_0_10": aggregate.get("pearson_corr") is not None and aggregate["pearson_corr"] > 0.10,
        "sign_accuracy_gt_0_55": aggregate.get("c1_positive_sign_accuracy", 0) > 0.55,
        "completed_trades_ge_150": overall.get("n", 0) >= 150,
        "long_ge_50": overall.get("long_n", 0) >= 50,
        "short_ge_50": overall.get("short_n", 0) >= 50,
        "range_entries_ge_50": by_branch["RANGE"].get("n", 0) >= 50,
        "trend_entries_ge_50": by_branch["TREND"].get("n", 0) >= 50,
        "c0_positive": overall.get("c0_mean_per_trade", -999) > 0,
        "c1_positive": overall.get("c1_mean_per_trade", -999) > 0,
        "c2_nonnegative": overall.get("c2_mean_per_trade", -999) >= 0,
        "c1_win_gt_0_50": overall.get("c1_win_rate", 0) > 0.50,
        "c1_trade_better_than_static": overall.get("c1_mean_per_trade", -999) > -0.16103024502458543,
        "c1_opportunity_better_than_static": overall.get("c1_mean_per_decision_opportunity", -999) > -0.026716769660398296,
        "two_full_years_positive_c1": pos_years >= 2,
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Raw Sequence Utility v0.1 exploratory Train-development",
        "validation_read": False,
        "holdout_read": False,
        "quality": quality,
        "window": WINDOW,
        "evaluation_censor": dict(censor),
        "model_diagnostics": {"aggregate": aggregate, "by_action": by_action},
        "sequence_policy": {
            "counts": counts,
            "overall": overall,
            "by_branch": by_branch,
            "by_direction": {
                "long": summarize_trades([r for r in trades if r["direction"] == 1]),
                "short": summarize_trades([r for r in trades if r["direction"] == -1]),
            },
            "by_year": by_year,
        },
        "static_policy_reference": static_overall,
        "registered_screen": screen,
        "integrity": {
            "sequence_model_hash_unchanged": "PASS",
            "training_sequence_hash_unchanged": "PASS",
            "state_file_hash_unchanged": "PASS",
            "source_utility_hashes_unchanged": "PASS",
            "window_exact_48": "PASS",
            "symbolic_constraints_unchanged": "PASS",
            "threshold_0_0": "PASS",
            "one_active_trade": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "evidence_status": "EXPLORATORY_REUSED_TRAIN_EVALUATION_NOT_CONFIRMATORY",
    }
    (out / "summary.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({
        "aggregate": aggregate,
        "overall": overall,
        "by_branch": by_branch,
        "by_year": by_year,
        "screen": screen,
    }, indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("fit")
    p.add_argument("--root", required=True)
    p.add_argument("--state-run", required=True)
    p.add_argument("--source-run", required=True)
    p.add_argument("--out", required=True)

    p = sub.add_parser("open-evaluation")
    p.add_argument("--out", required=True)

    p = sub.add_parser("evaluate")
    p.add_argument("--root", required=True)
    p.add_argument("--state-run", required=True)
    p.add_argument("--source-run", required=True)
    p.add_argument("--out", required=True)

    a = ap.parse_args()
    if a.cmd == "fit":
        fit_command(a)
    elif a.cmd == "open-evaluation":
        open_evaluation_command(a)
    elif a.cmd == "evaluate":
        evaluate_command(a)


if __name__ == "__main__":
    main()
