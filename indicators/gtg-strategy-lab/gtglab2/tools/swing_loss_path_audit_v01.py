from pathlib import Path
from functools import lru_cache
import json, math, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
EXP1=GTG/"runs"/"measurement-execution-audit-v01"
OUT=GTG/"runs"/"swing-loss-path-audit-v01"

sys.path.insert(0,str(TOOLS))
import measurement_execution_audit_v01 as audit

N_BOOT=2000
BLOCK_DAYS=5
SEED=52052
TIMEOUT_M5=864

class M1Path:
    def __init__(self,root):
        self.root=Path(root)
    @lru_cache(maxsize=512)
    def day(self,ds):
        y,m,_=ds.split("-")
        p=self.root/"m1"/y/m/(ds+".csv.gz")
        if not p.exists():
            return pd.DataFrame(columns=["t","bo","bh","bl","bc"])
        return pd.read_csv(p,usecols=["t","bo","bh","bl","bc"]).sort_values("t")
    def slice(self,start,end):
        start=int(start); end=int(end)
        if end<=start:
            return pd.DataFrame(columns=["t","bo","bh","bl","bc"])
        d0=pd.to_datetime(start,unit="ms",utc=True).normalize()
        d1=pd.to_datetime(end-1,unit="ms",utc=True).normalize()
        parts=[]
        for ts in pd.date_range(d0,d1,freq="D",tz="UTC"):
            g=self.day(ts.strftime("%Y-%m-%d"))
            if len(g): parts.append(g)
        if not parts:
            return pd.DataFrame(columns=["t","bo","bh","bl","bc"])
        q=pd.concat(parts,ignore_index=True)
        return q[(q.t>=start)&(q.t<end)].sort_values("t").reset_index(drop=True)

def first_touch_index(q,level,direction):
    if len(q)==0:return None
    if direction=="up":
        a=np.flatnonzero(q.bh.to_numpy(float)>=level)
    else:
        a=np.flatnonzero(q.bl.to_numpy(float)<=level)
    return int(a[0]) if len(a) else None

def order_label(up_idx,dn_idx):
    if up_idx is None and dn_idx is None:return "NEITHER"
    if up_idx is None:return "ONLY_MINUS"
    if dn_idx is None:return "ONLY_PLUS"
    if up_idx<dn_idx:return "PLUS_FIRST"
    if dn_idx<up_idx:return "MINUS_FIRST"
    return "SAME_M1_AMBIGUOUS"

def normalized_exit_kind(kind):
    k=str(kind).upper()
    if "AMBIGUOUS" in k:return "AMBIGUOUS_STOP_FIRST"
    if k=="TARGET":return "TARGET"
    if k=="STOP":return "STOP"
    if "TARGET_GAP" in k:return "TARGET_GAP"
    if "STOP_GAP" in k:return "STOP_GAP"
    if "TIMEOUT" in k:return "TIMEOUT"
    return "OTHER"

def segment_for_year(y):
    if y<=2022:return "2018-2022"
    if y<=2024:return "2023-2024"
    return "2025-2026"

def m5_completed_slice(m5,start,end):
    close_t=m5.t.astype(np.int64)+300000
    return m5[(m5.t>=int(start))&(close_t<=int(end))].copy()

