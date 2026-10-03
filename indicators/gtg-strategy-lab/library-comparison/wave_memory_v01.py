"""Wave Memory v0.1 — preregistered Train-only event representation experiment."""
from __future__ import annotations
import os
os.environ.setdefault("NUMBA_NUM_THREADS", "2")
os.environ.setdefault("OMP_NUM_THREADS", "2")
import argparse, hashlib, json, sys, time
from pathlib import Path
from datetime import datetime, timezone
import importlib.metadata as md
import numpy as np
import pandas as pd
from tslearn.metrics import cdist_dtw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compare import dc_states, costs, kronos_load, kronos_predict
from event_library_v02 import load_frames

DEV_START = "2023-01-01"
DEV_END = "2024-03-01"
SIG_N = 6
K = 7
N_ANCHORS = 96
SEED = 20261003

def ms(date):
    return int(pd.Timestamp(date, tz="UTC").timestamp() * 1000)

def build_events(f: pd.DataFrame, threshold: float):
    """Completed pivot-to-pivot legs, published only on DC confirmation bars."""
    states = dc_states(f.bc.to_numpy(), threshold)
    pivots, events = [], []
    last_pivot = None
    prev_amp = None
    for i, st in enumerate(states):
        if st["confirmed_at"] != i or st["pivot_at"] < 0:
            continue
        pivot = (int(st["pivot_at"]), float(st["pivot_price"]), i, int(st["direction"]))
        if last_pivot is not None and pivot[0] != last_pivot[0]:
            p0_i, p0, _, _ = last_pivot
            p1_i, p1, confirm_i, new_dir = pivot
            duration = p1_i - p0_i
            atr = float(f.atr.iloc[confirm_i])
            if duration > 0 and np.isfinite(atr) and atr > 0:
                amp = p1 / p0 - 1.0
                lag = confirm_i - p1_i
                event = {
                    "pivot_start_i": p0_i,
                    "pivot_i": p1_i,
                    "confirm_i": confirm_i,
                    "confirm_t": int(f.t.iloc[confirm_i]),
                    "new_dc_direction": new_dir,
                    "leg_direction": int(np.sign(amp)),
                    "amplitude_pct": float(amp),
                    "duration_bars": int(duration),
                    "confirmation_lag_bars": int(max(lag, 0)),
                    "speed": float(amp / duration),
                    "atr_amplitude": float((p1 - p0) / atr),
                    "retrace_ratio": float(abs(amp) / abs(prev_amp)) if prev_amp not in (None, 0.0) else 1.0,
                    "overshoot_pct": None,
                }
                events.append(event)
                prev_amp = amp
        if not pivots or pivot[0] != pivots[-1]:
            pivots.append(pivot[0])
            last_pivot = pivot
    return states, events

def feature_row(e):
    return np.array([
        e["amplitude_pct"],
        np.log1p(e["duration_bars"]),
        np.log1p(e["confirmation_lag_bars"]),
        e["speed"],
        e["atr_amplitude"],
        e["retrace_ratio"],
    ], dtype=float)

def robust_params(events):
    x = np.vstack([feature_row(e) for e in events if e["confirm_t"] < ms(DEV_START)])
    if len(x) < 20:
        raise ValueError("insufficient pre-development events for robust scaling")
    med = np.median(x, axis=0)
    q1, q3 = np.percentile(x, [25, 75], axis=0)
    scale = q3 - q1
    scale[scale < 1e-12] = 1.0
    return med, scale

def signatures(events, med, scale):
    sigs = {}
    for end in range(SIG_N - 1, len(events)):
        raw = np.vstack([feature_row(e) for e in events[end-SIG_N+1:end+1]])
        if np.all(np.isfinite(raw)):
            sigs[end] = (raw - med) / scale
    return sigs

def last_event_at(events, q):
    lo, hi = 0, len(events)
    while lo < hi:
        mid = (lo + hi) // 2
        if events[mid]["confirm_i"] <= q:
            lo = mid + 1
        else:
            hi = mid
    return lo - 1

def candidate_pool(f, events, sigs, query_end, q, h, step):
    age = q - events[query_end]["confirm_i"]
    t = f.t.to_numpy()
    out = []
    for end, sig in sigs.items():
        if end >= query_end:
            break
        anchor = events[end]["confirm_i"] + age
        if anchor < events[end]["confirm_i"] or anchor + h >= q:
            continue
        if end + 1 < len(events) and events[end + 1]["confirm_i"] <= anchor:
            continue
        if not np.isfinite(f.atr.iloc[anchor]) or f.atr.iloc[anchor] <= 0:
            continue
        if np.any(np.diff(t[anchor:anchor+h+1]) != step):
            continue
        if t[anchor+h] + step > t[q]:
            continue
        label = float((f.bc.iloc[anchor+h] - f.bc.iloc[anchor]) / f.atr.iloc[anchor])
        out.append((end, anchor, sig, label))
    return out

