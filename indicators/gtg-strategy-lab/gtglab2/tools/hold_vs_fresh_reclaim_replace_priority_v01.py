from pathlib import Path
import json, math, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
EXP1=GTG/"runs"/"measurement-execution-audit-v01"
OUT=GTG/"runs"/"hold-vs-fresh-reclaim-replace-priority-v01"

sys.path.insert(0,str(TOOLS))
import measurement_execution_audit_v01 as audit
import one_shot_fresh_reclaim_reentry_v01 as e6

TIMEOUT=864
N_BOOT=2000
BLOCK_DAYS=5
SEED=7054
ALLOWED_STATES={0,4,5}
EPS=1e-12

def geom_fields(ev,x):
    sig=int(ev.signal_idx)
    entry=sig+1
    if entry>=len(x):
        return {"entry_idx":entry,"valid":False,"reason":"NO_NEXT_BAR"}
    ask=float(x.ao.iloc[entry]); bid=float(x.bo.iloc[entry])
    stop=float(ev.anchor_low)-float(ev.atr_h1)
    target=float(ev.anchor_low)+4.0*float(ev.atr_h1)
    valid=bool(stop<ask<target)
    return {
        "entry_idx":entry,"entry_t":int(x.t.iloc[entry]),
        "ask":ask,"bid":bid,"stop":stop,"target":target,
        "risk_px":ask-stop if valid else np.nan,
        "valid":valid,"reason":"OK" if valid else "INVALID_NEXT_ASK_OPEN",
        "spread_px":ask-bid,
    }

def prepare_event_stream(x):
    usecols=["signal_t","signal_idx","anchor_idx","year","state_id","atr_h1","anchor_low","anchor_high","permission_on"]
    perm=pd.read_csv(EXP1/"swing_permission_full_event_stream.csv",usecols=usecols)
    perm["permission_on"]=perm.permission_on.fillna(False).astype(bool)

    raw=audit.detect_events(x,"HIGH_RECLAIM")
    rkey=raw[["signal_t","signal_idx","anchor_idx","episode_start_idx"]].copy()
    q=perm.merge(rkey,on="signal_t",how="left",suffixes=("","_regen"),validate="one_to_one")
    if q.episode_start_idx.isna().any():
        raise RuntimeError("Missing regenerated episode_start_idx")
    if int((q.signal_idx.astype(int)!=q.signal_idx_regen.astype(int)).sum()) or int((q.anchor_idx.astype(int)!=q.anchor_idx_regen.astype(int)).sum()):
        raise RuntimeError("Event identity mismatch against regenerated HIGH_RECLAIM")
    q=q.drop(columns=["signal_idx_regen","anchor_idx_regen"])
    q=q.sort_values(["signal_idx","signal_t"]).reset_index(drop=True)
    vals=[]
    for r in q.itertuples(index=False):
        vals.append(geom_fields(r,x))
    gf=pd.DataFrame(vals)
    for c in gf.columns:
        q["candidate_"+c]=gf[c].to_numpy()
    return q

def rebuild_hold(events,x,resolver):
    selected=events[events.permission_on].signal_t.astype(np.int64)
    hold,counters=audit.execute_selected(
        events,selected,x,audit.SPECS["swing"],resolver,"swing"
    )
    ref=pd.read_csv(EXP1/"swing_corrected_shadow_trades.csv")
    hs=hold.sort_values("entry_t").reset_index(drop=True)
    rs=ref.sort_values("entry_t").reset_index(drop=True)
    checks={
        "n_match":len(hs)==len(rs)==1177,
        "signal_sequence_match":hs.signal_t.astype(np.int64).tolist()==rs.signal_t.astype(np.int64).tolist(),
        "year_counts_match":hs.year.value_counts().sort_index().to_dict()==rs.year.value_counts().sort_index().to_dict(),
        "total_r_abs_diff":abs(float(hs.pnl_r.sum())-float(rs.pnl_r.sum())),
        "max_trade_pnl_abs_diff":float(np.max(np.abs(hs.pnl_r.to_numpy(float)-rs.pnl_r.to_numpy(float)))) if len(hs)==len(rs) else None,
    }
    checks["total_r_match"]=checks["total_r_abs_diff"]<=1e-9
    checks["trade_pnl_match"]=checks["max_trade_pnl_abs_diff"] is not None and checks["max_trade_pnl_abs_diff"]<=1e-9
    checks["all_pass"]=all([
        checks["n_match"],checks["signal_sequence_match"],checks["year_counts_match"],
        checks["total_r_match"],checks["trade_pnl_match"]
    ])
    if not checks["all_pass"]:
        raise RuntimeError("HOLD reconstruction failed: "+json.dumps(checks))
    return hs,ref,counters,checks

