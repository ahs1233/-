from pathlib import Path
import json, sys
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
OUT=GTG/'runs'/'market-state-management-v01'
sys.path.insert(0,str(HERE.parent))
from linked_h1_m15_m5_entry_v01 import aggregate, build_context
from m5_transition_state_machine_v01 import detect_events

FEATURES=[
 'm5_close_location','m5_drift3_h1atr','m5_drift12_h1atr','m5_eff12',
 'm15_close_location','m15_drift4_h1atr','m15_drift20_h1atr','m15_eff4','m15_eff20',
 'h1_close_location','h1_drift5_atr','h1_eff5','h1_pos24','h1_decline24_atr'
]

ENGINES={
 'scalper':{'rule':'HIGHER_LOW_BREAK','stop_mult':0.75,'target_mult':1.5,'timeout':144,'min_train':80,'min_val':30},
 'swing':{'rule':'HIGH_RECLAIM','stop_mult':1.0,'target_mult':4.0,'timeout':864,'min_train':50,'min_val':20}
}
MGMT=['FIXED','PROTECT_HALF','HALF_OUT_PROTECT']

def fit_states(x):
    d=x.copy()
    d['dt']=pd.to_datetime(d.t,unit='ms',utc=True)
    d['year']=d.dt.dt.year
    train=d[d.year<=2022]
    pipe=Pipeline([
      ('imp',SimpleImputer(strategy='median')),
      ('scale',StandardScaler()),
      ('km',KMeans(n_clusters=6,random_state=42,n_init=25))
    ])
    pipe.fit(train[FEATURES])
    d['state_id']=pipe.predict(d[FEATURES])
    imp=pipe.named_steps['imp']; scale=pipe.named_steps['scale']; km=pipe.named_steps['km']
    centers=scale.inverse_transform(km.cluster_centers_)
    center_df=pd.DataFrame(centers,columns=FEATURES)
    center_df.insert(0,'state_id',range(len(center_df)))
    return d,center_df

def state_name(row):
    h=float(row.h1_drift5_atr); m15=float(row.m15_drift4_h1atr); m5=float(row.m5_drift12_h1atr)
    eff=float(row.h1_eff5); pos=float(row.h1_pos24)
    if h < -0.8 and m15 < -0.2: return 'STRONG_DOWN'
    if h < -0.3 and m15 >= -0.2 and m5 > -0.2: return 'DOWN_WEAKENING'
    if m15 > 0.15 and m5 > 0.1: return 'REVERSAL_UP'
    if abs(h) < 0.45 and eff < 0.45: return 'RANGE_CHOP'
    if h > 0.25: return 'UP_PULLBACK'
    if pos < 0.35: return 'LOW_TRANSITION'
    return 'MIXED_TRANSITION'

def attach_states(events,xs):
    cols=['t','state_id']+FEATURES
    z=xs[cols].rename(columns={'t':'signal_t'})
    e=events.merge(z,on='signal_t',how='left')
    e['dt']=pd.to_datetime(e.signal_t,unit='ms',utc=True); e['year']=e.dt.dt.year
    return e

def metrics(df):
    if len(df)==0:return {'n':0,'total_r':0.0,'mean_r':None,'profit_factor':None,'max_drawdown_r':None,'win_rate':None,'avg_entry_rr':None}
    v=df.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':int(len(df)),'total_r':float(v.sum()),'mean_r':float(v.mean()),
            'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
            'max_drawdown_r':float((eq-peak).min()),'win_rate':float((v>0).mean()),
            'avg_entry_rr':float(df.entry_rr.mean()),
            'exit_counts':{str(k):int(vv) for k,vv in df.exit_kind.value_counts().items()}}

def simulate(events,x,sm,tm,timeout,policy,allowed_states=None,engine=''):
    o=x.bo.to_numpy(float); h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); t=x.t.to_numpy(np.int64)
    rows=[]; next_free=0; invalid=0
    for r in events.sort_values('signal_idx').itertuples(index=False):
        if allowed_states is not None and int(r.state_id) not in allowed_states: continue
        sig=int(r.signal_idx)
        if sig<next_free or sig+1>=len(x): continue
        entry=sig+1; ep=float(o[entry]); a=float(r.atr_h1); low0=float(r.anchor_low)
        stop0=low0-sm*a; target=low0+tm*a
        if not(stop0<ep<target):
            invalid+=1; continue
        risk=ep-stop0; rr=(target-ep)/risk
        protect_level=ep+0.5*(target-ep)
        stop=stop0; protect_active=False; trigger_next=False; partial_done=False
        realized=0.0; remaining=1.0
        ex=None; xp=None; kind=None; pnl=None
        for j in range(entry,min(len(x),entry+timeout)):
            oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
            if trigger_next:
                stop=max(stop,ep); protect_active=True; trigger_next=False
            # gaps / exits under current stop-target
            if oj<=stop:
                ex=j; xp=oj; kind='STOP_GAP' if stop<ep else 'BE_GAP'
                pnl=realized+remaining*((oj-ep)/risk); break
            if oj>=target:
                ex=j; xp=oj; kind='TARGET_GAP'
                pnl=realized+remaining*((oj-ep)/risk); break
            if lj<=stop and hj>=target:
                ex=j; xp=stop; kind='STOP_BOTH'
                pnl=realized+remaining*((stop-ep)/risk); break
            if lj<=stop:
                ex=j; xp=stop; kind='BE' if stop>=ep else 'STOP'
                pnl=realized+remaining*((stop-ep)/risk); break
            if hj>=target:
                ex=j; xp=target; kind='TARGET'
                pnl=realized+remaining*((target-ep)/risk); break
            # management threshold is observed only after checking original/current exits
            if policy!='FIXED' and (not protect_active) and (not trigger_next) and hj>=protect_level:
                if policy=='HALF_OUT_PROTECT' and not partial_done:
                    realized += 0.5*((protect_level-ep)/risk)
                    remaining=0.5; partial_done=True
                trigger_next=True
        if ex is None:
            j=entry+timeout-1
            if j+1>=len(x): continue
            ex=j+1; xp=float(o[ex]); kind=f'{timeout}BAR_TIMEOUT'
            pnl=realized+remaining*((xp-ep)/risk)
        rows.append({
          'engine':engine,'policy':policy,'state_id':int(r.state_id),'year':int(r.year),
          'signal_t':int(r.signal_t),'entry_t':int(t[entry]),'exit_t':int(t[ex]),
          'entry_px':ep,'stop_px':stop0,'target_px':target,'exit_px':float(xp),
          'entry_rr':float(rr),'pnl_r':float(pnl),'exit_kind':kind
        })
        next_free=ex+1
    return pd.DataFrame(rows),invalid