def trade_path_features(tr,m5,m5_t_to_idx,path):
    entry_t=int(tr.entry_t)
    exit_t=int(tr.exit_available_t)
    entry=float(tr.entry_px); risk=float(tr.risk_px)
    anchor_low=float(tr.anchor_low); anchor_high=float(tr.anchor_high)
    row={
        "signal_t":int(tr.signal_t),"entry_t":entry_t,"exit_available_t":exit_t,
        "year":int(tr.year),"segment":segment_for_year(int(tr.year)),
        "state_id":int(tr.state_id),"entry_px":entry,"risk_px":risk,
        "anchor_low":anchor_low,"anchor_high":anchor_high,
        "stop_px":float(tr.stop_px),"target_px":float(tr.target_px),
        "pnl_r":float(tr.pnl_r),"exit_kind":str(tr.exit_kind),
        "exit_class":normalized_exit_kind(tr.exit_kind),
        "entry_rr":float(tr.entry_rr),
    }
    if risk<=0 or entry_t not in m5_t_to_idx:
        row.update({"pre_path_available":False,"horizon_complete":False})
        return row

    entry_idx=m5_t_to_idx[entry_t]
    horizon_idx=entry_idx+TIMEOUT_M5
    if horizon_idx<len(m5):
        horizon_end_t=int(m5.t.iloc[horizon_idx])
        horizon_complete=True
    else:
        horizon_end_t=int(m5.t.iloc[-1]+300000)
        horizon_complete=False
    row["horizon_end_t"]=horizon_end_t
    row["horizon_complete"]=bool(horizon_complete)

    q=path.slice(entry_t,exit_t)
    if len(q)==0:
        row["pre_path_available"]=False
        return row
    row["pre_path_available"]=True

    bh=q.bh.to_numpy(float); bl=q.bl.to_numpy(float)
    mfe=(bh-entry)/risk; mae=(bl-entry)/risk
    i_mfe=int(np.nanargmax(mfe)); i_mae=int(np.nanargmin(mae))
    row.update({
        "pre_exit_mfe_r":float(np.nanmax(mfe)),
        "pre_exit_mae_r":float(np.nanmin(mae)),
        "pre_exit_path_asymmetry":float(np.nanmax(mfe)-abs(np.nanmin(mae))),
        "mfe_m1_t":int(q.t.iloc[i_mfe]),
        "mae_m1_t":int(q.t.iloc[i_mae]),
        "observed_min_to_mfe":int(i_mfe+1),
        "observed_min_to_mae":int(i_mae+1),
        "mfe_before_mae":bool(i_mfe<i_mae),
        "mae_before_mfe":bool(i_mae<i_mfe),
        "extrema_same_m1":bool(i_mfe==i_mae),
    })

    touches={}
    for rlev in [0.5,1.0,2.0]:
        idx=first_touch_index(q,entry+rlev*risk,"up")
        touches[f"plus_{str(rlev).replace('.','_')}"]=idx
        row[f"reached_plus_{str(rlev).replace('.','_')}r_pre_exit"]=idx is not None
        row[f"observed_min_to_plus_{str(rlev).replace('.','_')}r"]=None if idx is None else int(idx+1)
    for rlev in [0.5,1.0]:
        idx=first_touch_index(q,entry-rlev*risk,"down")
        touches[f"minus_{str(rlev).replace('.','_')}"]=idx
        row[f"reached_minus_{str(rlev).replace('.','_')}r_pre_exit"]=idx is not None
        row[f"observed_min_to_minus_{str(rlev).replace('.','_')}r"]=None if idx is None else int(idx+1)

    row["half_r_order"]=order_label(touches["plus_0_5"],touches["minus_0_5"])
    row["one_r_order"]=order_label(touches["plus_1_0"],touches["minus_1_0"])

    d05=touches["minus_0_5"]
    if d05 is None:
        pre_hi=bh
        amb=False
    else:
        pre_hi=bh[:d05]
        amb=bool(bh[d05]>=(entry+0.5*risk))
    if len(pre_hi):
        row["progress_before_first_minus_0_5r"]=float(max(0.0,np.max((pre_hi-entry)/risk)))
    else:
        row["progress_before_first_minus_0_5r"]=0.0
    row["progress_before_minus_0_5r_order_ambiguous"]=amb

    d10=touches["minus_1_0"]
    if d10 is None:
        pre_hi10=bh
    else:
        pre_hi10=bh[:d10]
    row["progress_before_first_minus_1_0r"]=float(max(0.0,np.max((pre_hi10-entry)/risk))) if len(pre_hi10) else 0.0

    anchor_touch=first_touch_index(q,anchor_low,"down")
    row["anchor_touch_recross"]=anchor_touch is not None
    row["observed_min_to_anchor_touch_recross"]=None if anchor_touch is None else int(anchor_touch+1)

    xm=m5_completed_slice(m5,entry_t,exit_t)
    if len(xm):
        closes=xm.bc.to_numpy(float)
        reclaim_idxs=np.flatnonzero(closes<anchor_high)
        anchor_close_idxs=np.flatnonzero(closes<anchor_low)
        row["reclaim_close_loss"]=bool(len(reclaim_idxs))
        row["m5_bars_to_reclaim_close_loss"]=None if not len(reclaim_idxs) else int(reclaim_idxs[0]+1)
        row["reclaim_close_loss_count"]=int((closes<anchor_high).sum())
        row["reclaim_close_loss_fraction"]=float((closes<anchor_high).mean())
        row["anchor_close_break"]=bool(len(anchor_close_idxs))
        row["m5_bars_to_anchor_close_break"]=None if not len(anchor_close_idxs) else int(anchor_close_idxs[0]+1)
        row["completed_m5_bars_pre_exit"]=int(len(xm))
    else:
        row.update({
            "reclaim_close_loss":False,"m5_bars_to_reclaim_close_loss":None,
            "reclaim_close_loss_count":0,"reclaim_close_loss_fraction":np.nan,
            "anchor_close_break":False,"m5_bars_to_anchor_close_break":None,
            "completed_m5_bars_pre_exit":0
        })

    row["loss_archetype"]=""
    if float(tr.pnl_r)<0:
        if row["pre_exit_mfe_r"]<0.5:
            row["loss_archetype"]="NO_START"
        elif row["pre_exit_mfe_r"]<1.0:
            row["loss_archetype"]="STARTED_THEN_FADED"
        else:
            row["loss_archetype"]="STRONG_PROGRESS_FAILED"

    # Post-exit path is diagnostic only, non-target exits only.
    non_target=row["exit_class"] not in {"TARGET","TARGET_GAP"}
    row["post_exit_eligible"]=bool(non_target and horizon_complete and exit_t<horizon_end_t)
    if row["post_exit_eligible"]:
        qp=path.slice(exit_t,horizon_end_t)
        if len(qp):
            pbh=qp.bh.to_numpy(float); pbl=qp.bl.to_numpy(float)
            row["post_exit_path_available"]=True
            row["post_exit_mfe_r"]=float(np.nanmax((pbh-entry)/risk))
            row["post_exit_mae_r"]=float(np.nanmin((pbl-entry)/risk))
            levels={
                "entry":entry,
                "plus_0_5r":entry+0.5*risk,
                "plus_1_0r":entry+1.0*risk,
                "plus_2_0r":entry+2.0*risk,
                "original_target":float(tr.target_px)
            }
            for name,level in levels.items():
                idx=first_touch_index(qp,level,"up")
                row[f"later_reached_{name}"]=idx is not None
                row[f"observed_min_after_exit_to_{name}"]=None if idx is None else int(idx+1)
        else:
            row["post_exit_path_available"]=False
    else:
        row["post_exit_path_available"]=False
    return row

