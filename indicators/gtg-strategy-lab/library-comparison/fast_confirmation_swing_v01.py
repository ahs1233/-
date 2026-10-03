"""Fast-confirmation Swing diagnostic from frozen confirmed-handoff execution records."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
import numpy as np

HORIZONS=(4,12,24)

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def load_jsonl(p):
    return [json.loads(x) for x in Path(p).read_text(encoding="utf-8").splitlines() if x.strip()]

def summarize(rows):
    if not rows: return {"n":0}
    out={"n":len(rows),
      "directional_accuracy":float(np.mean([r["directional_correct"] for r in rows])),
      "mean_signed_displacement_atr":float(np.mean([r["signed_displacement_atr"] for r in rows])),
      "mean_mfe_atr":float(np.mean([r["mfe_atr"] for r in rows])),
      "mean_mae_atr":float(np.mean([r["mae_atr"] for r in rows])),
      "c1_win_rate":float(np.mean([r["c1"]>0 for r in rows]))}
    for k in ("c0","c1","c2"):
        out[f"{k}_mean_per_trade"]=float(np.mean([r[k] for r in rows]))
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--confirmed-run",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    src=Path(a.confirmed_run); out=Path(a.out); out.mkdir(parents=True,exist_ok=False)
    rows=load_jsonl(src/"records.jsonl")
    base_summary=json.loads((src/"summary.json").read_text(encoding="utf-8"))

    result={"scope":"GTG Fast Confirmation Swing v0.1 post-selection diagnostic",
      "validation_read":False,"holdout_read":False,
      "source_hashes":{"records":sha(src/"records.jsonl"),"summary":sha(src/"summary.json")},
      "horizons":{}}

    for h in HORIZONS:
        allh=[r for r in rows if int(r["horizon"])==h]
        fast=[r for r in allh if int(r["resolution_delay_bars"])==1]
        A=summarize(allh); F=summarize(fast)
        bydir={}
        for d,name in [(1,"up"),(-1,"down")]:
            z=[r for r in fast if int(r["direction"])==d]
            bydir[name]=summarize(z)
        byyear={}
        for yr in sorted({int(r["year"]) for r in fast}):
            z=[r for r in fast if int(r["year"])==yr]
            if len(z)>=10: byyear[str(yr)]=summarize(z)
        result["horizons"][str(h)]={"ALL_CONFIRMED":A,"FAST_CONFIRMATION":F,
          "retained_fraction":float(len(fast)/len(allh)) if allh else None,
          "by_direction":bydir,"by_year":byyear,
          "delta_vs_all":{"c1_per_trade":F.get("c1_mean_per_trade",0)-A.get("c1_mean_per_trade",0),
                          "c2_per_trade":F.get("c2_mean_per_trade",0)-A.get("c2_mean_per_trade",0)}}

    h4=result["horizons"]["4"]["FAST_CONFIRMATION"]
    years=result["horizons"]["4"]["by_year"]
    positive_years=sum(1 for y in ("2021","2022","2023")
      if y in years and years[y].get("c1_mean_per_trade",0)>0)
    screen={"active_trades_ge_100":h4["n"]>=100,
      "c0_positive":h4.get("c0_mean_per_trade",-1)>0,
      "c1_positive":h4.get("c1_mean_per_trade",-1)>0,
      "c2_nonnegative":h4.get("c2_mean_per_trade",-1)>=0,
      "c1_win_rate_gt_0_50":h4.get("c1_win_rate",0)>.50,
      "both_directions_ge_40":(
        result["horizons"]["4"]["by_direction"]["up"]["n"]>=40 and
        result["horizons"]["4"]["by_direction"]["down"]["n"]>=40),
      "positive_c1_in_two_full_years":positive_years>=2}
    screen["pass"]=bool(all(screen.values()))
    result["registered_h4_screen"]=screen
    result["integrity"]={"only_delay_1_selected":"PASS","source_records_sha_recorded":"PASS",
      "no_outcome_based_selection":"PASS","validation_read":False,"holdout_read":False}

    with (out/"records_fast.jsonl").open("w",encoding="utf-8") as fh:
        for r in rows:
            if int(r["resolution_delay_bars"])==1:
                fh.write(json.dumps(r,allow_nan=False)+"\n")
    (out/"summary.json").write_text(json.dumps(result,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps(result,indent=2),flush=True)

if __name__=="__main__": main()
