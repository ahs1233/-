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

def metrics(x: pd.DataFrame):
    if len(x)==0:
        return {'n':0}
    v=x.pnl_r.to_numpy(float)
    pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v)
    peak=np.maximum.accumulate(np.r_[0.0,eq])[:-1]
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
        'avg_planned_rr':float(x.planned_rr.mean()) if 'planned_rr' in x else None,
    }

def run(root:Path,start_ms:int,end_ms:int,out:Path):
    out.mkdir(parents=True,exist_ok=False)
    f,quality=load_clean(root)
    t=f.t.to_numpy(np.int64)
    o=f.bo.astype(float); h=f.bh.astype(float); l=f.bl.astype(float); c=f.bc.astype(float)

    prev=c.shift(1).fillna(c.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev),np.abs(l-prev))))
    atr=tr.rolling(14).mean()
    ema50=c.ewm(span=50,adjust=False).mean()
    ema200=c.ewm(span=200,adjust=False).mean()
    absd=(c-c.shift(1)).abs()
    eff48=(c-c.shift(48)).abs()/absd.rolling(48).sum().replace(0,np.nan)

    p48lo=l.shift(1).rolling(48).min()
    p48hi=h.shift(1).rolling(48).max()
    w48=p48hi-p48lo
    pos48=(c-p48lo)/w48.replace(0,np.nan)
    p12lo=l.shift(1).rolling(12).min()

    bull=(ema50>ema200) & (ema200>=ema200.shift(24))
    rng=((ema50-ema200).abs()<=1.5*atr) & (eff48<=0.35)

    rejection=(l<p12lo) & (c>p12lo) & (c>o) & (c>c.shift(1))
    cheap_bull=bull & (pos48<=0.40)
    cheap_range=rng & (pos48<=0.25)
    raw_signal=rejection & (cheap_bull | cheap_range)

    trades=[]
    next_free=0
    for sig in range(len(f)-1):
        if sig<next_free or not(start_ms<=t[sig]<end_ms):
            continue
        if not bool(raw_signal.iloc[sig]):
            continue
        a=float(atr.iloc[sig])
        if not np.isfinite(a) or a<=0:
            continue
        entry=sig+1
        ep=float(o.iloc[entry])
        stop=float(l.iloc[sig])-0.25*a
        lo48=float(p48lo.iloc[sig]); hi48=float(p48hi.iloc[sig])
        target=lo48+0.75*(hi48-lo48)
        risk=ep-stop
        reward=target-ep
        if risk<=0 or reward<=0:
            continue
        rr=reward/risk
        if rr<1.5:
            continue
        qty=100.0/risk
        setup='BULL_PULLBACK' if bool(cheap_bull.iloc[sig]) else 'RANGE_LOW'
        ex=None; xp=None; kind=None
        for j in range(entry,min(len(f)-1,entry+48)):
            oj=float(o.iloc[j]); hj=float(h.iloc[j]); lj=float(l.iloc[j])
            # conservative same-bar ambiguity: stop first
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
                if j+1>=len(f) or t[j+1]>=end_ms:
                    break
                ex=j+1; xp=float(o.iloc[j+1]); kind='FAILURE_2_CLOSES' if failure else '48H_TIMEOUT'
                break
        if ex is None:
            continue
        pnl=(float(xp)-ep)*qty
        trades.append({
            'signal_t':int(t[sig]),'entry_t':int(t[entry]),'exit_t':int(t[ex]),
            'setup':setup,'entry_px':ep,'stop_px':stop,'target_px':target,
            'planned_rr':rr,'atr_signal':a,'qty':qty,
            'exit_px':float(xp),'exit_kind':kind,'pnl_cash':pnl,'pnl_r':pnl/100.0,
            'position48':float(pos48.iloc[sig]),
            'eff48':float(eff48.iloc[sig]),
            'ema_gap_atr':float((ema50.iloc[sig]-ema200.iloc[sig])/a),
        })
        next_free=ex

    td=pd.DataFrame(trades)
    if len(td):
        td['signal']=pd.to_datetime(td.signal_t,unit='ms',utc=True)
        td['year']=td.signal.dt.year
    td.to_csv(out/'trades.csv',index=False)
    summary={
        'scope':'GTGLab2 v0.5 Buy Low / Sell High preregistered structural test',
        'requested_start':pd.to_datetime(start_ms,unit='ms',utc=True).isoformat(),
        'requested_end':pd.to_datetime(end_ms,unit='ms',utc=True).isoformat(),
        'pristine_forward_oos_read':False,
        'quality':quality,
        'overall':metrics(td),
        'by_year':{},
        'by_setup':{},
        'by_exit':{}
    }
    if len(td):
        summary['by_year']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('year')}
        summary['by_setup']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('setup')}
        summary['by_exit']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('exit_kind')}
    (out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',required=True)
    ap.add_argument('--out',required=True)
    ap.add_argument('--start',default='2018-03-01T00:00:00Z')
    ap.add_argument('--end',default='2026-10-01T00:00:00Z')
    a=ap.parse_args()
    start_ms=int(pd.Timestamp(a.start).timestamp()*1000)
    requested_end=int(pd.Timestamp(a.end).timestamp()*1000)
    end_ms=min(requested_end,FREEZE_MS)
    run(Path(a.root),start_ms,end_ms,Path(a.out))

if __name__=='__main__':
    main()
