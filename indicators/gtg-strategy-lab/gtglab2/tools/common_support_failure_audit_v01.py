from pathlib import Path
from itertools import permutations
import json, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
EXP1=GTG/"runs"/"measurement-execution-audit-v01"
EXP2=GTG/"runs"/"swing-opportunity-path-diagnostic-v01"
OUT=GTG/"runs"/"common-support-failure-audit-v01"
sys.path.insert(0,str(TOOLS))

import measurement_execution_audit_v01 as audit
import swing_opportunity_path_diagnostic_v01 as exp2

GEOM=["entry_distance_anchor_atr","entry_spread_r","bars_from_anchor"]
COMP=["state","session","coherence","expansion","persistence"]
CONT_MAP={
    "coherence":"signed_coherence_24h",
    "expansion":"expansion_level",
    "persistence":"expansion_persistence",
}
STAGE_ORDER=["state","session","coherence","expansion","persistence"]

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
    if name=="train":
        return dt<pd.Timestamp("2023-01-01",tz="UTC")
    raise KeyError(name)

def session_bucket(ms):
    h=pd.to_datetime(int(ms),unit="ms",utc=True).hour
    return "S0" if h<6 else ("S1" if h<12 else ("S2" if h<18 else "S3"))

def build_preentry(events,x,h1ctx,state_dist,state_q95,permission,shadow):
    pmap=permission.set_index("signal_t")["permission_on"].to_dict()
    shadow_set=set(shadow.signal_t.astype(np.int64))
    rows=[]
    for r in events.itertuples(index=False):
        sig=int(r.signal_idx)
        entry_idx=sig+1
        if entry_idx>=len(x):
            continue
        atr=float(r.atr_h1); anchor=float(r.anchor_low)
        ask=float(x.ao.iloc[entry_idx]); bid=float(x.bo.iloc[entry_idx])
        stop=anchor-atr; target=anchor+4.0*atr
        risk=ask-stop
        rows.append({
            "signal_t":int(r.signal_t),
            "entry_t":int(x.t.iloc[entry_idx]),
            "signal_idx":sig,
            "anchor_idx":int(r.anchor_idx),
            "state_id":int(r.state_id),
            "anchor_low":anchor,
            "anchor_high":float(r.anchor_high),
            "atr_h1":atr,
            "entry_px":ask,
            "entry_bid_px":bid,
            "initial_risk_price":risk,
            "entry_distance_anchor_atr":(ask-anchor)/atr if atr>0 else np.nan,
            "entry_spread_r":(ask-bid)/risk if risk>0 else np.nan,
            "bars_from_anchor":int(r.signal_idx-r.anchor_idx),
            "session_bucket_utc":session_bucket(int(x.t.iloc[entry_idx])),
            "state_distance":float(state_dist[sig]),
            "state_novel_train_q95":bool(state_dist[sig]>state_q95),
            "permission_on":bool(pmap.get(int(r.signal_t),False)),
            "in_shadow":int(r.signal_t) in shadow_set,
            "preentry_executable":bool(risk>0 and ask<target),
        })
    q=pd.DataFrame(rows).sort_values("entry_t").reset_index(drop=True)
    q=pd.merge_asof(q,h1ctx.sort_values("ready_t"),left_on="entry_t",right_on="ready_t",direction="backward")
    q["row_id"]=["R%06d"%i for i in range(len(q))]
    return q

def load_scales():
    obj=json.loads((EXP2/"train_matching_scales.json").read_text(encoding="utf-8"))
    return obj["scales"],obj

def zval(series,var,scales):
    s=scales[var]
    return (series.astype(float)-float(s["median"]))/float(s["iqr"])

