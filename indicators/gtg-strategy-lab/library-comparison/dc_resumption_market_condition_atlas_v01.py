"""GTG DC Resumption Market-Condition Atlas v0.1."""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import RobustScaler

FEATURES = [
    "aligned_drift12","aligned_drift24","aligned_drift48",
    "efficiency24","efficiency48","spread_atr","atr_week_ratio",
    "prior24_width_atr","aligned_position","aligned_breakout",
    "aligned_dc_count","opposing_dc_count",
    "total_delay_bars","correction_delay_bars","correction_duration_bars",
]

PERIODS = ("LIBRARY_2018_2020","TRAIN_2021_2024","VALIDATION_2024_2025")


def load_jsonl(path: Path) -> list[dict]:
    out=[]
    with path.open("r",encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                out.append(json.loads(line))
    return out


def build_signal_map(train_signals: list[dict], val_signals: list[dict]) -> dict[tuple[str,int],dict]:
    out={}
    for source,rows in (("TRAIN",train_signals),("VALIDATION",val_signals)):
        for r in rows:
            if r.get("status")=="DC_RESUMPTION_ENTRY":
                out[(source,int(r["event_id"]))]=r
    return out


def feature_row(trade: dict, state_row: pd.Series, signal_row: dict) -> dict:
    d=int(trade["direction"])
    if d not in (-1,1):
        raise ValueError("bad direction")
    aligned_dc_count = float(state_row["dc_up_count"] if d==1 else state_row["dc_down_count"])
    opposing_dc_count = float(state_row["dc_down_count"] if d==1 else state_row["dc_up_count"])
    aligned_breakout = float(state_row["breakout_up_atr"] if d==1 else state_row["breakout_down_atr"])
    return {
        "aligned_drift12": d*float(state_row["drift12"]),
        "aligned_drift24": d*float(state_row["drift24"]),
        "aligned_drift48": d*float(state_row["drift48"]),
        "efficiency24": float(state_row["efficiency24"]),
        "efficiency48": float(state_row["efficiency48"]),
        "spread_atr": float(state_row["spread_atr"]),
        "atr_week_ratio": float(state_row["atr_week_ratio"]),
        "prior24_width_atr": float(state_row["prior24_width_atr"]),
        "aligned_position": d*(float(state_row["position24"])-0.5),
        "aligned_breakout": aligned_breakout,
        "aligned_dc_count": aligned_dc_count,
        "opposing_dc_count": opposing_dc_count,
        "total_delay_bars": float(signal_row["total_delay_bars"]),
        "correction_delay_bars": float(signal_row["correction_delay_bars"]),
        "correction_duration_bars": float(signal_row["correction_duration_bars"]),
    }


def canonical_labels(raw_labels: np.ndarray, centers_original: np.ndarray) -> np.ndarray:
    order=sorted(range(len(centers_original)),
                 key=lambda i:(centers_original[i, FEATURES.index("atr_week_ratio")],
                               centers_original[i, FEATURES.index("efficiency24")]))
    remap={old:new for new,old in enumerate(order)}
    return np.asarray([remap[int(x)] for x in raw_labels],dtype=int)


def cluster_summary(rows: list[dict], cluster: int, centroid: dict) -> dict:
    z=[r for r in rows if int(r["cluster"])==cluster]
    by_period={}
    for p in PERIODS:
        q=[r for r in z if r["period"]==p]
        by_period[p]={
            "n":len(q),
            "c1_mean_per_trade": float(np.mean([r["c1"] for r in q])) if q else None,
            "c2_mean_per_trade": float(np.mean([r["c2"] for r in q])) if q else None,
            "c1_win_rate": float(np.mean([r["c1"]>0 for r in q])) if q else None,
        }
    return {
        "cluster":cluster,
        "n":len(z),
        "long_n":sum(r["direction"]==1 for r in z),
        "short_n":sum(r["direction"]==-1 for r in z),
        "centroid":centroid,
        "period_counts":dict(Counter(r["period"] for r in z)),
        "year_counts":dict(Counter(str(r["year"]) for r in z)),
        "c0_mean_per_trade":float(np.mean([r["c0"] for r in z])),
        "c1_mean_per_trade":float(np.mean([r["c1"] for r in z])),
        "c2_mean_per_trade":float(np.mean([r["c2"] for r in z])),
        "c1_win_rate":float(np.mean([r["c1"]>0 for r in z])),
        "exit_reason_counts":dict(Counter(r["exit_reason"] for r in z)),
        "by_period":by_period,
    }


def hypothesis_status(s: dict) -> tuple[bool,str]:
    if s["n"]<15:
        return False,"n<15"
    represented=[p for p,v in s["by_period"].items() if v["n"]>0]
    if len(represented)<2:
        return False,"appears_in_fewer_than_2_periods"
    signs=[]
    for p,v in s["by_period"].items():
        if v["n"]>=5 and v["c1_mean_per_trade"] is not None:
            signs.append(1 if v["c1_mean_per_trade"]>0 else -1 if v["c1_mean_per_trade"]<0 else 0)
    if not signs:
        return False,"no_period_with_n>=5"
    if len(set(signs))!=1:
        return False,"c1_sign_not_stable"
    return True,"stable_positive" if signs[0]>0 else "stable_negative"


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--trades",required=True)
    ap.add_argument("--train-signals",required=True)
    ap.add_argument("--validation-signals",required=True)
    ap.add_argument("--extended-state",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()

    trades=load_jsonl(Path(a.trades))
    if len(trades)!=109:
        raise ValueError(f"expected 109 trades, got {len(trades)}")
    sigmap=build_signal_map(load_jsonl(Path(a.train_signals)),load_jsonl(Path(a.validation_signals)))
    state=pd.read_csv(a.extended_state)
    smap={int(t):i for i,t in enumerate(state.t.to_numpy(dtype=np.int64))}

    rows=[]
    for tr in trades:
        key=(str(tr["source"]),int(tr["event_id"]))
        sig=sigmap.get(key)
        if sig is None:
            raise ValueError(f"missing signal {key}")
        si=smap.get(int(tr["signal_time"]))
        if si is None:
            raise ValueError("signal time absent from state")
        fr=feature_row(tr,state.iloc[si],sig)
        if not np.all(np.isfinite([fr[x] for x in FEATURES])):
            raise ValueError("nonfinite feature")
        rows.append({**tr,**fr})

    X=np.asarray([[r[f] for f in FEATURES] for r in rows],dtype=float)
    scaler=RobustScaler().fit(X)
    Z=scaler.transform(X)

    km=KMeans(n_clusters=4,n_init=50,random_state=20261003)
    raw=km.fit_predict(Z)
    centers_orig=scaler.inverse_transform(km.cluster_centers_)
    labels=canonical_labels(raw,centers_orig)

    # canonical centroid mapping
    old_to_new={}
    for old in range(4):
        # any row with raw==old gives canonical label
        idx=np.flatnonzero(raw==old)[0]
        old_to_new[old]=int(labels[idx])
    canonical_centers=[None]*4
    for old,new in old_to_new.items():
        canonical_centers[new]={f:float(v) for f,v in zip(FEATURES,centers_orig[old])}

    for r,c in zip(rows,labels):
        r["cluster"]=int(c)

    clusters=[]
    hypotheses=[]
    for c in range(4):
        s=cluster_summary(rows,c,canonical_centers[c])
        ok,reason=hypothesis_status(s)
        s["hypothesis_candidate"]=ok
        s["hypothesis_reason"]=reason
        clusters.append(s)
        if ok:
            hypotheses.append({"cluster":c,"reason":reason,"n":s["n"],"centroid":s["centroid"]})

    period_cluster={}
    for p in PERIODS:
        period_cluster[p]=dict(Counter(str(r["cluster"]) for r in rows if r["period"]==p))

    report={
        "scope":"GTG DC Resumption Market-Condition Atlas v0.1",
        "n":len(rows),
        "features":FEATURES,
        "k":4,
        "n_init":50,
        "random_state":20261003,
        "silhouette":float(silhouette_score(Z,labels)),
        "clusters":clusters,
        "period_cluster_counts":period_cluster,
        "hypotheses":hypotheses,
        "decision":"CONDITION_HYPOTHESES_FOUND" if hypotheses else "NO_STABLE_CONDITION_STRUCTURE",
        "integrity":{
            "outcome_fields_in_clustering_features":False,
            "forward_oos_read":False,
            "historical_holdout_read":False,
            "trade_filter_emitted":False,
        },
    }
    out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)
    with (out/"atlas_rows.jsonl").open("w",encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r,allow_nan=False)+"\n")
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({
        "silhouette":report["silhouette"],
        "decision":report["decision"],
        "clusters":[{
            "cluster":s["cluster"],"n":s["n"],"c1":s["c1_mean_per_trade"],
            "hypothesis":s["hypothesis_candidate"],"reason":s["hypothesis_reason"],
            "by_period":s["by_period"],
        } for s in clusters],
    },indent=2))


if __name__=="__main__":
    main()
