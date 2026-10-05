from pathlib import Path
import json, math, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
EXP1=GTG/"runs"/"measurement-execution-audit-v01"
OUT=GTG/"runs"/"one-shot-fresh-reclaim-reentry-v01"

sys.path.insert(0,str(TOOLS))
import measurement_execution_audit_v01 as audit

TIMEOUT=864
R2=0.50
N_BOOT=2000
BLOCK_DAYS=5
SEED=6053
ALLOWED_STATES={0,4,5}

STOP_CLASSES={"STOP","STOP_GAP","M1_AMBIGUOUS_STOP_FIRST","AMBIGUOUS_STOP_FIRST"}

def norm_exit(k):
    k=str(k).upper()
    if "AMBIGUOUS" in k:return "AMBIGUOUS_STOP_FIRST"
    if "STOP_GAP" in k:return "STOP_GAP"
    if k=="STOP":return "STOP"
    if "TARGET_GAP" in k:return "TARGET_GAP"
    if k=="TARGET":return "TARGET"
    if "TIMEOUT" in k:return "TIMEOUT"
    if "HORIZON" in k:return "IDEA_HORIZON_EXIT"
    return k

def segment_year(y):
    y=int(y)
    if y<=2022:return "2018-2022"
    if y<=2024:return "2023-2024"
    return "2025-2026"

def simulate_to_horizon(ev,x,resolver,horizon_idx):
    sig=int(ev.signal_idx)
    entry=sig+1
    if entry>=len(x) or entry>=int(horizon_idx):
        return {"valid":False,"reason":"ENTRY_AFTER_HORIZON"}
    ep=float(x.ao.iloc[entry])
    entry_bid=float(x.bo.iloc[entry])
    atr=float(ev.atr_h1)
    low0=float(ev.anchor_low)
    stop=low0-atr
    target=low0+4.0*atr
    if not (stop<ep<target):
        return {"valid":False,"reason":"INVALID_NEXT_ASK_OPEN",
                "entry_t":int(x.t.iloc[entry]),"stop_px":stop,"target_px":target,"entry_px":ep}
    risk=ep-stop
    hidx=int(horizon_idx)
    if hidx>=len(x):
        return {"valid":False,"reason":"CENSORED_HORIZON"}
    for j in range(entry,hidx):
        bo=float(x.bo.iloc[j]); bh=float(x.bh.iloc[j]); bl=float(x.bl.iloc[j])
        if bo<=stop:
            xp=bo; kind="STOP_GAP"; ot=int(x.t.iloc[j]); amb=False
            return pack_reentry(x,j,entry,ep,entry_bid,stop,target,risk,xp,kind,amb,ot)
        if bo>=target:
            xp=bo; kind="TARGET_GAP"; ot=int(x.t.iloc[j]); amb=False
            return pack_reentry(x,j,entry,ep,entry_bid,stop,target,risk,xp,kind,amb,ot)
        s=bl<=stop; g=bh>=target
        if s and g:
            kind,xp,ot,amb=resolver.resolve(int(x.t.iloc[j]),stop,target)
            return pack_reentry(x,j,entry,ep,entry_bid,stop,target,risk,xp,kind,amb,ot)
        if s:
            xp=stop; kind="STOP"; ot=int(x.t.iloc[j]+300000); amb=False
            return pack_reentry(x,j,entry,ep,entry_bid,stop,target,risk,xp,kind,amb,ot)
        if g:
            xp=target; kind="TARGET"; ot=int(x.t.iloc[j]+300000); amb=False
            return pack_reentry(x,j,entry,ep,entry_bid,stop,target,risk,xp,kind,amb,ot)
    # Forced idea-horizon exit at bid open of the horizon-end M5 row.
    j=hidx
    xp=float(x.bo.iloc[j]); kind="IDEA_HORIZON_EXIT"; ot=int(x.t.iloc[j]); amb=False
    return pack_reentry(x,j,entry,ep,entry_bid,stop,target,risk,xp,kind,amb,ot)

def pack_reentry(x,exit_idx,entry_idx,ep,entry_bid,stop,target,risk,xp,kind,amb,outcome_t):
    return {
        "valid":True,"reason":"RESOLVED",
        "entry_idx":int(entry_idx),"exit_idx":int(exit_idx),
        "entry_t":int(x.t.iloc[entry_idx]),
        "exit_t":int(x.t.iloc[exit_idx]),
        "exit_available_t":int(outcome_t),
        "entry_px":float(ep),"entry_bid_px":float(entry_bid),
        "stop_px":float(stop),"target_px":float(target),"exit_px":float(xp),
        "risk_px":float(risk),
        "entry_rr":float((target-ep)/risk),
        "pnl_r":float((xp-ep)/risk),
        "exit_kind":str(kind),"m1_ambiguous":bool(amb),
        "entry_spread_px":float(x.ao.iloc[entry_idx]-x.bo.iloc[entry_idx]),
        "exit_spread_px":float(x.ao.iloc[exit_idx]-x.bo.iloc[exit_idx]),
    }

