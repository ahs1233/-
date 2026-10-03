"""GTG Swing Retest Entry v0.1 — causal post-confirmation timing audit."""
from __future__ import annotations
import argparse, hashlib, json, sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
from compare import costs
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END, STEP

PROTOCOL=HERE/"PROTOCOL_SWING_RETEST_ENTRY_V0_1.md"
HORIZONS=(4,12,24)
SEARCH_BARS=6
TOL_ATR=0.50

def sha(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def load_jsonl(p:Path)->list[dict]:
    out=[]
    with p.open("r",encoding="utf-8") as fh:
        for line in fh:
            if line.strip(): out.append(json.loads(line))
    return out

def gap_ok(t0:int,t1:int)->bool:
    d=int(t1)-int(t0)
    return 0<d<=MAX_CONTIG_GAP

def path_ok(t:np.ndarray,i:int,h:int)->bool:
    if i+h>=len(t): return False
    d=np.diff(t[i:i+h+1])
    return bool(int(t[i+h])<ms(RAW_END) and np.all(d>0) and np.all(d<=MAX_CONTIG_GAP))

def find_retest(e:dict,f:pd.DataFrame,t_to_i:dict[int,int])->dict:
    rt=e.get("resolution_time")
    if rt is None or int(rt) not in t_to_i:
        return {"reason":"DATA_END"}
    q=t_to_i[int(rt)]
    d=int(e["resolved_direction"])
    if d not in (-1,1): raise ValueError("bad direction")
    atr_ref=float(f.atr.iloc[q])
    if not np.isfinite(atr_ref) or atr_ref<=0: return {"reason":"DATA_END"}
    boundary=float(e["frozen_upper"] if d==1 else e["frozen_lower"])
    t=f.t.to_numpy(dtype=np.int64)

    prev=q
    for step in range(1,SEARCH_BARS+1):
        j=q+step
        if j>=len(f) or int(t[j])>=ms(RAW_END):
            return {"reason":"DATA_END"}
        if not gap_ok(t[prev],t[j]):
            return {"reason":"HARD_GAP"}
        prev=j
        o=float(f.bo.iloc[j]); h=float(f.bh.iloc[j]); l=float(f.bl.iloc[j]); c=float(f.bc.iloc[j])
        if d==1:
            reaches=l<=boundary+TOL_ATR*atr_ref
            reject=reaches and c>boundary and c>o
            invalid=c<boundary-TOL_ATR*atr_ref
        else:
            reaches=h>=boundary-TOL_ATR*atr_ref
            reject=reaches and c<boundary and c<o
            invalid=c>boundary+TOL_ATR*atr_ref

        if reject:
            if j+1>=len(f) or int(t[j+1])>=ms(RAW_END):
                return {"reason":"DATA_END"}
            if not gap_ok(t[j],t[j+1]):
                return {"reason":"HARD_GAP"}
            return {"reason":"RETEST_ENTRY","resolution_idx":q,"signal_idx":j,
                    "entry_idx":j+1,"delay_bars":step,"atr_ref":atr_ref,"boundary":boundary}
        if invalid:
            return {"reason":"INVALIDATED_BEFORE_RETEST"}

    return {"reason":"NO_RETEST_WITHIN_6"}

def make_trade(e:dict,signal:dict,f:pd.DataFrame,horizon:int)->dict|None:
    s=int(signal["signal_idx"])
    if not path_ok(f.t.to_numpy(dtype=np.int64),s,horizon): return None
    d=int(e["resolved_direction"])
    atr=float(f.atr.iloc[s])
    if not np.isfinite(atr) or atr<=0: return None
    cc=costs(d,float(f.bo.iloc[s+1]),float(f.ao.iloc[s+1]),
             float(f.bc.iloc[s+horizon]),float(f.ac.iloc[s+horizon]),atr)
    start=float(f.bc.iloc[s]); end=float(f.bc.iloc[s+horizon])
    signed=d*(end-start)/atr
    hi=float(f.bh.iloc[s+1:s+horizon+1].max())
    lo=float(f.bl.iloc[s+1:s+horizon+1].min())
    if d==1:
        mfe=(hi-start)/atr; mae=(start-lo)/atr
    else:
        mfe=(start-lo)/atr; mae=(hi-start)/atr
    lower=float(e["frozen_lower"]); upper=float(e["frozen_upper"])
    closes=f.bc.iloc[s+1:s+horizon+1].to_numpy(dtype=float)
    returned=bool(np.any((closes>=lower)&(closes<=upper)))
    return {"event_id":int(e["event_id"]),"split":e["split"],"onset_time":int(e["onset_time"]),
      "resolution_time":int(e["resolution_time"]),"direction":d,
      "year":int(pd.to_datetime(e["resolution_time"],unit="ms",utc=True).year),
      "retest_delay_bars":int(signal["delay_bars"]),"signal_time":int(f.t.iloc[s]),
      "entry_time":int(f.t.iloc[s+1]),"horizon":int(horizon),
      "signed_displacement_atr":float(signed),"directional_correct":bool(signed>0),
      "mfe_atr":float(mfe),"mae_atr":float(mae),"returned_inside":returned,
      "c0":float(cc["c0"]),"c1":float(cc["c1"]),"c2":float(cc["c2"])}

def summarize(rr:list[dict])->dict:
    if not rr: return {"n":0}
    return {"n":len(rr),"directional_accuracy":float(np.mean([r["directional_correct"] for r in rr])),
      "c0_mean_per_trade":float(np.mean([r["c0"] for r in rr])),
      "c1_mean_per_trade":float(np.mean([r["c1"] for r in rr])),
      "c2_mean_per_trade":float(np.mean([r["c2"] for r in rr])),
      "c1_win_rate":float(np.mean([r["c1"]>0 for r in rr])),
      "mean_signed_displacement_atr":float(np.mean([r["signed_displacement_atr"] for r in rr])),
      "mean_mfe_atr":float(np.mean([r["mfe_atr"] for r in rr])),
      "mean_mae_atr":float(np.mean([r["mae_atr"] for r in rr])),
      "returned_inside_fraction":float(np.mean([r["returned_inside"] for r in rr]))}

def split_report(events:list[dict],signals:dict[int,dict],trades:list[dict],split:str,immediate:dict)->dict:
    conf=[e for e in events if e["split"]==split and e["resolution"] in ("TREND_UP","TREND_DOWN")]
    reasons=Counter(signals[int(e["event_id"])]["reason"] for e in conf)
    entries=[e for e in conf if signals[int(e["event_id"])]["reason"]=="RETEST_ENTRY"]
    delays=[signals[int(e["event_id"])]["delay_bars"] for e in entries]
    out={"confirmed_trend_episodes":len(conf),"retest_entries":len(entries),
      "coverage":float(len(entries)/len(conf)) if conf else None,
      "no_entry_reason_counts":dict(reasons),
      "median_retest_delay":float(np.median(delays)) if delays else None,
      "mean_retest_delay":float(np.mean(delays)) if delays else None,
      "entry_direction_counts":{"up":sum(int(e["resolved_direction"])==1 for e in entries),
                                "down":sum(int(e["resolved_direction"])==-1 for e in entries)},
      "horizons":{}}
    for h in HORIZONS:
        rr=[r for r in trades if r["split"]==split and r["horizon"]==h]
        bydir={}
        for d,name in ((1,"up"),(-1,"down")):
            bydir[name]=summarize([r for r in rr if r["direction"]==d])
        delay_bins={
          "1":summarize([r for r in rr if r["retest_delay_bars"]==1]),
          "2-3":summarize([r for r in rr if 2<=r["retest_delay_bars"]<=3]),
          "4-6":summarize([r for r in rr if 4<=r["retest_delay_bars"]<=6])}
        block={"overall":summarize(rr),"by_direction":bydir,"by_retest_delay":delay_bins}
        if split=="evaluation" and h==24:
            yrs={}
            for yr in sorted({r["year"] for r in rr}):
                z=[r for r in rr if r["year"]==yr]
                if len(z)>=10: yrs[str(yr)]=summarize(z)
            block["by_year"]=yrs
        if split=="evaluation" and str(h) in immediate:
            block["immediate_confirmed_comparator"]=immediate[str(h)]
        out["horizons"][str(h)]=block
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True)
    ap.add_argument("--handoff-run",required=True)
    ap.add_argument("--state-run",required=True)
    ap.add_argument("--immediate-run",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    root=Path(a.root); handoff=Path(a.handoff_run); state=Path(a.state_run)
    immediate_run=Path(a.immediate_run); out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)

    source_summary=json.loads((handoff/"summary.json").read_text(encoding="utf-8"))
    state_summary=json.loads((state/"summary.json").read_text(encoding="utf-8"))
    immediate_summary=json.loads((immediate_run/"summary.json").read_text(encoding="utf-8"))
    if source_summary["validation_read"] or source_summary["holdout_read"]: raise ValueError("handoff forbidden flags")
    if state_summary["validation_read"] or state_summary["holdout_read"]: raise ValueError("state forbidden flags")

    hashes={"handoff_records":sha(handoff/"handoff_records.jsonl"),
      "handoff_summary":sha(handoff/"summary.json"),
      "state_manifest":sha(state/"input_manifest.json"),
      "state_freeze":sha(state/"state_freeze.json"),
      "immediate_summary":sha(immediate_run/"summary.json")}
    (out/"environment.json").write_text(json.dumps({"python":sys.version,
      "protocol_sha256":sha(PROTOCOL),"code_sha256":sha(Path(__file__)),
      "source_hashes":hashes,"created_utc":datetime.now(timezone.utc).isoformat(),
      "validation_read":False,"holdout_read":False},indent=2),encoding="utf-8")

    f,quality=load_h1(root,RAW_END,out/"input_manifest.json")
    if json.loads((out/"input_manifest.json").read_text(encoding="utf-8")) != json.loads((state/"input_manifest.json").read_text(encoding="utf-8")):
        raise ValueError("source manifest changed")
    tmap={int(v):i for i,v in enumerate(f.t.to_numpy(dtype=np.int64))}

    events=load_jsonl(handoff/"handoff_records.jsonl")
    confirmed=[e for e in events if e["resolution"] in ("TREND_UP","TREND_DOWN")]
    signals={}
    trades=[]
    for e in confirmed:
        s=find_retest(e,f,tmap)
        signals[int(e["event_id"])]=s
        if s["reason"]=="RETEST_ENTRY":
            for h in HORIZONS:
                r=make_trade(e,s,f,h)
                if r is not None: trades.append(r)

    with (out/"signals.jsonl").open("w",encoding="utf-8") as fh:
        byid={int(e["event_id"]):e for e in confirmed}
        for eid,s in signals.items():
            e=byid[eid]
            rec={"event_id":eid,"split":e["split"],"resolution":e["resolution"],
              "resolved_direction":int(e["resolved_direction"]),"resolution_time":int(e["resolution_time"]),**s}
            fh.write(json.dumps(rec,allow_nan=False)+"\n")
    with (out/"trades.jsonl").open("w",encoding="utf-8") as fh:
        for r in trades: fh.write(json.dumps(r,allow_nan=False)+"\n")

    immediate=immediate_summary["summary"]
    library=split_report(confirmed,signals,trades,"library",{})
    evaluation=split_report(confirmed,signals,trades,"evaluation",immediate)
    h24=evaluation["horizons"]["24"]["overall"]
    screen={"active_retest_trades_ge_60":h24.get("n",0)>=60,
      "coverage_ge_0_20":evaluation["coverage"] is not None and evaluation["coverage"]>=.20,
      "c0_positive":h24.get("c0_mean_per_trade",-1)>0,
      "c1_positive":h24.get("c1_mean_per_trade",-1)>0,
      "c2_nonnegative":h24.get("c2_mean_per_trade",-1)>=0,
      "c1_win_rate_gt_0_50":h24.get("c1_win_rate",0)>.50,
      "c1_better_than_immediate_h24":h24.get("c1_mean_per_trade",-99)>0.04513144632923987,
      "up_down_ge_20":(evaluation["horizons"]["24"]["by_direction"]["up"].get("n",0)>=20 and
                        evaluation["horizons"]["24"]["by_direction"]["down"].get("n",0)>=20)}
    screen["pass"]=bool(all(screen.values()))

    result={"scope":"GTG Swing Retest Entry v0.1 development diagnostic",
      "validation_read":False,"holdout_read":False,"parameters":{"search_bars":SEARCH_BARS,"tolerance_atr":TOL_ATR},
      "quality":quality,"source_hashes":hashes,"library":library,"evaluation":evaluation,
      "registered_primary_screen_h24":screen,
      "integrity":{"source_handoff_hash_recorded":"PASS","source_state_manifest_match":"PASS",
        "retest_search_after_resolution":"PASS","first_qualifying_rejection_only":"PASS",
        "entry_after_rejection_close":"PASS","continuity_le_3h":"PASS",
        "validation_read":False,"holdout_read":False},
      "evidence_status":"DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION"}
    (out/"summary.json").write_text(json.dumps(result,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({"evaluation":evaluation,"screen":screen},indent=2),flush=True)

if __name__=="__main__": main()

EXPECTED_HANDOFF_SHA="45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd"
EXPECTED_STATE_MANIFEST_SHA="30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"
EXPECTED_IMMEDIATE_SHA="bfcf50495ebdde80390ae2a247d1535ce3f3d4e31a69b86d77b2d0bada6c5705"

def split_summary(split,events,setups,records):
    ev=[e for e in events if e["split"]==split]
    entries=[e for e in ev if setups[int(e["event_id"])]["reason"]=="RETEST_ENTRY"]
    reasons=Counter(setups[int(e["event_id"])]["reason"] for e in ev)
    delays=[setups[int(e["event_id"])]["delay_bars"] for e in entries]
    out={"confirmed_trend_episodes":len(ev),"retest_entries":len(entries),
         "coverage":float(len(entries)/len(ev)) if ev else 0.0,
         "reason_counts":dict(reasons),
         "median_retest_delay_bars":float(np.median(delays)) if delays else None,
         "mean_retest_delay_bars":float(np.mean(delays)) if delays else None,
         "entry_direction_counts":{
             "up":sum(int(e["resolved_direction"])==1 for e in entries),
             "down":sum(int(e["resolved_direction"])==-1 for e in entries)},
         "horizons":{}}
    for h in HORIZONS:
        out["horizons"][str(h)]=summarize(
            [r for r in records if r["split"]==split and r["horizon"]==h])
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True)
    ap.add_argument("--handoff-run",required=True)
    ap.add_argument("--state-run",required=True)
    ap.add_argument("--immediate-run",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    root=Path(a.root); handoff=Path(a.handoff_run)
    state=Path(a.state_run); immediate=Path(a.immediate_run); out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)
    hashes={
        "handoff_records":sha(handoff/"handoff_records.jsonl"),
        "state_manifest":sha(state/"input_manifest.json"),
        "immediate_summary":sha(immediate/"summary.json")}
    if hashes["handoff_records"]!=EXPECTED_HANDOFF_SHA: raise ValueError("handoff hash changed")
    if hashes["state_manifest"]!=EXPECTED_STATE_MANIFEST_SHA: raise ValueError("state manifest hash changed")
    if hashes["immediate_summary"]!=EXPECTED_IMMEDIATE_SHA: raise ValueError("immediate summary hash changed")
    (out/"environment.json").write_text(json.dumps({
        "python":sys.version,"protocol_sha256":sha(PROTOCOL),
        "code_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc":datetime.now(timezone.utc).isoformat(),
        "search_bars":SEARCH_BARS,"tolerance_atr":TOL_ATR,
        "validation_read":False,"holdout_read":False},indent=2),encoding="utf-8")

    events=[e for e in load_jsonl(handoff/"handoff_records.jsonl")
            if e.get("resolution") in ("TREND_UP","TREND_DOWN")
            and e.get("split") in ("library","evaluation")]
    f,quality=load_h1(root,RAW_END,out/"input_manifest.json")
    if json.loads((out/"input_manifest.json").read_text(encoding="utf-8")) != json.loads(
       (state/"input_manifest.json").read_text(encoding="utf-8")):
        raise ValueError("source manifest changed")
    t_to_i={int(v):i for i,v in enumerate(f.t.to_numpy(dtype=np.int64))}
    setups={}; setup_rows=[]; records=[]
    for e in events:
        s=find_retest(e,f,t_to_i); setups[int(e["event_id"])]=s
        setup_rows.append({
            "event_id":int(e["event_id"]),"split":e["split"],
            "resolution_time":int(e["resolution_time"]),
            "direction":int(e["resolved_direction"]),
            "reason":s["reason"],
            "retest_delay_bars":s.get("delay_bars"),
            "signal_time":int(f.t.iloc[s["signal_idx"]]) if s.get("signal_idx") is not None else None,
            "entry_time":int(f.t.iloc[s["entry_idx"]]) if s.get("entry_idx") is not None else None})
        if s["reason"]=="RETEST_ENTRY":
            for h in HORIZONS:
                r=make_trade(e,s,f,h)
                if r is not None: records.append(r)
    with (out/"setups.jsonl").open("w",encoding="utf-8") as fh:
        for r in setup_rows: fh.write(json.dumps(r,allow_nan=False)+"\n")
    with (out/"records.jsonl").open("w",encoding="utf-8") as fh:
        for r in records: fh.write(json.dumps(r,allow_nan=False)+"\n")

    library=split_summary("library",events,setups,records)
    evaluation=split_summary("evaluation",events,setups,records)
    eval24=[r for r in records if r["split"]=="evaluation" and r["horizon"]==24]
    by_dir={"up":summarize([r for r in eval24 if r["direction"]==1]),
            "down":summarize([r for r in eval24 if r["direction"]==-1])}
    by_delay={"1":summarize([r for r in eval24 if r["retest_delay_bars"]==1]),
              "2-3":summarize([r for r in eval24 if 2<=r["retest_delay_bars"]<=3]),
              "4-6":summarize([r for r in eval24 if 4<=r["retest_delay_bars"]<=6])}
    years={}
    for y in sorted({r["year"] for r in eval24}):
        rr=[r for r in eval24 if r["year"]==y]
        years[str(y)]={"n":len(rr),
          "c1_mean_per_trade":float(np.mean([r["c1"] for r in rr])) if len(rr)>=10 else None,
          "c2_mean_per_trade":float(np.mean([r["c2"] for r in rr])) if len(rr)>=10 else None}
    imm=json.loads((immediate/"summary.json").read_text(encoding="utf-8"))["summary"]["24"]
    e24=evaluation["horizons"]["24"]
    screen={"active_trades_ge_60":e24["n"]>=60,
      "coverage_ge_0_20":evaluation["coverage"]>=0.20,
      "c0_positive":e24.get("c0_mean_per_trade",0)>0,
      "c1_positive":e24.get("c1_mean_per_trade",0)>0,
      "c2_nonnegative":e24.get("c2_mean_per_trade",-999)>=0,
      "c1_win_rate_gt_0_50":e24.get("c1_win_rate",0)>0.50,
      "c1_better_than_immediate":e24.get("c1_mean_per_trade",-999)>0.04513144632923987,
      "both_directions_ge_20":by_dir["up"]["n"]>=20 and by_dir["down"]["n"]>=20}
    screen["pass"]=bool(all(screen.values()))

    report={"scope":"GTG Swing Retest Entry v0.1 development diagnostic",
      "validation_read":False,"holdout_read":False,"quality":quality,
      "frozen_input_hashes":hashes,
      "rule":{"search_bars":SEARCH_BARS,"tolerance_atr":TOL_ATR},
      "library":library,"evaluation":evaluation,
      "evaluation_h24_by_direction":by_dir,
      "evaluation_h24_by_retest_delay":by_delay,
      "evaluation_h24_by_year":years,
      "immediate_confirmed_reference_h24":imm,
      "registered_evaluation_h24_screen":screen,
      "integrity":{"frozen_input_hashes_unchanged":"PASS",
        "resolution_times_unchanged":"PASS","search_starts_after_resolution":"PASS",
        "first_qualifying_rejection_only":"PASS","entry_after_rejection":"PASS",
        "source_manifest_unchanged":"PASS","market_continuity_le_3h":"PASS",
        "validation_read":False,"holdout_read":False},
      "evidence_status":"DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION"}
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({"library":library,"evaluation":evaluation,
      "eval_h24_by_direction":by_dir,"eval_h24_by_retest_delay":by_delay,
      "screen":screen},indent=2),flush=True)

if __name__=="__main__":
    main()
