"""GTG Chronos-2 DC Gate v0.1 — zero-shot gate over frozen 1ATR bracket trades."""
from __future__ import annotations

import argparse, hashlib, json, sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch

HERE = Path(__file__).resolve().parent
CHRONOS_SITE = Path(r"C:\Users\alk\gtg-lab-library-comparison\.venv-chronos2\Lib\site-packages")
if str(CHRONOS_SITE) not in sys.path:
    sys.path.insert(0, str(CHRONOS_SITE))
from chronos import Chronos2Pipeline

from dc_resumption_h4_validation_v01 import load_h1_capped, RAW_CAP_MS
from state_transition_engine_v02 import MAX_CONTIG_GAP

PROTOCOL = HERE / "PROTOCOL_CHRONOS2_DC_GATE_V0_1.md"
MODEL_REV = "254b5357164a84326913b0695216f690752ac55d"
CONTEXT = 256
HORIZON = 4
QUANTILES = [0.1, 0.5, 0.9]


def sha(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    rows=[]
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip(): rows.append(json.loads(line))
    return rows


def save_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, allow_nan=False)+"\n")


def metrics(rows: list[dict]) -> dict:
    if not rows: return {"n":0}
    return {
        "n": len(rows),
        "long_n": sum(r["direction"]==1 for r in rows),
        "short_n": sum(r["direction"]==-1 for r in rows),
        "c0_mean_per_trade": float(np.mean([r["c0"] for r in rows])),
        "c1_mean_per_trade": float(np.mean([r["c1"] for r in rows])),
        "c2_mean_per_trade": float(np.mean([r["c2"] for r in rows])),
        "c1_win_rate": float(np.mean([r["c1"]>0 for r in rows])),
        "c1_total": float(np.sum([r["c1"] for r in rows])),
        "exit_reason_counts": dict(Counter(r["exit_reason"] for r in rows)),
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--trades", required=True)
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--out", required=True)
    a=ap.parse_args()

    out=Path(a.out); out.mkdir(parents=True, exist_ok=False)
    trades_path=Path(a.trades)
    model_dir=Path(a.model_dir)
    model_file=model_dir/"model.safetensors"
    config_file=model_dir/"config.json"

    env={
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "protocol_sha256": sha(PROTOCOL),
        "code_sha256": sha(Path(__file__)),
        "chronos_forecasting": "2.3.2",
        "torch": torch.__version__,
        "model_revision": MODEL_REV,
        "model_sha256": sha(model_file),
        "config_sha256": sha(config_file),
        "trades_sha256": sha(trades_path),
        "historical_holdout_read": False,
        "forward_oos_decoded": False,
    }
    (out/"environment.json").write_text(json.dumps(env,indent=2),encoding="utf-8")

    trades=load_jsonl(trades_path)
    if len(trades)!=109:
        raise ValueError(f"expected 109 base trades, got {len(trades)}")

    f, quality = load_h1_capped(Path(a.root), RAW_CAP_MS, out/"input_manifest.json")
    t=f.t.to_numpy(dtype=np.int64)
    close=f.bc.to_numpy(dtype=float)
    t_to_i={int(v):i for i,v in enumerate(t)}

    eligible=[]
    rejected_context=[]
    contexts=[]
    for tr in trades:
        i=t_to_i.get(int(tr["signal_time"]))
        if i is None or i < CONTEXT-1:
            rejected_context.append({**tr,"reject_reason":"INSUFFICIENT_CONTEXT"})
            continue
        lo=i-CONTEXT+1
        # Protocol: last 256 observed complete H1 trading bars are treated as
        # an equally-spaced trading-bar sequence. Weekend/session gaps are not
        # a censor for Chronos context.
        x=close[lo:i+1].astype(np.float32)
        if not np.all(np.isfinite(x)):
            rejected_context.append({**tr,"reject_reason":"NONFINITE_CONTEXT"})
            continue
        contexts.append(torch.from_numpy(x).reshape(1,CONTEXT))
        eligible.append((tr,i))

    if not eligible:
        raise ValueError("no eligible contexts")

    batch=torch.stack(contexts,dim=0)  # [N,1,256]
    pipeline=Chronos2Pipeline.from_pretrained(str(model_dir),device_map="cpu",dtype=torch.float32)
    qs,means=pipeline.predict_quantiles(
        batch, prediction_length=HORIZON, quantile_levels=QUANTILES
    )
    if len(qs)!=len(eligible):
        raise ValueError("forecast count mismatch")

    decisions=[]
    allowed=[]
    for (tr,i),q in zip(eligible,qs):
        qlast=q[0,-1].detach().cpu().numpy().astype(float)
        cur=float(close[i])
        atr=float(tr["atr_ref"])
        q10,q50,q90=map(float,qlast)
        direction=int(tr["direction"])
        permit=(q50>cur) if direction==1 else (q50<cur)
        rec={
            **tr,
            "chronos_q10_h4":q10,
            "chronos_q50_h4":q50,
            "chronos_q90_h4":q90,
            "current_bid_close":cur,
            "q10_disp_atr":(q10-cur)/atr,
            "q50_disp_atr":(q50-cur)/atr,
            "q90_disp_atr":(q90-cur)/atr,
            "allowed":bool(permit),
        }
        decisions.append(rec)
        if permit: allowed.append(rec)

    save_jsonl(out/"decisions.jsonl",decisions)
    save_jsonl(out/"allowed_trades.jsonl",allowed)
    save_jsonl(out/"context_rejections.jsonl",rejected_context)

    periods={}
    for p in ("LIBRARY_2018_2020","TRAIN_2021_2024","VALIDATION_2024_2025"):
        periods[p]=metrics([r for r in allowed if r["period"]==p])
    by_dir={
        "long":metrics([r for r in allowed if r["direction"]==1]),
        "short":metrics([r for r in allowed if r["direction"]==-1]),
    }
    by_year={}
    for y in sorted({int(r["year"]) for r in allowed}):
        rr=[r for r in allowed if int(r["year"])==y]
        by_year[str(y)]=metrics(rr)

    overall=metrics(allowed)
    eligible_years=[v for v in by_year.values() if v.get("n",0)>=3]
    nonneg_years=sum(v["c1_mean_per_trade"]>=0 for v in eligible_years)
    max_share=max((v["n"] for v in by_year.values()),default=0)/max(1,len(allowed))

    screen={
        "eligible_guarded_trades_ge_40": overall.get("n",0)>=40,
        "long_ge_10": by_dir["long"].get("n",0)>=10,
        "short_ge_10": by_dir["short"].get("n",0)>=10,
        "combined_c1_positive": overall.get("c1_mean_per_trade",-999)>0,
        "combined_c2_nonnegative": overall.get("c2_mean_per_trade",-999)>=0,
        "c1_win_gt_0_50": overall.get("c1_win_rate",0)>0.50,
        "library_c1_nonnegative": periods["LIBRARY_2018_2020"].get("c1_mean_per_trade",-999)>=0,
        "train_2021_2024_c1_nonnegative": periods["TRAIN_2021_2024"].get("c1_mean_per_trade",-999)>=0,
        "validation_c1_nonnegative": periods["VALIDATION_2024_2025"].get("c1_mean_per_trade",-999)>=0,
        "c1_better_than_unguarded": overall.get("c1_mean_per_trade",-999)>0.1012914197,
        "c2_better_than_unguarded": overall.get("c2_mean_per_trade",-999)>-0.0719509275,
        "four_years_nonnegative_c1": nonneg_years>=4,
        "no_year_over_40pct": max_share<=0.40,
    }
    screen["pass"]=bool(all(screen.values()))

    report={
        "scope":"GTG Chronos-2 DC Gate v0.1 zero-shot opened-history development",
        "quality":quality,
        "base_trades_n":len(trades),
        "forecast_eligible_n":len(decisions),
        "context_rejected_n":len(rejected_context),
        "allowed_n":len(allowed),
        "rejected_by_gate_n":len(decisions)-len(allowed),
        "direction_agreement_rate":len(allowed)/len(decisions),
        "overall":overall,
        "by_period":periods,
        "by_direction":by_dir,
        "by_year":by_year,
        "forecast_displacement":{
            "q10_mean_atr":float(np.mean([r["q10_disp_atr"] for r in decisions])),
            "q50_mean_atr":float(np.mean([r["q50_disp_atr"] for r in decisions])),
            "q90_mean_atr":float(np.mean([r["q90_disp_atr"] for r in decisions])),
        },
        "unguarded_reference":{
            "n":109,
            "c1_mean_per_trade":0.10129141966124279,
            "c2_mean_per_trade":-0.07195092753991844,
        },
        "registered_screen":screen,
        "integrity":{
            "model_revision":MODEL_REV,
            "context_bars":CONTEXT,
            "prediction_length":HORIZON,
            "gate":"Q50_STEP4_DIRECTION_SIGN_ONLY",
            "fine_tuning":False,
            "base_bracket_changed":False,
            "historical_holdout_read":False,
            "forward_oos_decoded":False,
        },
    }
    (out/"summary.json").write_text(json.dumps(report,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps({
        "allowed_n":len(allowed),
        "direction_agreement_rate":report["direction_agreement_rate"],
        "overall":overall,
        "by_period":periods,
        "by_direction":by_dir,
        "screen":screen,
    },indent=2))


if __name__=="__main__":
    main()
