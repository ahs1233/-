from pathlib import Path
import json, sys
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
SRC=GTG/'runs'/'state-evolution-v01'
OUT=GTG/'runs'/'state-evolution-quarterly-v03'
sys.path.insert(0,str(HERE.parent))
from linked_h1_m15_m5_entry_v01 import aggregate
from state_evolution_v01 import BASE_FEATURES

SPECS={
 'scalper':{'stop_mult':0.75,'target_mult':1.5,'timeout':144},
 'swing':{'stop_mult':1.0,'target_mult':4.0,'timeout':864}
}

def metrics(df):
    if len(df)==0:
        return {'n':0,'total_r':0.0,'mean_r':None,'profit_factor':None,'max_drawdown_r':None,'win_rate':None,'avg_entry_rr':None}
    v=df.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':int(len(df)),'total_r':float(v.sum()),'mean_r':float(v.mean()),
            'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
            'max_drawdown_r':float((eq-peak).min()),'win_rate':float((v>0).mean()),
            'avg_entry_rr':float(df.entry_rr.mean()),
            'exit_counts':{str(k):int(vv) for k,vv in df.exit_kind.value_counts().items()}}

def execute_all(events,m5,spec,allowed,engine):
    o=m5.bo.to_numpy(float); h=m5.bh.to_numpy(float); l=m5.bl.to_numpy(float); t=m5.t.to_numpy(np.int64)
    rows=[]; next_free=0
    for r in events.sort_values('signal_idx').itertuples(index=False):
        st=int(r.signal_t)
        if st not in allowed: continue
        sig=int(r.signal_idx)
        if sig<next_free or sig+1>=len(m5): continue
        entry=sig+1; ep=float(o[entry]); atr=float(r.atr_h1); low0=float(r.anchor_low)
        stop=low0-spec['stop_mult']*atr; target=low0+spec['target_mult']*atr
        if not(stop<ep<target): continue
        risk=ep-stop; rr=(target-ep)/risk
        ex=None; xp=None; kind=None
        for j in range(entry,min(len(m5),entry+spec['timeout'])):
            oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
            if oj<=stop: ex=j; xp=oj; kind='STOP_GAP'; break
            if oj>=target: ex=j; xp=oj; kind='TARGET_GAP'; break
            if lj<=stop and hj>=target: ex=j; xp=stop; kind='STOP_BOTH'; break
            if lj<=stop: ex=j; xp=stop; kind='STOP'; break
            if hj>=target: ex=j; xp=target; kind='TARGET'; break
        if ex is None:
            j=entry+spec['timeout']
            if j>=len(m5): continue
            ex=j; xp=float(o[j]); kind=f"{spec['timeout']}BAR_TIMEOUT"
        dt=pd.to_datetime(st,unit='ms',utc=True)
        rows.append({'engine':engine,'year':int(dt.year),'quarter':int(dt.quarter),
                     'quarter_key':f"{int(dt.year)}Q{int(dt.quarter)}",
                     'signal_t':st,'entry_t':int(t[entry]),'exit_t':int(t[ex]),
                     'entry_rr':float(rr),'pnl_r':float((float(xp)-ep)/risk),'exit_kind':kind})
        next_free=ex+1
    return pd.DataFrame(rows)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5=aggregate(ROOT,5)
    print('m5 bars',len(m5),flush=True)

    payload={'scope':'Quarterly Adaptive State Evolution v0.3','pristine_forward_oos_read':False,
             'training_quarters':4,'engines':{}}

    for engine,spec in SPECS.items():
        f=pd.read_csv(SRC/f'{engine}_event_features_scores.csv')
        f=f[np.isfinite(f.independent_pnl_r)].copy()
        f['label_positive']=(f.independent_pnl_r>0).astype(int)
        dt=pd.to_datetime(f.signal_t,unit='ms',utc=True)
        f['qnum']=dt.dt.year*4+(dt.dt.quarter-1)
        f['quarter_key']=dt.dt.year.astype(str)+'Q'+dt.dt.quarter.astype(str)

        start_q=2021*4
        end_q=2026*4+2  # Q3
        allowed=set()
        qdiag={}

        for q in range(start_q,end_q+1):
            tr=f[f.qnum.isin([q-4,q-3,q-2,q-1])].copy()
            te=f[f.qnum==q].copy()
            if len(tr)==0 or len(te)==0: continue

            pipe=Pipeline([
              ('imp',SimpleImputer(strategy='median')),
              ('scale',StandardScaler()),
              ('lr',LogisticRegression(C=1.0,max_iter=3000))
            ])
            pipe.fit(tr[BASE_FEATURES],tr.label_positive)
            trs=pipe.predict_proba(tr[BASE_FEATURES])[:,1]
            tes=pipe.predict_proba(te[BASE_FEATURES])[:,1]
            threshold=float(np.quantile(trs,0.60))
            te['wf_score']=tes
            sel=te[te.wf_score>=threshold]
            allowed.update(sel.signal_t.astype(np.int64).tolist())

            y=q//4; qq=(q%4)+1; key=f"{y}Q{qq}"
            auc=float(roc_auc_score(te.label_positive,tes)) if len(te.label_positive.unique())>1 else None
            coef=pipe.named_steps['lr'].coef_[0]
            cm={f0:float(c) for f0,c in zip(BASE_FEATURES,coef)}
            qdiag[key]={
              'train_quarters':[str(x) for x in sorted(tr.quarter_key.unique())],
              'threshold':threshold,'auc':auc,'n_events':int(len(te)),
              'selected_fraction':float(len(sel)/len(te)),
              'event_positive_rate':float(te.label_positive.mean()),
              'selected_positive_rate':float(sel.label_positive.mean()) if len(sel) else None,
              'key_coefficients':{
                'ret_120h_atr':cm['ret_120h_atr'],
                'ret_72h_atr':cm['ret_72h_atr'],
                'recovery_anchor_atr':cm['recovery_anchor_atr'],
                'eff_24h':cm['eff_24h'],
                'eff_72h':cm['eff_72h'],
                'm5_drift_accel_60m':cm['m5_drift_accel_60m']
              }
            }

        ev=f[['signal_t','signal_idx','anchor_idx','year','atr_h1','anchor_low','anchor_high']].copy()
        trades=execute_all(ev,m5,spec,allowed,engine)
        trades.to_csv(OUT/f'{engine}_quarterly_walkforward_trades.csv',index=False)

        qmetrics={}
        for key,g in trades.groupby('quarter_key',sort=False):
            qmetrics[str(key)]=metrics(g.sort_values('signal_t'))
        ymetrics={}
        for y,g in trades.groupby('year'):
            ymetrics[str(int(y))]=metrics(g.sort_values('signal_t'))

        payload['engines'][engine]={
          'quarter_diagnostics':qdiag,
          'quarter_execution':qmetrics,
          'yearly_execution':ymetrics,
          'aggregate':metrics(trades.sort_values('signal_t'))
        }
        print(engine,'aggregate',json.dumps(payload['engines'][engine]['aggregate']),flush=True)
        for key in ['2026Q1','2026Q2','2026Q3']:
            print(engine,key,'diag',json.dumps(qdiag.get(key)), 'exec',json.dumps(qmetrics.get(key)),flush=True)

    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
