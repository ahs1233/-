from pathlib import Path
import json, sys
import numpy as np
import pandas as pd

from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss
import joblib

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
LAB=GTG.parent
for p in (GTG, LAB/'library-comparison', LAB/'data', GTG/'engine'):
    sys.path.insert(0,str(p))

from pine_v02_exact_extended_test import load_clean

ROOT=Path(r'C:\Users\alk\gtg-lab-data-historical-clean-v1')
CAND=GTG/'runs'/'bottom-atlas-v01'/'bottom_candidates.csv'
OUT=GTG/'runs'/'swing-scalper-detectors-v01'

FEATURES=[
    'drift5_atr','drift20_atr','drift50_atr',
    'eff5','eff20','eff50',
    'pos24','pos72','atr_rel120',
    'close_location','body_atr','lower_wick_atr','upper_wick_atr',
    'ema50_dist_atr','ema200_dist_atr',
    'ema50_slope_atr','ema200_slope_atr',
    'decline_from_24h_high_atr','decline_from_72h_high_atr'
]

def first_hit(high,low,start,end,up,down):
    for j in range(start,min(end,len(high))):
        u=high[j]>=up
        d=low[j]<=down
        if u and d:
            return 'AMB',j
        if u:
            return 'UP',j
        if d:
            return 'DOWN',j
    return 'NONE',None

def metrics(y,p):
    y=np.asarray(y,int); p=np.asarray(p,float)
    return {
        'n':int(len(y)),
        'base_rate':float(y.mean()) if len(y) else None,
        'roc_auc':float(roc_auc_score(y,p)) if len(np.unique(y))>1 else None,
        'pr_auc':float(average_precision_score(y,p)) if len(np.unique(y))>1 else None,
        'brier':float(brier_score_loss(y,p)) if len(y) else None,
    }

def threshold_stats(y,p,th):
    y=np.asarray(y,int); p=np.asarray(p,float)
    sel=p>=th; n=int(sel.sum()); base=float(y.mean())
    if n==0:
        return {'threshold':float(th),'selected':0,'coverage':0.0,'precision':None,'recall':0.0,'lift':None}
    prec=float(y[sel].mean())
    rec=float(y[sel].sum()/max(1,y.sum()))
    return {'threshold':float(th),'selected':n,'coverage':float(n/len(y)),
            'precision':prec,'recall':rec,'lift':float(prec/base) if base>0 else None}

def choose_thresholds(y,p):
    y=np.asarray(y,int); p=np.asarray(p,float)
    out={
        'coverage_50':threshold_stats(y,p,float(np.quantile(p,.50))),
        'coverage_25':threshold_stats(y,p,float(np.quantile(p,.75))),
    }
    cands=[]
    for th in np.unique(np.round(p,8)):
        st=threshold_stats(y,p,float(th))
        if st['coverage']>=.05 and st['precision'] is not None and st['precision']>=.60:
            cands.append(st)
    if cands:
        cands.sort(key=lambda z:(z['recall'],z['coverage']),reverse=True)
        out['high_confidence_60p']=cands[0]
    else:
        cands=[]
        for th in np.unique(np.round(p,8)):
            st=threshold_stats(y,p,float(th))
            if st['coverage']>=.05 and st['precision'] is not None:
                cands.append(st)
        cands.sort(key=lambda z:(z['precision'],z['recall']),reverse=True)
        out['high_confidence_60p']=cands[0] if cands else None
    return out

def eval_thresholds(y,p,ths):
    return {k:(threshold_stats(y,p,v['threshold']) if v else None) for k,v in ths.items()}

