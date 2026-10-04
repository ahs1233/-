from pathlib import Path
import json, sys
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
OUT=GTG/'runs'/'m5-transition-state-machine-v01'
sys.path.insert(0,str(HERE.parent))
from linked_h1_m15_m5_entry_v01 import aggregate, build_context

RULES=['MID_RECLAIM','HIGH_RECLAIM','HIGHER_LOW_BREAK']

def base_mask(x):
    return ((x.bl<x.h1_prev12_low) & (x.bl<x.prev12_m5_low)).fillna(False).to_numpy()

def detect_events(x, rule):
    o=x.bo.to_numpy(float); h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); c=x.bc.to_numpy(float)
    t=x.t.to_numpy(np.int64); a=x.h1_atr.to_numpy(float)
    mask=base_mask(x)
    events=[]
    i=1; n=len(x)
    while i<n-2:
        if not mask[i] or not np.isfinite(a[i]) or a[i]<=0:
            i+=1; continue
        episode_start=i; anchor=i; anchor_age=0; j=i+1; fired=False
        while j<n-1 and (j-episode_start)<=12:
            # A lower low means sellers are still extending; move the anchor and restart confirmation clock.
            if l[j] < l[anchor]:
                anchor=j; anchor_age=0; j+=1; continue
            anchor_age=j-anchor
            if anchor_age>6:
                break
            if anchor_age>=1:
                ok=False
                if rule=='MID_RECLAIM':
                    midpoint=(l[anchor]+h[anchor])/2.0
                    ok=(c[j]>=midpoint and c[j]>c[j-1])
                elif rule=='HIGH_RECLAIM':
                    ok=(c[j]>h[anchor])
                elif rule=='HIGHER_LOW_BREAK':
                    ok=(l[j]>l[anchor] and c[j]>h[j-1])
                if ok:
                    events.append({
                        'rule':rule,'episode_start_idx':int(episode_start),'anchor_idx':int(anchor),
                        'signal_idx':int(j),'episode_start_t':int(t[episode_start]),'anchor_t':int(t[anchor]),
                        'signal_t':int(t[j]),'anchor_low':float(l[anchor]),'anchor_high':float(h[anchor]),
                        'atr_h1':float(a[anchor]),'bars_from_anchor':int(j-anchor),
                        'bars_from_episode':int(j-episode_start)
                    })
                    fired=True
                    i=j+1
                    break
            j+=1
        if not fired:
            i=max(i+1,j)
    d=pd.DataFrame(events)
    if len(d):
        d['dt']=pd.to_datetime(d.signal_t,unit='ms',utc=True)
        d['year']=d.dt.dt.year
    return d

def exec_metrics(df):
    if len(df)==0:return {'n':0,'total_r':0.0,'mean_r':None,'profit_factor':None,'max_drawdown_r':None,'win_rate':None,'avg_entry_rr':None}
    v=df.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':int(len(df)),'total_r':float(v.sum()),'mean_r':float(v.mean()),
            'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
            'max_drawdown_r':float((eq-peak).min()),'win_rate':float((v>0).mean()),
            'avg_entry_rr':float(df.entry_rr.mean()),
            'exit_counts':{str(k):int(vv) for k,vv in df.exit_kind.value_counts().items()}}

