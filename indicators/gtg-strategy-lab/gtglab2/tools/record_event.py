"""Append a GTGLab2 event to the canonical evidence trail.

This helper intentionally appends instead of rewriting prior records.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "EVENTS.jsonl"
WORKLOG = ROOT / "WORKLOG.md"


def next_event_id() -> str:
    highest = 0
    if EVENTS.exists():
        for line in EVENTS.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                event_id = str(json.loads(line).get("event_id") or "")
                if event_id.startswith("GTGLAB2-"):
                    highest = max(highest, int(event_id.split("-", 1)[1]))
            except Exception:
                continue
    return f"GTGLAB2-{highest + 1:04d}"


def append_event(
    *,
    event_type: str,
    summary: str,
    reason: str | None,
    result: str | None,
    commit: str | None,
    files: list[str],
    verification: list[str],
) -> dict:
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    event = {
        "ts_utc": ts,
        "event_id": next_event_id(),
        "type": event_type,
        "summary": summary,
        "reason": reason,
        "result": result,
        "commit": commit,
        "files": files,
        "verification": verification,
    }
    EVENTS.parent.mkdir(parents=True, exist_ok=True)
    with EVENTS.open("a", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")

    with WORKLOG.open("a", encoding="utf-8", newline="\n") as fh:
        fh.write(f"\n## {ts} — {event['event_id']} — {event_type}\n\n")
        fh.write(f"**Action:** {summary}\n\n")
        if reason:
            fh.write(f"**Reason:** {reason}\n\n")
        if result:
            fh.write(f"**Result:** {result}\n\n")
        if files:
            fh.write("**Files:**\n" + "".join(f"- `{x}`\n" for x in files) + "\n")
        if verification:
            fh.write("**Verification:**\n" + "".join(f"- {x}\n" for x in verification) + "\n")
        if commit:
            fh.write(f"**Commit:** `{commit}`\n")

    return event


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", required=True)
    ap.add_argument("--summary", required=True)
    ap.add_argument("--reason")
    ap.add_argument("--result")
    ap.add_argument("--commit")
    ap.add_argument("--file", action="append", default=[])
    ap.add_argument("--verify", action="append", default=[])
    args = ap.parse_args()

    event = append_event(
        event_type=args.type,
        summary=args.summary,
        reason=args.reason,
        result=args.result,
        commit=args.commit,
        files=args.file,
        verification=args.verify,
    )
    print(json.dumps(event, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
