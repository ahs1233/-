from pathlib import Path
import json, sys, warnings, math
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.exceptions import ConvergenceWarning

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
EXP1=GTG/"runs"/"measurement-execution-audit-v01"
EXP2=GTG/"runs"/"swing-opportunity-path-diagnostic-v01"
OUT=GTG/"runs"/"overlap-population-contrast-v01"
sys.path.insert(0,str(TOOLS))

import measurement_execution_audit_v01 as audit
import swing_opportunity_path_diagnostic_v01 as exp2
import common_support_failure_audit_v01 as exp3

SEED=42051
N_BOOT=2000
BLOCK_DAYS=5
ECON=0.05
MAX_ITER=2000

CONT=[
    "entry_distance_anchor_atr",
    "entry_spread_r",
    "bars_from_anchor",
    "signed_coherence_24h",
    "expansion_level",
    "expansion_persistence",
]
DESIGN=[
    "z_entry_distance_anchor_atr",
    "z_entry_spread_r",
    "z_bars_from_anchor",
    "z_signed_coherence_24h",
    "z_expansion_level",
    "z_expansion_persistence",
    "state_4","state_5",
    "session_S1","session_S2","session_S3",
]

def period_mask(df,name):
    dt=pd.to_datetime(df.entry_t,unit="ms",utc=True)
    if name=="2025_full":
        return (dt>=pd.Timestamp("2025-01-01",tz="UTC"))&(dt<pd.Timestamp("2026-01-01",tz="UTC"))
    if name=="2025_jan_sep":
        return (dt>=pd.Timestamp("2025-01-01",tz="UTC"))&(dt<pd.Timestamp("2025-10-01",tz="UTC"))
    if name=="2026_jan_sep":
        return (dt>=pd.Timestamp("2026-01-01",tz="UTC"))&(dt<pd.Timestamp("2026-10-01",tz="UTC"))
    raise KeyError(name)

def load_scales():
    obj=json.loads((EXP2/"train_matching_scales.json").read_text(encoding="utf-8"))
    return obj["scales"]

def build_design(df,scales):
    q=df.copy()
    complete=np.ones(len(q),dtype=bool)
    for v in CONT+["state_id","session_bucket_utc"]:
        complete &= q[v].notna().to_numpy()
    q=q.loc[complete].copy().reset_index(drop=True)
    for v in CONT:
        s=scales[v]
        iqr=float(s["iqr"])
        if not np.isfinite(iqr) or iqr<=0:
            raise RuntimeError(f"Frozen TRAIN IQR invalid for {v}")
        q["z_"+v]=(q[v].astype(float)-float(s["median"]))/iqr
    q["state_4"]=(q.state_id.astype(int)==4).astype(float)
    q["state_5"]=(q.state_id.astype(int)==5).astype(float)
    q["session_S1"]=(q.session_bucket_utc.astype(str)=="S1").astype(float)
    q["session_S2"]=(q.session_bucket_utc.astype(str)=="S2").astype(float)
    q["session_S3"]=(q.session_bucket_utc.astype(str)=="S3").astype(float)
    return q, int((~complete).sum())

def fit_propensity(donor,target,scales):
    d=donor.copy(); t=target.copy()
    d["T"]=0; t["T"]=1
    combo=pd.concat([d,t],ignore_index=True)
    combo,missing=build_design(combo,scales)
    if missing:
        # caller reconciles exclusions; model uses complete cases only.
        pass
    X=combo[DESIGN].to_numpy(float)
    y=combo.T.to_numpy(int) if False else combo["T"].to_numpy(int)
    model=LogisticRegression(
        penalty=None,solver="lbfgs",fit_intercept=True,
        max_iter=MAX_ITER,tol=1e-10,class_weight=None
    )
    with warnings.catch_warnings(record=True) as ws:
        warnings.simplefilter("always")
        model.fit(X,y)
    conv=[w for w in ws if issubclass(w.category,ConvergenceWarning)]
    converged=(len(conv)==0 and int(np.max(model.n_iter_))<MAX_ITER)
    e=model.predict_proba(X)[:,1]
    clipped=((e<1e-12)|(e>1-1e-12))
    e=np.clip(e,1e-12,1-1e-12)
    combo["propensity"]=e
    combo["overlap_weight"]=np.where(combo.T if False else combo["T"].to_numpy(int)==1,1-e,e)
    auc=float(roc_auc_score(y,e))
    coefs=[{"term":"intercept","coefficient":float(model.intercept_[0])}]
    coefs.extend({"term":name,"coefficient":float(c)} for name,c in zip(DESIGN,model.coef_[0]))
    meta={
        "converged":bool(converged),
        "n_iter":int(np.max(model.n_iter_)),
        "convergence_warnings":int(len(conv)),
        "probability_clipped_n":int(clipped.sum()),
        "auc_period_classification":auc,
        "complete_case_n":int(len(combo)),
    }
    return combo,model,coefs,meta

