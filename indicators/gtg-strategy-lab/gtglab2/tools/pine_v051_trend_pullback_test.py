from pathlib import Path
import argparse, json, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
LAB=GTG.parent
LIB=LAB/'library-comparison'
DATA=LAB/'data'
for p in (GTG,LIB,DATA,GTG/'engine'):
    sys.path.insert(0,str(p))

from pine_v02_exact_extended_test import load_clean, FREEZE_MS
from doctrine_reference_v01 import aggregate_from_h1
from mtf_context import latest_completed_asof

def metrics(x):
    if len(x)==0: return {'n':0}
    v=x.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':int(len(x)),'wins':int((v>0).sum()),'losses':int((v<=0).sum()),
            'win_rate':float((v>0).mean()),'total_r':float(v.sum()),'mean_r':float(v.mean()),
            'median_r':float(np.median(v)),
            'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
            'max_drawdown_r':float((eq-peak).min()),
            'avg_planned_rr':float(x.planned_rr.mean()) if 'planned_rr' in x else None}

def sign_arr(s):
    a=np.asarray(s,float); z=np.zeros(len(a),dtype=int); z[a>0]=1; z[a<0]=-1; return z

def run(root,start_ms,end_ms,out):
    out.mkdir(parents=True,exist_ok=False)
    f,quality=load_clean(root)
    t=f.t.to_numpy(np.int64)
    o=f.bo.astype(float); h=f.bh.astype(float); l=f.bl.astype(float); c=f.bc.astype(float)

    prev=c.shift(1).fillna(c.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev),np.abs(l-prev))))
    atr=tr.rolling(14).mean()
    atr_med120=atr.rolling(120).median()
    ema50=c.ewm(span=50,adjust=False).mean()
    ema200=c.ewm(span=200,adjust=False).mean()
    h1s=ema50-ema50.shift(1)

    h4=aggregate_from_h1(f,'H4'); d1=aggregate_from_h1(f,'D')
    h4e=h4.bc.astype(float).ewm(span=50,adjust=False).mean()
    d1e=d1.bc.astype(float).ewm(span=50,adjust=False).mean()
    h4['slope']=h4e-h4e.shift(1); d1['slope']=d1e-d1e.shift(1)
    a4=latest_completed_asof(f.t,h4,'H4',['slope'])
    ad=latest_completed_asof(f.t,d1,'D1',['slope'])
    mtf=sign_arr(h1s.fillna(0))+sign_arr(a4.slope.fillna(0))+sign_arr(ad.slope.fillna(0))

    p48lo=l.shift(1).rolling(48).min()
    p48hi=h.shift(1).rolling(48).max()
    w48=p48hi-p48lo
    pos48=(c-p48lo)/w48.replace(0,np.nan)
    p12lo=l.shift(1).rolling(12).min()

    gap_atr=(ema50-ema200)/atr.replace(0,np.nan)
    vol_ok=atr>=atr_med120
    regime=(mtf==3) & (gap_atr>=1.5) & vol_ok
    cheap=pos48<=0.40
    rejection=(l<p12lo)&(c>p12lo)&(c>o)&(c>c.shift(1))
    signal=regime & cheap & rejection

    trades=[]; next_free=0
    for sig in range(len(f)-1):
        if sig<next_free or not(start_ms<=t[sig]<end_ms) or not bool(signal.iloc[sig]):
            continue
        a=float(atr.iloc[sig])
        if not np.isfinite(a) or a<=0: continue
        entry=sig+1; ep=float(o.iloc[entry])
        stop=float(l.iloc[sig])-0.50*a
        lo48=float(p48lo.iloc[sig]); hi48=float(p48hi.iloc[sig])
        target=lo48+0.75*(hi48-lo48)
        risk=ep-stop; reward=target-ep
        if risk<=0 or reward<=0: continue
        rr=reward/risk
        if rr<1.5: continue
        qty=100.0/risk
        ex=xp=kind=None
        for j in range(entry,min(len(f)-1,entry+48)):
            oj=float(o.iloc[j]); hj=float(h.iloc[j]); lj=float(l.iloc[j])
            if oj<=stop:
                ex=j; xp=oj; kind='STOP_GAP'; break
            if lj<=stop:
                ex=j; xp=stop; kind='STOP'; break
            if oj>=target:
                ex=j; xp=oj; kind='TARGET_GAP'; break
            if hj>=target:
                ex=j; xp=target; kind='TARGET'; break
            failure=(j>=1 and c.iloc[j]<lo48 and c.iloc[j-1]<lo48)
            held=j-entry+1
            if failure or held>=48:
                if j+1>=len(f) or t[j+1]>=end_ms: break
                ex=j+1; xp=float(o.iloc[j+1]); kind='FAILURE_2_CLOSES' if failure else '48H_TIMEOUT'
                break
        if ex is None: continue
        pnl=(float(xp)-ep)*qty
        trades.append({'signal_t':int(t[sig]),'entry_t':int(t[entry]),'exit_t':int(t[ex]),
                       'entry_px':ep,'stop_px':stop,'target_px':target,'planned_rr':rr,
                       'atr_signal':a,'qty':qty,'exit_px':float(xp),'exit_kind':kind,
                       'pnl_cash':pnl,'pnl_r':pnl/100.0,'position48':float(pos48.iloc[sig]),
                       'mtf_score':int(mtf[sig]),'ema_gap_atr':float(gap_atr.iloc[sig]),
                       'atr_ratio120':float(atr.iloc[sig]/atr_med120.iloc[sig])})

        next_free=ex

    td=pd.DataFrame(trades)
    if len(td):
        td['signal']=pd.to_datetime(td.signal_t,unit='ms',utc=True); td['year']=td.signal.dt.year
    td.to_csv(out/'trades.csv',index=False)
    summary={'scope':'GTGLab2 v0.5.1 long-only trend pullback',
             'pristine_forward_oos_read':False,'quality':quality,'overall':metrics(td),
             'by_year':{},'by_exit':{}}
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

if __name__=='__main__': main()