def qstats(s):
    x=pd.Series(s).dropna().astype(float)
    if not len(x):
        return {"n":0,"mean":None,"median":None,"p10":None,"p25":None,"p75":None,"p90":None}
    return {
        "n":int(len(x)),"mean":float(x.mean()),"median":float(x.median()),
        "p10":float(x.quantile(.10)),"p25":float(x.quantile(.25)),
        "p75":float(x.quantile(.75)),"p90":float(x.quantile(.90))
    }

def summarize_group(g,label_type,label):
    losses=g[(g.pnl_r<0)&g.pre_path_available].copy()
    non_target_loss=losses[~losses.exit_class.isin(["TARGET","TARGET_GAP"])].copy()
    late=non_target_loss[non_target_loss.post_exit_eligible & non_target_loss.post_exit_path_available].copy()
    d={
        "group_type":label_type,"group":str(label),
        "n_trades":int(len(g)),"n_losses":int(len(losses)),
        "total_r":float(g.pnl_r.sum()) if len(g) else 0.0,
        "mean_r":float(g.pnl_r.mean()) if len(g) else None,
        "win_rate":float((g.pnl_r>0).mean()) if len(g) else None,
        "target_rate":float(g.exit_class.isin(["TARGET","TARGET_GAP"]).mean()) if len(g) else None,
        "stop_rate":float(g.exit_class.isin(["STOP","STOP_GAP","AMBIGUOUS_STOP_FIRST"]).mean()) if len(g) else None,
        "timeout_rate":float((g.exit_class=="TIMEOUT").mean()) if len(g) else None,
        "pre_mfe_median":float(g.pre_exit_mfe_r.median()) if len(g) else None,
        "pre_mae_median":float(g.pre_exit_mae_r.median()) if len(g) else None,
        "reclaim_loss_rate":float(g.reclaim_close_loss.mean()) if len(g) else None,
        "anchor_recross_rate":float(g.anchor_touch_recross.mean()) if len(g) else None,
        "loss_no_start_share":float((losses.loss_archetype=="NO_START").mean()) if len(losses) else None,
        "loss_started_faded_share":float((losses.loss_archetype=="STARTED_THEN_FADED").mean()) if len(losses) else None,
        "loss_strong_progress_failed_share":float((losses.loss_archetype=="STRONG_PROGRESS_FAILED").mean()) if len(losses) else None,
        "late_eligible_n":int(len(late)),
        "late_plus1_share":float(late.later_reached_plus_1_0r.mean()) if len(late) else None,
        "late_target_share":float(late.later_reached_original_target.mean()) if len(late) else None,
    }
    return d