def normal_trade_from_event(ev,x,resolver,deadline_idx,risk_weight,cycle_id,role):
    out=e6.simulate_to_horizon(ev,x,resolver,int(deadline_idx))
    if not out.get("valid",False):
        return None,out.get("reason","INVALID")
    row={
        "cycle_id":cycle_id,"trade_role":role,
        "signal_t":int(ev.signal_t),"signal_idx":int(ev.signal_idx),
        "year":int(ev.year),"state_id":int(ev.state_id),
        "entry_idx":int(out["entry_idx"]),"exit_idx":int(out["exit_idx"]),
        "entry_t":int(out["entry_t"]),"exit_t":int(out["exit_t"]),
        "exit_available_t":int(out["exit_available_t"]),
        "anchor_low":float(ev.anchor_low),"anchor_high":float(ev.anchor_high),"atr_h1":float(ev.atr_h1),
        "entry_px":float(out["entry_px"]),"entry_bid_px":float(out["entry_bid_px"]),
        "stop_px":float(out["stop_px"]),"target_px":float(out["target_px"]),"exit_px":float(out["exit_px"]),
        "risk_px":float(out["risk_px"]),"entry_rr":float(out["entry_rr"]),
        "raw_pnl_r":float(out["pnl_r"]),"risk_weight":float(risk_weight),
        "scaled_pnl_r":float(out["pnl_r"])*float(risk_weight),
        "exit_kind":str(out["exit_kind"]),"m1_ambiguous":bool(out["m1_ambiguous"]),
        "entry_spread_px":float(out["entry_spread_px"]),"exit_spread_px":float(out["exit_spread_px"]),
        "holding_m5_bars":int(out["exit_idx"]-out["entry_idx"]),
    }
    return row,None

def switch_close_row(current,ev,x):
    entry_idx=int(ev.candidate_entry_idx)
    bid=float(x.bo.iloc[entry_idx])
    raw=(bid-float(current["entry_px"]))/float(current["risk_px"])
    scaled=raw*float(current["risk_weight"])
    row=current.copy()
    row.update({
        "trade_role":"SWITCHED_OUT_FIRST_LEG",
        "exit_idx":entry_idx,
        "exit_t":int(x.t.iloc[entry_idx]),
        "exit_available_t":int(x.t.iloc[entry_idx]),
        "exit_px":bid,
        "raw_pnl_r":float(raw),
        "scaled_pnl_r":float(scaled),
        "exit_kind":"SWITCH_CLOSE",
        "exit_spread_px":float(x.ao.iloc[entry_idx]-x.bo.iloc[entry_idx]),
        "holding_m5_bars":int(entry_idx-int(current["entry_idx"])),
    })
    return row

def segment_from_year(y):
    y=int(y)
    if y<=2022:return "2018-2022"
    if y<=2024:return "2023-2024"
    return "2025-2026"