def metric_frame(trades):
    if len(trades)==0:
        return {"n":0,"total_r":0.0,"nominal_risk_units":0.0,"efficiency":None,
                "profit_factor":None,"win_rate":None,"realized_exit_order_dd_r":None,
                "risk_weighted_holding_m5_bars":0.0}
    q=trades.sort_values("exit_available_t").copy()
    v=q.scaled_pnl_r.to_numpy(float)
    pos=float(v[v>0].sum()); neg=float(-v[v<0].sum())
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.0,eq])[:-1]
    dd=eq-peak
    nom=float(q.risk_weight.sum())
    return {
        "n":int(len(q)),"total_r":float(v.sum()),"nominal_risk_units":nom,
        "efficiency":float(v.sum()/nom) if nom>0 else None,
        "profit_factor":float(pos/neg) if neg>0 else None,
        "win_rate":float((v>0).mean()),
        "realized_exit_order_dd_r":float(dd.min()),
        "risk_weighted_holding_m5_bars":float((q.risk_weight*q.holding_m5_bars).sum())
    }

def portfolio_curve_weighted(trades,m5,label):
    if len(trades)==0:
        return pd.DataFrame(),{"stream":label,"mtm_max_drawdown_r":None,"max_concurrent_trades":0,
                              "max_concurrent_initial_risk":0.0,"final_realized_r":0.0}
    close_t=(m5.t.astype(np.int64)+300000).to_numpy()
    bc=m5.bc.to_numpy(float)
    lo=int(np.searchsorted(close_t,int(trades.entry_t.min()),side="right"))
    hi=int(np.searchsorted(close_t,int(trades.exit_available_t.max()),side="right"))
    lo=max(0,lo-1); hi=min(len(m5),hi+1)
    n=hi-lo
    unreal=np.zeros(n,float); realized_delta=np.zeros(n,float)
    open_count=np.zeros(n,int); open_risk=np.zeros(n,float)
    for r in trades.itertuples(index=False):
        rw=float(r.risk_weight)
        s=int(np.searchsorted(close_t,int(r.entry_t),side="right"))
        e=int(np.searchsorted(close_t,int(r.exit_available_t),side="left"))
        s=max(s,lo); e=min(e,hi)
        if e>s:
            sl=s-lo; el=e-lo
            unreal[sl:el]+=rw*(bc[s:e]-float(r.entry_px))/float(r.risk_px)
            open_count[sl:el]+=1
            open_risk[sl:el]+=rw
        ridx=int(np.searchsorted(close_t,int(r.exit_available_t),side="left"))
        ridx=min(max(ridx,lo),hi-1)
        realized_delta[ridx-lo]+=float(r.scaled_pnl_r)
    realized=np.cumsum(realized_delta)
    equity=realized+unreal
    peak=np.maximum.accumulate(np.r_[0.0,equity])[:-1]
    dd=equity-peak
    out=pd.DataFrame({
        "t":m5.t.iloc[lo:hi].to_numpy(np.int64),
        "close_t":close_t[lo:hi],"bid_close":bc[lo:hi],
        "realized_r":realized,"unrealized_r":unreal,"equity_r":equity,
        "drawdown_r":dd,"open_trades":open_count,"open_initial_risk":open_risk
    })
    sparse=out[(out.open_trades>0)|(out.realized_r.diff().fillna(out.realized_r)!=0)].copy()
    return sparse,{
        "stream":label,"mtm_max_drawdown_r":float(dd.min()),
        "max_concurrent_trades":int(open_count.max()),
        "max_concurrent_initial_risk":float(open_risk.max()),
        "final_realized_r":float(realized[-1])
    }

def add_trade_fields(df,x,risk_weight,role):
    q=df.copy()
    tarr=x.t.to_numpy(np.int64)
    q["trade_role"]=role
    q["risk_weight"]=float(risk_weight)
    q["scaled_pnl_r"]=q.pnl_r.astype(float)*float(risk_weight)
    q["entry_idx_calc"]=q.entry_t.astype(np.int64).map({int(t):i for i,t in enumerate(tarr)})
    # Exit holding bars measured by observed M5 rows, using exit availability.
    q["holding_m5_bars"]=[
        max(0,int(np.searchsorted(tarr,int(ot),side="left"))-int(ei))
        for ot,ei in zip(q.exit_available_t,q.entry_idx_calc)
    ]
    return q

