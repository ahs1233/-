from pathlib import Path
import json, math, sys
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.metrics import (
    roc_auc_score, average_precision_score, brier_score_loss,
    precision_score, recall_score
)
import joblib

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
SRC=GTG/'runs'/'bottom-atlas-v01'/'bottom_candidates.csv'
OUT=GTG/'runs'/'bottom-detector-v01'

FEATURES=[
    'drift5_atr','drift20_atr','drift50_atr',
    'eff5','eff20','eff50',
    'pos24','pos72','atr_rel120',
    'close_location','body_atr','lower_wick_atr','upper_wick_atr',
    'ema50_dist_atr','ema200_dist_atr',
    'ema50_slope_atr','ema200_slope_atr',
    'decline_from_24h_high_atr','decline_from_72h_high_atr'
]

def metrics(y,p):
    y=np.asarray(y,int); p=np.asarray(p,float)
    return {
        'n':int(len(y)),
        'base_rate':float(y.mean()) if len(y) else None,
        'roc_auc':float(roc_auc_score(y,p)) if len(np.unique(y))>1 else None,
        'pr_auc':float(average_precision_score(y,p)) if len(np.unique(y))>1 else None,
        'brier':float(brier_score_loss(y,p)) if len(y) else None,
        'score_mean':float(np.mean(p)) if len(p) else None,
        'score_median':float(np.median(p)) if len(p) else None,
    }

def threshold_stats(y,p,th):
    y=np.asarray(y,int); p=np.asarray(p,float)
    sel=p>=th
    n=int(sel.sum())
    if n==0:
        return {'threshold':float(th),'selected':0,'coverage':0.0,'precision':None,'recall':0.0,'lift':None}
    prec=float(y[sel].mean())
    rec=float(y[sel].sum()/max(1,y.sum()))
    base=float(y.mean())
    return {
        'threshold':float(th),'selected':n,'coverage':float(n/len(y)),
        'precision':prec,'recall':rec,'lift':float(prec/base) if base>0 else None
    }

def choose_thresholds(y,p):
    y=np.asarray(y,int); p=np.asarray(p,float)
    th50=float(np.quantile(p,0.50))
    th25=float(np.quantile(p,0.75))
    out={
        'coverage_50':threshold_stats(y,p,th50),
        'coverage_25':threshold_stats(y,p,th25),
    }
    # Highest recall threshold achieving >=60% precision and >=5% coverage.
    candidates=[]
    for th in np.unique(np.round(p,8)):
        st=threshold_stats(y,p,float(th))
        if st['coverage']>=0.05 and st['precision'] is not None and st['precision']>=0.60:
            candidates.append(st)
    if candidates:
        candidates.sort(key=lambda z:(z['recall'],z['coverage'],-z['threshold']),reverse=True)
        out['high_confidence_60p']=candidates[0]
    else:
        # Fall back to threshold with best precision among >=5% coverage.
        candidates=[]
        for th in np.unique(np.round(p,8)):
            st=threshold_stats(y,p,float(th))
            if st['coverage']>=0.05 and st['precision'] is not None:
                candidates.append(st)
        candidates.sort(key=lambda z:(z['precision'],z['recall']),reverse=True)
        out['high_confidence_60p']=candidates[0] if candidates else None
    return out

def calibration_deciles(df,score_col):
    x=df[['y',score_col]].dropna().copy()
    # rank-based qcut to handle duplicate scores robustly
    x['decile']=pd.qcut(x[score_col].rank(method='first'),10,labels=False,duplicates='drop')+1
    rows=[]
    for d,g in x.groupby('decile'):
        rows.append({
            'decile':int(d),
            'n':int(len(g)),
            'score_mean':float(g[score_col].mean()),
            'good_rate':float(g.y.mean())
        })
    return rows

def yearly(df,score_col):
    out={}
    for y,g in df.groupby('year'):
        out[str(int(y))]=metrics(g.y,g[score_col])
    return out

