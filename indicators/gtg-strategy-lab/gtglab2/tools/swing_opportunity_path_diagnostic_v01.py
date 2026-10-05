from pathlib import Path
from functools import lru_cache
import json, math, sys
import numpy as np
import pandas as pd
from scipy.stats import ks_2samp

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
AUDIT_RUN=GTG/"runs"/"measurement-execution-audit-v01"
OUT=GTG/"runs"/"swing-opportunity-path-diagnostic-v01"
sys.path.insert(0,str(TOOLS))

import measurement_execution_audit_v01 as audit

SEED=42049
N_BOOT=2000
BLOCK_DAYS=5
ECON=0.05

GEOM_VARS=["entry_distance_anchor_atr","entry_spread_r","bars_from_anchor"]
FULL_CONT=["entry_distance_anchor_atr","entry_spread_r","bars_from_anchor",
           "signed_coherence_24h","expansion_level","expansion_persistence"]
EXACT_VARS=["state_id","session_bucket_utc"]

def period_mask(df,name):
    dt=pd.to_datetime(df.entry_t,unit="ms",utc=True)
    if name=="2025_full":
        return (dt>=pd.Timestamp("2025-01-01",tz="UTC"))&(dt<pd.Timestamp("2026-01-01",tz="UTC"))
    if name=="2025_jan_sep":
        return (dt>=pd.Timestamp("2025-01-01",tz="UTC"))&(dt<pd.Timestamp("2025-10-01",tz="UTC"))
    if name=="2026_jan_sep":
        return (dt>=pd.Timestamp("2026-01-01",tz="UTC"))&(dt<pd.Timestamp("2026-10-01",tz="UTC"))
    if name=="2023_2024":
        return (dt>=pd.Timestamp("2023-01-01",tz="UTC"))&(dt<pd.Timestamp("2025-01-01",tz="UTC"))
    if name=="2023":
        return (dt>=pd.Timestamp("2023-01-01",tz="UTC"))&(dt<pd.Timestamp("2024-01-01",tz="UTC"))
    if name=="2024":
        return (dt>=pd.Timestamp("2024-01-01",tz="UTC"))&(dt<pd.Timestamp("2025-01-01",tz="UTC"))
    raise KeyError(name)

def session_bucket(ms):
    h=pd.to_datetime(int(ms),unit="ms",utc=True).hour
    if h<6:return "S0"
    if h<12:return "S1"
    if h<18:return "S2"
    return "S3"

def build_h1_context(h1):
    h=h1.copy().sort_values("t").reset_index(drop=True)
    c=h.bc.astype(float)
    logc=np.log(c)
    lr=logc.diff()
    denom=lr.abs().rolling(24,min_periods=24).sum()
    h["signed_coherence_24h"]=(logc-logc.shift(24))/denom.replace(0,np.nan)
    h["atr_price"]=h.h1_atr.astype(float)/c.replace(0,np.nan)
    train=(pd.to_datetime(h.t,unit="ms",utc=True).dt.year<=2022)
    tr=np.sort(h.loc[train,"atr_price"].dropna().to_numpy(float))
    vals=h.atr_price.to_numpy(float)
    pct=np.full(len(h),np.nan)
    ok=np.isfinite(vals)
    pct[ok]=np.searchsorted(tr,vals[ok],side="right")/max(1,len(tr))
    h["expansion_level"]=pct
    train_level=h.loc[train,"expansion_level"].dropna()
    train_q75=float(train_level.quantile(.75))
    h["expansion_persistence"]=(h.expansion_level>=train_q75).astype(float).rolling(120,min_periods=120).mean()
    h["ready_t"]=h.t.astype(np.int64)+3600000
    return h[["ready_t","signed_coherence_24h","expansion_level","expansion_persistence"]], {
        "train_atr_price_n":int(len(tr)),"train_expansion_q75":train_q75
    }

def state_distance_lookup(x,state_pipe):
    imp=state_pipe.named_steps["imp"]
    sc=state_pipe.named_steps["scale"]
    km=state_pipe.named_steps["km"]
    z=sc.transform(imp.transform(x[audit.STATE_FEATURES]))
    assigned=km.predict(z)
    centers=km.cluster_centers_
    dist=np.linalg.norm(z-centers[assigned],axis=1)
    years=pd.to_datetime(x.t,unit="ms",utc=True).dt.year.to_numpy()
    q95=float(np.quantile(dist[years<=2022],.95))
    return dist,q95

