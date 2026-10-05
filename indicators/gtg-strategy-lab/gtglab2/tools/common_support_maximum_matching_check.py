from pathlib import Path
import sys, json
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import maximum_bipartite_matching

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
TOOLS=HERE.parent
ROOT=Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
EXP1=GTG/"runs"/"measurement-execution-audit-v01"
OUT=GTG/"runs"/"common-support-failure-audit-v01"
sys.path.insert(0,str(TOOLS))

import measurement_execution_audit_v01 as audit
import swing_opportunity_path_diagnostic_v01 as exp2
import common_support_failure_audit_v01 as exp3

def max_cardinality(M):
    if M.size==0:
        return 0
    A=csr_matrix(M.astype(np.int8))
    # perm_type='column' returns one matched column per row, -1 if unmatched.
    matched=maximum_bipartite_matching(A,perm_type="column")
    return int(np.sum(matched!=-1))

def build():
    scales,_=exp3.load_scales()
    m5,m15,h1,_=audit.aggregate_all(ROOT)
    x,h=audit.build_context(m5,m15,h1)
    xs,state_pipe=audit.fit_states(x)
    h1ctx,_=exp2.build_h1_context(h)
    state_dist,state_q95=exp2.state_distance_lookup(xs,state_pipe)

    event_cols=["signal_t","signal_idx","anchor_idx","state_id","anchor_low","anchor_high","atr_h1"]
    events=pd.read_csv(EXP1/"swing_corrected_events.csv",usecols=event_cols)
    permission=pd.read_csv(EXP1/"swing_permission_full_event_stream.csv",usecols=["signal_t","permission_on"])
    shadow=pd.read_csv(EXP1/"swing_corrected_shadow_trades.csv",usecols=["signal_t","entry_t"])

    pre=exp3.build_preentry(events,x,h1ctx,state_dist,state_q95,permission,shadow)
    primary=pre[pre.in_shadow].copy().sort_values(["signal_t","row_id"]).reset_index(drop=True)
    primary["row_id"]=["P%06d"%i for i in range(len(primary))]
    supporting=pre[pre.preentry_executable].copy().sort_values(["signal_t","row_id"]).reset_index(drop=True)
    supporting["row_id"]=["E%06d"%i for i in range(len(supporting))]

    contrasts=[
        ("PRIMARY_2025_vs_2026",primary[exp3.period_mask(primary,"2025_full")].copy(),primary[exp3.period_mask(primary,"2026_jan_sep")].copy()),
        ("SEASONAL_2025JS_vs_2026",primary[exp3.period_mask(primary,"2025_jan_sep")].copy(),primary[exp3.period_mask(primary,"2026_jan_sep")].copy()),
        ("HIST_2023_2024_vs_2026",primary[exp3.period_mask(primary,"2023_2024")].copy(),primary[exp3.period_mask(primary,"2026_jan_sep")].copy()),
        ("EVENT_2025_vs_2026",supporting[exp3.period_mask(supporting,"2025_full")].copy(),supporting[exp3.period_mask(supporting,"2026_jan_sep")].copy()),
        ("EVENT_2025JS_vs_2026",supporting[exp3.period_mask(supporting,"2025_jan_sep")].copy(),supporting[exp3.period_mask(supporting,"2026_jan_sep")].copy()),
        ("EVENT_2023_2024_vs_2026",supporting[exp3.period_mask(supporting,"2023_2024")].copy(),supporting[exp3.period_mask(supporting,"2026_jan_sep")].copy()),
    ]
    rows=[]
    for label,donor,target in contrasts:
        for stage,subset in [("G",[]),("FULL",exp3.COMP)]:
            m=exp3.support_metrics(donor,target,subset,scales)
            maxm=max_cardinality(m["matrix"])
            rows.append({
                "contrast":label,"stage":stage,
                "donor_n":len(donor),"target_n":len(target),
                "feasible_targets":m["feasible_targets"],
                "feasible_target_coverage":m["feasible_target_coverage"],
                "greedy_matched":m["greedy_matched"],
                "greedy_target_coverage":m["greedy_target_coverage"],
                "maximum_cardinality_matched":maxm,
                "maximum_target_coverage":maxm/len(target) if len(target) else 0.0,
                "greedy_shortfall_vs_max":maxm-m["greedy_matched"],
                "greedy_shortfall_pp":(maxm-m["greedy_matched"])/len(target) if len(target) else 0.0,
                "unavoidable_unmatched_given_network":len(target)-maxm,
                "unavoidable_unmatched_fraction":(len(target)-maxm)/len(target) if len(target) else 0.0
            })
    df=pd.DataFrame(rows)
    df.to_csv(OUT/"maximum_cardinality_verification.csv",index=False)
    print(df.to_string(index=False))
    return df

if __name__=="__main__":
    build()
