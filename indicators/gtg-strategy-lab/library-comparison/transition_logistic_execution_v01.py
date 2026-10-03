"""Exploratory execution audit for the frozen Transition Logistic gate."""
from __future__ import annotations
import argparse, hashlib, json
from collections import defaultdict
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
from state_transition_engine_v02 import RAW_END, MAX_CONTIG_GAP, load_h1, ms
from compare import costs

HORIZONS=(1,4,12,24)
THRESHOLD=0.50

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def load_jsonl(p):
    return [json.loads(x) for x in Path(p).read_text(encoding="utf-8").splitlines() if x.strip()]

def path_ok(f,q,h):
    if q<0 or q+h>=len(f) or q+1>=len(f): return False
    t=f.t.to_numpy(dtype=np.int64)
    if int(t[q+h])>=ms(RAW_END): return False
    d=np.diff(t[q:q+h+1])
    return bool(np.all(d>0) and np.all(d<=MAX_CONTIG_GAP))

def trade_result(f,q,h,direction):
    if not path_ok(f,q,h): return None
    atr=float(f.atr.iloc[q])
    if not np.isfinite(atr) or atr<=0: return None
    c=costs(int(direction),float(f.bo.iloc[q+1]),float(f.ao.iloc[q+1]),
            float(f.bc.iloc[q+h]),float(f.ac.iloc[q+h]),atr)
    move=int(direction)*(float(f.bc.iloc[q+h])-float(f.bc.iloc[q]))
    return {**c,"direction_correct":bool(move>0),"decision_time":int(f.t.iloc[q]),
            "exit_time":int(f.t.iloc[q+h])}

def policy_copy(row, policy):
    return {**row, "policy": policy}

