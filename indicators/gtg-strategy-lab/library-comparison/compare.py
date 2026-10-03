"""Train-only library pilot. See PROTOCOL.md; never use results as edge evidence."""
from __future__ import annotations
import os
os.environ.setdefault("NUMBA_NUM_THREADS", "2")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
import argparse, hashlib, json, sys, time, subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta
import importlib.metadata as md
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE.parent / "data"))
from store import read_day
from bars import aggregate, bucket
TRAIN_END = "2024-03-20"
START, BANK_END, END = "2022-01-01", "2022-03-01", "2022-04-01"
W, K, SEED = 96, 5, 20261003

def ms(date):
    return int(pd.Timestamp(date, tz="UTC").timestamp() * 1000)

def guard_dates(start, end):
    if start < START or end > END or end >= TRAIN_END or start >= end:
        raise ValueError("Train-only pilot date gate")

def dc_states(prices, threshold):
    """At confirmation bar only; never backdate the published state."""
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
    se, sx = ao - bo, ac - bc
    gross = direction * (bc - bo)
    paid_spread = se if direction > 0 else sx
    return dict(c0=gross / atr,
                c1=(gross-paid_spread-0.5*(se+sx))/atr,
                c2=(gross-2*paid_spread-(se+sx))/atr)

def load_source(root, out):
    guard_dates(START, END)
    manifest, rows = [], []
    day = datetime.fromisoformat(START)
    while day.strftime("%Y-%m-%d") < END:
        p = root / "m1" / day.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if p.exists():
            blob = p.read_bytes()
            manifest.append({"day": day.strftime("%Y-%m-%d"),
                             "sha256": hashlib.sha256(blob).hexdigest(), "bytes": len(blob)})
            rows.extend(read_day(p))
        day += timedelta(days=1)
    if not rows:
        raise ValueError("No source bars")
    t = np.array([b["t"] for b in rows])
    if np.any(np.diff(t) <= 0) or t.min() < ms(START) or t.max() >= ms(END):
        raise ValueError("timestamps invalid/outside registered Train pilot")
    for b in rows:
        for side in ("b", "a"):
            o,h,l,c = (b[side+x] for x in ("o","h","l","c"))
            if any(v is None or not np.isfinite(v) or v <= 0 for v in (o,h,l,c)):
                raise ValueError("missing or invalid quote")
            if not l <= min(o,c) <= max(o,c) <= h:
                raise ValueError("invalid OHLC")
        if b["ao"] < b["bo"] or b["ac"] < b["bc"]:
            raise ValueError("crossed quote")
    (out/"input_manifest.json").write_text(json.dumps(manifest, indent=2))
    return rows

def frame_for(rows, tf, step):
    groups = {}
    for b in rows:
        k = bucket(b["t"], tf)
        groups.setdefault(k, []).append(b["t"])
    frames = aggregate(rows, tf)
    kept = [b for b in frames if groups.get(b["t"]) ==
            list(range(b["t"], b["t"]+step, 60000))]
    f = pd.DataFrame(kept)
    c = f.bc.to_numpy()
    previous = np.r_[c[0], c[:-1]]
    tr = np.maximum(f.bh-f.bl, np.maximum(abs(f.bh-previous), abs(f.bl-previous)))
    f["atr"] = pd.Series(tr).rolling(14).mean()
    return f, {"aggregates":len(frames), "complete":len(kept),
               "incomplete_dropped":len(frames)-len(kept)}

def eligible_anchors(f, h, step):
    t = f.t.to_numpy()
    choices = [i for i in range(W-1,len(f)-h)
               if ms(BANK_END) <= t[i] < ms(END)
               and np.isfinite(f.atr.iloc[i]) and f.atr.iloc[i] > 0
               and np.all(np.diff(t[i:i+h+1]) == step)]
    if not choices:
        raise ValueError("no eligible anchors")
    selected = [choices[j] for j in np.unique(np.linspace(0,len(choices)-1,24,dtype=int))]
    result=[]
    for i in selected:
        if not result or i > result[-1]+h:
            result.append(i)
    return result

def bank_indices(f, q, h, step, direction, states):
    t=f.t.to_numpy()
    return [j for j in range(W-1,q-h)
            if t[j+h]+step <= ms(BANK_END) and j+h < q-W+1
            and np.isfinite(f.atr.iloc[j]) and f.atr.iloc[j] > 0
            and states[j]["direction"] == direction
            and np.all(np.diff(t[j:j+h+1]) == step)]

def z(a):
    return (a-a.mean()) / max(float(a.std()),1e-12)

