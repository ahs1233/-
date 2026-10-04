from pathlib import Path
import json, sys, math
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
OUT=GTG/'runs'/'m15-entry-resolution-v01'

FEATURES=[
    'drift5_atr','drift20_atr','drift50_atr',
    'eff5','eff20','eff50',
    'pos24','pos72',
    'close_location','body_atr','lower_wick_atr','upper_wick_atr',
    'ema50_dist_atr','ema200_dist_atr',
    'ema50_slope_atr','ema200_slope_atr',
    'decline_from_24h_high_atr','decline_from_72h_high_atr'
]

def aggregate_m15(root:Path)->pd.DataFrame:
    files=sorted((root/'m1').glob('*/*/*.csv.gz'))
    chunks=[]
    for n,p in enumerate(files,1):
        d=pd.read_csv(p,usecols=['t','bo','bh','bl','bc'])
        if d.empty:
            continue
        d['bucket']=(d['t'].astype('int64')//900000)*900000
        g=d.groupby('bucket',sort=True).agg(
            bo=('bo','first'),bh=('bh','max'),bl=('bl','min'),bc=('bc','last'),m1_count=('t','count')
        ).reset_index().rename(columns={'bucket':'t'})
        # Only exact, complete 15-minute bars.
        g=g[g.m1_count==15].copy()
        if len(g):
            chunks.append(g)
        if n%400==0:
            print(f'aggregated_files={n}/{len(files)}',flush=True)
    x=pd.concat(chunks,ignore_index=True).sort_values('t').drop_duplicates('t').reset_index(drop=True)
    return x

def eff(c,n):
    return (c-c.shift(n)).abs()/c.diff().abs().rolling(n).sum().replace(0,np.nan)

def first_hit(h,l,start,end,up,dn):
    for j in range(start,min(end,len(h))):
        u=h[j]>=up
        d=l[j]<=dn
        if u and d: return 'AMB',j
        if u: return 'UP',j
        if d: return 'DOWN',j
    return 'NONE',None

def make_candidates(x):
    o=x.bo.astype(float); h=x.bh.astype(float); l=x.bl.astype(float); c=x.bc.astype(float)
    prev=c.shift(1).fillna(c.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev),np.abs(l-prev))))
    atr=tr.rolling(14).mean()
    ema50=c.ewm(span=50,adjust=False).mean()
    ema200=c.ewm(span=200,adjust=False).mean()
    p12lo=l.shift(1).rolling(12).min()
    p24lo=l.shift(1).rolling(24).min(); p24hi=h.shift(1).rolling(24).max()
    p72lo=l.shift(1).rolling(72).min(); p72hi=h.shift(1).rolling(72).max()

    candidates=np.flatnonzero((l<p12lo).fillna(False).to_numpy())
    hv=h.to_numpy(float); lv=l.to_numpy(float); cv=c.to_numpy(float); ov=o.to_numpy(float)
    av=atr.to_numpy(float); t=x.t.to_numpy(np.int64)
    effs={n:eff(c,n) for n in (5,20,50)}
    rows=[]
    for i in candidates:
        a=av[i]
        if not np.isfinite(a) or a<=0 or i<72 or i+2>=len(x):
            continue
        w24=float(p24hi.iloc[i]-p24lo.iloc[i]); w72=float(p72hi.iloc[i]-p72lo.iloc[i])
        br=hv[i]-lv[i]
        body=abs(cv[i]-ov[i]); lw=min(ov[i],cv[i])-lv[i]; uw=hv[i]-max(ov[i],cv[i])
        row={
            'idx':int(i),'t':int(t[i]),'price_low':float(lv[i]),'atr':float(a),
            'drift5_atr':float((cv[i]-cv[i-5])/a),
            'drift20_atr':float((cv[i]-cv[i-20])/a),
            'drift50_atr':float((cv[i]-cv[i-50])/a),
            'eff5':float(effs[5].iloc[i]),'eff20':float(effs[20].iloc[i]),'eff50':float(effs[50].iloc[i]),
            'pos24':float((cv[i]-p24lo.iloc[i])/w24) if w24>0 else np.nan,
            'pos72':float((cv[i]-p72lo.iloc[i])/w72) if w72>0 else np.nan,
            'close_location':float((cv[i]-lv[i])/br) if br>0 else np.nan,
            'body_atr':float(body/a),'lower_wick_atr':float(lw/a),'upper_wick_atr':float(uw/a),
            'ema50_dist_atr':float((cv[i]-ema50.iloc[i])/a),
            'ema200_dist_atr':float((cv[i]-ema200.iloc[i])/a),
            'ema50_slope_atr':float((ema50.iloc[i]-ema50.iloc[i-1])/a),
            'ema200_slope_atr':float((ema200.iloc[i]-ema200.iloc[i-1])/a),
            'decline_from_24h_high_atr':float((p24hi.iloc[i]-cv[i])/a),
            'decline_from_72h_high_atr':float((p72hi.iloc[i]-cv[i])/a),
        }
        # Scalper: +1.5 before -0.75 within 16 M15 = 4H.
        ss,_=first_hit(hv,lv,i+1,i+17,lv[i]+1.5*a,lv[i]-0.75*a)
        # Swing-entry: +3 before -1 within 32 M15 = 8H.
        sw,_=first_hit(hv,lv,i+1,i+33,lv[i]+3.0*a,lv[i]-1.0*a)
        row['scalp_state']=ss
        row['scalp_good']=1 if ss=='UP' else (0 if ss=='DOWN' else np.nan)
        row['swing_state']=sw
        row['swing_good']=1 if sw=='UP' else (0 if sw=='DOWN' else np.nan)
        rows.append(row)
    d=pd.DataFrame(rows)
    d['dt']=pd.to_datetime(d.t,unit='ms',utc=True)
    d['year']=d.dt.dt.year
    return d