def eval_with_thresholds(y,p,thresholds):
    out={}
    for name,st in thresholds.items():
        if not st:
            out[name]=None
            continue
        out[name]=threshold_stats(y,p,st['threshold'])
    return out

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    d=pd.read_csv(SRC)
    d['dt']=pd.to_datetime(d['t'],unit='ms',utc=True)
    d['year']=d.dt.dt.year
    resolved=d[(d.good_48h.astype(bool)) ^ (d.false_48h.astype(bool))].copy()
    resolved['y']=resolved.good_48h.astype(int)

    train=resolved[resolved.year<=2022].copy()
    val=resolved[resolved.year.isin([2023,2024])].copy()
    test=resolved[resolved.year>=2025].copy()

    Xtr=train[FEATURES]; ytr=train.y
    Xv=val[FEATURES]; yv=val.y
    Xt=test[FEATURES]; yt=test.y

    # Logistic model selection on validation only
    log_runs=[]
    for C in [0.1,0.3,1.0,3.0]:
        pipe=Pipeline([
            ('impute',SimpleImputer(strategy='median')),
            ('scale',StandardScaler()),
            ('model',LogisticRegression(C=C,class_weight='balanced',max_iter=3000,solver='lbfgs'))
        ])
        pipe.fit(Xtr,ytr)
        pv=pipe.predict_proba(Xv)[:,1]
        m=metrics(yv,pv)
        log_runs.append((C,pipe,m))
    log_runs.sort(key=lambda x:(x[2]['roc_auc'],-x[2]['brier'],-x[0]),reverse=True)
    bestC,log_model,log_val=log_runs[0]

    # Tree selection on validation; prefer shallower within 0.01 AUC of best.
    tree_runs=[]
    for depth in [2,3,4]:
        for leaf in [50,100,200]:
            pipe=Pipeline([
                ('impute',SimpleImputer(strategy='median')),
                ('model',DecisionTreeClassifier(max_depth=depth,min_samples_leaf=leaf,class_weight='balanced',random_state=42))
            ])
            pipe.fit(Xtr,ytr)
            pv=pipe.predict_proba(Xv)[:,1]
            m=metrics(yv,pv)
            tree_runs.append((depth,leaf,pipe,m))
    best_auc=max(x[3]['roc_auc'] for x in tree_runs)
    near=[x for x in tree_runs if x[3]['roc_auc']>=best_auc-0.01]
    near.sort(key=lambda x:(x[0],-x[3]['roc_auc'],x[1]))
    bestDepth,bestLeaf,tree_model,tree_val=near[0]

    # Scores
    for split in [train,val,test]:
        split['log_score']=log_model.predict_proba(split[FEATURES])[:,1]
        split['tree_score']=tree_model.predict_proba(split[FEATURES])[:,1]

    # Choose operating thresholds from validation only
    log_th=choose_thresholds(val.y,val.log_score)
    tree_th=choose_thresholds(val.y,val.tree_score)

    # Pseudo-test frozen threshold read
    result={
        'scope':'GTGLab2 Bottom Detector v0.1',
        'features':FEATURES,
        'splits':{
            'train_2018_2022':{'n':int(len(train)),'base_rate':float(train.y.mean())},
            'validation_2023_2024':{'n':int(len(val)),'base_rate':float(val.y.mean())},
            'pseudo_test_2025_2026':{'n':int(len(test)),'base_rate':float(test.y.mean())},
        },
        'logistic':{
            'selected_C':bestC,
            'selection_runs':[{'C':C,**m} for C,_,m in log_runs],
            'train':metrics(train.y,train.log_score),
            'validation':metrics(val.y,val.log_score),
            'pseudo_test':metrics(test.y,test.log_score),
            'validation_thresholds':log_th,
            'pseudo_test_at_frozen_thresholds':eval_with_thresholds(test.y,test.log_score,log_th),
            'yearly':yearly(pd.concat([train,val,test]),'log_score'),
            'validation_deciles':calibration_deciles(val,'log_score'),
            'pseudo_test_deciles':calibration_deciles(test,'log_score'),
        },
        'tree':{
            'selected_depth':bestDepth,'selected_min_samples_leaf':bestLeaf,
            'selection_runs':[{'depth':dpt,'min_samples_leaf':leaf,**m} for dpt,leaf,_,m in sorted(tree_runs,key=lambda x:x[3]['roc_auc'],reverse=True)],
            'train':metrics(train.y,train.tree_score),
            'validation':metrics(val.y,val.tree_score),
            'pseudo_test':metrics(test.y,test.tree_score),
            'validation_thresholds':tree_th,
            'pseudo_test_at_frozen_thresholds':eval_with_thresholds(test.y,test.tree_score,tree_th),
            'yearly':yearly(pd.concat([train,val,test]),'tree_score'),
            'validation_deciles':calibration_deciles(val,'tree_score'),
            'pseudo_test_deciles':calibration_deciles(test,'tree_score'),
        }
    }

    # Logistic coefficients
    scaler=log_model.named_steps['scale']
    model=log_model.named_steps['model']
    coef=pd.DataFrame({'feature':FEATURES,'coef_std':model.coef_[0]})
    coef['abs_coef']=coef.coef_std.abs()
    coef=coef.sort_values('abs_coef',ascending=False)
    coef.to_csv(OUT/'logistic_coefficients.csv',index=False)
    result['logistic']['top_coefficients']=coef.head(12).to_dict('records')

    # Tree rules
    tree_text=export_text(tree_model.named_steps['model'],feature_names=FEATURES,decimals=3)
    (OUT/'tree_rules.txt').write_text(tree_text,encoding='utf-8')
    result['tree']['rules']=tree_text

    # Save predictions
    allpred=pd.concat([
        train.assign(split='train'),
        val.assign(split='validation'),
        test.assign(split='pseudo_test')
    ],ignore_index=True)
    keep=['t','dt','year','y','good_48h','false_48h','log_score','tree_score']+FEATURES
    allpred[keep].to_csv(OUT/'predictions.csv',index=False)

    joblib.dump(log_model,OUT/'logistic_model.joblib')
    joblib.dump(tree_model,OUT/'tree_model.joblib')
    (OUT/'summary.json').write_text(json.dumps(result,indent=2),encoding='utf-8')

    print(json.dumps({
        'splits':result['splits'],
        'logistic':{
            'C':bestC,'train':result['logistic']['train'],'val':result['logistic']['validation'],
            'test':result['logistic']['pseudo_test'],'thresholds':log_th,
            'test_at_thresholds':result['logistic']['pseudo_test_at_frozen_thresholds'],
            'top_coefficients':result['logistic']['top_coefficients'][:8],
        },
        'tree':{
            'depth':bestDepth,'leaf':bestLeaf,'train':result['tree']['train'],'val':result['tree']['validation'],
            'test':result['tree']['pseudo_test'],'thresholds':tree_th,
            'test_at_thresholds':result['tree']['pseudo_test_at_frozen_thresholds'],
            'rules':tree_text,
        }
    },indent=2))

if __name__=='__main__':
    main()