def analogue(f, q, h, step, states):
    import stumpy
    from tslearn.metrics import dtw
    close=f.bc.to_numpy(); logs=np.log(close)
    candidates=bank_indices(f,q,h,step,states[q]["direction"],states)
    if len(candidates) < K:
        return 0.,0.,{"reason":"insufficient_bank","neighbors":[]}
    last=max(candidates)
    # Search corpus never includes query or unobserved candidate outcomes.
    dist=stumpy.mass(logs[q-W+1:q+1],logs[:last+1])
    ranked=sorted(candidates,key=lambda j:(float(dist[j-W+1]),j))
    selected=[]
    for j in ranked:
        if np.isfinite(dist[j-W+1]) and all(abs(j-k)>=W for k in selected):
            selected.append(j)
            if len(selected)==20: break
    if len(selected)<K:
        return 0.,0.,{"reason":"insufficient_independent_neighbors","neighbors":[]}
    label=lambda j: float((close[j+h]-close[j])/f.atr.iloc[j])
    mass_pred=float(np.median([label(j) for j in selected[:K]]))
    query=z(logs[q-W+1:q+1])
    reranked=sorted(selected,key=lambda j:(dtw(query,z(logs[j-W+1:j+1]),
                       global_constraint="sakoe_chiba",sakoe_chiba_radius=4),j))
    pred=float(np.median([label(j) for j in reranked[:K]]))
    return mass_pred,pred,{"reason":"ok","neighbors":reranked[:K],
                          "neighbor_times":[int(f.t.iloc[j]) for j in reranked[:K]],
                          "max_label_time":int(max(f.t.iloc[j+h] for j in reranked[:K]))}

def kronos_load(vendor,out):
    import torch
    from huggingface_hub import HfApi, snapshot_download
    if subprocess.check_output(["git","-C",str(vendor),"rev-parse","HEAD"],text=True).strip() != "67b630e67f6a18c9e9be918d9b4337c960db1e9a":
        raise ValueError("Kronos source revision mismatch")
    sys.path.insert(0,str(vendor))
    from model import Kronos, KronosTokenizer, KronosPredictor
    torch.set_num_threads(2)
    revisions={}
    local={}
    for repo in ("NeoQuasar/Kronos-Tokenizer-2k","NeoQuasar/Kronos-mini"):
        revision=HfApi().model_info(repo).sha
        revisions[repo]=revision
        local[repo]=snapshot_download(repo_id=repo,revision=revision,
                                      allow_patterns=["*.json","*.safetensors"])
    (out/"model_revisions.json").write_text(json.dumps(revisions,indent=2))
    tok=KronosTokenizer.from_pretrained(local["NeoQuasar/Kronos-Tokenizer-2k"])
    model=Kronos.from_pretrained(local["NeoQuasar/Kronos-mini"])
    tok.eval(); model.eval()
    return KronosPredictor(model,tok,device="cpu",max_context=2048)

def kronos_predict(predictor,prefix,h,step,seed):
    import torch
    torch.manual_seed(seed); np.random.seed(seed)
    f=prefix.iloc[-W:]
    assert len(f)==W
    prices=f[["bo","bh","bl","bc"]].rename(
        columns={"bo":"open","bh":"high","bl":"low","bc":"close"}).reset_index(drop=True)
    xt=pd.Series(pd.to_datetime(f.t.to_numpy(),unit="ms",utc=True).tz_localize(None))
    future=int(f.t.iloc[-1])+step*np.arange(1,h+1)
    yt=pd.Series(pd.to_datetime(future,unit="ms",utc=True).tz_localize(None))
    pred=predictor.predict(prices,xt,yt,pred_len=h,T=1.,top_p=.9,
                           sample_count=3,verbose=False)
    value=float((pred.close.iloc[-1]-f.bc.iloc[-1])/f.atr.iloc[-1])
    if not np.isfinite(value):
        raise ValueError("nonfinite Kronos output")
    return value

