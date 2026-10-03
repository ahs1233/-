"""GTG microstructure forward snapshot collector.

One-shot append-only recorder for PanWatch gold-fusion JSON.
This module never reads GTG price Forward OOS or Historical Holdout.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import shutil
import subprocess
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

COLLECTOR_VERSION = "microstructure-forward-v0.1"
DEFAULT_ROOT = Path(r"C:\Users\alk\gtg-lab-data-microstructure")

PANWATCH_SOURCE_BLOBS = {
    "src/modules/xau/xaut_order_flow.py": "a4cda68e299c133b28cdd5322675063ef64dbb6a",
    "src/modules/xau/gold_market_fusion.py": "a6caacb5032dd2143e1a16b1ca70e14f28660c7a",
    "src/modules/xau/gold_market_fusion_runtime.py": "56f9291fe9fa1ecadf4a8553bb01679b10b9fe5a",
    "src/modules/xau/gold_tape_store.py": "74be14dcae08dc0c2eda7ea8c59fd98e7a8026f3",
    "src/modules/xau/api.py": "687b39bce3c38dfa2147161746310e95007997af",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def canonical_bytes(payload: Any) -> bytes:
    return (
        json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
        + "\n"
    ).encode("utf-8")


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def with_force(url: str, force: bool) -> str:
    if not force:
        return url
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["force"] = "true"
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def fetch_json(url: str, *, timeout: float = 30.0, force: bool = False) -> tuple[Any, int, str]:
    final_url = with_force(url, force)
    req = Request(
        final_url,
        method="GET",
        headers={
            "Accept": "application/json",
            "User-Agent": "GTG-Lab-Microstructure-Forward/0.1",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        status = int(getattr(resp, "status", 200) or 200)
        if status < 200 or status >= 300:
            raise RuntimeError(f"non-2xx HTTP status {status}")
        body = resp.read()
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception as exc:
        raise ValueError("response is not valid UTF-8 JSON") from exc
    return payload, status, final_url


def source_health_summary(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    health = payload.get("source_health")
    if not isinstance(health, dict):
        return {}
    out: dict[str, Any] = {}
    for name, row in sorted(health.items()):
        if isinstance(row, dict):
            out[str(name)] = {
                "available": bool(row.get("available")),
                "status": row.get("status"),
                "error": row.get("error"),
            }
        else:
            out[str(name)] = {"available": bool(row), "status": None, "error": None}
    return out


@contextmanager
def exclusive_lock(root: Path):
    lock_dir = root / ".capture.lock"
    root.mkdir(parents=True, exist_ok=True)
    try:
        lock_dir.mkdir()
    except FileExistsError as exc:
        raise RuntimeError(f"collector lock already exists: {lock_dir}") from exc
    try:
        yield
    finally:
        shutil.rmtree(lock_dir, ignore_errors=True)


def manifest_path(root: Path) -> Path:
    return root / "manifest.jsonl"


def read_manifest(root: Path) -> list[dict[str, Any]]:
    path = manifest_path(root)
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except Exception as exc:
                raise ValueError(f"invalid manifest JSON at line {lineno}") from exc
            if not isinstance(row, dict):
                raise ValueError(f"manifest row {lineno} is not an object")
            rows.append(row)
    return rows


def _capture_stamp(now: datetime) -> str:
    value = now.astimezone(timezone.utc)
    return value.strftime("%Y%m%dT%H%M%S.") + f"{value.microsecond:06d}Z"


def _observed_at(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    direct = payload.get("observed_at")
    if isinstance(direct, str):
        return direct
    # Fusion may expose latest timestamps inside venue/source metadata.
    for key in ("fusion", "market_agreement", "composite"):
        row = payload.get(key)
        if isinstance(row, dict) and isinstance(row.get("observed_at"), str):
            return str(row["observed_at"])
    return None


def store_snapshot(
    root: Path,
    payload: Any,
    *,
    endpoint: str,
    http_status: int = 200,
    transport: str = "http",
    panwatch_commit: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    root = Path(root)
    now = (now or utc_now()).astimezone(timezone.utc)
    raw = canonical_bytes(payload)
    digest = sha256_bytes(raw)
    day = now.strftime("%Y-%m-%d")

    with exclusive_lock(root):
        rows = read_manifest(root)
        for row in rows:
            capture = str(row.get("capture_received_utc") or "")
            if capture.startswith(day) and row.get("sha256") == digest:
                return {
                    "stored": False,
                    "duplicate": True,
                    "sha256": digest,
                    "path": row.get("path"),
                    "manifest_rows": len(rows),
                }

        rel = (
            Path("raw")
            / now.strftime("%Y")
            / now.strftime("%m")
            / now.strftime("%d")
            / f"{_capture_stamp(now)}_{digest[:12]}.json"
        )
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raise FileExistsError(f"refusing to overwrite snapshot: {target}")

        temp = target.with_suffix(target.suffix + ".tmp")
        if temp.exists():
            temp.unlink()
        with temp.open("xb") as fh:
            fh.write(raw)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(temp, target)

        row = {
            "collector_version": COLLECTOR_VERSION,
            "capture_received_utc": now.isoformat(),
            "observed_at": _observed_at(payload),
            "path": rel.as_posix(),
            "sha256": digest,
            "bytes": len(raw),
            "endpoint": endpoint,
            "transport": transport,
            "http_status": int(http_status),
            "panwatch_commit": panwatch_commit,
            "fusion_status": payload.get("status") if isinstance(payload, dict) else None,
            "source_health": source_health_summary(payload),
            "panwatch_branch": "feat/ahmed-toolbox-xau",
            "panwatch_source_blobs": PANWATCH_SOURCE_BLOBS,
            "historical_holdout_read": False,
            "pristine_price_oos_decoded": False,
        }
        line = (json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")
        mp = manifest_path(root)
        with mp.open("ab") as fh:
            fh.write(line)
            fh.flush()
            os.fsync(fh.fileno())

        return {
            "stored": True,
            "duplicate": False,
            "sha256": digest,
            "path": rel.as_posix(),
            "manifest_rows": len(rows) + 1,
            "bytes": len(raw),
        }


def audit_root(root: Path) -> dict[str, Any]:
    root = Path(root)
    issues: list[dict[str, Any]] = []
    rows = read_manifest(root)
    seen_paths: set[str] = set()
    seen_day_sha: set[tuple[str, str]] = set()

    for idx, row in enumerate(rows, start=1):
        rel = str(row.get("path") or "")
        digest = str(row.get("sha256") or "")
        capture = str(row.get("capture_received_utc") or "")
        day = capture[:10]
        key = (day, digest)

        if not rel:
            issues.append({"row": idx, "type": "MISSING_PATH"})
            continue
        if rel in seen_paths:
            issues.append({"row": idx, "type": "DUPLICATE_PATH", "path": rel})
        seen_paths.add(rel)
        if key in seen_day_sha:
            issues.append({"row": idx, "type": "DUPLICATE_DAY_SHA", "day": day, "sha256": digest})
        seen_day_sha.add(key)

        p = (root / rel).resolve()
        try:
            p.relative_to(root.resolve())
        except ValueError:
            issues.append({"row": idx, "type": "PATH_ESCAPE", "path": rel})
            continue
        if not p.exists():
            issues.append({"row": idx, "type": "MISSING_FILE", "path": rel})
            continue
        actual_bytes = p.stat().st_size
        if actual_bytes != int(row.get("bytes") or -1):
            issues.append({
                "row": idx,
                "type": "BYTE_MISMATCH",
                "path": rel,
                "manifest": row.get("bytes"),
                "actual": actual_bytes,
            })
        actual_sha = sha256_file(p)
        if actual_sha != digest:
            issues.append({
                "row": idx,
                "type": "SHA_MISMATCH",
                "path": rel,
                "manifest": digest,
                "actual": actual_sha,
            })
        try:
            json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            issues.append({"row": idx, "type": "INVALID_RAW_JSON", "path": rel})

    return {
        "scope": "GTG Microstructure Forward Collection audit v0.1",
        "manifest_rows": len(rows),
        "valid_rows": len(rows) - len({i.get("row") for i in issues if i.get("row")}),
        "first_capture": rows[0].get("capture_received_utc") if rows else None,
        "last_capture": rows[-1].get("capture_received_utc") if rows else None,
        "issues": issues,
        "status": "PASS" if not issues else "FAIL",
        "historical_holdout_read": False,
        "pristine_price_oos_decoded": False,
    }




def git_output(repo: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(repo), *args],
        text=True,
        stderr=subprocess.STDOUT,
    ).strip()


def verify_panwatch_source(repo: Path) -> str:
    repo = Path(repo)
    if not (repo / ".git").exists():
        raise FileNotFoundError(f"PanWatch git repository not found: {repo}")
    head = git_output(repo, "rev-parse", "HEAD")
    for path, expected_blob in PANWATCH_SOURCE_BLOBS.items():
        actual = git_output(repo, "rev-parse", f"HEAD:{path}")
        if actual != expected_blob:
            raise ValueError(
                f"PanWatch source blob changed for {path}: {actual} != {expected_blob}"
            )
    return head


def fetch_direct_panwatch(repo: Path, *, data_root: Path) -> tuple[Any, str]:
    repo = Path(repo)
    head = verify_panwatch_source(repo)
    runtime_dir = Path(data_root) / "panwatch_runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    os.environ["DATA_DIR"] = str(runtime_dir)
    sys.path.insert(0, str(repo))
    try:
        from src.modules.xau.gold_market_fusion_runtime import get_gold_market_fusion

        payload = asyncio.run(get_gold_market_fusion(force=True))
    finally:
        try:
            sys.path.remove(str(repo))
        except ValueError:
            pass
    return payload, head


def main(argv: list[str] | None = None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(DEFAULT_ROOT))
    ap.add_argument("--url", default=os.environ.get("PANWATCH_GOLD_FUSION_URL"))
    ap.add_argument("--direct-panwatch-repo")
    ap.add_argument("--timeout", type=float, default=30.0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--audit", action="store_true")
    args = ap.parse_args(argv)

    root = Path(args.root)
    if args.audit:
        report = audit_root(root)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        raise SystemExit(0 if report["status"] == "PASS" else 2)

    if bool(args.url) == bool(args.direct_panwatch_repo):
        raise SystemExit("provide exactly one of --url/PANWATCH_GOLD_FUSION_URL or --direct-panwatch-repo")

    if args.direct_panwatch_repo:
        payload, head = fetch_direct_panwatch(Path(args.direct_panwatch_repo), data_root=root)
        result = store_snapshot(
            root,
            payload,
            endpoint="panwatch-direct://gold_market_fusion",
            http_status=200,
            transport="direct_import",
            panwatch_commit=head,
        )
    else:
        payload, status, final_url = fetch_json(args.url, timeout=args.timeout, force=args.force)
        result = store_snapshot(
            root,
            payload,
            endpoint=final_url,
            http_status=status,
            transport="http",
            panwatch_commit=None,
        )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
