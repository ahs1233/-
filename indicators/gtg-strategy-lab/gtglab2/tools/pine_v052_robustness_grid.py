from pathlib import Path
import json, sys, itertools
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]; LAB=GTG.parent
for p in (GTG, LAB/'library-comparison', LAB/'data', GTG/'engine'):
    sys.path.insert(0,str(p))
from pine_v02_exact_extended_test import load_clean

ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
OUT=GTG/'runs'/'pine-v052-robustness-grid'
DEV_END=int(pd.Timestamp('2024-01-01T00:00:00Z').timestamp()*1000)

def met(rows):
    if not rows: return {'n':0}
    v=np.array([r['pnl_r'] for r in rows],float)
    pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':len(rows),'total_r':float(v.sum()),'mean_r':float(v.mean()),
            'pf':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else 99.0,
            'maxdd_r':float((eq-peak).min()),'wr':float((v>0).mean())}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    f,q=load_clean(ROOT)
    t=f.t.to_numpy(np.int64); o=f.bo.to_numpy(float); h=f.bh.to_numpy(float); l=f.bl.to_numpy(float); c=f.bc.to_numpy(float)
    ps=pd.Series(c); hs=pd.Series(h); ls=pd.Series(l); os=pd.Series(o)
    prev=ps.shift(1).fillna(ps.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev.to_numpy()),np.abs(l-prev.to_numpy()))))
    atr=tr.rolling(14).mean().to_numpy()
    atrmed=pd.Series(atr).rolling(120).median().to_numpy()
    ema50=ps.ewm(span=50,adjust=False).mean().to_numpy()
    ema200=ps.ewm(span=200,adjust=False).mean().to_numpy()
    p48lo=ls.shift(1).rolling(48).min().to_numpy()
    p48hi=hs.shift(1).rolling(48).max().to_numpy()
    w48=p48hi-p48lo
    pos48=(c-p48lo)/np.where(w48==0,np.nan,w48)
    p12lo=ls.shift(1).rolling(12).min().to_numpy()
    bull=(ema50>ema200) & (ema200>=np.r_[np.full(24,np.nan),ema200[:-24]])
    reject=(l<p12lo)&(c>p12lo)&(c>o)&(c>np.r_[np.nan,c[:-1]])
    gap=(ema50-ema200)/atr
    atrratio=atr/atrmed

    def simulate(posmax,gapmin,volmin,cush,targetpct,rrmin):
        base=bull & reject & (pos48<=posmax)
        if gapmin>0: base &= gap>=gapmin
        if volmin>0: base &= atrratio>=volmin
        sigs=np.flatnonzero(base)
        rows=[]; next_free=0
        for sig in sigs:
            if sig<next_free or sig+1>=len(t): continue
            a=atr[sig]
            if not np.isfinite(a) or a<=0: continue
            entry=sig+1; ep=o[entry]
            stop=l[sig]-cush*a
            target=p48lo[sig]+targetpct*w48[sig]
            decision=c[sig]
            planned_risk=decision-stop; reward=target-decision
            if planned_risk<=0 or reward<=0 or reward/planned_risk<rrmin: continue
            qty=1.0/planned_risk
            ex=None; xp=None
            for j in range(entry,min(len(t)-1,entry+48)):
                if o[j]<=stop: ex=j; xp=o[j]; break
                if l[j]<=stop: ex=j; xp=stop; break
                if o[j]>=target: ex=j; xp=o[j]; break
                if h[j]>=target: ex=j; xp=target; break
                fail=(j>=1 and c[j]<p48lo[sig] and c[j-1]<p48lo[sig])
                held=j-entry+1
                if fail or held>=48:
                    if j+1>=len(t): break
                    ex=j+1; xp=o[j+1]; break
            if ex is None: continue
            rows.append({'signal_t':int(t[sig]),'pnl_r':float((xp-ep)*qty)})
            next_free=ex
        return rows

    grids={
      'posmax':[0.35,0.40,0.45],
      'gapmin':[0.0,0.5,1.0],
      'volmin':[0.0,0.90,1.00],
      'cush':[0.25,0.50,0.75],
      'targetpct':[0.60,0.70,0.75],
      'rrmin':[1.25,1.50],
    }
    results=[]
    for vals in itertools.product(*grids.values()):
        prm=dict(zip(grids.keys(),vals))
        rows=simulate(**prm)
        dev=[r for r in rows if r['signal_t']<DEV_END]
        val=[r for r in rows if r['signal_t']>=DEV_END]
        md=met(dev); mv=met(val); ma=met(rows)
        eligible=md['n']>=20 and mv['n']>=20 and md['total_r']>0 and mv['total_r']>0 and md['pf']>1 and mv['pf']>1
        worst_mean=min(md.get('mean_r',-99),mv.get('mean_r',-99))
        worst_dd=max(abs(md.get('maxdd_r',-99)),abs(mv.get('maxdd_r',-99)))
        results.append({**prm,'eligible':eligible,'worst_mean':worst_mean,'worst_dd_abs':worst_dd,
                        'dev':md,'validation':mv,'all':ma})
    elig=[r for r in results if r['eligible']]
    elig.sort(key=lambda r:(r['worst_mean'],-r['worst_dd_abs'],r['all']['mean_r']),reverse=True)
    results.sort(key=lambda r:(r['eligible'],r['worst_mean'],-r['worst_dd_abs']),reverse=True)
    payload={'grid':grids,'quality':q,'eligible_count':len(elig),'best':elig[:20],'all_ranked':results[:100]}
    (OUT/'grid_results.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print('eligible',len(elig),'of',len(results))
    for i,r in enumerate(elig[:15],1):
        print(i,{k:r[k] for k in grids},'DEV',r['dev'],'VAL',r['validation'],'ALL',r['all'])

if __name__=='__main__': main()
