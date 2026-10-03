"""GTG Transition Memory v0.1.

Two-stage, Train-only historical-memory experiment:
  fit      -> reads transition events and H1 only before 2021-01-01, freezes memory
  evaluate -> requires frozen memory, then scores 2021-01-01..2024-03-20 events

Preregistered in PROTOCOL_TRANSITION_MEMORY_V0_1.md.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as md
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import RobustScaler
from tslearn.metrics import dtw

HERE = Path(__file__).resolve().parent
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END, STEP

PROTOCOL = HERE / "PROTOCOL_TRANSITION_MEMORY_V0_1.md"
SPLIT = "2021-01-01"
K = 7
DTW_RADIUS = 2
SEED = 20261003

SCALAR_FEATURES = [
    "log1p_range_age",
    "prior24_width_atr",
    "canonical_position24",
    "aligned_dc0p5_dir",
    "aligned_dc1p0_dir",
    "aligned_dc2p0_dir",
    "aligned_dc4p0_dir",
    "aligned_drift12",
    "aligned_drift24",
    "aligned_drift48",
    "efficiency24",
    "efficiency48",
    "spread_atr",
    "atr_week_ratio",
    "trigger_breakout",
]
SEQUENCE_FEATURES = [
    "canonical_position",
    "aligned_return_atr",
    "bar_range_atr",
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stable_json_sha(obj) -> str:
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def label_event(e: dict) -> int | None:
    """1 TREND_CONFIRMED, 0 RANGE_RESUMED, None unresolved."""
    r = e.get("fsm_resolution")
    d = int(e["candidate_direction"])
    if r == "RANGE":
        return 0
    if r == "TREND_UP":
        if d != 1:
            raise ValueError("opposite trend resolution contract violation")
        return 1
    if r == "TREND_DOWN":
        if d != -1:
            raise ValueError("opposite trend resolution contract violation")
        return 1
    if r in ("UNRESOLVED_GAP", "UNRESOLVED_DATA_END", None):
        return None
    raise ValueError(f"unexpected resolution {r}")


def scalar_vector(e: dict) -> np.ndarray:
    d = int(e["candidate_direction"])
    if d not in (-1, 1):
        raise ValueError("candidate direction must be +/-1")
    p = float(e["position24"])
    canonical_p = p if d == 1 else 1.0 - p
    vals = [
        math.log1p(float(e["range_age"])),
        float(e["prior24_width_atr"]),
        canonical_p,
        d * float(e["dc0p5_dir"]),
        d * float(e["dc1p0_dir"]),
        d * float(e["dc2p0_dir"]),
        d * float(e["dc4p0_dir"]),
        d * float(e["drift12"]),
        d * float(e["drift24"]),
        d * float(e["drift48"]),
        float(e["efficiency24"]),
        float(e["efficiency48"]),
        float(e["spread_atr"]),
        float(e["atr_week_ratio"]),
        1.0 if e["trigger_type"] == "BREAKOUT" else 0.0,
    ]
    a = np.asarray(vals, dtype=float)
    if a.shape != (15,) or not np.all(np.isfinite(a)):
        raise ValueError("invalid scalar onset vector")
    return a


def sequence_vector(
    e: dict,
    f: pd.DataFrame,
    t_to_i: dict[int, int],
    state_by_time: dict[int, str] | None = None,
) -> np.ndarray:
    t0 = int(e["time"])
    if t0 not in t_to_i:
        raise ValueError(f"event timestamp absent from H1 {t0}")
    i = t_to_i[t0]
    n = min(int(e["range_age"]), 24)
    if n < 6:
        raise ValueError("primary event sequence shorter than 6")
    start = i - n
    if start < 1:
        raise ValueError("insufficient sequence history")

    idx = np.arange(start, i, dtype=int)  # excludes onset bar i
    tt = f.t.to_numpy(dtype=np.int64)
    gaps = np.diff(tt[idx])
    if len(gaps) and not np.all((gaps > 0) & (gaps <= MAX_CONTIG_GAP)):
        raise ValueError("source RANGE sequence crosses hard market gap")
    onset_gap = int(tt[i]) - int(tt[i-1])
    if not (0 < onset_gap <= MAX_CONTIG_GAP):
        raise ValueError("onset separated from source RANGE by hard market gap")

    if state_by_time is not None:
        if state_by_time.get(t0) != "TRANSITION":
            raise ValueError("event onset is not frozen TRANSITION state")
        for j in idx:
            if state_by_time.get(int(tt[j])) != "RANGE":
                raise ValueError("historical sequence includes non-RANGE state")

    close = f.bc.to_numpy(dtype=float)
    high = f.bh.to_numpy(dtype=float)
    low = f.bl.to_numpy(dtype=float)
    atr = f.atr.to_numpy(dtype=float)
    if not np.all(np.isfinite(atr[idx])) or np.any(atr[idx] <= 0):
        raise ValueError("invalid ATR in sequence")

    lower = float(e["frozen_lower"])
    upper = float(e["frozen_upper"])
    width = upper - lower
    if not np.isfinite(width) or width <= 0:
        raise ValueError("invalid frozen range width")
    d = int(e["candidate_direction"])

    position = (close[idx] - lower) / width
    if d == -1:
        position = 1.0 - position

    prev_close = close[idx - 1]
    aligned_ret = d * (close[idx] - prev_close) / atr[idx]
    bar_range = (high[idx] - low[idx]) / atr[idx]

    seq = np.column_stack([position, aligned_ret, bar_range]).astype(float)
    if seq.shape[0] < 6 or seq.shape[0] > 24 or seq.shape[1] != 3:
        raise ValueError("sequence contract violated")
    if not np.all(np.isfinite(seq)):
        raise ValueError("nonfinite sequence")
    return seq


def training_event_prefix(path: Path) -> tuple[list[dict], str, int | None]:
    """Read chronologically and stop immediately at first event >= split."""
    events = []
    h = hashlib.sha256()
    prev_t = None
    first_eval_time = None
    with path.open("rb") as fh:
        for raw in fh:
            if not raw.strip():
                continue
            e = json.loads(raw)
            t = int(e["time"])
            if prev_t is not None and t < prev_t:
                raise ValueError("transition file not chronological")
            prev_t = t
            if t >= ms(SPLIT):
                first_eval_time = t
                break
            h.update(raw)
            if e.get("primary"):
                y = label_event(e)
                if y is not None:
                    events.append(e)
    return events, h.hexdigest(), first_eval_time


def evaluation_events(path: Path) -> list[dict]:
    events = []
    prev_t = None
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            e = json.loads(line)
            t = int(e["time"])
            if prev_t is not None and t < prev_t:
                raise ValueError("transition file not chronological")
            prev_t = t
            if t < ms(SPLIT):
                continue
            if not e.get("primary"):
                continue
            y = label_event(e)
            if y is not None:
                events.append(e)
    return events


def state_map(path: Path, end_exclusive: str | None = None) -> dict[int, str]:
    out: dict[int, str] = {}
    end_ms = ms(end_exclusive) if end_exclusive is not None else None
    for chunk in pd.read_csv(path, usecols=["t", "state"], chunksize=5000):
        for t, state in zip(chunk["t"], chunk["state"]):
            ti = int(t)
            if end_ms is not None and ti >= end_ms:
                return out
            if pd.notna(state):
                out[ti] = str(state)
    return out


def scale_sequences_fit(seqs: list[np.ndarray]):
    rows = np.vstack(seqs)
    scaler = RobustScaler()
    scaler.fit(rows)
    scaled = [
        (s - scaler.center_) / scaler.scale_
        for s in seqs
    ]
    return scaler, scaled


def scale_sequence(s: np.ndarray, center: np.ndarray, scale: np.ndarray):
    return (s - center) / scale


def model_env(stage: str) -> dict:
    packages = {}
    for name in ("numpy", "pandas", "scikit-learn", "tslearn"):
        try:
            packages[name] = md.version(name)
        except Exception:
            pass
    return {
        "stage": stage,
        "python": sys.version,
        "packages": packages,
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "validation_read": False,
        "holdout_read": False,
    }


def event_meta(e: dict, label: int) -> dict:
    return {
        "event_id": int(e["event_id"]),
        "time": int(e["time"]),
        "label": int(label),
        "candidate_direction": int(e["candidate_direction"]),
        "trigger_type": e["trigger_type"],
        "range_age": int(e["range_age"]),
    }


def fit(root: Path, source: Path, out: Path):
    out.mkdir(parents=True, exist_ok=False)
    (out / "environment_fit.json").write_text(
        json.dumps(model_env("fit"), indent=2), encoding="utf-8"
    )

    transition_path = source / "transition_library.jsonl"
    state_freeze_path = source / "state_freeze.json"
    if not transition_path.exists() or not state_freeze_path.exists():
        raise FileNotFoundError("frozen v0.2 source artifacts required")

    source_freeze = json.loads(state_freeze_path.read_text(encoding="utf-8"))
    train_events, prefix_sha, first_eval_time = training_event_prefix(transition_path)
    if not train_events:
        raise ValueError("no training transition events")
    if first_eval_time is None or first_eval_time < ms(SPLIT):
        raise ValueError("fit did not stop at first post-split event")

    # Critical leakage gate: raw H1 fit stops before 2021.
    f, quality = load_h1(root, SPLIT, out / "input_manifest_fit.json")
    if int(f.t.max()) >= ms(SPLIT):
        raise AssertionError("fit H1 crossed 2021 boundary")
    t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
    frozen_states = state_map(source / "state_sequence.csv.gz", SPLIT)

    scalar_raw = []
    seq_raw = []
    labels = []
    metas = []
    for e in train_events:
        y = label_event(e)
        if y is None:
            continue
        scalar_raw.append(scalar_vector(e))
        seq_raw.append(sequence_vector(e, f, t_to_i, frozen_states))
        labels.append(y)
        metas.append(event_meta(e, y))

    X = np.vstack(scalar_raw)
    y = np.asarray(labels, dtype=int)
    if len(X) < 100 or len(np.unique(y)) != 2:
        raise ValueError("insufficient binary training memory")

    scalar_scaler = RobustScaler()
    Xs = scalar_scaler.fit_transform(X)
    seq_scaler, seqs_scaled = scale_sequences_fit(seq_raw)

    logistic = LogisticRegression(
        C=1.0,
        penalty="l2",
        solver="lbfgs",
        max_iter=1000,
        random_state=SEED,
        class_weight=None,
    )
    logistic.fit(Xs, y)
    if list(logistic.classes_) != [0, 1]:
        raise ValueError("unexpected logistic classes")

    training_memory = []
    for meta, xs, seq in zip(metas, Xs, seqs_scaled):
        training_memory.append({
            **meta,
            "scalar_scaled": [float(v) for v in xs],
            "sequence_scaled": [[float(v) for v in row] for row in seq],
        })

    memory_path = out / "training_memory.jsonl"
    with memory_path.open("w", encoding="utf-8") as fh:
        for r in training_memory:
            fh.write(json.dumps(r, allow_nan=False) + "\n")

    label_counts = {
        "RANGE_RESUMED": int(np.sum(y == 0)),
        "TREND_CONFIRMED": int(np.sum(y == 1)),
    }
    frozen = {
        "source_run": str(source),
        "source_state_sequence_sha256": source_freeze["state_sequence_sha256"],
        "transition_training_prefix_sha256": prefix_sha,
        "first_evaluation_event_time_seen_then_stopped": int(first_eval_time),
        "fit_h1_end_exclusive": SPLIT,
        "feature_names": SCALAR_FEATURES,
        "sequence_feature_names": SEQUENCE_FEATURES,
        "scalar_scaler_center": scalar_scaler.center_.tolist(),
        "scalar_scaler_scale": scalar_scaler.scale_.tolist(),
        "sequence_scaler_center": seq_scaler.center_.tolist(),
        "sequence_scaler_scale": seq_scaler.scale_.tolist(),
        "logistic_classes": logistic.classes_.tolist(),
        "logistic_coef": logistic.coef_.tolist(),
        "logistic_intercept": logistic.intercept_.tolist(),
        "K": K,
        "dtw_radius": DTW_RADIUS,
        "decision_threshold": 0.50,
        "training_n": int(len(y)),
        "label_counts": label_counts,
        "trend_prevalence": float(np.mean(y)),
        "quality": quality,
        "validation_read": False,
        "holdout_read": False,
        "frozen_utc": datetime.now(timezone.utc).isoformat(),
    }
    frozen_path = out / "frozen_memory.json"
    frozen_path.write_text(json.dumps(frozen, indent=2), encoding="utf-8")

    freeze = {
        "frozen_memory_sha256": sha(frozen_path),
        "training_memory_sha256": sha(memory_path),
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "evaluation_opened": False,
        "frozen_utc": datetime.now(timezone.utc).isoformat(),
    }
    (out / "freeze.json").write_text(json.dumps(freeze, indent=2), encoding="utf-8")

    print(json.dumps({
        "FIT_COMPLETE": True,
        "training_n": frozen["training_n"],
        "label_counts": label_counts,
        "trend_prevalence": frozen["trend_prevalence"],
        "first_eval_time_seen_then_stopped": first_eval_time,
        "frozen_memory_sha256": freeze["frozen_memory_sha256"],
        "training_memory_sha256": freeze["training_memory_sha256"],
    }, indent=2), flush=True)


def load_training_memory(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                rows.append(json.loads(line))
    if not rows:
        raise ValueError("empty training memory")
    X = np.asarray([r["scalar_scaled"] for r in rows], dtype=float)
    y = np.asarray([r["label"] for r in rows], dtype=int)
    seqs = [np.asarray(r["sequence_scaled"], dtype=float) for r in rows]
    return rows, X, y, seqs


def logistic_probability(x: np.ndarray, coef: np.ndarray, intercept: float) -> float:
    z = float(np.dot(coef, x) + intercept)
    if z >= 0:
        return float(1.0 / (1.0 + math.exp(-z)))
    ez = math.exp(z)
    return float(ez / (1.0 + ez))


def stable_topk(dist: np.ndarray, k: int) -> np.ndarray:
    idx = np.arange(len(dist))
    return np.lexsort((idx, dist))[:k]


def scalar_neighbors(x: np.ndarray, Xtrain: np.ndarray, train_rows: list[dict]):
    dist = np.sqrt(np.sum((Xtrain - x) ** 2, axis=1))
    idx = stable_topk(dist, K)
    details = []
    for j in idx:
        r = train_rows[int(j)]
        details.append({
            "event_id": int(r["event_id"]),
            "time": int(r["time"]),
            "label": int(r["label"]),
            "distance": float(dist[j]),
        })
    return idx, details


def dtw_neighbors(seq: np.ndarray, train_seqs: list[np.ndarray], train_rows: list[dict]):
    dist = np.empty(len(train_seqs), dtype=float)
    for j, tr in enumerate(train_seqs):
        dist[j] = float(dtw(
            seq,
            tr,
            global_constraint="sakoe_chiba",
            sakoe_chiba_radius=DTW_RADIUS,
        ))
    if not np.all(np.isfinite(dist)):
        raise ValueError("nonfinite DTW distance")
    idx = stable_topk(dist, K)
    details = []
    for j in idx:
        r = train_rows[int(j)]
        details.append({
            "event_id": int(r["event_id"]),
            "time": int(r["time"]),
            "label": int(r["label"]),
            "distance": float(dist[j]),
        })
    return idx, details


def calc_metrics(rows: list[dict], model: str) -> dict:
    y = np.asarray([r["actual_label"] for r in rows], dtype=int)
    p = np.asarray([r[f"p_{model}"] for r in rows], dtype=float)
    pred = (p >= 0.5).astype(int)
    cm = confusion_matrix(y, pred, labels=[0, 1])
    out = {
        "n": int(len(y)),
        "accuracy": float(accuracy_score(y, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y, pred)),
        "brier": float(brier_score_loss(y, p)),
        "roc_auc": float(roc_auc_score(y, p)) if len(np.unique(y)) == 2 else None,
        "trend_precision": float(precision_score(y, pred, pos_label=1, zero_division=0)),
        "trend_recall": float(recall_score(y, pred, pos_label=1, zero_division=0)),
        "range_precision": float(precision_score(y, pred, pos_label=0, zero_division=0)),
        "range_recall": float(recall_score(y, pred, pos_label=0, zero_division=0)),
        "confusion_matrix_labels_0_range_1_trend": cm.tolist(),
        "predicted_trend_fraction": float(np.mean(pred == 1)),
    }
    return out


def evaluate(root: Path, source: Path, out: Path):
    frozen_path = out / "frozen_memory.json"
    memory_path = out / "training_memory.jsonl"
    freeze_path = out / "freeze.json"
    if not frozen_path.exists() or not memory_path.exists() or not freeze_path.exists():
        raise FileNotFoundError("frozen fit artifacts required")

    freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
    if freeze["frozen_memory_sha256"] != sha(frozen_path):
        raise ValueError("frozen memory changed")
    if freeze["training_memory_sha256"] != sha(memory_path):
        raise ValueError("training memory changed")
    if freeze.get("evaluation_opened"):
        raise ValueError("evaluation already opened")

    # Record opening before reading post-2021 events/H1.
    freeze["evaluation_opened"] = True
    freeze["evaluation_opened_utc"] = datetime.now(timezone.utc).isoformat()
    freeze_path.write_text(json.dumps(freeze, indent=2), encoding="utf-8")
    (out / "environment_evaluate.json").write_text(
        json.dumps(model_env("evaluate"), indent=2), encoding="utf-8"
    )

    frozen = json.loads(frozen_path.read_text(encoding="utf-8"))
    train_rows, Xtrain, ytrain, train_seqs = load_training_memory(memory_path)
    if any(int(r["time"]) >= ms(SPLIT) for r in train_rows):
        raise ValueError("post-2021 event in frozen training memory")

    # Full H1 only after frozen fit exists.
    f, quality = load_h1(root, RAW_END, out / "input_manifest_evaluate.json")
    source_manifest = json.loads(
        (source / "input_manifest.json").read_text(encoding="utf-8")
    )
    eval_manifest = json.loads(
        (out / "input_manifest_evaluate.json").read_text(encoding="utf-8")
    )
    if eval_manifest != source_manifest:
        raise ValueError("evaluation manifest differs from frozen State Engine v0.2")
    t_to_i = {int(v): i for i, v in enumerate(f.t.to_numpy(dtype=np.int64))}
    frozen_states = state_map(source / "state_sequence.csv.gz")

    source_freeze = json.loads((source / "state_freeze.json").read_text(encoding="utf-8"))
    if source_freeze["state_sequence_sha256"] != frozen["source_state_sequence_sha256"]:
        raise ValueError("source state SHA changed")

    eval_events = evaluation_events(source / "transition_library.jsonl")
    if not eval_events:
        raise ValueError("no evaluation events")
    if any(int(e["time"]) < ms(SPLIT) for e in eval_events):
        raise AssertionError("pre-2021 event leaked into evaluation")

    sc_center = np.asarray(frozen["scalar_scaler_center"], dtype=float)
    sc_scale = np.asarray(frozen["scalar_scaler_scale"], dtype=float)
    sq_center = np.asarray(frozen["sequence_scaler_center"], dtype=float)
    sq_scale = np.asarray(frozen["sequence_scaler_scale"], dtype=float)
    coef = np.asarray(frozen["logistic_coef"], dtype=float)[0]
    intercept = float(frozen["logistic_intercept"][0])
    prior = float(frozen["trend_prevalence"])

    records = []
    pred_path = out / "evaluation_predictions.jsonl"
    if pred_path.exists():
        raise FileExistsError(pred_path)

    for n, e in enumerate(eval_events, 1):
        y = label_event(e)
        if y is None:
            raise AssertionError("unresolved event in evaluation cohort")
        raw_x = scalar_vector(e)
        x = (raw_x - sc_center) / sc_scale
        raw_seq = sequence_vector(e, f, t_to_i, frozen_states)
        seq = scale_sequence(raw_seq, sq_center, sq_scale)

        p_logistic = logistic_probability(x, coef, intercept)
        si, scalar_detail = scalar_neighbors(x, Xtrain, train_rows)
        di, dtw_detail = dtw_neighbors(seq, train_seqs, train_rows)
        p_scalar = float(np.mean(ytrain[si]))
        p_dtw = float(np.mean(ytrain[di]))
        p_hybrid = float((p_scalar + p_dtw) / 2.0)

        rec = {
            "event_id": int(e["event_id"]),
            "time": int(e["time"]),
            "year": int(pd.to_datetime(e["time"], unit="ms", utc=True).year),
            "actual_label": int(y),
            "actual_label_name": "TREND_CONFIRMED" if y == 1 else "RANGE_RESUMED",
            "candidate_direction": int(e["candidate_direction"]),
            "trigger_type": e["trigger_type"],
            "range_age": int(e["range_age"]),
            "p_prior": prior,
            "p_logistic": p_logistic,
            "p_scalar": p_scalar,
            "p_dtw": p_dtw,
            "p_hybrid": p_hybrid,
            "scalar_neighbors": scalar_detail,
            "dtw_neighbors": dtw_detail,
        }
        records.append(rec)
        with pred_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, allow_nan=False) + "\n")

        if n == 1 or n % 50 == 0 or n == len(eval_events):
            print(f"DONE {n}/{len(eval_events)}", flush=True)

    models = ("prior", "logistic", "scalar", "dtw", "hybrid")
    metrics = {m: calc_metrics(records, m) for m in models}

    by_direction = {}
    for d, name in ((1, "up"), (-1, "down")):
        rr = [r for r in records if r["candidate_direction"] == d]
        by_direction[name] = {
            "n": len(rr),
            "hybrid": calc_metrics(rr, "hybrid") if rr else None,
        }

    by_year = {}
    for year in sorted({r["year"] for r in records}):
        rr = [r for r in records if r["year"] == year]
        by_year[str(year)] = {
            "n": len(rr),
            "label_prevalence": float(np.mean([r["actual_label"] for r in rr])),
            "hybrid": calc_metrics(rr, "hybrid") if len({r["actual_label"] for r in rr}) == 2 else None,
        }

    prevalence = float(np.mean([r["actual_label"] for r in records]))
    h = metrics["hybrid"]
    screen = {
        "evaluation_n_ge_400": len(records) >= 400,
        "balanced_accuracy_gt_0_52": h["balanced_accuracy"] > 0.52,
        "brier_better_than_prior": h["brier"] < metrics["prior"]["brier"],
        "range_recall_ge_0_35": h["range_recall"] >= 0.35,
        "trend_precision_gt_prevalence": h["trend_precision"] > prevalence,
        "both_candidate_directions_n_ge_100": (
            by_direction["up"]["n"] >= 100 and by_direction["down"]["n"] >= 100
        ),
    }
    screen["pass"] = bool(all(screen.values()))

    report = {
        "scope": "GTG Transition Memory v0.1 Train-only",
        "validation_read": False,
        "holdout_read": False,
        "training_n": int(len(train_rows)),
        "training_trend_prevalence": prior,
        "evaluation_n": int(len(records)),
        "evaluation_trend_prevalence": prevalence,
        "quality": quality,
        "integrity": {
            "frozen_memory_sha_unchanged": "PASS",
            "training_memory_sha_unchanged": "PASS",
            "no_training_event_at_or_after_2021": "PASS",
            "no_evaluation_event_before_2021": "PASS",
            "source_state_sha_unchanged": "PASS",
            "source_manifest_matches": "PASS",
            "sequence_excludes_onset": "PASS",
            "validation_read": False,
            "holdout_read": False,
        },
        "metrics": metrics,
        "by_candidate_direction": by_direction,
        "by_year_hybrid": by_year,
        "primary_hybrid_utility_screen": screen,
    }
    (out / "summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )

    print(json.dumps({
        "training_n": report["training_n"],
        "evaluation_n": report["evaluation_n"],
        "training_prevalence": prior,
        "evaluation_prevalence": prevalence,
        "metrics": metrics,
        "by_candidate_direction": by_direction,
        "screen": screen,
    }, indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="command", required=True)
    for cmd in ("fit", "evaluate"):
        q = sub.add_parser(cmd)
        q.add_argument("--root", required=True)
        q.add_argument("--source-run", required=True)
        q.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.command == "fit":
        fit(Path(a.root), Path(a.source_run), Path(a.out))
    else:
        evaluate(Path(a.root), Path(a.source_run), Path(a.out))



if __name__ == "__main__":
    main()
