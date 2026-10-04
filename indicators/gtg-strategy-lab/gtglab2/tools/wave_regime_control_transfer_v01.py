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
OUT=GTG/'runs'/'wave-regime-control-transfer-v01'
sys.path.insert(0,str(HERE.parent))

from linked_h1_m15_m5_entry_v01 import aggregate, build_context
from m5_transition_state_machine_v01 import detect_events
from market_state_management_v01 import fit_states
from state_evolution_v01 import single_outcome, simulate_selected, metrics, split, yearly

SPECS={
 'scalper':{'rule':'HIGHER_LOW_BREAK','states':{0,5},'stop_mult':0.75,'target_mult':1.5,'timeout':144},
 'swing':{'rule':'HIGH_RECLAIM','states':{0,4,5},'stop_mult':1.0,'target_mult':4.0,'timeout':864}
}

SCALP_FEATURES=[
'bars_from_anchor','recovery_anchor_atr','signal_pos_episode','bull_close_frac','higher_low_frac',
'higher_high_frac','close_above_prev_high_frac','positive_return_share','bull_body_share',
'ret_last3_atr','ret_last6_atr','half_return_improvement','half_downside_improvement',
'range_contraction_ratio','max_adverse_anchor_atr','anchor_mid_reclaim',
'm15_drift4_h1atr','m15_drift_change_1h','m5_drift12_h1atr','m5_drift_change_1h'
]

SWING_FEATURES=[
'ret24_atr','ret72_atr','ret120_atr','ret240_atr','eff24','eff72','eff120',
'pos72','pos120','pos240','dd72_atr','dd120_atr','dd240_atr',
'above_low72_atr','above_low120_atr','above_low240_atr',
'new24h_low_count_24h','new24h_low_count_72h','neg_h1_frac24','neg_h1_frac72',
'lower_low_frac24','lower_low_frac72','higher_high_frac24','higher_high_frac72',
'range_ratio_24_prev24','vol_ratio_24_prev24','recovery_from_72low_atr',
'bars_since_72low','recovery_vs_prior24_decline','ret6_vs_prev6','ret12_vs_prev12'
]

def rolling_eff(s,n):
    path=s.diff().abs().rolling(n,min_periods=n).sum()
    return (s-s.shift(n)).abs()/path.replace(0,np.nan)

def attach_states(ev,x):
    xs,_=fit_states(x)
    m=xs[['t','state_id']].rename(columns={'t':'signal_t'})
    e=ev.merge(m,on='signal_t',how='left')
    e['year']=pd.to_datetime(e.signal_t,unit='ms',utc=True).dt.year
    return e

