"""Selective Swing v0.3 — preregistered Train-only replication."""
from __future__ import annotations
import os
os.environ.setdefault("NUMBA_NUM_THREADS","2")
os.environ.setdefault("OMP_NUM_THREADS","2")
os.environ.setdefault("HF_HUB_DISABLE_XET","1")

import argparse, hashlib, importlib.metadata as md, json, sys, time
from pathlib import Path
from datetime import datetime, timezone, timedelta
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/"data"))
from store import read_day
from bars import aggregate, bucket
from compare import costs, kronos_load, kronos_predict
from wave_memory_v01 import build_events, feature_row, signatures, wave_predict

SOURCE_START="2018-03-01"
EVAL_START="2020-01-01"
END="2021-07-31"
W=96
H=4
STEP=3600000
THRESHOLD=0.005
N_ANCHORS=160
SEED=20261003

def ms(date):
    return int(pd.Timestamp(date,tz="UTC").timestamp()*1000)

def guard_dates():
    if not (SOURCE_START < EVAL_START < END):
        raise ValueError("date ordering")
    if END != "2021-07-31":
        raise ValueError("registered end changed")

def validate_rows(rows, day):
    if not rows:
        return
    t=np.array([b["t"] for b in rows],dtype=np.int64)
    d0=ms(day)
    d1=ms((datetime.fromisoformat(day)+timedelta(days=1)).strftime("%Y-%m-%d"))
    if np.any(np.diff(t)<=0) or t.min()<d0 or t.max()>=d1:
        raise ValueError(f"invalid timestamps {day}")
    for b in rows:
        for side in ("b","a"):
            o,h,l,c=(b[side+x] for x in ("o","h","l","c"))
            if any(v is None or not np.isfinite(v) or v<=0 for v in (o,h,l,c)):
                raise ValueError("invalid quote")
            if not l<=min(o,c)<=max(o,c)<=h:
                raise ValueError("invalid OHLC")
        if b["ao"]<b["bo"] or b["ac"]<b["bc"]:
            raise ValueError("crossed quote")

def complete_h1(rows):
    groups={}
    for b in rows:
        k=bucket(b["t"],"H1")
        groups.setdefault(k,[]).append(b["t"])
    frames=aggregate(rows,"H1")
    kept=[b for b in frames if groups.get(b["t"])==list(range(b["t"],b["t"]+STEP,60000))]
    return kept,len(frames)-len(kept)

def load_frame(root:Path,out:Path):
    guard_dates()
    manifest=[]
    bars=[]
    dropped=0
    day=datetime.fromisoformat(SOURCE_START)
    stop=datetime.fromisoformat(END)
    while day<stop:
        ds=day.strftime("%Y-%m-%d")
        p=root/"m1"/day.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if p.exists():
            blob=p.read_bytes()
            manifest.append({"day":ds,"sha256":hashlib.sha256(blob).hexdigest(),"bytes":len(blob)})
            rows=read_day(p)
            validate_rows(rows,ds)
            kept,n_drop=complete_h1(rows)
            bars.extend(kept)
            dropped+=n_drop
        day+=timedelta(days=1)
    if not manifest:
        raise ValueError("no source")
    if manifest[-1]["day"]>=END:
        raise AssertionError("forbidden raw day opened")
    f=pd.DataFrame(bars).sort_values("t").reset_index(drop=True)
    if f.empty or np.any(np.diff(f.t.to_numpy())<=0):
        raise ValueError("bad H1 sequence")
    c=f.bc.to_numpy()
    prev=np.r_[c[0],c[:-1]]
    tr=np.maximum(f.bh-f.bl,np.maximum(abs(f.bh-prev),abs(f.bl-prev)))
    f["atr"]=pd.Series(tr).rolling(14).mean()
    (out/"input_manifest.json").write_text(json.dumps(manifest,indent=2))
    return f,{"complete":len(f),"incomplete_dropped":dropped,"source_days":len(manifest)}

def eligible_anchors(f):
    t=f.t.to_numpy()
    raw=[q for q in range(W-1,len(f)-H)
         if ms(EVAL_START)<=t[q]<ms(END)
         and q>=12
         and np.isfinite(f.atr.iloc[q]) and f.atr.iloc[q]>0
         and np.all(np.diff(t[q:q+H+1])==STEP)]
    spaced=[]
    for q in raw:
        if not spaced or q>spaced[-1]+H:
            spaced.append(q)
    if len(spaced)<N_ANCHORS:
        raise ValueError(f"only {len(spaced)} spaced anchors")
    picks=np.unique(np.linspace(0,len(spaced)-1,N_ANCHORS,dtype=int))
    if len(picks)!=N_ANCHORS:
        raise AssertionError("anchor count")
    return [spaced[int(i)] for i in picks]

