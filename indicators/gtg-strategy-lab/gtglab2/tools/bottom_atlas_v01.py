from pathlib import Path
import argparse, json, sys, math
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve()
GTG=HERE.parents[1]
LAB=GTG.parent
for p in (GTG, LAB/'library-comparison', LAB/'data', GTG/'engine'):
    sys.path.insert(0,str(p))

from pine_v02_exact_extended_test import load_clean, FREEZE_MS

def efficiency(close: pd.Series, n: int) -> pd.Series:
    path=close.diff().abs().rolling(n).sum()
    return (close-close.shift(n)).abs()/path.replace(0,np.nan)

def first_hit(high, low, start, end, up_level, down_level):
    up_i=None; dn_i=None; amb=False
    for j in range(start, min(end, len(high))):
        u=high[j] >= up_level
        d=low[j] <= down_level
        if u and d:
            amb=True
            return j,j,True
        if u and up_i is None:
            up_i=j
        if d and dn_i is None:
            dn_i=j
        if up_i is not None or dn_i is not None:
            break
    return up_i,dn_i,amb

def directional_pivots(h, l, atr, t, k):
    valid=np.flatnonzero(np.isfinite(atr))
    if not len(valid):
        return pd.DataFrame()
    s=int(valid[0])
    state=0
    hi_idx=lo_idx=s
    piv=[]
    for i in range(s+1,len(h)):
        if state==0:
            if h[i]>h[hi_idx]: hi_idx=i
            if l[i]<l[lo_idx]: lo_idx=i
            up_thresh=k*atr[lo_idx] if np.isfinite(atr[lo_idx]) else np.nan
            dn_thresh=k*atr[hi_idx] if np.isfinite(atr[hi_idx]) else np.nan
            up=(np.isfinite(up_thresh) and h[i]-l[lo_idx]>=up_thresh)
            dn=(np.isfinite(dn_thresh) and h[hi_idx]-l[i]>=dn_thresh)
            if up and not dn:
                piv.append(('LOW',lo_idx,l[lo_idx],i))
                state=1
                hi_idx=i
            elif dn and not up:
                piv.append(('HIGH',hi_idx,h[hi_idx],i))
                state=-1
                lo_idx=i
            elif up and dn:
                # choose the move whose normalized threshold was exceeded more.
                ur=(h[i]-l[lo_idx])/up_thresh if up_thresh>0 else 0
                dr=(h[hi_idx]-l[i])/dn_thresh if dn_thresh>0 else 0
                if ur>=dr:
                    piv.append(('LOW',lo_idx,l[lo_idx],i)); state=1; hi_idx=i
                else:
                    piv.append(('HIGH',hi_idx,h[hi_idx],i)); state=-1; lo_idx=i
        elif state==1:
            if h[i]>h[hi_idx]:
                hi_idx=i
            th=k*atr[hi_idx] if np.isfinite(atr[hi_idx]) else np.nan
            if np.isfinite(th) and h[hi_idx]-l[i]>=th:
                piv.append(('HIGH',hi_idx,h[hi_idx],i))
                state=-1
                lo_idx=i
        else:
            if l[i]<l[lo_idx]:
                lo_idx=i
            th=k*atr[lo_idx] if np.isfinite(atr[lo_idx]) else np.nan
            if np.isfinite(th) and h[i]-l[lo_idx]>=th:
                piv.append(('LOW',lo_idx,l[lo_idx],i))
                state=1
                hi_idx=i
    rows=[]
    for typ,idx,px,conf in piv:
        rows.append({
            'type':typ,'idx':int(idx),'t':int(t[idx]),'price':float(px),
            'atr':float(atr[idx]),'confirm_idx':int(conf),'confirm_t':int(t[conf]),
            'confirm_delay_bars':int(conf-idx),'scale_atr':float(k)
        })
    return pd.DataFrame(rows)

