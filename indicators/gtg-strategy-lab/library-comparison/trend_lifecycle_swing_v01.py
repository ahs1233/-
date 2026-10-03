"""GTG Trend Lifecycle Swing v0.1 — causal state-duration exit audit."""
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
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END

PROTOCOL=HERE/"PROTOCOL_TREND_LIFECYCLE_SWING_V0_1.md"
EXPECTED_HANDOFF="45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd"
EXPECTED_MANIFEST="30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a"
EXPECTED_STATE_CONTENT="c0b4a52d14e0c83826638b7669401eb817d392dd2867c241f9a5d0923e2b7c3e"

def sha(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def load_jsonl(p:Path):
    with p.open("r",encoding="utf-8") as fh:
        return [json.loads(x) for x in fh if x.strip()]

def state_content_hash(s:pd.Series)->str:
    vals=["" if pd.isna(x) else str(x) for x in s]
    return hashlib.sha256(("\n".join(vals)).encode()).hexdigest()

def gap_ok(a,b):
    d=int(b)-int(a)
    return 0<d<=MAX_CONTIG_GAP

def lifecycle_trade(e,state,f,t_to_i,state_to_i):
    rt=int(e["resolution_time"])
    if rt not in t_to_i or rt not in state_to_i:
        raise ValueError("resolution missing")
    q=t_to_i[rt]; sq=state_to_i[rt]
    direction=int(e["resolved_direction"])
    trend="TREND_UP" if direction==1 else "TREND_DOWN"
    if str(state.state.iloc[sq])!=trend:
        raise ValueError("resolution state mismatch")
    t=f.t.to_numpy(dtype=np.int64)
    st=state.t.to_numpy(dtype=np.int64)
    if q+1>=len(f) or not gap_ok(t[q],t[q+1]):
        return {"status":"CENSORED_HARD_GAP"}
    k_state=None
    prev=sq
    for j in range(sq+1,len(state)):
        if not gap_ok(st[prev],st[j]):
            return {"status":"CENSORED_HARD_GAP"}
        if str(state.state.iloc[j])!=trend:
            k_state=j
            break
        prev=j
    if k_state is None:
        return {"status":"CENSORED_DATA_END"}
    kt=int(state.t.iloc[k_state])
    if kt not in t_to_i:
        raise ValueError("state exit missing from canonical H1")
    k=t_to_i[kt]
    if k+1>=len(f) or int(t[k+1])>=ms(RAW_END):
        return {"status":"CENSORED_DATA_END"}
    if not gap_ok(t[k],t[k+1]):
        return {"status":"CENSORED_HARD_GAP"}
    if not np.all((np.diff(t[q:k+2])>0)&(np.diff(t[q:k+2])<=MAX_CONTIG_GAP)):
        return {"status":"CENSORED_HARD_GAP"}
    atr=float(f.atr.iloc[q])
    if not np.isfinite(atr) or atr<=0:
        return {"status":"CENSORED_DATA_END"}
    entry=q+1; exit_i=k+1
    cc=costs(direction,float(f.bo.iloc[entry]),float(f.ao.iloc[entry]),
             float(f.bo.iloc[exit_i]),float(f.ao.iloc[exit_i]),atr)
    entry_mid=(float(f.bo.iloc[entry])+float(f.ao.iloc[entry]))/2
    exit_mid=(float(f.bo.iloc[exit_i])+float(f.ao.iloc[exit_i]))/2
    signed_mid=direction*(exit_mid-entry_mid)/atr
    hi=float(f.bh.iloc[entry:exit_i].max())
    lo=float(f.bl.iloc[entry:exit_i].min())
    if direction==1:
        mfe=(hi-entry_mid)/atr; mae=(entry_mid-lo)/atr
    else:
        mfe=(entry_mid-lo)/atr; mae=(hi-entry_mid)/atr
    return {
        "status":"TRADE","event_id":int(e["event_id"]),
        "resolution_time":rt,"direction":direction,
        "entry_time":int(t[entry]),"exit_signal_time":kt,
        "exit_time":int(t[exit_i]),"exit_state":str(state.state.iloc[k_state]),
        "duration_trading_bars":int(k-q),
        "elapsed_wall_hours":float((t[exit_i]-t[entry])/3_600_000),
        "signed_mid_displacement_atr":float(signed_mid),
        "directional_correct":bool(signed_mid>0),
        "mfe_atr":float(mfe),"mae_atr":float(mae),
        "c0":float(cc["c0"]),"c1":float(cc["c1"]),"c2":float(cc["c2"]),
        "year":int(pd.to_datetime(rt,unit="ms",utc=True).year)}

def metrics(rr):
    if not rr: return {"n":0}
    return {"n":len(rr),
      "directional_accuracy":float(np.mean([r["directional_correct"] for r in rr])),
      "c0_mean_per_trade":float(np.mean([r["c0"] for r in rr])),
      "c1_mean_per_trade":float(np.mean([r["c1"] for r in rr])),
      "c2_mean_per_trade":float(np.mean([r["c2"] for r in rr])),
      "c1_win_rate":float(np.mean([r["c1"]>0 for r in rr])),
      "duration_median_bars":float(np.median([r["duration_trading_bars"] for r in rr])),
      "duration_mean_bars":float(np.mean([r["duration_trading_bars"] for r in rr])),
      "elapsed_wall_hours_mean":float(np.mean([r["elapsed_wall_hours"] for r in rr])),
      "mean_mfe_atr":float(np.mean([r["mfe_atr"] for r in rr])),
      "mean_mae_atr":float(np.mean([r["mae_atr"] for r in rr])),
      "exit_state_counts":dict(Counter(r["exit_state"] for r in rr))}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True); ap.add_argument("--state-run",required=True)
    ap.add_argument("--handoff-run",required=True); ap.add_argument("--out",required=True)
    a=ap.parse_args()
    root=Path(a.root); state_run=Path(a.state_run); handoff=Path(a.handoff_run); out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)
    if sha(handoff/"handoff_records.jsonl")!=EXPECTED_HANDOFF: raise ValueError("handoff hash changed")
    if sha(state_run/"input_manifest.json")!=EXPECTED_MANIFEST: raise ValueError("manifest hash changed")
    state=pd.read_csv(state_run/"state_sequence.csv.gz")
    if state_content_hash(state.state)!=EXPECTED_STATE_CONTENT: raise ValueError("state content hash changed")
    (out/"environment.json").write_text(json.dumps({
      "python":sys.version,"protocol_sha256":sha(PROTOCOL),
      "code_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      "created_utc":datetime.now(timezone.utc).isoformat(),
      "validation_read":False,"holdout_read":False},indent=2),encoding="utf-8")
    events=[e for e in load_jsonl(handoff/"handoff_records.jsonl")
            if e.get("split")=="evaluation" and e.get("resolution") in ("TREND_UP","TREND_DOWN")]
    if len(events)!=280: raise ValueError(f"expected 280 events got {len(events)}")
    f,quality=load_h1(root,RAW_END,out/"input_manifest.json")
    if json.loads((out/"input_manifest.json").read_text())!=json.loads((state_run/"input_manifest.json").read_text()):
        raise ValueError("source manifest mismatch")
    t_to_i={int(v):i for i,v in enumerate(f.t.to_numpy(dtype=np.int64))}
    state_to_i={int(v):i for i,v in enumerate(state.t.to_numpy(dtype=np.int64))}
    rows=[]; censor=Counter()
    for e in events:
        r=lifecycle_trade(e,state,f,t_to_i,state_to_i)
        if r["status"]=="TRADE": rows.append(r)
        else: censor[r["status"]]+=1
    with (out/"records.jsonl").open("w",encoding="utf-8") as fh:
        for r in rows: fh.write(json.dumps(r,allow_nan=False)+"\n")
    overall=metrics(rows)
    by_dir={"up":metrics([r for r in rows if r["direction"]==1]),
            "down":metrics([r for r in rows if r["direction"]==-1])}
    by_year={}
    for y in sorted({r["year"] for r in rows}):
        z=[r for r in rows if r["year"]==y]
        by_year[str(y)]=metrics(z) if len(z)>=10 else {"n":len(z)}
    max_year=max((sum(r["year"]==y for r in rows) for y in set(r["year"] for r in rows)),default=0)
    screen={"active_trades_ge_150":len(rows)>=150,
      "c0_positive":overall.get("c0_mean_per_trade",-999)>0,
      "c1_positive":overall.get("c1_mean_per_trade",-999)>0,
      "c2_nonnegative":overall.get("c2_mean_per_trade",-999)>=0,
      "c1_win_rate_gt_0_50":overall.get("c1_win_rate",0)>0.50,
      "both_directions_ge_50":by_dir["up"]["n"]>=50 and by_dir["down"]["n"]>=50,
      "positive_c1_two_full_years":sum(1 for y in ("2021","2022","2023")
        if by_year.get(y,{}).get("n",0)>=10 and by_year[y].get("c1_mean_per_trade",-999)>0)>=2,
      "no_year_over_60pct":(max_year/len(rows)<=0.60) if rows else False}
    screen["pass"]=bool(all(screen.values()))
    report={"scope":"GTG Trend Lifecycle Swing v0.1 development diagnostic",
      "validation_read":False,"holdout_read":False,"quality":quality,
      "eligible_confirmed_episodes":len(events),"active_trades":len(rows),
      "censor_counts":dict(censor),"overall":overall,"by_direction":by_dir,
      "by_year":by_year,"registered_screen":screen,
      "integrity":{"handoff_hash_unchanged":"PASS","state_content_hash_unchanged":"PASS",
        "source_manifest_unchanged":"PASS","entry_after_resolution":"PASS",
        "exit_after_first_state_change":"PASS","no_hard_gap_bridging":"PASS",
        "validation_read":False,"holdout_read":False},
      "evidence_status":"DEVELOPMENT_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION"}
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({"overall":overall,"by_direction":by_dir,
      "by_year":by_year,"censor":dict(censor),"screen":screen},indent=2),flush=True)

if __name__=="__main__":
    main()