def split(df):
    return {
      'train':metrics(df[df.year<=2022].sort_values('signal_t')),
      'validation':metrics(df[df.year.isin([2023,2024])].sort_values('signal_t')),
      'consumed_2025_2026':metrics(df[df.year>=2025].sort_values('signal_t')),
      'all':metrics(df.sort_values('signal_t'))
    }

def yearly(df):
    out={}
    for yr,g in df[df.year>=2025].groupby('year'):
        out[str(int(yr))]=metrics(g.sort_values('signal_t'))
    return out

def positive(m,min_n):
    return m['n']>=min_n and m['mean_r'] is not None and m['mean_r']>0 and m['profit_factor'] is not None and m['profit_factor']>1

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5=aggregate(ROOT,5); m15=aggregate(ROOT,15); h1=aggregate(ROOT,60)
    x=build_context(m5,m15,h1)
    xs,centers=fit_states(x)
    centers['state_name']=centers.apply(state_name,axis=1)
    centers.to_csv(OUT/'state_centers.csv',index=False)
    print('bars',len(m5),len(m15),len(h1),flush=True)
    print(centers[['state_id','state_name']].to_string(index=False),flush=True)

    payload={'scope':'Market State Engine + Management v0.1','pristine_forward_oos_read':False,
             'historical_2025_2026_status':'CONSUMED_DIAGNOSTIC_ONLY',
             'state_centers':centers.to_dict(orient='records'),'engines':{}}

    for engine,spec in ENGINES.items():
        ev=detect_events(x,spec['rule'])
        ev=attach_states(ev,xs)
        ev.to_csv(OUT/f'{engine}_events_with_state.csv',index=False)
        fixed_all,_=simulate(ev,x,spec['stop_mult'],spec['target_mult'],spec['timeout'],'FIXED',None,engine)
        state_stats={}
        accepted=[]
        for sid in sorted(ev.state_id.dropna().astype(int).unique()):
            g=fixed_all[fixed_all.state_id==sid]
            sp=split(g)
            ok=positive(sp['train'],spec['min_train']) and positive(sp['validation'],spec['min_val'])
            state_stats[str(sid)]={'accepted':bool(ok),**sp}
            if ok: accepted.append(int(sid))
        print(engine,'accepted_states',accepted,flush=True)

        mgmt_results=[]
        trade_map={}
        for pol in MGMT:
            tr,inv=simulate(ev,x,spec['stop_mult'],spec['target_mult'],spec['timeout'],pol,set(accepted),engine)
            tr.to_csv(OUT/f'{engine}_{pol.lower()}_gated_trades.csv',index=False)
            sp=split(tr)
            ok=positive(sp['train'],spec['min_train']) and positive(sp['validation'],spec['min_val'])
            rec={'policy':pol,'invalid':inv,'eligible':bool(ok),**sp}
            if ok:
                rec['worst_mean']=min(sp['train']['mean_r'],sp['validation']['mean_r'])
                rec['worst_dd_abs']=max(abs(sp['train']['max_drawdown_r']),abs(sp['validation']['max_drawdown_r']))
            mgmt_results.append(rec); trade_map[pol]=tr

        elig=[r for r in mgmt_results if r['eligible']]
        elig.sort(key=lambda z:(z['worst_mean'],-z['worst_dd_abs']),reverse=True)
        sel=elig[0]['policy'] if elig else None
        frozen=None
        if sel:
            df=trade_map[sel]
            frozen={'policy':sel,'metrics':split(df),'yearly_consumed':yearly(df)}
        payload['engines'][engine]={
          'frozen_entry_rule':spec['rule'],'state_stats':state_stats,'accepted_states':accepted,
          'management_candidates':mgmt_results,'selected_management':sel,'frozen':frozen
        }
    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
