from pathlib import Path
import json, sys
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
OUT=GTG/'runs'/'linked-h1-m15-m5-entry-v01'

FEATURES=[
 'm5_close_location','m5_lower_wick_h1atr','m5_body_h1atr','m5_drift3_h1atr','m5_drift12_h1atr','m5_eff3','m5_eff12',
 'm15_close_location','m15_lower_wick_h1atr','m15_drift4_h1atr','m15_drift20_h1atr','m15_eff4','m15_eff20',
 'h1_close_location','h1_lower_wick_atr','h1_drift5_atr','h1_eff5','h1_pos24','h1_decline24_atr'
]

def aggregate(root, minutes):
    ms=minutes*60000
    files=sorted((root/'m1').glob('*/*/*.csv.gz'))
    chunks=[]
    for n,p in enumerate(files,1):
        d=pd.read_csv(p,usecols=['t','bo','bh','bl','bc'])
        if d.empty: continue
        d['bucket']=(d.t.astype('int64')//ms)*ms
        g=d.groupby('bucket',sort=True).agg(
            bo=('bo','first'),bh=('bh','max'),bl=('bl','min'),bc=('bc','last'),count=('t','count')
        ).reset_index().rename(columns={'bucket':'t'})
        g=g[g['count']==minutes].copy()
        if len(g): chunks.append(g)
        if n%500==0: print(f'agg{minutes}={n}/{len(files)}',flush=True)
    x=pd.concat(chunks,ignore_index=True).sort_values('t').drop_duplicates('t').reset_index(drop=True)
    return x

def eff(c,n):
    return (c-c.shift(n)).abs()/c.diff().abs().rolling(n).sum().replace(0,np.nan)

def bar_shape(x,prefix,atr=None):
    o=x.bo.astype(float); h=x.bh.astype(float); l=x.bl.astype(float); c=x.bc.astype(float)
    r=(h-l).replace(0,np.nan)
    x[prefix+'_close_location']=(c-l)/r
    x[prefix+'_lower_wick']=np.minimum(o,c)-l
    x[prefix+'_body']=(c-o).abs()
    if atr is not None:
        x[prefix+'_lower_wick_h1atr']=x[prefix+'_lower_wick']/atr
        x[prefix+'_body_h1atr']=x[prefix+'_body']/atr
    return x

def build_context(m5,m15,h1):
    # H1 features become usable only after each H1 bar has closed.
    h=h1.copy()
    hc=h.bc.astype(float); hh=h.bh.astype(float); hl=h.bl.astype(float); ho=h.bo.astype(float)
    prev=hc.shift(1).fillna(hc.iloc[0])
    tr=pd.Series(np.maximum(hh-hl,np.maximum((hh-prev).abs(),(hl-prev).abs())))
    h['h1_atr']=tr.rolling(14).mean()
    h['h1_prev12_low']=hl.shift(1).rolling(12).min()
    lo24=hl.shift(1).rolling(24).min(); hi24=hh.shift(1).rolling(24).max()
    width24=(hi24-lo24).replace(0,np.nan)
    hrange=(hh-hl).replace(0,np.nan)
    h['h1_close_location']=(hc-hl)/hrange
    h['h1_lower_wick_atr']=(np.minimum(ho,hc)-hl)/h.h1_atr
    h['h1_drift5_atr']=(hc-hc.shift(5))/h.h1_atr
    h['h1_eff5']=eff(hc,5)
    h['h1_pos24']=(hc-lo24)/width24
    h['h1_decline24_atr']=(hi24-hc)/h.h1_atr
    h['ready_t']=h.t+3600000
    hctx=h[['ready_t','h1_atr','h1_prev12_low','h1_close_location','h1_lower_wick_atr','h1_drift5_atr','h1_eff5','h1_pos24','h1_decline24_atr']].dropna(subset=['h1_atr','h1_prev12_low'])

    # M15 context, normalized later by aligned H1 ATR.
    q=m15.copy()
    qc=q.bc.astype(float); qh=q.bh.astype(float); ql=q.bl.astype(float); qo=q.bo.astype(float)
    qr=(qh-ql).replace(0,np.nan)
    q['m15_close_location']=(qc-ql)/qr
    q['m15_lower_wick_raw']=np.minimum(qo,qc)-ql
    q['m15_drift4_raw']=qc-qc.shift(4)
    q['m15_drift20_raw']=qc-qc.shift(20)
    q['m15_eff4']=eff(qc,4)
    q['m15_eff20']=eff(qc,20)
    q['ready_t']=q.t+900000
    qctx=q[['ready_t','m15_close_location','m15_lower_wick_raw','m15_drift4_raw','m15_drift20_raw','m15_eff4','m15_eff20']]

    z=m5.copy()
    z['close_t']=z.t+300000
    z=pd.merge_asof(z.sort_values('close_t'),hctx.sort_values('ready_t'),left_on='close_t',right_on='ready_t',direction='backward')
    z=pd.merge_asof(z.sort_values('close_t'),qctx.sort_values('ready_t'),left_on='close_t',right_on='ready_t',direction='backward',suffixes=('','_m15ctx'))

    c=z.bc.astype(float); hi=z.bh.astype(float); lo=z.bl.astype(float); o=z.bo.astype(float)
    r=(hi-lo).replace(0,np.nan); a=z.h1_atr
    z['m5_close_location']=(c-lo)/r
    z['m5_lower_wick_h1atr']=(np.minimum(o,c)-lo)/a
    z['m5_body_h1atr']=(c-o).abs()/a
    z['m5_drift3_h1atr']=(c-c.shift(3))/a
    z['m5_drift12_h1atr']=(c-c.shift(12))/a
    z['m5_eff3']=eff(c,3)
    z['m5_eff12']=eff(c,12)
    z['m15_lower_wick_h1atr']=z.m15_lower_wick_raw/a
    z['m15_drift4_h1atr']=z.m15_drift4_raw/a
    z['m15_drift20_h1atr']=z.m15_drift20_raw/a
    z['prev12_m5_low']=lo.shift(1).rolling(12).min()
    return z

def first_hit(h,l,start,end,up,dn):
    for j in range(start,min(end,len(h))):
        u=h[j]>=up; d=l[j]<=dn
        if u and d: return 'AMB',j
        if u: return 'UP',j
        if d: return 'DOWN',j
    return 'NONE',None

def make_candidates(x):
    mask=(x.bl<x.h1_prev12_low) & (x.bl<x.prev12_m5_low)
    ids=np.flatnonzero(mask.fillna(False).to_numpy())
    h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); t=x.t.to_numpy(np.int64)
    rows=[]
    for k,i in enumerate(ids,1):
        a=float(x.h1_atr.iloc[i])
        if not np.isfinite(a) or a<=0 or i+1>=len(x): continue
        row={'idx':int(i),'t':int(t[i]),'price_low':float(l[i]),'atr_h1':a}
        for f in FEATURES: row[f]=float(x[f].iloc[i]) if pd.notna(x[f].iloc[i]) else np.nan
        ss,_=first_hit(h,l,i+1,i+1+144,l[i]+1.5*a,l[i]-0.75*a)
        sw,_=first_hit(h,l,i+1,i+1+864,l[i]+4.0*a,l[i]-1.0*a)
        row['scalp_state']=ss; row['scalp_good']=1 if ss=='UP' else (0 if ss=='DOWN' else np.nan)
        row['swing_state']=sw; row['swing_good']=1 if sw=='UP' else (0 if sw=='DOWN' else np.nan)
        rows.append(row)
        if k%5000==0: print(f'labels={k}/{len(ids)}',flush=True)
    d=pd.DataFrame(rows)
    d['dt']=pd.to_datetime(d.t,unit='ms',utc=True); d['year']=d.dt.dt.year
    return d