def completed_low_swings(piv: pd.DataFrame, h, l, atr, t):
    if piv.empty: return pd.DataFrame()
    piv=piv.sort_values('idx').reset_index(drop=True)
    rows=[]
    for i in range(1,len(piv)-1):
        if piv.loc[i,'type']!='LOW':
            continue
        prev=piv.loc[i-1]
        cur=piv.loc[i]
        nxt=piv.loc[i+1]
        if prev['type']!='HIGH' or nxt['type']!='HIGH':
            continue
        li=int(cur.idx); ph=int(prev.idx); nh=int(nxt.idx)
        a=float(cur.atr)
        if not np.isfinite(a) or a<=0: continue
        prior_decline=(float(prev.price)-float(cur.price))/a
        next_rise=(float(nxt.price)-float(cur.price))/a
        # following low if available
        follow_decl=np.nan; follow_dur=np.nan
        if i+2<len(piv) and piv.loc[i+2,'type']=='LOW':
            fl=piv.loc[i+2]
            follow_decl=(float(nxt.price)-float(fl.price))/a
            follow_dur=int(fl.idx)-nh
        f48_end=min(len(h),li+49)
        next48_range=(np.nanmax(h[li:f48_end])-np.nanmin(l[li:f48_end]))/a if f48_end>li+1 else np.nan
        rows.append({
            'low_t':int(cur.t),'low_idx':li,'low_price':float(cur.price),'atr':a,
            'confirm_t':int(cur.confirm_t),'confirm_delay_bars':int(cur.confirm_delay_bars),
            'prev_high_t':int(prev.t),'prev_high_price':float(prev.price),
            'prior_decline_atr':float(prior_decline),'prior_decline_bars':int(li-ph),
            'next_high_t':int(nxt.t),'next_high_price':float(nxt.price),
            'next_rise_atr':float(next_rise),'rise_bars':int(nh-li),
            'following_decline_atr':float(follow_decl) if np.isfinite(follow_decl) else np.nan,
            'following_decline_bars':float(follow_dur) if np.isfinite(follow_dur) else np.nan,
            'next48_range_atr':float(next48_range),
            'scale_atr':float(cur.scale_atr),
        })
    return pd.DataFrame(rows)

