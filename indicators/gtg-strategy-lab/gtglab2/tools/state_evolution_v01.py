from pathlib import Path
import json, sys, math
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
OUT=GTG/'runs'/'state-evolution-v01'
sys.path.insert(0,str(HERE.parent))

from linked_h1_m15_m5_entry_v01 import aggregate, build_context
from m5_transition_state_machine_v01 import detect_events
from market_state_management_v01 import fit_states

ENGINES={
 'scalper':{'rule':'HIGHER_LOW_BREAK','states':{0,5},'stop_mult':0.75,'target_mult':1.5,'timeout':144},
 'swing':{'rule':'HIGH_RECLAIM','states':{0,4,5},'stop_mult':1.0,'target_mult':4.0,'timeout':864}
}

BASE_FEATURES=[
 'm5_drift_accel_15m','m5_drift_accel_60m','m5_eff_change_60m',
 'm15_drift_accel_1h','m15_drift_accel_5h','m15_eff_change_1h',
 'h1_drift_accel_5h','h1_eff_change_1h',
 'ret_24h_atr','ret_72h_atr','ret_120h_atr','eff_24h','eff_72h',
 'pos_120h','range_24h_atr','range_72h_atr','vol_ratio_1h_24h','down_frac_12h',
 'state_changes_1h','state_changes_3h','state_changed_vs_1h',
 'bars_from_anchor','recovery_anchor_atr','anchor_range_atr',
 'recovery_path_eff','bull_frac_anchor','higher_low_frac_anchor'
]

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

def rolling_eff(close,n):
    delta=close.diff().abs()
    path=delta.rolling(n,min_periods=n).sum()
    return (close-close.shift(n)).abs()/path.replace(0,np.nan)

def add_evolution(x):
    z=x.copy()
    c=z.bc.astype(float); h=z.bh.astype(float); l=z.bl.astype(float)
    atr=z.h1_atr.astype(float).replace(0,np.nan)
    d=c.diff()

    z['m5_drift_accel_15m']=z.m5_drift3_h1atr-z.m5_drift3_h1atr.shift(3)
    z['m5_drift_accel_60m']=z.m5_drift12_h1atr-z.m5_drift12_h1atr.shift(12)
    z['m5_eff_change_60m']=z.m5_eff12-z.m5_eff12.shift(12)

    z['m15_drift_accel_1h']=z.m15_drift4_h1atr-z.m15_drift4_h1atr.shift(12)
    z['m15_drift_accel_5h']=z.m15_drift20_h1atr-z.m15_drift20_h1atr.shift(12)
    z['m15_eff_change_1h']=z.m15_eff4-z.m15_eff4.shift(12)

    z['h1_drift_accel_5h']=z.h1_drift5_atr-z.h1_drift5_atr.shift(12)
    z['h1_eff_change_1h']=z.h1_eff5-z.h1_eff5.shift(12)

    z['ret_24h_atr']=(c-c.shift(288))/atr
    z['ret_72h_atr']=(c-c.shift(864))/atr
    z['ret_120h_atr']=(c-c.shift(1440))/atr
    z['eff_24h']=rolling_eff(c,288)
    z['eff_72h']=rolling_eff(c,864)

    hi120=h.rolling(1440,min_periods=1440).max()
    lo120=l.rolling(1440,min_periods=1440).min()
    z['pos_120h']=(c-lo120)/(hi120-lo120).replace(0,np.nan)

    hi24=h.rolling(288,min_periods=288).max(); lo24=l.rolling(288,min_periods=288).min()
    hi72=h.rolling(864,min_periods=864).max(); lo72=l.rolling(864,min_periods=864).min()
    z['range_24h_atr']=(hi24-lo24)/atr
    z['range_72h_atr']=(hi72-lo72)/atr

    vol1=d.rolling(12,min_periods=12).std()
    vol24=d.rolling(288,min_periods=288).std()
    z['vol_ratio_1h_24h']=vol1/vol24.replace(0,np.nan)
    z['down_frac_12h']=(d<0).astype(float).rolling(144,min_periods=144).mean()

    sid=z.state_id.astype(float)
    change=(sid!=sid.shift(1)).astype(float)
    z['state_changes_1h']=change.rolling(12,min_periods=12).sum()
    z['state_changes_3h']=change.rolling(36,min_periods=36).sum()
    z['state_changed_vs_1h']=(sid!=sid.shift(12)).astype(float)
    return z