def simulate_replace(events,x,resolver):
    trades=[]
    cycles=[]
    ledger=[]
    switches=[]

    current=None
    cycle=None
    next_free_signal_idx=0

    def finalize_current():
        nonlocal current,cycle,next_free_signal_idx
        if current is None:return
        trades.append(current.copy())
        cycle["cycle_pnl_r"]+=float(current["scaled_pnl_r"])
        cycle["cycle_exit_t"]=int(current["exit_available_t"])
        cycle["cycle_exit_idx"]=int(current["exit_idx"])
        cycle["cycle_exit_kind"]=str(current["exit_kind"])
        cycle["cycle_holding_m5_bars"]=int(current["exit_idx"]-cycle["cycle_start_entry_idx"])
        cycle["gross_nominal_risk_deployed"]=float(cycle["gross_nominal_risk_deployed"])
        cycles.append(cycle.copy())
        next_free_signal_idx=int(current["exit_idx"])+1
        current=None
        cycle=None

    for ev in events.itertuples(index=False):
        sig=int(ev.signal_idx)

        # If current position exited before this signal bar, complete the cycle first.
        if current is not None and int(current["exit_idx"]) < sig:
            finalize_current()

        if current is None:
            if sig < int(next_free_signal_idx):
                continue
            if not bool(ev.permission_on) or not bool(ev.candidate_valid):
                continue
            entry_idx=int(ev.candidate_entry_idx)
            deadline=entry_idx+TIMEOUT
            if deadline>=len(x):
                continue
            cid=f"CYCLE_{int(ev.signal_t)}"
            tr,reason=normal_trade_from_event(ev,x,resolver,deadline,1.0,cid,"FIRST_LEG")
            if tr is None:
                continue
            current=tr
            cycle={
                "cycle_id":cid,
                "cycle_start_signal_t":int(ev.signal_t),
                "cycle_start_year":int(ev.year),
                "segment":segment_from_year(ev.year),
                "cycle_start_entry_idx":entry_idx,
                "cycle_start_entry_t":int(ev.candidate_entry_t),
                "cycle_horizon_end_idx":int(deadline),
                "cycle_horizon_end_t":int(x.t.iloc[deadline]),
                "switched":False,
                "switch_signal_t":np.nan,
                "switch_entry_t":np.nan,
                "first_leg_switch_r":np.nan,
                "remaining_budget_r":np.nan,
                "replacement_risk_weight":0.0,
                "cycle_pnl_r":0.0,
                "gross_nominal_risk_deployed":1.0,
                "occupied_event_n":0,
                "fresh_event_n":0,
                "permission_reject_n":0,
                "geometry_reject_n":0,
                "stale_reject_n":0,
                "horizon_reject_n":0,
                "not_open_at_entry_n":0,
                "no_budget_reject_n":0,
                "post_switch_ignored_n":0,
            }
            continue

        # Occupied cycle.
        cycle["occupied_event_n"]+=1
        base={
            "cycle_id":cycle["cycle_id"],"current_signal_t":int(current["signal_t"]),
            "event_signal_t":int(ev.signal_t),"event_signal_idx":sig,
            "event_entry_idx":int(ev.candidate_entry_idx),"event_entry_t":int(ev.candidate_entry_t),
            "episode_start_idx":int(ev.episode_start_idx),
            "permission_on":bool(ev.permission_on),"geometry_valid":bool(ev.candidate_valid),
            "cycle_switched_before_event":bool(cycle["switched"]),
        }

        if cycle["switched"]:
            cycle["post_switch_ignored_n"]+=1
            ledger.append({**base,"screen_result":"POST_SWITCH_IGNORED"})
            continue

        if sig<=int(current["signal_idx"]) or int(ev.episode_start_idx)<int(cycle["cycle_start_entry_idx"]):
            cycle["stale_reject_n"]+=1
            ledger.append({**base,"screen_result":"STALE_NOT_FRESH"})
            continue

        cycle["fresh_event_n"]+=1

        if not bool(ev.permission_on):
            cycle["permission_reject_n"]+=1
            ledger.append({**base,"screen_result":"PERMISSION_REJECT"})
            continue

        if not bool(ev.candidate_valid):
            cycle["geometry_reject_n"]+=1
            ledger.append({**base,"screen_result":"GEOMETRY_REJECT"})
            continue

        entry_idx=int(ev.candidate_entry_idx)
        if entry_idx>=int(cycle["cycle_horizon_end_idx"]):
            cycle["horizon_reject_n"]+=1
            ledger.append({**base,"screen_result":"AFTER_CYCLE_HORIZON"})
            continue

        # Replacement must enter while old position is truly still open.
        if int(ev.candidate_entry_t)>=int(current["exit_available_t"]):
            cycle["not_open_at_entry_n"]+=1
            ledger.append({**base,"screen_result":"CURRENT_NOT_OPEN_AT_ENTRY"})
            continue

        old_close=switch_close_row(current,ev,x)
        old_realized=float(old_close["scaled_pnl_r"])
        loss_spent=max(0.0,-old_realized)
        remaining=max(0.0,1.0-loss_spent)
        if remaining<=EPS:
            cycle["no_budget_reject_n"]+=1
            ledger.append({**base,"screen_result":"NO_REMAINING_CYCLE_BUDGET",
                           "first_leg_mark_r":old_realized,"remaining_budget_r":remaining})
            continue

        replacement,reason=normal_trade_from_event(
            ev,x,resolver,int(cycle["cycle_horizon_end_idx"]),remaining,
            cycle["cycle_id"],"REPLACEMENT"
        )
        if replacement is None:
            ledger.append({**base,"screen_result":"REPLACEMENT_EXECUTION_INVALID","reason":reason})
            continue

        # Execute atomic conversion.
        trades.append(old_close)
        cycle["cycle_pnl_r"]+=old_realized
        cycle["switched"]=True
        cycle["switch_signal_t"]=int(ev.signal_t)
        cycle["switch_entry_t"]=int(ev.candidate_entry_t)
        cycle["first_leg_switch_r"]=old_realized
        cycle["remaining_budget_r"]=remaining
        cycle["replacement_risk_weight"]=remaining
        cycle["gross_nominal_risk_deployed"]+=remaining

        switches.append({
            "cycle_id":cycle["cycle_id"],
            "cycle_start_signal_t":int(cycle["cycle_start_signal_t"]),
            "cycle_start_year":int(cycle["cycle_start_year"]),
            "segment":cycle["segment"],
            "switch_signal_t":int(ev.signal_t),
            "switch_entry_t":int(ev.candidate_entry_t),
            "first_leg_mark_r":old_realized,
            "remaining_budget_r":remaining,
            "replacement_risk_weight":remaining,
            "switch_quoted_spread_px":float(ev.candidate_spread_px),
            "replacement_raw_pnl_r":float(replacement["raw_pnl_r"]),
            "replacement_scaled_pnl_r":float(replacement["scaled_pnl_r"]),
            "replacement_exit_kind":str(replacement["exit_kind"]),
            "replacement_exit_available_t":int(replacement["exit_available_t"]),
            "replacement_horizon_cap_t":int(cycle["cycle_horizon_end_t"]),
        })
        ledger.append({**base,"screen_result":"SWITCH_EXECUTED",
                       "first_leg_mark_r":old_realized,"remaining_budget_r":remaining})
        current=replacement

    finalize_current()

    tdf=pd.DataFrame(trades).sort_values(["entry_t","trade_role"]).reset_index(drop=True)
    cdf=pd.DataFrame(cycles).sort_values("cycle_start_entry_t").reset_index(drop=True)
    ldf=pd.DataFrame(ledger)
    sdf=pd.DataFrame(switches)
    return tdf,cdf,sdf,ldf