def compatibility(donor,target,subset,scales):
    d=donor.reset_index(drop=True); t=target.reset_index(drop=True)
    nt,nd=len(t),len(d)
    if nt==0 or nd==0:
        return np.zeros((nt,nd),dtype=bool)

    M=np.ones((nt,nd),dtype=bool)
    # Frozen Geometry
    lim=.5*float(scales["entry_distance_anchor_atr"]["iqr"])
    M &= np.abs(t.entry_distance_anchor_atr.to_numpy(float)[:,None]-d.entry_distance_anchor_atr.to_numpy(float)[None,:])<=lim
    lim=.5*float(scales["entry_spread_r"]["iqr"])
    M &= np.abs(t.entry_spread_r.to_numpy(float)[:,None]-d.entry_spread_r.to_numpy(float)[None,:])<=lim
    M &= np.abs(t.bars_from_anchor.to_numpy(float)[:,None]-d.bars_from_anchor.to_numpy(float)[None,:])<=2

    S=set(subset)
    if "state" in S:
        M &= t.state_id.to_numpy()[:,None]==d.state_id.to_numpy()[None,:]
    if "session" in S:
        M &= t.session_bucket_utc.astype(str).to_numpy()[:,None]==d.session_bucket_utc.astype(str).to_numpy()[None,:]
    if "coherence" in S:
        lim=.5*float(scales["signed_coherence_24h"]["iqr"])
        M &= np.abs(t.signed_coherence_24h.to_numpy(float)[:,None]-d.signed_coherence_24h.to_numpy(float)[None,:])<=lim
    if "expansion" in S:
        M &= np.abs(t.expansion_level.to_numpy(float)[:,None]-d.expansion_level.to_numpy(float)[None,:])<=.20
    if "persistence" in S:
        M &= np.abs(t.expansion_persistence.to_numpy(float)[:,None]-d.expansion_persistence.to_numpy(float)[None,:])<=.20
    # Missing values never compatible on active continuous dimensions.
    M &= np.isfinite(t.entry_distance_anchor_atr.to_numpy(float))[:,None]
    M &= np.isfinite(d.entry_distance_anchor_atr.to_numpy(float))[None,:]
    M &= np.isfinite(t.entry_spread_r.to_numpy(float))[:,None]
    M &= np.isfinite(d.entry_spread_r.to_numpy(float))[None,:]
    if "coherence" in S:
        M &= np.isfinite(t.signed_coherence_24h.to_numpy(float))[:,None]
        M &= np.isfinite(d.signed_coherence_24h.to_numpy(float))[None,:]
    if "expansion" in S:
        M &= np.isfinite(t.expansion_level.to_numpy(float))[:,None]
        M &= np.isfinite(d.expansion_level.to_numpy(float))[None,:]
    if "persistence" in S:
        M &= np.isfinite(t.expansion_persistence.to_numpy(float))[:,None]
        M &= np.isfinite(d.expansion_persistence.to_numpy(float))[None,:]
    return M

def active_distance(donor,target,ti,idx,subset,scales):
    vars_=["entry_distance_anchor_atr","entry_spread_r","bars_from_anchor"]
    S=set(subset)
    for token in ["coherence","expansion","persistence"]:
        if token in S: vars_.append(CONT_MAP[token])
    dist=np.zeros(len(idx),float)
    for v in vars_:
        dz=zval(donor.iloc[idx][v],v,scales).to_numpy(float)
        tz=float(zval(pd.Series([target.iloc[ti][v]]),v,scales).iloc[0])
        dist+=np.abs(dz-tz)
    return dist