def wmean(x,w):
    x=np.asarray(x,float); w=np.asarray(w,float)
    s=w.sum()
    return float(np.sum(x*w)/s) if s>0 else np.nan

def ess(w):
    w=np.asarray(w,float)
    den=np.sum(w*w)
    return float((w.sum()**2)/den) if den>0 else 0.0

def weighted_ecdf_gap(a,wa,b,wb):
    a=np.asarray(a,float); b=np.asarray(b,float)
    wa=np.asarray(wa,float); wb=np.asarray(wb,float)
    ok1=np.isfinite(a)&np.isfinite(wa); ok2=np.isfinite(b)&np.isfinite(wb)
    a=a[ok1]; wa=wa[ok1]; b=b[ok2]; wb=wb[ok2]
    if not len(a) or not len(b) or wa.sum()<=0 or wb.sum()<=0:
        return np.nan
    vals=np.unique(np.concatenate([a,b]))
    oa=np.argsort(a); ob=np.argsort(b)
    a=a[oa]; wa=wa[oa]/wa.sum(); b=b[ob]; wb=wb[ob]/wb.sum()
    ca=np.cumsum(wa); cb=np.cumsum(wb)
    ia=np.searchsorted(a,vals,side="right")-1
    ib=np.searchsorted(b,vals,side="right")-1
    Fa=np.where(ia>=0,ca[np.maximum(ia,0)],0.0)
    Fb=np.where(ib>=0,cb[np.maximum(ib,0)],0.0)
    return float(np.max(np.abs(Fa-Fb)))

def balance_table(combo,label):
    d=combo[combo.T if False else combo["T"]==0].copy()
    t=combo[combo["T"]==1].copy()
    rows=[]
    for v in DESIGN:
        a=d[v].to_numpy(float); b=t[v].to_numpy(float)
        wa=d.overlap_weight.to_numpy(float); wb=t.overlap_weight.to_numpy(float)
        va=np.var(a,ddof=1) if len(a)>1 else np.nan
        vb=np.var(b,ddof=1) if len(b)>1 else np.nan
        pooled=math.sqrt((va+vb)/2.0) if np.isfinite(va) and np.isfinite(vb) and (va+vb)>0 else 0.0
        rawdiff=float(np.mean(b)-np.mean(a))
        wdiff=float(wmean(b,wb)-wmean(a,wa))
        if pooled>0:
            raw_smd=rawdiff/pooled
            w_smd=wdiff/pooled
        else:
            raw_smd=0.0 if abs(rawdiff)<1e-15 else np.inf
            w_smd=0.0 if abs(wdiff)<1e-15 else np.inf
        rows.append({
            "contrast":label,"design_column":v,
            "raw_donor_mean":float(np.mean(a)),"raw_target_mean":float(np.mean(b)),
            "weighted_donor_mean":wmean(a,wa),"weighted_target_mean":wmean(b,wb),
            "raw_smd":float(raw_smd),"weighted_smd":float(w_smd),
            "abs_weighted_smd":float(abs(w_smd))
        })
    # Secondary weighted ECDF diagnostics for original continuous variables.
    for v in CONT:
        rows.append({
            "contrast":label,"design_column":"ECDF_GAP::"+v,
            "raw_donor_mean":np.nan,"raw_target_mean":np.nan,
            "weighted_donor_mean":np.nan,"weighted_target_mean":np.nan,
            "raw_smd":np.nan,"weighted_smd":np.nan,
            "abs_weighted_smd":weighted_ecdf_gap(
                d[v].to_numpy(float),d.overlap_weight.to_numpy(float),
                t[v].to_numpy(float),t.overlap_weight.to_numpy(float)
            )
        })
    return pd.DataFrame(rows)