def hold_cycles_from_trades(hold):
    rows=[]
    for r in hold.sort_values("entry_t").itertuples(index=False):
        entry_idx=int(r.signal_t*0) # placeholder overwritten below if needed only for schema
        rows.append({
            "cycle_id":f"CYCLE_{int(r.signal_t)}",
            "cycle_start_signal_t":int(r.signal_t),"cycle_start_year":int(r.year),
            "segment":segment_from_year(r.year),
            "switched":False,"cycle_pnl_r":float(r.pnl_r),
            "gross_nominal_risk_deployed":1.0,
            "cycle_start_entry_t":int(r.entry_t),"cycle_exit_t":int(r.exit_available_t),
            "cycle_exit_kind":str(r.exit_kind)
        })
    return pd.DataFrame(rows)

def add_hold_trade_fields(hold,x):
    q=hold.copy()
    tmap={int(t):i for i,t in enumerate(x.t.to_numpy(np.int64))}
    q["cycle_id"]=["CYCLE_"+str(int(v)) for v in q.signal_t]
    q["trade_role"]="HOLD"
    q["raw_pnl_r"]=q.pnl_r.astype(float)
    q["risk_weight"]=1.0
    q["scaled_pnl_r"]=q.pnl_r.astype(float)
    q["entry_idx"]=[tmap[int(t)] for t in q.entry_t]
    q["exit_idx"]=[
        int(np.searchsorted(x.t.to_numpy(np.int64),int(t),side="left"))
        for t in q.exit_t
    ]
    q["holding_m5_bars"]=(q.exit_idx-q.entry_idx).clip(lower=0)
    return q

def policy_metrics(trades,cycles):
    v=trades.scaled_pnl_r.to_numpy(float)
    pos=float(v[v>0].sum()); neg=float(-v[v<0].sum())
    gross=float(trades.risk_weight.sum())
    return {
        "trade_legs":int(len(trades)),
        "cycles":int(len(cycles)),
        "total_r":float(v.sum()),
        "gross_nominal_risk_deployed":gross,
        "efficiency":float(v.sum()/gross) if gross>0 else None,
        "profit_factor":float(pos/neg) if neg>0 else None,
        "mean_r_per_cycle":float(cycles.cycle_pnl_r.mean()) if len(cycles) else None,
        "positive_cycle_rate":float((cycles.cycle_pnl_r>0).mean()) if len(cycles) else None,
        "risk_weighted_holding_m5_bars":float((trades.risk_weight*trades.holding_m5_bars).sum()),
    }