def support_metrics(donor,target,subset,scales):
    d=donor.sort_values(["signal_t","row_id"]).reset_index(drop=True)
    t=target.sort_values(["signal_t","row_id"]).reset_index(drop=True)
    M=compatibility(d,t,subset,scales)
    tc=M.sum(axis=1)
    dc=M.sum(axis=0)
    feasible=tc>0
    candidate_counts=tc.astype(int)

    # Frozen greedy no-replacement matching.
    avail=np.ones(len(d),dtype=bool)
    pairs=[]
    for ti in range(len(t)):
        idx=np.flatnonzero(M[ti] & avail)
        if len(idx)==0: continue
        dist=active_distance(d,t,ti,idx,subset,scales)
        m=float(dist.min())
        # donors are already sorted by signal_t,row_id, so first min reproduces tie-break.
        di=int(idx[np.flatnonzero(dist==m)[0]])
        pairs.append((ti,di,m))
        avail[di]=False

    if len(candidate_counts):
        pos=candidate_counts[candidate_counts>0]
        med=float(np.median(candidate_counts))
        p10=float(np.quantile(candidate_counts,.10))
        p90=float(np.quantile(candidate_counts,.90))
        mx=int(candidate_counts.max())
        posmed=float(np.median(pos)) if len(pos) else 0.0
    else:
        med=p10=p90=posmed=0.0; mx=0
    return {
        "target_total":int(len(t)),
        "donor_total":int(len(d)),
        "feasible_targets":int(feasible.sum()),
        "feasible_target_coverage":float(feasible.mean()) if len(t) else 0.0,
        "compatible_donors":int((dc>0).sum()),
        "compatible_donor_coverage":float((dc>0).mean()) if len(d) else 0.0,
        "compatible_edges":int(M.sum()),
        "edge_density":float(M.mean()) if M.size else 0.0,
        "zero_candidate_fraction":float((candidate_counts==0).mean()) if len(t) else 0.0,
        "candidates_median_all_targets":med,
        "candidates_median_feasible_targets":posmed,
        "candidates_p10":p10,
        "candidates_p90":p90,
        "candidates_max":mx,
        "greedy_matched":int(len(pairs)),
        "greedy_target_coverage":float(len(pairs)/len(t)) if len(t) else 0.0,
        "greedy_donor_coverage":float(len(pairs)/len(d)) if len(d) else 0.0,
        "allocation_loss_count":int(feasible.sum()-len(pairs)),
        "allocation_loss_pp":float((feasible.sum()-len(pairs))/len(t)) if len(t) else 0.0,
        "matrix":M,
        "candidate_counts":candidate_counts,
        "pairs":pairs,
        "donor_sorted":d,
        "target_sorted":t,
    }

def strip_internal(m):
    return {k:v for k,v in m.items() if k not in {"matrix","candidate_counts","pairs","donor_sorted","target_sorted"}}

def canonical_curve(donor,target,label,scales):
    stages=[("G",[])]
    active=[]
    names={"state":"S","session":"J","coherence":"C","expansion":"E","persistence":"P"}
    for token in STAGE_ORDER:
        active=active+[token]
        stages.append(("G+"+"+".join(names[x] for x in active),list(active)))
    rows=[]; raw=[]
    for s,sub in stages:
        m=support_metrics(donor,target,sub,scales)
        raw.append((s,sub,m))
        row={"contrast":label,"stage":s,"constraints":"|".join(sub) if sub else "GEOMETRY_ONLY",**strip_internal(m)}
        rows.append(row)
    return pd.DataFrame(rows),raw

def canonical_attrition(raw,label):
    rows=[]
    prev=None
    for s,sub,m in raw:
        if prev is None:
            prev=(s,m); continue
        ps,pm=prev
        rows.append({
            "contrast":label,"from_stage":ps,"to_stage":s,
            "constraint_added":sub[-1],
            "feasible_target_loss":pm["feasible_targets"]-m["feasible_targets"],
            "feasible_coverage_loss_pp":pm["feasible_target_coverage"]-m["feasible_target_coverage"],
            "greedy_pair_loss":pm["greedy_matched"]-m["greedy_matched"],
            "greedy_coverage_loss_pp":pm["greedy_target_coverage"]-m["greedy_target_coverage"],
        })
        prev=(s,m)
    return pd.DataFrame(rows)

def target_loss_stage(raw,label):
    # First canonical stage where target has zero donors.
    base_t=raw[0][2]["target_sorted"]
    alive=np.ones(len(base_t),dtype=bool)
    loss=np.array(["SURVIVES_FULL"]*len(base_t),dtype=object)
    for s,sub,m in raw:
        feasible=m["matrix"].sum(axis=1)>0
        newly=alive & (~feasible)
        loss[newly]=s
        alive &= feasible
    out=base_t[["row_id","signal_t","entry_t","state_id","session_bucket_utc"]].copy()
    out["contrast"]=label
    out["first_no_support_stage"]=loss
    return out

def subset_cache(donor,target,scales):
    cache={}
    for mask in range(1<<len(COMP)):
        subset=[COMP[i] for i in range(len(COMP)) if mask&(1<<i)]
        cache[frozenset(subset)]=support_metrics(donor,target,subset,scales)
    return cache

