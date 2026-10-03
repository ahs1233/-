"""Preregistered Event Library v0.2 Train-only replication."""
from __future__ import annotations
import os
os.environ.setdefault("NUMBA_NUM_THREADS", "2")
os.environ.setdefault("OMP_NUM_THREADS", "2")
import argparse, hashlib, json, sys, time
from pathlib import Path
from datetime import datetime, timezone, timedelta
import importlib.metadata as md
import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from tslearn.metrics import dtw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "data"))
from store import read_day
from bars import aggregate, bucket

SOURCE_START = "2018-03-01"
BANK_END = "2022-01-01"
PROBE_START = "2022-04-01"
END = "2024-03-20"
W, K, MAX_STAGE1 = 96, 5, 200
N_ANCHORS = 120

def ms(date):
    return int(pd.Timestamp(date, tz="UTC").timestamp() * 1000)

def guard_dates(start, end):
    if start < SOURCE_START or end > END or start >= end:
        raise ValueError("Event Library v0.2 Train-only date gate")

def validate_rows(rows, day):
    if not rows:
        return
    t = np.array([b["t"] for b in rows], dtype=np.int64)
    d0, d1 = ms(day), ms((datetime.fromisoformat(day)+timedelta(days=1)).strftime("%Y-%m-%d"))
    if np.any(np.diff(t) <= 0) or t.min() < d0 or t.max() >= d1:
        raise ValueError(f"timestamps invalid for {day}")
    for b in rows:
        for side in ("b", "a"):
            o,h,l,c = (b[side+x] for x in ("o","h","l","c"))
            if any(v is None or not np.isfinite(v) or v <= 0 for v in (o,h,l,c)):
                raise ValueError("missing or invalid quote")
            if not l <= min(o,c) <= max(o,c) <= h:
                raise ValueError("invalid OHLC")
        if b["ao"] < b["bo"] or b["ac"] < b["bc"]:
            raise ValueError("crossed quote")

def complete_aggregate(rows, tf, step):
    groups = {}
    for b in rows:
        k = bucket(b["t"], tf)
        groups.setdefault(k, []).append(b["t"])
    frames = aggregate(rows, tf)
    kept = [b for b in frames if groups.get(b["t"]) ==
            list(range(b["t"], b["t"] + step, 60000))]
    return kept, len(frames) - len(kept)

def load_frames(root, out):
    guard_dates(SOURCE_START, END)
    manifest, by_track = [], {"scalp": [], "swing": []}
    dropped = {"scalp": 0, "swing": 0}
    day = datetime.fromisoformat(SOURCE_START)
    stop = datetime.fromisoformat(END)
    while day < stop:
        ds = day.strftime("%Y-%m-%d")
        p = root / "m1" / day.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if p.exists():
            blob = p.read_bytes()
            manifest.append({"day": ds, "sha256": hashlib.sha256(blob).hexdigest(), "bytes": len(blob)})
            rows = read_day(p)
            validate_rows(rows, ds)
            for track, tf, step in (("scalp","M5",300000),("swing","H1",3600000)):
                kept, n_drop = complete_aggregate(rows, tf, step)
                by_track[track].extend(kept)
                dropped[track] += n_drop
        day += timedelta(days=1)
    if not manifest:
        raise ValueError("No source files")
    (out/"input_manifest.json").write_text(json.dumps(manifest, indent=2))
    frames = {}
    for track, bars in by_track.items():
        f = pd.DataFrame(bars).sort_values("t").reset_index(drop=True)
        if f.empty or np.any(np.diff(f.t.to_numpy()) <= 0):
            raise ValueError(f"bad {track} aggregate sequence")
        c = f.bc.to_numpy()
        prev = np.r_[c[0], c[:-1]]
        tr = np.maximum(f.bh-f.bl, np.maximum(abs(f.bh-prev), abs(f.bl-prev)))
        f["atr"] = pd.Series(tr).rolling(14).mean()
        frames[track] = f
    quality = {k: {"complete": len(frames[k]), "incomplete_dropped": dropped[k]} for k in frames}
    return frames, quality

def dc_states(prices, threshold):
    if not 0 < threshold < 1:
        raise ValueError("threshold must be in (0,1)")
    out = []
    if not len(prices):
        return out
    hi = lo = float(prices[0]); hi_i = lo_i = 0
    direction = 0; extreme = float(prices[0]); extreme_i = 0
    confirmed = -1; pivot_i = -1; pivot_price = float(prices[0])
    for i, p in enumerate(prices):
        p = float(p)
        if not np.isfinite(p) or p <= 0:
            raise ValueError("invalid price")
        if direction == 0:
            if p > hi: hi, hi_i = p, i
            if p < lo: lo, lo_i = p, i
            if p >= lo * (1 + threshold):
                direction, pivot_i, pivot_price = 1, lo_i, lo
                confirmed, extreme, extreme_i = i, p, i
            elif p <= hi * (1 - threshold):
                direction, pivot_i, pivot_price = -1, hi_i, hi
                confirmed, extreme, extreme_i = i, p, i
        elif direction == 1:
            if p > extreme: extreme, extreme_i = p, i
            elif p <= extreme * (1 - threshold):
                direction, pivot_i, pivot_price = -1, extreme_i, extreme
                confirmed, extreme, extreme_i = i, p, i
        else:
            if p < extreme: extreme, extreme_i = p, i
            elif p >= extreme * (1 + threshold):
                direction, pivot_i, pivot_price = 1, extreme_i, extreme
                confirmed, extreme, extreme_i = i, p, i
        out.append({"direction": direction, "confirmed_at": confirmed,
                    "pivot_at": pivot_i, "pivot_price": pivot_price,
                    "extreme_at": extreme_i, "extreme": extreme})
    return out