def mm(y,p):
    y=np.asarray(y,int); p=np.asarray(p,float)
    return {'n':int(len(y)),'base_rate':float(y.mean()),'roc_auc':float(roc_auc_score(y,p)),'pr_auc':float(average_precision_score(y,p)),'brier':float(brier_score_loss(y,p))}

def fit(cand,target):
    d=cand[cand[target].notna()].copy(); d[target]=d[target].astype(int)
    tr=d[d.year<=2022].copy(); va=d[d.year.isin([2023,2024])].copy(); te=d[d.year>=2025].copy()
    runs=[]
    for C in [0.1,0.3,1.0,3.0]:
        m=Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler()),('lr',LogisticRegression(C=C,class_weight='balanced',solver='lbfgs',max_iter=3000))])
        m.fit(tr[FEATURES],tr[target]); pv=m.predict_proba(va[FEATURES])[:,1]
        runs.append((C,m,mm(va[target],pv)))
    runs.sort(key=lambda z:(z[2]['roc_auc'],-z[2]['brier'],-z[0]),reverse=True)
    C,m,_=runs[0]
    for z in (tr,va,te): z['score']=m.predict_proba(z[FEATURES])[:,1]
    th=float(np.quantile(va.score,0.75))
    return C,m,th,tr,va,te,runs