def shapley_attribution(cache,label):
    contrib_feas={k:[] for k in COMP}
    contrib_greedy={k:[] for k in COMP}
    for perm in permutations(COMP):
        S=frozenset()
        before=cache[S]
        for token in perm:
            S2=frozenset(set(S)|{token})
            after=cache[S2]
            contrib_feas[token].append(before["feasible_target_coverage"]-after["feasible_target_coverage"])
            contrib_greedy[token].append(before["greedy_target_coverage"]-after["greedy_target_coverage"])
            S=S2; before=after
    g=cache[frozenset()]
    f=cache[frozenset(COMP)]
    total_feas=g["feasible_target_coverage"]-f["feasible_target_coverage"]
    total_greedy=g["greedy_target_coverage"]-f["greedy_target_coverage"]
    rows=[]
    for token in COMP:
        a=float(np.mean(contrib_feas[token]))
        b=float(np.mean(contrib_greedy[token]))
        rows.append({
            "contrast":label,"dimension":token,
            "feasibility_loss_pp":a,
            "feasibility_share_of_total":a/total_feas if total_feas>0 else np.nan,
            "greedy_loss_pp":b,
            "greedy_share_of_total":b/total_greedy if total_greedy>0 else np.nan,
        })
    recon={
        "geometry_feasible_coverage":g["feasible_target_coverage"],
        "full_feasible_coverage":f["feasible_target_coverage"],
        "total_feasibility_loss":total_feas,
        "sum_shapley_feasibility_loss":float(sum(r["feasibility_loss_pp"] for r in rows)),
        "geometry_greedy_coverage":g["greedy_target_coverage"],
        "full_greedy_coverage":f["greedy_target_coverage"],
        "total_greedy_loss":total_greedy,
        "sum_shapley_greedy_loss":float(sum(r["greedy_loss_pp"] for r in rows)),
    }
    return pd.DataFrame(rows),recon

def leave_one_out(cache,label):
    full=cache[frozenset(COMP)]
    rows=[]
    for token in COMP:
        sub=frozenset(x for x in COMP if x!=token)
        m=cache[sub]
        rows.append({
            "contrast":label,"removed_constraint":token,
            "feasible_targets":m["feasible_targets"],
            "feasible_target_coverage":m["feasible_target_coverage"],
            "feasibility_restored_pp":m["feasible_target_coverage"]-full["feasible_target_coverage"],
            "greedy_matched":m["greedy_matched"],
            "greedy_target_coverage":m["greedy_target_coverage"],
            "greedy_restored_pp":m["greedy_target_coverage"]-full["greedy_target_coverage"],
        })
    return pd.DataFrame(rows)

def empirical_overlap(a,b,bins):
    a=np.asarray(a,float); b=np.asarray(b,float)
    a=a[np.isfinite(a)]; b=b[np.isfinite(b)]
    if len(a)==0 or len(b)==0:return np.nan
    ha,_=np.histogram(a,bins=bins); hb,_=np.histogram(b,bins=bins)
    pa=ha/ha.sum() if ha.sum() else ha
    pb=hb/hb.sum() if hb.sum() else hb
    return float(np.minimum(pa,pb).sum())

def distribution_rows(donor,target,label,train):
    rows=[]
    # TRAIN-fixed bins
    coh=train.signed_coherence_24h.dropna().to_numpy(float)
    coh_bins=np.unique(np.quantile(coh,np.linspace(0,1,11)))
    if len(coh_bins)<3: coh_bins=np.linspace(-1,1,11)
    exp_bins=np.linspace(0,1,11)
    per_bins=np.linspace(0,1,11)
    for v,bins in [("signed_coherence_24h",coh_bins),("expansion_level",exp_bins),("expansion_persistence",per_bins)]:
        a=donor[v].dropna().to_numpy(float); b=target[v].dropna().to_numpy(float)
        row={"contrast":label,"variable":v,"donor_n":len(a),"target_n":len(b)}
        for prefix,x in [("donor",a),("target",b)]:
            if len(x):
                row.update({
                    prefix+"_mean":float(np.mean(x)),prefix+"_median":float(np.median(x)),
                    prefix+"_p10":float(np.quantile(x,.10)),prefix+"_p25":float(np.quantile(x,.25)),
                    prefix+"_p75":float(np.quantile(x,.75)),prefix+"_p90":float(np.quantile(x,.90)),
                    prefix+"_iqr":float(np.quantile(x,.75)-np.quantile(x,.25)),
                })
        if len(a) and len(b):
            row["target_fraction_outside_donor_minmax"]=float(((b<a.min())|(b>a.max())).mean())
            row["overlap_coefficient"]=empirical_overlap(a,b,bins)
        rows.append(row)
    return rows

