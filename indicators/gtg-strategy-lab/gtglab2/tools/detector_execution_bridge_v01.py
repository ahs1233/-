from pathlib import Path
import json, sys
import numpy as np
import pandas as pd
import joblib

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
LAB=GTG.parent
for p in (GTG, LAB/'library-comparison', LAB/'data', GTG/'engine'):
    sys.path.insert(0,str(p))

from pine_v02_exact_extended_test import load_clean

ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
CAND=GTG/'runs'/'bottom-atlas-v01'/'bottom_candidates.csv'
MODELDIR=GTG/'runs'/'swing-scalper-detectors-v01'
OUT=GTG/'runs'/'detector-execution-bridge-v01'

SWING_TH=0.5669356193705579
SWING_HI=0.70656536
SCALP_TH=0.6786512019247182
SCALP_BROAD=0.5160156476601278

FEATURES=[
    'drift5_atr','drift20_atr','drift50_atr',
    'eff5','eff20','eff50',
    'pos24','pos72','atr_rel120',
    'close_location','body_atr','lower_wick_atr','upper_wick_atr',
    'ema50_dist_atr','ema200_dist_atr',
    'ema50_slope_atr','ema200_slope_atr',
    'decline_from_24h_high_atr','decline_from_72h_high_atr'
]

def met(df):
    if len(df)==0:
        return {'n':0}
    v=df.pnl_r.to_numpy(float)
    pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v)
    peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {
        'n':int(len(df)),
        'wins':int((v>0).sum()),
        'losses':int((v<=0).sum()),
        'win_rate':float((v>0).mean()),
        'total_r':float(v.sum()),
        'mean_r':float(v.mean()),
        'median_r':float(np.median(v)),
        'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
        'max_drawdown_r':float((eq-peak).min()),
        'avg_entry_rr':float(df.entry_rr.mean()),
        'avg_score':float(df.score.mean()),
        'exit_counts':{str(k):int(v) for k,v in df.exit_kind.value_counts().items()},
    }

def segment(df):
    return {
        'train_2018_2022':met(df[df.year<=2022].sort_values('signal_t')),
        'validation_2023_2024':met(df[df.year.isin([2023,2024])].sort_values('signal_t')),
        'pseudo_test_2025_2026':met(df[df.year>=2025].sort_values('signal_t')),
        'all':met(df.sort_values('signal_t')),
    }