def metrics(df):
    if len(df)==0:return {'n':0}
    v=df.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':int(len(df)),'win_rate':float((v>0).mean()),'total_r':float(v.sum()),'mean_r':float(v.mean()),'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,'max_drawdown_r':float((eq-peak).min()),'avg_entry_rr':float(df.entry_rr.mean()),'exit_counts':{str(k):int(vv) for k,vv in df.exit_kind.value_counts().items()}}

def simulate(cand,x,threshold,stop_mult,target_mult,hold_bars,name):
    o=x.bo.to_numpy(float); h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); t=x.t.to_numpy(np.int64)
    rows=[]; next_free=0; invalid=0
    for r in cand.sort_values('idx').itertuples(index=False):
        if float(r.score)<threshold: continue
        i=int(r.idx)
        if i<next_free or i+1>=len(x): continue
        a=float(r.atr_h1); low0=float(r.price_low); entry=i+1; ep=float(o[entry])
        stop=low0-stop_mult*a; target=low0+target_mult*a
        if not(stop<ep<target): invalid+=1; continue
        risk=ep-stop; rr=(target-ep)/risk
        ex=xp=kind=None
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
        rows.append({'engine':name,'signal_t':int(r.t),'year':int(r.year),'score':float(r.score),'entry_t':int(t[entry]),'exit_t':int(t[ex]),'entry_px':ep,'stop_px':stop,'target_px':target,'exit_px':float(xp),'entry_rr':float(rr),'pnl_r':float((float(xp)-ep)/risk),'exit_kind':kind})
        next_free=ex+1
    return pd.DataFrame(rows),invalid

def split(df):
    return {'train_2018_2022':metrics(df[df.year<=2022].sort_values('signal_t')),'validation_2023_2024':metrics(df[df.year.isin([2023,2024])].sort_values('signal_t')),'pseudo_test_2025_2026':metrics(df[df.year>=2025].sort_values('signal_t')),'all':metrics(df.sort_values('signal_t'))}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5=aggregate(ROOT,5); m15=aggregate(ROOT,15); h1=aggregate(ROOT,60)
    print('bars',len(m5),len(m15),len(h1),flush=True)
    x=build_context(m5,m15,h1)
    cand=make_candidates(x)
    cand.to_csv(OUT/'candidates.csv',index=False)
    payload={'scope':'Linked H1/M15/M5 Entry Resolution v0.1','bars':{'m5':int(len(m5)),'m15':int(len(m15)),'h1':int(len(h1))},'candidates':int(len(cand)),'pristine_forward_oos_read':False,'engines':{}}
    specs={'scalper':('scalp_good',0.75,1.5,144),'swing':('swing_good',1.0,4.0,864)}
    alltr=[]
    for name,(target,sm,tm,hold) in specs.items():
        C,m,th,tr,va,te,runs=fit(cand,target)
        cc=cand.copy(); cc['score']=m.predict_proba(cc[FEATURES])[:,1]
        filt,invf=simulate(cc,x,th,sm,tm,hold,name+'_filtered')
        base,invb=simulate(cc,x,0.0,sm,tm,hold,name+'_baseline')
        filt.to_csv(OUT/f'{name}_filtered_trades.csv',index=False); base.to_csv(OUT/f'{name}_baseline_trades.csv',index=False)
        alltr += [filt,base]
        payload['engines'][name]={'target':target,'selected_C':C,'validation_top25_threshold':th,'model':{'train':mm(tr[target],tr.score),'validation':mm(va[target],va.score),'pseudo_test':mm(te[target],te.score),'selection_runs':[{'C':c,**z} for c,_,z in runs]},'filtered_execution':split(filt),'baseline_execution':split(base),'invalid_filtered':invf,'invalid_baseline':invb}
    pd.concat(alltr,ignore_index=True).to_csv(OUT/'all_trades.csv',index=False)
    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