def attach_event_features(ev,z):
    rows=[]
    for r in ev.itertuples(index=False):
        j=int(r.signal_idx); aidx=int(r.anchor_idx)
        if j>=len(z) or aidx<0 or aidx>j: continue
        row={'signal_t':int(r.signal_t),'signal_idx':j,'anchor_idx':aidx,'year':int(pd.to_datetime(r.signal_t,unit='ms',utc=True).year),
             'state_id':int(z.state_id.iloc[j]),'atr_h1':float(r.atr_h1),'anchor_low':float(r.anchor_low),
             'anchor_high':float(r.anchor_high)}
        for f in BASE_FEATURES[:21]:
            row[f]=float(z[f].iloc[j]) if pd.notna(z[f].iloc[j]) else np.nan
        atr=float(r.atr_h1)
        row['bars_from_anchor']=j-aidx
        row['recovery_anchor_atr']=(float(z.bc.iloc[j])-float(r.anchor_low))/atr if atr>0 else np.nan
        row['anchor_range_atr']=(float(r.anchor_high)-float(r.anchor_low))/atr if atr>0 else np.nan
        seg=z.iloc[aidx:j+1]
        closes=seg.bc.astype(float).to_numpy(); lows=seg.bl.astype(float).to_numpy()
        if len(closes)>=2:
            path=np.abs(np.diff(closes)).sum()
            row['recovery_path_eff']=abs(closes[-1]-closes[0])/path if path>0 else 0.0
            row['bull_frac_anchor']=float((np.diff(closes)>0).mean())
            row['higher_low_frac_anchor']=float((np.diff(lows)>0).mean())
        else:
            row['recovery_path_eff']=0.0; row['bull_frac_anchor']=0.0; row['higher_low_frac_anchor']=0.0
        rows.append(row)
    return pd.DataFrame(rows)

def single_outcome(r,x,spec):
    o=x.bo.to_numpy(float); h=x.bh.to_numpy(float); l=x.bl.to_numpy(float)
    sig=int(r.signal_idx)
    if sig+1>=len(x): return None
    entry=sig+1; ep=float(o[entry]); atr=float(r.atr_h1); low0=float(r.anchor_low)
    stop=low0-spec['stop_mult']*atr; target=low0+spec['target_mult']*atr
    if not(stop<ep<target): return None
    risk=ep-stop
    for j in range(entry,min(len(x),entry+spec['timeout'])):
        oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
        if oj<=stop:return (oj-ep)/risk
        if oj>=target:return (oj-ep)/risk
        if lj<=stop and hj>=target:return (stop-ep)/risk
        if lj<=stop:return (stop-ep)/risk
        if hj>=target:return (target-ep)/risk
    j=entry+spec['timeout']
    if j>=len(x): return None
    return (float(o[j])-ep)/risk

def simulate_selected(ev,x,spec,allowed_t,engine):
    o=x.bo.to_numpy(float); h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); t=x.t.to_numpy(np.int64)
    rows=[]; next_free=0
    for r in ev.sort_values('signal_idx').itertuples(index=False):
        if int(r.signal_t) not in allowed_t: continue
        sig=int(r.signal_idx)
        if sig<next_free or sig+1>=len(x): continue
        entry=sig+1; ep=float(o[entry]); atr=float(r.atr_h1); low0=float(r.anchor_low)
        stop=low0-spec['stop_mult']*atr; target=low0+spec['target_mult']*atr
        if not(stop<ep<target): continue
        risk=ep-stop; rr=(target-ep)/risk
        ex=None; xp=None; kind=None
        for j in range(entry,min(len(x),entry+spec['timeout'])):
            oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
            if oj<=stop: ex=j; xp=oj; kind='STOP_GAP'; break
            if oj>=target: ex=j; xp=oj; kind='TARGET_GAP'; break
            if lj<=stop and hj>=target: ex=j; xp=stop; kind='STOP_BOTH'; break
            if lj<=stop: ex=j; xp=stop; kind='STOP'; break
            if hj>=target: ex=j; xp=target; kind='TARGET'; break
        if ex is None:
            j=entry+spec['timeout']
            if j>=len(x): continue
            ex=j; xp=float(o[j]); kind=f"{spec['timeout']}BAR_TIMEOUT"
        rows.append({'engine':engine,'state_id':int(r.state_id),'year':int(r.year),'signal_t':int(r.signal_t),
                     'entry_t':int(t[entry]),'exit_t':int(t[ex]),'entry_rr':float(rr),
                     'pnl_r':float((float(xp)-ep)/risk),'exit_kind':kind})
        next_free=ex+1
    return pd.DataFrame(rows)

def split(df):
    return {
      'train':metrics(df[df.year<=2022].sort_values('signal_t')),
      'validation':metrics(df[df.year.isin([2023,2024])].sort_values('signal_t')),
      'consumed_2025_2026':metrics(df[df.year>=2025].sort_values('signal_t')),
      'all':metrics(df.sort_values('signal_t'))
    }

