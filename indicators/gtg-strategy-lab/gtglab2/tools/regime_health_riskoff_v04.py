from pathlib import Path
import json
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
SRC=GTG/'runs'/'state-evolution-quarterly-v03'
OUT=GTG/'runs'/'regime-health-riskoff-v04'
WINDOW=20
LOSS_R=-5.0
PF_FLOOR=0.80

def metrics(df):
    if len(df)==0:
        return {'n':0,'total_r':0.0,'mean_r':None,'profit_factor':None,'max_drawdown_r':None,'win_rate':None,'avg_entry_rr':None}
    v=df.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.,eq])[:-1]
    return {'n':int(len(df)),'total_r':float(v.sum()),'mean_r':float(v.mean()),
            'profit_factor':float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum()) else None,
            'max_drawdown_r':float((eq-peak).min()),'win_rate':float((v>0).mean()),
            'avg_entry_rr':float(df.entry_rr.mean()),
            'exit_counts':{str(k):int(vv) for k,vv in df.exit_kind.value_counts().items()}}

def pf(v):
    v=np.asarray(v,float)
    pos=v[v>0].sum(); neg=-v[v<=0].sum()
    if neg<=0: return float('inf')
    return float(pos/neg)

def apply_health(shadow):
    s=shadow.sort_values('entry_t').copy().reset_index(drop=True)
    decisions=[]
    for i,r in s.iterrows():
        entry=int(r.entry_t)
        closed=s[(s.exit_t<entry)].sort_values('exit_t').tail(WINDOW)
        if len(closed)<WINDOW:
            risk_off=False; total=None; p=None
        else:
            vv=closed.pnl_r.to_numpy(float)
            total=float(vv.sum()); p=pf(vv)
            risk_off=(total<=LOSS_R) or (p<=PF_FLOOR)
        decisions.append({
          'risk_off':bool(risk_off),'health_n':int(len(closed)),
          'health_total_r':total,'health_pf':p
        })
    h=pd.DataFrame(decisions)
    s=pd.concat([s,h],axis=1)
    live=s[~s.risk_off].copy()
    skipped=s[s.risk_off].copy()
    return s,live,skipped

def grouped(df,col):
    out={}
    for k,g in df.groupby(col):
        out[str(k)]=metrics(g.sort_values('signal_t'))
    return out

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    payload={'scope':'Regime Health Risk-Off v0.4','window':WINDOW,'loss_r_threshold':LOSS_R,
             'pf_floor':PF_FLOOR,'pristine_forward_oos_read':False,'engines':{}}

    for engine in ['scalper','swing']:
        shadow=pd.read_csv(SRC/f'{engine}_quarterly_walkforward_trades.csv')
        full,live,skipped=apply_health(shadow)
        full.to_csv(OUT/f'{engine}_health_decisions.csv',index=False)
        live.to_csv(OUT/f'{engine}_live_trades.csv',index=False)
        skipped.to_csv(OUT/f'{engine}_skipped_shadow_trades.csv',index=False)

        for df in [full,live,skipped]:
            if len(df):
                dt=pd.to_datetime(df.signal_t,unit='ms',utc=True)
                df['year']=dt.dt.year
                df['quarter_key']=dt.dt.year.astype(str)+'Q'+dt.dt.quarter.astype(str)

        riskoff_2026=full[(full.year==2026)&(full.risk_off)] if len(full) else pd.DataFrame()
        first=None
        if len(riskoff_2026):
            first=pd.to_datetime(int(riskoff_2026.iloc[0].entry_t),unit='ms',utc=True).isoformat()

        payload['engines'][engine]={
          'shadow':metrics(full),
          'live':metrics(live),
          'skipped':{
            'n':int(len(skipped)),
            'fraction':float(len(skipped)/len(full)) if len(full) else 0.0,
            'shadow_total_r':float(skipped.pnl_r.sum()) if len(skipped) else 0.0
          },
          'live_yearly':grouped(live,'year') if len(live) else {},
          'shadow_yearly':grouped(full,'year') if len(full) else {},
          'live_quarterly':grouped(live,'quarter_key') if len(live) else {},
          'shadow_quarterly':grouped(full,'quarter_key') if len(full) else {},
          'riskoff_2026':{
            'first_entry_utc':first,
            'decisions_off':int(len(riskoff_2026)),
            'shadow_r_skipped':float(riskoff_2026.pnl_r.sum()) if len(riskoff_2026) else 0.0
          }
        }
        print(engine,'shadow',json.dumps(metrics(full)),flush=True)
        print(engine,'live',json.dumps(metrics(live)),flush=True)
        print(engine,'skipped',len(skipped),float(skipped.pnl_r.sum()) if len(skipped) else 0.0,flush=True)
        for key in ['2026Q1','2026Q2','2026Q3']:
            print(engine,key,'shadow',json.dumps(payload['engines'][engine]['shadow_quarterly'].get(key)),
                  'live',json.dumps(payload['engines'][engine]['live_quarterly'].get(key)),flush=True)

    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))

if __name__=='__main__': main()
