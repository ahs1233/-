from pathlib import Path
import json, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
SRC=GTG/'runs'/'wave-regime-control-transfer-v01'
OUT=GTG/'runs'/'integrated-decision-architecture-v01'
sys.path.insert(0,str(HERE.parent))

from linked_h1_m15_m5_entry_v01 import aggregate
from state_evolution_v01 import simulate_selected
from regime_health_riskoff_v04 import apply_health, metrics

SCALP_Q60=0.6476279441988548
SWING_Q50=0.3452352635993130
SWING_Q60=0.3638891877385444

SPECS={
 'scalper':{'stop_mult':0.75,'target_mult':1.5,'timeout':144},
 'swing':{'stop_mult':1.0,'target_mult':4.0,'timeout':864}
}

def group_metrics(df,col):
    out={}
    if len(df)==0:return out
    for k,g in df.groupby(col):
        out[str(k)]=metrics(g.sort_values('signal_t'))
    return out

def add_calendar(df):
    d=df.copy()
    if not len(d):return d
    dt=pd.to_datetime(d.signal_t,unit='ms',utc=True)
    d['year']=dt.dt.year
    d['quarter_key']=dt.dt.year.astype(str)+'Q'+dt.dt.quarter.astype(str)
    return d

def swing_permission(features):
    f=features.sort_values('signal_t').copy().reset_index(drop=True)
    roll=f.score.rolling(3,min_periods=3).mean()
    on=False; states=[]; transitions=0
    for i,m in enumerate(roll):
        prev=on
        if np.isfinite(m):
            if (not on) and m>=SWING_Q60:
                on=True
            elif on and m<=SWING_Q50:
                on=False
        if on!=prev: transitions+=1
        states.append(bool(on))
    f['wave_mean3']=roll
    f['permission_on']=states
    return f,transitions

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5=aggregate(ROOT,5)
    print('m5 bars',len(m5),flush=True)
    payload={'scope':'Integrated Decision Architecture v0.1',
             'pristine_forward_oos_read':False,
             'health':{'window':20,'loss_r_threshold':-5.0,'pf_floor':0.80},
             'engines':{}}

    # ---------- SCALPER ----------
    sf=pd.read_csv(SRC/'scalper_features_scores.csv')
    sf=sf[np.isfinite(sf.score)].copy()
    selected=sf[sf.score>=SCALP_Q60].copy()
    allowed=set(selected.signal_t.astype(np.int64).tolist())
    shadow=simulate_selected(sf,m5,SPECS['scalper'],allowed,'scalper')
    shadow=add_calendar(shadow)
    full,live,skipped=apply_health(shadow)
    full=add_calendar(full); live=add_calendar(live); skipped=add_calendar(skipped)
    full.to_csv(OUT/'scalper_shadow_health_decisions.csv',index=False)
    live.to_csv(OUT/'scalper_live_trades.csv',index=False)
    skipped.to_csv(OUT/'scalper_skipped_trades.csv',index=False)

    payload['engines']['scalper']={
      'eligible_events':int(len(sf)),
      'control_transfer_selected_events':int(len(selected)),
      'threshold':SCALP_Q60,
      'shadow':metrics(full),
      'live':metrics(live),
      'skipped':{'n':int(len(skipped)),
                 'fraction':float(len(skipped)/len(full)) if len(full) else 0.0,
                 'shadow_total_r':float(skipped.pnl_r.sum()) if len(skipped) else 0.0},
      'shadow_yearly':group_metrics(full,'year'),
      'live_yearly':group_metrics(live,'year')
    }

    # ---------- SWING ----------
    wf=pd.read_csv(SRC/'swing_features_scores.csv')
    wf=wf[np.isfinite(wf.score)].copy()
    perm,transitions=swing_permission(wf)
    selected_w=perm[perm.permission_on].copy()
    allowed_w=set(selected_w.signal_t.astype(np.int64).tolist())
    shadow_w=simulate_selected(wf,m5,SPECS['swing'],allowed_w,'swing')
    shadow_w=add_calendar(shadow_w)
    full_w,live_w,skipped_w=apply_health(shadow_w)
    full_w=add_calendar(full_w); live_w=add_calendar(live_w); skipped_w=add_calendar(skipped_w)
    perm.to_csv(OUT/'swing_wave_permission_events.csv',index=False)
    full_w.to_csv(OUT/'swing_shadow_health_decisions.csv',index=False)
    live_w.to_csv(OUT/'swing_live_trades.csv',index=False)
    skipped_w.to_csv(OUT/'swing_skipped_trades.csv',index=False)

    payload['engines']['swing']={
      'eligible_events':int(len(wf)),
      'permission_events':int(len(selected_w)),
      'permission_fraction':float(len(selected_w)/len(wf)) if len(wf) else 0.0,
      'permission_transitions':int(transitions),
      'hysteresis':{'q50':SWING_Q50,'q60':SWING_Q60,'rolling_events':3},
      'shadow':metrics(full_w),
      'live':metrics(live_w),
      'skipped':{'n':int(len(skipped_w)),
                 'fraction':float(len(skipped_w)/len(full_w)) if len(full_w) else 0.0,
                 'shadow_total_r':float(skipped_w.pnl_r.sum()) if len(skipped_w) else 0.0},
      'shadow_yearly':group_metrics(full_w,'year'),
      'live_yearly':group_metrics(live_w,'year')
    }

    # combined R bookkeeping, independent 1R risk per executed trade
    combined=pd.concat([
      live.assign(engine='scalper'),
      live_w.assign(engine='swing')
    ],ignore_index=True).sort_values('signal_t')
    combined.to_csv(OUT/'combined_live_trades.csv',index=False)
    payload['combined']={
      'note':'Independent 1R risk units per engine trade; concurrent trades are allowed.',
      'metrics':metrics(combined),
      'yearly':group_metrics(combined,'year')
    }

    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
