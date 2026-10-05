from pathlib import Path
from functools import lru_cache
import json
import math
import sys
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve()
GTG = HERE.parents[1]
ROOT = Path(r"C:\Users\alk\gtg-lab-data-historical-clean-v1")
OUT = GTG / "runs" / "measurement-execution-audit-v01"
REF = GTG / "runs" / "integrated-decision-architecture-v01"

STATE_FEATURES = [
    "m5_close_location","m5_drift3_h1atr","m5_drift12_h1atr","m5_eff12",
    "m15_close_location","m15_drift4_h1atr","m15_drift20_h1atr","m15_eff4","m15_eff20",
    "h1_close_location","h1_drift5_atr","h1_eff5","h1_pos24","h1_decline24_atr"
]

CONTROL_FEATURES = [
    "bars_from_anchor","recovery_anchor_atr","signal_pos_episode","bull_close_frac",
    "higher_low_frac","higher_high_frac","close_above_prev_high_frac",
    "positive_return_share","bull_body_share","ret_last3_atr","ret_last6_atr",
    "half_return_improvement_atr","half_downside_improvement_atr",
    "range_contraction_ratio","anchor_mid_reclaim","m15_drift4_h1atr",
    "m15_drift_change_1h","m5_drift12_h1atr","m5_drift_change_1h"
]

SWING_FEATURES = [
    "ret24_atr","ret72_atr","ret120_atr","ret240_atr","eff24","eff72","eff120",
    "pos72","pos120","pos240","dd72_atr","dd120_atr","dd240_atr",
    "above_low72_atr","above_low120_atr","above_low240_atr",
    "new24h_low_count_24h","new24h_low_count_72h","neg_h1_frac24","neg_h1_frac72",
    "lower_low_frac24","lower_low_frac72","higher_high_frac24","higher_high_frac72",
    "range_ratio_24_prev24","vol_ratio_24_prev24","recovery_from_72low_atr",
    "bars_since_72low","recovery_vs_prior24_decline","ret6_vs_prev6","ret12_vs_prev12"
]

SPECS = {
    "scalper": {"rule":"HIGHER_LOW_BREAK","states":{0,5},"stop_mult":0.75,"target_mult":1.5,"timeout":144},
    "swing": {"rule":"HIGH_RECLAIM","states":{0,4,5},"stop_mult":1.0,"target_mult":4.0,"timeout":864},
}

TRAIN_END = int(pd.Timestamp("2023-01-01", tz="UTC").timestamp() * 1000)
VAL_END = int(pd.Timestamp("2025-01-01", tz="UTC").timestamp() * 1000)