def state_session_rows(df,sample,period):
    g=df.copy()
    out=[]
    n=len(g)
    for st in [0,4,5]:
        for se in ["S0","S1","S2","S3"]:
            c=int(((g.state_id==st)&(g.session_bucket_utc==se)).sum())
            out.append({"sample":sample,"period":period,"state_id":st,"session":se,"count":c,"proportion":c/n if n else np.nan})
    return out

def classify(shap,loo,full_metrics):
    s=shap.sort_values("feasibility_share_of_total",ascending=False).reset_index(drop=True)
    top1=float(s.iloc[0].feasibility_share_of_total) if len(s) else 0.0
    top2=float(s.iloc[:2].feasibility_share_of_total.sum()) if len(s)>=2 else top1
    topdims=s.iloc[:2].dimension.tolist()
    loo_map=loo.set_index("removed_constraint").feasibility_restored_pp.to_dict()
    concentrated=(top2>=.70 and any(float(loo_map.get(x,0))>=.20 for x in topdims))
    n10=int((shap.feasibility_share_of_total>=.10).sum())
    if concentrated:
        return "CONCENTRATED_BOTTLENECK",{"top2_dimensions":topdims,"top2_share":top2,"dimensions_ge_10pct":n10}
    if top2<.70 and n10>=3:
        return "DISTRIBUTED_MULTIDIMENSIONAL_COLLAPSE",{"top2_dimensions":topdims,"top2_share":top2,"dimensions_ge_10pct":n10}
    if full_metrics["feasible_target_coverage"]>=.50 and full_metrics["greedy_target_coverage"]<.50 and full_metrics["allocation_loss_pp"]>=.20:
        return "DONOR_COMPETITION_ALLOCATION_BOTTLENECK",{"allocation_loss_pp":full_metrics["allocation_loss_pp"]}
    return "MIXED_UNRESOLVED_SUPPORT_FAILURE",{"top2_dimensions":topdims,"top2_share":top2,"dimensions_ge_10pct":n10}

