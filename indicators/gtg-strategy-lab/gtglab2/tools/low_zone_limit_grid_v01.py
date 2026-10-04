from pathlib import Path
import json, sys, itertools
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
LAB=GTG.parent
for p in (GTG,LAB/'library-comparison',LAB/'data',GTG/'engine'):
    sys.path.insert(0,str(p))

from pine_v02_exact_extended_test import load_clean

ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
SCORED=GTG/'runs'/'detector-execution-bridge-v01'/'scored_candidates.csv'
OUT=GTG/'runs'/'low-zone-limit-grid-v01'

SWING_TH=0.5669356193705579
SCALP_TH=0.6786512019247182

def metrics(df):
    if len(df)==0:
        return {'n':0,'total_r':0.0,'mean_r':None,'profit_factor':None,'max_drawdown_r':None,'win_rate':None}
    v=df.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {
        'n':int(len(df)),
        'total_r':float(v.sum()),
        'mean_r':float(v.mean()),
        'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
        'max_drawdown_r':float((eq-peak).min()),
        'win_rate':float((v>0).mean()),
        'avg_entry_rr':float(df.entry_rr.mean()),
    }

def simulate(cand,o,h,l,t,score_col,threshold,limit_offset,expiry,stop_mult,target_mult,timeout,cutoff_year=2024):
    rows=[]
    stats={'attempts':0,'fills':0,'cancel_gap_stop':0,'cancel_missed':0,'cancel_ambiguous':0,'expired':0,'busy_skips':0,'invalid':0}
    next_free=0
    for r in cand.itertuples(index=False):
        year=int(pd.to_datetime(int(r.t),unit='ms',utc=True).year)
        if year>cutoff_year:
            break
        score=float(getattr(r,score_col))
        if score<threshold:
            continue
        sig=int(r.idx)
        if sig<next_free:
            stats['busy_skips']+=1
            continue
        a=float(r.atr); low0=float(r.price_low)
        if not np.isfinite(a) or a<=0:
            stats['invalid']+=1; continue
        limit=low0+limit_offset*a
        stop=low0-stop_mult*a
        target=low0+target_mult*a
        if not(stop<limit<target):
            stats['invalid']+=1; continue
        stats['attempts']+=1
        fill_idx=None; fill_px=None; cancel_reason=None
        pending_end=min(len(t)-1,sig+expiry)
        for j in range(sig+1,pending_end+1):
            oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
            if oj<=stop:
                cancel_reason='GAP_STOP'; break
            if oj>=target:
                cancel_reason='MISSED_TARGET'; break
            if oj<=limit:
                fill_idx=j; fill_px=oj
                break
            # open > limit
            reaches_limit=lj<=limit
            reaches_target=hj>=target
            if reaches_limit and reaches_target:
                cancel_reason='AMBIGUOUS_LIMIT_TARGET'; break
            if reaches_limit:
                fill_idx=j; fill_px=limit
                break
            if reaches_target:
                cancel_reason='MISSED_TARGET'; break
        if fill_idx is None:
            next_free=pending_end+1
            if cancel_reason=='GAP_STOP': stats['cancel_gap_stop']+=1
            elif cancel_reason=='MISSED_TARGET': stats['cancel_missed']+=1
            elif cancel_reason=='AMBIGUOUS_LIMIT_TARGET': stats['cancel_ambiguous']+=1
            else: stats['expired']+=1
            continue

        stats['fills']+=1
        risk=fill_px-stop
        if risk<=0:
            stats['invalid']+=1
            next_free=fill_idx+1
            continue
        rr=(target-fill_px)/risk

        ex=None; xp=None; kind=None
        # Fill-bar bracket check.
        oj=float(o[fill_idx]); hj=float(h[fill_idx]); lj=float(l[fill_idx])
        if lj<=stop:
            ex=fill_idx; xp=stop; kind='STOP_FILL_BAR'
        elif fill_px==oj and hj>=target:
            ex=fill_idx; xp=target; kind='TARGET_FILL_BAR'
        # If fill at limit due intrabar low, target touch same bar was excluded as ambiguous above.

        if ex is None:
            for j in range(fill_idx+1,min(len(t),fill_idx+timeout)):
                oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
                if oj<=stop:
                    ex=j; xp=oj; kind='STOP_GAP'; break
                if oj>=target:
                    ex=j; xp=oj; kind='TARGET_GAP'; break
                if lj<=stop and hj>=target:
                    ex=j; xp=stop; kind='STOP_BOTH'; break
                if lj<=stop:
                    ex=j; xp=stop; kind='STOP'; break
                if hj>=target:
                    ex=j; xp=target; kind='TARGET'; break
        if ex is None:
            j=fill_idx+timeout-1
            if j+1>=len(t):
                next_free=len(t)
                continue
            ex=j+1; xp=float(o[ex]); kind=f'{timeout}H_TIMEOUT'

        pnl_r=(float(xp)-fill_px)/risk
        rows.append({
            'signal_t':int(r.t),'signal_idx':sig,'year':year,'score':score,
            'limit_offset_atr':limit_offset,'expiry_h':expiry,
            'fill_t':int(t[fill_idx]),'fill_px':float(fill_px),
            'stop_px':stop,'target_px':target,'entry_rr':float(rr),
            'exit_t':int(t[ex]),'exit_px':float(xp),'exit_kind':kind,'pnl_r':float(pnl_r)
        })
        next_free=ex+1

    df=pd.DataFrame(rows)
    stats['fill_rate']=float(stats['fills']/stats['attempts']) if stats['attempts'] else 0.0
    return df,stats

