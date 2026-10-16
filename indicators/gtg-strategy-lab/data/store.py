"""Local storage and manifest (TRADE_CONTRACT §2.2).

Data never goes into git (see .gitignore). What is committed is only the manifest,
so a later re-download can be checked byte-for-byte against the recorded sha256.
Layout under a root directory (default: <repo>/.lab-data):
  raw/<kind>/<YYYY>/<MM>/<DD>/<name>.bi5     exact bytes from Dukascopy
  m1/<YYYY>/<MM>/<YYYY-MM-DD>.csv.gz         merged M1 BID/ASK bars of one UTC day
  manifest.jsonl                             one JSON line per raw file / built day
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from bars import FIELDS

DEFAULT_ROOT = Path(__file__).resolve().parents[3] / ".lab-data"


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def root_dir(root: str | os.PathLike | None = None) -> Path:
    p = Path(root) if root else Path(os.environ.get("GTG_LAB_DATA", DEFAULT_ROOT))
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_raw(root: Path, kind: str, when: datetime, name: str, raw: bytes) -> Path:
    p = root / "raw" / kind / f"{when:%Y/%m/%d}" / f"{name}.bi5"
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".part")
    tmp.write_bytes(raw)
    tmp.replace(p)
    return p


def append_manifest(root: Path, entry: dict) -> None:
    entry = {"recorded_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), **entry}
    with open(root / "manifest.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, sort_keys=True) + "\n")


def read_manifest(root: Path) -> list[dict]:
    p = root / "manifest.jsonl"
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]


def _fmt(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return repr(v)
    return str(v)


def write_day(root: Path, day: datetime, bars: list[dict]) -> Path:
    p = root / "m1" / f"{day:%Y/%m}" / f"{day:%Y-%m-%d}.csv.gz"
    p.parent.mkdir(parents=True, exist_ok=True)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(FIELDS)
    for b in bars:
        w.writerow([_fmt(b[k]) for k in FIELDS])
    # mtime=0 keeps the gzip bytes deterministic (same bars -> same sha256).
    tmp = p.with_suffix(".part")
    with open(tmp, "wb") as fh, gzip.GzipFile(fileobj=fh, mode="wb", mtime=0) as gz:
        gz.write(buf.getvalue().encode("utf-8"))
    tmp.replace(p)
    return p


def read_day(path: Path) -> list[dict]:
    num = {"bo", "bh", "bl", "bc", "ao", "ah", "al", "ac", "v"}
    out = []
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            b = {}
            for k in FIELDS:
                v = row[k]
                if k == "t" or k == "n":
                    b[k] = int(v)
                elif k in num:
                    b[k] = float(v) if v != "" else None
                else:
                    b[k] = v
            out.append(b)
    return out