def scaler_pre_eval(events):
    eligible=[e for e in events if e["confirm_t"]<ms(EVAL_START)]
    if len(eligible)<20:
        raise ValueError("insufficient pre-eval events")
    X=np.vstack([feature_row(e) for e in eligible])
    med=np.median(X,axis=0)
    q1,q3=np.percentile(X,[25,75],axis=0)
    scale=q3-q1
    scale[scale<1e-12]=1.0
    return med,scale,max(e["confirm_t"] for e in eligible),len(eligible)

def agree2_direction(drift_pred,kronos_pred):
    a=int(np.sign(drift_pred)); b=int(np.sign(kronos_pred))
    return a if a!=0 and a==b else 0

def agree3_direction(drift_pred,kronos_pred,wave_pred):
    a=agree2_direction(drift_pred,kronos_pred)
    c=int(np.sign(wave_pred))
    return a if a!=0 and a==c else 0

def add_cost_record(records,track,model,q,f,pred,direction,actual,seconds=0.0,extra=None):
    rec={
        "track":track,"model":model,"time":int(f.t.iloc[q]),
        "pred":float(pred),"actual":float(actual),"direction":int(direction),
        "seconds":float(seconds),"status":"ok",
        **costs(int(direction),float(f.bo.iloc[q+1]),float(f.ao.iloc[q+1]),
                float(f.bc.iloc[q+H]),float(f.ac.iloc[q+H]),float(f.atr.iloc[q]))
    }
    if extra is not None:
        rec.update(extra)
    records.append(rec)
    return rec

def metrics(g):
    active=g[g.direction!=0]
    signs=active[active.actual!=0]
    return {
        "n":int(len(g)),"active":int(len(active)),
        "coverage":float(len(active)/len(g)) if len(g) else 0.0,
        "direction_accuracy":float(np.mean(signs.direction==np.sign(signs.actual))) if len(signs) else None,
        "c1_win_rate":float(np.mean(active.c1>0)) if len(active) else None,
        "c0_mean_per_opportunity":float(g.c0.mean()) if len(g) else None,
        "c1_mean_per_opportunity":float(g.c1.mean()) if len(g) else None,
        "c2_mean_per_opportunity":float(g.c2.mean()) if len(g) else None,
        "c0_mean_per_trade":float(active.c0.mean()) if len(active) else None,
        "c1_mean_per_trade":float(active.c1.mean()) if len(active) else None,
        "c2_mean_per_trade":float(active.c2.mean()) if len(active) else None,
    }

def summarize(records):
    df=pd.DataFrame(records)
    overall=[]
    quarterly=[]
    for model,g in df.groupby("model"):
        overall.append({"model":model,**metrics(g),"evidence":"TRAIN_REPLICATION_ONLY" if model!="kronos_mini" else "PRETRAINED_CONTAMINATION_UNKNOWN"})
        g=g.copy()
        g["quarter"]=pd.to_datetime(g.time,unit="ms",utc=True).dt.to_period("Q").astype(str)
        for quarter,qg in g.groupby("quarter"):
            quarterly.append({"model":model,"quarter":quarter,**metrics(qg)})
    return overall,quarterly