def simulate(cand,h,l,o,t,score_col,threshold,stop_mult,target_mult,timeout,name):
    rows=[]
    next_free=0
    skipped_bad_gap=0
    skipped_end=0
    for r in cand.itertuples(index=False):
        score=float(getattr(r,score_col))
        if score < threshold:
            continue
        sig=int(r.idx)
        if sig<next_free or sig+1>=len(t):
            continue
        a=float(r.atr); low0=float(r.price_low)
        if not np.isfinite(a) or a<=0:
            continue
        entry=sig+1
        ep=float(o[entry])
        stop=low0-stop_mult*a
        target=low0+target_mult*a

        # Operational validity: actual next-open entry must still lie between stop and target.
        if not(stop < ep < target):
            skipped_bad_gap+=1
            continue

        risk=ep-stop
        rr=(target-ep)/risk
        ex=None; xp=None; kind=None
        last=min(len(t)-1,entry+timeout)
        for j in range(entry,last):
            oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
            if oj<=stop:
                ex=j; xp=oj; kind='STOP_GAP'; break
            if lj<=stop:
                ex=j; xp=stop; kind='STOP'; break
            if oj>=target:
                ex=j; xp=oj; kind='TARGET_GAP'; break
            if hj>=target:
                ex=j; xp=target; kind='TARGET'; break
        if ex is None:
            # Timeout after exactly timeout H1 holding bars; exit next available open.
            j=entry+timeout-1
            if j+1>=len(t):
                skipped_end+=1
                continue
            ex=j+1; xp=float(o[ex]); kind=f'{timeout}H_TIMEOUT'

        pnl_r=(xp-ep)/risk
        rows.append({
            'engine':name,
            'signal_t':int(r.t),'signal_idx':sig,'entry_t':int(t[entry]),'exit_t':int(t[ex]),
            'year':int(pd.to_datetime(int(r.t),unit='ms',utc=True).year),
            'score':score,'candidate_low':low0,'atr_signal':a,
            'entry_px':ep,'stop_px':stop,'target_px':target,'exit_px':float(xp),
            'entry_rr':float(rr),'pnl_r':float(pnl_r),'exit_kind':kind,
        })
        next_free=ex+1
    df=pd.DataFrame(rows)
    return df,{'skipped_invalid_next_open':skipped_bad_gap,'skipped_end':skipped_end}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    cand=pd.read_csv(CAND).sort_values('idx').reset_index(drop=True)
    swing_model=joblib.load(MODELDIR/'swing_model.joblib')
    scalp_model=joblib.load(MODELDIR/'scalper_model.joblib')
    cand['swing_score']=swing_model.predict_proba(cand[FEATURES])[:,1]
    cand['scalp_score']=scalp_model.predict_proba(cand[FEATURES])[:,1]
    cand.to_csv(OUT/'scored_candidates.csv',index=False)

    f,quality=load_clean(ROOT)
    h=f.bh.to_numpy(float); l=f.bl.to_numpy(float); o=f.bo.to_numpy(float); t=f.t.to_numpy(np.int64)

    configs=[
        ('swing_baseline','swing_score',0.0,1.0,4.0,72),
        ('swing_primary','swing_score',SWING_TH,1.0,4.0,72),
        ('swing_highconf','swing_score',SWING_HI,1.0,4.0,72),
        ('scalper_baseline','scalp_score',0.0,0.75,1.5,12),
        ('scalper_primary','scalp_score',SCALP_TH,0.75,1.5,12),
        ('scalper_broad','scalp_score',SCALP_BROAD,0.75,1.5,12),
    ]

    results={}
    all_trades=[]
    for name,score_col,th,sm,tm,to in configs:
        df,sk=simulate(cand,h,l,o,t,score_col,th,sm,tm,to,name)
        df.to_csv(OUT/f'{name}_trades.csv',index=False)
        all_trades.append(df)
        results[name]={
            'threshold':th,'stop_atr':sm,'target_atr':tm,'timeout_h':to,
            'skips':sk,'segments':segment(df)
        }

    pd.concat(all_trades,ignore_index=True).to_csv(OUT/'all_trades.csv',index=False)

    # Primary pseudo-test detector-vs-baseline deltas.
    def delta(filtered,baseline):
        f=results[filtered]['segments']['pseudo_test_2025_2026']
        b=results[baseline]['segments']['pseudo_test_2025_2026']
        return {
            'filtered':f,'baseline':b,
            'delta_total_r':float(f['total_r']-b['total_r']),
            'delta_mean_r':float(f['mean_r']-b['mean_r']),
            'pf_ratio':float(f['profit_factor']/b['profit_factor']) if f.get('profit_factor') and b.get('profit_factor') else None,
            'dd_improvement_r':float(abs(b['max_drawdown_r'])-abs(f['max_drawdown_r'])),
        }

    payload={
        'scope':'GTGLab2 Detector Execution Bridge v0.1',
        'quality':quality,
        'pristine_forward_oos_read':False,
        'results':results,
        'primary_comparisons':{
            'swing':delta('swing_primary','swing_baseline'),
            'scalper':delta('scalper_primary','scalper_baseline'),
        }
    }
    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')

    print(json.dumps({
        'swing_primary':results['swing_primary'],
        'swing_baseline':results['swing_baseline'],
        'swing_highconf':results['swing_highconf'],
        'scalper_primary':results['scalper_primary'],
        'scalper_baseline':results['scalper_baseline'],
        'scalper_broad':results['scalper_broad'],
        'primary_comparisons':payload['primary_comparisons'],
    },indent=2))

if __name__=='__main__':
    main()