def build_reference_ideas(ref,x):
    tmap={int(t):i for i,t in enumerate(x.t.to_numpy(np.int64))}
    rows=[]
    for r in ref.itertuples(index=False):
        if norm_exit(r.exit_kind) not in STOP_CLASSES:
            continue
        entry_idx=tmap.get(int(r.entry_t))
        if entry_idx is None:
            raise RuntimeError(f"Reference entry_t missing from M5: {r.entry_t}")
        hidx=int(entry_idx)+TIMEOUT
        complete=hidx<len(x)
        hend=int(x.t.iloc[hidx]) if complete else None
        fresh_start_idx=int(np.searchsorted(x.t.to_numpy(np.int64),int(r.exit_available_t),side="left"))
        rows.append({
            "idea_id":f"IDEA_{int(r.signal_t)}",
            "first_signal_t":int(r.signal_t),"first_entry_t":int(r.entry_t),
            "first_exit_available_t":int(r.exit_available_t),
            "first_exit_kind":str(r.exit_kind),"first_pnl_r":float(r.pnl_r),
            "first_year":int(r.year),"segment":segment_year(r.year),
            "first_entry_idx":int(entry_idx),"original_horizon_end_idx":int(hidx),
            "original_horizon_end_t":hend,"horizon_complete":bool(complete),
            "fresh_start_idx":int(fresh_start_idx),
            "candidate_first_executed":False,
            "terminal_status":"PENDING",
            "fresh_screened_n":0,"state_reject_n":0,"permission_reject_n":0,
            "geometry_reject_n":0,"blocked_open_trade_n":0,
            "fully_valid_n":0,"reference_duplicate_n":0,
            "second_attempt_signal_t":np.nan,
        })
    return pd.DataFrame(rows)

def prepare_events(x,xs,perm):
    raw=audit.detect_events(x,"HIGH_RECLAIM")
    raw=audit.attach_states(raw,xs)
    allowed=raw[raw.state_id.isin(ALLOWED_STATES)].copy()
    pcols=["signal_t","signal_idx","anchor_idx","state_id","permission_on","score","permission_mean3"]
    p=perm[pcols].copy()
    if len(allowed)!=len(p):
        raise RuntimeError(f"State-eligible regeneration count mismatch: {len(allowed)} vs {len(p)}")
    akey=allowed[["signal_t","signal_idx","anchor_idx","state_id"]].sort_values("signal_t").reset_index(drop=True)
    pkey=p[["signal_t","signal_idx","anchor_idx","state_id"]].sort_values("signal_t").reset_index(drop=True)
    if not akey.equals(pkey):
        m=akey.merge(pkey,on="signal_t",how="outer",suffixes=("_regen","_corr"),indicator=True)
        raise RuntimeError(f"State-eligible event identity mismatch rows={int((m._merge!='both').sum())}")
    ev=raw.merge(p[["signal_t","permission_on","score","permission_mean3"]],on="signal_t",how="left")
    tarr=x.t.to_numpy(np.int64)
    ev["episode_start_t"]=[int(tarr[int(i)]) for i in ev.episode_start_idx]
    ev["candidate_entry_idx"]=ev.signal_idx.astype(int)+1
    ev["candidate_entry_t"]=[
        int(tarr[i]) if i<len(tarr) else np.nan for i in ev.candidate_entry_idx
    ]
    ask=[]; stops=[]; targets=[]; geom=[]
    for r in ev.itertuples(index=False):
        i=int(r.candidate_entry_idx)
        stop=float(r.anchor_low)-float(r.atr_h1)
        target=float(r.anchor_low)+4.0*float(r.atr_h1)
        ep=float(x.ao.iloc[i]) if i<len(x) else np.nan
        ask.append(ep); stops.append(stop); targets.append(target)
        geom.append(bool(np.isfinite(ep) and stop<ep<target))
    ev["candidate_entry_ask"]=ask
    ev["candidate_stop_px"]=stops
    ev["candidate_target_px"]=targets
    ev["geometry_valid"]=geom
    ev["state_allowed"]=ev.state_id.isin(ALLOWED_STATES)
    ev["permission_on"]=ev.permission_on.fillna(False).astype(bool)
    return ev,{"raw_high_reclaim_n":int(len(raw)),"state_eligible_n":int(len(allowed)),
               "corrected_permission_stream_n":int(len(p)),"identity_match":True}