def criterion(overall,quarterly):
    row=next(r for r in overall if r["model"]=="agree2")
    qs=[r for r in quarterly if r["model"]=="agree2" and r["active"]>=5]
    pos=sum((r["c1_mean_per_trade"] or -1e99)>0 for r in qs)
    quarter_ok=bool(qs) and pos*2>=len(qs)
    checks={
        "active_ge_40":row["active"]>=40,
        "c1_per_trade_positive":row["c1_mean_per_trade"] is not None and row["c1_mean_per_trade"]>0,
        "c2_per_trade_positive":row["c2_mean_per_trade"] is not None and row["c2_mean_per_trade"]>0,
        "direction_accuracy_gt_50":row["direction_accuracy"] is not None and row["direction_accuracy"]>0.5,
        "positive_quarters_at_least_half":quarter_ok,
        "positive_quarters":pos,
        "eligible_quarters":len(qs),
    }
    return {"pass":all(v is True for k,v in checks.items() if k not in ("positive_quarters","eligible_quarters")),"checks":checks}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--vendor",required=True)
    a=ap.parse_args()

    out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)
    protocol=HERE/"PROTOCOL_SELECTIVE_SWING_V0_3.md"
    env={
        "python":sys.version,
        "packages":{n:md.version(n) for n in ("numpy","pandas","tslearn","torch","huggingface-hub")},
        "protocol_sha256":hashlib.sha256(protocol.read_bytes()).hexdigest(),
        "code_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc":datetime.now(timezone.utc).isoformat(),
    }
    (out/"environment.json").write_text(json.dumps(env,indent=2))

    f,quality=load_frame(Path(a.root),out)
    anchors=eligible_anchors(f)
    states,events=build_events(f,THRESHOLD)
    med,scale,max_scaler_t,n_scaler=scaler_pre_eval(events)
    sigs=signatures(events,med,scale)

    first=anchors[0]
    _,prefix_events=build_events(f.iloc[:first+1].copy(),THRESHOLD)
    full_prefix=[e for e in events if e["confirm_i"]<=first]
    if prefix_events!=full_prefix:
        raise AssertionError("wave prefix causality")
    if max_scaler_t>=ms(EVAL_START):
        raise AssertionError("scaler saw evaluation")

    predictor=kronos_load(Path(a.vendor),out)
    checks={
        "raw_date_gate":"PASS",
        "anchor_count":"PASS" if len(anchors)==N_ANCHORS else "FAIL",
        "wave_prefix_causality":"PASS",
        "scaler_pre_eval_only":"PASS",
    }
    cohort={
        "quality":quality,"anchor_count":len(anchors),
        "anchors":[int(f.t.iloc[q]) for q in anchors],
        "events":len(events),"pre_eval_scaler_events":n_scaler,
        "max_scaler_event_time":int(max_scaler_t),
        "robust_median":med.tolist(),"robust_iqr":scale.tolist(),
    }
    (out/"cohort.json").write_text(json.dumps(cohort,indent=2))

    records=[]
    for n,q in enumerate(anchors):
        drift=float((f.bc.iloc[q]-f.bc.iloc[q-12])*H/12/f.atr.iloc[q])

        tic=time.perf_counter()
        wave,wmeta=wave_predict(f,events,sigs,q,H,STEP)
        wsec=time.perf_counter()-tic
        if wmeta.get("reason")=="ok":
            for nei in wmeta["neighbors"]:
                if nei["anchor_i"]+H>=q or int(f.t.iloc[nei["anchor_i"]+H])+STEP>int(f.t.iloc[q]):
                    raise AssertionError("wave memory future leak")
            checks["wave_memory_maturity"]="PASS"

        tic=time.perf_counter()
        kronos=kronos_predict(predictor,f.iloc[:q+1],H,STEP,SEED+q)
        ksec=time.perf_counter()-tic
        if n==0:
            k2=kronos_predict(predictor,f.iloc[:q+1].copy(),H,STEP,SEED+q)
            if kronos!=k2:
                raise AssertionError("Kronos repeat")
            checks["kronos_repeat"]="PASS"

        actual=float((f.bc.iloc[q+H]-f.bc.iloc[q])/f.atr.iloc[q])
        add_cost_record(records,"swing","flat",q,f,0.0,0,actual)
        add_cost_record(records,"swing","drift",q,f,drift,int(np.sign(drift)),actual)
        add_cost_record(records,"swing","kronos_mini",q,f,kronos,int(np.sign(kronos)),actual,ksec)
        add_cost_record(records,"swing","event_wave_dtw",q,f,wave,int(np.sign(wave)),actual,wsec,{"wave_meta":wmeta})

        d2=agree2_direction(drift,kronos)
        p2=float((drift+kronos)/2) if d2 else 0.0
        add_cost_record(records,"swing","agree2",q,f,p2,d2,actual,0.0,{"drift_pred":drift,"kronos_pred":kronos})

        d3=agree3_direction(drift,kronos,wave)
        p3=float((drift+kronos+wave)/3) if d3 else 0.0
        add_cost_record(records,"swing","agree3",q,f,p3,d3,actual,0.0,{"drift_pred":drift,"kronos_pred":kronos,"wave_pred":wave})

        with (out/"predictions.jsonl").open("a",encoding="utf-8") as fh:
            for rec in records[-6:]:
                fh.write(json.dumps(rec)+"\n")
        if (n+1)%20==0 or n==0 or n+1==len(anchors):
            print("DONE",n+1,"/",len(anchors),flush=True)

    (out/"checks.json").write_text(json.dumps(checks,indent=2))
    overall,quarterly=summarize(records)
    primary=criterion(overall,quarterly)
    report={
        "scope":"Selective Swing v0.3 Train-only replication, 2020-01-01..2021-07-31",
        "validation_read":False,"holdout_read":False,
        "checks":checks,"primary_h1":primary,
        "results":overall,"quarterly":quarterly,
        "limitations":[
            "Historical Train replication, not external OOS",
            "Kronos pretraining overlap unknown",
            "rule was motivated by a post-hoc observation but frozen before this replication",
            "fixed-horizon execution; no stop/target simulation",
            "C1/C2 are benchmark execution assumptions, not live-account fee schedules",
        ],
    }
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False))
    print(json.dumps({"primary_h1":primary,"results":overall},indent=2),flush=True)

if __name__=="__main__":
    main()