def run_contrast(donor,target,label,scales):
    curve,raw=canonical_curve(donor,target,label,scales)
    attr=canonical_attrition(raw,label)
    loss=target_loss_stage(raw,label)
    cache=subset_cache(donor,target,scales)
    shap,recon=shapley_attribution(cache,label)
    loo=leave_one_out(cache,label)
    return curve,attr,loss,shap,loo,recon,cache

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    scales,scale_obj=load_scales()

    print("rebuilding outcome-blind pre-entry context",flush=True)
    m5,m15,h1,_=audit.aggregate_all(ROOT)
    x,h=audit.build_context(m5,m15,h1)
    xs,state_pipe=audit.fit_states(x)
    h1ctx,_=exp2.build_h1_context(h)
    state_dist,state_q95=exp2.state_distance_lookup(xs,state_pipe)

    # Explicitly load only pre-entry identifiers/features. No PnL/label/path columns are read.
    event_cols=["signal_t","signal_idx","anchor_idx","state_id","anchor_low","anchor_high","atr_h1"]
    events=pd.read_csv(EXP1/"swing_corrected_events.csv",usecols=event_cols)
    permission=pd.read_csv(EXP1/"swing_permission_full_event_stream.csv",usecols=["signal_t","permission_on"])
    shadow=pd.read_csv(EXP1/"swing_corrected_shadow_trades.csv",usecols=["signal_t","entry_t"])

    pre=build_preentry(events,x,h1ctx,state_dist,state_q95,permission,shadow)
    primary=pre[pre.in_shadow].copy()
    supporting=pre[pre.preentry_executable].copy()
    train=pre[period_mask(pre,"train")].copy()

    # Fixed row identifiers inside each population.
    primary=primary.sort_values(["signal_t","row_id"]).reset_index(drop=True)
    primary["row_id"]=["P%06d"%i for i in range(len(primary))]
    supporting=supporting.sort_values(["signal_t","row_id"]).reset_index(drop=True)
    supporting["row_id"]=["E%06d"%i for i in range(len(supporting))]

    contrasts=[
        ("PRIMARY_2025_vs_2026",primary[period_mask(primary,"2025_full")].copy(),primary[period_mask(primary,"2026_jan_sep")].copy()),
        ("SEASONAL_2025JS_vs_2026",primary[period_mask(primary,"2025_jan_sep")].copy(),primary[period_mask(primary,"2026_jan_sep")].copy()),
        ("HIST_2023_2024_vs_2026",primary[period_mask(primary,"2023_2024")].copy(),primary[period_mask(primary,"2026_jan_sep")].copy()),
        ("EVENT_2025_vs_2026",supporting[period_mask(supporting,"2025_full")].copy(),supporting[period_mask(supporting,"2026_jan_sep")].copy()),
        ("EVENT_2025JS_vs_2026",supporting[period_mask(supporting,"2025_jan_sep")].copy(),supporting[period_mask(supporting,"2026_jan_sep")].copy()),
        ("EVENT_2023_2024_vs_2026",supporting[period_mask(supporting,"2023_2024")].copy(),supporting[period_mask(supporting,"2026_jan_sep")].copy()),
    ]

    all_curve=[]; all_attr=[]; all_loss=[]; all_shap=[]; all_loo=[]; recons={}
    dist=[]; stsess=[]
    for label,donor,target in contrasts:
        print("contrast",label,"donor",len(donor),"target",len(target),flush=True)
        curve,attr,loss,shap,loo,recon,cache=run_contrast(donor,target,label,scales)
        all_curve.append(curve); all_attr.append(attr); all_loss.append(loss); all_shap.append(shap); all_loo.append(loo); recons[label]=recon
        dist.extend(distribution_rows(donor,target,label,train))
        # two period tables per contrast
        stsess.extend(state_session_rows(donor,label,"DONOR"))
        stsess.extend(state_session_rows(target,label,"TARGET"))

    curve=pd.concat(all_curve,ignore_index=True)
    attr=pd.concat(all_attr,ignore_index=True)
    loss=pd.concat(all_loss,ignore_index=True)
    shap=pd.concat(all_shap,ignore_index=True)
    loo=pd.concat(all_loo,ignore_index=True)
    distdf=pd.DataFrame(dist); ssdf=pd.DataFrame(stsess)

    # Reconciliation vs Experiment 2 required counts.
    pcurve=curve[curve.contrast=="PRIMARY_2025_vs_2026"].set_index("stage")
    scurve=curve[curve.contrast=="SEASONAL_2025JS_vs_2026"].set_index("stage")
    hcurve=curve[curve.contrast=="HIST_2023_2024_vs_2026"].set_index("stage")
    checks={
        "primary_donor_122":int(pcurve.loc["G","donor_total"])==122,
        "primary_target_105":int(pcurve.loc["G","target_total"])==105,
        "primary_geometry_82":int(pcurve.loc["G","greedy_matched"])==82,
        "primary_full_18":int(pcurve.iloc[-1].greedy_matched)==18,
        "seasonal_geometry_60":int(scurve.loc["G","greedy_matched"])==60,
        "seasonal_full_12":int(scurve.iloc[-1].greedy_matched)==12,
        "historical_geometry_85":int(hcurve.loc["G","greedy_matched"])==85,
        "historical_full_2":int(hcurve.iloc[-1].greedy_matched)==2,
    }
    if not all(checks.values()):
        raise RuntimeError("Experiment 2 matching reconciliation failed: "+json.dumps(checks))

    pshap=shap[shap.contrast=="PRIMARY_2025_vs_2026"].copy()
    ploo=loo[loo.contrast=="PRIMARY_2025_vs_2026"].copy()
    pfull=pcurve.iloc[-1].to_dict()
    classification,detail=classify(pshap,ploo,pfull)

    # Stage lost-target distributions
    loss_summary=(loss.groupby(["contrast","first_no_support_stage","state_id","session_bucket_utc"],dropna=False)
                    .size().reset_index(name="target_count"))

    # Required outputs
    curve[curve.contrast.str.startswith("PRIMARY")|curve.contrast.str.startswith("SEASONAL")].to_csv(OUT/"canonical_support_curve.csv",index=False)
    attr[attr.contrast.str.startswith("PRIMARY")|attr.contrast.str.startswith("SEASONAL")].to_csv(OUT/"canonical_attrition.csv",index=False)
    loss.to_csv(OUT/"target_loss_stage.csv",index=False)
    shap.to_csv(OUT/"shapley_support_attribution.csv",index=False)
    loo.to_csv(OUT/"leave_one_constraint_out.csv",index=False)
    distdf.to_csv(OUT/"distribution_diagnostics.csv",index=False)
    ssdf.to_csv(OUT/"state_session_tables.csv",index=False)
    curve[curve.contrast.str.startswith("EVENT_")].to_csv(OUT/"supporting_event_support_curve.csv",index=False)
    curve[curve.contrast.str.startswith("HIST_")].to_csv(OUT/"historical_support_curves.csv",index=False)
    loss_summary.to_csv(OUT/"target_loss_summary.csv",index=False)

    sample_rec=pd.DataFrame([
        {"sample":"PRIMARY_SHADOW_ALL","n":len(primary)},
        {"sample":"PRIMARY_2025_FULL","n":int(period_mask(primary,"2025_full").sum())},
        {"sample":"PRIMARY_2025_JAN_SEP","n":int(period_mask(primary,"2025_jan_sep").sum())},
        {"sample":"PRIMARY_2026_JAN_SEP","n":int(period_mask(primary,"2026_jan_sep").sum())},
        {"sample":"PRIMARY_2023_2024","n":int(period_mask(primary,"2023_2024").sum())},
        {"sample":"ALL_STATE_ELIGIBLE_PREENTRY","n":len(pre)},
        {"sample":"SUPPORTING_PREENTRY_EXECUTABLE","n":len(supporting)},
    ])
    sample_rec.to_csv(OUT/"sample_reconciliation.csv",index=False)

    # Outcome-blind verification by source columns loaded.
    outcome_blind={
        "event_columns_loaded":event_cols,
        "shadow_columns_loaded":["signal_t","entry_t"],
        "permission_columns_loaded":["signal_t","permission_on"],
        "forbidden_columns_loaded":[],
        "pnl_used":False,"labels_used":False,"post_entry_path_used":False,
    }

    summary={
        "scope":"Common-Support Failure Audit v0.1",
        "protocol_commit":"ccd9951",
        "base_commit":"8b50a67",
        "pristine_forward_oos_read":False,
        "outcome_blind":outcome_blind,
        "reconciliation_checks":checks,
        "primary_classification":classification,
        "classification_detail":detail,
        "primary_support_curve":curve[curve.contrast=="PRIMARY_2025_vs_2026"].to_dict(orient="records"),
        "primary_attrition":attr[attr.contrast=="PRIMARY_2025_vs_2026"].to_dict(orient="records"),
        "primary_shapley":pshap.to_dict(orient="records"),
        "primary_leave_one_out":ploo.to_dict(orient="records"),
        "shapley_reconciliation":recons["PRIMARY_2025_vs_2026"],
        "sample_reconciliation":sample_rec.to_dict(orient="records"),
    }
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")

    print("CLASSIFICATION",classification,json.dumps(detail),flush=True)
    print("PRIMARY_CURVE",curve[curve.contrast=="PRIMARY_2025_vs_2026"].to_json(orient="records"),flush=True)
    print("PRIMARY_SHAPLEY",pshap.to_json(orient="records"),flush=True)
    print("PRIMARY_LOO",ploo.to_json(orient="records"),flush=True)
    print("RECON",json.dumps(checks),flush=True)

if __name__=="__main__":
    main()
