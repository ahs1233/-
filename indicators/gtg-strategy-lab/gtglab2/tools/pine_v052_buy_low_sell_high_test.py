from pathlib import Path
import argparse, json, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]; LAB=GTG.parent
for p in (GTG,LAB/'library-comparison',LAB/'data',GTG/'engine'):
    sys.path.insert(0,str(p))
from pine_v02_exact_extended_test import load_clean, FREEZE_MS

def metrics(x):
    if len(x)==0:return {'n':0}
    v=x.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':int(len(x)),'wins':int((v>0).sum()),'losses':int((v<=0).sum()),
            'win_rate':float((v>0).mean()),'total_r':float(v.sum()),'mean_r':float(v.mean()),
            'median_r':float(np.median(v)),
            'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
            'max_drawdown_r':float((eq-peak).min()),
            'avg_planned_rr':float(x.planned_rr.mean())}

def run(root,start_ms,end_ms,out):
    out.mkdir(parents=True,exist_ok=False)
    f,q=load_clean(root)
    t=f.t.to_numpy(np.int64); o=f.bo.to_numpy(float); h=f.bh.to_numpy(float); l=f.bl.to_numpy(float); c=f.bc.to_numpy(float)
    ps=pd.Series(c); hs=pd.Series(h); ls=pd.Series(l)
    prev=ps.shift(1).fillna(ps.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev.to_numpy()),np.abs(l-prev.to_numpy()))))
    atr=tr.rolling(14).mean().to_numpy()
    ema50=ps.ewm(span=50,adjust=False).mean().to_numpy()
    ema200=ps.ewm(span=200,adjust=False).mean().to_numpy()
    e200prev=np.r_[np.full(24,np.nan),ema200[:-24]]
    p48lo=ls.shift(1).rolling(48).min().to_numpy()
    p48hi=hs.shift(1).rolling(48).max().to_numpy()
    width=p48hi-p48lo
    pos48=(c-p48lo)/np.where(width==0,np.nan,width)
    p12lo=ls.shift(1).rolling(12).min().to_numpy()

    bull=(ema50>ema200)&(ema200>=e200prev)
    gap=(ema50-ema200)/atr
    cheap=pos48<=0.45
    rejection=(l<p12lo)&(c>p12lo)&(c>o)&(c>np.r_[np.nan,c[:-1]])
    signal=bull&(gap>=1.0)&cheap&rejection

    rows=[]; next_free=0
    for sig in np.flatnonzero(signal):
        if sig<next_free or sig+1>=len(t) or not(start_ms<=t[sig]<end_ms): continue
        a=atr[sig]
        if not np.isfinite(a) or a<=0: continue
        entry=sig+1; ep=o[entry]
        stop=l[sig]-0.75*a
        target=p48lo[sig]+0.60*width[sig]
        decision=c[sig]
        planned_risk=decision-stop; reward=target-decision
        if planned_risk<=0 or reward<=0 or reward/planned_risk<1.25: continue
        rr=reward/planned_risk; qty=100.0/planned_risk
        ex=None; xp=None; kind=None
        for j in range(entry,min(len(t)-1,entry+48)):
            # conservative if stop and target both touch same H1 candle
            if o[j]<=stop: ex=j; xp=o[j]; kind='STOP_GAP'; break
            if l[j]<=stop: ex=j; xp=stop; kind='STOP'; break
            if o[j]>=target: ex=j; xp=o[j]; kind='TARGET_GAP'; break
            if h[j]>=target: ex=j; xp=target; kind='TARGET'; break
            fail=(j>=1 and c[j]<p48lo[sig] and c[j-1]<p48lo[sig])
            held=j-entry+1
            if fail or held>=48:
                if j+1>=len(t) or t[j+1]>=end_ms: break
                ex=j+1; xp=o[j+1]; kind='FAILURE_2_CLOSES' if fail else '48H_TIMEOUT'; break
        if ex is None: continue
        pnl=(xp-ep)*qty
        rows.append({'signal_t':int(t[sig]),'entry_t':int(t[entry]),'exit_t':int(t[ex]),
                     'entry_px':float(ep),'stop_px':float(stop),'target_px':float(target),
                     'planned_rr':float(rr),'atr_signal':float(a),'qty':float(qty),
                     'exit_px':float(xp),'exit_kind':kind,'pnl_cash':float(pnl),'pnl_r':float(pnl/100.0),
                     'position48':float(pos48[sig]),'ema_gap_atr':float(gap[sig])})
        next_free=ex

    td=pd.DataFrame(rows)
    if len(td):
        td['signal']=pd.to_datetime(td.signal_t,unit='ms',utc=True); td['year']=td.signal.dt.year
    td.to_csv(out/'trades.csv',index=False)
    summary={'scope':'GTGLab2 Pine v0.5.2 Buy Low / Sell Higher robust candidate',
             'rules':{'position48_max':0.45,'ema_gap_atr_min':1.0,'stop_cushion_atr':0.75,'target_percentile48':0.60,'min_rr':1.25},
             'pristine_forward_oos_read':False,'quality':q,'overall':metrics(td),'by_year':{},'by_exit':{}}
    if len(td):
        summary['by_year']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('year')}
        summary['by_exit']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('exit_kind')}
    (out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',required=True); ap.add_argument('--out',required=True)
    ap.add_argument('--start',default='2018-03-01T00:00:00Z'); ap.add_argument('--end',default='2026-10-01T00:00:00Z')
    a=ap.parse_args(); start=int(pd.Timestamp(a.start).timestamp()*1000); end=min(int(pd.Timestamp(a.end).timestamp()*1000),FREEZE_MS)
    run(Path(a.root),start,end,Path(a.out))

if __name__=='__main__':main()