def select(results,engine):
    eligible=[]
    for r in results:
        tr=r['train']; va=r['validation']
        if engine=='swing':
            n_ok=tr['n']>=30 and va['n']>=20
        else:
            n_ok=tr['n']>=50 and va['n']>=25
        pf_ok=(tr['profit_factor'] is not None and va['profit_factor'] is not None and tr['profit_factor']>1 and va['profit_factor']>1)
        mean_ok=(tr['mean_r'] is not None and va['mean_r'] is not None and tr['mean_r']>0 and va['mean_r']>0)
        r['eligible']=bool(n_ok and pf_ok and mean_ok)
        if r['eligible']:
            r['worst_mean']=min(tr['mean_r'],va['mean_r'])
            r['worst_dd_abs']=max(abs(tr['max_drawdown_r']),abs(va['max_drawdown_r']))
            r['min_fills']=min(tr['n'],va['n'])
            eligible.append(r)
    eligible.sort(key=lambda z:(z['worst_mean'],-z['worst_dd_abs'],z['min_fills']),reverse=True)
    return eligible

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    cand=pd.read_csv(SCORED).sort_values('idx').reset_index(drop=True)
    f,quality=load_clean(ROOT)
    o=f.bo.to_numpy(float); h=f.bh.to_numpy(float); l=f.bl.to_numpy(float); t=f.t.to_numpy(np.int64)

    specs={
        'swing':{
            'score_col':'swing_score','threshold':SWING_TH,'offsets':[0.25,0.50,0.75,1.00],
            'expiries':[3,6,12],'stop':1.0,'target':4.0,'timeout':72
        },
        'scalper':{
            'score_col':'scalp_score','threshold':SCALP_TH,'offsets':[0.10,0.25,0.40],
            'expiries':[1,3,6],'stop':0.75,'target':1.5,'timeout':12
        }
    }
    payload={'scope':'Low-Zone Limit Entry v0.1 grid selection through 2024 only','quality':quality,'pristine_forward_oos_read':False,'engines':{}}

    for engine,sp in specs.items():
        results=[]
        for off,exp in itertools.product(sp['offsets'],sp['expiries']):
            df,stats=simulate(cand,o,h,l,t,sp['score_col'],sp['threshold'],off,exp,sp['stop'],sp['target'],sp['timeout'],2024)
            train=df[df.year<=2022].sort_values('signal_t') if len(df) else df
            val=df[df.year.isin([2023,2024])].sort_values('signal_t') if len(df) else df
            res={
                'limit_offset_atr':off,'expiry_h':exp,'stats':stats,
                'train':metrics(train),'validation':metrics(val),
            }
            results.append(res)
        elig=select(results,engine)
        ranked=sorted(results,key=lambda z:(z.get('eligible',False),z.get('worst_mean',-999),-z.get('worst_dd_abs',999)),reverse=True)
        payload['engines'][engine]={
            'threshold':sp['threshold'],'grid_n':len(results),'eligible_n':len(elig),
            'selected':elig[0] if elig else None,
            'eligible_ranked':elig,
            'all_results':ranked,
        }

    (OUT/'selection.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps({
        e:{
            'grid_n':v['grid_n'],'eligible_n':v['eligible_n'],'selected':v['selected'],
            'top3':v['eligible_ranked'][:3]
        } for e,v in payload['engines'].items()
    },indent=2))

if __name__=='__main__':
    main()