def simulate(events,x,stop_mult,target_mult,timeout_bars,engine):
    if len(events)==0:return pd.DataFrame(),0
    o=x.bo.to_numpy(float); h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); t=x.t.to_numpy(np.int64)
    rows=[]; next_free=0; invalid=0
    for r in events.sort_values('signal_idx').itertuples(index=False):
        sig=int(r.signal_idx)
        if sig<next_free or sig+1>=len(x): continue
        entry=sig+1; ep=float(o[entry]); a=float(r.atr_h1); low0=float(r.anchor_low)
        stop=low0-stop_mult*a; target=low0+target_mult*a
        if not(stop<ep<target):
            invalid+=1; continue
        risk=ep-stop; rr=(target-ep)/risk
        ex=None; xp=None; kind=None
        for j in range(entry,min(len(x),entry+timeout_bars)):
            oj=float(o[j]); hj=float(h[j]); lj=float(l[j])
            if oj<=stop: ex=j; xp=oj; kind='STOP_GAP'; break
            if oj>=target: ex=j; xp=oj; kind='TARGET_GAP'; break
            if lj<=stop and hj>=target: ex=j; xp=stop; kind='STOP_BOTH'; break
            if lj<=stop: ex=j; xp=stop; kind='STOP'; break
            if hj>=target: ex=j; xp=target; kind='TARGET'; break
        if ex is None:
            j=entry+timeout_bars-1
            if j+1>=len(x): continue
            ex=j+1; xp=float(o[ex]); kind=f'{timeout_bars}BAR_TIMEOUT'
        rows.append({
            'engine':engine,'rule':r.rule,'year':int(r.year),'episode_start_t':int(r.episode_start_t),
            'anchor_t':int(r.anchor_t),'signal_t':int(r.signal_t),'entry_t':int(t[entry]),'exit_t':int(t[ex]),
            'anchor_low':low0,'atr_h1':a,'bars_from_anchor':int(r.bars_from_anchor),
            'bars_from_episode':int(r.bars_from_episode),'entry_px':ep,'stop_px':stop,'target_px':target,
            'exit_px':float(xp),'entry_rr':float(rr),'pnl_r':float((float(xp)-ep)/risk),'exit_kind':kind
        })
        next_free=ex+1
    return pd.DataFrame(rows),invalid

def split_metrics(df):
    return {
      'train':exec_metrics(df[df.year<=2022].sort_values('signal_t')),
      'validation':exec_metrics(df[df.year.isin([2023,2024])].sort_values('signal_t')),
      'pseudo_test':exec_metrics(df[df.year>=2025].sort_values('signal_t')),
      'all':exec_metrics(df.sort_values('signal_t'))
    }

def eligible(stats,engine):
    tr=stats['train']; va=stats['validation']
    mins=(100,40) if engine=='scalper' else (80,30)
    return (tr['n']>=mins[0] and va['n']>=mins[1] and
            tr['mean_r'] is not None and va['mean_r'] is not None and
            tr['mean_r']>0 and va['mean_r']>0 and
            tr['profit_factor'] is not None and va['profit_factor'] is not None and
            tr['profit_factor']>1 and va['profit_factor']>1)

def yearly(df):
    out={}
    for yr,g in df[df.year>=2025].groupby('year'):
        out[str(int(yr))]=exec_metrics(g.sort_values('signal_t'))
    return out

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    m5=aggregate(ROOT,5); m15=aggregate(ROOT,15); h1=aggregate(ROOT,60)
    x=build_context(m5,m15,h1)
    print('bars',len(m5),len(m15),len(h1),flush=True)
    events={r:detect_events(x,r) for r in RULES}
    for r,d in events.items():
        d.to_csv(OUT/f'events_{r.lower()}.csv',index=False)
        print(r,'events',len(d),flush=True)

    specs={'scalper':(0.75,1.5,144),'swing':(1.0,4.0,864)}
    payload={'scope':'M5 Transition State Machine v0.1','bars':{'m5':int(len(m5)),'m15':int(len(m15)),'h1':int(len(h1))},
             'rules':RULES,'pristine_forward_oos_read':False,'engines':{}}
    for engine,(sm,tm,hold) in specs.items():
        results=[]
        trade_map={}
        for rule in RULES:
            trades,invalid=simulate(events[rule],x,sm,tm,hold,engine)
            trades.to_csv(OUT/f'{engine}_{rule.lower()}_trades.csv',index=False)
            st=split_metrics(trades)
            ok=eligible(st,engine)
            rec={'rule':rule,'invalid':invalid,'eligible':bool(ok),**st}
            if ok:
                rec['worst_mean']=min(st['train']['mean_r'],st['validation']['mean_r'])
                rec['worst_dd_abs']=max(abs(st['train']['max_drawdown_r']),abs(st['validation']['max_drawdown_r']))
                rec['min_fills']=min(st['train']['n'],st['validation']['n'])
            results.append(rec); trade_map[rule]=trades
        elig=[r for r in results if r['eligible']]
        elig.sort(key=lambda z:(z['worst_mean'],-z['worst_dd_abs'],z['min_fills']),reverse=True)
        selected=elig[0]['rule'] if elig else None
        frozen=None
        if selected:
            df=trade_map[selected]
            frozen={'rule':selected,'metrics':split_metrics(df),'yearly_2025_2026':yearly(df)}
        payload['engines'][engine]={'all_rules':results,'eligible_n':len(elig),'selected_rule':selected,'frozen':frozen}
    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