def summarize(records):
    summaries=[]
    for (track,model),g in pd.DataFrame(records).groupby(["track","model"]):
        good=g[g.status=="ok"]
        if good.empty:
            summaries.append({"track":track,"model":model,"status":"failed","n":0})
            continue
        active=good[good.direction!=0]
        sign_rows=active[active.actual!=0]
        summaries.append({"track":track,"model":model,"status":"ok",
            "n":len(good),"active":len(active),"coverage":len(active)/len(good),
            "mae_atr":float(np.mean(abs(good.pred-good.actual))),
            "direction_accuracy":float(np.mean(sign_rows.direction==np.sign(sign_rows.actual))) if len(sign_rows) else None,
            "c1_win_rate":float(np.mean(active.c1>0)) if len(active) else None,
            **{c+"_mean_per_opportunity":float(good[c].mean()) for c in ("c0","c1","c2")},
            "c1_mean_per_trade":float(active.c1.mean()) if len(active) else None,
            "total_seconds":float(good.seconds.sum()),
            "evidence":"PRETRAINED_CONTAMINATION_UNKNOWN" if model=="kronos_mini" else "TRAIN_DEVELOPMENT_ONLY"})
    return summaries

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",required=True); p.add_argument("--out",required=True)
    p.add_argument("--vendor",required=True)
    a=p.parse_args()
    out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)
    versions={n:md.version(n) for n in ("numpy","pandas","stumpy","tslearn","torch","huggingface-hub")}
    (out/"environment.json").write_text(json.dumps({"python":sys.version,"packages":versions,
        "protocol_sha256":hashlib.sha256((HERE/"PROTOCOL.md").read_bytes()).hexdigest(),
        "code_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc":datetime.now(timezone.utc).isoformat()},indent=2))
    rows=load_source(Path(a.root),out)
    print("SOURCE",len(rows),"M1 bars; Jan-Mar2022 only",flush=True)
    datasets={}
    for track,tf,h,step,threshold in (("scalp","M5",3,300000,.001),("swing","H1",4,3600000,.005)):
        f,quality=frame_for(rows,tf,step)
        anchors=eligible_anchors(f,h,step)
        datasets[track]=(f,anchors,h,step,threshold)
        (out/(track+"_cohort.json")).write_text(json.dumps({"quality":quality,
            "anchors":[int(f.t.iloc[i]) for i in anchors]},indent=2))
        print("COHORT",track,quality,len(anchors),flush=True)
    del rows
    predictor=None; model_error=None
    try:
        predictor=kronos_load(Path(a.vendor),out)
    except Exception as e:
        model_error=repr(e)
        (out/"kronos_error.txt").write_text(model_error)
        print("KRONOS_BLOCKED",model_error,flush=True)
    records=[]; checks={}
    for track,(f,anchors,h,step,threshold) in datasets.items():
        states=dc_states(f.bc.to_numpy(),threshold)
        for n,q in enumerate(anchors):
            tic=time.perf_counter()
            mass,dtw_pred,neighbors=analogue(f,q,h,step,states)
            analogue_seconds=time.perf_counter()-tic
            # Check real prefix invariance, including analogue labels/memory.
            if n==0:
                prefix=f.iloc[:q+1].copy()
                prefix_states=dc_states(prefix.bc.to_numpy(),threshold)
                assert prefix_states==states[:q+1]
                pm,pd_,pn=analogue(prefix,q,h,step,prefix_states)
                assert pm==mass and pd_==dtw_pred and pn==neighbors
                checks[track+"_prefix_causality"]="PASS"
            preds={"flat":(0.,0.),"drift":(
                float((f.bc.iloc[q]-f.bc.iloc[q-12])*h/12/f.atr.iloc[q]),0.),
                "dc_direction":(states[q]["direction"]*h/12,0.),
                "dc_mass":(mass,analogue_seconds),
                "dc_mass_dtw":(dtw_pred,analogue_seconds)}
            if predictor is not None:
                tic=time.perf_counter()
                kp=kronos_predict(predictor,f.iloc[:q+1],h,step,SEED+q)
                elapsed=time.perf_counter()-tic
                if n==0:
                    kp2=kronos_predict(predictor,f.iloc[:q+1].copy(),h,step,SEED+q)
                    assert kp==kp2, "Kronos same-seed repeat failed"
                    checks[track+"_kronos_repeat"]="PASS"
                preds["kronos_mini"]=(kp,elapsed)
            actual=float((f.bc.iloc[q+h]-f.bc.iloc[q])/f.atr.iloc[q])
            for name,(pred,seconds) in preds.items():
                d=int(np.sign(pred))
                r={"track":track,"model":name,"time":int(f.t.iloc[q]),
                   "pred":pred,"actual":actual,"direction":d,"seconds":seconds,"status":"ok",
                   **costs(d,float(f.bo.iloc[q+1]),float(f.ao.iloc[q+1]),
                          float(f.bc.iloc[q+h]),float(f.ac.iloc[q+h]),float(f.atr.iloc[q]))}
                if name.startswith("dc_mass"): r["neighbors"]=neighbors
                records.append(r)
                with (out/"predictions.jsonl").open("a") as fh: fh.write(json.dumps(r)+"\n")
            if predictor is None:
                records.append({"track":track,"model":"kronos_mini","status":"failed",
                    "time":int(f.t.iloc[q]),"error":model_error})
            print("DONE",track,n+1,"/",len(anchors),flush=True)
        (out/"checks.json").write_text(json.dumps(checks,indent=2))
    report={"scope":"Jan-Feb bank / March2022 Train-only pilot",
            "holdout_read":False,"validation_read":False,"checks":checks,
            "results":summarize(records),
            "limitations":["24 anchors/track; not edge evidence","Kronos pretraining overlap unknown",
             "no fine tuning","context spans closures","fixed-horizon quotes; no stop/target simulation",
             "C1 is assumed spread benchmark, not actual account fees"]}
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False))
    print(json.dumps(report,indent=2),flush=True)

if __name__=="__main__": main()