def wave_predict(f, events, sigs, q, h, step):
    qe = last_event_at(events, q)
    if qe < SIG_N - 1 or qe not in sigs:
        return 0.0, {"reason": "insufficient_query_events", "neighbors": []}
    pool = candidate_pool(f, events, sigs, qe, q, h, step)
    if len(pool) < K:
        return 0.0, {"reason": "insufficient_candidates", "neighbors": []}
    query = sigs[qe][None, :, :]
    bank = np.stack([r[2] for r in pool], axis=0)
    dist = cdist_dtw(query, bank, global_constraint="sakoe_chiba",
                     sakoe_chiba_radius=2)[0]
    order = np.argsort(dist, kind="stable")
    selected = []
    for idx in order:
        end, anchor, _, label = pool[int(idx)]
        if all(abs(end - s["event_end"]) >= SIG_N for s in selected):
            selected.append({
                "event_end": int(end),
                "anchor_i": int(anchor),
                "anchor_t": int(f.t.iloc[anchor]),
                "distance": float(dist[int(idx)]),
                "label": float(label),
            })
            if len(selected) == K:
                break
    if len(selected) < K:
        return 0.0, {"reason": "insufficient_independent_candidates", "neighbors": selected}
    pred = float(np.median([s["label"] for s in selected]))
    return pred, {"reason": "ok", "neighbors": selected,
                  "query_event_end": int(qe),
                  "age_bars": int(q - events[qe]["confirm_i"])}

def eligible_anchors(f, events, h, step):
    t = f.t.to_numpy()
    choices = []
    for q in range(max(12, SIG_N), len(f)-h):
        if not (ms(DEV_START) <= t[q] < ms(DEV_END)):
            continue
        if not np.isfinite(f.atr.iloc[q]) or f.atr.iloc[q] <= 0:
            continue
        if last_event_at(events, q) < SIG_N - 1:
            continue
        if np.any(np.diff(t[q:q+h+1]) != step):
            continue
        choices.append(q)
    if len(choices) < N_ANCHORS:
        raise ValueError(f"only {len(choices)} eligible anchors")
    raw = [choices[i] for i in np.unique(np.linspace(0, len(choices)-1, N_ANCHORS, dtype=int))]
    selected = []
    for q in raw:
        if not selected or q > selected[-1] + h:
            selected.append(q)
    if len(selected) != N_ANCHORS:
        raise ValueError(f"registered anchor count failed: {len(selected)}")
    return selected

