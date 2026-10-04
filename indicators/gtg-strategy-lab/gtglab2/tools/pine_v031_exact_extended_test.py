from __future__ import annotations
from pathlib import Path
from datetime import datetime, timedelta, timezone
import argparse, json, sys
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve()
GTG = HERE.parents[1]
LAB = GTG.parent
LIB = LAB / "library-comparison"
DATA = LAB / "data"
for x in (GTG, LIB, DATA, GTG / "engine"):
    sys.path.insert(0, str(x))

from store import read_day
from dc_resumption_h4_validation_v01 import complete_h1, read_day_prefix, validate_rows
from doctrine_reference_v01 import aggregate_from_h1
from mtf_context import latest_completed_asof

EXCLUSIONS = {"2024-01-05", "2026-09-27", "2026-09-28", "2026-09-29"}
FREEZE_MS = int(pd.Timestamp("2026-09-30T13:40:49Z").timestamp() * 1000)
SOURCE_START = datetime(2018, 3, 1)
MAX_GAP_MS = 10_800_000

def load_clean(root: Path) -> tuple[pd.DataFrame, dict]:
    day = SOURCE_START
    last = datetime(2026, 9, 30)
    h1, dropped, days = [], 0, 0
    while day <= last:
        ds = day.strftime("%Y-%m-%d")
        day += timedelta(days=1)
        if ds in EXCLUSIONS:
            continue
        stamp = datetime.fromisoformat(ds)
        p = root / "m1" / stamp.strftime("%Y/%m/%Y-%m-%d.csv.gz")
        if not p.exists():
            continue
        if ds == "2026-09-30":
            rows, _ = read_day_prefix(p, FREEZE_MS)
            validate_rows(rows, ds, FREEZE_MS)
        else:
            rows = read_day(p)
            validate_rows(rows, ds)
        kept, n_drop = complete_h1(rows)
        h1.extend(kept)
        dropped += n_drop
        days += 1
    f = pd.DataFrame(h1).sort_values("t").reset_index(drop=True)
    c = f.bc.to_numpy(float)
    prev = np.r_[c[0], c[:-1]]
    tr = np.maximum(f.bh.to_numpy(float) - f.bl.to_numpy(float),
                    np.maximum(np.abs(f.bh.to_numpy(float) - prev),
                               np.abs(f.bl.to_numpy(float) - prev)))
    f["atr"] = pd.Series(tr).rolling(14).mean()
    return f, {"complete_h1": int(len(f)), "incomplete_dropped": int(dropped), "days_loaded": days}

def dc_dir(close: pd.Series, th: float) -> np.ndarray:
    out = np.zeros(len(close), dtype=np.int8)
    hi = lo = ext = float(close.iloc[0])
    d = 0
    for i, x in enumerate(close.to_numpy(float)):
        if d == 0:
            hi = max(hi, x); lo = min(lo, x)
            if x >= lo * (1 + th):
                d, ext = 1, x
            elif x <= hi * (1 - th):
                d, ext = -1, x
        elif d == 1:
            if x > ext:
                ext = x
            elif x <= ext * (1 - th):
                d, ext = -1, x
        else:
            if x < ext:
                ext = x
            elif x >= ext * (1 + th):
                d, ext = 1, x
        out[i] = d
    return out