def yearly(df):
    out={}
    for y,g in df.groupby('year'):
        out[str(int(y))]=metrics(g.sort_values('signal_t'))
    return out

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5=aggregate(ROOT,5); m15=aggregate(ROOT,15); h1=aggregate(ROOT,60)
    x=build_context(m5,m15,h1)
    xs,centers=fit_states(x)
    z=add_evolution(xs)
    print('bars',len(m5),len(m15),len(h1),flush=True)

    payload={'scope':'State Evolution Engine v0.1','pristine_forward_oos_read':False,
             'threshold_rule':'60th percentile of TRAIN probabilities','engines':{}}

    for engine,spec in ENGINES.items():
        ev=detect_events(x,spec['rule'])
        # attach frozen state id at signal
        state_map=z[['t','state_id']].rename(columns={'t':'signal_t'})
        ev=ev.merge(state_map,on='signal_t',how='left')
        ev['year']=pd.to_datetime(ev.signal_t,unit='ms',utc=True).dt.year
        ev=ev[ev.state_id.isin(spec['states'])].copy()
        feats=attach_event_features(ev,z)
        if len(feats)==0: raise RuntimeError('no features')

        # Independent fixed-policy label for every eligible event.
        ev_idx=ev.set_index('signal_t')
        pnls=[]; valid=[]
        for row in feats.itertuples(index=False):
            rr=ev_idx.loc[int(row.signal_t)]
            if isinstance(rr,pd.DataFrame): rr=rr.iloc[0]
            pnl=single_outcome(rr,x,spec)
            pnls.append(np.nan if pnl is None else float(pnl)); valid.append(pnl is not None)
        feats['independent_pnl_r']=pnls
        feats=feats[np.isfinite(feats.independent_pnl_r)].copy()
        feats['label_positive']=(feats.independent_pnl_r>0).astype(int)

        train=feats[feats.year<=2022].copy()
        val=feats[feats.year.isin([2023,2024])].copy()
        cons=feats[feats.year>=2025].copy()

        pipe=Pipeline([
          ('imp',SimpleImputer(strategy='median')),
          ('scale',StandardScaler()),
          ('lr',LogisticRegression(C=1.0,max_iter=3000))
        ])
        pipe.fit(train[BASE_FEATURES],train.label_positive)
        for df in [train,val,cons,feats]:
            df['score']=pipe.predict_proba(df[BASE_FEATURES])[:,1]

        threshold=float(np.quantile(train.score,0.60))
        auc_train=float(roc_auc_score(train.label_positive,train.score))
        auc_val=float(roc_auc_score(val.label_positive,val.score))
        auc_cons=float(roc_auc_score(cons.label_positive,cons.score)) if len(cons.label_positive.unique())>1 else None

        score_map=feats.set_index('signal_t').score.to_dict()
        ev['score']=ev.signal_t.map(score_map)
        selected=ev[np.isfinite(ev.score) & (ev.score>=threshold)].copy()
        allowed=set(selected.signal_t.astype(np.int64).tolist())
        trades=simulate_selected(ev,x,spec,allowed,engine)
        trades.to_csv(OUT/f'{engine}_evolution_gated_trades.csv',index=False)
        feats.to_csv(OUT/f'{engine}_event_features_scores.csv',index=False)

        coef=pipe.named_steps['lr'].coef_[0]
        coefs=sorted([{'feature':f,'coefficient':float(c)} for f,c in zip(BASE_FEATURES,coef)],
                     key=lambda q:abs(q['coefficient']),reverse=True)

        score_year={}
        for y,g in feats.groupby('year'):
            score_year[str(int(y))]={
              'n_events':int(len(g)),'mean_score':float(g.score.mean()),
              'median_score':float(g.score.median()),
              'selected_fraction':float((g.score>=threshold).mean()),
              'positive_label_rate':float(g.label_positive.mean())
            }

        payload['engines'][engine]={
          'frozen_rule':spec['rule'],'frozen_states':sorted(spec['states']),
          'n_events':int(len(feats)),'threshold':threshold,
          'auc':{'train':auc_train,'validation':auc_val,'consumed_2025_2026':auc_cons},
          'execution':split(trades),'yearly_execution':yearly(trades),
          'score_by_year':score_year,'coefficients':coefs
        }
        print(engine,'auc',auc_train,auc_val,auc_cons,'threshold',threshold,flush=True)
        print(engine,'exec',json.dumps(split(trades)),flush=True)

    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