def simulate_policy(ref,ideas,events,x,resolver):
    ref=ref.sort_values("entry_t").reset_index(drop=True).copy()
    ideas=ideas.copy().set_index("idea_id",drop=False)
    ref_signal_set=set(ref.signal_t.astype(np.int64))
    stop_idea_by_signal={int(r.first_signal_t):r.idea_id for r in ideas.itertuples(index=False)}

    # Baseline timeline + all fresh event entry opportunities.
    timeline=[]
    for i,r in ref.iterrows():
        timeline.append((int(r.entry_t),0,"REF",i))
    for i,r in events.iterrows():
        if pd.notna(r.candidate_entry_t):
            timeline.append((int(r.candidate_entry_t),1,"EV",i))
    timeline.sort(key=lambda z:(z[0],z[1],z[3]))

    open_until=-1
    candidate_rows=[]
    displaced=[]
    screen=[]
    consumed_event_signals=set()

    def record_normal(r):
        nonlocal open_until
        row=r.to_dict()
        row["trade_role"]="NORMAL_REFERENCE"
        row["risk_weight"]=1.0
        row["scaled_pnl_r"]=float(row["pnl_r"])
        row["idea_id"]=stop_idea_by_signal.get(int(r.signal_t),"")
        candidate_rows.append(row)
        open_until=int(r.exit_available_t)
        iid=stop_idea_by_signal.get(int(r.signal_t))
        if iid:
            ideas.at[iid,"candidate_first_executed"]=True
            if not bool(ideas.at[iid,"horizon_complete"]):
                ideas.at[iid,"terminal_status"]="CENSORED_HORIZON"

    for tm,pri,typ,idx in timeline:
        if typ=="REF":
            r=ref.iloc[idx]
            if tm<open_until:
                rec=r.to_dict()
                rec["reason"]="DISPLACED_BY_REENTRY"
                displaced.append(rec)
                iid=stop_idea_by_signal.get(int(r.signal_t))
                if iid:
                    ideas.at[iid,"terminal_status"]="FIRST_ATTEMPT_DISPLACED_BY_EARLIER_REENTRY"
                continue
            record_normal(r)
            continue

        e=events.iloc[idx]
        sig=int(e.signal_t)
        # Find active stopped ideas for which this episode is genuinely new.
        active=ideas[
            (ideas.candidate_first_executed==True)&
            (ideas.terminal_status=="PENDING")&
            (ideas.horizon_complete==True)&
            (ideas.first_exit_available_t.astype(np.int64)<=int(e.episode_start_t))&
            (ideas.fresh_start_idx.astype(np.int64)<=int(e.episode_start_idx))&
            (ideas.original_horizon_end_t.astype(float)>float(tm))
        ]
        if len(active)==0:
            continue
        # Most recent stopped idea gets exclusive assignment attempt for this event.
        active=active.sort_values(["first_exit_available_t","first_signal_t"],ascending=[False,False])
        iid=str(active.iloc[0].idea_id)
        ideas.at[iid,"fresh_screened_n"]+=1

        base_screen={
            "idea_id":iid,"event_signal_t":sig,"episode_start_t":int(e.episode_start_t),
            "entry_t":int(tm),"state_id":int(e.state_id),
            "permission_on":bool(e.permission_on),"geometry_valid":bool(e.geometry_valid),
            "reference_signal":bool(sig in ref_signal_set),
            "candidate_open_at_entry":bool(tm<open_until),
        }
        if not bool(e.state_allowed):
            ideas.at[iid,"state_reject_n"]+=1
            screen.append({**base_screen,"screen_result":"STATE_REJECT"})
            continue
        if not bool(e.permission_on):
            ideas.at[iid,"permission_reject_n"]+=1
            screen.append({**base_screen,"screen_result":"PERMISSION_REJECT"})
            continue
        if not bool(e.geometry_valid):
            ideas.at[iid,"geometry_reject_n"]+=1
            screen.append({**base_screen,"screen_result":"GEOMETRY_REJECT"})
            continue

        ideas.at[iid,"fully_valid_n"]+=1

        if sig in ref_signal_set:
            ideas.at[iid,"reference_duplicate_n"]+=1
            ideas.at[iid,"terminal_status"]="REFERENCE_ALREADY_CAPTURES"
            consumed_event_signals.add(sig)
            screen.append({**base_screen,"screen_result":"REFERENCE_ALREADY_CAPTURES"})
            continue

        if tm<open_until:
            ideas.at[iid,"blocked_open_trade_n"]+=1
            screen.append({**base_screen,"screen_result":"BLOCKED_OPEN_TRADE"})
            continue

        ev_obj=e
        out=simulate_to_horizon(ev_obj,x,resolver,int(ideas.at[iid,"original_horizon_end_idx"]))
        if not out.get("valid",False):
            # Geometry was valid. Only a horizon/censor edge should remain.
            screen.append({**base_screen,"screen_result":str(out.get("reason","EXECUTION_INVALID"))})
            continue

        row={
            "engine":"swing","state_id":int(e.state_id),
            "year":int(pd.to_datetime(tm,unit="ms",utc=True).year),
            "signal_t":sig,
            **{k:v for k,v in out.items() if k not in {"valid","reason","entry_idx","exit_idx"}},
            "anchor_low":float(e.anchor_low),"atr_h1":float(e.atr_h1),
            "trade_role":"INCREMENTAL_REENTRY","risk_weight":R2,
            "scaled_pnl_r":float(out["pnl_r"])*R2,
            "idea_id":iid,
        }
        candidate_rows.append(row)
        open_until=int(out["exit_available_t"])
        ideas.at[iid,"terminal_status"]="INCREMENTAL_REENTRY_EXECUTED"
        ideas.at[iid,"second_attempt_signal_t"]=sig
        consumed_event_signals.add(sig)
        screen.append({**base_screen,"screen_result":"INCREMENTAL_REENTRY_EXECUTED",
                       "second_exit_available_t":int(out["exit_available_t"]),
                       "second_pnl_r":float(out["pnl_r"])})
    # Finalize pending ideas without silently dropping any.
    ev_by_episode=events.sort_values("episode_start_t")
    for iid,r in ideas.iterrows():
        if r.terminal_status!="PENDING":
            continue
        if not bool(r.horizon_complete):
            ideas.at[iid,"terminal_status"]="CENSORED_HORIZON"
            continue
        if int(r.fresh_screened_n)==0:
            later=ev_by_episode[ev_by_episode.episode_start_t>=int(r.first_exit_available_t)]
            if len(later) and float(later.iloc[0].candidate_entry_t)>=float(r.original_horizon_end_t):
                ideas.at[iid,"terminal_status"]="HORIZON_EXPIRED"
            else:
                ideas.at[iid,"terminal_status"]="NO_FRESH_SETUP"
        elif int(r.blocked_open_trade_n)>0:
            ideas.at[iid,"terminal_status"]="FRESH_EVENTS_BLOCKED_OPEN_TRADE"
        elif int(r.geometry_reject_n)>0:
            ideas.at[iid,"terminal_status"]="FRESH_EVENTS_REJECTED_GEOMETRY"
        elif int(r.permission_reject_n)>0:
            ideas.at[iid,"terminal_status"]="FRESH_EVENTS_REJECTED_PERMISSION"
        else:
            ideas.at[iid,"terminal_status"]="NO_FRESH_SETUP"

    cand=pd.DataFrame(candidate_rows)
    disp=pd.DataFrame(displaced)
    scr=pd.DataFrame(screen)
    return cand,disp,ideas.reset_index(drop=True),scr