def enrich_events(events,x,h1ctx,state_dist,state_q95,permission,shadow,live):
    e=events.copy().sort_values("signal_t").reset_index(drop=True)
    p=permission[["signal_t","permission_on","permission_mean3"]].copy()
    e=e.merge(p,on="signal_t",how="left")
    shadow_set=set(shadow.signal_t.astype(np.int64))
    live_set=set(live.signal_t.astype(np.int64))
    x_t=x.t.to_numpy(np.int64)
    rows=[]
    for r in e.itertuples(index=False):
        sig=int(r.signal_idx); entry_idx=sig+1
        if entry_idx>=len(x):
            continue
        entry_t=int(x_t[entry_idx])
        ask=float(x.ao.iloc[entry_idx]); bid=float(x.bo.iloc[entry_idx])
        atr=float(r.atr_h1); anchor=float(r.anchor_low); stop=anchor-atr; target=anchor+4.0*atr
        risk=ask-stop
        entry_dist=(ask-anchor)/atr if atr>0 else np.nan
        spread_r=(ask-bid)/risk if risk>0 else np.nan
        entry_rr=(target-ask)/risk if risk>0 else np.nan
        stop_dist_atr=risk/atr if atr>0 else np.nan
        target_dist_atr=(target-ask)/atr if atr>0 else np.nan
        rows.append({
            "signal_t":int(r.signal_t),"entry_t":entry_t,"signal_idx":sig,"anchor_idx":int(r.anchor_idx),
            "state_id":int(r.state_id),"anchor_low":anchor,"anchor_high":float(r.anchor_high),"atr_h1":atr,
            "entry_px":ask,"entry_bid_px":bid,"initial_risk_price":risk,
            "entry_distance_anchor_atr":entry_dist,"entry_spread_r":spread_r,
            "entry_rr":entry_rr,"stop_distance_atr":stop_dist_atr,"target_distance_atr":target_dist_atr,
            "bars_from_anchor":int(r.signal_idx-r.anchor_idx),
            "session_bucket_utc":session_bucket(entry_t),
            "state_distance":float(state_dist[sig]),"state_novel_train_q95":bool(state_dist[sig]>state_q95),
            "permission_on":bool(getattr(r,"permission_on",False)),
            "in_shadow":int(r.signal_t) in shadow_set,
            "in_health_live":int(r.signal_t) in live_set,
            "label_valid":bool(r.label_label_valid),
            "label_reason":str(r.label_reason),
            "label_pnl_r":float(r.label_pnl_r) if pd.notna(r.label_pnl_r) else np.nan,
            "label_exit_kind":str(r.label_exit_kind) if pd.notna(r.label_exit_kind) else "",
            "label_outcome_t":int(r.label_outcome_t) if pd.notna(r.label_outcome_t) else np.nan,
        })
    q=pd.DataFrame(rows)
    q=pd.merge_asof(q.sort_values("entry_t"),h1ctx.sort_values("ready_t"),
                    left_on="entry_t",right_on="ready_t",direction="backward")
    q["trading_day"]=pd.to_datetime(q.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m-%d")
    q["month"]=pd.to_datetime(q.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m")
    return q

def build_primary(shadow,enriched):
    cols=["signal_t","entry_t","entry_distance_anchor_atr","entry_spread_r",
          "stop_distance_atr","target_distance_atr","bars_from_anchor","session_bucket_utc",
          "signed_coherence_24h","expansion_level","expansion_persistence","state_distance",
          "state_novel_train_q95","anchor_high","trading_day","month"]
    pre=enriched[cols].drop_duplicates("signal_t")
    q=shadow.merge(pre,on=["signal_t","entry_t"],how="left")
    q["row_id"]=["P%06d"%i for i in range(len(q))]
    return q

def train_scales(enriched):
    y=pd.to_datetime(enriched.entry_t,unit="ms",utc=True).dt.year
    tr=enriched[y<=2022].copy()
    out={}
    removed=[]
    for v in FULL_CONT:
        a=tr[v].dropna().to_numpy(float)
        med=float(np.median(a))
        q25,q75=np.quantile(a,[.25,.75])
        iqr=float(q75-q25)
        out[v]={"median":med,"iqr":iqr,"n":int(len(a))}
        if not np.isfinite(iqr) or iqr<=0:
            removed.append(v)
    return out,removed

def standardize(df,scales,vars_):
    z=df.copy()
    for v in vars_:
        s=scales[v]
        if s["iqr"]>0:
            z[v+"_z"]=(z[v]-s["median"])/s["iqr"]
        else:
            z[v+"_z"]=0.0
    return z

def caliper_ok(tv,dv,stage,scales,removed):
    if stage in ("geometry","full"):
        if "entry_distance_anchor_atr" not in removed:
            if abs(tv["entry_distance_anchor_atr"]-dv["entry_distance_anchor_atr"])>0.5*scales["entry_distance_anchor_atr"]["iqr"]:
                return False
        if "entry_spread_r" not in removed:
            if abs(tv["entry_spread_r"]-dv["entry_spread_r"])>0.5*scales["entry_spread_r"]["iqr"]:
                return False
        if abs(tv["bars_from_anchor"]-dv["bars_from_anchor"])>2:
            return False
    if stage=="full":
        if tv["state_id"]!=dv["state_id"] or tv["session_bucket_utc"]!=dv["session_bucket_utc"]:
            return False
        if "signed_coherence_24h" not in removed:
            if abs(tv["signed_coherence_24h"]-dv["signed_coherence_24h"])>0.5*scales["signed_coherence_24h"]["iqr"]:
                return False
        if abs(tv["expansion_level"]-dv["expansion_level"])>0.20:
            return False
        if abs(tv["expansion_persistence"]-dv["expansion_persistence"])>0.20:
            return False
    return True

def match_nn(donor,target,stage,scales,removed):
    vars_=GEOM_VARS if stage=="geometry" else FULL_CONT
    req=list(vars_)
    if stage=="full": req+=EXACT_VARS
    d=donor.copy(); t=target.copy()
    d_complete=d[req].notna().all(axis=1)
    t_complete=t[req].notna().all(axis=1)
    d2=d[d_complete].copy().sort_values(["signal_t","row_id"]).reset_index(drop=True)
    t2=t[t_complete].copy().sort_values(["signal_t","row_id"]).reset_index(drop=True)
    active_vars=[v for v in vars_ if v not in removed]
    d2=standardize(d2,scales,active_vars)
    t2=standardize(t2,scales,active_vars)

    n=len(d2)
    available=np.ones(n,dtype=bool)
    donor_signal=d2.signal_t.to_numpy(np.int64)
    donor_row=d2.row_id.astype(str).to_numpy()
    dz={v:d2[v+"_z"].to_numpy(float) for v in active_vars}
    draw={v:d2[v].to_numpy(float) for v in vars_}
    if stage=="full":
        dst=d2.state_id.to_numpy()
        dsession=d2.session_bucket_utc.astype(str).to_numpy()

    pairs=[]
    for tr in t2.itertuples(index=False):
        mask=available.copy()

        if "entry_distance_anchor_atr" not in removed:
            mask &= np.abs(draw["entry_distance_anchor_atr"]-float(tr.entry_distance_anchor_atr)) <= 0.5*scales["entry_distance_anchor_atr"]["iqr"]
        if "entry_spread_r" not in removed:
            mask &= np.abs(draw["entry_spread_r"]-float(tr.entry_spread_r)) <= 0.5*scales["entry_spread_r"]["iqr"]
        mask &= np.abs(draw["bars_from_anchor"]-float(tr.bars_from_anchor)) <= 2

        if stage=="full":
            mask &= (dst==tr.state_id)
            mask &= (dsession==str(tr.session_bucket_utc))
            if "signed_coherence_24h" not in removed:
                mask &= np.abs(draw["signed_coherence_24h"]-float(tr.signed_coherence_24h)) <= 0.5*scales["signed_coherence_24h"]["iqr"]
            mask &= np.abs(draw["expansion_level"]-float(tr.expansion_level)) <= 0.20
            mask &= np.abs(draw["expansion_persistence"]-float(tr.expansion_persistence)) <= 0.20

        idx=np.flatnonzero(mask)
        if len(idx)==0:
            continue

        dist=np.zeros(len(idx),dtype=float)
        for v in active_vars:
            dist += np.abs(dz[v][idx]-float(getattr(tr,v+"_z")))
        min_dist=float(np.min(dist))
        tied=idx[dist==min_dist]
        di=int(tied[0])
        pairs.append({
            "target_row_id":str(tr.row_id),"donor_row_id":str(donor_row[di]),
            "target_signal_t":int(tr.signal_t),"donor_signal_t":int(donor_signal[di]),
            "distance":min_dist
        })
        available[di]=False

    p=pd.DataFrame(pairs)
    meta={
        "target_total":int(len(t)),"donor_total":int(len(d)),
        "target_complete":int(t_complete.sum()),"donor_complete":int(d_complete.sum()),
        "matched":int(len(p)),
        "target_coverage":float(len(p)/len(t)) if len(t) else 0.0,
        "donor_coverage":float(len(p)/len(d)) if len(d) else 0.0,
        "target_missing_preentry":int((~t_complete).sum()),
        "donor_missing_preentry":int((~d_complete).sum())
    }
    if meta["target_coverage"]<0.50:
        meta["support_class"]="INSUFFICIENT"
    elif meta["target_coverage"]<0.70 or meta["matched"]<50:
        meta["support_class"]="LIMITED"
    else:
        meta["support_class"]="ADEQUATE"
    return p,meta

def balance(donor,target,pairs,stage):
    if len(pairs)==0:
        return pd.DataFrame(),{"balance_class":"FAILED","max_abs_smd":None}
    dm=donor.set_index("row_id").loc[pairs.donor_row_id].reset_index()
    tm=target.set_index("row_id").loc[pairs.target_row_id].reset_index()
    vars_=GEOM_VARS if stage=="geometry" else FULL_CONT
    rows=[]
    maxs=0.0
    for v in vars_:
        a=tm[v].to_numpy(float); b=dm[v].to_numpy(float)
        va=np.var(a,ddof=1) if len(a)>1 else np.nan
        vb=np.var(b,ddof=1) if len(b)>1 else np.nan
        pooled=np.sqrt((va+vb)/2.0) if np.isfinite(va) and np.isfinite(vb) else np.nan
        smd=float((np.mean(a)-np.mean(b))/pooled) if np.isfinite(pooled) and pooled>0 else 0.0
        vr=float(va/vb) if np.isfinite(va) and np.isfinite(vb) and vb>0 else np.nan
        ks=float(ks_2samp(a,b).statistic) if len(a) and len(b) else np.nan
        rows.append({"variable":v,"target_mean":float(np.mean(a)),"donor_mean":float(np.mean(b)),
                     "smd":smd,"abs_smd":abs(smd),"variance_ratio":vr,"ks_gap":ks})
        maxs=max(maxs,abs(smd))
    cls="GOOD" if maxs<=0.10 else ("MARGINAL" if maxs<=0.15 else "FAILED")
    return pd.DataFrame(rows),{"balance_class":cls,"max_abs_smd":float(maxs)}

def matched_delta(donor,target,pairs):
    if len(pairs)==0:return np.nan
    dm=donor.set_index("row_id").loc[pairs.donor_row_id]
    tm=target.set_index("row_id").loc[pairs.target_row_id]
    return float(tm.pnl_r.to_numpy(float).mean()-dm.pnl_r.to_numpy(float).mean())

def observed_market_days(m5,start,end):
    dt=pd.to_datetime(m5.t,unit="ms",utc=True)
    mask=(dt>=pd.Timestamp(start,tz="UTC"))&(dt<pd.Timestamp(end,tz="UTC"))
    return sorted(pd.Series(dt[mask].dt.strftime("%Y-%m-%d").unique()).tolist())

def moving_block_days(days,rng):
    n=len(days)
    if n==0:return []
    starts=np.arange(max(1,n-BLOCK_DAYS+1))
    out=[]
    while len(out)<n:
        s=int(rng.choice(starts))
        out.extend(days[s:min(n,s+BLOCK_DAYS)])
    return out[:n]

def resample_rows(df,calendar_days,rng,prefix):
    chosen=moving_block_days(calendar_days,rng)
    byday={k:g for k,g in df.groupby("trading_day")}
    parts=[]; counter=0
    for occ,day in enumerate(chosen):
        g=byday.get(day)
        if g is None: continue
        q=g.copy()
        q["row_id"]=[f"{prefix}{counter+i:07d}" for i in range(len(q))]
        counter+=len(q)
        parts.append(q)
    return pd.concat(parts,ignore_index=True) if parts else df.iloc[0:0].copy()

def bootstrap_contrast(donor,target,donor_days,target_days,stage,scales,removed,nrep=N_BOOT):
    rng=np.random.default_rng(SEED + {"raw":0,"geometry":101,"full":202}[stage])
    vals=[]; match_n=[]; adequate=0; failed=0
    for b in range(nrep):
        db=resample_rows(donor,donor_days,rng,f"D{b}_")
        tb=resample_rows(target,target_days,rng,f"T{b}_")
        if len(db)==0 or len(tb)==0:
            failed+=1; continue
        if stage=="raw":
            vals.append(float(tb.pnl_r.mean()-db.pnl_r.mean()))
            match_n.append(min(len(db),len(tb)))
            adequate+=1
        else:
            p,m=match_nn(db,tb,stage,scales,removed)
            if len(p)==0:
                failed+=1; continue
            vals.append(matched_delta(db,tb,p)); match_n.append(len(p))
            if m["support_class"]=="ADEQUATE":
                adequate+=1
    a=np.asarray(vals,float)
    return {
        "replications_requested":int(nrep),"successful":int(len(a)),"failed":int(failed),
        "adequate_support_replications":int(adequate),
        "adequate_fraction":float(adequate/nrep),
        "ci_low":float(np.quantile(a,.025)) if len(a) else None,
        "ci_high":float(np.quantile(a,.975)) if len(a) else None,
        "bootstrap_mean":float(np.mean(a)) if len(a) else None,
        "matched_n_median":float(np.median(match_n)) if match_n else None,
        "matched_n_p10":float(np.quantile(match_n,.10)) if match_n else None,
        "matched_n_p90":float(np.quantile(match_n,.90)) if match_n else None,
        "unstable":bool(adequate/nrep<0.90)
    }

def ci_interpret(ci):
    lo,hi=ci["ci_low"],ci["ci_high"]
    if lo is None:return "INCONCLUSIVE"
    if hi < -ECON:return "MATERIAL_2026_DETERIORATION"
    if lo>=-ECON and hi<=ECON:return "PRACTICAL_EQUIVALENCE"
    if (hi<0 or lo>0) and lo>=-ECON and hi<=ECON:return "STATISTICALLY_DIFFERENT_ECON_SMALL"
    return "INCONCLUSIVE"

def contrast(donor,target,donor_days,target_days,name,scales,removed):
    raw=float(target.pnl_r.mean()-donor.pnl_r.mean())
    raw_boot=bootstrap_contrast(donor,target,donor_days,target_days,"raw",scales,removed)
    gp,gm=match_nn(donor,target,"geometry",scales,removed)
    gb,gbs=balance(donor,target,gp,"geometry")
    gd=matched_delta(donor,target,gp)
    gboot=bootstrap_contrast(donor,target,donor_days,target_days,"geometry",scales,removed)
    fp,fm=match_nn(donor,target,"full",scales,removed)
    fb,fbs=balance(donor,target,fp,"full")
    fd=matched_delta(donor,target,fp)
    fboot=bootstrap_contrast(donor,target,donor_days,target_days,"full",scales,removed)
    table=[
        {"contrast":name,"stage":"Raw","donor_n":int(len(donor)),"target_n":int(len(target)),
         "matched_n":None,"target_coverage":None,"donor_coverage":None,"support_class":"NA",
         "balance_class":"NA","max_abs_smd":None,"delta_2026_minus_donor":raw,
         "ci_low":raw_boot["ci_low"],"ci_high":raw_boot["ci_high"],"ci_interpretation":ci_interpret(raw_boot)},
        {"contrast":name,"stage":"Geometry matched","donor_n":int(len(donor)),"target_n":int(len(target)),
         "matched_n":gm["matched"],"target_coverage":gm["target_coverage"],"donor_coverage":gm["donor_coverage"],
         "support_class":gm["support_class"],"balance_class":gbs["balance_class"],"max_abs_smd":gbs["max_abs_smd"],
         "delta_2026_minus_donor":gd,"ci_low":gboot["ci_low"],"ci_high":gboot["ci_high"],"ci_interpretation":ci_interpret(gboot)},
        {"contrast":name,"stage":"Geometry + Composition","donor_n":int(len(donor)),"target_n":int(len(target)),
         "matched_n":fm["matched"],"target_coverage":fm["target_coverage"],"donor_coverage":fm["donor_coverage"],
         "support_class":fm["support_class"],"balance_class":fbs["balance_class"],"max_abs_smd":fbs["max_abs_smd"],
         "delta_2026_minus_donor":fd,"ci_low":fboot["ci_low"],"ci_high":fboot["ci_high"],"ci_interpretation":ci_interpret(fboot)}
    ]
    return {
        "name":name,"table":table,
        "geometry_pairs":gp,"full_pairs":fp,
        "geometry_balance":gb,"full_balance":fb,
        "geometry_meta":gm,"full_meta":fm,
        "raw_bootstrap":raw_boot,"geometry_bootstrap":gboot,"full_bootstrap":fboot,
        "raw_delta":raw,"geometry_delta":gd,"full_delta":fd
    }

class M1Path:
    def __init__(self,root):
        self.root=root
    @lru_cache(maxsize=256)
    def day(self,ds):
        y,m,_=ds.split("-")
        p=self.root/"m1"/y/m/(ds+".csv.gz")
        if not p.exists(): return pd.DataFrame(columns=["t","bo","bh","bl","bc"])
        return pd.read_csv(p,usecols=["t","bo","bh","bl","bc"]).sort_values("t")
    def slice(self,start,end):
        d0=pd.to_datetime(start,unit="ms",utc=True).normalize()
        d1=pd.to_datetime(max(start,end-1),unit="ms",utc=True).normalize()
        parts=[]
        for ts in pd.date_range(d0,d1,freq="D",tz="UTC"):
            g=self.day(ts.strftime("%Y-%m-%d"))
            if len(g): parts.append(g)
        if not parts:return pd.DataFrame(columns=["t","bo","bh","bl","bc"])
        q=pd.concat(parts,ignore_index=True)
        return q[(q.t>=start)&(q.t<end)].sort_values("t").reset_index(drop=True)

def first_touch(q,up,dn):
    ui=np.flatnonzero(q.bh.to_numpy(float)>=up)
    di=np.flatnonzero(q.bl.to_numpy(float)<=dn)
    u=int(ui[0]) if len(ui) else None
    d=int(di[0]) if len(di) else None
    return u,d

def path_features(trade,x,pathloader):
    start=int(trade.entry_t); end=int(trade.exit_available_t)
    q=pathloader.slice(start,end)
    entry=float(trade.entry_px); risk=float(trade.risk_px)
    if len(q)==0 or risk<=0:
        return {"signal_t":int(trade.signal_t),"path_available":False}
    highs=q.bh.to_numpy(float); lows=q.bl.to_numpy(float)
    mfe=(highs-entry)/risk; mae=(lows-entry)/risk
    i_mfe=int(np.nanargmax(mfe)); i_mae=int(np.nanargmin(mae))
    u05,d05=first_touch(q,entry+.5*risk,entry-.5*risk)
    u10,d10=first_touch(q,entry+1.0*risk,entry-1.0*risk)
    if u05 is None and d05 is None: first="NEITHER"
    elif u05 is None: first="MINUS_0_5R"
    elif d05 is None: first="PLUS_0_5R"
    elif u05<d05: first="PLUS_0_5R"
    elif d05<u05: first="MINUS_0_5R"
    else: first="AMBIGUOUS_SAME_M1"
    anchor_high=float(trade.anchor_high); anchor_low=float(trade.anchor_low)
    intra_idx=np.flatnonzero(lows<=anchor_high)
    anchor_idx=np.flatnonzero(lows<=anchor_low)
    # completed M5 close loss
    mask=(x.t>=start)&((x.t+300000)<=end)
    xm=x.loc[mask]
    closs=np.flatnonzero(xm.bc.to_numpy(float)<anchor_high)
    return {
        "signal_t":int(trade.signal_t),"path_available":True,
        "mae_r":float(np.nanmin(mae)),"mfe_r":float(np.nanmax(mfe)),
        "mae_before_mfe":bool(i_mae<i_mfe),"path_asymmetry":float(np.nanmax(mfe)-abs(np.nanmin(mae))),
        "reached_plus_0_5r":u05 is not None,"time_to_plus_0_5r":None if u05 is None else int(u05+1),
        "reached_minus_0_5r":d05 is not None,"time_to_minus_0_5r":None if d05 is None else int(d05+1),
        "reached_plus_1_0r":u10 is not None,"time_to_plus_1_0r":None if u10 is None else int(u10+1),
        "reached_minus_1_0r":d10 is not None,"time_to_minus_1_0r":None if d10 is None else int(d10+1),
        "first_half_r_direction":first,
        "reclaim_intrabar_recross":bool(len(intra_idx)),"time_to_reclaim_intrabar_recross":None if not len(intra_idx) else int(intra_idx[0]+1),
        "reclaim_close_loss":bool(len(closs)),"time_to_reclaim_close_loss":None if not len(closs) else int(closs[0]+1)*5,
        "anchor_recross":bool(len(anchor_idx)),"time_to_anchor_recross":None if not len(anchor_idx) else int(anchor_idx[0]+1),
        "time_to_exit":int(len(q)),
        "exit_kind":str(trade.exit_kind),
    }

def path_pair_summary(donor,target,pairs,path_df,nrep=N_BOOT):
    p=path_df.set_index("signal_t")
    rows=[]
    for pr in pairs.itertuples(index=False):
        ts=int(pr.target_signal_t); ds=int(pr.donor_signal_t)
        if ts not in p.index or ds not in p.index: continue
        tr=p.loc[ts]; dr=p.loc[ds]
        if isinstance(tr,pd.DataFrame):tr=tr.iloc[0]
        if isinstance(dr,pd.DataFrame):dr=dr.iloc[0]
        if not bool(tr.path_available) or not bool(dr.path_available):continue
        rows.append({"target_signal_t":ts,"donor_signal_t":ds,
                     "target_day":pd.to_datetime(ts,unit="ms",utc=True).strftime("%Y-%m-%d"),
                     "t":tr,"d":dr})
    continuous=["mae_r","mfe_r","path_asymmetry","time_to_exit"]
    binary=["mae_before_mfe","reclaim_intrabar_recross","reclaim_close_loss","anchor_recross",
            "reached_plus_0_5r","reached_minus_0_5r","reached_plus_1_0r","reached_minus_1_0r"]
    rec=[]
    rng=np.random.default_rng(SEED+707)
    for v in continuous+binary:
        diffs=[]; days=[]
        for rr in rows:
            a=rr["t"][v]; b=rr["d"][v]
            if pd.isna(a) or pd.isna(b):continue
            diffs.append(float(a)-float(b)); days.append(rr["target_day"])
        if not diffs:continue
        arr=np.asarray(diffs,float)
        # block bootstrap paired differences by target trading-day order
        dd=pd.DataFrame({"day":days,"diff":arr})
        dayseq=sorted(dd.day.unique())
        boots=[]
        for _ in range(nrep):
            chosen=moving_block_days(dayseq,rng)
            vals=[]
            for day in chosen:
                vals.extend(dd.loc[dd.day==day,"diff"].tolist())
            if vals:boots.append(float(np.mean(vals)))
        ba=np.asarray(boots,float)
        rec.append({"metric":v,"n_pairs":int(len(arr)),"target_minus_donor":float(arr.mean()),
                    "ci_low":float(np.quantile(ba,.025)) if len(ba) else None,
                    "ci_high":float(np.quantile(ba,.975)) if len(ba) else None})
    return pd.DataFrame(rec),len(rows)

def composition_table(df):
    periods=["2023","2024","2025_full","2025_jan_sep","2026_jan_sep"]
    rows=[]
    for p in periods:
        g=df[period_mask(df,p)]
        base={"period":p,"n":int(len(g))}
        for v in ["entry_distance_anchor_atr","entry_rr","entry_spread_r","bars_from_anchor",
                  "signed_coherence_24h","expansion_level","expansion_persistence","state_distance"]:
            base[v+"_mean"]=float(g[v].mean()) if len(g) else np.nan
            base[v+"_median"]=float(g[v].median()) if len(g) else np.nan
        base["novel_q95_frac"]=float(g.state_novel_train_q95.mean()) if len(g) else np.nan
        for st in [0,4,5]:
            base[f"state_{st}_frac"]=float((g.state_id==st).mean()) if len(g) else np.nan
        for s in ["S0","S1","S2","S3"]:
            base[f"session_{s}_frac"]=float((g.session_bucket_utc==s).mean()) if len(g) else np.nan
        rows.append(base)
    return pd.DataFrame(rows)

def monthly_table(primary):
    q=primary.copy()
    q["month"]=pd.to_datetime(q.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m")
    return q.groupby("month").agg(n=("pnl_r","size"),total_r=("pnl_r","sum"),mean_r=("pnl_r","mean")).reset_index()

def leave_one_month_out(donor,target,scales,removed):
    months=sorted(set(donor.month.unique())|set(target.month.unique()))
    rows=[]
    for m in months:
        d=donor[donor.month!=m].copy(); t=target[target.month!=m].copy()
        p,meta=match_nn(d,t,"full",scales,removed)
        bal,bm=balance(d,t,p,"full")
        rows.append({"excluded_month":m,"matched":meta["matched"],"target_coverage":meta["target_coverage"],
                     "support_class":meta["support_class"],"balance_class":bm["balance_class"],
                     "delta":matched_delta(d,t,p)})
    return pd.DataFrame(rows)

def state_stratified(donor,target,pairs):
    if len(pairs)==0:return pd.DataFrame()
    dm=donor.set_index("row_id")
    tm=target.set_index("row_id")
    rows=[]
    for st in [0,4,5]:
        sub=pairs[[int(tm.loc[r].state_id)==st for r in pairs.target_row_id]]
        if len(sub)<10:continue
        rows.append({"state_id":st,"n_pairs":int(len(sub)),"delta":matched_delta(donor,target,sub)})
    return pd.DataFrame(rows)

def novelty_sensitivity(donor,target,scales,removed):
    d=donor[~donor.state_novel_train_q95].copy()
    t=target[~target.state_novel_train_q95].copy()
    p,m=match_nn(d,t,"full",scales,removed)
    b,bm=balance(d,t,p,"full")
    return {"donor_n":len(d),"target_n":len(t),"matched":m["matched"],"target_coverage":m["target_coverage"],
            "support_class":m["support_class"],"balance_class":bm["balance_class"],"delta":matched_delta(d,t,p)}

def classify(primary,lomo,path_summary):
    raw=primary["raw_delta"]; geom=primary["geometry_delta"]; full=primary["full_delta"]
    gm=primary["geometry_meta"]; fm=primary["full_meta"]
    gb=primary["geometry_balance_summary"]; fb=primary["full_balance_summary"]
    gci=ci_interpret(primary["geometry_bootstrap"])
    fci=ci_interpret(primary["full_bootstrap"])
    robust_month=True
    if len(lomo):
        robust_month=bool((lomo.delta<-ECON).all())
    # geometry explains most
    if raw<=-ECON and np.isfinite(geom):
        reduction=1-abs(geom)/max(abs(raw),1e-12)
        if reduction>=0.70 and gm["support_class"]=="ADEQUATE" and gb["balance_class"]!="FAILED" and gci=="PRACTICAL_EQUIVALENCE":
            return "GEOMETRY_EXPLAINS_MOST_OF_GAP",{"geometry_reduction":reduction}
    # composition explains most of remaining
    if geom<=-ECON and np.isfinite(full):
        reduction=1-abs(full)/max(abs(geom),1e-12)
        if reduction>=0.70 and fm["support_class"]=="ADEQUATE" and fb["balance_class"]!="FAILED" and fci=="PRACTICAL_EQUIVALENCE":
            return "OPPORTUNITY_COMPOSITION_EXPLAINS_MOST_OF_GAP",{"composition_reduction":reduction}
    if fm["support_class"]=="ADEQUATE" and fb["balance_class"]!="FAILED" and fci=="MATERIAL_2026_DETERIORATION":
        # descriptive coherence: at least 3 core path measures point adverse.
        pdict={r.metric:r.target_minus_donor for r in path_summary.itertuples(index=False)} if len(path_summary) else {}
        adverse=[
            pdict.get("mae_r",0)<0,
            pdict.get("mfe_r",0)<0,
            pdict.get("path_asymmetry",0)<0,
            pdict.get("reclaim_close_loss",0)>0,
            pdict.get("anchor_recross",0)>0
        ]
        if sum(adverse)>=3 and robust_month:
            return "CONDITIONAL_PATH_GAP_REMAINS",{"adverse_path_core_count":int(sum(adverse)),"month_robust":True}
    return "INCONCLUSIVE",{"geometry_ci":gci,"full_ci":fci,"month_robust":robust_month}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    print("rebuilding corrected causal context",flush=True)
    m5,m15,h1,_=audit.aggregate_all(ROOT)
    x,h=audit.build_context(m5,m15,h1)
    xs,state_pipe=audit.fit_states(x)
    h1ctx,hmeta=build_h1_context(h)
    state_dist,state_q95=state_distance_lookup(xs,state_pipe)

    events=pd.read_csv(AUDIT_RUN/"swing_corrected_events.csv")
    permission=pd.read_csv(AUDIT_RUN/"swing_permission_full_event_stream.csv")
    shadow=pd.read_csv(AUDIT_RUN/"swing_corrected_shadow_trades.csv")
    live=pd.read_csv(AUDIT_RUN/"swing_corrected_live_trades.csv")

    enriched=enrich_events(events,x,h1ctx,state_dist,state_q95,permission,shadow,live)
    primary=build_primary(shadow,enriched)
    # exact PnL is from corrected shadow artifact
    primary["trading_day"]=pd.to_datetime(primary.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m-%d")
    primary["month"]=pd.to_datetime(primary.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m")

    scales,removed=train_scales(enriched)
    scale_payload={"source_population":"all state-eligible Swing events 2018-2022","scales":scales,
                   "removed_zero_iqr":removed,"state_distance_train_q95":state_q95,**hmeta}
    (OUT/"train_matching_scales.json").write_text(json.dumps(scale_payload,indent=2),encoding="utf-8")

    # Composition tables
    comp_primary=composition_table(primary)
    comp_events=composition_table(enriched)
    comp_primary.assign(sample="PRIMARY_SHADOW").to_csv(OUT/"preentry_composition.csv",index=False)
    comp_events.assign(sample="ALL_EVENTS").to_csv(OUT/"supporting_event_composition.csv",index=False)
    monthly_table(primary).to_csv(OUT/"monthly_concentration.csv",index=False)

    # Sample reconciliation
    perm_on=enriched.permission_on.fillna(False)
    executable=enriched.label_valid.fillna(False)
    recon=pd.DataFrame([
        {"sample":"ALL_EVENTS","n":len(enriched),"permission_on":int(perm_on.sum()),
         "execution_valid_resolved":int(executable.sum()),
         "invalid_or_censored":int((~executable).sum()),
         "permission_and_valid":int((perm_on&executable).sum()),
         "shadow_executed":int(enriched.in_shadow.sum()),
         "permission_valid_not_shadow_overlap_or_suppressed":int((perm_on&executable&~enriched.in_shadow).sum())},
        {"sample":"PRIMARY_SHADOW","n":len(primary),"permission_on":len(primary),
         "execution_valid_resolved":len(primary),"invalid_or_censored":0,
         "permission_and_valid":len(primary),"shadow_executed":len(primary),
         "permission_valid_not_shadow_overlap_or_suppressed":0}
    ])
    recon.to_csv(OUT/"sample_reconciliation.csv",index=False)

    # primary contrasts
    p2025=primary[period_mask(primary,"2025_full")].copy()
    p25js=primary[period_mask(primary,"2025_jan_sep")].copy()
    p2026=primary[period_mask(primary,"2026_jan_sep")].copy()
    p2324=primary[period_mask(primary,"2023_2024")].copy()

    calendars={
      "2025_full":observed_market_days(m5,"2025-01-01","2026-01-01"),
      "2025_jan_sep":observed_market_days(m5,"2025-01-01","2025-10-01"),
      "2026_jan_sep":observed_market_days(m5,"2026-01-01","2026-10-01"),
      "2023_2024":observed_market_days(m5,"2023-01-01","2025-01-01")
    }

    print("primary counts",len(p2025),len(p25js),len(p2026),len(p2324),flush=True)
    c_primary=contrast(p2025,p2026,calendars["2025_full"],calendars["2026_jan_sep"],"2025_full_vs_2026_jan_sep",scales,removed)
    c_season=contrast(p25js,p2026,calendars["2025_jan_sep"],calendars["2026_jan_sep"],"2025_jan_sep_vs_2026_jan_sep",scales,removed)
    c_hist=contrast(p2324,p2026,calendars["2023_2024"],calendars["2026_jan_sep"],"2023_2024_vs_2026_jan_sep",scales,removed)

    stage=pd.DataFrame(c_primary["table"]+c_season["table"]+c_hist["table"])
    stage.to_csv(OUT/"stage_summary.csv",index=False)
    c_primary["geometry_pairs"].to_csv(OUT/"primary_geometry_matches.csv",index=False)
    c_primary["full_pairs"].to_csv(OUT/"primary_full_matches.csv",index=False)
    c_season["full_pairs"].to_csv(OUT/"calendar_balanced_matches.csv",index=False)
    c_hist["full_pairs"].to_csv(OUT/"historical_reference_matches.csv",index=False)

    balances=[]
    for cname,c in [("primary",c_primary),("seasonal",c_season),("historical",c_hist)]:
        for stage_name,key in [("geometry","geometry_balance"),("full","full_balance")]:
            q=c[key].copy()
            q["contrast"]=cname;q["stage"]=stage_name
            balances.append(q)
    pd.concat(balances,ignore_index=True).to_csv(OUT/"support_balance.csv",index=False)

    # Path metrics on all 2025/2026 primary shadow; matching interpretation uses primary full pairs.
    focus=pd.concat([p2025,p2026],ignore_index=True).drop_duplicates("signal_t")
    loader=M1Path(ROOT)
    pathrows=[]
    print("path analysis trades",len(focus),flush=True)
    for n,r in enumerate(focus.itertuples(index=False),1):
        pathrows.append(path_features(r,x,loader))
        if n%50==0: print("path",n,"/",len(focus),flush=True)
    path_df=pd.DataFrame(pathrows)
    path_df.to_csv(OUT/"path_outcomes.csv",index=False)
    path_summary,path_pair_n=path_pair_summary(p2025,p2026,c_primary["full_pairs"],path_df)
    path_summary.to_csv(OUT/"path_matched_summary.csv",index=False)

    # Mandatory robustness
    lomo=leave_one_month_out(p2025,p2026,scales,removed)
    lomo.to_csv(OUT/"leave_one_month_out.csv",index=False)
    state_stratified(p2025,p2026,c_primary["full_pairs"]).to_csv(OUT/"state_stratified_matches.csv",index=False)
    novelty=novelty_sensitivity(p2025,p2026,scales,removed)

    # Supporting all-event analysis using resolved executable event outcomes only.
    sup=enriched[enriched.label_valid & np.isfinite(enriched.label_pnl_r)].copy()
    sup=sup.rename(columns={"label_pnl_r":"pnl_r"})
    sup["row_id"]=["E%06d"%i for i in range(len(sup))]
    e2025=sup[period_mask(sup,"2025_full")].copy()
    e25js=sup[period_mask(sup,"2025_jan_sep")].copy()
    e2026=sup[period_mask(sup,"2026_jan_sep")].copy()
    e2324=sup[period_mask(sup,"2023_2024")].copy()
    se_primary=contrast(e2025,e2026,calendars["2025_full"],calendars["2026_jan_sep"],"EVENT_2025_vs_2026",scales,removed)
    se_season=contrast(e25js,e2026,calendars["2025_jan_sep"],calendars["2026_jan_sep"],"EVENT_2025JS_vs_2026",scales,removed)
    se_hist=contrast(e2324,e2026,calendars["2023_2024"],calendars["2026_jan_sep"],"EVENT_2324_vs_2026",scales,removed)
    pd.DataFrame(se_primary["table"]+se_season["table"]+se_hist["table"]).to_csv(OUT/"supporting_event_analysis.csv",index=False)

    # Health overlay, separate
    live_set=set(live.signal_t.astype(np.int64))
    hh=primary.copy()
    hh["health_live"]=hh.signal_t.isin(live_set)
    health_rows=[]
    for p in ["2025_full","2025_jan_sep","2026_jan_sep","2023_2024"]:
        g=hh[period_mask(hh,p)]
        health_rows.append({
          "period":p,"shadow_n":int(len(g)),"live_n":int(g.health_live.sum()),
          "live_exposure_fraction":float(g.health_live.mean()) if len(g) else np.nan,
          "shadow_total_r":float(g.pnl_r.sum()),"health_live_total_r":float(g.loc[g.health_live,"pnl_r"].sum()),
          "blocked_total_r":float(g.loc[~g.health_live,"pnl_r"].sum())
        })
    pd.DataFrame(health_rows).to_csv(OUT/"health_overlay_diagnostic.csv",index=False)

    # Decision classification
    c_primary["geometry_balance_summary"]={"balance_class":
        "GOOD" if c_primary["geometry_balance"].abs_smd.max()<=.10 else ("MARGINAL" if c_primary["geometry_balance"].abs_smd.max()<=.15 else "FAILED")}
    c_primary["full_balance_summary"]={"balance_class":
        "GOOD" if c_primary["full_balance"].abs_smd.max()<=.10 else ("MARGINAL" if c_primary["full_balance"].abs_smd.max()<=.15 else "FAILED")}
    cls,cls_detail=classify(c_primary,lomo,path_summary)

    boot={
      "primary":{"raw":c_primary["raw_bootstrap"],"geometry":c_primary["geometry_bootstrap"],"full":c_primary["full_bootstrap"]},
      "seasonal":{"raw":c_season["raw_bootstrap"],"geometry":c_season["geometry_bootstrap"],"full":c_season["full_bootstrap"]},
      "historical":{"raw":c_hist["raw_bootstrap"],"geometry":c_hist["geometry_bootstrap"],"full":c_hist["full_bootstrap"]}
    }
    (OUT/"bootstrap_summary.json").write_text(json.dumps(boot,indent=2),encoding="utf-8")

    summary={
      "scope":"Swing Opportunity Composition vs Conditional Path v0.1",
      "protocol_commit":"5ad2a38b51f765946793e1b2a1ed1d781988e8b7",
      "pristine_forward_oos_read":False,
      "primary_population":"corrected Swing Shadow before Health",
      "supporting_population":"all state-eligible Swing decision events before Permission/overlap",
      "economic_margin_r":ECON,
      "primary_classification":cls,"classification_detail":cls_detail,
      "primary_stage_table":c_primary["table"],
      "seasonal_stage_table":c_season["table"],
      "historical_stage_table":c_hist["table"],
      "primary_support":{"geometry":c_primary["geometry_meta"],"full":c_primary["full_meta"]},
      "primary_balance":{"geometry":c_primary["geometry_balance_summary"],"full":c_primary["full_balance_summary"]},
      "path_matched_pairs":path_pair_n,
      "path_summary":path_summary.to_dict(orient="records"),
      "novelty_sensitivity":novelty,
      "leave_one_month_out":lomo.to_dict(orient="records"),
      "sample_reconciliation":recon.to_dict(orient="records"),
      "health_overlay":health_rows,
      "train_scales":scale_payload
    }
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")

    print("PRIMARY_TABLE",json.dumps(c_primary["table"]),flush=True)
    print("SEASONAL_TABLE",json.dumps(c_season["table"]),flush=True)
    print("HIST_TABLE",json.dumps(c_hist["table"]),flush=True)
    print("PATH",path_summary.to_json(orient="records"),flush=True)
    print("LOMO",lomo.to_json(orient="records"),flush=True)
    print("CLASSIFICATION",cls,json.dumps(cls_detail),flush=True)

if __name__=="__main__":
    main()