def run(root: Path, start_ms: int, end_ms: int, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=False)
    f, quality = load_clean(root)
    n = len(f)
    c, h, l, o = (f.bc.astype(float), f.bh.astype(float), f.bl.astype(float), f.bo.astype(float))
    t = f.t.to_numpy(np.int64)

    tr = pd.Series(np.maximum(h-l, np.maximum(np.abs(h-c.shift(1).fillna(c.iloc[0])),
                                              np.abs(l-c.shift(1).fillna(c.iloc[0])))))
    atr14 = tr.rolling(14).mean()
    ach = (c-c.shift(1)).abs()
    path24 = ach.rolling(24).mean()*24.0
    path48 = ach.rolling(48).mean()*48.0
    eff24 = (c-c.shift(24)).abs()/path24.replace(0,np.nan)
    eff48 = (c-c.shift(48)).abs()/path48.replace(0,np.nan)
    dr12 = (c-c.shift(12))/atr14
    dr24 = (c-c.shift(24))/atr14
    dr48 = (c-c.shift(48))/atr14
    upper = h.shift(1).rolling(24).max()
    lower = l.shift(1).rolling(24).min()
    width = upper-lower
    pos = (c-lower)/width.replace(0,np.nan)
    bup = (c-upper)/atr14
    bdn = (lower-c)/atr14

    dirs = np.column_stack([dc_dir(c,.0025), dc_dir(c,.005), dc_dir(c,.01), dc_dir(c,.02)])
    upc = (dirs==1).sum(axis=1)
    dnc = (dirs==-1).sum(axis=1)
    rv = (eff24.le(.35).fillna(False).astype(int)+eff48.le(.35).fillna(False).astype(int)+
          dr24.abs().le(1.5).fillna(False).astype(int)+dr48.abs().le(3).fillna(False).astype(int)).to_numpy()
    range_core = rv >= 3
    trend_up = (upc>=3) & (dr24.to_numpy()>=1.0) & (eff24.to_numpy()>=.35)
    trend_dn = (dnc>=3) & (dr24.to_numpy()<=-1.0) & (eff24.to_numpy()>=.35)
    break_up = bup.to_numpy() >= .10
    break_dn = bdn.to_numpy() >= .10
    valid = np.zeros(n, bool)
    for i in range(168, n):
        vals=(atr14.iloc[i],dr12.iloc[i],dr24.iloc[i],dr48.iloc[i],eff24.iloc[i],eff48.iloc[i],
              upper.iloc[i],lower.iloc[i],pos.iloc[i])
        valid[i]=all(np.isfinite(v) for v in vals)

    ST_RANGE, ST_TRANS, ST_UP, ST_DN = 0, 1, 2, -2
    SRC_NONE, SRC_RANGE, SRC_OTHER = 0, 1, 2
    state=np.full(n,999,np.int16)
    market=None; last_valid=None; src=SRC_NONE; tdir=0; tstart=None
    tprev=tup=tlo=np.nan; ust=dust=rst=0; range_age=0; rcore_streak=0
    new_range=np.zeros(n,bool); new_up=np.full(n,np.nan); new_lo=np.full(n,np.nan)
    cv=c.to_numpy(float); uv=upper.to_numpy(float); lv=lower.to_numpy(float)

    for i in range(n):
        if not valid[i]:
            continue
        if last_valid is not None:
            g=t[i]-last_valid
            if g<=0 or g>MAX_GAP_MS:
                market=None; src=SRC_NONE; tdir=0; tstart=None
                tprev=tup=tlo=np.nan; ust=dust=rst=0; range_age=0; rcore_streak=0
        prev=market
        if prev is None:
            if range_core[i]:
                market=ST_RANGE; range_age=1
            elif trend_up[i]:
                market=ST_UP; range_age=0
            elif trend_dn[i]:
                market=ST_DN; range_age=0
            else:
                market=ST_TRANS; src=SRC_OTHER; tdir=0; tstart=i; tprev=cv[i]; ust=dust=rst=0
        elif prev==ST_RANGE:
            trig=1 if break_up[i] else (-1 if break_dn[i] else (1 if trend_up[i] else (-1 if trend_dn[i] else 0)))
            if trig==0:
                market=ST_RANGE; range_age+=1
            else:
                market=ST_TRANS; src=SRC_RANGE; tdir=trig; tstart=i; tprev=cv[i]; tup=uv[i]; tlo=lv[i]
                ust=dust=rst=0; new_range[i]=True; new_up[i]=uv[i]; new_lo[i]=lv[i]; range_age=0
        elif prev==ST_TRANS:
            age=i-tstart+1; resolved=False; rs=ST_TRANS
            if src==SRC_RANGE:
                conf=((tdir==1 and tprev>tup and cv[i]>tup and upc[i]>=3 and dr24.iloc[i]>0) or
                      (tdir==-1 and tprev<tlo and cv[i]<tlo and dnc[i]>=3 and dr24.iloc[i]<0))
                back=(tprev>=tlo and tprev<=tup and cv[i]>=tlo and cv[i]<=tup)
                if conf:
                    resolved=True; rs=ST_UP if tdir==1 else ST_DN
                elif back:
                    resolved=True; rs=ST_RANGE
                elif age>=4:
                    resolved=True; rs=ST_UP if trend_up[i] else (ST_DN if trend_dn[i] else ST_RANGE)
            else:
                ust=ust+1 if trend_up[i] else 0
                dust=dust+1 if trend_dn[i] else 0
                rst=rst+1 if range_core[i] else 0
                if (tdir==1 and ust>=2) or (tdir==0 and ust>=2):
                    resolved=True; rs=ST_UP
                elif (tdir==-1 and dust>=2) or (tdir==0 and dust>=2):
                    resolved=True; rs=ST_DN
                elif rst>=2:
                    resolved=True; rs=ST_RANGE
                elif age>=4:
                    resolved=True; rs=ST_UP if trend_up[i] else (ST_DN if trend_dn[i] else ST_RANGE)
            if resolved:
                market=rs; src=SRC_NONE; tdir=0; tstart=None; tprev=tup=tlo=np.nan
                ust=dust=rst=0; rcore_streak=0; range_age=1 if rs==ST_RANGE else 0
            else:
                market=ST_TRANS; tprev=cv[i]
        elif prev==ST_UP:
            if trend_dn[i]:
                market=ST_TRANS; src=SRC_OTHER; tdir=-1; tstart=i; tprev=cv[i]; ust=dust=rst=0; rcore_streak=0
            else:
                rcore_streak=rcore_streak+1 if range_core[i] else 0
                if rcore_streak>=3:
                    market=ST_RANGE; range_age=1; rcore_streak=0
                else: market=ST_UP
        elif prev==ST_DN:
            if trend_up[i]:
                market=ST_TRANS; src=SRC_OTHER; tdir=1; tstart=i; tprev=cv[i]; ust=dust=rst=0; rcore_streak=0
            else:
                rcore_streak=rcore_streak+1 if range_core[i] else 0
                if rcore_streak>=3:
                    market=ST_RANGE; range_age=1; rcore_streak=0
                else: market=ST_DN
        state[i]=market; last_valid=t[i]

    ema50=c.ewm(span=50,adjust=False).mean()
    h1s=ema50-ema50.shift(1)
    h4=aggregate_from_h1(f,"H4"); d1=aggregate_from_h1(f,"D")
    h4e=h4.bc.astype(float).ewm(span=50,adjust=False).mean()
    d1e=d1.bc.astype(float).ewm(span=50,adjust=False).mean()
    h4["slope"]=h4e-h4e.shift(1); d1["slope"]=d1e-d1e.shift(1)
    a4=latest_completed_asof(f.t,h4,"H4",["slope"])
    ad=latest_completed_asof(f.t,d1,"D1",["slope"])
    def sgn(x):
        a=np.asarray(x,float); z=np.zeros(len(a),int); z[a>0]=1; z[a<0]=-1; return z
    score=sgn(h1s.fillna(0))+sgn(a4.slope.fillna(0))+sgn(ad.slope.fillna(0))

    ret_long=np.zeros(n,bool); ret_short=np.zeros(n,bool); ret_boundary=np.full(n,np.nan)
    waiting_res=False; waiting_ret=False; event_dir=0; break_i=None
    eup=elo=np.nan; acc_i=None; acc_dir=0; acc_boundary=np.nan
    for i in range(n):
        if new_range[i]:
            cu=h.iloc[i]>new_up[i]; cd=l.iloc[i]<new_lo[i]
            if bool(cu)!=bool(cd):
                waiting_res=True; event_dir=1 if cu else -1; break_i=i; eup=new_up[i]; elo=new_lo[i]
        if waiting_res:
            age=i-break_i
            if age>3:
                waiting_res=False
            elif event_dir==1:
                if c.iloc[i]<=eup:
                    waiting_res=False
                elif age>0 and c.iloc[i-1]>eup and c.iloc[i]>eup:
                    waiting_res=False; waiting_ret=True; acc_i=i; acc_dir=1; acc_boundary=eup
            else:
                if c.iloc[i]>=elo:
                    waiting_res=False
                elif age>0 and c.iloc[i-1]<elo and c.iloc[i]<elo:
                    waiting_res=False; waiting_ret=True; acc_i=i; acc_dir=-1; acc_boundary=elo
        if waiting_ret:
            age=i-acc_i
            if age>6:
                waiting_ret=False
            elif age>=1:
                if acc_dir==1 and l.iloc[i]<=acc_boundary and c.iloc[i]>acc_boundary:
                    ret_long[i]=True; ret_boundary[i]=acc_boundary; waiting_ret=False
                elif acc_dir==-1 and h.iloc[i]>=acc_boundary and c.iloc[i]<acc_boundary:
                    ret_short[i]=True; ret_boundary[i]=acc_boundary; waiting_ret=False

    # v0.3 trade engine: strict MTF +/-3 + 1R stop + close-confirmed profit protection.
    # Stop levels set at a bar close become active on the following bar.
    trades=[]; next_free=0
    for sig in range(n-1):
        if sig<next_free or not(start_ms<=t[sig]<end_ms):
            continue
        long_ok=bool(ret_long[sig] and score[sig]==3)
        short_ok=bool(ret_short[sig] and score[sig]==-3)
        if not(long_ok or short_ok):
            continue
        side=1 if long_ok else -1
        entry=sig+1; boundary=ret_boundary[sig]; a=atr14.iloc[sig]
        if not(np.isfinite(boundary) and np.isfinite(a) and a>0):
            continue
        qty=100.0/a
        ep=float(o.iloc[entry])
        stop=ep-2*a if side==1 else ep+2*a
        best_close=float(c.iloc[entry-1])
        ex=None; xp=None; kind=None

        for j in range(entry, min(n-1, entry+24)):
            # 1) Stop already active at start of this bar.
            oj=float(o.iloc[j]); hj=float(h.iloc[j]); lj=float(l.iloc[j])
            if side==1:
                if oj <= stop:
                    ex=j; xp=oj; kind='Risk/profit stop gap'; break
                if lj <= stop:
                    ex=j; xp=stop; kind='Risk/profit stop'; break
            else:
                if oj >= stop:
                    ex=j; xp=oj; kind='Risk/profit stop gap'; break
                if hj >= stop:
                    ex=j; xp=stop; kind='Risk/profit stop'; break

            # 2) At bar close, evaluate the original v0.2 close-based exits.
            held=j-entry+1
            if side==1:
                opposite=state[j]==ST_DN
                two=c.iloc[j]<=boundary and c.iloc[j-1]<=boundary
            else:
                opposite=state[j]==ST_UP
                two=c.iloc[j]>=boundary and c.iloc[j-1]>=boundary

            if opposite or two or held>=24:
                if j+1>=n or t[j+1]>=end_ms:
                    ex=None
                    break
                ex=j+1; xp=float(o.iloc[j+1])
                kind='Opposite state' if opposite else ('2 closes inside' if two else '24H timeout')
                break

            # 3) Profit protection decided only from this completed close,
            # becoming active on the next H1 bar.
            if side==1:
                best_close=max(best_close,float(c.iloc[j]))
                gain=(best_close-ep)/a
                candidate=ep-2*a
                if gain>=2.0:
                    candidate=max(candidate,ep)
                if gain>=3.0:
                    candidate=max(candidate,ep+a)
                if gain>=6.0:
                    candidate=max(candidate,best_close-2*a)
                stop=max(stop,candidate)
            else:
                best_close=min(best_close,float(c.iloc[j]))
                gain=(ep-best_close)/a
                candidate=ep+2*a
                if gain>=2.0:
                    candidate=min(candidate,ep)
                if gain>=3.0:
                    candidate=min(candidate,ep-a)
                if gain>=6.0:
                    candidate=min(candidate,best_close+2*a)
                stop=min(stop,candidate)

        if ex is None or xp is None:
            continue
        pnl=(xp-ep)*qty*side
        trades.append({"side":"LONG" if side==1 else "SHORT","signal_t":int(t[sig]),"entry_t":int(t[entry]),
                       "exit_t":int(t[ex]),"entry_px":ep,"exit_px":float(xp),"atr_signal":float(a),"qty":float(qty),
                       "pnl_cash":float(pnl),"pnl_r":float(pnl/100.0),"exit_kind":kind,"mtf_score":int(score[sig])})
        next_free=ex

    td=pd.DataFrame(trades)
    if len(td):
        td["signal"]=pd.to_datetime(td.signal_t,unit="ms",utc=True)
        td["year"]=td.signal.dt.year
        td["month"]=td.signal.dt.strftime("%Y-%m")
    td.to_csv(out/"trades.csv",index=False)

    def metrics(x: pd.DataFrame) -> dict:
        if len(x)==0: return {"n":0}
        v=x.pnl_r.to_numpy(float); pos=v[v>0]; neg=v[v<=0]
        eq=np.cumsum(v); peaks=np.maximum.accumulate(np.r_[0.0,eq])[:-1]
        return {"n":int(len(x)),"longs":int((x.side=="LONG").sum()),"shorts":int((x.side=="SHORT").sum()),
                "wins":int((v>0).sum()),"losses":int((v<=0).sum()),"win_rate":float((v>0).mean()),
                "total_r":float(v.sum()),"mean_r":float(v.mean()),"median_r":float(np.median(v)),
                "profit_factor":float(pos.sum()/abs(neg.sum())) if len(neg) and abs(neg.sum())>0 else None,
                "max_drawdown_r":float((eq-peaks).min()),"net_cash_1r100":float(x.pnl_cash.sum())}
    summary={"scope":"GTGLab2 Pine v0.3.1 development candidate: strict MTF +/-3, 2R catastrophe stop, late BE/lock/trail",
             "requested_start":pd.to_datetime(start_ms,unit="ms",utc=True).isoformat(),
             "requested_end":pd.to_datetime(end_ms,unit="ms",utc=True).isoformat(),
             "snapshot_t_freeze":"2026-09-30T13:40:49Z",
             "latest_complete_h1_start":pd.to_datetime(int(t.max()),unit="ms",utc=True).isoformat(),
             "historical_holdout_opened":True,"pristine_forward_oos_read":False,"quality":quality,
             "overall":metrics(td),"by_year":{},"by_month":{}}
    if len(td):
        summary["by_year"]={str(k):metrics(g) for k,g in td.groupby("year")}
        summary["by_month"]={str(k):metrics(g) for k,g in td.groupby("month")}
    (out/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    return summary

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True); ap.add_argument("--out",required=True)
    ap.add_argument("--start",default="2025-01-01T00:00:00Z")
    ap.add_argument("--end",default="2026-10-01T00:00:00Z")
    a=ap.parse_args()
    start_ms=int(pd.Timestamp(a.start).timestamp()*1000)
    requested_end=int(pd.Timestamp(a.end).timestamp()*1000)
    end_ms=min(requested_end, FREEZE_MS)
    print(json.dumps(run(Path(a.root),start_ms,end_ms,Path(a.out)),indent=2))

if __name__=="__main__":
    main()