def summarize(records):
    df = pd.DataFrame(records)
    rows = []
    for (track, model), g in df.groupby(["track", "model"]):
        active = g[g.direction != 0]
        sign_rows = active[active.actual != 0]
        rows.append({
            "track": track,
            "model": model,
            "n": int(len(g)),
            "active": int(len(active)),
            "coverage": float(len(active)/len(g)),
            "mae_atr": float(np.mean(np.abs(g.pred-g.actual))),
            "direction_accuracy": float(np.mean(sign_rows.direction == np.sign(sign_rows.actual))) if len(sign_rows) else None,
            "c1_win_rate": float(np.mean(active.c1 > 0)) if len(active) else None,
            "c0_mean_per_opportunity": float(g.c0.mean()),
            "c1_mean_per_opportunity": float(g.c1.mean()),
            "c2_mean_per_opportunity": float(g.c2.mean()),
            "c1_mean_per_trade": float(active.c1.mean()) if len(active) else None,
            "total_seconds": float(g.seconds.sum()),
            "evidence": "PRETRAINED_CONTAMINATION_UNKNOWN" if model == "kronos_mini" else "TRAIN_DEVELOPMENT_ONLY",
        })
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--vendor", required=True)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=False)
    protocol = HERE / "PROTOCOL_WAVE_MEMORY_V0_1.md"
    env = {
        "python": sys.version,
        "packages": {n: md.version(n) for n in ("numpy","pandas","tslearn","torch","huggingface-hub")},
        "protocol_sha256": hashlib.sha256(protocol.read_bytes()).hexdigest(),
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    (out/"environment.json").write_text(json.dumps(env, indent=2))

    frames, quality = load_frames(Path(args.root), out)
    predictor = kronos_load(Path(args.vendor), out)

    configs = {
        "scalp": {"h":3, "step":300000, "threshold":0.001},
        "swing": {"h":4, "step":3600000, "threshold":0.005},
    }
    checks, records = {}, []

    for track, cfg in configs.items():
        f = frames[track]
        h, step, threshold = cfg["h"], cfg["step"], cfg["threshold"]
        states, events = build_events(f, threshold)
        med, scale = robust_params(events)
        sigs = signatures(events, med, scale)
        anchors = eligible_anchors(f, events, h, step)

        first_q = anchors[0]
        _, prefix_events = build_events(f.iloc[:first_q+1].copy(), threshold)
        full_prefix = [e for e in events if e["confirm_i"] <= first_q]
        assert prefix_events == full_prefix
        checks[f"{track}_prefix_events"] = "PASS"

        cohort = {
            "quality": quality[track],
            "events": len(events),
            "predev_events": sum(e["confirm_t"] < ms(DEV_START) for e in events),
            "signature_count": len(sigs),
            "anchors": [int(f.t.iloc[q]) for q in anchors],
            "robust_median": med.tolist(),
            "robust_iqr": scale.tolist(),
        }
        (out/f"{track}_cohort.json").write_text(json.dumps(cohort, indent=2))

        for n, q in enumerate(anchors):
            tic = time.perf_counter()
            wave_pred, wave_meta = wave_predict(f, events, sigs, q, h, step)
            wave_seconds = time.perf_counter() - tic
            if wave_meta["reason"] == "ok":
                for nei in wave_meta["neighbors"]:
                    assert nei["anchor_i"] + h < q
                    assert int(f.t.iloc[nei["anchor_i"] + h]) + step <= int(f.t.iloc[q])
                checks[f"{track}_memory_maturity"] = "PASS"

            preds = {
                "flat": (0.0, 0.0, None),
                "drift": (float((f.bc.iloc[q]-f.bc.iloc[q-12])*h/12/f.atr.iloc[q]), 0.0, None),
                "dc_direction": (float(states[q]["direction"]*h/12), 0.0, None),
                "event_wave_dtw": (wave_pred, wave_seconds, wave_meta),
            }

            tic = time.perf_counter()
            kp = kronos_predict(predictor, f.iloc[:q+1], h, step, SEED+q)
            ksec = time.perf_counter() - tic
            if n == 0:
                kp2 = kronos_predict(predictor, f.iloc[:q+1].copy(), h, step, SEED+q)
                assert kp == kp2
                checks[f"{track}_kronos_repeat"] = "PASS"
            preds["kronos_mini"] = (kp, ksec, None)

            actual = float((f.bc.iloc[q+h]-f.bc.iloc[q]) / f.atr.iloc[q])
            for model, (pred, seconds, meta) in preds.items():
                direction = int(np.sign(pred))
                rec = {
                    "track": track,
                    "model": model,
                    "time": int(f.t.iloc[q]),
                    "pred": float(pred),
                    "actual": actual,
                    "direction": direction,
                    "seconds": float(seconds),
                    **costs(direction,
                            float(f.bo.iloc[q+1]), float(f.ao.iloc[q+1]),
                            float(f.bc.iloc[q+h]), float(f.ac.iloc[q+h]),
                            float(f.atr.iloc[q])),
                }
                if meta is not None:
                    rec["wave_meta"] = meta
                records.append(rec)
                with (out/"predictions.jsonl").open("a", encoding="utf-8") as fh:
                    fh.write(json.dumps(rec) + "\n")
            print("DONE", track, n+1, "/", len(anchors), flush=True)

        (out/"checks.json").write_text(json.dumps(checks, indent=2))

    report = {
        "scope": "2018-03..2024-03 Train-only wave memory; development anchors 2023-01..2024-03",
        "holdout_read": False,
        "validation_read": False,
        "checks": checks,
        "results": summarize(records),
        "limitations": [
            "Train-development evidence only; no edge claim",
            "Kronos pretraining overlap unknown",
            "DC thresholds/horizons inherited from pilot-002",
            "event signature uses confirmed completed legs; no intrabar ordering",
            "fixed-horizon execution; no stop/target simulation",
            "C1/C2 are benchmark execution assumptions, not live-account fee schedules",
        ],
    }
    (out/"summary.json").write_text(json.dumps(report, indent=2, allow_nan=False))
    print(json.dumps(report, indent=2), flush=True)

if __name__ == "__main__":
    main()