def overlap_diagnostics(combo,label):
    rows=[]
    for T,name in [(0,"DONOR"),(1,"TARGET_2026")]:
        g=combo[combo["T"]==T].copy()
        w=g.overlap_weight.to_numpy(float)
        e=g.propensity.to_numpy(float)
        W=w/w.sum() if w.sum()>0 else np.zeros(len(w))
        row={
            "contrast":label,"group":name,"n":int(len(g)),
            "ess":ess(w),"ess_ratio":ess(w)/len(g) if len(g) else 0.0,
            "mean_weight":float(np.mean(w)) if len(w) else np.nan,
            "median_weight":float(np.median(w)) if len(w) else np.nan,
            "weight_p10":float(np.quantile(w,.10)) if len(w) else np.nan,
            "weight_p25":float(np.quantile(w,.25)) if len(w) else np.nan,
            "weight_p75":float(np.quantile(w,.75)) if len(w) else np.nan,
            "weight_p90":float(np.quantile(w,.90)) if len(w) else np.nan,
            "propensity_mean":float(np.mean(e)) if len(e) else np.nan,
            "propensity_median":float(np.median(e)) if len(e) else np.nan,
        }
        if T==1:
            row.update({
                "frac_e_ge_090":float((e>=.90).mean()),
                "frac_e_ge_095":float((e>=.95).mean()),
                "frac_w_le_010":float((w<=.10).mean()),
                "frac_w_le_005":float((w<=.05).mean()),
                "normalized_weight_mass_e_ge_090":float(W[e>=.90].sum()),
                "normalized_weight_mass_e_ge_095":float(W[e>=.95].sum()),
            })
        else:
            row.update({
                "frac_e_le_010":float((e<=.10).mean()),
                "frac_e_le_005":float((e<=.05).mean()),
                "normalized_weight_mass_e_le_010":float(W[e<=.10].sum()),
                "normalized_weight_mass_e_le_005":float(W[e<=.05].sum()),
            })
        rows.append(row)
    return pd.DataFrame(rows)