def mdl_metrics(y,p):
    y=np.asarray(y,int); p=np.asarray(p,float)
    return {
        'n':int(len(y)),'base_rate':float(y.mean()),
        'roc_auc':float(roc_auc_score(y,p)) if len(np.unique(y))>1 else None,
        'pr_auc':float(average_precision_score(y,p)) if len(np.unique(y))>1 else None,
        'brier':float(brier_score_loss(y,p))
    }

def fit_model(cand,target):
    d=cand[cand[target].notna()].copy()
    d[target]=d[target].astype(int)
    tr=d[d.year<=2022].copy()
    va=d[d.year.isin([2023,2024])].copy()
    te=d[d.year>=2025].copy()
    runs=[]
    for C in [0.1,0.3,1.0,3.0]:
        m=Pipeline([
            ('impute',SimpleImputer(strategy='median')),
            ('scale',StandardScaler()),
            ('model',LogisticRegression(C=C,class_weight='balanced',solver='lbfgs',max_iter=3000))
        ])
        m.fit(tr[FEATURES],tr[target])
        pv=m.predict_proba(va[FEATURES])[:,1]
        mm=mdl_metrics(va[target],pv)
        runs.append((C,m,mm))
    runs.sort(key=lambda z:(z[2]['roc_auc'],-z[2]['brier'],-z[0]),reverse=True)
    C,m,_=runs[0]
    for z in (tr,va,te):
        z['score']=m.predict_proba(z[FEATURES])[:,1]
    th=float(np.quantile(va.score,0.75))
    return C,m,th,tr,va,te,runs

def exec_metrics(df):
    if len(df)==0: return {'n':0}
    v=df.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {
        'n':int(len(df)),'wins':int((v>0).sum()),'losses':int((v<=0).sum()),
        'win_rate':float((v>0).mean()),'total_r':float(v.sum()),'mean_r':float(v.mean()),
        'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
        'max_drawdown_r':float((eq-peak).min()),
        'avg_entry_rr':float(df.entry_rr.mean()),
        'exit_counts':{str(k):int(vv) for k,vv in df.exit_kind.value_counts().items()}
    }