def policy_by_group(cycles,col):
    out=[]
    for k,g in cycles.groupby(col):
        out.append({
            col:k,"n_cycles":int(len(g)),
            "total_r":float(g.cycle_pnl_r.sum()),
            "mean_r":float(g.cycle_pnl_r.mean()),
            "positive_rate":float((g.cycle_pnl_r>0).mean()),
            "switch_cycles":int(g.switched.sum()) if "switched" in g else 0,
        })
    return pd.DataFrame(out)

def bootstrap_daily_diff(hold_trades,replace_trades,m5):
    def daily(df):
        q=df.copy()
        q["day"]=pd.to_datetime(q.exit_available_t,unit="ms",utc=True).dt.strftime("%Y-%m-%d")
        return q.groupby("day").scaled_pnl_r.sum()
    h=daily(hold_trades); r=daily(replace_trades)
    dt=pd.to_datetime(m5.t,unit="ms",utc=True)
    days=sorted(pd.Series(dt.dt.strftime("%Y-%m-%d").unique()).tolist())
    hv=np.array([float(h.get(d,0.0)) for d in days])
    rv=np.array([float(r.get(d,0.0)) for d in days])
    diff=rv-hv
    n=len(days)
    starts=np.arange(max(1,n-BLOCK_DAYS+1))
    rng=np.random.default_rng(SEED)
    vals=[]
    for _ in range(N_BOOT):
        idx=[]
        while len(idx)<n:
            s=int(rng.choice(starts))
            idx.extend(range(s,min(n,s+BLOCK_DAYS)))
        idx=np.asarray(idx[:n],int)
        vals.append(float(diff[idx].sum()))
    a=np.asarray(vals,float)
    return {
        "replications":N_BOOT,
        "point_total_delta_r":float(diff.sum()),
        "bootstrap_mean":float(a.mean()),
        "ci_low":float(np.quantile(a,.025)),
        "ci_high":float(np.quantile(a,.975)),
    }