def finalize_trade_fields(df,x):
    if len(df)==0:return df
    q=df.copy()
    tarr=x.t.to_numpy(np.int64)
    q["scaled_pnl_r"]=q.pnl_r.astype(float)*q.risk_weight.astype(float)
    q["holding_m5_bars"]=[
        max(0,int(np.searchsorted(tarr,int(ot),side="left"))-int(np.searchsorted(tarr,int(et),side="left")))
        for et,ot in zip(q.entry_t,q.exit_available_t)
    ]
    return q

def make_riskmatched(ref,lam,x):
    q=ref.copy()
    q["trade_role"]="RISK_MATCHED_REFERENCE"
    q["risk_weight"]=float(lam)
    q["scaled_pnl_r"]=q.pnl_r.astype(float)*float(lam)
    q["idea_id"]=""
    return finalize_trade_fields(q,x)

def idea_results(ideas,candidate):
    sec=candidate[candidate.trade_role=="INCREMENTAL_REENTRY"].copy()
    sec_map={str(r.idea_id):r for r in sec.itertuples(index=False)}
    rows=[]
    for r in ideas.itertuples(index=False):
        s=sec_map.get(str(r.idea_id))
        second_pnl=np.nan; second_weighted=0.0; second_exit=""; second_rr=np.nan
        if s is not None:
            second_pnl=float(s.pnl_r); second_weighted=float(s.scaled_pnl_r)
            second_exit=str(s.exit_kind); second_rr=float(s.entry_rr)
        rows.append({
            **r._asdict(),
            "second_attempt_raw_pnl_r":second_pnl,
            "second_attempt_weighted_pnl_r":second_weighted,
            "second_attempt_exit_kind":second_exit,
            "second_attempt_entry_rr":second_rr,
            "combined_idea_r":float(r.first_pnl_r)+second_weighted if bool(r.candidate_first_executed) else np.nan,
            "double_loss":bool(s is not None and float(s.pnl_r)<0),
            "second_positive":bool(s is not None and float(s.pnl_r)>0),
        })
    return pd.DataFrame(rows)