def simulate(cand,x,score_col,threshold,stop_mult,target_mult,hold_bars,name):
    o=x.bo.to_numpy(float); h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); t=x.t.to_numpy(np.int64)
    rows=[]; next_free=0; invalid=0
    for r in cand.sort_values('idx').itertuples(index=False):
        score=float(getattr(r,score_col))
        if score<threshold: continue
        i=int(r.idx)
        if i<next_free or i+1>=len(x): continue
        a=float(r.atr); low0=float(r.price_low)
        entry=i+1; ep=float(o[entry])
        stop=low0-stop_mult*a; target=low0+target_mult*a
        if not(stop<ep<target):
            invalid+=1; continue
        risk=ep-stop; rr=(target-ep)/risk
        ex=None; xp=None; kind=None
        for j in range(entry,min(len(x),entry+hold_bars)):
            oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
            if oj<=stop: ex=j; xp=oj; kind='STOP_GAP'; break
            if oj>=target: ex=j; xp=oj; kind='TARGET_GAP'; break
            if lj<=stop and hj>=target: ex=j; xp=stop; kind='STOP_BOTH'; break
            if lj<=stop: ex=j; xp=stop; kind='STOP'; break
            if hj>=target: ex=j; xp=target; kind='TARGET'; break
        if ex is None:
            j=entry+hold_bars-1
            if j+1>=len(x): continue
            ex=j+1; xp=float(o[ex]); kind=f'{hold_bars}BAR_TIMEOUT'
        pnl=(float(xp)-ep)/risk
        rows.append({
            'engine':name,'signal_t':int(r.t),'year':int(r.year),'score':score,
            'entry_t':int(t[entry]),'exit_t':int(t[ex]),'entry_px':ep,
            'stop_px':stop,'target_px':target,'exit_px':float(xp),
            'entry_rr':float(rr),'pnl_r':float(pnl),'exit_kind':kind
        })
        next_free=ex+1
    return pd.DataFrame(rows),invalid

def split_exec(df):
    return {
        'train_2018_2022':exec_metrics(df[df.year<=2022].sort_values('signal_t')),
        'validation_2023_2024':exec_metrics(df[df.year.isin([2023,2024])].sort_values('signal_t')),
        'pseudo_test_2025_2026':exec_metrics(df[df.year>=2025].sort_values('signal_t')),
        'all':exec_metrics(df.sort_values('signal_t'))
    }

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m15=aggregate_m15(ROOT)
    m15.to_csv(OUT/'m15_bars.csv.gz',index=False,compression='gzip')
    print('m15_bars',len(m15),flush=True)

    cand=make_candidates(m15)
    cand.to_csv(OUT/'m15_candidates.csv',index=False)
    print('candidates',len(cand),flush=True)

    payload={'scope':'M15 Entry Resolution Study v0.1','m15_bars':int(len(m15)),'candidates':int(len(cand)),
             'pristine_forward_oos_read':False,'engines':{}}

    specs={
        'scalper':('scalp_good',0.75,1.5,16),
        'swing_entry':('swing_good',1.0,3.0,32)
    }
    alltr=[]
    for name,(target,sm,tm,hold) in specs.items():
        C,m,th,tr,va,te,runs=fit_model(cand,target)
        # Score every causal candidate for execution.
        cand2=cand.copy()
        cand2['score']=m.predict_proba(cand2[FEATURES])[:,1]
        filtered,invf=simulate(cand2,m15,'score',th,sm,tm,hold,name+'_filtered')
        baseline,invb=simulate(cand2,m15,'score',0.0,sm,tm,hold,name+'_baseline')
        filtered.to_csv(OUT/f'{name}_filtered_trades.csv',index=False)
        baseline.to_csv(OUT/f'{name}_baseline_trades.csv',index=False)
        alltr.extend([filtered,baseline])
        payload['engines'][name]={
            'target':target,'selected_C':C,'validation_top25_threshold':th,
            'model':{
                'train':mdl_metrics(tr[target],tr.score),
                'validation':mdl_metrics(va[target],va.score),
                'pseudo_test':mdl_metrics(te[target],te.score),
                'selection_runs':[{'C':c,**mm} for c,_,mm in runs],
            },
            'filtered_execution':split_exec(filtered),
            'baseline_execution':split_exec(baseline),
            'invalid_next_open_filtered':invf,'invalid_next_open_baseline':invb
        }
    pd.concat(alltr,ignore_index=True).to_csv(OUT/'all_trades.csv',index=False)
    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__':
    main()