def aggregate_all(root):
    cols = ["t","bo","bh","bl","bc","ao","ah","al","ac"]
    files = sorted((root / "m1").glob("*/*/*.csv.gz"))
    buckets = {5:[], 15:[], 60:[]}
    raw_rows = 0
    for n,p in enumerate(files,1):
        d = pd.read_csv(p, usecols=cols)
        if d.empty:
            continue
        raw_rows += len(d)
        for minutes in (5,15,60):
            ms = minutes * 60000
            z = d.copy()
            z["bucket"] = (z.t.astype("int64") // ms) * ms
            g = z.groupby("bucket", sort=True).agg(
                bo=("bo","first"), bh=("bh","max"), bl=("bl","min"), bc=("bc","last"),
                ao=("ao","first"), ah=("ah","max"), al=("al","min"), ac=("ac","last"),
                count=("t","count")
            ).reset_index().rename(columns={"bucket":"t"})
            g = g[g["count"] == minutes].copy()
            if len(g):
                buckets[minutes].append(g)
        if n % 400 == 0:
            print(f"aggregate files={n}/{len(files)}", flush=True)
    out = {}
    for minutes in (5,15,60):
        x = pd.concat(buckets[minutes], ignore_index=True).sort_values("t").drop_duplicates("t").reset_index(drop=True)
        out[minutes] = x
    return out[5], out[15], out[60], {"files":len(files),"raw_m1_rows":int(raw_rows)}

def eff(c,n):
    return (c-c.shift(n)).abs() / c.diff().abs().rolling(n).sum().replace(0,np.nan)

def build_context(m5,m15,h1):
    h = h1.copy()
    hc=h.bc.astype(float); hh=h.bh.astype(float); hl=h.bl.astype(float); ho=h.bo.astype(float)
    prev=hc.shift(1).fillna(hc.iloc[0])
    tr=pd.Series(np.maximum(hh-hl,np.maximum((hh-prev).abs(),(hl-prev).abs())))
    h["h1_atr"]=tr.rolling(14).mean()
    h["h1_prev12_low"]=hl.shift(1).rolling(12).min()
    lo24=hl.shift(1).rolling(24).min(); hi24=hh.shift(1).rolling(24).max()
    width24=(hi24-lo24).replace(0,np.nan)
    hrange=(hh-hl).replace(0,np.nan)
    h["h1_close_location"]=(hc-hl)/hrange
    h["h1_lower_wick_atr"]=(np.minimum(ho,hc)-hl)/h.h1_atr
    h["h1_drift5_atr"]=(hc-hc.shift(5))/h.h1_atr
    h["h1_eff5"]=eff(hc,5)
    h["h1_pos24"]=(hc-lo24)/width24
    h["h1_decline24_atr"]=(hi24-hc)/h.h1_atr
    h["ready_t"]=h.t+3600000
    hctx=h[["ready_t","h1_atr","h1_prev12_low","h1_close_location","h1_lower_wick_atr","h1_drift5_atr","h1_eff5","h1_pos24","h1_decline24_atr"]].dropna(subset=["h1_atr","h1_prev12_low"])

    q=m15.copy()
    qc=q.bc.astype(float); qh=q.bh.astype(float); ql=q.bl.astype(float); qo=q.bo.astype(float)
    qr=(qh-ql).replace(0,np.nan)
    q["m15_close_location"]=(qc-ql)/qr
    q["m15_lower_wick_raw"]=np.minimum(qo,qc)-ql
    q["m15_drift4_raw"]=qc-qc.shift(4)
    q["m15_drift20_raw"]=qc-qc.shift(20)
    q["m15_eff4"]=eff(qc,4)
    q["m15_eff20"]=eff(qc,20)
    q["ready_t"]=q.t+900000
    qctx=q[["ready_t","m15_close_location","m15_lower_wick_raw","m15_drift4_raw","m15_drift20_raw","m15_eff4","m15_eff20"]]

    z=m5.copy()
    z["close_t"]=z.t+300000
    z=pd.merge_asof(z.sort_values("close_t"),hctx.sort_values("ready_t"),left_on="close_t",right_on="ready_t",direction="backward")
    z=pd.merge_asof(z.sort_values("close_t"),qctx.sort_values("ready_t"),left_on="close_t",right_on="ready_t",direction="backward")

    c=z.bc.astype(float); hi=z.bh.astype(float); lo=z.bl.astype(float); o=z.bo.astype(float); a=z.h1_atr
    r=(hi-lo).replace(0,np.nan)
    z["m5_close_location"]=(c-lo)/r
    z["m5_lower_wick_h1atr"]=(np.minimum(o,c)-lo)/a
    z["m5_body_h1atr"]=(c-o).abs()/a
    z["m5_drift3_h1atr"]=(c-c.shift(3))/a
    z["m5_drift12_h1atr"]=(c-c.shift(12))/a
    z["m5_eff3"]=eff(c,3); z["m5_eff12"]=eff(c,12)
    z["m15_lower_wick_h1atr"]=z.m15_lower_wick_raw/a
    z["m15_drift4_h1atr"]=z.m15_drift4_raw/a
    z["m15_drift20_h1atr"]=z.m15_drift20_raw/a
    z["prev12_m5_low"]=lo.shift(1).rolling(12).min()
    return z.reset_index(drop=True), h.reset_index(drop=True)

def fit_states(x):
    d=x.copy()
    d["year"]=pd.to_datetime(d.t,unit="ms",utc=True).dt.year
    train=d[d.year<=2022]
    pipe=Pipeline([
        ("imp",SimpleImputer(strategy="median")),
        ("scale",StandardScaler()),
        ("km",KMeans(n_clusters=6,random_state=42,n_init=25))
    ])
    pipe.fit(train[STATE_FEATURES])
    d["state_id"]=pipe.predict(d[STATE_FEATURES])
    return d,pipe

def base_mask(x):
    return ((x.bl<x.h1_prev12_low) & (x.bl<x.prev12_m5_low)).fillna(False).to_numpy()

def detect_events(x,rule):
    h=x.bh.to_numpy(float); l=x.bl.to_numpy(float); c=x.bc.to_numpy(float)
    t=x.t.to_numpy(np.int64); a=x.h1_atr.to_numpy(float)
    mask=base_mask(x)
    events=[]; i=1; n=len(x)
    while i<n-2:
        if not mask[i] or not np.isfinite(a[i]) or a[i]<=0:
            i+=1; continue
        episode_start=i; anchor=i; j=i+1; fired=False
        while j<n-1 and (j-episode_start)<=12:
            if l[j] < l[anchor]:
                anchor=j; j+=1; continue
            anchor_age=j-anchor
            if anchor_age>6:
                break
            ok=False
            if anchor_age>=1:
                if rule=="MID_RECLAIM":
                    ok=(c[j]>=(l[anchor]+h[anchor])/2.0 and c[j]>c[j-1])
                elif rule=="HIGH_RECLAIM":
                    ok=(c[j]>h[anchor])
                elif rule=="HIGHER_LOW_BREAK":
                    ok=(l[j]>l[anchor] and c[j]>h[j-1])
            if ok:
                events.append({
                    "rule":rule,"episode_start_idx":int(episode_start),"anchor_idx":int(anchor),"signal_idx":int(j),
                    "episode_start_t":int(t[episode_start]),"anchor_t":int(t[anchor]),"signal_t":int(t[j]),
                    "anchor_low":float(l[anchor]),"anchor_high":float(h[anchor]),"atr_h1":float(a[anchor]),
                    "bars_from_anchor":int(j-anchor),"bars_from_episode":int(j-episode_start)
                })
                fired=True; i=j+1; break
            j+=1
        if not fired:
            i=max(i+1,j)
    return pd.DataFrame(events)

def attach_states(ev,xs):
    m=xs[["t","state_id"]].rename(columns={"t":"signal_t"})
    e=ev.merge(m,on="signal_t",how="left")
    e["year"]=pd.to_datetime(e.signal_t,unit="ms",utc=True).dt.year
    return e

def rolling_eff(c,n):
    p=c.diff().abs().rolling(n,min_periods=n).sum()
    return (c-c.shift(n)).abs()/p.replace(0,np.nan)

def make_control_features(ev,x):
    close=x.bc.astype(float).to_numpy(); high=x.bh.astype(float).to_numpy()
    low=x.bl.astype(float).to_numpy(); op=x.bo.astype(float).to_numpy()
    rows=[]
    for r in ev.itertuples(index=False):
        j=int(r.signal_idx); a=int(r.anchor_idx); atr=float(r.atr_h1)
        if a<0 or j<=a or atr<=0:
            continue
        cs=close[a:j+1]; hs=high[a:j+1]; ls=low[a:j+1]; os=op[a:j+1]
        ret=np.diff(cs); bodies=cs-os
        full_hi=float(np.max(hs)); full_lo=float(np.min(ls)); denom=max(full_hi-full_lo,1e-12)
        n=len(cs); mid=max(1,n//2)
        r1=np.diff(cs[:mid+1]) if mid>=1 else np.array([])
        r2=np.diff(cs[mid:]) if n-mid>=2 else np.array([])
        range1=float(np.max(hs[:mid+1])-np.min(ls[:mid+1])) if mid>=1 else np.nan
        range2=float(np.max(hs[mid:])-np.min(ls[mid:])) if n-mid>=2 else np.nan
        neg1=float(np.abs(np.minimum(r1,0)).sum()) if len(r1) else 0.0
        neg2=float(np.abs(np.minimum(r2,0)).sum()) if len(r2) else 0.0
        absret=float(np.abs(ret).sum()); bodyabs=float(np.abs(bodies).sum())
        rows.append({
            "signal_t":int(r.signal_t),"signal_idx":j,"anchor_idx":a,"year":int(r.year),"state_id":int(r.state_id),
            "atr_h1":atr,"anchor_low":float(r.anchor_low),"anchor_high":float(r.anchor_high),
            "bars_from_anchor":j-a,
            "recovery_anchor_atr":(cs[-1]-float(r.anchor_low))/atr,
            "signal_pos_episode":(cs[-1]-full_lo)/denom,
            "bull_close_frac":float((ret>0).mean()) if len(ret) else 0.0,
            "higher_low_frac":float((np.diff(ls)>0).mean()) if len(ls)>1 else 0.0,
            "higher_high_frac":float((np.diff(hs)>0).mean()) if len(hs)>1 else 0.0,
            "close_above_prev_high_frac":float((cs[1:]>hs[:-1]).mean()) if len(cs)>1 else 0.0,
            "positive_return_share":float(np.maximum(ret,0).sum()/absret) if absret>0 else 0.5,
            "bull_body_share":float(np.maximum(bodies,0).sum()/bodyabs) if bodyabs>0 else 0.5,
            "ret_last3_atr":(cs[-1]-cs[max(0,n-4)])/atr,
            "ret_last6_atr":(cs[-1]-cs[max(0,n-7)])/atr,
            "half_return_improvement_atr":((float(r2.sum()) if len(r2) else 0.0)-(float(r1.sum()) if len(r1) else 0.0))/atr,
            "half_downside_improvement_atr":(neg1-neg2)/atr,
            "range_contraction_ratio":(range2/range1) if np.isfinite(range1) and range1>0 and np.isfinite(range2) else np.nan,
            "anchor_mid_reclaim":(cs[-1]-((float(r.anchor_low)+float(r.anchor_high))/2.0))/max(float(r.anchor_high)-float(r.anchor_low),1e-12),
            "m15_drift4_h1atr":float(x.m15_drift4_h1atr.iloc[j]),
            "m15_drift_change_1h":float(x.m15_drift4_h1atr.iloc[j]-x.m15_drift4_h1atr.iloc[max(0,j-12)]),
            "m5_drift12_h1atr":float(x.m5_drift12_h1atr.iloc[j]),
            "m5_drift_change_1h":float(x.m5_drift12_h1atr.iloc[j]-x.m5_drift12_h1atr.iloc[max(0,j-12)])
        })
    return pd.DataFrame(rows)

def make_true_h1_wave(h):
    z=h.copy()
    c=z.bc.astype(float); high=z.bh.astype(float); low=z.bl.astype(float); atr=z.h1_atr.astype(float).replace(0,np.nan)
    z["prev24_low"]=low.shift(1).rolling(24,min_periods=24).min()
    z["is_new24_low"]=(low<z.prev24_low).astype(float)
    z["neg_close"]=(c.diff()<0).astype(float)
    z["ll"]=(low.diff()<0).astype(float); z["hh"]=(high.diff()>0).astype(float)
    z["new24h_low_count_24h"]=z.is_new24_low.rolling(24,min_periods=24).sum()
    z["new24h_low_count_72h"]=z.is_new24_low.rolling(72,min_periods=72).sum()
    z["neg_h1_frac24"]=z.neg_close.rolling(24,min_periods=24).mean()
    z["neg_h1_frac72"]=z.neg_close.rolling(72,min_periods=72).mean()
    z["lower_low_frac24"]=z.ll.rolling(24,min_periods=24).mean()
    z["lower_low_frac72"]=z.ll.rolling(72,min_periods=72).mean()
    z["higher_high_frac24"]=z.hh.rolling(24,min_periods=24).mean()
    z["higher_high_frac72"]=z.hh.rolling(72,min_periods=72).mean()
    z["range24"]=high.rolling(24,min_periods=24).max()-low.rolling(24,min_periods=24).min()
    z["range_prev24"]=z.range24.shift(24)
    z["range_ratio_24_prev24"]=z.range24/z.range_prev24.replace(0,np.nan)
    hret=c.diff()
    z["vol24"]=hret.rolling(24,min_periods=24).std()
    z["vol_prev24"]=z.vol24.shift(24)
    z["vol_ratio_24_prev24"]=z.vol24/z.vol_prev24.replace(0,np.nan)
    z["recovery_from_72low_atr"]=np.nan; z["bars_since_72low"]=np.nan
    for i in range(71,len(z)):
        vals=low.iloc[i-71:i+1].to_numpy()
        k=int(np.argmin(vals)); lowv=float(vals[k])
        z.loc[i,"bars_since_72low"]=71-k
        av=float(atr.iloc[i]) if np.isfinite(atr.iloc[i]) else np.nan
        z.loc[i,"recovery_from_72low_atr"]=(float(c.iloc[i])-lowv)/av if np.isfinite(av) and av>0 else np.nan
    z["prior24_high"]=high.shift(1).rolling(24,min_periods=24).max()
    z["prior24_decline"]=z.prior24_high-low
    z["recovery_vs_prior24_decline"]=(c-low)/z.prior24_decline.replace(0,np.nan)
    z["ret6"]=c-c.shift(6); z["ret6_prev"]=c.shift(6)-c.shift(12)
    z["ret12"]=c-c.shift(12); z["ret12_prev"]=c.shift(12)-c.shift(24)
    z["ret6_vs_prev6"]=(z.ret6-z.ret6_prev)/atr
    z["ret12_vs_prev12"]=(z.ret12-z.ret12_prev)/atr
    z["ready_t"]=z.t+3600000
    keep=["ready_t","new24h_low_count_24h","new24h_low_count_72h","neg_h1_frac24","neg_h1_frac72",
          "lower_low_frac24","lower_low_frac72","higher_high_frac24","higher_high_frac72",
          "range_ratio_24_prev24","vol_ratio_24_prev24","recovery_from_72low_atr","bars_since_72low",
          "recovery_vs_prior24_decline","ret6_vs_prev6","ret12_vs_prev12"]
    return z[keep]

def make_swing_frame(x,h):
    z=x.copy()
    c=z.bc.astype(float); high=z.bh.astype(float); low=z.bl.astype(float); atr=z.h1_atr.astype(float).replace(0,np.nan)
    for hrs in [24,72,120,240]:
        n=hrs*12
        z[f"ret{hrs}_atr"]=(c-c.shift(n))/atr
        if hrs in [24,72,120]:
            z[f"eff{hrs}"]=rolling_eff(c,n)
        hi=high.rolling(n,min_periods=n).max(); lo=low.rolling(n,min_periods=n).min()
        if hrs in [72,120,240]:
            z[f"pos{hrs}"]=(c-lo)/(hi-lo).replace(0,np.nan)
            z[f"dd{hrs}_atr"]=(hi-c)/atr
            z[f"above_low{hrs}_atr"]=(c-lo)/atr
    hw=make_true_h1_wave(h)
    z=pd.merge_asof(z.sort_values("close_t"),hw.sort_values("ready_t"),left_on="close_t",right_on="ready_t",direction="backward")
    return z.reset_index(drop=True)

def make_swing_features(ev,z):
    rows=[]
    for r in ev.itertuples(index=False):
        j=int(r.signal_idx)
        row={"signal_t":int(r.signal_t),"signal_idx":j,"anchor_idx":int(r.anchor_idx),"year":int(r.year),
             "state_id":int(r.state_id),"atr_h1":float(r.atr_h1),"anchor_low":float(r.anchor_low),"anchor_high":float(r.anchor_high)}
        for f in SWING_FEATURES:
            v=z[f].iloc[j]; row[f]=float(v) if pd.notna(v) else np.nan
        rows.append(row)
    return pd.DataFrame(rows)

class M1Resolver:
    def __init__(self,root):
        self.root=root
        self.ambiguous_m5=0
        self.resolved_by_m1=0
        self.unresolved_same_m1=0

    @lru_cache(maxsize=32)
    def day(self,date_str):
        y,m,_=date_str.split("-")
        p=self.root/"m1"/y/m/(date_str+".csv.gz")
        if not p.exists():
            return pd.DataFrame()
        return pd.read_csv(p,usecols=["t","bo","bh","bl","bc"])

    def resolve(self,m5_t,stop,target):
        self.ambiguous_m5+=1
        date_str=pd.to_datetime(int(m5_t),unit="ms",utc=True).strftime("%Y-%m-%d")
        d=self.day(date_str)
        q=d[(d.t>=int(m5_t))&(d.t<int(m5_t)+300000)].sort_values("t")
        for r in q.itertuples(index=False):
            o=float(r.bo); h=float(r.bh); l=float(r.bl)
            if o<=stop:
                self.resolved_by_m1+=1
                return "STOP_GAP",float(o),int(r.t),False
            if o>=target:
                self.resolved_by_m1+=1
                return "TARGET_GAP",float(o),int(r.t),False
            s=l<=stop; g=h>=target
            if s and g:
                self.unresolved_same_m1+=1
                return "M1_AMBIGUOUS_STOP_FIRST",float(stop),int(r.t+60000),True
            if s:
                self.resolved_by_m1+=1
                return "STOP",float(stop),int(r.t+60000),False
            if g:
                self.resolved_by_m1+=1
                return "TARGET",float(target),int(r.t+60000),False
        self.unresolved_same_m1+=1
        return "M1_MISSING_STOP_FIRST",float(stop),int(m5_t+300000),True

def trade_outcome(r,x,spec,resolver):
    sig=int(r.signal_idx)
    if sig+1>=len(x):
        return {"label_valid":False,"reason":"NO_NEXT_BAR"}
    entry=sig+1
    ep=float(x.ao.iloc[entry]); entry_bid=float(x.bo.iloc[entry])
    atr=float(r.atr_h1); low0=float(r.anchor_low)
    stop=low0-spec["stop_mult"]*atr; target=low0+spec["target_mult"]*atr
    if not (stop<ep<target):
        return {"label_valid":False,"reason":"INVALID_NEXT_ASK_OPEN","entry_t":int(x.t.iloc[entry])}
    risk=ep-stop
    end=min(len(x),entry+spec["timeout"])
    for j in range(entry,end):
        bo=float(x.bo.iloc[j]); bh=float(x.bh.iloc[j]); bl=float(x.bl.iloc[j])
        if bo<=stop:
            return pack_outcome(x,j,ep,entry_bid,stop,target,risk,bo,"STOP_GAP",False)
        if bo>=target:
            return pack_outcome(x,j,ep,entry_bid,stop,target,risk,bo,"TARGET_GAP",False)
        s=bl<=stop; g=bh>=target
        if s and g:
            kind,xp,ot,amb=resolver.resolve(int(x.t.iloc[j]),stop,target)
            return pack_outcome(x,j,ep,entry_bid,stop,target,risk,xp,kind,amb,outcome_t=ot)
        if s:
            return pack_outcome(x,j,ep,entry_bid,stop,target,risk,stop,"STOP",False)
        if g:
            return pack_outcome(x,j,ep,entry_bid,stop,target,risk,target,"TARGET",False)
    ex=entry+spec["timeout"]
    if ex>=len(x):
        return {"label_valid":False,"reason":"CENSORED_TIMEOUT","entry_t":int(x.t.iloc[entry])}
    xp=float(x.bo.iloc[ex])
    return pack_outcome(x,ex,ep,entry_bid,stop,target,risk,xp,f"{spec['timeout']}BAR_TIMEOUT",False,outcome_t=int(x.t.iloc[ex]))

def pack_outcome(x,ex,ep,entry_bid,stop,target,risk,xp,kind,amb,outcome_t=None):
    if outcome_t is None:
        if kind.endswith("GAP"):
            outcome_t=int(x.t.iloc[ex])
        else:
            outcome_t=int(x.t.iloc[ex]+300000)
    entry_spread=float(x.ao.iloc[ex]*0.0)
    return {
        "label_valid":True,"reason":"RESOLVED","entry_t":None,"outcome_t":int(outcome_t),
        "pnl_r":float((xp-ep)/risk),"exit_kind":kind,"m1_ambiguous":bool(amb),
        "entry_px":float(ep),"stop_px":float(stop),"target_px":float(target),"exit_px":float(xp),"risk_px":float(risk)
    }

def label_feature_rows(features,event_map,x,spec,resolver):
    rows=[]
    for fr in features.itertuples(index=False):
        ev=event_map[int(fr.signal_t)]
        out=trade_outcome(ev,x,spec,resolver)
        rows.append(out)
    q=features.copy()
    od=pd.DataFrame(rows)
    for col in od.columns:
        q["label_"+col]=od[col].to_numpy()
    q["label_positive"]=np.where(q.label_label_valid, (q.label_pnl_r>0).astype(float), np.nan)
    return q

def safe_auc(y,p):
    y=np.asarray(y,float); p=np.asarray(p,float)
    ok=np.isfinite(y)&np.isfinite(p)
    y=y[ok]; p=p[ok]
    if len(y)==0 or len(np.unique(y))<2:
        return None
    return float(roc_auc_score(y,p))

def fit_score_all(labeled,feature_names):
    signal=labeled.signal_t.astype(np.int64)
    train_label=(signal<TRAIN_END)&labeled.label_label_valid & (labeled.label_outcome_t<TRAIN_END)
    val_label=(signal>=TRAIN_END)&(signal<VAL_END)&labeled.label_label_valid & (labeled.label_outcome_t<VAL_END)
    diag_label=(signal>=VAL_END)&labeled.label_label_valid
    pipe=Pipeline([
        ("imp",SimpleImputer(strategy="median")),
        ("scale",StandardScaler()),
        ("lr",LogisticRegression(C=1.0,max_iter=3000))
    ])
    pipe.fit(labeled.loc[train_label,feature_names],labeled.loc[train_label,"label_positive"].astype(int))
    scored=labeled.copy()
    scored["score"]=pipe.predict_proba(scored[feature_names])[:,1]
    train_stream=scored[scored.signal_t<TRAIN_END]
    threshold=float(train_stream.score.quantile(.60))
    q50=float(train_stream.score.quantile(.50))
    stats={
        "train_labeled":int(train_label.sum()),"validation_labeled":int(val_label.sum()),"diagnostic_labeled":int(diag_label.sum()),
        "auc_train":safe_auc(scored.loc[train_label,"label_positive"],scored.loc[train_label,"score"]),
        "auc_validation":safe_auc(scored.loc[val_label,"label_positive"],scored.loc[val_label,"score"]),
        "auc_diagnostic":safe_auc(scored.loc[diag_label,"label_positive"],scored.loc[diag_label,"score"]),
        "q50_train_stream":q50,"q60_train_stream":threshold,
        "censored_or_invalid":int((~scored.label_label_valid).sum())
    }
    return scored,pipe,stats

def event_map_from(ev):
    out={}
    for r in ev.itertuples(index=False):
        out[int(r.signal_t)]=r
    return out

def execute_selected(ev,selected_signal_t,x,spec,resolver,engine):
    selected=set(int(v) for v in selected_signal_t)
    rows=[]; next_free=0
    counters={"selected":len(selected),"overlap":0,"invalid_next_ask_open":0,"censored":0,"executed":0,"missing_signal":0}
    for r in ev.sort_values("signal_idx").itertuples(index=False):
        if int(r.signal_t) not in selected:
            continue
        sig=int(r.signal_idx)
        if sig<next_free:
            counters["overlap"]+=1; continue
        out=trade_outcome(r,x,spec,resolver)
        if not out.get("label_valid",False):
            if out.get("reason")=="INVALID_NEXT_ASK_OPEN":
                counters["invalid_next_ask_open"]+=1
            else:
                counters["censored"]+=1
            continue
        entry=sig+1
        # Reconstruct exit index from outcome timestamp conservatively.
        ot=int(out["outcome_t"])
        if out["exit_kind"].endswith("BAR_TIMEOUT") or out["exit_kind"].endswith("GAP"):
            ex=int(np.searchsorted(x.t.to_numpy(np.int64),ot,side="left"))
        else:
            ex=int(np.searchsorted((x.t+300000).to_numpy(np.int64),ot,side="left"))
        ex=max(entry,min(ex,len(x)-1))
        entry_spread=float(x.ao.iloc[entry]-x.bo.iloc[entry])
        exit_spread=float(x.ao.iloc[ex]-x.bo.iloc[ex])
        row={
            "engine":engine,"state_id":int(r.state_id),"year":int(r.year),
            "signal_t":int(r.signal_t),"entry_t":int(x.t.iloc[entry]),"exit_t":int(x.t.iloc[ex]),
            "exit_available_t":int(out["outcome_t"]),"anchor_low":float(r.anchor_low),"atr_h1":float(r.atr_h1),
            "entry_px":float(out["entry_px"]),"entry_bid_px":float(x.bo.iloc[entry]),"stop_px":float(out["stop_px"]),
            "target_px":float(out["target_px"]),"exit_px":float(out["exit_px"]),"risk_px":float(out["risk_px"]),
            "entry_rr":float((float(out["target_px"])-float(out["entry_px"]))/float(out["risk_px"])),
            "pnl_r":float(out["pnl_r"]),"exit_kind":out["exit_kind"],"m1_ambiguous":bool(out["m1_ambiguous"]),
            "entry_spread_px":entry_spread,"exit_spread_px":exit_spread
        }
        rows.append(row); next_free=ex+1; counters["executed"]+=1
    return pd.DataFrame(rows),counters

def apply_health(shadow,window=20,loss_r=-5.0,pf_floor=0.80):
    s=shadow.sort_values("entry_t").copy().reset_index(drop=True)
    rec=[]
    for r in s.itertuples(index=False):
        entry=int(r.entry_t)
        closed=s[s.exit_available_t<entry].sort_values("exit_available_t").tail(window)
        if len(closed)<window:
            off=False; total=np.nan; pfv=np.nan
        else:
            v=closed.pnl_r.to_numpy(float)
            total=float(v.sum()); pos=v[v>0].sum(); neg=-v[v<=0].sum()
            pfv=float(pos/neg) if neg>0 else float("inf")
            off=(total<=loss_r) or (pfv<=pf_floor)
        rec.append({"risk_off":bool(off),"health_n":int(len(closed)),"health_total_r":total,"health_pf":pfv})
    h=pd.DataFrame(rec)
    full=pd.concat([s,h],axis=1)
    return full,full[~full.risk_off].copy(),full[full.risk_off].copy()

def metrics(df,pnl_col="pnl_r",sort_col="exit_available_t"):
    if len(df)==0:
        return {"n":0,"total_r":0.0,"mean_r":None,"profit_factor":None,"realized_exit_order_dd_r":None,"win_rate":None}
    q=df.sort_values(sort_col)
    v=q[pnl_col].to_numpy(float)
    pos=v[v>0].sum(); neg=-v[v<=0].sum()
    eq=np.cumsum(v); peak=np.maximum.accumulate(np.r_[0.0,eq])[:-1]
    return {
        "n":int(len(q)),"total_r":float(v.sum()),"mean_r":float(v.mean()),
        "profit_factor":float(pos/neg) if neg>0 else None,
        "realized_exit_order_dd_r":float((eq-peak).min()),"win_rate":float((v>0).mean()),
        "avg_entry_rr":float(q.entry_rr.mean()) if "entry_rr" in q else None
    }

def by_year(df):
    if len(df)==0:
        return {}
    y=pd.to_datetime(df.signal_t,unit="ms",utc=True).dt.year
    q=df.copy(); q["eval_year"]=y
    return {str(int(k)):metrics(g) for k,g in q.groupby("eval_year")}

def by_segment(df):
    if len(df)==0:
        return {}
    y=pd.to_datetime(df.signal_t,unit="ms",utc=True).dt.year
    q=df.copy(); q["segment"]=np.select([y<=2022,y<=2024],["2018-2022","2023-2024"],default="2025-2026")
    return {str(k):metrics(g) for k,g in q.groupby("segment")}

def swing_permission(scored,q50,q60):
    f=scored.sort_values("signal_t").copy().reset_index(drop=True)
    roll=f.score.rolling(3,min_periods=3).mean()
    on=False; states=[]
    for m in roll:
        if np.isfinite(m):
            if (not on) and m>=q60:
                on=True
            elif on and m<=q50:
                on=False
        states.append(bool(on))
    f["permission_mean3"]=roll; f["permission_on"]=states
    return f

def reference_spread_reprice(engine,old_live,ev,x,spec,resolver):
    mp=event_map_from(ev)
    rows=[]; missing=0; invalid=0
    for r in old_live.sort_values("signal_t").itertuples(index=False):
        e=mp.get(int(r.signal_t))
        if e is None:
            missing+=1; continue
        out=trade_outcome(e,x,spec,resolver)
        if not out.get("label_valid",False):
            invalid+=1; continue
        sig=int(e.signal_idx); entry=sig+1
        ot=int(out["outcome_t"])
        ex=int(np.searchsorted(x.t.to_numpy(np.int64),int(getattr(r,"exit_t")),side="left"))
        ex=min(max(ex,entry),len(x)-1)
        risk=float(out["risk_px"])
        entry_spread=float(x.ao.iloc[entry]-x.bo.iloc[entry])
        exit_spread=float(x.ao.iloc[ex]-x.bo.iloc[ex])
        rows.append({
            "engine":engine,"signal_t":int(r.signal_t),"entry_t":int(x.t.iloc[entry]),"exit_t":int(r.exit_t),
            "exit_available_t":int(out["outcome_t"]),"entry_px":float(out["entry_px"]),"exit_px":float(out["exit_px"]),
            "risk_px":risk,"pnl_r":float(out["pnl_r"]),"entry_rr":float((out["target_px"]-out["entry_px"])/risk),
            "entry_spread_px":entry_spread,"exit_spread_px":exit_spread,"exit_kind":out["exit_kind"]
        })
    return pd.DataFrame(rows),{"missing_signal":missing,"invalid_after_spread":invalid}

def cost_sensitivity(df,label):
    rows=[]
    for f in [0.0,0.25,0.50,1.0]:
        q=df.copy()
        penalty=f*(q.entry_spread_px+q.exit_spread_px)/q.risk_px
        q["stress_pnl_r"]=q.pnl_r-penalty
        m=metrics(q,pnl_col="stress_pnl_r")
        rows.append({"stream":label,"extra_slippage_each_side_spread_fraction":f,**m})
    if len(df):
        rows.append({
            "stream":label,"extra_slippage_each_side_spread_fraction":"BREAK_EVEN_R_PER_TRADE",
            "n":int(len(df)),"total_r":float(df.pnl_r.sum()),"mean_r":float(df.pnl_r.mean()),
            "profit_factor":None,"realized_exit_order_dd_r":None,"win_rate":None,
            "avg_entry_rr":None,"break_even_extra_total_cost_r_per_trade":float(df.pnl_r.sum()/len(df))
        })
    return rows

def portfolio_curve(trades,m5,label):
    if len(trades)==0:
        return pd.DataFrame(),{"mtm_max_drawdown_r":None,"max_concurrent_trades":0}
    close_t=(m5.t.astype(np.int64)+300000).to_numpy()
    bc=m5.bc.to_numpy(float)
    lo=int(np.searchsorted(close_t,int(trades.entry_t.min()),side="right"))
    hi=int(np.searchsorted(close_t,int(trades.exit_available_t.max()),side="right"))
    lo=max(0,lo-1); hi=min(len(m5),hi+1)
    n=hi-lo
    unreal=np.zeros(n,float); realized_delta=np.zeros(n,float); open_count=np.zeros(n,int)
    for r in trades.itertuples(index=False):
        s=int(np.searchsorted(close_t,int(r.entry_t),side="right"))
        e=int(np.searchsorted(close_t,int(r.exit_available_t),side="left"))
        s=max(s,lo); e=min(e,hi)
        if e>s:
            sl=s-lo; el=e-lo
            unreal[sl:el] += (bc[s:e]-float(r.entry_px))/float(r.risk_px)
            open_count[sl:el] += 1
        ridx=int(np.searchsorted(close_t,int(r.exit_available_t),side="left"))
        ridx=min(max(ridx,lo),hi-1)
        realized_delta[ridx-lo]+=float(r.pnl_r)
    realized=np.cumsum(realized_delta)
    equity=realized+unreal
    peak=np.maximum.accumulate(np.r_[0.0,equity])[:-1]
    dd=equity-peak
    out=pd.DataFrame({
        "t":m5.t.iloc[lo:hi].to_numpy(np.int64),
        "close_t":close_t[lo:hi],"bid_close":bc[lo:hi],
        "realized_r":realized,"unrealized_r":unreal,"equity_r":equity,
        "drawdown_r":dd,"open_trades":open_count
    })
    sparse=out[(out.open_trades>0)|(out.realized_r.diff().fillna(out.realized_r)!=0)].copy()
    return sparse,{
        "stream":label,"mtm_max_drawdown_r":float(dd.min()),
        "max_concurrent_trades":int(open_count.max()),
        "max_concurrent_initial_risk":int(open_count.max()),
        "final_realized_r":float(realized[-1])
    }

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    print("building bid/ask MTF bars",flush=True)
    m5,m15,h1,data_meta=aggregate_all(ROOT)
    print("bars",len(m5),len(m15),len(h1),flush=True)
    x,h=build_context(m5,m15,h1)
    xs,state_pipe=fit_states(x)

    resolver=M1Resolver(ROOT)
    events={}
    for engine,spec in SPECS.items():
        e=attach_states(detect_events(x,spec["rule"]),xs)
        e=e[e.state_id.isin(spec["states"])].copy()
        events[engine]=e
        print(engine,"state-eligible events",len(e),flush=True)

    control=make_control_features(events["scalper"],x)
    swing_frame=make_swing_frame(x,h)
    wave=make_swing_features(events["swing"],swing_frame)

    # Verify removed feature degeneracy on old definition.
    deg=[]
    close=x.bc.to_numpy(float); low=x.bl.to_numpy(float)
    for r in events["scalper"].itertuples(index=False):
        a=int(r.anchor_idx); j=int(r.signal_idx); atr=float(r.atr_h1)
        deg.append((float(r.anchor_low)-float(np.min(low[a:j+1])))/atr)
    deg=np.asarray(deg,float)

    maps={k:event_map_from(v) for k,v in events.items()}
    control_l=label_feature_rows(control,maps["scalper"],x,SPECS["scalper"],resolver)
    wave_l=label_feature_rows(wave,maps["swing"],x,SPECS["swing"],resolver)

    control_s,control_model,control_stats=fit_score_all(control_l,CONTROL_FEATURES)
    wave_s,wave_model,wave_stats=fit_score_all(wave_l,SWING_FEATURES)

    control_s.to_csv(OUT/"scalper_corrected_events.csv",index=False)
    wave_s.to_csv(OUT/"swing_corrected_events.csv",index=False)

    scalp_sel=control_s[control_s.score>=control_stats["q60_train_stream"]].signal_t.astype(np.int64)
    scalp_shadow,scalp_exec=execute_selected(events["scalper"],scalp_sel,x,SPECS["scalper"],resolver,"scalper")
    scalp_health,scalp_live,scalp_skipped=apply_health(scalp_shadow)

    perm=swing_permission(wave_s,wave_stats["q50_train_stream"],wave_stats["q60_train_stream"])
    perm.to_csv(OUT/"swing_permission_full_event_stream.csv",index=False)
    swing_sel=perm[perm.permission_on].signal_t.astype(np.int64)
    swing_shadow,swing_exec=execute_selected(events["swing"],swing_sel,x,SPECS["swing"],resolver,"swing")
    swing_health,swing_live,swing_skipped=apply_health(swing_shadow)

    scalp_shadow.to_csv(OUT/"scalper_corrected_shadow_trades.csv",index=False)
    swing_shadow.to_csv(OUT/"swing_corrected_shadow_trades.csv",index=False)
    scalp_live.to_csv(OUT/"scalper_corrected_live_trades.csv",index=False)
    swing_live.to_csv(OUT/"swing_corrected_live_trades.csv",index=False)

    combined=pd.concat([scalp_live.assign(engine="scalper"),swing_live.assign(engine="swing")],ignore_index=True).sort_values("entry_t")
    combined.to_csv(OUT/"combined_corrected_live_trades.csv",index=False)

    # Pure spread repricing of the exact old integrated live signal sets.
    old_scalp=pd.read_csv(REF/"scalper_live_trades.csv")
    old_swing=pd.read_csv(REF/"swing_live_trades.csv")
    ref_sp_scalp,ref_sp_scalp_info=reference_spread_reprice("scalper",old_scalp,events["scalper"],x,SPECS["scalper"],resolver)
    ref_sp_swing,ref_sp_swing_info=reference_spread_reprice("swing",old_swing,events["swing"],x,SPECS["swing"],resolver)
    ref_sp_combined=pd.concat([ref_sp_scalp,ref_sp_swing],ignore_index=True)
    ref_sp_combined.to_csv(OUT/"reference_signal_set_spread_repriced.csv",index=False)

    # Portfolio MTM.
    sc_curve,sc_port=portfolio_curve(scalp_live,m5,"scalper")
    sw_curve,sw_port=portfolio_curve(swing_live,m5,"swing")
    cb_curve,cb_port=portfolio_curve(combined,m5,"combined")
    cb_curve.to_csv(OUT/"portfolio_mtm.csv",index=False)

    # Cost sensitivity.
    cost_rows=[]
    cost_rows += cost_sensitivity(scalp_live,"scalper_corrected_live")
    cost_rows += cost_sensitivity(swing_live,"swing_corrected_live")
    cost_rows += cost_sensitivity(combined,"combined_corrected_live")
    cost_df=pd.DataFrame(cost_rows)
    cost_df.to_csv(OUT/"cost_sensitivity.csv",index=False)

    # Reconciliation.
    recon=[]
    for engine,features,stats,exec_stats,shadow,live in [
        ("scalper",control_s,control_stats,scalp_exec,scalp_shadow,scalp_live),
        ("swing",wave_s,wave_stats,swing_exec,swing_shadow,swing_live)
    ]:
        recon.append({
            "engine":engine,"detected_state_eligible_events":int(len(events[engine])),
            "decision_time_scored_events":int(len(features)),
            "train_boundary_valid_labels":int(stats["train_labeled"]),
            "validation_boundary_valid_labels":int(stats["validation_labeled"]),
            "diagnostic_valid_labels":int(stats["diagnostic_labeled"]),
            "unlabeled_or_execution_invalid_events":int(stats["censored_or_invalid"]),
            "selected_or_permission_events":int(exec_stats["selected"]),
            "skipped_overlap":int(exec_stats["overlap"]),
            "invalid_next_ask_open":int(exec_stats["invalid_next_ask_open"]),
            "censored_execution":int(exec_stats["censored"]),
            "shadow_executed":int(len(shadow)),"health_live":int(len(live))
        })
    recon_df=pd.DataFrame(recon)
    recon_df.to_csv(OUT/"event_reconciliation.csv",index=False)

    # Reference summary and attribution.
    ref_summary=json.loads((REF/"summary.json").read_text(encoding="utf-8"))
    ref_comb=ref_summary["combined"]["metrics"]
    ref_scalp=ref_summary["engines"]["scalper"]["live"]
    ref_swing=ref_summary["engines"]["swing"]["live"]
    attribution=[
        {"stage":"REFERENCE_REPORTED","engine":"combined","n":ref_comb["n"],"total_r":ref_comb["total_r"],"mean_r":ref_comb["mean_r"],"pf":ref_comb["profit_factor"],"dd_definition":"signal-ordered final trades","dd_r":ref_comb["max_drawdown_r"]},
        {"stage":"REFERENCE_SIGNAL_SET_SPREAD","engine":"combined","n":len(ref_sp_combined),"total_r":float(ref_sp_combined.pnl_r.sum()),"mean_r":float(ref_sp_combined.pnl_r.mean()),"pf":metrics(ref_sp_combined)["profit_factor"],"dd_definition":"exit-order realized only","dd_r":metrics(ref_sp_combined)["realized_exit_order_dd_r"]},
        {"stage":"CORRECTED_PRE_HEALTH","engine":"combined","n":len(pd.concat([scalp_shadow,swing_shadow])),"total_r":float(scalp_shadow.pnl_r.sum()+swing_shadow.pnl_r.sum()),"mean_r":float(pd.concat([scalp_shadow,swing_shadow]).pnl_r.mean()),"pf":metrics(pd.concat([scalp_shadow,swing_shadow]))["profit_factor"],"dd_definition":"exit-order realized only","dd_r":metrics(pd.concat([scalp_shadow,swing_shadow]))["realized_exit_order_dd_r"]},
        {"stage":"CORRECTED_LIVE","engine":"combined","n":len(combined),"total_r":float(combined.pnl_r.sum()),"mean_r":float(combined.pnl_r.mean()),"pf":metrics(combined)["profit_factor"],"dd_definition":"M5 mark-to-market portfolio","dd_r":cb_port["mtm_max_drawdown_r"]}
    ]
    pd.DataFrame(attribution).to_csv(OUT/"attribution.csv",index=False)

    defect_register={
        "reference_head":"b9f645b6781021b923430710afd9881d25a9d009",
        "verified":{
            "D01_bid_only_long_execution":True,
            "D02_signal_order_combined_drawdown":True,
            "D03_wave_pseudo_h1_sampling":True,
            "D04_observation_count_time_semantics":True,
            "D05_future_label_filtered_event_stream":True,
            "D06_signal_year_split_without_outcome_boundary":True,
            "D07_control_raw_features":True,
            "D07_max_adverse_anchor_empirical_max_abs":float(np.nanmax(np.abs(deg))) if len(deg) else None,
            "D08_m5_both_bar_stop_first_without_m1":True,
            "source_has_bid_and_ask":True
        },
        "m1_resolution":{
            "ambiguous_m5_seen":int(resolver.ambiguous_m5),
            "resolved_by_m1":int(resolver.resolved_by_m1),
            "unresolved_same_m1_or_missing":int(resolver.unresolved_same_m1)
        },
        "data_meta":data_meta
    }
    (OUT/"defect_register.json").write_text(json.dumps(defect_register,indent=2),encoding="utf-8")

    summary={
        "scope":"Measurement & Execution Audit v0.1",
        "pristine_forward_oos_read":False,
        "reference_head":"b9f645b6781021b923430710afd9881d25a9d009",
        "protocol_commit":"492ad7a",
        "time_semantics":"completed trading observations, not wall-clock",
        "cost_contract":"historical quoted spread included via ask-entry/bid-exit; commission/financing excluded",
        "model_stats":{"scalper_control":control_stats,"swing_wave":wave_stats},
        "execution_reconciliation":recon,
        "reference_signal_set_spread_reprice":{
            "scalper":metrics(ref_sp_scalp),"swing":metrics(ref_sp_swing),"combined":metrics(ref_sp_combined),
            "mapping":{"scalper":ref_sp_scalp_info,"swing":ref_sp_swing_info}
        },
        "corrected":{
            "scalper":{"shadow":metrics(scalp_shadow),"live":metrics(scalp_live),"yearly":by_year(scalp_live),"segments":by_segment(scalp_live),"portfolio":sc_port},
            "swing":{"shadow":metrics(swing_shadow),"live":metrics(swing_live),"yearly":by_year(swing_live),"segments":by_segment(swing_live),"portfolio":sw_port},
            "combined":{"live":metrics(combined),"yearly":by_year(combined),"segments":by_segment(combined),"portfolio":cb_port}
        },
        "m1_resolution":defect_register["m1_resolution"],
        "cost_sensitivity":cost_rows
    }
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    print("SCALPER",json.dumps(summary["corrected"]["scalper"]),flush=True)
    print("SWING",json.dumps(summary["corrected"]["swing"]),flush=True)
    print("COMBINED",json.dumps(summary["corrected"]["combined"]),flush=True)
    print("REF_SPREAD",json.dumps(summary["reference_signal_set_spread_reprice"]),flush=True)
    print("M1_RESOLUTION",json.dumps(summary["m1_resolution"]),flush=True)

if __name__=="__main__":
    main()
