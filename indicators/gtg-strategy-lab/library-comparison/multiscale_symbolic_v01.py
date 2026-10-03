"""Multi-scale Directional Change + PySR v0.1.

Preregistered in PROTOCOL_MULTISCALE_SYMBOLIC_V0_1.md before implementation.
Discovery/selection and replication are deliberately separate commands so the
selected symbolic expression is frozen before replication data is opened.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as md
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

os.environ.setdefault("OMP_NUM_THREADS", "2")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "data"))
from store import read_day
from compare import frame_for, dc_states, costs, ms

PROTOCOL = HERE / "PROTOCOL_MULTISCALE_SYMBOLIC_V0_1.md"
RAW_START = "2018-03-01"
DISCOVERY_START = "2019-01-01"
DISCOVERY_END = "2020-04-01"
SELECTION_END = "2020-07-01"
REPLICATION_END = "2021-07-31"
SEED = 20261003
MULTS = (0.5, 1.0, 2.0, 4.0)

TRACKS = {
    "scalp": {"tf": "M5", "step": 300_000, "h": 3, "base": 0.001},
    "swing": {"tf": "H1", "step": 3_600_000, "h": 4, "base": 0.005},
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_bar(b):
    for side in ("b", "a"):
        o, h, l, c = (b[side + x] for x in ("o", "h", "l", "c"))
        if any(v is None or not np.isfinite(v) or v <= 0 for v in (o, h, l, c)):
            raise ValueError("missing/invalid quote")
        if not l <= min(o, c) <= max(o, c) <= h:
            raise ValueError("invalid OHLC")
    if b["ao"] < b["bo"] or b["ac"] < b["bc"]:
        raise ValueError("crossed quote")


def load_source(root: Path, end_exclusive: str, manifest_path: Path):
    if not (RAW_START < end_exclusive <= REPLICATION_END):
        raise ValueError("raw date gate")
    rows, manifest = [], []
    day = datetime.fromisoformat(RAW_START)
    stop = datetime.fromisoformat(end_exclusive)
    while day < stop:
        ds = day.strftime("%Y-%m-%d")
        p = root / "m1" / day.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if p.exists():
            blob = p.read_bytes()
            manifest.append({"day": ds, "sha256": hashlib.sha256(blob).hexdigest(),
                             "bytes": len(blob)})
            rr = read_day(p)
            for b in rr:
                validate_bar(b)
            rows.extend(rr)
        day += timedelta(days=1)
    if not rows:
        raise ValueError("no source rows")
    t = np.asarray([b["t"] for b in rows], dtype=np.int64)
    if np.any(np.diff(t) <= 0):
        raise ValueError("timestamps not strictly increasing")
    if t.min() < ms(RAW_START) or t.max() >= ms(end_exclusive):
        raise ValueError("source crossed registered raw gate")
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return rows


def threshold_features(f: pd.DataFrame, threshold: float):
    """Causal features for one DC threshold, available only at confirmation."""
    close = f.bc.to_numpy(dtype=float)
    atr = f.atr.to_numpy(dtype=float)
    states = dc_states(close, threshold)
    n = len(f)
    direction = np.asarray([s["direction"] for s in states], dtype=float)
    age = np.zeros(n, dtype=float)
    amp_atr = np.zeros(n, dtype=float)
    retrace = np.zeros(n, dtype=float)

    last_pivot_i = None
    last_pivot_price = None
    prev_amp = None
    current_amp_atr = 0.0
    current_retrace = 0.0
    last_confirm = -1

    for i, s in enumerate(states):
        if s["confirmed_at"] == i and s["pivot_at"] >= 0:
            p_i = int(s["pivot_at"])
            p = float(s["pivot_price"])
            last_confirm = i
            if last_pivot_i is not None and p_i != last_pivot_i:
                raw_amp = p / last_pivot_price - 1.0
                if np.isfinite(atr[i]) and atr[i] > 0:
                    current_amp_atr = (p - last_pivot_price) / atr[i]
                else:
                    current_amp_atr = 0.0
                if prev_amp is not None and abs(prev_amp) > 1e-15:
                    current_retrace = np.log1p(abs(raw_amp / prev_amp))
                else:
                    current_retrace = 0.0
                prev_amp = raw_amp
            last_pivot_i = p_i
            last_pivot_price = p

        age[i] = np.log1p(max(0, i - last_confirm)) if last_confirm >= 0 else 0.0
        amp_atr[i] = current_amp_atr
        retrace[i] = current_retrace

    return states, np.column_stack([direction, age, amp_atr, retrace])


def multiscale_matrix(f: pd.DataFrame, base: float):
    mats = []
    names = []
    states_by_mult = {}
    for mult in MULTS:
        th = base * mult
        states, mat = threshold_features(f, th)
        states_by_mult[mult] = states
        tag = str(mult).replace(".", "p")
        names.extend([f"dc{tag}_dir", f"dc{tag}_age",
                      f"dc{tag}_amp_atr", f"dc{tag}_retrace"])
        mats.append(mat)

    c = f.bc.to_numpy(dtype=float)
    atr = f.atr.to_numpy(dtype=float)
    drift12 = np.zeros(len(f), dtype=float)
    drift12[12:] = (c[12:] - c[:-12]) / atr[12:]
    spread_atr = (f.ac.to_numpy(dtype=float) - c) / atr
    X = np.column_stack(mats + [drift12, spread_atr])
    names += ["drift12", "spread_atr"]
    return X, names, states_by_mult


def complete_future(f, i, h, step):
    if i < 12 or i + h >= len(f):
        return False
    if not np.isfinite(f.atr.iloc[i]) or f.atr.iloc[i] <= 0:
        return False
    if not np.all(np.diff(f.t.to_numpy()[i:i+h+1]) == step):
        return False
    return True


def greedy_interval_anchors(f, start, end, h, step):
    t = f.t.to_numpy()
    result = []
    for i in range(12, len(f)-h):
        if not (ms(start) <= t[i] < ms(end)):
            continue
        if not complete_future(f, i, h, step):
            continue
        # The target itself must mature inside the registered interval.
        # This prevents the final discovery/selection anchor from borrowing
        # outcome bars from the next split.
        if t[i+h] >= ms(end):
            continue
        if not result or i > result[-1] + h:
            result.append(i)
    if not result:
        raise ValueError(f"no anchors in {start}..{end}")
    return result


def replication_anchors(f, h, step):
    spaced = greedy_interval_anchors(
        f, SELECTION_END, REPLICATION_END, h, step
    )
    if len(spaced) < 240:
        raise ValueError(f"only {len(spaced)} replication anchors")
    pick = np.unique(np.linspace(0, len(spaced)-1, 240, dtype=int))
    if len(pick) != 240:
        raise AssertionError("replication count")
    return [spaced[int(j)] for j in pick]


def xy(f, Xall, anchors, h):
    y = np.asarray([
        (f.bc.iloc[i+h] - f.bc.iloc[i]) / f.atr.iloc[i]
        for i in anchors
    ], dtype=float)
    X = Xall[np.asarray(anchors)]
    if not np.all(np.isfinite(X)) or not np.all(np.isfinite(y)):
        raise ValueError("non-finite X/y")
    return X, y


def env_record(extra=None, include_symbolic=False):
    packages = {}
    package_names = ["numpy", "pandas"]
    if include_symbolic:
        package_names += ["pysr", "juliacall", "juliapkg"]
    for name in package_names:
        try:
            packages[name] = md.version(name)
        except Exception:
            pass
    d = {
        "python": sys.version,
        "packages": packages,
        "protocol_sha256": sha(PROTOCOL),
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    if include_symbolic:
        import pysr
        from juliacall import Main as jl
        julia_version = str(jl.seval("string(VERSION)"))
        symbolic_version = str(
            jl.seval("import SymbolicRegression; string(pkgversion(SymbolicRegression))")
        )
        if pysr.__version__ != "2.6.0":
            raise RuntimeError(f"unexpected PySR {pysr.__version__}")
        d["symbolic_runtime"] = {
            "pysr": pysr.__version__,
            "julia": julia_version,
            "SymbolicRegression.jl": symbolic_version,
        }
    if extra:
        d.update(extra)
    return d


def save_anchor_info(path, f, anchors):
    path.write_text(json.dumps({
        "count": len(anchors),
        "times": [int(f.t.iloc[i]) for i in anchors],
        "indices": [int(i) for i in anchors],
    }, indent=2), encoding="utf-8")


def discover(root: Path, out: Path):
    out.mkdir(parents=True, exist_ok=False)
    (out / "environment.json").write_text(
        json.dumps(
            env_record({"stage": "discover_select"}, include_symbolic=True),
            indent=2,
        ),
        encoding="utf-8",
    )
    rows = load_source(root, SELECTION_END, out / "input_manifest_discovery.json")

    selected_all = {}
    for track, cfg in TRACKS.items():
        f, quality = frame_for(rows, cfg["tf"], cfg["step"])
        Xall, names, states = multiscale_matrix(f, cfg["base"])

        # Safety: prefix invariance on every DC scale at a deterministic cut.
        cut = min(len(f)-1, max(100, len(f)//2))
        for mult in MULTS:
            prefix = dc_states(f.bc.iloc[:cut+1].to_numpy(), cfg["base"]*mult)
            if prefix != states[mult][:cut+1]:
                raise AssertionError(f"{track} DC prefix causality {mult}")

        disc = greedy_interval_anchors(
            f, DISCOVERY_START, DISCOVERY_END, cfg["h"], cfg["step"]
        )
        sel = greedy_interval_anchors(
            f, DISCOVERY_END, SELECTION_END, cfg["h"], cfg["step"]
        )
        if f.t.iloc[disc[-1] + cfg["h"]] >= f.t.iloc[sel[0]]:
            raise AssertionError("discovery outcome overlaps selection")

        Xd, yd = xy(f, Xall, disc, cfg["h"])
        Xs, ys = xy(f, Xall, sel, cfg["h"])

        track_dir = out / track
        track_dir.mkdir()
        save_anchor_info(track_dir / "discovery_anchors.json", f, disc)
        save_anchor_info(track_dir / "selection_anchors.json", f, sel)
        (track_dir / "quality.json").write_text(
            json.dumps(quality, indent=2), encoding="utf-8"
        )
        (track_dir / "features.json").write_text(
            json.dumps(names, indent=2), encoding="utf-8"
        )

        from pysr import PySRRegressor
        model = PySRRegressor(
            niterations=120,
            binary_operators=["+", "-", "*", "/"],
            unary_operators=["abs"],
            maxsize=15,
            maxdepth=8,
            random_state=SEED,
            deterministic=True,
            parallelism="serial",
            progress=False,
            verbosity=1,
            model_selection="accuracy",
            output_directory=str(track_dir / "pysr_output"),
        )
        model.fit(Xd, yd, variable_names=names)

        eq = model.equations_.copy()
        rows_out = []
        candidates = []
        for pos in range(len(eq)):
            complexity = int(eq.iloc[pos]["complexity"])
            if complexity > 15:
                continue
            pred = np.asarray(model.predict(Xs, index=pos), dtype=float)
            if pred.ndim == 0:
                pred = np.full(len(ys), float(pred))
            pred = pred.reshape(-1)
            if len(pred) != len(ys) or not np.all(np.isfinite(pred)):
                mae = float("inf")
            else:
                mae = float(np.mean(np.abs(pred - ys)))
            expr = str(eq.iloc[pos].get("sympy_format", eq.iloc[pos]["equation"]))
            rec = {
                "table_position": pos,
                "complexity": complexity,
                "selection_mae": mae,
                "equation": str(eq.iloc[pos]["equation"]),
                "sympy": expr,
            }
            rows_out.append(rec)
            if np.isfinite(mae):
                candidates.append((mae, complexity, pos, rec))

        if not candidates:
            raise RuntimeError(f"{track}: no finite PySR equation")
        candidates.sort(key=lambda z: (z[0], z[1], z[2]))
        chosen = dict(candidates[0][3])
        chosen.update({
            "track": track,
            "feature_names": names,
            "discovery_n": len(disc),
            "selection_n": len(sel),
            "selected_utc": datetime.now(timezone.utc).isoformat(),
            "selection_rule": "min MAE; tie lower complexity then table order",
        })
        (track_dir / "equations_selection.json").write_text(
            json.dumps(rows_out, indent=2), encoding="utf-8"
        )
        (track_dir / "selected_equation.json").write_text(
            json.dumps(chosen, indent=2), encoding="utf-8"
        )
        selected_all[track] = chosen
        print("SELECTED", track, json.dumps(chosen), flush=True)

    frozen = out / "SELECTED_EQUATIONS_FROZEN.json"
    frozen.write_text(json.dumps(selected_all, indent=2), encoding="utf-8")
    (out / "freeze.json").write_text(json.dumps({
        "selected_file": str(frozen.name),
        "selected_sha256": sha(frozen),
        "frozen_utc": datetime.now(timezone.utc).isoformat(),
        "replication_opened": False,
    }, indent=2), encoding="utf-8")
    print("DISCOVERY_SELECTION_COMPLETE", sha(frozen), flush=True)


def eval_expression(expr: str, names, X):
    import sympy as sp
    symbols = [sp.Symbol(n) for n in names]
    local = {n: s for n, s in zip(names, symbols)}
    parsed = sp.sympify(expr, locals=local)
    fn = sp.lambdify(symbols, parsed, modules="numpy")
    args = [X[:, j] for j in range(X.shape[1])]
    y = np.asarray(fn(*args), dtype=float)
    if y.ndim == 0:
        y = np.full(X.shape[0], float(y))
    return y.reshape(-1)


def metric_block(g: pd.DataFrame):
    active = g[g.direction != 0]
    sign_rows = active[active.actual != 0]
    d = {
        "n": int(len(g)),
        "active": int(len(active)),
        "coverage": float(len(active)/len(g)) if len(g) else 0.0,
        "mae_atr": float(np.mean(np.abs(g.pred-g.actual))) if len(g) else None,
        "direction_accuracy": (
            float(np.mean(sign_rows.direction == np.sign(sign_rows.actual)))
            if len(sign_rows) else None
        ),
        "win_rate_c1": float(np.mean(active.c1 > 0)) if len(active) else None,
    }
    for c in ("c0", "c1", "c2"):
        d[f"{c}_mean_per_opportunity"] = float(g[c].mean()) if len(g) else None
        d[f"{c}_mean_per_trade"] = float(active[c].mean()) if len(active) else None
    return d


def replicate(root: Path, out: Path):
    frozen = out / "SELECTED_EQUATIONS_FROZEN.json"
    freeze = out / "freeze.json"
    if not frozen.exists() or not freeze.exists():
        raise FileNotFoundError("frozen selected equations required")
    freeze_info = json.loads(freeze.read_text(encoding="utf-8"))
    if freeze_info["selected_sha256"] != sha(frozen):
        raise ValueError("selected equation file changed after freeze")
    selected = json.loads(frozen.read_text(encoding="utf-8"))

    # Only now open replication-era raw data.
    rows = load_source(root, REPLICATION_END, out / "input_manifest_replication.json")
    all_records = []
    checks = {"selected_equations_frozen_before_replication": "PASS"}

    for track, cfg in TRACKS.items():
        f, quality = frame_for(rows, cfg["tf"], cfg["step"])
        Xall, names, states = multiscale_matrix(f, cfg["base"])
        if names != selected[track]["feature_names"]:
            raise ValueError("feature contract changed")

        anchors = replication_anchors(f, cfg["h"], cfg["step"])
        Xr, yr = xy(f, Xall, anchors, cfg["h"])
        pred_symbolic = eval_expression(selected[track]["sympy"], names, Xr)
        if len(pred_symbolic) != len(anchors) or not np.all(np.isfinite(pred_symbolic)):
            raise ValueError("symbolic replication prediction invalid")

        track_dir = out / track
        save_anchor_info(track_dir / "replication_anchors.json", f, anchors)
        (track_dir / "replication_quality.json").write_text(
            json.dumps(quality, indent=2), encoding="utf-8"
        )

        base_states = states[1.0]
        for row_idx, (q, actual, spred) in enumerate(zip(anchors, yr, pred_symbolic)):
            atr = float(f.atr.iloc[q])
            drift12 = float((f.bc.iloc[q] - f.bc.iloc[q-12]) / atr)
            drift_pred = drift12 * cfg["h"] / 12.0
            dc_pred = float(base_states[q]["direction"] * cfg["h"] / 12.0)
            proxy = float(2.0 * (f.ac.iloc[q] - f.bc.iloc[q]) / atr)
            sym_dir = int(np.sign(spred))
            sel_dir = sym_dir if sym_dir != 0 and abs(spred) > proxy else 0

            preds = {
                "flat": (0.0, 0),
                "drift": (drift_pred, int(np.sign(drift_pred))),
                "dc_direction": (dc_pred, int(np.sign(dc_pred))),
                "symbolic_always": (float(spred), sym_dir),
                "symbolic_cost_selective": (float(spred), sel_dir),
            }
            for model, (pred, direction) in preds.items():
                rec = {
                    "track": track,
                    "model": model,
                    "time": int(f.t.iloc[q]),
                    "pred": float(pred),
                    "actual": float(actual),
                    "direction": int(direction),
                    "cost_proxy": proxy if model == "symbolic_cost_selective" else None,
                    **costs(
                        direction,
                        float(f.bo.iloc[q+1]), float(f.ao.iloc[q+1]),
                        float(f.bc.iloc[q+cfg["h"]]), float(f.ac.iloc[q+cfg["h"]]),
                        atr,
                    ),
                }
                all_records.append(rec)

        checks[f"{track}_replication_count"] = (
            "PASS" if len(anchors) == 240 else "FAIL"
        )

    pred_path = out / "replication_predictions_symbolic.jsonl"
    with pred_path.open("w", encoding="utf-8") as fh:
        for r in all_records:
            fh.write(json.dumps(r) + "\n")

    df = pd.DataFrame(all_records)
    results = []
    quarters = []
    for (track, model), g in df.groupby(["track", "model"]):
        results.append({"track": track, "model": model, **metric_block(g)})
        qg = g.copy()
        qg["quarter"] = pd.to_datetime(qg.time, unit="ms", utc=True).dt.to_period("Q").astype(str)
        for quarter, part in qg.groupby("quarter"):
            quarters.append({
                "track": track, "model": model, "quarter": quarter,
                **metric_block(part)
            })

    screens = {}
    for track in TRACKS:
        g = df[(df.track == track) & (df.model == "symbolic_cost_selective")]
        active = g[g.direction != 0]
        qg = active.copy()
        if len(qg):
            qg["quarter"] = pd.to_datetime(qg.time, unit="ms", utc=True).dt.to_period("Q").astype(str)
            eligible_q = []
            for q, part in qg.groupby("quarter"):
                if len(part) >= 5:
                    eligible_q.append(float(part.c1.mean()) > 0)
        else:
            eligible_q = []
        screen = {
            "active_ge_60": len(active) >= 60,
            "c0_trade_positive": bool(len(active) and active.c0.mean() > 0),
            "c1_trade_positive": bool(len(active) and active.c1.mean() > 0),
            "c2_trade_nonnegative": bool(len(active) and active.c2.mean() >= 0),
            "positive_c1_quarter_fraction": (
                float(np.mean(eligible_q)) if eligible_q else None
            ),
            "quarters_with_ge5_trades": len(eligible_q),
        }
        screen["pass"] = bool(
            screen["active_ge_60"]
            and screen["c0_trade_positive"]
            and screen["c1_trade_positive"]
            and screen["c2_trade_nonnegative"]
            and eligible_q
            and np.mean(eligible_q) >= 0.5
        )
        screens[track] = screen

    report = {
        "scope": "Multi-scale DC + symbolic v0.1 internal Train replication",
        "validation_read": False,
        "holdout_read": False,
        "selected_sha256": sha(frozen),
        "checks": checks,
        "results_without_kronos": results,
        "quarterly_without_kronos": quarters,
        "primary_replication_screen": screens,
        "kronos_pending": True,
    }
    (out / "summary_symbolic.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(json.dumps({
        "checks": checks,
        "screens": screens,
        "results": results,
    }, indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["discover", "replicate"])
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    root = Path(args.root)
    out = Path(args.out)
    if args.stage == "discover":
        discover(root, out)
    else:
        replicate(root, out)


if __name__ == "__main__":
    main()
