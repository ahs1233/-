from pathlib import Path
import argparse, json, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
LAB=GTG.parent
for p in (GTG,LAB/'library-comparison',LAB/'data',GTG/'engine'):
    sys.path.insert(0,str(p))
from pine_v02_exact_extended_test import load_clean, FREEZE_MS

def metrics(x):
    if len(x)==0: return {'n':0}
    v=x.pnl_r.to_numpy(float)
    pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v)
    peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {
        'n':int(len(x)),
        'wins':int((v>0).sum()),
        'losses':int((v<=0).sum()),
        'win_rate':float((v>0).mean()),
        'total_r':float(v.sum()),
        'mean_r':float(v.mean()),
        'median_r':float(np.median(v)),
        'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
        'max_drawdown_r':float((eq-peak).min()),
    }

def run(root,start_ms,end_ms,out):
    out.mkdir(parents=True,exist_ok=False)
    f,q=load_clean(root)
    t=f.t.to_numpy(np.int64)
    o=f.bo.astype(float); h=f.bh.astype(float); l=f.bl.astype(float); c=f.bc.astype(float)

    prev=c.shift(1).fillna(c.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev),np.abs(l-prev))))
    atr=tr.rolling(14).mean()
    ema50=c.ewm(span=50,adjust=False).mean()
    ema200=c.ewm(span=200,adjust=False).mean()

    p48lo=l.shift(1).rolling(48).min()
    p48hi=h.shift(1).rolling(48).max()
    w48=p48hi-p48lo
    pos48=(c-p48lo)/w48.replace(0,np.nan)
    p12lo=l.shift(1).rolling(12).min()

    bull=(ema50>ema200)&(ema200>=ema200.shift(24))
    gap=(ema50-ema200)/atr.replace(0,np.nan)
    reject=(l<p12lo)&(c>p12lo)&(c>o)&(c>c.shift(1))
    raw=bull&(gap>=1.0)&(pos48<=0.40)&reject

    rows=[]; next_free=0
    for sig in range(len(f)-1):
        if sig<next_free or not(start_ms<=t[sig]<end_ms) or not bool(raw.iloc[sig]):
            continue
        a=float(atr.iloc[sig])
        if not np.isfinite(a) or a<=0: continue

        stop=float(l.iloc[sig])-0.75*a
        target=float(p48lo.iloc[sig])+0.60*float(w48.iloc[sig])

        # Exact Pine causal qualification: signal close only.
        planned_risk=float(c.iloc[sig])-stop
        planned_reward=target-float(c.iloc[sig])
        if planned_risk<=0 or planned_reward<=0: continue
        rr=planned_reward/planned_risk
        if rr<1.25: continue

        qty=100.0/planned_risk
        entry=sig+1
        ep=float(o.iloc[entry])
        range_low=float(p48lo.iloc[sig])

        ex=xp=kind=None
        for j in range(entry,min(len(f)-1,entry+48)):
            oj=float(o.iloc[j]); hj=float(h.iloc[j]); lj=float(l.iloc[j])

            # Conservative stop-first same-bar ordering.
            if oj<=stop:
                ex=j; xp=oj; kind='STOP_GAP'; break
            if lj<=stop:
                ex=j; xp=stop; kind='STOP'; break
            if oj>=target:
                ex=j; xp=oj; kind='TARGET_GAP'; break
            if hj>=target:
                ex=j; xp=target; kind='TARGET'; break

            held=j-entry+1
            fail=(j>=1 and c.iloc[j]<range_low and c.iloc[j-1]<range_low)
            if fail or held>=48:
                if j+1>=len(f) or t[j+1]>=end_ms: break
                ex=j+1; xp=float(o.iloc[j+1])
                kind='FAILURE_2_CLOSES' if fail else '48H_TIMEOUT'
                break

        if ex is None: continue
        pnl=(float(xp)-ep)*qty
        rows.append({
            'signal_t':int(t[sig]),'entry_t':int(t[entry]),'exit_t':int(t[ex]),
            'entry_px':ep,'stop_px':stop,'target_px':target,
            'planned_rr_signal_close':rr,'qty':qty,
            'exit_px':float(xp),'exit_kind':kind,
            'pnl_cash':pnl,'pnl_r':pnl/100.0,
            'position48':float(pos48.iloc[sig]),
            'ema_gap_atr':float(gap.iloc[sig])
        })
        next_free=ex

    td=pd.DataFrame(rows)
    if len(td):
        td['signal']=pd.to_datetime(td.signal_t,unit='ms',utc=True)
        td['year']=td.signal.dt.year
    td.to_csv(out/'trades.csv',index=False)
    s={'scope':'GTGLab2 Pine v0.5.2 exact causal test',
       'params':{'position48_max':0.40,'ema_gap_atr_min':1.0,'stop_cushion_atr':0.75,
                 'target_pct_prior48':0.60,'min_planned_rr_signal_close':1.25,
                 'long_only':True,'ema200_nonfalling_24h':True},
       'pristine_forward_oos_read':False,'quality':q,'overall':metrics(td),
       'by_year':{},'by_exit':{}}
    if len(td):
        s['by_year']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('year')}
        s['by_exit']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('exit_kind')}
    (out/'summary.json').write_text(json.dumps(s,indent=2),encoding='utf-8')
    print(json.dumps(s,indent=2))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',required=True); ap.add_argument('--out',required=True)
    ap.add_argument('--start',default='2018-03-01T00:00:00Z'); ap.add_argument('--end',default='2026-10-01T00:00:00Z')
    a=ap.parse_args()
    start=int(pd.Timestamp(a.start).timestamp()*1000)
    end=min(int(pd.Timestamp(a.end).timestamp()*1000),FREEZE_MS)
    run(Path(a.root),start,end,Path(a.out))

if __name__=='__main__': main()