def moving_block_days(days,rng):
    days=list(days); n=len(days)
    if n==0:return []
    starts=np.arange(max(1,n-BLOCK_DAYS+1))
    out=[]
    while len(out)<n:
        s=int(rng.choice(starts))
        out.extend(days[s:min(n,s+BLOCK_DAYS)])
    return out[:n]

def bootstrap_primary_shares(df):
    q=df.copy()
    q["entry_day"]=pd.to_datetime(q.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m-%d")
    q["is_loss"]=((q.pnl_r<0)&q.pre_path_available).astype(int)
    q["is_no_start"]=((q.pnl_r<0)&q.pre_path_available&(q.loss_archetype=="NO_START")).astype(int)
    q["is_strong"]=((q.pnl_r<0)&q.pre_path_available&(q.loss_archetype=="STRONG_PROGRESS_FAILED")).astype(int)
    late_mask=((q.pnl_r<0)&q.pre_path_available&
               (~q.exit_class.isin(["TARGET","TARGET_GAP"]))&
               q.post_exit_eligible&q.post_exit_path_available)
    q["is_late"]=late_mask.astype(int)
    q["is_late_plus1"]=(late_mask&q.later_reached_plus_1_0r.fillna(False)).astype(int)
    q["is_late_target"]=(late_mask&q.later_reached_original_target.fillna(False)).astype(int)

    daily=(q.groupby("entry_day",sort=True)[
        ["is_loss","is_no_start","is_strong","is_late","is_late_plus1","is_late_target"]
    ].sum().astype(int))
    days=daily.index.tolist()
    arr=daily.to_numpy(np.int64)
    pos={d:i for i,d in enumerate(days)}

    rng=np.random.default_rng(SEED)
    vals={"no_start":[],"strong_progress_failed":[],"late_plus1":[],"late_target":[]}
    for _ in range(N_BOOT):
        chosen=moving_block_days(days,rng)
        idx=np.fromiter((pos[d] for d in chosen),dtype=np.int64,count=len(chosen))
        s=arr[idx].sum(axis=0)
        loss_n,no_start_n,strong_n,late_n,late_plus1_n,late_target_n=[int(v) for v in s]
        if loss_n>0:
            vals["no_start"].append(no_start_n/loss_n)
            vals["strong_progress_failed"].append(strong_n/loss_n)
        if late_n>0:
            vals["late_plus1"].append(late_plus1_n/late_n)
            vals["late_target"].append(late_target_n/late_n)
    out={}
    for k,a in vals.items():
        x=np.asarray(a,float)
        out[k]={
            "successful":int(len(x)),
            "mean":float(np.mean(x)) if len(x) else None,
            "ci_low":float(np.quantile(x,.025)) if len(x) else None,
            "ci_high":float(np.quantile(x,.975)) if len(x) else None,
        }
    return out

def mechanism_classification(df,segment_summary):
    losses=df[(df.pnl_r<0)&df.pre_path_available].copy()
    no_start=float((losses.loss_archetype=="NO_START").mean()) if len(losses) else 0.0
    strong=float((losses.loss_archetype=="STRONG_PROGRESS_FAILED").mean()) if len(losses) else 0.0
    late=losses[(~losses.exit_class.isin(["TARGET","TARGET_GAP"]))&
                losses.post_exit_eligible&losses.post_exit_path_available]
    late1=float(late.later_reached_plus_1_0r.mean()) if len(late) else 0.0
    latet=float(late.later_reached_original_target.mean()) if len(late) else 0.0
    sm={r["group"]:r for r in segment_summary}
    A=(no_start>=.60 and all(sm[s]["loss_no_start_share"] is not None and sm[s]["loss_no_start_share"]>=.50 for s in ["2018-2022","2023-2024","2025-2026"]))
    B=(strong>=.30 and all(sm[s]["loss_strong_progress_failed_share"] is not None and sm[s]["loss_strong_progress_failed_share"]>=.25 for s in ["2018-2022","2023-2024","2025-2026"]))
    def stable_late(metric,full,threshold):
        if full<threshold:return False
        close=0
        for s in ["2018-2022","2023-2024","2025-2026"]:
            v=sm[s][metric]
            if v is not None and abs(v-full)<=.10:
                close+=1
        return close>=2
    C=(stable_late("late_plus1_share",late1,.30) or stable_late("late_target_share",latet,.15))
    passed=[name for name,ok in [("ENTRY_INITIATION_CANDIDATE",A),("PROFIT_RETENTION_CANDIDATE",B),("HORIZON_INVALIDATION_CANDIDATE",C)] if ok]
    final=passed[0] if len(passed)==1 else "MIXED_OR_NO_STABLE_PATTERN"
    return final,{
        "no_start_share_full":no_start,
        "strong_progress_failed_share_full":strong,
        "late_plus1_share_full":late1,
        "late_target_share_full":latet,
        "entry_initiation_pass":A,
        "profit_retention_pass":B,
        "horizon_invalidation_pass":C,
        "passed_candidates":passed
    }

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    trades=pd.read_csv(EXP1/"swing_corrected_shadow_trades.csv")
    events=pd.read_csv(EXP1/"swing_corrected_events.csv",usecols=["signal_t","anchor_high","anchor_low"])
    events=events.drop_duplicates("signal_t")
    q=trades.merge(events[["signal_t","anchor_high"]],on="signal_t",how="left",validate="one_to_one")
    if len(q)!=1177:
        raise RuntimeError(f"Expected 1177 corrected Swing Shadow trades, got {len(q)}")
    if q.anchor_high.isna().any():
        raise RuntimeError(f"Missing anchor_high for {int(q.anchor_high.isna().sum())} trades")

    features_path=OUT/"trade_path_features.csv"
    if features_path.exists():
        f=pd.read_csv(features_path)
        required={"signal_t","pre_path_available","horizon_complete","loss_archetype",
                  "later_reached_plus_1_0r","later_reached_original_target"}
        if len(f)!=1177 or not required.issubset(f.columns):
            raise RuntimeError("Existing path artifact failed resume validation")
        print("reuse validated trade_path_features.csv",flush=True)
    else:
        print("aggregate M5",flush=True)
        m5,_,_,_=audit.aggregate_all(ROOT)
        m5_t_to_idx={int(t):i for i,t in enumerate(m5.t.to_numpy(np.int64))}
        path=M1Path(ROOT)

        rows=[]
        q=q.sort_values("entry_t").reset_index(drop=True)
        for i,tr in enumerate(q.itertuples(index=False),1):
            rows.append(trade_path_features(tr,m5,m5_t_to_idx,path))
            if i%100==0:
                print("path trades",i,"/",len(q),flush=True)
        f=pd.DataFrame(rows)
        f.to_csv(features_path,index=False)

    recon=pd.DataFrame([
        {"metric":"corrected_swing_shadow_trades","value":int(len(q))},
        {"metric":"pre_path_available","value":int(f.pre_path_available.sum())},
        {"metric":"horizon_complete","value":int(f.horizon_complete.sum())},
        {"metric":"post_exit_eligible","value":int(f.post_exit_eligible.sum())},
        {"metric":"post_exit_path_available","value":int(f.post_exit_path_available.sum())},
        {"metric":"losses","value":int((f.pnl_r<0).sum())},
        {"metric":"targets","value":int(f.exit_class.isin(["TARGET","TARGET_GAP"]).sum())},
    ])
    recon.to_csv(OUT/"sample_reconciliation.csv",index=False)

    exit_rows=[]
    for k,g in f.groupby("exit_class",dropna=False):
        r=summarize_group(g,"exit_class",k)
        r.update({
            "pnl_median":float(g.pnl_r.median()),
            "mfe_p25":float(g.pre_exit_mfe_r.quantile(.25)),
            "mfe_p75":float(g.pre_exit_mfe_r.quantile(.75)),
            "mae_p25":float(g.pre_exit_mae_r.quantile(.25)),
            "mae_p75":float(g.pre_exit_mae_r.quantile(.75)),
            "median_elapsed_clock_min_to_exit":float(((g.exit_available_t-g.entry_t)/60000).median())
        })
        exit_rows.append(r)
    pd.DataFrame(exit_rows).to_csv(OUT/"exit_class_summary.csv",index=False)

    loss=f[(f.pnl_r<0)&f.pre_path_available].copy()
    loss_arch=(loss.groupby("loss_archetype").size().reset_index(name="n"))
    loss_arch["share"]=loss_arch.n/loss_arch.n.sum()
    loss_arch.to_csv(OUT/"loss_archetype_summary.csv",index=False)

    yearly=[summarize_group(g,"year",int(y)) for y,g in f.groupby("year")]
    yearly_df=pd.DataFrame(yearly)
    yearly_df.to_csv(OUT/"yearly_path_summary.csv",index=False)

    segments=["2018-2022","2023-2024","2025-2026"]
    segment_rows=[summarize_group(f[f.segment==s], "segment", s) for s in segments]
    segment_df=pd.DataFrame(segment_rows)
    segment_df.to_csv(OUT/"segment_path_summary.csv",index=False)

    order_rows=[]
    for scope,g in [("ALL",f),("LOSSES",loss)]:
        for metric in ["half_r_order","one_r_order"]:
            vc=g[metric].value_counts(dropna=False)
            for k,n in vc.items():
                order_rows.append({"scope":scope,"metric":metric,"order":str(k),"n":int(n),"share":float(n/len(g))})
    pd.DataFrame(order_rows).to_csv(OUT/"threshold_order_summary.csv",index=False)

    post_rows=[]
    for label,g in [("ALL_NON_TARGET",f[~f.exit_class.isin(["TARGET","TARGET_GAP"])]),
                    ("LOSING_NON_TARGET",loss[~loss.exit_class.isin(["TARGET","TARGET_GAP"])])]:
        z=g[g.post_exit_eligible&g.post_exit_path_available]
        post_rows.append({
            "scope":label,"n_total":int(len(g)),"n_post_eligible":int(len(z)),
            "later_entry_share":float(z.later_reached_entry.mean()) if len(z) else None,
            "later_plus_0_5r_share":float(z.later_reached_plus_0_5r.mean()) if len(z) else None,
            "later_plus_1_0r_share":float(z.later_reached_plus_1_0r.mean()) if len(z) else None,
            "later_plus_2_0r_share":float(z.later_reached_plus_2_0r.mean()) if len(z) else None,
            "later_target_share":float(z.later_reached_original_target.mean()) if len(z) else None,
            "post_exit_mfe_median":float(z.post_exit_mfe_r.median()) if len(z) else None,
        })
    for s in segments:
        g=loss[(loss.segment==s)&(~loss.exit_class.isin(["TARGET","TARGET_GAP"]))]
        z=g[g.post_exit_eligible&g.post_exit_path_available]
        post_rows.append({
            "scope":"LOSS_SEGMENT_"+s,"n_total":int(len(g)),"n_post_eligible":int(len(z)),
            "later_entry_share":float(z.later_reached_entry.mean()) if len(z) else None,
            "later_plus_0_5r_share":float(z.later_reached_plus_0_5r.mean()) if len(z) else None,
            "later_plus_1_0r_share":float(z.later_reached_plus_1_0r.mean()) if len(z) else None,
            "later_plus_2_0r_share":float(z.later_reached_plus_2_0r.mean()) if len(z) else None,
            "later_target_share":float(z.later_reached_original_target.mean()) if len(z) else None,
            "post_exit_mfe_median":float(z.post_exit_mfe_r.median()) if len(z) else None,
        })
    pd.DataFrame(post_rows).to_csv(OUT/"post_exit_recovery_summary.csv",index=False)

    prog_rows=[]
    for label,g in [("ALL",f),("LOSSES",loss)] + [(s,f[f.segment==s]) for s in segments]:
        st=qstats(g.loc[~g.progress_before_minus_0_5r_order_ambiguous,"progress_before_first_minus_0_5r"])
        prog_rows.append({"scope":label,**st,
                          "ambiguous_n":int(g.progress_before_minus_0_5r_order_ambiguous.sum())})
    pd.DataFrame(prog_rows).to_csv(OUT/"progress_before_adverse_summary.csv",index=False)

    timing_metrics=[
        "observed_min_to_mfe","observed_min_to_mae",
        "observed_min_to_plus_0_5r","observed_min_to_plus_1_0r",
        "observed_min_to_minus_0_5r","observed_min_to_minus_1_0r",
        "m5_bars_to_reclaim_close_loss","observed_min_to_anchor_touch_recross",
        "observed_min_after_exit_to_entry","observed_min_after_exit_to_plus_0_5r",
        "observed_min_after_exit_to_plus_1_0r","observed_min_after_exit_to_original_target"
    ]
    timing_rows=[]
    for scope,g in [("ALL",f),("LOSSES",loss)]:
        for metric in timing_metrics:
            if metric not in g.columns: continue
            x=pd.to_numeric(g[metric],errors="coerce").dropna()
            timing_rows.append({
                "scope":scope,"metric":metric,"n":int(len(x)),
                "median":float(x.median()) if len(x) else None,
                "p25":float(x.quantile(.25)) if len(x) else None,
                "p75":float(x.quantile(.75)) if len(x) else None,
                "p90":float(x.quantile(.90)) if len(x) else None,
            })
    pd.DataFrame(timing_rows).to_csv(OUT/"timing_summary.csv",index=False)

    boot=bootstrap_primary_shares(f)
    (OUT/"bootstrap_summary.json").write_text(json.dumps(boot,indent=2),encoding="utf-8")

    final_class,mechanism=mechanism_classification(f,segment_rows)
    summary={
        "scope":"Swing Loss-Path Audit v0.1",
        "protocol_commit":"7b9d29b",
        "base_commit":"18e4865",
        "pristine_forward_oos_read":False,
        "corrected_swing_shadow_n":int(len(f)),
        "pre_path_available_n":int(f.pre_path_available.sum()),
        "horizon_complete_n":int(f.horizon_complete.sum()),
        "loss_n":int((f.pnl_r<0).sum()),
        "total_r_check":float(f.pnl_r.sum()),
        "exit_class_counts":{str(k):int(v) for k,v in f.exit_class.value_counts().to_dict().items()},
        "full_summary":summarize_group(f,"full","ALL"),
        "segment_summary":segment_rows,
        "yearly_summary":yearly,
        "bootstrap":boot,
        "mechanism_classification":final_class,
        "mechanism_detail":mechanism,
        "post_exit_summary":post_rows,
    }
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2,default=str),encoding="utf-8")
    print("CLASSIFICATION",final_class,json.dumps(mechanism),flush=True)
    print("FULL",json.dumps(summary["full_summary"]),flush=True)
    print("POST",json.dumps(post_rows),flush=True)

if __name__=="__main__":
    main()
