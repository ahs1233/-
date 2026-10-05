from pathlib import Path
import sys, json
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
EXP1=GTG/"runs"/"measurement-execution-audit-v01"
OUT=GTG/"runs"/"reentry-capture-precheck"
sys.path.insert(0,str(TOOLS))
import measurement_execution_audit_v01 as audit

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5,m15,h1,_=audit.aggregate_all(ROOT)
    x,h=audit.build_context(m5,m15,h1)
    xs,_=audit.fit_states(x)

    spec=audit.SPECS["swing"]
    ev=audit.attach_states(audit.detect_events(x,spec["rule"]),xs)
    ev=ev[ev.state_id.isin(spec["states"])].copy()
    perm=pd.read_csv(EXP1/"swing_permission_full_event_stream.csv",usecols=["signal_t","permission_on"])
    ev=ev.merge(perm,on="signal_t",how="left",validate="one_to_one")
    if len(ev)!=len(perm):
        raise RuntimeError(f"event count mismatch regenerated={len(ev)} permission={len(perm)}")
    mt=x.t.to_numpy(np.int64)
    ao=x.ao.to_numpy(float)
    ev["episode_start_t"]=[int(mt[int(i)]) for i in ev.episode_start_idx]
    ev["anchor_t"]=[int(mt[int(i)]) for i in ev.anchor_idx]
    ev["candidate_entry_t"]=[int(mt[int(i)+1]) if int(i)+1<len(mt) else np.nan for i in ev.signal_idx]
    ev["candidate_entry_ask"]=[float(ao[int(i)+1]) if int(i)+1<len(ao) else np.nan for i in ev.signal_idx]
    ev["candidate_stop"]=ev.anchor_low-ev.atr_h1
    ev["candidate_target"]=ev.anchor_low+4.0*ev.atr_h1
    ev["ask_executable"]=(ev.candidate_entry_ask>ev.candidate_stop)&(ev.candidate_entry_ask<ev.candidate_target)

    shadow=pd.read_csv(EXP1/"swing_corrected_shadow_trades.csv")
    shadow_signals=set(shadow.signal_t.astype(np.int64))
    shadow["stop_first"]=shadow.exit_kind.astype(str).str.upper().str.contains("STOP")
    stops=shadow[shadow.stop_first].copy().reset_index(drop=True)
    m5_idx={int(t):i for i,t in enumerate(m5.t.astype(np.int64))}
    hends=[]
    for r in stops.itertuples(index=False):
        i=m5_idx.get(int(r.entry_t))
        if i is None or i+864>=len(m5):
            hends.append(np.nan)
        else:
            hends.append(int(m5.t.iloc[i+864]))
    stops["idea_horizon_end_t"]=hends
    stops["idea_id"]=["IDEA_"+str(int(s)) for s in stops.signal_t]

    unique_event_ids=set()
    qualifying_rows=[]
    idea_rows=[]
    for idea in stops.itertuples(index=False):
        if not np.isfinite(idea.idea_horizon_end_t):
            idea_rows.append({"idea_id":idea.idea_id,"horizon_complete":False})
            continue
        mask=(
            (ev.episode_start_t>=int(idea.exit_available_t)) &
            (ev.signal_t>int(idea.exit_available_t)) &
            (ev.candidate_entry_t<int(idea.idea_horizon_end_t))
        )
        q=ev.loc[mask].copy()
        fresh_n=len(q)
        pe=q[q.permission_on.fillna(False)&q.ask_executable].copy()
        cap=pe[pe.signal_t.isin(shadow_signals)]
        new=pe[~pe.signal_t.isin(shadow_signals)]
        unique_event_ids.update(int(v) for v in q.signal_t)
        for rr in pe.itertuples(index=False):
            qualifying_rows.append({
                "idea_id":idea.idea_id,
                "first_signal_t":int(idea.signal_t),
                "first_exit_t":int(idea.exit_available_t),
                "idea_horizon_end_t":int(idea.idea_horizon_end_t),
                "fresh_signal_t":int(rr.signal_t),
                "fresh_episode_start_t":int(rr.episode_start_t),
                "fresh_entry_t":int(rr.candidate_entry_t),
                "permission_on":bool(rr.permission_on),
                "ask_executable":bool(rr.ask_executable),
                "baseline_captured":bool(int(rr.signal_t) in shadow_signals),
            })
        idea_rows.append({
            "idea_id":idea.idea_id,"horizon_complete":True,
            "fresh_event_n":int(fresh_n),
            "permission_executable_n":int(len(pe)),
            "baseline_captured_n":int(len(cap)),
            "new_nonbaseline_n":int(len(new)),
            "has_permission_executable":bool(len(pe)),
            "has_new_nonbaseline":bool(len(new)),
        })

    unique_fresh=ev[ev.signal_t.isin(unique_event_ids)].copy()
    uqpe=unique_fresh[unique_fresh.permission_on.fillna(False)&unique_fresh.ask_executable].copy()
    uqcap=uqpe[uqpe.signal_t.isin(shadow_signals)]
    uqnew=uqpe[~uqpe.signal_t.isin(shadow_signals)]

    ideas=pd.DataFrame(idea_rows)
    links=pd.DataFrame(qualifying_rows)
    summary={
        "scope":"outcome-blind re-entry capture precheck",
        "pristine_forward_oos_read":False,
        "baseline_stopped_ideas":int(len(stops)),
        "complete_horizon_stopped_ideas":int(ideas.horizon_complete.sum()),
        "ideas_with_any_permission_executable_fresh_event":int(ideas.has_permission_executable.fillna(False).sum()) if "has_permission_executable" in ideas else 0,
        "ideas_with_any_new_nonbaseline_fresh_event":int(ideas.has_new_nonbaseline.fillna(False).sum()) if "has_new_nonbaseline" in ideas else 0,
        "unique_fresh_events_in_any_stopped_idea_window":int(len(unique_fresh)),
        "unique_permission_executable_fresh_events":int(len(uqpe)),
        "unique_already_captured_by_baseline":int(len(uqcap)),
        "unique_new_not_captured_by_baseline":int(len(uqnew)),
        "baseline_capture_share_of_permission_executable":float(len(uqcap)/len(uqpe)) if len(uqpe) else None,
        "note":"No second-attempt PnL/outcome was evaluated."
    }
    ideas.to_csv(OUT/"idea_fresh_event_counts.csv",index=False)
    links.to_csv(OUT/"permission_executable_fresh_event_links.csv",index=False)
    uqpe[["signal_t","episode_start_t","candidate_entry_t","permission_on","ask_executable"]].assign(
        baseline_captured=uqpe.signal_t.isin(shadow_signals).to_numpy()
    ).to_csv(OUT/"unique_permission_executable_fresh_events.csv",index=False)
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    print(json.dumps(summary,indent=2))

if __name__=="__main__":
    main()