def costs(direction, bo, ao, bc, ac, atr):
    if atr <= 0 or ao < bo or ac < bc:
        raise ValueError("bad execution quotes")
    if direction == 0:
        return dict(c0=0., c1=0., c2=0.)
    se, sx = ao-bo, ac-bc
    gross = direction * (bc-bo)
    paid = se if direction > 0 else sx
    return dict(c0=gross/atr,
                c1=(gross-paid-0.5*(se+sx))/atr,
                c2=(gross-2*paid-(se+sx))/atr)

def eligible_anchors(f, h, step):
    t = f.t.to_numpy()
    raw = [i for i in range(W-1, len(f)-h)
           if ms(PROBE_START) <= t[i] < ms(END)
           and np.isfinite(f.atr.iloc[i]) and f.atr.iloc[i] > 0
           and np.all(np.diff(t[i:i+h+1]) == step)]
    spaced = []
    for i in raw:
        if not spaced or i > spaced[-1] + h:
            spaced.append(i)
    if len(spaced) < N_ANCHORS:
        raise ValueError(f"only {len(spaced)} eligible spaced anchors")
    picks = np.unique(np.linspace(0, len(spaced)-1, N_ANCHORS, dtype=int))
    if len(picks) != N_ANCHORS:
        raise AssertionError("anchor selection did not produce registered count")
    return [spaced[j] for j in picks]

def zlog_window(logs, i):
    a = logs[i-W+1:i+1]
    sd = float(a.std())
    return (a-a.mean()) / max(sd, 1e-12)

def candidate_indices(f, q, h, step, states, variant):
    t = f.t.to_numpy()
    want = states[q]["direction"]
    if want == 0:
        return []
    out = []
    for j in range(W-1, q-h):
        if states[j]["confirmed_at"] != j or states[j]["direction"] != want:
            continue
        if not np.isfinite(f.atr.iloc[j]) or f.atr.iloc[j] <= 0:
            continue
        if not np.all(np.diff(t[j:j+h+1]) == step):
            continue
        if variant == "event_fixed":
            if t[j+h] >= ms(BANK_END):
                continue
        elif variant == "event_expanding":
            if t[j+h] >= t[q]:
                continue
        else:
            raise ValueError("unknown variant")
        out.append(j)
    return out

def event_predict(f, q, h, step, states, variant):
    cands = candidate_indices(f, q, h, step, states, variant)
    if len(cands) < K:
        return 0., {"reason":"insufficient_events","candidate_count":len(cands),"neighbors":[]}
    logs = np.log(f.bc.to_numpy())
    X = np.vstack([zlog_window(logs, j) for j in cands])
    query = zlog_window(logs, q).reshape(1,-1)
    n_take = min(MAX_STAGE1, len(cands))
    nn = NearestNeighbors(n_neighbors=n_take, metric="euclidean", algorithm="brute", n_jobs=1)
    nn.fit(X)
    _, idx = nn.kneighbors(query, return_distance=True)
    ranked = [cands[int(k)] for k in idx[0]]
    independent = []
    for j in ranked:
        if all(abs(j-k) >= W for k in independent):
            independent.append(j)
            if len(independent) == 20:
                break
    if len(independent) < K:
        return 0., {"reason":"insufficient_independent_events","candidate_count":len(cands),
                    "neighbors":independent}
    qv = query[0]
    reranked = sorted(independent, key=lambda j:(
        dtw(qv, zlog_window(logs,j), global_constraint="sakoe_chiba", sakoe_chiba_radius=4), j))
    top = reranked[:K]
    close = f.bc.to_numpy()
    labels = [float((close[j+h]-close[j])/f.atr.iloc[j]) for j in top]
    return float(np.median(labels)), {
        "reason":"ok", "candidate_count":len(cands), "neighbors":top,
        "neighbor_times":[int(f.t.iloc[j]) for j in top],
        "max_label_time":int(max(f.t.iloc[j+h] for j in top))
    }