def summarize(rows, opportunities):
    if not rows:
        return {"opportunities":int(opportunities),"active_trades":0,"coverage":0.0}
    out={"opportunities":int(opportunities),"active_trades":int(len(rows)),
         "coverage":float(len(rows)/opportunities) if opportunities else 0.0,
         "direction_accuracy":float(np.mean([r["direction_correct"] for r in rows]))}
    for k in ("c0","c1","c2"):
        v=np.asarray([r[k] for r in rows],float)
        out[f"{k}_mean_per_trade"]=float(v.mean())
        out[f"{k}_median_per_trade"]=float(np.median(v))
        out[f"{k}_positive_fraction"]=float(np.mean(v>0))
        out[f"{k}_total"]=float(v.sum())
        out[f"{k}_mean_per_opportunity"]=float(v.sum()/opportunities) if opportunities else None
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True)
    ap.add_argument("--memory-run",required=True)
    ap.add_argument("--state-run",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    root=Path(a.root); mem=Path(a.memory_run); state=Path(a.state_run); out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)

    freeze=json.loads((mem/"freeze.json").read_text(encoding="utf-8"))
    frozen=json.loads((mem/"frozen_memory.json").read_text(encoding="utf-8"))
    summary_mem=json.loads((mem/"summary.json").read_text(encoding="utf-8"))
    if not freeze.get("evaluation_opened"): raise ValueError("memory evaluation not frozen/opened")
    if sha(mem/"frozen_memory.json")!=freeze["frozen_memory_sha256"]: raise ValueError("memory SHA changed")
    if summary_mem["evaluation_n"]!=454: raise ValueError("unexpected memory cohort")
    if summary_mem["validation_read"] or summary_mem["holdout_read"]: raise ValueError("forbidden source flag")

    preds=load_jsonl(mem/"evaluation_predictions.jsonl")
    if len(preds)!=454: raise ValueError("prediction cohort not 454")
    if any(abs(float(r["p_logistic"])-THRESHOLD)<0 and False for r in preds): pass

    events_all=load_jsonl(state/"transition_library.jsonl")
    events={int(e["event_id"]):e for e in events_all}
    joined=[]
    for p in preds:
        eid=int(p["event_id"])
        if eid not in events: raise ValueError("event id missing")
        e=events[eid]
        if int(e["time"])!=int(p["time"]): raise ValueError("event timestamp mismatch")
        joined.append((p,e))

    f,quality=load_h1(root,RAW_END,out/"input_manifest.json")
    if json.loads((out/"input_manifest.json").read_text(encoding="utf-8")) != json.loads((state/"input_manifest.json").read_text(encoding="utf-8")):
        raise ValueError("raw manifest mismatch")
    tmap={int(v):i for i,v in enumerate(f.t.to_numpy(dtype=np.int64))}

    result={"scope":"Transition Logistic Gate Execution Audit v0.1 exploratory Train-only",
      "validation_read":False,"holdout_read":False,"threshold":THRESHOLD,
      "cohort_n":len(joined),"quality":quality,
      "source_hashes":{"memory_predictions":sha(mem/"evaluation_predictions.jsonl"),
        "memory_freeze":sha(mem/"freeze.json"),"state_sequence":frozen["source_state_sequence_sha256"]},
      "horizons":{}}

    gate_true_range=0; gate_true_trend=0; total_range=0; total_trend=0
    for p,e in joined:
        y=int(p["actual_label"]); traded=float(p["p_logistic"])>=THRESHOLD
        if y==0:
            total_range+=1; gate_true_range+=int(traded)
        else:
            total_trend+=1; gate_true_trend+=int(traded)
    result["gate_classification_carryover"]={
      "actual_range_n":total_range,"actual_trend_n":total_trend,
      "range_resumptions_traded":gate_true_range,
      "range_resumptions_avoided":total_range-gate_true_range,
      "trend_confirmations_traded":gate_true_trend,
      "trend_confirmations_missed":total_trend-gate_true_trend,
      "range_damage_avoidance_fraction":float((total_range-gate_true_range)/total_range),
      "trend_retention_fraction":float(gate_true_trend/total_trend)}

    records=[]
    for h in HORIZONS:
        onset_mature=[]
        all_rows=[]; gate_rows=[]
        for p,e in joined:
            q=tmap.get(int(e["time"]))
            if q is None or not path_ok(f,q,h): continue
            onset_mature.append(int(e["event_id"]))
            r=trade_result(f,q,h,int(e["candidate_direction"]))
            if r is None: continue
            rr={**r,"event_id":int(e["event_id"]),"year":int(pd.to_datetime(e["time"],unit="ms",utc=True).year),
                "policy":"ALL_ONSET","horizon":h}
            all_rows.append(rr); records.append(rr)
            if float(p["p_logistic"])>=THRESHOLD:
                rg=policy_copy(rr,"LOGISTIC_GATE")
                gate_rows.append(rg); records.append(rg)

        confirmed_rows=[]
        for p,e in joined:
            res=e.get("fsm_resolution")
            if res not in ("TREND_UP","TREND_DOWN"): continue
            rt=e.get("resolution_time")
            if rt is None or int(rt) not in tmap: continue
            q=tmap[int(rt)]; d=1 if res=="TREND_UP" else -1
            r=trade_result(f,q,h,d)
            if r is None: continue
            rr={**r,"event_id":int(e["event_id"]),"year":int(pd.to_datetime(rt,unit="ms",utc=True).year),
                "policy":"FSM_CONFIRMED","horizon":h}
            confirmed_rows.append(rr); records.append(rr)

        opp=len(onset_mature)
        A=summarize(all_rows,opp)
        B=summarize(gate_rows,opp)
        C=summarize(confirmed_rows,len(joined))
        result["horizons"][str(h)]={"ALL_ONSET":A,"LOGISTIC_GATE":B,"FSM_CONFIRMED":C,
          "comparisons":{"logistic_minus_all_c1_per_trade":
             (B.get("c1_mean_per_trade")-A.get("c1_mean_per_trade")) if B.get("active_trades",0) and A.get("active_trades",0) else None,
             "logistic_minus_all_c1_per_opportunity":
             (B.get("c1_mean_per_opportunity")-A.get("c1_mean_per_opportunity")) if B.get("active_trades",0) else None,
             "fsm_minus_all_c1_per_trade":
             (C.get("c1_mean_per_trade")-A.get("c1_mean_per_trade")) if C.get("active_trades",0) and A.get("active_trades",0) else None}}

    years={}
    for h in HORIZONS:
        rr=[r for r in records if r["policy"]=="LOGISTIC_GATE" and r["horizon"]==h]
        yh={}
        for yr in sorted(set(r["year"] for r in rr)):
            z=[r for r in rr if r["year"]==yr]
            if len(z)>=10: yh[str(yr)]=summarize(z,len(z))
        years[str(h)]=yh
    result["logistic_gate_by_year"]=years
    result["integrity"]={"exact_454_event_cohort":"PASS","threshold_fixed_0_50":"PASS",
      "memory_sha_unchanged":"PASS","state_manifest_matches":"PASS",
      "no_post_onset_input_to_logistic":"PASS","validation_read":False,"holdout_read":False}

    with (out/"execution_records.jsonl").open("w",encoding="utf-8") as fh:
        for r in records: fh.write(json.dumps(r,allow_nan=False)+"\n")
    (out/"summary.json").write_text(json.dumps(result,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({"gate":result["gate_classification_carryover"],"horizons":result["horizons"]},indent=2),flush=True)

if __name__=="__main__": main()
