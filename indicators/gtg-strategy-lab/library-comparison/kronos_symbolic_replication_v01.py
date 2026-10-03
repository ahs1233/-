"""Pinned Kronos comparator for Multi-Scale Symbolic v0.1 replication.

Runs only on the already-frozen replication anchors from multiscale-symbolic-v01-003.
Does not alter symbolic equations, screens, features, thresholds, or anchors.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "data"))

from compare import kronos_predict, costs, W
from multiscale_symbolic_v01 import TRACKS, REPLICATION_END, SEED, load_source, frame_for, sha

SOURCE_REV = "67b630e67f6a18c9e9be918d9b4337c960db1e9a"
PINNED = {
    "NeoQuasar/Kronos-Tokenizer-2k": "26966d0035065a0cae0ebad7af8ece35bc1fb51c",
    "NeoQuasar/Kronos-mini": "f4e68697d9d5aed55cef5c96aabc3376bcad9f81",
}


def load_pinned(vendor: Path, run: Path):
    import torch
    from huggingface_hub import snapshot_download

    actual = subprocess.check_output(
        ["git", "-C", str(vendor), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual != SOURCE_REV:
        raise ValueError(f"Kronos source revision mismatch: {actual}")

    sys.path.insert(0, str(vendor))
    from model import Kronos, KronosTokenizer, KronosPredictor

    torch.set_num_threads(2)
    local = {}
    for repo, revision in PINNED.items():
        local[repo] = snapshot_download(
            repo_id=repo,
            revision=revision,
            allow_patterns=["*.json", "*.safetensors"],
        )

    (run / "model_revisions_kronos.json").write_text(
        json.dumps({"source": SOURCE_REV, **PINNED}, indent=2),
        encoding="utf-8",
    )

    tok = KronosTokenizer.from_pretrained(local["NeoQuasar/Kronos-Tokenizer-2k"])
    model = Kronos.from_pretrained(local["NeoQuasar/Kronos-mini"])
    tok.eval()
    model.eval()
    return KronosPredictor(model, tok, device="cpu", max_context=2048)


def metric_block(g: pd.DataFrame):
    active = g[g.direction != 0]
    sign_rows = active[active.actual != 0]
    out = {
        "n": int(len(g)),
        "active": int(len(active)),
        "coverage": float(len(active) / len(g)) if len(g) else 0.0,
        "mae_atr": float(np.mean(np.abs(g.pred - g.actual))) if len(g) else None,
        "direction_accuracy": (
            float(np.mean(sign_rows.direction == np.sign(sign_rows.actual)))
            if len(sign_rows) else None
        ),
        "win_rate_c1": float(np.mean(active.c1 > 0)) if len(active) else None,
        "total_seconds": float(g.seconds.sum()) if len(g) else 0.0,
        "evidence": "PRETRAINED_CONTAMINATION_UNKNOWN",
    }
    for c in ("c0", "c1", "c2"):
        out[f"{c}_mean_per_opportunity"] = float(g[c].mean()) if len(g) else None
        out[f"{c}_mean_per_trade"] = float(active[c].mean()) if len(active) else None
    return out


def quarter_blocks(df: pd.DataFrame):
    rows = []
    qdf = df.copy()
    qdf["quarter"] = (
        pd.to_datetime(qdf.time, unit="ms", utc=True)
        .dt.tz_localize(None)
        .dt.to_period("Q")
        .astype(str)
    )
    for (track, quarter), part in qdf.groupby(["track", "quarter"]):
        rows.append({
            "track": track,
            "model": "kronos_mini",
            "quarter": quarter,
            **metric_block(part),
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--run", required=True)
    ap.add_argument("--vendor", required=True)
    args = ap.parse_args()

    root = Path(args.root)
    run = Path(args.run)
    vendor = Path(args.vendor)

    frozen = run / "SELECTED_EQUATIONS_FROZEN.json"
    freeze_path = run / "freeze.json"
    symbolic_summary_path = run / "summary_symbolic.json"
    symbolic_predictions_path = run / "replication_predictions_symbolic.jsonl"

    for p in (frozen, freeze_path, symbolic_summary_path, symbolic_predictions_path):
        if not p.exists():
            raise FileNotFoundError(f"required artifact missing: {p}")

    freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
    if not freeze.get("replication_opened"):
        raise ValueError("replication was not formally opened")
    if freeze["selected_sha256"] != sha(frozen):
        raise ValueError("frozen equations changed after opening")

    # Reload exact same raw date gate and prove the source files match.
    kronos_manifest_path = run / "input_manifest_kronos.json"
    rows = load_source(root, REPLICATION_END, kronos_manifest_path)
    baseline_manifest = json.loads(
        (run / "input_manifest_replication.json").read_text(encoding="utf-8")
    )
    current_manifest = json.loads(kronos_manifest_path.read_text(encoding="utf-8"))
    if baseline_manifest != current_manifest:
        raise ValueError("Kronos source manifest differs from symbolic replication")

    predictor = load_pinned(vendor, run)
    records = []
    checks = {
        "frozen_equation_sha_unchanged": "PASS",
        "source_manifest_matches_symbolic": "PASS",
        "pinned_kronos_revisions": "PASS",
    }

    out_path = run / "replication_predictions_kronos.jsonl"
    if out_path.exists():
        raise FileExistsError(f"refusing overwrite: {out_path}")

    for track, cfg in TRACKS.items():
        f, _ = frame_for(rows, cfg["tf"], cfg["step"])
        cohort_path = run / track / "replication_anchors.json"
        cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
        anchor_times = [int(t) for t in cohort["times"]]
        if len(anchor_times) != 240:
            raise ValueError(f"{track}: expected 240 frozen anchors")

        t_to_i = {int(t): i for i, t in enumerate(f.t.to_numpy())}
        anchors = []
        for t in anchor_times:
            if t not in t_to_i:
                raise ValueError(f"{track}: frozen anchor missing {t}")
            q = t_to_i[t]
            if q < W - 1 or q + cfg["h"] >= len(f):
                raise ValueError(f"{track}: anchor lacks Kronos context/future")
            if not np.all(
                np.diff(f.t.to_numpy()[q:q + cfg["h"] + 1]) == cfg["step"]
            ):
                raise ValueError(f"{track}: noncontiguous horizon")
            anchors.append(q)

        if [int(f.t.iloc[q]) for q in anchors] != anchor_times:
            raise AssertionError("anchor order changed")
        checks[f"{track}_exact_frozen_anchors"] = "PASS"

        for n, q in enumerate(anchors):
            seed = SEED + q
            tic = time.perf_counter()
            pred = kronos_predict(
                predictor, f.iloc[:q+1], cfg["h"], cfg["step"], seed
            )
            seconds = time.perf_counter() - tic

            if n == 0:
                pred2 = kronos_predict(
                    predictor, f.iloc[:q+1].copy(), cfg["h"], cfg["step"], seed
                )
                if pred != pred2:
                    raise AssertionError(f"{track}: Kronos same-seed repeat failed")
                checks[f"{track}_same_seed_repeat"] = "PASS"

            direction = int(np.sign(pred))
            atr = float(f.atr.iloc[q])
            actual = float(
                (f.bc.iloc[q + cfg["h"]] - f.bc.iloc[q]) / atr
            )
            rec = {
                "track": track,
                "model": "kronos_mini",
                "time": int(f.t.iloc[q]),
                "pred": float(pred),
                "actual": actual,
                "direction": direction,
                "seconds": seconds,
                **costs(
                    direction,
                    float(f.bo.iloc[q+1]),
                    float(f.ao.iloc[q+1]),
                    float(f.bc.iloc[q+cfg["h"]]),
                    float(f.ac.iloc[q+cfg["h"]]),
                    atr,
                ),
            }
            records.append(rec)
            with out_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec) + "\n")

            if (n + 1) % 20 == 0 or n == 0 or n + 1 == len(anchors):
                print(f"DONE {track} {n+1}/{len(anchors)}", flush=True)

    df = pd.DataFrame(records)
    results = []
    for track, g in df.groupby("track"):
        results.append({
            "track": track,
            "model": "kronos_mini",
            **metric_block(g),
        })

    kronos_report = {
        "scope": "Pinned Kronos on exact Multi-Scale Symbolic v0.1 replication anchors",
        "validation_read": False,
        "holdout_read": False,
        "checks": checks,
        "results": results,
        "quarterly": quarter_blocks(df),
        "limitations": [
            "PRETRAINED_CONTAMINATION_UNKNOWN",
            "No fine tuning",
            "Same fixed-horizon side-aware cost arithmetic as symbolic replication",
        ],
    }
    (run / "summary_kronos.json").write_text(
        json.dumps(kronos_report, indent=2, allow_nan=False),
        encoding="utf-8",
    )

    symbolic = json.loads(symbolic_summary_path.read_text(encoding="utf-8"))
    complete = {
        "scope": "Multi-Scale DC + Symbolic v0.1 complete Train-only replication",
        "validation_read": False,
        "holdout_read": False,
        "selected_sha256": freeze["selected_sha256"],
        "checks": {
            **symbolic.get("checks", {}),
            **checks,
        },
        "primary_replication_screen": symbolic["primary_replication_screen"],
        "results": symbolic["results_without_kronos"] + results,
        "quarterly": symbolic["quarterly_without_kronos"] + kronos_report["quarterly"],
        "kronos_evidence": "PRETRAINED_CONTAMINATION_UNKNOWN",
    }
    (run / "summary_complete.json").write_text(
        json.dumps(complete, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    print(json.dumps({
        "checks": checks,
        "kronos_results": results,
        "screen": symbolic["primary_replication_screen"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