def candidate_table(f: pd.DataFrame):
    t=f.t.to_numpy(np.int64)
    o=f.bo.astype(float); h=f.bh.astype(float); l=f.bl.astype(float); c=f.bc.astype(float)
    prev=c.shift(1).fillna(c.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev),np.abs(l-prev))))
    atr=tr.rolling(14).mean()
    atrmed120=atr.rolling(120).median()
    ema50=c.ewm(span=50,adjust=False).mean()
    ema200=c.ewm(span=200,adjust=False).mean()
    p12lo=l.shift(1).rolling(12).min()
    p24lo=l.shift(1).rolling(24).min(); p24hi=h.shift(1).rolling(24).max()
    p72lo=l.shift(1).rolling(72).min(); p72hi=h.shift(1).rolling(72).max()
    candidates=np.flatnonzero((l<p12lo).fillna(False).to_numpy())
    effs={n:efficiency(c,n) for n in (5,20,50)}
    rows=[]
    hv=h.to_numpy(float); lv=l.to_numpy(float); cv=c.to_numpy(float); ov=o.to_numpy(float)
    av=atr.to_numpy(float)
    for i in candidates:
        a=av[i]
        if not np.isfinite(a) or a<=0 or i+2>=len(f):
            continue
        width24=float(p24hi.iloc[i]-p24lo.iloc[i])
        width72=float(p72hi.iloc[i]-p72lo.iloc[i])
        bar_range=hv[i]-lv[i]
        body=abs(cv[i]-ov[i])
        lower_wick=min(ov[i],cv[i])-lv[i]
        upper_wick=hv[i]-max(ov[i],cv[i])
        row={
            't':int(t[i]),'idx':int(i),'price_low':float(lv[i]),'close':float(cv[i]),'atr':float(a),
            'drift5_atr':float((cv[i]-cv[i-5])/a) if i>=5 else np.nan,
            'drift20_atr':float((cv[i]-cv[i-20])/a) if i>=20 else np.nan,
            'drift50_atr':float((cv[i]-cv[i-50])/a) if i>=50 else np.nan,
            'eff5':float(effs[5].iloc[i]),'eff20':float(effs[20].iloc[i]),'eff50':float(effs[50].iloc[i]),
            'pos24':float((cv[i]-p24lo.iloc[i])/width24) if width24>0 else np.nan,
            'pos72':float((cv[i]-p72lo.iloc[i])/width72) if width72>0 else np.nan,
            'atr_rel120':float(a/atrmed120.iloc[i]) if np.isfinite(atrmed120.iloc[i]) and atrmed120.iloc[i]>0 else np.nan,
            'close_location':float((cv[i]-lv[i])/bar_range) if bar_range>0 else np.nan,
            'body_atr':float(body/a),'lower_wick_atr':float(lower_wick/a),'upper_wick_atr':float(upper_wick/a),
            'ema50_dist_atr':float((cv[i]-ema50.iloc[i])/a),
            'ema200_dist_atr':float((cv[i]-ema200.iloc[i])/a),
            'ema50_slope_atr':float((ema50.iloc[i]-ema50.iloc[i-1])/a) if i>=1 else np.nan,
            'ema200_slope_atr':float((ema200.iloc[i]-ema200.iloc[i-1])/a) if i>=1 else np.nan,
            'decline_from_24h_high_atr':float((p24hi.iloc[i]-cv[i])/a) if np.isfinite(p24hi.iloc[i]) else np.nan,
            'decline_from_72h_high_atr':float((p72hi.iloc[i]-cv[i])/a) if np.isfinite(p72hi.iloc[i]) else np.nan,
        }
        for horizon in (6,12,24,48):
            end=min(len(f),i+1+horizon)
            fh=hv[i+1:end]; fl=lv[i+1:end]
            row[f'mfe_{horizon}h_atr']=float((np.max(fh)-lv[i])/a) if len(fh) else np.nan
            row[f'mae_{horizon}h_atr']=float((lv[i]-np.min(fl))/a) if len(fl) else np.nan

        # +2 before -1 within 24h
        up24,dn24,amb24=first_hit(hv,lv,i+1,i+25,lv[i]+2*a,lv[i]-1*a)
        row['good_24h']=bool(up24 is not None and (dn24 is None or up24<dn24) and not amb24)
        row['false_24h']=bool(dn24 is not None and (up24 is None or dn24<up24) and not amb24)
        row['ambiguous_24h']=bool(amb24)
        row['bars_to_plus2']=float(up24-i) if up24 is not None else np.nan
        row['bars_to_minus1_24']=float(dn24-i) if dn24 is not None else np.nan

        up48,dn48,amb48=first_hit(hv,lv,i+1,i+49,lv[i]+3*a,lv[i]-1*a)
        row['good_48h']=bool(up48 is not None and (dn48 is None or up48<dn48) and not amb48)
        row['false_48h']=bool(dn48 is not None and (up48 is None or dn48<up48) and not amb48)
        row['ambiguous_48h']=bool(amb48)
        row['bars_to_plus3']=float(up48-i) if up48 is not None else np.nan
        row['bars_to_minus1_48']=float(dn48-i) if dn48 is not None else np.nan
        rows.append(row)
    return pd.DataFrame(rows)