def summarize(records):
    summaries = []
    df = pd.DataFrame(records)
    for (track,model), g in df.groupby(["track","model"]):
        good = g[g.status=="ok"]
        if good.empty:
            summaries.append({"track":track,"model":model,"status":"failed","n":0})
            continue
        active = good[good.direction!=0]
        sign_rows = active[active.actual!=0]
        summaries.append({
            "track":track,"model":model,"status":"ok","n":len(good),
            "active":len(active),"coverage":len(active)/len(good),
            "mae_atr":float(np.mean(abs(good.pred-good.actual))),
            "direction_accuracy":float(np.mean(sign_rows.direction==np.sign(sign_rows.actual))) if len(sign_rows) else None,
            "c1_win_rate":float(np.mean(active.c1>0)) if len(active) else None,
            "c0_mean_per_opportunity":float(good.c0.mean()),
            "c1_mean_per_opportunity":float(good.c1.mean()),
            "c2_mean_per_opportunity":float(good.c2.mean()),
            "c1_mean_per_trade":float(active.c1.mean()) if len(active) else None,
            "total_seconds":float(good.seconds.sum()),
            "evidence":"TRAIN_DEVELOPMENT_ONLY"
        })
    return summaries

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=False)

    protocol = HERE/"PROTOCOL_EVENT_LIBRARY_V02.md"
    versions = {n:md.version(n) for n in ("numpy","pandas","scikit-learn","tslearn")}
    (out/"environment.json").write_text(json.dumps({
        "python":sys.version, "packages":versions,
        "protocol_sha256":hashlib.sha256(protocol.read_bytes()).hexdigest(),
        "code_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc":datetime.now(timezone.utc).isoformat()
    }, indent=2))

    frames, quality = load_frames(Path(a.root), out)
    print("SOURCE_DAYS", len(json.loads((out/"input_manifest.json").read_text())), flush=True)
    records, checks = [], {}
    for track, h, step, threshold in (
        ("scalp",3,300000,.001),
        ("swing",4,3600000,.005)
    ):
        f = frames[track]
        anchors = eligible_anchors(f,h,step)
        states = dc_states(f.bc.to_numpy(),threshold)
        checks[track+"_prefix_causality"] = "PASS" if dc_states(
            f.bc.iloc[:anchors[0]+1].to_numpy(),threshold) == states[:anchors[0]+1] else "FAIL"
        if checks[track+"_prefix_causality"] != "PASS":
            raise AssertionError("DC prefix causality failed")

        cohort = {
            "quality":quality[track],
            "anchors":[int(f.t.iloc[i]) for i in anchors],
            "anchor_count":len(anchors),
            "first":int(f.t.iloc[anchors[0]]),
            "last":int(f.t.iloc[anchors[-1]])
        }
        (out/(track+"_cohort.json")).write_text(json.dumps(cohort,indent=2))

        for n,q in enumerate(anchors):
            actual = float((f.bc.iloc[q+h]-f.bc.iloc[q])/f.atr.iloc[q])
            preds = {
                "flat":(0.,0.,{"reason":"baseline"}),
                "drift":(float((f.bc.iloc[q]-f.bc.iloc[q-12])*h/12/f.atr.iloc[q]),0.,{"reason":"baseline"}),
                "dc_direction":(states[q]["direction"]*h/12,0.,{"reason":"baseline"})
            }
            for variant in ("event_fixed","event_expanding"):
                tic = time.perf_counter()
                pred, meta = event_predict(f,q,h,step,states,variant)
                elapsed = time.perf_counter()-tic
                if meta.get("max_label_time") is not None:
                    if variant=="event_fixed" and meta["max_label_time"] >= ms(BANK_END):
                        raise AssertionError("fixed-bank label crossed bank end")
                    if variant=="event_expanding" and meta["max_label_time"] >= int(f.t.iloc[q]):
                        raise AssertionError("expanding-bank label reached query")
                preds[variant]=(pred,elapsed,meta)

            for name,(pred,seconds,meta) in preds.items():
                d = int(np.sign(pred))
                rec = {
                    "track":track,"model":name,"time":int(f.t.iloc[q]),
                    "pred":float(pred),"actual":actual,"direction":d,
                    "seconds":float(seconds),"status":"ok",
                    **costs(d,float(f.bo.iloc[q+1]),float(f.ao.iloc[q+1]),
                            float(f.bc.iloc[q+h]),float(f.ac.iloc[q+h]),float(f.atr.iloc[q]))
                }
                if name.startswith("event_"):
                    rec["retrieval"]=meta
                records.append(rec)
                with (out/"predictions.jsonl").open("a") as fh:
                    fh.write(json.dumps(rec)+"\n")
            if (n+1) % 10 == 0 or n == 0:
                print("DONE",track,n+1,"/",len(anchors),flush=True)

        checks[track+"_fixed_bank_bounds"]="PASS"
        checks[track+"_expanding_maturity"]="PASS"
    (out/"checks.json").write_text(json.dumps(checks,indent=2))

    report = {
        "scope":"2018-2021 fixed bank / Apr2022-Mar2024 Train-only probe",
        "validation_read":False,"holdout_read":False,"checks":checks,
        "results":summarize(records),
        "limitations":[
            "Train-development evidence only",
            "event library uses close-only Directional Change confirmations",
            "fixed-horizon quotes; no stop/target simulation",
            "C1/C2 are benchmark execution-cost assumptions, not account-specific fees",
            "120 deterministic anchors per track"
        ]
    }
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False))
    print(json.dumps(report,indent=2),flush=True)

if __name__ == "__main__":
    main()