def monthly_concentration(combo,label):
    q=combo.copy()
    q["month"]=pd.to_datetime(q.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m")
    rows=[]; summary={}
    for T,name in [(0,"DONOR"),(1,"TARGET_2026")]:
        g=q[q["T"]==T].copy()
        total=float(g.overlap_weight.sum())
        shares=(g.groupby("month").overlap_weight.sum()/total).sort_index() if total>0 else pd.Series(dtype=float)
        hhi=float(np.sum(shares.to_numpy(float)**2)) if len(shares) else np.nan
        mx=float(shares.max()) if len(shares) else np.nan
        summary[name]={"max_month_share":mx,"hhi":hhi}
        for m,s in shares.items():
            rows.append({"contrast":label,"group":name,"month":m,"weight_share":float(s),"group_hhi":hhi,"group_max_month_share":mx})
    return pd.DataFrame(rows),summary

def point_estimate(donor,target,scales,label):
    combo,model,coefs,fitmeta=fit_propensity(donor,target,scales)
    d=combo[combo["T"]==0]; t=combo[combo["T"]==1]
    delta=wmean(t.pnl_r,t.overlap_weight)-wmean(d.pnl_r,d.overlap_weight)
    bal=balance_table(combo,label)
    smdrows=bal[~bal.design_column.str.startswith("ECDF_GAP::")]
    max_smd=float(smdrows.abs_weighted_smd.max()) if len(smdrows) else np.inf
    ov=overlap_diagnostics(combo,label)
    mc,mcsummary=monthly_concentration(combo,label)
    di=ov[ov.group=="DONOR"].iloc[0]
    ti=ov[ov.group=="TARGET_2026"].iloc[0]
    balance_pass=bool(max_smd<=.10)
    ess_pass=bool(
        di.ess>=50 and ti.ess>=50 and
        di.ess_ratio>=.40 and ti.ess_ratio>=.40
    )
    concentration_pass=bool(
        mcsummary["DONOR"]["max_month_share"]<=.25 and
        mcsummary["TARGET_2026"]["max_month_share"]<=.25
    )
    meta={
        **fitmeta,
        "donor_n":int(len(d)),"target_n":int(len(t)),
        "donor_weighted_mean_r":wmean(d.pnl_r,d.overlap_weight),
        "target_weighted_mean_r":wmean(t.pnl_r,t.overlap_weight),
        "delta_ow":float(delta),
        "max_abs_weighted_smd":max_smd,
        "balance_pass":balance_pass,
        "donor_ess":float(di.ess),"target_ess":float(ti.ess),
        "donor_ess_ratio":float(di.ess_ratio),"target_ess_ratio":float(ti.ess_ratio),
        "ess_pass":ess_pass,
        "donor_max_month_share":float(mcsummary["DONOR"]["max_month_share"]),
        "target_max_month_share":float(mcsummary["TARGET_2026"]["max_month_share"]),
        "concentration_pass":concentration_pass,
    }
    coefdf=pd.DataFrame([{"contrast":label,**r} for r in coefs])
    return combo,bal,ov,mc,coefdf,meta

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

def day_groups(df):
    return {k:g for k,g in df.groupby("trading_day",sort=False)}

def resample_rows(df,calendar_days,rng,prefix,groups):
    chosen=moving_block_days(calendar_days,rng)
    parts=[]; counter=0
    for day in chosen:
        g=groups.get(day)
        if g is None: continue
        q=g.copy()
        q["row_id"]=[f"{prefix}{counter+i:07d}" for i in range(len(q))]
        counter+=len(q)
        parts.append(q)
    return pd.concat(parts,ignore_index=True) if parts else df.iloc[0:0].copy()

def bootstrap(donor,target,donor_days,target_days,scales,label,nrep=N_BOOT):
    rng=np.random.default_rng(SEED + sum(ord(c) for c in label))
    dg=day_groups(donor); tg=day_groups(target)
    vals=[]; dess=[]; tess=[]; balpass=0; esspass=0; fitfail=0
    for b in range(nrep):
        db=resample_rows(donor,donor_days,rng,f"D{b}_",dg)
        tb=resample_rows(target,target_days,rng,f"T{b}_",tg)
        if len(db)==0 or len(tb)==0:
            fitfail+=1; continue
        try:
            _,bal,ov,_,_,meta=point_estimate(db,tb,scales,label+"_BOOT")
            if not meta["converged"] or not np.isfinite(meta["delta_ow"]):
                fitfail+=1; continue
            vals.append(meta["delta_ow"])
            dess.append(meta["donor_ess"]); tess.append(meta["target_ess"])
            balpass+=int(meta["balance_pass"])
            esspass+=int(meta["ess_pass"])
        except Exception:
            fitfail+=1
    a=np.asarray(vals,float)
    return {
        "replications_requested":int(nrep),
        "successful":int(len(a)),
        "failed":int(fitfail),
        "successful_fraction":float(len(a)/nrep),
        "ci_low":float(np.quantile(a,.025)) if len(a) else None,
        "ci_high":float(np.quantile(a,.975)) if len(a) else None,
        "bootstrap_mean":float(np.mean(a)) if len(a) else None,
        "donor_ess_p10":float(np.quantile(dess,.10)) if dess else None,
        "donor_ess_p50":float(np.quantile(dess,.50)) if dess else None,
        "donor_ess_p90":float(np.quantile(dess,.90)) if dess else None,
        "target_ess_p10":float(np.quantile(tess,.10)) if tess else None,
        "target_ess_p50":float(np.quantile(tess,.50)) if tess else None,
        "target_ess_p90":float(np.quantile(tess,.90)) if tess else None,
        "balance_pass_fraction":float(balpass/len(a)) if len(a) else 0.0,
        "ess_pass_fraction":float(esspass/len(a)) if len(a) else 0.0,
    }

def classify(meta,boot):
    quality={
        "convergence":bool(meta["converged"]),
        "balance":bool(meta["balance_pass"]),
        "ess":bool(meta["ess_pass"]),
        "concentration":bool(meta["concentration_pass"]),
        "bootstrap_success":bool(boot["successful_fraction"]>=.90),
    }
    if not all(quality.values()):
        return "INCONCLUSIVE",quality
    lo,hi=boot["ci_low"],boot["ci_high"]
    if hi is not None and hi < -ECON:
        return "RESIDUAL_OVERLAP_DETERIORATION",quality
    if lo is not None and lo>=-ECON and hi<=ECON:
        return "OVERLAP_ECONOMIC_EQUIVALENCE",quality
    return "INCONCLUSIVE",quality

def lomo(donor,target,scales,label):
    months=sorted(set(donor.month.unique())|set(target.month.unique()))
    rows=[]
    for m in months:
        d=donor[donor.month!=m].copy()
        t=target[target.month!=m].copy()
        if len(d)==0 or len(t)==0: continue
        try:
            _,_,_,_,_,meta=point_estimate(d,t,scales,label+"_LOMO")
            rows.append({
                "contrast":label,"excluded_month":m,
                "donor_n":len(d),"target_n":len(t),
                "delta_ow":meta["delta_ow"],
                "max_abs_weighted_smd":meta["max_abs_weighted_smd"],
                "donor_ess":meta["donor_ess"],"target_ess":meta["target_ess"],
                "balance_pass":meta["balance_pass"],"ess_pass":meta["ess_pass"],
                "converged":meta["converged"]
            })
        except Exception as e:
            rows.append({"contrast":label,"excluded_month":m,"error":str(e)})
    return pd.DataFrame(rows)

def attach_time_fields(df):
    q=df.copy()
    q["trading_day"]=pd.to_datetime(q.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m-%d")
    q["month"]=pd.to_datetime(q.entry_t,unit="ms",utc=True).dt.strftime("%Y-%m")
    return q

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    scales=load_scales()

    print("rebuilding corrected pre-entry context",flush=True)
    m5,m15,h1,_=audit.aggregate_all(ROOT)
    x,h=audit.build_context(m5,m15,h1)
    xs,state_pipe=audit.fit_states(x)
    h1ctx,_=exp2.build_h1_context(h)
    state_dist,state_q95=exp2.state_distance_lookup(xs,state_pipe)

    event_pre_cols=["signal_t","signal_idx","anchor_idx","state_id","anchor_low","anchor_high","atr_h1"]
    events_pre=pd.read_csv(EXP1/"swing_corrected_events.csv",usecols=event_pre_cols)
    permission=pd.read_csv(EXP1/"swing_permission_full_event_stream.csv",usecols=["signal_t","permission_on"])
    shadow_out=pd.read_csv(EXP1/"swing_corrected_shadow_trades.csv",usecols=["signal_t","entry_t","pnl_r"])
    pre=exp3.build_preentry(events_pre,x,h1ctx,state_dist,state_q95,permission,shadow_out[["signal_t","entry_t"]])

    # Primary outcomes are attached only after pre-entry context is constructed.
    primary=pre[pre.in_shadow].copy()
    primary=primary.merge(shadow_out,on=["signal_t","entry_t"],how="inner",validate="one_to_one")
    primary=attach_time_fields(primary)
    primary["row_id"]=["P%06d"%i for i in range(len(primary))]

    # Supporting independent event outcomes.
    event_out=pd.read_csv(EXP1/"swing_corrected_events.csv",usecols=["signal_t","label_label_valid","label_pnl_r"])
    supporting=pre.merge(event_out,on="signal_t",how="left",validate="one_to_one")
    supporting=supporting[supporting.label_label_valid & np.isfinite(supporting.label_pnl_r)].copy()
    supporting=supporting.rename(columns={"label_pnl_r":"pnl_r"})
    supporting=attach_time_fields(supporting)
    supporting["row_id"]=["E%06d"%i for i in range(len(supporting))]

    contrasts=[
        {
            "label":"PRIMARY_2025_vs_2026",
            "sample":"PRIMARY_SHADOW",
            "donor":primary[period_mask(primary,"2025_full")].copy(),
            "target":primary[period_mask(primary,"2026_jan_sep")].copy(),
            "donor_days":observed_market_days(m5,"2025-01-01","2026-01-01"),
            "target_days":observed_market_days(m5,"2026-01-01","2026-10-01"),
        },
        {
            "label":"SEASONAL_2025JS_vs_2026",
            "sample":"PRIMARY_SHADOW",
            "donor":primary[period_mask(primary,"2025_jan_sep")].copy(),
            "target":primary[period_mask(primary,"2026_jan_sep")].copy(),
            "donor_days":observed_market_days(m5,"2025-01-01","2025-10-01"),
            "target_days":observed_market_days(m5,"2026-01-01","2026-10-01"),
        },
        {
            "label":"EVENT_2025_vs_2026",
            "sample":"SUPPORTING_EVENTS",
            "donor":supporting[period_mask(supporting,"2025_full")].copy(),
            "target":supporting[period_mask(supporting,"2026_jan_sep")].copy(),
            "donor_days":observed_market_days(m5,"2025-01-01","2026-01-01"),
            "target_days":observed_market_days(m5,"2026-01-01","2026-10-01"),
        },
        {
            "label":"EVENT_2025JS_vs_2026",
            "sample":"SUPPORTING_EVENTS",
            "donor":supporting[period_mask(supporting,"2025_jan_sep")].copy(),
            "target":supporting[period_mask(supporting,"2026_jan_sep")].copy(),
            "donor_days":observed_market_days(m5,"2025-01-01","2025-10-01"),
            "target_days":observed_market_days(m5,"2026-01-01","2026-10-01"),
        },
    ]

    comparison_rows=[]; all_bal=[]; all_ov=[]; all_mc=[]; all_coef=[]; all_lomo=[]
    boots={}; saved_weights={}
    rec=[]
    for c in contrasts:
        label=c["label"]; donor=c["donor"]; target=c["target"]
        print("contrast",label,"donor",len(donor),"target",len(target),flush=True)
        combo,bal,ov,mc,coef,meta=point_estimate(donor,target,scales,label)
        boot=bootstrap(donor,target,c["donor_days"],c["target_days"],scales,label)
        klass,qg=classify(meta,boot)
        lm=lomo(donor,target,scales,label)
        all_bal.append(bal); all_ov.append(ov); all_mc.append(mc); all_coef.append(coef); all_lomo.append(lm)
        boots[label]=boot
        meta.update({
            "contrast":label,"sample":c["sample"],
            "classification":klass,
            "quality_gates":json.dumps(qg,sort_keys=True),
            "ci_low":boot["ci_low"],"ci_high":boot["ci_high"],
            "bootstrap_success_fraction":boot["successful_fraction"],
        })
        comparison_rows.append(meta)
        rec.append({"contrast":label,"sample":c["sample"],"donor_n":len(donor),"target_n":len(target)})
        wcols=["row_id","signal_t","entry_t","T","state_id","session_bucket_utc"]+CONT+["pnl_r","propensity","overlap_weight"]
        saved_weights[label]=combo[wcols].copy()
        print("RESULT",label,klass,"delta",meta["delta_ow"],"CI",boot["ci_low"],boot["ci_high"],
              "SMD",meta["max_abs_weighted_smd"],"ESS",meta["donor_ess"],meta["target_ess"],flush=True)

    # Required files
    pd.DataFrame(rec).to_csv(OUT/"sample_reconciliation.csv",index=False)
    saved_weights["PRIMARY_2025_vs_2026"].to_csv(OUT/"primary_weights.csv",index=False)
    saved_weights["SEASONAL_2025JS_vs_2026"].to_csv(OUT/"seasonal_weights.csv",index=False)
    pd.concat([
        saved_weights["EVENT_2025_vs_2026"].assign(contrast="EVENT_2025_vs_2026"),
        saved_weights["EVENT_2025JS_vs_2026"].assign(contrast="EVENT_2025JS_vs_2026")
    ],ignore_index=True).to_csv(OUT/"supporting_event_weights.csv",index=False)
    pd.concat(all_bal,ignore_index=True).to_csv(OUT/"balance_diagnostics.csv",index=False)
    pd.concat(all_ov,ignore_index=True).to_csv(OUT/"overlap_diagnostics.csv",index=False)
    pd.concat(all_mc,ignore_index=True).to_csv(OUT/"monthly_weight_concentration.csv",index=False)
    pd.concat(all_lomo,ignore_index=True).to_csv(OUT/"leave_one_month_out.csv",index=False)
    pd.concat(all_coef,ignore_index=True).to_csv(OUT/"propensity_coefficients.csv",index=False)
    comp=pd.DataFrame(comparison_rows)
    comp.to_csv(OUT/"comparison_summary.csv",index=False)
    (OUT/"bootstrap_summary.json").write_text(json.dumps(boots,indent=2),encoding="utf-8")

    primary_row=comp[comp.contrast=="PRIMARY_2025_vs_2026"].iloc[0].to_dict()
    summary={
        "scope":"Overlap-Population Contrast v0.1",
        "protocol_commit":"fc00c3d",
        "base_commit":"8c637d0",
        "pristine_forward_oos_read":False,
        "estimand":"ATO overlap population period contrast; NOT all 2026 opportunities",
        "economic_margin_r":ECON,
        "model":"unpenalized logistic main effects only; frozen covariates",
        "primary_classification":primary_row["classification"],
        "primary":primary_row,
        "comparisons":comp.to_dict(orient="records"),
        "bootstrap":boots,
        "target_overlap_diagnostics":pd.concat(all_ov,ignore_index=True).query("group=='TARGET_2026'").to_dict(orient="records"),
    }
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2,default=str),encoding="utf-8")

    print("PRIMARY_CLASSIFICATION",primary_row["classification"],flush=True)
    print(comp[["contrast","classification","delta_ow","ci_low","ci_high","max_abs_weighted_smd","donor_ess","target_ess","donor_max_month_share","target_max_month_share"]].to_string(index=False),flush=True)

if __name__=="__main__":
    main()