def fit_target(df,target):
    train=df[df.year<=2022].copy()
    val=df[df.year.isin([2023,2024])].copy()
    test=df[df.year>=2025].copy()
    runs=[]
    for C in [0.1,0.3,1.0,3.0]:
        model=Pipeline([
            ('impute',SimpleImputer(strategy='median')),
            ('scale',StandardScaler()),
            ('model',LogisticRegression(C=C,class_weight='balanced',max_iter=3000,solver='lbfgs'))
        ])
        model.fit(train[FEATURES],train[target])
        pv=model.predict_proba(val[FEATURES])[:,1]
        m=metrics(val[target],pv)
        runs.append((C,model,m))
    runs.sort(key=lambda x:(x[2]['roc_auc'],-x[2]['brier'],-x[0]),reverse=True)
    C,model,mv=runs[0]
    train['score']=model.predict_proba(train[FEATURES])[:,1]
    val['score']=model.predict_proba(val[FEATURES])[:,1]
    test['score']=model.predict_proba(test[FEATURES])[:,1]
    th=choose_thresholds(val[target],val.score)

    coef=pd.DataFrame({'feature':FEATURES,'coef_std':model.named_steps['model'].coef_[0]})
    coef['abs_coef']=coef.coef_std.abs()
    coef=coef.sort_values('abs_coef',ascending=False)

    yearly={}
    allx=pd.concat([train,val,test])
    for y,g in allx.groupby('year'):
        yearly[str(int(y))]=metrics(g[target],g.score)

    return {
        'selected_C':C,
        'selection_runs':[{'C':c,**m} for c,_,m in runs],
        'train':metrics(train[target],train.score),
        'validation':metrics(val[target],val.score),
        'pseudo_test':metrics(test[target],test.score),
        'validation_thresholds':th,
        'pseudo_test_at_frozen_thresholds':eval_thresholds(test[target],test.score,th),
        'top_coefficients':coef.head(12).to_dict('records'),
        'yearly':yearly,
        'model':model,
        'predictions':pd.concat([
            train.assign(split='train'),
            val.assign(split='validation'),
            test.assign(split='pseudo_test')
        ])
    }

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    cand=pd.read_csv(CAND)
    cand['dt']=pd.to_datetime(cand.t,unit='ms',utc=True)
    cand['year']=cand.dt.dt.year

    f,_=load_clean(ROOT)
    t=f.t.to_numpy(np.int64)
    h=f.bh.to_numpy(float); l=f.bl.to_numpy(float)

    # Map candidate timestamp -> data index. Atlas already stores idx, use it directly.
    swing_label=[]; scalp_label=[]
    swing_state=[]; scalp_state=[]
    for r in cand.itertuples(index=False):
        i=int(r.idx); a=float(r.atr); base=float(r.price_low)
        sstate,_=first_hit(h,l,i+1,i+73,base+4.0*a,base-1.0*a)
        cstate,_=first_hit(h,l,i+1,i+13,base+1.5*a,base-0.75*a)
        swing_state.append(sstate)
        scalp_state.append(cstate)
        swing_label.append(1 if sstate=='UP' else (0 if sstate=='DOWN' else np.nan))
        scalp_label.append(1 if cstate=='UP' else (0 if cstate=='DOWN' else np.nan))

    cand['swing_state']=swing_state
    cand['scalp_state']=scalp_state
    cand['swing_good']=swing_label
    cand['scalp_good']=scalp_label

    cand.to_csv(OUT/'candidate_labels.csv',index=False)

    outputs={}
    for name,target in [('swing','swing_good'),('scalper','scalp_good')]:
        df=cand[cand[target].notna()].copy()
        df[target]=df[target].astype(int)
        res=fit_target(df,target)
        model=res.pop('model')
        preds=res.pop('predictions')
        joblib.dump(model,OUT/f'{name}_model.joblib')
        pd.DataFrame(res['top_coefficients']).to_csv(OUT/f'{name}_coefficients.csv',index=False)
        keep=['t','dt','year',target,'score']+FEATURES
        preds[keep].to_csv(OUT/f'{name}_predictions.csv',index=False)
        res['population']={
            'resolved_n':int(len(df)),
            'good_n':int(df[target].sum()),
            'false_n':int((1-df[target]).sum()),
            'overall_good_rate':float(df[target].mean())
        }
        outputs[name]=res

    payload={
        'scope':'GTGLab2 Swing / Scalper Bottom Detectors v0.1',
        'targets':{
            'swing':'candidate low +4 ATR before -1 ATR within 72H',
            'scalper':'candidate low +1.5 ATR before -0.75 ATR within 12H'
        },
        'features':FEATURES,
        'pristine_forward_oos_read':False,
        'swing':outputs['swing'],
        'scalper':outputs['scalper']
    }
    (OUT/'summary.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')

    print(json.dumps({
        'swing':{
            'population':outputs['swing']['population'],
            'C':outputs['swing']['selected_C'],
            'train':outputs['swing']['train'],
            'validation':outputs['swing']['validation'],
            'pseudo_test':outputs['swing']['pseudo_test'],
            'thresholds':outputs['swing']['validation_thresholds'],
            'pseudo_test_at_thresholds':outputs['swing']['pseudo_test_at_frozen_thresholds'],
            'top_coefficients':outputs['swing']['top_coefficients'][:8],
        },
        'scalper':{
            'population':outputs['scalper']['population'],
            'C':outputs['scalper']['selected_C'],
            'train':outputs['scalper']['train'],
            'validation':outputs['scalper']['validation'],
            'pseudo_test':outputs['scalper']['pseudo_test'],
            'thresholds':outputs['scalper']['validation_thresholds'],
            'pseudo_test_at_thresholds':outputs['scalper']['pseudo_test_at_frozen_thresholds'],
            'top_coefficients':outputs['scalper']['top_coefficients'][:8],
        }
    },indent=2))

if __name__=='__main__':
    main()