def policy_by_period(candidate,reference,riskmatched):
    rows=[]
    for mode in ["year","segment"]:
        vals=sorted(set(
            ([int(y) for y in pd.to_datetime(reference.entry_t,unit="ms",utc=True).dt.year.unique()]
             if mode=="year" else ["2018-2022","2023-2024","2025-2026"])
        ), key=lambda x:str(x))
        for v in vals:
            def filt(df):
                y=pd.to_datetime(df.entry_t,unit="ms",utc=True).dt.year
                if mode=="year": return df[y==int(v)]
                seg=y.map(segment_year)
                return df[seg==v]
            for stream,df in [("REFERENCE",reference),("CANDIDATE",candidate),("RISK_MATCHED_REFERENCE",riskmatched)]:
                g=filt(df)
                m=metric_frame(g)
                rows.append({"group_type":mode,"group":v,"stream":stream,**m})
    return pd.DataFrame(rows)

def bootstrap_daily_delta(candidate,riskmatched):
    c=candidate.copy(); r=riskmatched.copy()
    c["day"]=pd.to_datetime(c.exit_available_t,unit="ms",utc=True).dt.strftime("%Y-%m-%d")
    r["day"]=pd.to_datetime(r.exit_available_t,unit="ms",utc=True).dt.strftime("%Y-%m-%d")
    cd=c.groupby("day").scaled_pnl_r.sum()
    rd=r.groupby("day").scaled_pnl_r.sum()
    days=sorted(set(cd.index)|set(rd.index))
    diff=np.array([float(cd.get(d,0.0)-rd.get(d,0.0)) for d in days],float)
    n=len(days)
    rng=np.random.default_rng(SEED)
    starts=np.arange(max(1,n-BLOCK_DAYS+1))
    vals=[]
    for _ in range(N_BOOT):
        idx=[]
        while len(idx)<n:
            s=int(rng.choice(starts))
            idx.extend(range(s,min(n,s+BLOCK_DAYS)))
        idx=idx[:n]
        vals.append(float(diff[idx].sum()))
    a=np.asarray(vals,float)
    return {
        "replications":N_BOOT,"days":n,
        "point_total_delta_r":float(diff.sum()),
        "bootstrap_mean_total_delta_r":float(a.mean()),
        "ci_low":float(np.quantile(a,.025)),
        "ci_high":float(np.quantile(a,.975)),
        "share_gt_zero":float((a>0).mean())
    }

