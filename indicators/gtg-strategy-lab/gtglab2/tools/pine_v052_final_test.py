from pathlib import Path
import argparse, json, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
LAB=GTG.parent
for p in (GTG, LAB/'library-comparison', LAB/'data', GTG/'engine'):
    sys.path.insert(0,str(p))

from pine_v02_exact_extended_test import load_clean, FREEZE_MS

# Frozen v0.5.2
POS_MAX=0.40
GAP_MIN=1.00
STOP_CUSH=0.75
TARGET_PCT=0.60
MIN_RR=1.25
RISK_CASH=100.0

def metrics(x):
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
        'net_cash':float(x.pnl_cash.sum()),
        'avg_signal_rr':float(x.signal_rr.mean()),
    }

def run(root,start_ms,end_ms,out):
    out.mkdir(parents=True,exist_ok=False)
    f,quality=load_clean(root)
    t=f.t.to_numpy(np.int64)
    o=f.bo.to_numpy(float); h=f.bh.to_numpy(float); l=f.bl.to_numpy(float); c=f.bc.to_numpy(float)

    ps=pd.Series(c); hs=pd.Series(h); ls=pd.Series(l)
    prev=ps.shift(1).fillna(ps.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev.to_numpy()),np.abs(l-prev.to_numpy()))))
    atr=tr.rolling(14).mean().to_numpy()
    ema50=ps.ewm(span=50,adjust=False).mean().to_numpy()
    ema200=ps.ewm(span=200,adjust=False).mean().to_numpy()

    p48lo=ls.shift(1).rolling(48).min().to_numpy()
    p48hi=hs.shift(1).rolling(48).max().to_numpy()
    w48=p48hi-p48lo
    pos48=(c-p48lo)/np.where(w48==0,np.nan,w48)
    p12lo=ls.shift(1).rolling(12).min().to_numpy()

    ema200_24=np.r_[np.full(24,np.nan),ema200[:-24]]
    bull=(ema50>ema200)&(ema200>=ema200_24)
    gap=(ema50-ema200)/atr
    rejection=(l<p12lo)&(c>p12lo)&(c>o)&(c>np.r_[np.nan,c[:-1]])
    raw=bull&(gap>=GAP_MIN)&(pos48<=POS_MAX)&rejection

    trades=[]
    next_signal_bar=0

    for sig in np.flatnonzero(raw):
        if sig<next_signal_bar or sig+1>=len(t):
            continue
        if not(start_ms<=t[sig]<end_ms):
            continue

        a=atr[sig]
        if not np.isfinite(a) or a<=0:
            continue

        stop=l[sig]-STOP_CUSH*a
        target=p48lo[sig]+TARGET_PCT*w48[sig]

        # Exact Pine signal-time qualification and sizing use signal close.
        est_risk=c[sig]-stop
        est_reward=target-c[sig]
        if est_risk<=0 or est_reward<=0:
            continue
        signal_rr=est_reward/est_risk
        if signal_rr<MIN_RR:
            continue

        qty=RISK_CASH/est_risk
        entry=sig+1
        ep=o[entry]
        frozen_lo=p48lo[sig]

        ex=None; xp=None; kind=None

        # Active bracket from entry bar. Conservative ambiguity: stop first.
        for j in range(entry,min(len(t)-1,entry+48)):
            oj=o[j]; hj=h[j]; lj=l[j]

            if oj<=stop:
                ex=j; xp=oj; kind='STOP_GAP'; break
            if lj<=stop:
                ex=j; xp=stop; kind='STOP'; break
            if oj>=target:
                ex=j; xp=oj; kind='TARGET_GAP'; break
            if hj>=target:
                ex=j; xp=target; kind='TARGET'; break

            fail=(j>=1 and c[j]<frozen_lo and c[j-1]<frozen_lo)
            held=j-entry+1
            if fail or held>=48:
                if j+1>=len(t) or t[j+1]>=end_ms:
                    ex=None
                    break
                ex=j+1
                xp=o[j+1]
                kind='FAILURE_2_CLOSES' if fail else '48H_TIMEOUT'
                break

        if ex is None:
            continue

        pnl=(xp-ep)*qty
        actual_stop_risk=(ep-stop)*qty/RISK_CASH

        trades.append({
            'signal_t':int(t[sig]),
            'entry_t':int(t[entry]),
            'exit_t':int(t[ex]),
            'signal_close':float(c[sig]),
            'entry_px':float(ep),
            'stop_px':float(stop),
            'target_px':float(target),
            'exit_px':float(xp),
            'qty':float(qty),
            'signal_rr':float(signal_rr),
            'actual_stop_risk_r':float(actual_stop_risk),
            'position48':float(pos48[sig]),
            'ema_gap_atr':float(gap[sig]),
            'exit_kind':kind,
            'pnl_cash':float(pnl),
            'pnl_r':float(pnl/RISK_CASH),
        })

        # Pine cannot create another signal on the same bar that just closed the trade.
        next_signal_bar=ex+1

    td=pd.DataFrame(trades)
    if len(td):
        td['signal']=pd.to_datetime(td.signal_t,unit='ms',utc=True)
        td['year']=td.signal.dt.year
    td.to_csv(out/'trades.csv',index=False)

    summary={
        'scope':'Exact-logic emulation of GTGLab2 Buy Low / Sell High Pine v0.5.2',
        'parameters':{
            'position48_max':POS_MAX,
            'ema_gap_atr_min':GAP_MIN,
            'stop_cushion_atr':STOP_CUSH,
            'target_percentile':TARGET_PCT,
            'signal_rr_min':MIN_RR,
            'risk_cash':RISK_CASH,
        },
        'requested_start':pd.to_datetime(start_ms,unit='ms',utc=True).isoformat(),
        'requested_end':pd.to_datetime(end_ms,unit='ms',utc=True).isoformat(),
        'pristine_forward_oos_read':False,
        'quality':quality,
        'overall':metrics(td),
        'by_year':{},
        'by_exit':{}
    }
    if len(td):
        summary['by_year']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('year')}
        summary['by_exit']={str(k):metrics(g.sort_values('signal_t')) for k,g in td.groupby('exit_kind')}
        summary['dev_2018_2023']=metrics(td[td.year<=2023].sort_values('signal_t'))
        summary['pseudo_val_2024_2026']=metrics(td[td.year>=2024].sort_values('signal_t'))

    (out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',required=True)
    ap.add_argument('--out',required=True)
    ap.add_argument('--start',default='2018-03-01T00:00:00Z')
    ap.add_argument('--end',default='2026-10-01T00:00:00Z')
    a=ap.parse_args()
    start=int(pd.Timestamp(a.start).timestamp()*1000)
    end=min(int(pd.Timestamp(a.end).timestamp()*1000),FREEZE_MS)
    run(Path(a.root),start,end,Path(a.out))

if __name__=='__main__':
    main()
