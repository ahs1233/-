"""GTG Confirmed Handoff Execution v0.1.

Side-aware execution audit from the frozen causal resolution bar.
Post-selection diagnostic only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
from compare import costs
from regime_atlas_v01 import load_h1
from multiscale_symbolic_v01 import ms
from state_transition_engine_v02 import MAX_CONTIG_GAP, RAW_END, STEP

PROTOCOL = HERE / "PROTOCOL_CONFIRMED_HANDOFF_EXECUTION_V0_1.md"
HORIZONS = (4, 12, 24)

EXPECTED = {
    "handoff_records": "45a3c0204d0d46cd722c85031f99b70ec9e9ac2a3abfc39955407a0206158efd",
    "handoff_summary": "bc0902d4c348baf6c01d63c72679d1cca0c94e046f8fe9ea0805eb3b4f42e22e",
    "state_manifest": "30f2c4d8de89b7c09ce7405a9791ee1c29053489d890d0298d0988e3e1ebd66a",
    "shadow_summary": "9a2220effc20c35548a25caf6e5c568dd4c79580b1a2a4b9806d6b03bb8a9207",
}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_jsonl(p: Path) -> list[dict]:
    out=[]
    with p.open("r",encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                out.append(json.loads(line))
    return out


def path_ok(t: np.ndarray, i: int, h: int) -> bool:
    if i+h >= len(t):
        return False
    d=np.diff(t[i:i+h+1])
    return bool(
        int(t[i+h]) < ms(RAW_END)
        and np.all(d>0)
        and np.all(d<=MAX_CONTIG_GAP)
    )


def make_record(e: dict, f: pd.DataFrame, q: int, h: int) -> dict | None:
    t=f.t.to_numpy(dtype=np.int64)
    if not path_ok(t,q,h) or q+1>=len(f):
        return None
    d=int(e["resolved_direction"])
    if d not in (-1,1):
        raise ValueError("bad resolved direction")
    atr=float(f.atr.iloc[q])
    if not np.isfinite(atr) or atr<=0:
        return None

    cc=costs(
        d,
        float(f.bo.iloc[q+1]),
        float(f.ao.iloc[q+1]),
        float(f.bc.iloc[q+h]),
        float(f.ac.iloc[q+h]),
        atr,
    )
    start=float(f.bc.iloc[q])
    signed=float(d*(float(f.bc.iloc[q+h])-start)/atr)
    hi=float(f.bh.iloc[q+1:q+h+1].max())
    lo=float(f.bl.iloc[q+1:q+h+1].min())
    if d==1:
        mfe=(hi-start)/atr
        mae=(start-lo)/atr
    else:
        mfe=(start-lo)/atr
        mae=(hi-start)/atr

    lower=float(e["frozen_lower"]); upper=float(e["frozen_upper"])
    closes=f.bc.iloc[q+1:q+h+1].to_numpy(dtype=float)
    returned=bool(np.any((closes>=lower)&(closes<=upper)))

    return {
        "event_id":int(e["event_id"]),
        "onset_time":int(e["onset_time"]),
        "resolution_time":int(e["resolution_time"]),
        "resolution_delay_bars":int(e["resolution_delay_bars"]),
        "year":int(pd.to_datetime(e["resolution_time"],unit="ms",utc=True).year),
        "direction":d,
        "resolution":e["resolution"],
        "horizon":int(h),
        "signed_displacement_atr":signed,
        "directional_correct":bool(signed>0),
        "mfe_atr":float(mfe),
        "mae_atr":float(mae),
        "returned_inside":returned,
        "c0":float(cc["c0"]),
        "c1":float(cc["c1"]),
        "c2":float(cc["c2"]),
    }


def summarize(rr: list[dict]) -> dict:
    if not rr:
        return {}
    return {
        "eligible_confirmed_episodes":len(rr),
        "active_trades":len(rr),
        "directional_accuracy":float(np.mean([r["directional_correct"] for r in rr])),
        "c0_mean_per_trade":float(np.mean([r["c0"] for r in rr])),
        "c1_mean_per_trade":float(np.mean([r["c1"] for r in rr])),
        "c2_mean_per_trade":float(np.mean([r["c2"] for r in rr])),
        "c1_win_rate":float(np.mean([r["c1"]>0 for r in rr])),
        "mean_signed_displacement_atr":float(np.mean([r["signed_displacement_atr"] for r in rr])),
        "mean_mfe_atr":float(np.mean([r["mfe_atr"] for r in rr])),
        "mean_mae_atr":float(np.mean([r["mae_atr"] for r in rr])),
        "returned_inside_fraction":float(np.mean([r["returned_inside"] for r in rr])),
    }


def subgroup(rr: list[dict]) -> dict:
    if not rr:
        return {"n":0}
    return {
        "n":len(rr),
        "c1_mean_per_trade":float(np.mean([r["c1"] for r in rr])),
        "c2_mean_per_trade":float(np.mean([r["c2"] for r in rr])),
        "directional_accuracy":float(np.mean([r["directional_correct"] for r in rr])),
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True)
    ap.add_argument("--handoff-run",required=True)
    ap.add_argument("--state-run",required=True)
    ap.add_argument("--shadow-run",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    root=Path(a.root); handoff=Path(a.handoff_run); state=Path(a.state_run)
    shadow=Path(a.shadow_run); out=Path(a.out)
    out.mkdir(parents=True,exist_ok=False)

    checks={
        "handoff_records":sha(handoff/"handoff_records.jsonl"),
        "handoff_summary":sha(handoff/"summary.json"),
        "state_manifest":sha(state/"input_manifest.json"),
        "shadow_summary":sha(shadow/"summary.json"),
    }
    for k,v in EXPECTED.items():
        if checks[k].lower()!=v:
            raise ValueError(f"frozen input hash changed {k}: {checks[k]}")

    (out/"environment.json").write_text(json.dumps({
        "python":sys.version,
        "protocol_sha256":sha(PROTOCOL),
        "code_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "created_utc":datetime.now(timezone.utc).isoformat(),
        "validation_read":False,
        "holdout_read":False,
    },indent=2),encoding="utf-8")

    hand=load_jsonl(handoff/"handoff_records.jsonl")
    events=[
        e for e in hand
        if e.get("split")=="evaluation"
        and e.get("resolution") in ("TREND_UP","TREND_DOWN")
    ]
    if len(events)!=280:
        raise ValueError(f"expected 280 confirmed trend events, got {len(events)}")
    for e in events:
        expected_dir=1 if e["resolution"]=="TREND_UP" else -1
        if int(e["resolved_direction"])!=expected_dir:
            raise ValueError("resolution direction mismatch")

    f,quality=load_h1(root,RAW_END,out/"input_manifest.json")
    source_manifest=json.loads((state/"input_manifest.json").read_text(encoding="utf-8"))
    this_manifest=json.loads((out/"input_manifest.json").read_text(encoding="utf-8"))
    if this_manifest!=source_manifest:
        raise ValueError("source manifest changed")

    t_to_i={int(v):i for i,v in enumerate(f.t.to_numpy(dtype=np.int64))}
    records=[]
    for e in events:
        rt=int(e["resolution_time"])
        if rt not in t_to_i:
            raise ValueError(f"resolution timestamp missing {rt}")
        q=t_to_i[rt]
        for h in HORIZONS:
            r=make_record(e,f,q,h)
            if r is not None:
                records.append(r)

    with (out/"records.jsonl").open("w",encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r,allow_nan=False)+"\n")

    summary={}
    by_dir={}
    by_year={}
    by_delay={}
    for h in HORIZONS:
        rr=[r for r in records if r["horizon"]==h]
        summary[str(h)]=summarize(rr)
        by_dir[str(h)]={
            "up":subgroup([r for r in rr if r["direction"]==1]),
            "down":subgroup([r for r in rr if r["direction"]==-1]),
        }
        by_delay[str(h)]={
            str(d):subgroup([r for r in rr if r["resolution_delay_bars"]==d])
            for d in sorted(set(r["resolution_delay_bars"] for r in rr))
        }

    rr4=[r for r in records if r["horizon"]==4]
    for year in sorted(set(r["year"] for r in rr4)):
        z=[r for r in rr4 if r["year"]==year]
        by_year[str(year)]={
            "n":len(z),
            "c1_mean_per_trade":float(np.mean([r["c1"] for r in z])) if len(z)>=10 else None,
            "c2_mean_per_trade":float(np.mean([r["c2"] for r in z])) if len(z)>=10 else None,
        }

    h4=summary["4"]; sides=by_dir["4"]
    screen={
        "active_trades_ge_150":h4["active_trades"]>=150,
        "c0_positive":h4["c0_mean_per_trade"]>0,
        "c1_positive":h4["c1_mean_per_trade"]>0,
        "c2_nonnegative":h4["c2_mean_per_trade"]>=0,
        "c1_win_rate_gt_0_50":h4["c1_win_rate"]>0.50,
        "both_sides_ge_50":sides["up"]["n"]>=50 and sides["down"]["n"]>=50,
    }
    screen["pass"]=bool(all(screen.values()))

    shadow_summary=json.loads((shadow/"summary.json").read_text(encoding="utf-8"))
    compare={
        "ALL_TRANSITIONS_h4":shadow_summary["summary"]["ALL_TRANSITIONS"]["4"],
        "LOGISTIC_GATE_h4":shadow_summary["summary"]["LOGISTIC_GATE"]["4"],
        "ORACLE_TREND_SUBSET_onset_h4":shadow_summary["summary"]["ORACLE_TREND_SUBSET"]["4"],
        "CONFIRMED_HANDOFF_h4":h4,
    }

    report={
        "scope":"GTG Confirmed Handoff Execution v0.1 post-selection diagnostic",
        "validation_read":False,
        "holdout_read":False,
        "quality":quality,
        "frozen_input_hashes":checks,
        "summary":summary,
        "h4_by_direction":by_dir["4"],
        "h4_by_year":by_year,
        "by_resolution_delay":by_delay,
        "h4_descriptive_comparison":compare,
        "registered_h4_screen":screen,
        "integrity":{
            "frozen_input_hashes_unchanged":"PASS",
            "confirmed_cohort_exact_280":"PASS",
            "resolved_direction_match":"PASS",
            "resolution_timestamp_exists":"PASS",
            "entry_strictly_after_resolution":"PASS",
            "source_manifest_unchanged":"PASS",
            "market_continuity_le_3h":"PASS",
            "validation_read":False,
            "holdout_read":False,
        },
        "evidence_status":"POST_SELECTION_DIAGNOSTIC_NOT_INDEPENDENT_VALIDATION",
    }
    (out/"summary.json").write_text(
        json.dumps(report,indent=2,allow_nan=False),encoding="utf-8"
    )

    print(json.dumps({
        "h4":h4,
        "h12":summary["12"],
        "h24":summary["24"],
        "h4_by_direction":by_dir["4"],
        "h4_by_delay":by_delay["4"],
        "screen":screen,
    },indent=2),flush=True)


if __name__=="__main__":
    main()