def summarize_features(cand, label_good='good_48h', label_false='false_48h'):
    feats=['drift5_atr','drift20_atr','drift50_atr','eff5','eff20','eff50','pos24','pos72',
           'atr_rel120','close_location','body_atr','lower_wick_atr','upper_wick_atr',
           'ema50_dist_atr','ema200_dist_atr','ema50_slope_atr','ema200_slope_atr',
           'decline_from_24h_high_atr','decline_from_72h_high_atr']
    good=cand[cand[label_good]]
    false=cand[cand[label_false]]
    rows=[]
    for k in feats:
        a=good[k].dropna(); b=false[k].dropna()
        if len(a)<2 or len(b)<2: continue
        pooled=math.sqrt((a.var(ddof=1)+b.var(ddof=1))/2) if np.isfinite(a.var(ddof=1)+b.var(ddof=1)) else np.nan
        effect=(a.mean()-b.mean())/pooled if pooled and pooled>0 else np.nan
        rows.append({'feature':k,'good_n':len(a),'false_n':len(b),
                     'good_median':float(a.median()),'false_median':float(b.median()),
                     'good_mean':float(a.mean()),'false_mean':float(b.mean()),
                     'effect_good_minus_false':float(effect) if np.isfinite(effect) else np.nan})
    return pd.DataFrame(rows).sort_values('effect_good_minus_false',key=lambda s:s.abs(),ascending=False)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',required=True)
    ap.add_argument('--out',required=True)
    a=ap.parse_args()
    out=Path(a.out); out.mkdir(parents=True,exist_ok=False)
    f,quality=load_clean(Path(a.root))
    t=f.t.to_numpy(np.int64)
    o=f.bo.astype(float); h=f.bh.astype(float); l=f.bl.astype(float); c=f.bc.astype(float)
    prev=c.shift(1).fillna(c.iloc[0])
    tr=pd.Series(np.maximum(h-l,np.maximum(np.abs(h-prev),np.abs(l-prev))))
    atr=tr.rolling(14).mean().to_numpy(float)
    hv=h.to_numpy(float); lv=l.to_numpy(float)

    swing_summary={}
    for k in (1.0,2.0,4.0):
        piv=directional_pivots(hv,lv,atr,t,k)
        sw=completed_low_swings(piv,hv,lv,atr,t)
        piv.to_csv(out/f'pivots_{k:g}atr.csv',index=False)
        sw.to_csv(out/f'low_swings_{k:g}atr.csv',index=False)
        swing_summary[str(k)]={
            'pivots':int(len(piv)),'lows':int((piv.type=='LOW').sum()) if len(piv) else 0,
            'completed_low_swings':int(len(sw)),
            'median_next_rise_atr':float(sw.next_rise_atr.median()) if len(sw) else None,
            'median_prior_decline_atr':float(sw.prior_decline_atr.median()) if len(sw) else None,
            'median_rise_bars':float(sw.rise_bars.median()) if len(sw) else None,
        }

    cand=candidate_table(f)
    cand['dt']=pd.to_datetime(cand.t,unit='ms',utc=True)
    cand['year']=cand.dt.dt.year
    cand.to_csv(out/'bottom_candidates.csv',index=False)

    feat=summarize_features(cand)
    feat.to_csv(out/'good_vs_false_features.csv',index=False)

    sw2=pd.read_csv(out/'low_swings_2atr.csv')
    swing_bottoms=sw2[sw2.next_rise_atr>=4].copy() if len(sw2) else sw2
    swing_bottoms.to_csv(out/'swing_bottoms.csv',index=False)

    sw1=pd.read_csv(out/'low_swings_1atr.csv')
    scalper=sw1[(sw1.next_rise_atr>=1)&(sw1.next_rise_atr<=3)&(sw1.next48_range_atr<=4)].copy() if len(sw1) else sw1
    scalper.to_csv(out/'scalper_bottoms.csv',index=False)

    by_year={}
    for y,g in cand.groupby('year'):
        by_year[str(y)]={
            'candidates':int(len(g)),
            'good24':int(g.good_24h.sum()),'false24':int(g.false_24h.sum()),
            'good48':int(g.good_48h.sum()),'false48':int(g.false_48h.sum()),
            'good48_rate_resolved':float(g.good_48h.sum()/max(1,g.good_48h.sum()+g.false_48h.sum()))
        }

    resolved48=cand[cand.good_48h|cand.false_48h]
    summary={
        'scope':'GTGLab2 Bottom Atlas v0.1',
        'quality':quality,
        'pristine_forward_oos_read':False,
        'swing_map':swing_summary,
        'bottom_candidates':{
            'n':int(len(cand)),
            'good24':int(cand.good_24h.sum()),'false24':int(cand.false_24h.sum()),
            'good48':int(cand.good_48h.sum()),'false48':int(cand.false_48h.sum()),
            'ambiguous48':int(cand.ambiguous_48h.sum()),
            'resolved48_good_rate':float(cand.good_48h.sum()/max(1,cand.good_48h.sum()+cand.false_48h.sum())),
        },
        'swing_bottoms_2atr_next_rise_ge4atr':int(len(swing_bottoms)),
        'scalper_bottoms_1atr_rise_1to3_range_le4':int(len(scalper)),
        'by_year':by_year,
        'top_feature_differences':feat.head(12).to_dict('records')
    }
    (out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    main()