def make_scalper_features(ev,x):
    rows=[]
    close=x.bc.astype(float).to_numpy(); high=x.bh.astype(float).to_numpy(); low=x.bl.astype(float).to_numpy(); op=x.bo.astype(float).to_numpy()
    for r in ev.itertuples(index=False):
        j=int(r.signal_idx); a=int(r.anchor_idx); atr=float(r.atr_h1)
        if a<0 or j<=a or atr<=0: continue
        cs=close[a:j+1]; hs=high[a:j+1]; ls=low[a:j+1]; os=op[a:j+1]
        ret=np.diff(cs)
        bodies=cs-os
        full_hi=float(np.max(hs)); full_lo=float(np.min(ls)); denom=max(full_hi-full_lo,1e-12)
        n=len(cs)
        mid=max(1,n//2)
        r1=np.diff(cs[:mid+1]) if mid>=1 else np.array([])
        r2=np.diff(cs[mid:]) if n-mid>=2 else np.array([])
        range1=float(np.max(hs[:mid+1])-np.min(ls[:mid+1])) if mid>=1 else np.nan
        range2=float(np.max(hs[mid:])-np.min(ls[mid:])) if n-mid>=2 else np.nan
        neg1=float(np.abs(np.minimum(r1,0)).sum()) if len(r1) else 0.
        neg2=float(np.abs(np.minimum(r2,0)).sum()) if len(r2) else 0.
        absret=float(np.abs(ret).sum())
        bodyabs=float(np.abs(bodies).sum())
        rows.append({
          'signal_t':int(r.signal_t),'signal_idx':j,'anchor_idx':a,'year':int(r.year),'state_id':int(r.state_id),
          'atr_h1':atr,'anchor_low':float(r.anchor_low),'anchor_high':float(r.anchor_high),
          'bars_from_anchor':j-a,
          'recovery_anchor_atr':(cs[-1]-float(r.anchor_low))/atr,
          'signal_pos_episode':(cs[-1]-full_lo)/denom,
          'bull_close_frac':float((ret>0).mean()) if len(ret) else 0.,
          'higher_low_frac':float((np.diff(ls)>0).mean()) if len(ls)>1 else 0.,
          'higher_high_frac':float((np.diff(hs)>0).mean()) if len(hs)>1 else 0.,
          'close_above_prev_high_frac':float((cs[1:]>hs[:-1]).mean()) if len(cs)>1 else 0.,
          'positive_return_share':float(np.maximum(ret,0).sum()/absret) if absret>0 else .5,
          'bull_body_share':float(np.maximum(bodies,0).sum()/bodyabs) if bodyabs>0 else .5,
          'ret_last3_atr':(cs[-1]-cs[max(0,n-4)])/atr,
          'ret_last6_atr':(cs[-1]-cs[max(0,n-7)])/atr,
          'half_return_improvement':(float(r2.sum()) if len(r2) else 0.)-(float(r1.sum()) if len(r1) else 0.),
          'half_downside_improvement':neg1-neg2,
          'range_contraction_ratio':(range2/range1) if range1 and np.isfinite(range1) and range1>0 and np.isfinite(range2) else np.nan,
          'max_adverse_anchor_atr':(float(r.anchor_low)-float(np.min(ls)))/atr,
          'anchor_mid_reclaim':(cs[-1]-((float(r.anchor_low)+float(r.anchor_high))/2.0))/max(float(r.anchor_high)-float(r.anchor_low),1e-12),
          'm15_drift4_h1atr':float(x.m15_drift4_h1atr.iloc[j]),
          'm15_drift_change_1h':float(x.m15_drift4_h1atr.iloc[j]-x.m15_drift4_h1atr.iloc[max(0,j-12)]),
          'm5_drift12_h1atr':float(x.m5_drift12_h1atr.iloc[j]),
          'm5_drift_change_1h':float(x.m5_drift12_h1atr.iloc[j]-x.m5_drift12_h1atr.iloc[max(0,j-12)])
        })
    return pd.DataFrame(rows)

def make_swing_frame(x):
    z=x.copy()
    c=z.bc.astype(float); h=z.bh.astype(float); l=z.bl.astype(float); atr=z.h1_atr.astype(float).replace(0,np.nan)
    # M5 bars: 12/hour
    for hrs in [24,72,120,240]:
        n=hrs*12
        z[f'ret{hrs}_atr']=(c-c.shift(n))/atr
        if hrs in [24,72,120]:
            z[f'eff{hrs}']=rolling_eff(c,n)
        hi=h.rolling(n,min_periods=n).max(); lo=l.rolling(n,min_periods=n).min()
        if hrs in [72,120,240]:
            z[f'pos{hrs}']=(c-lo)/(hi-lo).replace(0,np.nan)
            z[f'dd{hrs}_atr']=(hi-c)/atr
            z[f'above_low{hrs}_atr']=(c-lo)/atr

    # Use completed H1 sequence sampled on M5-aligned repeated values.
    h1c=z.h1_close_location # only marker; actual H1 close approximated by last completed M5 context price
    # Build hourly observations from every 12th row to compute structural counts then forward fill.
    idx=np.arange(len(z))
    hourly=pd.DataFrame({'idx':idx[::12],'close':c.iloc[::12].to_numpy(),'high':h.iloc[::12].to_numpy(),'low':l.iloc[::12].to_numpy()})
    hourly['prev24_low']=hourly.low.shift(1).rolling(24,min_periods=24).min()
    hourly['is_new24_low']=(hourly.low<hourly.prev24_low).astype(float)
    hourly['neg_close']=(hourly.close.diff()<0).astype(float)
    hourly['ll']=(hourly.low.diff()<0).astype(float)
    hourly['hh']=(hourly.high.diff()>0).astype(float)
    hourly['new24h_low_count_24h']=hourly.is_new24_low.rolling(24,min_periods=24).sum()
    hourly['new24h_low_count_72h']=hourly.is_new24_low.rolling(72,min_periods=72).sum()
    hourly['neg_h1_frac24']=hourly.neg_close.rolling(24,min_periods=24).mean()
    hourly['neg_h1_frac72']=hourly.neg_close.rolling(72,min_periods=72).mean()
    hourly['lower_low_frac24']=hourly.ll.rolling(24,min_periods=24).mean()
    hourly['lower_low_frac72']=hourly.ll.rolling(72,min_periods=72).mean()
    hourly['higher_high_frac24']=hourly.hh.rolling(24,min_periods=24).mean()
    hourly['higher_high_frac72']=hourly.hh.rolling(72,min_periods=72).mean()
    hrange=(hourly.high-hourly.low)
    hourly['range24']=hourly.high.rolling(24,min_periods=24).max()-hourly.low.rolling(24,min_periods=24).min()
    hourly['range_prev24']=hourly['range24'].shift(24)
    hourly['range_ratio_24_prev24']=hourly.range24/hourly.range_prev24.replace(0,np.nan)
    hret=hourly.close.diff()
    hourly['vol24']=hret.rolling(24,min_periods=24).std()
    hourly['vol_prev24']=hourly.vol24.shift(24)
    hourly['vol_ratio_24_prev24']=hourly.vol24/hourly.vol_prev24.replace(0,np.nan)
    lo72=hourly.low.rolling(72,min_periods=72)
    hourly['low72']=lo72.min()
    hourly['recovery_from_72low_atr']=np.nan
    hourly['bars_since_72low']=np.nan
    for i in range(71,len(hourly)):
        vals=hourly.low.iloc[i-71:i+1].to_numpy()
        k=int(np.argmin(vals)); lowv=float(vals[k])
        hourly.loc[i,'bars_since_72low']=71-k
        ridx=int(hourly.idx.iloc[i])
        av=float(atr.iloc[ridx]) if np.isfinite(atr.iloc[ridx]) else np.nan
        hourly.loc[i,'recovery_from_72low_atr']=(float(hourly.close.iloc[i])-lowv)/av if av and av>0 else np.nan
    hourly['prior24_high']=hourly.high.shift(1).rolling(24,min_periods=24).max()
    hourly['prior24_decline']=hourly.prior24_high-hourly.low
    hourly['recovery_vs_prior24_decline']=(hourly.close-hourly.low)/hourly.prior24_decline.replace(0,np.nan)
    hourly['ret6']=hourly.close-hourly.close.shift(6)
    hourly['ret6_prev']=hourly.close.shift(6)-hourly.close.shift(12)
    hourly['ret12']=hourly.close-hourly.close.shift(12)
    hourly['ret12_prev']=hourly.close.shift(12)-hourly.close.shift(24)
    # normalize return comparisons by current ATR at corresponding M5 index
    amap=atr.iloc[hourly.idx].to_numpy()
    hourly['ret6_vs_prev6']=(hourly.ret6-hourly.ret6_prev)/amap
    hourly['ret12_vs_prev12']=(hourly.ret12-hourly.ret12_prev)/amap
    cols=['idx','new24h_low_count_24h','new24h_low_count_72h','neg_h1_frac24','neg_h1_frac72',
          'lower_low_frac24','lower_low_frac72','higher_high_frac24','higher_high_frac72',
          'range_ratio_24_prev24','vol_ratio_24_prev24','recovery_from_72low_atr','bars_since_72low',
          'recovery_vs_prior24_decline','ret6_vs_prev6','ret12_vs_prev12']
    temp=pd.DataFrame(index=np.arange(len(z)))
    temp.loc[hourly.idx,cols[1:]]=hourly[cols[1:]].to_numpy()
    temp=temp.ffill()
    for col in cols[1:]: z[col]=temp[col].to_numpy()
    return z

def make_swing_features(ev,z):
    rows=[]
    for r in ev.itertuples(index=False):
        j=int(r.signal_idx)
        row={'signal_t':int(r.signal_t),'signal_idx':j,'anchor_idx':int(r.anchor_idx),'year':int(r.year),
             'state_id':int(r.state_id),'atr_h1':float(r.atr_h1),'anchor_low':float(r.anchor_low),'anchor_high':float(r.anchor_high)}
        for f in SWING_FEATURES:
            v=z[f].iloc[j]; row[f]=float(v) if pd.notna(v) else np.nan
        rows.append(row)
    return pd.DataFrame(rows)

def fit_and_run(engine,ev,features,feature_names,x,spec):
    # independent labels
    ev_idx=ev.set_index('signal_t')
    pnl=[]
    for r in features.itertuples(index=False):
        rr=ev_idx.loc[int(r.signal_t)]
        if isinstance(rr,pd.DataFrame): rr=rr.iloc[0]
        q=single_outcome(rr,x,spec)
        pnl.append(np.nan if q is None else float(q))
    features=features.copy(); features['independent_pnl_r']=pnl
    features=features[np.isfinite(features.independent_pnl_r)].copy()
    features['label_positive']=(features.independent_pnl_r>0).astype(int)
    train=features[features.year<=2022].copy(); val=features[features.year.isin([2023,2024])].copy(); cons=features[features.year>=2025].copy()
    pipe=Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('lr',LogisticRegression(C=1.0,max_iter=3000))])
    pipe.fit(train[feature_names],train.label_positive)
    for df in [train,val,cons,features]: df['score']=pipe.predict_proba(df[feature_names])[:,1]
    th=float(np.quantile(train.score,0.60))
    auc={'train':float(roc_auc_score(train.label_positive,train.score)),
         'validation':float(roc_auc_score(val.label_positive,val.score)),
         'consumed_2025_2026':float(roc_auc_score(cons.label_positive,cons.score))}
    smap=features.set_index('signal_t').score.to_dict()
    ev2=ev.copy(); ev2['score']=ev2.signal_t.map(smap)
    allow=set(ev2[np.isfinite(ev2.score)&(ev2.score>=th)].signal_t.astype(np.int64).tolist())
    trades=simulate_selected(ev2,x,spec,allow,engine)
    coef=pipe.named_steps['lr'].coef_[0]
    coefs=sorted([{'feature':f,'coefficient':float(c)} for f,c in zip(feature_names,coef)],key=lambda q:abs(q['coefficient']),reverse=True)
    return features,trades,{'threshold':th,'auc':auc,'execution':split(trades),'yearly_execution':yearly(trades),'coefficients':coefs}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5=aggregate(ROOT,5); m15=aggregate(ROOT,15); h1=aggregate(ROOT,60)
    x=build_context(m5,m15,h1)
    print('bars',len(m5),len(m15),len(h1),flush=True)
    swing_z=make_swing_frame(x)
    payload={'scope':'Wave Regime + Control Transfer v0.1','pristine_forward_oos_read':False,'engines':{}}

    for engine,spec in SPECS.items():
        ev=attach_states(detect_events(x,spec['rule']),x)
        ev=ev[ev.state_id.isin(spec['states'])].copy()
        if engine=='scalper':
            feats=make_scalper_features(ev,x); names=SCALP_FEATURES
        else:
            feats=make_swing_features(ev,swing_z); names=SWING_FEATURES
        feats,trades,res=fit_and_run(engine,ev,feats,names,x,spec)
        feats.to_csv(OUT/f'{engine}_features_scores.csv',index=False)
        trades.to_csv(OUT/f'{engine}_gated_trades.csv',index=False)
        payload['engines'][engine]={'frozen_rule':spec['rule'],'frozen_states':sorted(spec['states']),'n_events':int(len(feats)),**res}
        print(engine,res['auc'],res['execution'],flush=True)

    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