def classify(ideas,screen,candidate,reference,riskmatched,cand_port,rm_port,period):
    sec=candidate[candidate.trade_role=="INCREMENTAL_REENTRY"]
    fully_valid=int((screen.screen_result.isin(["REFERENCE_ALREADY_CAPTURES","BLOCKED_OPEN_TRADE","INCREMENTAL_REENTRY_EXECUTED"])).sum()) if len(screen) else 0
    refcap=int((screen.screen_result=="REFERENCE_ALREADY_CAPTURES").sum()) if len(screen) else 0
    refshare=float(refcap/fully_valid) if fully_valid else 0.0
    nsec=int(len(sec))
    segcounts={}
    if nsec:
        yy=pd.to_datetime(sec.entry_t,unit="ms",utc=True).dt.year
        ss=yy.map(segment_year)
        segcounts={s:int((ss==s).sum()) for s in ["2018-2022","2023-2024","2025-2026"]}
    else:
        segcounts={s:0 for s in ["2018-2022","2023-2024","2025-2026"]}
    if refshare>=.80 and nsec<30:
        return "REFERENCE_ALREADY_CAPTURES",{"fully_valid_fresh_events":fully_valid,"reference_captured":refcap,"reference_capture_share":refshare,"second_attempt_n":nsec,"segment_counts":segcounts}
    if nsec<30 or any(segcounts[s]<5 for s in segcounts):
        return "INSUFFICIENT_INCREMENTAL_REENTRY_SAMPLE",{"fully_valid_fresh_events":fully_valid,"reference_captured":refcap,"reference_capture_share":refshare,"second_attempt_n":nsec,"segment_counts":segcounts}
    cm=metric_frame(candidate); rm=metric_frame(riskmatched); bm=metric_frame(reference)
    sec_weighted=float(sec.scaled_pnl_r.sum())
    ideas2=ideas[ideas.terminal_status=="INCREMENTAL_REENTRY_EXECUTED"]
    double=float(ideas2.double_loss.mean()) if "double_loss" in ideas2 and len(ideas2) else np.nan

    p=period
    seg_ok=0; seg_worst=0.0
    for s in ["2018-2022","2023-2024","2025-2026"]:
        ca=p[(p.group_type=="segment")&(p.group==s)&(p.stream=="CANDIDATE")]
        rr=p[(p.group_type=="segment")&(p.group==s)&(p.stream=="RISK_MATCHED_REFERENCE")]
        cv=float(ca.total_r.iloc[0]) if len(ca) else 0.0
        rv=float(rr.total_r.iloc[0]) if len(rr) else 0.0
        delta=cv-rv
        if delta>=0:seg_ok+=1
        seg_worst=min(seg_worst,delta)

    crit={
        "candidate_gt_riskmatched_total":bool(cm["total_r"]>rm["total_r"]),
        "efficiency_delta_ge_0_01":bool((cm["efficiency"]-bm["efficiency"])>=.01),
        "second_attempt_weighted_total_positive":bool(sec_weighted>0),
        "dd_within_10pct":bool(abs(float(cand_port["mtm_max_drawdown_r"]))<=1.10*abs(float(rm_port["mtm_max_drawdown_r"]))),
        "segments_nonnegative_at_least_2":bool(seg_ok>=2),
        "no_segment_below_minus5":bool(seg_worst>=-5.0),
        "double_loss_le_60pct":bool(double<=.60),
    }
    final="REENTRY_VALUE_CANDIDATE" if all(crit.values()) else "NO_VALUE_AFTER_RISK_CONTROL"
    return final,{"fully_valid_fresh_events":fully_valid,"reference_captured":refcap,"reference_capture_share":refshare,
                  "second_attempt_n":nsec,"segment_counts":segcounts,"criteria":crit,
                  "second_attempt_weighted_total_r":sec_weighted,"double_loss_rate":double,
                  "segment_nonnegative_n":seg_ok,"worst_segment_delta_r":seg_worst}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    ref=pd.read_csv(EXP1/"swing_corrected_shadow_trades.csv")
    perm=pd.read_csv(EXP1/"swing_permission_full_event_stream.csv")
    if len(ref)!=1177:
        raise RuntimeError(f"Reference count mismatch {len(ref)}")
    if abs(float(ref.pnl_r.sum())-79.6535825639913)>1e-9:
        raise RuntimeError(f"Reference total R mismatch {ref.pnl_r.sum()}")

    print("build M5/context",flush=True)
    m5,m15,h1,_=audit.aggregate_all(ROOT)
    x,h=audit.build_context(m5,m15,h1)
    xs,_=audit.fit_states(x)
    events,event_recon=prepare_events(x,xs,perm)
    print("event reconciliation",event_recon,flush=True)

    ideas=build_reference_ideas(ref,x)
    resolver=audit.M1Resolver(ROOT)

    candidate,displaced,ideas_after,screen=simulate_policy(ref,ideas,events,x,resolver)
    candidate=finalize_trade_fields(candidate,x)
    refx=ref.copy()
    refx["trade_role"]="NORMAL_REFERENCE"
    refx["risk_weight"]=1.0
    refx["scaled_pnl_r"]=refx.pnl_r.astype(float)
    refx["idea_id"]=""
    refx=finalize_trade_fields(refx,x)

    total_nom=float(candidate.risk_weight.sum())
    lam=total_nom/float(refx.risk_weight.sum())
    riskmatched=make_riskmatched(ref,lam,x)

    # Idea result table after second attempt linkage.
    idea_df=idea_results(ideas_after,candidate)

    # Portfolio metrics.
    ref_curve,ref_port=portfolio_curve_weighted(refx,m5,"REFERENCE")
    cand_curve,cand_port=portfolio_curve_weighted(candidate,m5,"CANDIDATE")
    rm_curve,rm_port=portfolio_curve_weighted(riskmatched,m5,"RISK_MATCHED_REFERENCE")

    period=policy_by_period(candidate,refx,riskmatched)
    yearly=period[period.group_type=="year"].copy()
    segment=period[period.group_type=="segment"].copy()

    classification,detail=classify(idea_df,screen,candidate,refx,riskmatched,cand_port,rm_port,period)
    boot=bootstrap_daily_delta(candidate,riskmatched)

    # Terminal ledger integrity.
    if len(idea_df)!=len(ideas):
        raise RuntimeError("Idea ledger size changed")
    if (idea_df.terminal_status=="PENDING").any():
        raise RuntimeError("Pending ideas remain")
    if idea_df.idea_id.duplicated().any():
        raise RuntimeError("Duplicate idea_id")
    executed_sec=candidate[candidate.trade_role=="INCREMENTAL_REENTRY"]
    if executed_sec.idea_id.duplicated().any():
        raise RuntimeError("More than one second attempt per idea")
    if executed_sec.signal_t.duplicated().any():
        raise RuntimeError("Fresh event linked to multiple ideas")

    # Reconciliation and screening totals.
    status_counts=idea_df.terminal_status.value_counts().to_dict()
    screen_counts=screen.screen_result.value_counts().to_dict() if len(screen) else {}
    sec=executed_sec.copy()

    # Save.
    pd.DataFrame([
        {"metric":"reference_trades","value":len(refx)},
        {"metric":"reference_total_r","value":float(refx.scaled_pnl_r.sum())},
        {"metric":"reference_stopped_ideas","value":len(ideas)},
        {"metric":"regenerated_raw_high_reclaims","value":event_recon["raw_high_reclaim_n"]},
        {"metric":"regenerated_state_eligible","value":event_recon["state_eligible_n"]},
        {"metric":"corrected_permission_stream","value":event_recon["corrected_permission_stream_n"]},
        {"metric":"candidate_policy_trades","value":len(candidate)},
        {"metric":"candidate_normal_reference_trades","value":int((candidate.trade_role=="NORMAL_REFERENCE").sum())},
        {"metric":"incremental_second_attempts","value":len(sec)},
        {"metric":"displaced_reference_trades","value":len(displaced)},
        {"metric":"risk_match_lambda","value":lam},
    ]).to_csv(OUT/"sample_reconciliation.csv",index=False)

    idea_df.to_csv(OUT/"stopped_ideas.csv",index=False)
    screen.to_csv(OUT/"fresh_event_screening.csv",index=False)
    sec.to_csv(OUT/"second_attempts.csv",index=False)
    displaced.to_csv(OUT/"displaced_reference_trades.csv",index=False)
    candidate.to_csv(OUT/"candidate_policy_trades.csv",index=False)
    idea_df.to_csv(OUT/"idea_level_results.csv",index=False)
    yearly.to_csv(OUT/"yearly_policy_summary.csv",index=False)
    segment.to_csv(OUT/"segment_policy_summary.csv",index=False)
    ref_curve.to_csv(OUT/"reference_portfolio_mtm.csv",index=False)
    cand_curve.to_csv(OUT/"candidate_portfolio_mtm.csv",index=False)
    rm_curve.to_csv(OUT/"riskmatched_reference_portfolio_mtm.csv",index=False)

    portfolio_rows=[]
    for name,df,port in [("REFERENCE",refx,ref_port),("CANDIDATE",candidate,cand_port),("RISK_MATCHED_REFERENCE",riskmatched,rm_port)]:
        portfolio_rows.append({"stream":name,**metric_frame(df),**port})
    portfolio=pd.DataFrame(portfolio_rows)
    portfolio.to_csv(OUT/"portfolio_summary.csv",index=False)
    (OUT/"bootstrap_summary.json").write_text(json.dumps(boot,indent=2),encoding="utf-8")

    # Useful second-attempt/idea diagnostics.
    second_diag={
        "n":int(len(sec)),
        "raw_total_r":float(sec.pnl_r.sum()) if len(sec) else 0.0,
        "weighted_total_r":float(sec.scaled_pnl_r.sum()) if len(sec) else 0.0,
        "positive_share":float((sec.pnl_r>0).mean()) if len(sec) else None,
        "double_loss_share":float(idea_df.loc[idea_df.terminal_status=="INCREMENTAL_REENTRY_EXECUTED","double_loss"].mean()) if len(sec) else None,
        "exit_counts":{str(k):int(v) for k,v in sec.exit_kind.value_counts().to_dict().items()} if len(sec) else {},
        "median_entry_rr":float(sec.entry_rr.median()) if len(sec) else None,
    }
    displaced_diag={
        "n":int(len(displaced)),
        "reference_pnl_r_sum_displaced":float(displaced.pnl_r.sum()) if len(displaced) else 0.0,
        "positive_share":float((displaced.pnl_r>0).mean()) if len(displaced) else None,
    }

    summary={
        "scope":"One-Shot Fresh-Reclaim Re-entry v0.1",
        "protocol_commits":["11b5d0d","6cc91d6"],
        "base_commit":"0d71256",
        "pristine_forward_oos_read":False,
        "event_reconciliation":event_recon,
        "reference":{"n":len(refx),"total_r":float(refx.scaled_pnl_r.sum())},
        "idea_status_counts":{str(k):int(v) for k,v in status_counts.items()},
        "screen_result_counts":{str(k):int(v) for k,v in screen_counts.items()},
        "second_attempt":second_diag,
        "displacement":displaced_diag,
        "risk_match_lambda":float(lam),
        "portfolio":portfolio.to_dict(orient="records"),
        "bootstrap":boot,
        "classification":classification,
        "classification_detail":detail,
    }
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2,default=str),encoding="utf-8")

    print("CLASSIFICATION",classification,flush=True)
    print("STATUS_COUNTS",json.dumps(summary["idea_status_counts"]),flush=True)
    print("SCREEN_COUNTS",json.dumps(summary["screen_result_counts"]),flush=True)
    print("SECOND",json.dumps(second_diag),flush=True)
    print("DISPLACED",json.dumps(displaced_diag),flush=True)
    print("PORTFOLIO",portfolio.to_string(index=False),flush=True)
    print("BOOT",json.dumps(boot),flush=True)

if __name__=="__main__":
    main()