def classify(hold_m,rep_m,hold_port,rep_port,seg_delta,switches,boot):
    seg_counts=switches.segment.value_counts().to_dict() if len(switches) else {}
    sample_pass=(len(switches)>=50 and all(int(seg_counts.get(s,0))>=10 for s in ["2018-2022","2023-2024","2025-2026"]))
    lam=rep_m["gross_nominal_risk_deployed"]/hold_m["gross_nominal_risk_deployed"]
    gross_hold_total=hold_m["total_r"]*lam
    raw_delta=rep_m["total_r"]-hold_m["total_r"]
    gross_delta=rep_m["total_r"]-gross_hold_total
    eff_delta=rep_m["efficiency"]-hold_m["efficiency"]
    dd_pass=abs(rep_port["mtm_max_drawdown_r"])<=1.10*abs(hold_port["mtm_max_drawdown_r"])
    nonneg=int((seg_delta.delta_r>=-EPS).sum())
    worst=float(seg_delta.delta_r.min()) if len(seg_delta) else -np.inf
    seg_pass=(nonneg>=2 and worst>=-5.0)
    ci_pass=boot["ci_low"]>0

    detail={
        "minimum_switch_sample_pass":bool(sample_pass),
        "switch_cycles_total":int(len(switches)),
        "switch_cycles_by_segment":{k:int(v) for k,v in seg_counts.items()},
        "lambda_gross":float(lam),
        "raw_delta_r":float(raw_delta),
        "gross_risk_matched_hold_total_r":float(gross_hold_total),
        "delta_vs_gross_risk_matched_hold_r":float(gross_delta),
        "efficiency_delta":float(eff_delta),
        "dd_pass":bool(dd_pass),"segment_pass":bool(seg_pass),
        "bootstrap_ci_lower_positive":bool(ci_pass),
    }
    if not sample_pass:
        return "INCONCLUSIVE",detail
    if raw_delta<=0 or gross_delta<=0 or eff_delta<=0:
        return "KEEP_HOLD_PRIORITY",detail
    if eff_delta>=0.01 and dd_pass and seg_pass and ci_pass:
        return "REPLACE_PRIORITY_CANDIDATE",detail
    return "INCONCLUSIVE",detail

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    print("building corrected M5 context",flush=True)
    m5,m15,h1,_=audit.aggregate_all(ROOT)
    x,h=audit.build_context(m5,m15,h1)

    events=prepare_event_stream(x)
    resolver_hold=audit.M1Resolver(ROOT)
    hold,ref,hold_exec,recon=rebuild_hold(events,x,resolver_hold)
    print("HOLD_RECON",json.dumps(recon),flush=True)

    resolver_replace=audit.M1Resolver(ROOT)
    replace_trades,replace_cycles,switches,ledger=simulate_replace(events,x,resolver_replace)
    hold_trades=add_hold_trade_fields(hold,x)
    hold_cycles=hold_cycles_from_trades(hold)

    # Invariants.
    inv={
        "hold_reconstruction_pass":bool(recon["all_pass"]),
        "replace_max_one_switch_per_cycle":bool((switches.cycle_id.value_counts().max()<=1) if len(switches) else True),
        "replace_max_risk_weight_le_1":bool((replace_trades.risk_weight<=1.0+EPS).all()),
        "replacement_horizon_cap":bool((switches.replacement_exit_available_t<=switches.replacement_horizon_cap_t).all()) if len(switches) else True,
        "no_budget_refill":bool((switches.replacement_risk_weight<=1.0+EPS).all()) if len(switches) else True,
    }
    if not all(inv.values()):
        raise RuntimeError("Invariant failure "+json.dumps(inv))

    hold_m=policy_metrics(hold_trades,hold_cycles)
    rep_m=policy_metrics(replace_trades,replace_cycles)

    hold_curve,hold_port=e6.portfolio_curve_weighted(hold_trades,m5,"HOLD")
    rep_curve,rep_port=e6.portfolio_curve_weighted(replace_trades,m5,"REPLACE")

    hold_year=policy_by_group(hold_cycles,"cycle_start_year")
    rep_year=policy_by_group(replace_cycles,"cycle_start_year")
    y=hold_year.merge(rep_year,on="cycle_start_year",how="outer",suffixes=("_hold","_replace")).fillna(0)
    y["delta_r"]=y.total_r_replace-y.total_r_hold

    hold_seg=policy_by_group(hold_cycles,"segment")
    rep_seg=policy_by_group(replace_cycles,"segment")
    s=hold_seg.merge(rep_seg,on="segment",how="outer",suffixes=("_hold","_replace")).fillna(0)
    s["delta_r"]=s.total_r_replace-s.total_r_hold

    boot=bootstrap_daily_diff(hold_trades,replace_trades,m5)
    klass,detail=classify(hold_m,rep_m,hold_port,rep_port,s,switches,boot)

    # Direct same-initial-signal local cycle delta for concentration diagnostic.
    hmap=hold_cycles.set_index("cycle_start_signal_t").cycle_pnl_r.to_dict()
    sw=replace_cycles[replace_cycles.switched].copy()
    sw["same_initial_hold_r"]=sw.cycle_start_signal_t.map(hmap)
    sw["local_cycle_delta_r"]=sw.cycle_pnl_r-sw.same_initial_hold_r
    local=sw.local_cycle_delta_r.dropna().sort_values(ascending=False)
    concentration={
        "switched_cycles":int(len(sw)),
        "local_delta_sum_r":float(local.sum()) if len(local) else 0.0,
        "top5_local_delta_r":float(local.head(5).sum()) if len(local) else 0.0,
        "top10_local_delta_r":float(local.head(10).sum()) if len(local) else 0.0,
        "best_local_delta_r":float(local.iloc[0]) if len(local) else None,
        "worst_local_delta_r":float(local.iloc[-1]) if len(local) else None,
        "note":"Local same-initial-cycle deltas are descriptive and need not sum to full portfolio delta because replacement changes downstream occupancy."
    }

    # Event accounting.
    if len(ledger):
        screen_counts=ledger.screen_result.value_counts().to_dict()
    else:
        screen_counts={}
    event_rec=pd.DataFrame([
        {"metric":"state_eligible_events", "value":int(len(events))},
        {"metric":"permission_on_events", "value":int(events.permission_on.sum())},
        {"metric":"geometry_valid_events", "value":int(events.candidate_valid.sum())},
        {"metric":"hold_selected_events", "value":int(hold_exec["selected"])},
        {"metric":"hold_overlap_skips", "value":int(hold_exec["overlap"])},
        {"metric":"hold_executed", "value":int(hold_exec["executed"])},
        {"metric":"replace_cycles", "value":int(len(replace_cycles))},
        {"metric":"replace_switch_cycles", "value":int(len(switches))},
    ])
    for k,v in screen_counts.items():
        event_rec.loc[len(event_rec)]={"metric":"screen_"+str(k),"value":int(v)}

    # Switch-cycle double-loss and replacement outcomes.
    if len(switches):
        switches=switches.merge(
            sw[["cycle_id","cycle_pnl_r","same_initial_hold_r","local_cycle_delta_r"]],
            on="cycle_id",how="left"
        )
        switches["first_leg_loss"]=(switches.first_leg_mark_r<0)
        switches["replacement_loss"]=(switches.replacement_scaled_pnl_r<0)
        switches["both_legs_loss"]=switches.first_leg_loss&switches.replacement_loss

    # Outputs.
    event_rec.to_csv(OUT/"event_reconciliation.csv",index=False)
    hold_trades.to_csv(OUT/"hold_trades.csv",index=False)
    replace_trades.to_csv(OUT/"replace_trades.csv",index=False)
    hold_cycles.to_csv(OUT/"hold_cycles.csv",index=False)
    replace_cycles.to_csv(OUT/"replace_cycles.csv",index=False)
    switches.to_csv(OUT/"switch_decisions.csv",index=False)
    ledger.to_csv(OUT/"event_screen_ledger.csv",index=False)
    sw.to_csv(OUT/"cycle_delta_summary.csv",index=False)
    y.to_csv(OUT/"yearly_policy_summary.csv",index=False)
    s.to_csv(OUT/"segment_policy_summary.csv",index=False)
    hold_curve.to_csv(OUT/"portfolio_mtm_hold.csv",index=False)
    rep_curve.to_csv(OUT/"portfolio_mtm_replace.csv",index=False)
    (OUT/"bootstrap_summary.json").write_text(json.dumps(boot,indent=2),encoding="utf-8")

    lam=rep_m["gross_nominal_risk_deployed"]/hold_m["gross_nominal_risk_deployed"]
    summary={
        "scope":"Hold vs Fresh-Reclaim Replace Priority v0.1",
        "protocol_commit":"fa4a842",
        "base_commit":"c4c95b8",
        "pristine_forward_oos_read":False,
        "cost_contract":"historical quoted spread included via Ask entry/Bid exit including atomic switch; commission/financing excluded",
        "hold_reconstruction":recon,
        "invariants":inv,
        "hold_metrics":hold_m,
        "replace_metrics":rep_m,
        "hold_portfolio":hold_port,
        "replace_portfolio":rep_port,
        "lambda_gross_risk_match":float(lam),
        "gross_risk_matched_hold_total_r":float(hold_m["total_r"]*lam),
        "delta_vs_hold_r":float(rep_m["total_r"]-hold_m["total_r"]),
        "delta_vs_gross_risk_matched_hold_r":float(rep_m["total_r"]-hold_m["total_r"]*lam),
        "efficiency_delta":float(rep_m["efficiency"]-hold_m["efficiency"]),
        "switch_count":int(len(switches)),
        "switch_by_segment":{k:int(v) for k,v in switches.segment.value_counts().to_dict().items()} if len(switches) else {},
        "screen_counts":{str(k):int(v) for k,v in screen_counts.items()},
        "switch_outcomes":{
            "both_legs_loss_rate":float(switches.both_legs_loss.mean()) if len(switches) else None,
            "replacement_positive_rate":float((switches.replacement_scaled_pnl_r>0).mean()) if len(switches) else None,
            "replacement_target_rate":float(switches.replacement_exit_kind.astype(str).str.contains("TARGET").mean()) if len(switches) else None,
        },
        "concentration":concentration,
        "bootstrap":boot,
        "segment_results":s.to_dict(orient="records"),
        "yearly_results":y.to_dict(orient="records"),
        "classification":klass,
        "classification_detail":detail,
    }
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2,default=str),encoding="utf-8")

    print("CLASSIFICATION",klass,json.dumps(detail),flush=True)
    print("HOLD",json.dumps(hold_m),flush=True)
    print("REPLACE",json.dumps(rep_m),flush=True)
    print("PORT",json.dumps({"hold":hold_port,"replace":rep_port}),flush=True)
    print("BOOT",json.dumps(boot),flush=True)

if __name__=="__main__":
    main()
